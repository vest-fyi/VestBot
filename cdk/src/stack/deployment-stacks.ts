import { Environment, StackProps, Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackCreationInfo, STAGE } from 'vest-common-cdk';
import { DnsStack } from './stage-stack/dns';
import { EcsServiceStack } from './stage-stack/ecs-service';
import { ParamSecretStack } from './stage-stack/param-secret';
import { S3Stack } from './stage-stack/s3';
import { VpcStack } from './stage-stack/vpc';

export interface DeploymentStacksProps extends StackProps {
    readonly stackCreationInfo: StackCreationInfo;
    readonly env: Environment;
}

export class DeploymentStacks extends Stage {
    public readonly vpc: VpcStack;
    public readonly s3: S3Stack;
    public readonly dns?: DnsStack;
    public readonly ecs: EcsServiceStack;
    public readonly paramSecret: ParamSecretStack;

    constructor(scope: Construct, id: string, props: DeploymentStacksProps) {
        super(scope, id, props);

        const { stackCreationInfo } = props;
        const {
            stackPrefix,
            stage,
        } = stackCreationInfo;

        const terminationProtection = stage !== STAGE.ALPHA; // Termination protection for non-DEV envs
        const enableHttps = stage !== STAGE.ALPHA;
        const secretDeployed = stage !== STAGE.ALPHA;   // Secret deployed for non-DEV envs. Alpha uses beta secrets

        this.vpc = new VpcStack(this, `${stackPrefix}-Vpc`, {
            stackCreationInfo,
            terminationProtection,
        });

        this.s3 = new S3Stack(this, `${stackPrefix}-S3`, {
            stackCreationInfo,
            terminationProtection,
        });

        if (enableHttps) {
            this.dns = new DnsStack(this, `${stackPrefix}-Dns`, {
                stackCreationInfo,
                terminationProtection,
            });
        }

        this.ecs = new EcsServiceStack(this, `${stackPrefix}-EcsService`, {
            vpc: this.vpc,
            dns: enableHttps ? this.dns : undefined,
            s3: this.s3,
            enableHttps,
            stackCreationInfo,
            terminationProtection,
        });

        this.paramSecret = new ParamSecretStack(this, `${stackPrefix}-ParamSecret`, {
            stackCreationInfo,
            terminationProtection,
        });

        // depend on paramSecret stack to ensure that the secret is created before the ECS service
        if (secretDeployed) {
            this.ecs.addDependency(this.paramSecret);
        }

    }
}