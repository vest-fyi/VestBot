import { Environment, StackProps, Stage } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackCreationInfo, STAGE } from 'vest-common-cdk';
import { DnsStack } from './stage-stack/dns';
import { EcsServiceStack } from './stage-stack/ecs-service';
import { SecretStack } from './stage-stack/secret';
import { S3Stack } from './stage-stack/s3';
import { VpcStack } from './stage-stack/vpc';
import { CloudFrontStack } from './stage-stack/cloudfront';
import { USE1ResourcesStack } from './stage-stack/use1-resources';

export interface DeploymentStacksProps extends StackProps {
    readonly stackCreationInfo: StackCreationInfo;
    readonly env: Environment;
}

export class DeploymentStacks extends Stage {
    public readonly vpc: VpcStack;
    public readonly s3: S3Stack;
    public readonly dns?: DnsStack;
    public readonly ecs: EcsServiceStack;
    public readonly secret: SecretStack;
    public readonly use1Resources: USE1ResourcesStack;
    public readonly cloudfront: CloudFrontStack;

    constructor(scope: Construct, id: string, props: DeploymentStacksProps) {
        super(scope, id, props);

        const { stackCreationInfo } = props;
        const {
            stackPrefix,
            stage,
        } = stackCreationInfo;

        const terminationProtection = stage !== STAGE.ALPHA; // Termination protection for non-DEV envs
        const enableHttps = stage !== STAGE.ALPHA;
        const deploySecret = stage !== STAGE.ALPHA;   // Secret deployed for non-DEV envs. Alpha uses beta secrets

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
                crossRegionReferences: false,
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

        if (deploySecret) {
            this.secret = new SecretStack(this, `${stackPrefix}-Secret`, {
                stackCreationInfo,
                terminationProtection,
            });
            this.ecs.addDependency(this.secret);
        }

        // const use1StackCreationInfo = stackCreationInfo;
        // use1StackCreationInfo.region = 'us-east-1';
        // if (stage !== STAGE.ALPHA) {
        //     this.use1Resources = new USE1ResourcesStack(this, `${stackPrefix}-USE1Resources`, {
        //         dns: this.dns!,
        //         env: {
        //             account: props.env.account,
        //             region: 'us-east-1',
        //         },
        //         crossRegionReferences: true,
        //         stackCreationInfo: use1StackCreationInfo,
        //         terminationProtection,
        //     });
        // }

        // this.cloudfront = new CloudFrontStack(this, `${stackPrefix}-CloudFront`, {
        //     cloudFrontCertificate: this.use1Resources?.cloudFrontCertificate,
        //     dnsStack: this.dns,
        //     s3Stack: this.s3,
        //     stackCreationInfo,
        //     crossRegionReferences: true,
        //     terminationProtection,
        // });
    }
}