import { Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StackCreationInfo, STAGE } from 'vest-common-cdk';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { AllowedMethods, Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { DnsStack } from './dns';
import { S3Stack } from './s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Certificate } from 'aws-cdk-lib/aws-certificatemanager';

export interface CloudFrontStackProps {
    readonly cloudFrontCertificate?: Certificate;    // dns is skipped for alpha stack
    readonly dns?: DnsStack;    // dns is skipped for alpha stack
    readonly s3: S3Stack;
    readonly stackCreationInfo: StackCreationInfo;
    readonly terminationProtection?: boolean;
}

export class CloudFrontStack extends Stack {
    private readonly props: CloudFrontStackProps;

    private readonly STATIC_SUBDOMAIN = 'static';

    constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
        super(scope, id, props);
        this.props = props;
        const { dns, s3, stackCreationInfo } = props;
        const { stage } = stackCreationInfo;
        const { staticContentBucket, cloudFrontLogBucket, originAccessIdentity } = s3;

        // only available for non-alpha stages
        const hostedZone = dns?.serviceHostedZone;

        const distribution = new Distribution(this, 'StaticContentDistribution', {
            defaultBehavior: {
                origin: new S3Origin(staticContentBucket, {
                    originAccessIdentity: originAccessIdentity,
                }),
                allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS
            },
            logBucket: cloudFrontLogBucket,
            enableIpv6: true,
            ...stage !== STAGE.ALPHA && {
                domainNames: [ `${this.STATIC_SUBDOMAIN}.${hostedZone!.zoneName}` ],
            }
        });

        new BucketDeployment(this, 'DeployStaticContent', {
            sources: [ Source.asset('../src/resources/static') ],
            destinationBucket: staticContentBucket,
            distribution,
            prune: true,
            distributionPaths: [ '/*' ],
        });
    }

}