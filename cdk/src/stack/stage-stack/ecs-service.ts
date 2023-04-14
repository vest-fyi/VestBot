import path from 'path';
import {
  StackCreationInfo,
  STAGE,
} from 'aha-common-cdk';
import { Stack } from 'aws-cdk-lib';
import { DockerImageAsset } from 'aws-cdk-lib/aws-ecr-assets';
import {
  AwsLogDriver,
  Cluster,
  ContainerImage,
  DeploymentControllerType,
} from 'aws-cdk-lib/aws-ecs';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import {
  ApplicationProtocol,
  CfnTargetGroup,
  Protocol,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ManagedPolicy, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { HEALTH_CHECK_PATH, SERVICE_NAME } from '../../constant';
import { DdbStack } from './ddb';
import { DnsStack } from './dns';
import { S3Stack } from './s3';
import { VpcStack } from './vpc';

export interface EcsServiceStackProps {
  readonly vpc: VpcStack;
  enableHttps?: boolean; // true by default
  readonly dns?: DnsStack; // must provide if enableHttps == true
  readonly ddb: DdbStack;
  readonly stackCreationInfo: StackCreationInfo;
  readonly terminationProtection?: boolean;
  readonly s3: S3Stack;
}

export class EcsServiceStack extends Stack {
  private readonly props: EcsServiceStackProps;

  constructor(scope: Construct, id: string, props: EcsServiceStackProps) {
    super(scope, id, props);
    this.props = props;
    const {
      stackPrefix,
      stage,
    } = props.stackCreationInfo;

    if (typeof props.enableHttps === 'undefined') {
      props.enableHttps = true;
    }

    const serviceExecutionRole = this.createServiceExecutionRole();

    const serviceHostedZone = props.enableHttps ? props.dns!.hostedZone : undefined;
    const INTERNAL_HTTP_PORT = 8080;
    const HTTP_PORT = 80;
    const HTTPS_PORT = 443;
    const cpuUnits = 256;
    const memoryMiB = 512;

    const cluster = new Cluster(this, `${ stackPrefix }-ServiceCluster`, {
      clusterName: `${ stackPrefix }-${ SERVICE_NAME }-Cluster`,
      vpc: props.vpc.vpc,
      enableFargateCapacityProviders: true,
      containerInsights: true,
    });

    // base64 encoding of GITHUB_SSH_PRIVATE_KEY_SECRET_ARN
    const GITHUB_PRIVATE_KEY_BASE_64 = 'LS0tLS1CRUdJTiBPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0KYjNCbGJuTnphQzFyWlhrdGRqRUFBQUFBQkc1dmJtVUFBQUFFYm05dVpRQUFBQUFBQUFBQkFBQUFNd0FBQUF0emMyZ3RaVwpReU5UVXhPUUFBQUNDREtwR0g3dHZ6U1FrVkRES0tOcVFMQ2lhQ2NWVzVtYlBERnlzeGg4ZkxqQUFBQUtBeWp2U0pNbzcwCmlRQUFBQXR6YzJndFpXUXlOVFV4T1FBQUFDQ0RLcEdIN3R2elNRa1ZEREtLTnFRTENpYUNjVlc1bWJQREZ5c3hoOGZMakEKQUFBRUJpTHFDVGZnenIwNXVDbVBHY3BGSTFIeEdOUDE3QzJMMVB1NUdHa0RyeXlvTXFrWWZ1Mi9OSkNSVU1Nb28ycEFzSwpKb0p4VmJtWnM4TVhLekdIeDh1TUFBQUFGblJwYlcxNUxteHBia0JoZG1GdVkyVjJiQzVqYjIwQkFnTUVCUVlICi0tLS0tRU5EIE9QRU5TU0ggUFJJVkFURSBLRVktLS0tLQo=\n';
    const asset = new DockerImageAsset(this, 'ServiceImage', {
      directory: path.join(__dirname, '..', '..', '..', '..'),
      buildArgs: {
        // unfortunately can't retrieve from SecretsManager https://github.com/aws/aws-cdk/issues/14395
        SSH_PRIVATE_KEY: GITHUB_PRIVATE_KEY_BASE_64,
      },
    });

    // TODO: ALB-sharing when feature is available https://app.zenhub.com/workspaces/eng-milestone-2n-63623e68398ae54af1d65ec2/issues/earnaha/aha-common-cdk/64
    const service = new ApplicationLoadBalancedFargateService(this, 'Service', {
      assignPublicIp: true,
      circuitBreaker: { rollback: false }, // see https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeploymentCircuitBreaker.html
      cluster,
      cpu: cpuUnits,
      memoryLimitMiB: memoryMiB,
      deploymentController: {
        // workaround for https://github.com/aws/aws-cdk/issues/23370
        type: DeploymentControllerType.ECS,
        // type: DeploymentControllerType.CODE_DEPLOY, // blue/green deployment model powered by AWS CodeDeploy
      },
      desiredCount: 1,
      taskImageOptions: {
        containerName: SERVICE_NAME,
        image: ContainerImage.fromDockerImageAsset(asset),
        environment: {
          STAGE: stage,
          PORT: INTERNAL_HTTP_PORT.toString(),
          HEALTH_CHECK_PATH: HEALTH_CHECK_PATH,
        },
        enableLogging: true,
        logDriver: new AwsLogDriver({
          streamPrefix: 'service',
          logGroup: new LogGroup(this, `${ SERVICE_NAME }ApplicationLogGroup`),
        }),
        taskRole: serviceExecutionRole,
        containerPort: INTERNAL_HTTP_PORT,
      },
      loadBalancerName: `${ stage }-ALB`,
      maxHealthyPercent: 200,
      minHealthyPercent: stage === STAGE.ALPHA ? 0 : 100, // speed up deployment in dev testing
      openListener: true,
      publicLoadBalancer: true,
      serviceName: `${ stage }-${ SERVICE_NAME }`,
      targetProtocol: ApplicationProtocol.HTTP, // ALB to server
      protocol: props.enableHttps ? ApplicationProtocol.HTTPS : ApplicationProtocol.HTTP, // client to ALB
      listenerPort: props.enableHttps ? HTTPS_PORT : HTTP_PORT,
      certificate: props.enableHttps ? props.dns?.acmCertificate : undefined,
      domainName: props.enableHttps ? serviceHostedZone!.zoneName : undefined,
      domainZone: props.enableHttps ? serviceHostedZone! : undefined,
    });

    service.loadBalancer.logAccessLogs(props.s3.elbAccessLogBucket);

    Array.from(this.props.ddb.tableEntries.values()).forEach(table => {
      DdbStack.grantTable(table, service.taskDefinition.taskRole);
    });

    this.props.s3.nftBucket.grantReadWrite(service.taskDefinition.taskRole);
    this.props.s3.emojiBucket.grantReadWrite(service.taskDefinition.taskRole);

    service.targetGroup.configureHealthCheck({
      path: HEALTH_CHECK_PATH,
      protocol: Protocol.HTTP,
      healthyHttpCodes: '200',
    });

    // workaround for target group port overridden to 80 instead of container port
    // ref: https://github.com/aws/aws-cdk/issues/19411
    (service.targetGroup.node.defaultChild as CfnTargetGroup).port = INTERNAL_HTTP_PORT;
  }

  private createServiceExecutionRole() {
    const serviceRole = new Role(this, `${ SERVICE_NAME }ExecutionRole`, {
      assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy')],
    });

    serviceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

    serviceRole.addToPolicy(this.buildGetSecretPolicy());

    serviceRole.addToPolicy(this.buildGetParameterPolicy());

    return serviceRole;
  }

  private buildGetSecretPolicy(): PolicyStatement {
    return new PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
    });
  }

  private buildGetParameterPolicy(): PolicyStatement {
    return new PolicyStatement({
      actions: ['ssm:DescribeParameters', 'ssm:GetParameter', 'ssm:GetParameters'],
      resources: ['*'],
    });
  }
}
