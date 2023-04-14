import { StackCreationInfo } from 'aha-common-cdk/src/index';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
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

    // create s3 buckets
    this.nftBucket = this.createBucket('nft');
    this.emojiBucket = this.createBucket('emoji');
    this.elbAccessLogBucket = this.createBucket('elb-access-log', true);

    // TODO: create cloudfront & let s3 not public https://app.zenhub.com/workspaces/eng-milestone-2n-63623e68398ae54af1d65ec2/issues/earnaha/aha-common-cdk/71
    // this.createCloudfront(this.nftBucket, `${nftBucketName}-dist`);
    // this.createCloudfront(this.emojiBucket, `${emojiBucketName}-dist`);

  }
  private createBucket(name: string, logging = false): Bucket {
    const bucketFullName = this.getBucketName(name);

    return new Bucket(this, bucketFullName, {
      bucketName: bucketFullName,
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      ...(logging && {
        lifecycleRules: [{
          id: 'limit max log age',
          expiration: Duration.days(6 * 30),
        }],
      }),
    });
  }

  private getBucketName(name: string): string {
    return `${this.props.stackCreationInfo.stackPrefix}-${SERVICE_NAME}-${name}`.toLowerCase();
  }

  private createCloudfront(bucket: Bucket, name: string): Distribution {
    return new Distribution(this, `${name}-dist`, {
      defaultBehavior: { origin: new S3Origin(bucket) },
    });
  }
}