import { StackCreationInfo, STAGE } from 'aha-common-cdk';
import { Environment, StackProps, Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DdbStack } from './stage-stack/ddb';
import { DnsStack } from './stage-stack/dns';
import { EcsServiceStack } from './stage-stack/ecs-service';
import { IntegrationTestStack } from './stage-stack/integration-test';
import { KmsStack } from './stage-stack/kms';
import { S3Stack } from './stage-stack/s3';
import { VpcStack } from './stage-stack/vpc';

export interface DeploymentStacksProps extends StackProps {
  readonly stackCreationInfo: StackCreationInfo;
  readonly env: Environment;
}

export class DeploymentStacks extends Stage {
  public readonly vpc: VpcStack;
  public readonly ddb: DdbStack;
  public readonly s3: S3Stack;
  public readonly dns?: DnsStack;
  public readonly ecs: EcsServiceStack;
  public readonly kms: KmsStack;
  public readonly integ: IntegrationTestStack;

  constructor(scope: Construct, id: string, props: DeploymentStacksProps) {
    super(scope, id, props);

    const { stackCreationInfo } = props;
    const {
      stackPrefix,
      stage,
    } = stackCreationInfo;

    const terminationProtection = stage !== STAGE.ALPHA; // Termination protection for non-DEV envs
    const enableHttps = stage !== STAGE.ALPHA;

    this.vpc = new VpcStack(this, `${stackPrefix}-Vpc`, {
      stackCreationInfo,
      terminationProtection,
    });

    this.ddb = new DdbStack(this, `${stackPrefix}-Ddb`, {
      stackCreationInfo,
      terminationProtection,
    });

    this.s3 = new S3Stack(this, `${stackPrefix}-S3`, {
      stackCreationInfo,
      terminationProtection,
    });

    if (enableHttps) {
      this.dns = new DnsStack(this, `${ stackPrefix }-Dns`, {
        stackCreationInfo,
        terminationProtection,
      });
    }

    this.ecs = new EcsServiceStack(this, `${ stackPrefix }-EcsService`, {
      vpc: this.vpc,
      dns: enableHttps ? this.dns : undefined,
      ddb: this.ddb,
      s3: this.s3,
      enableHttps,
      stackCreationInfo,
      terminationProtection,
    });

    this.kms = new KmsStack(this, `${stackPrefix}-Kms`, {
      stackCreationInfo,
      terminationProtection,
    });

    this.integ = new IntegrationTestStack(this, `${stackPrefix}-IntegrationTest`, {
      stackCreationInfo,
      terminationProtection,
    });

  }
}