import path from 'path';
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
import {
    StackCreationInfo,
    STAGE,
} from 'vest-common-cdk';
import { HEALTH_CHECK_PATH, SERVICE_NAME } from '../../constant';
import { DnsStack } from './dns';
import { S3Stack } from './s3';
import { VpcStack } from './vpc';

export interface EcsServiceStackProps {
    readonly vpc: VpcStack;
    enableHttps?: boolean; // true by default, disabled for alpha
    readonly dns?: DnsStack; // must provide if enableHttps == true
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

        const serviceHostedZone = props.enableHttps ? props.dns?.serviceHostedZone : undefined;
        const INTERNAL_HTTP_PORT = 8080;
        const HTTP_PORT = 80;
        const HTTPS_PORT = 443;
        const cpuUnits = 256;
        const memoryMiB = 512;

        const cluster = new Cluster(this, `${stackPrefix}-ServiceCluster`, {
            clusterName: `${stackPrefix}-${SERVICE_NAME}-Cluster`,
            vpc: props.vpc.vpc,
            enableFargateCapacityProviders: true,
            containerInsights: true,
        });

        // TODO: enable ssh key pass in when src code require private repo
        // const GITHUB_PRIVATE_KEY = getSecret(this, GITHUB_SSH_PRIVATE_KEY_SECRET_ARN);
        const asset = new DockerImageAsset(this, 'ServiceImage', {
            directory: path.join(__dirname, '..', '..', '..', '..'),
            // buildArgs: {
            //     SSH_PRIVATE_KEY: GITHUB_PRIVATE_KEY,
            // },
        });

        // TODO: ALB-sharing when feature is available https://github.com/aws/aws-cdk/issues/13759
        const service = new ApplicationLoadBalancedFargateService(this, 'Service', {
            assignPublicIp: true,
            circuitBreaker: { rollback: false }, // see https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_DeploymentCircuitBreaker.html
            cluster,
            cpu: cpuUnits,
            memoryLimitMiB: memoryMiB,
            deploymentController: {
                type: DeploymentControllerType.ECS,
                // type: DeploymentControllerType.CODE_DEPLOY, // blue/green deployment model powered by AWS CodeDeploy, not supported for CDK pipeline https://github.com/aws/aws-cdk/issues/23370
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
                    logGroup: new LogGroup(this, `${SERVICE_NAME}ApplicationLogGroup`),
                }),
                taskRole: serviceExecutionRole,
                containerPort: INTERNAL_HTTP_PORT,
            },
            loadBalancerName: `${SERVICE_NAME}-${stage}-ALB`,
            maxHealthyPercent: 200,
            minHealthyPercent: stage === STAGE.ALPHA ? 0 : 100, // speed up deployment in dev testing
            openListener: true,
            publicLoadBalancer: true,
            serviceName: `${stage}-${SERVICE_NAME}`,
            targetProtocol: ApplicationProtocol.HTTP, // ALB to server
            protocol: props.enableHttps ? ApplicationProtocol.HTTPS : ApplicationProtocol.HTTP, // client to ALB
            listenerPort: props.enableHttps ? HTTPS_PORT : HTTP_PORT,
            certificate: props.enableHttps ? props.dns?.ecsCertificate : undefined,
            domainName: props.enableHttps ? serviceHostedZone?.zoneName : undefined,
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            domainZone: props.enableHttps ? serviceHostedZone! : undefined,
        });

        service.loadBalancer.logAccessLogs(props.s3.staticContentBucket);

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
        const serviceRole = new Role(this, `${SERVICE_NAME}ExecutionRole`, {
            assumedBy: new ServicePrincipal('ecs-tasks.amazonaws.com'),
            managedPolicies: [ ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy') ],
        });

        serviceRole.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));

        serviceRole.addToPolicy(this.buildGetSecretPolicy());
        serviceRole.addToPolicy(this.buildKmsDecryptPolicy());

        return serviceRole;
    }

    private buildGetSecretPolicy(): PolicyStatement {
        return new PolicyStatement({
            actions: [ 'secretsmanager:GetSecretValue' ],
            resources: [ '*' ],
        });
    }

    private buildKmsDecryptPolicy(): PolicyStatement {
        return new PolicyStatement({
            actions: [ 'kms:Decrypt' ],
            resources: [ '*' ],
        });
    }

}
