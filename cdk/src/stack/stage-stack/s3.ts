import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { StackCreationInfo } from 'vest-common-cdk';
import { SERVICE_NAME } from '../../constant';

export interface S3StackProps {
    readonly stackCreationInfo: StackCreationInfo;
    readonly terminationProtection?: boolean;
}

export class S3Stack extends Stack {
    public readonly nftBucket: Bucket;
    public readonly emojiBucket: Bucket;
    public readonly elbAccessLogBucket: Bucket;
    private readonly props: S3StackProps;

    constructor(scope: Construct, id: string, props: S3StackProps) {
        super(scope, id, props);
        this.props = props;

        this.elbAccessLogBucket = this.createBucket('elb-access-log', true);
    }

    private createBucket(name: string, logging = false): Bucket {
        const bucketFullName = this.getBucketName(name);

        return new Bucket(this, bucketFullName, {
            bucketName: bucketFullName,
            removalPolicy: RemovalPolicy.DESTROY,
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
            ...(logging && {
                lifecycleRules: [ {
                    id: 'limit max log age',
                    expiration: Duration.days(6 * 30),
                } ],
            }),
        });
    }

    private getBucketName(name: string): string {
        return `${this.props.stackCreationInfo.stackPrefix}-${SERVICE_NAME}-${name}`.toLowerCase();
    }

}