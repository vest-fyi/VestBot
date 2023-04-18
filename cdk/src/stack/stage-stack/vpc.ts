import { Stack } from 'aws-cdk-lib';
import { GatewayVpcEndpointAwsService, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AnyPrincipal, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { StackCreationInfo } from 'vest-common-cdk';

export interface VpcStackProps {
    readonly stackCreationInfo: StackCreationInfo;
    readonly terminationProtection?: boolean;
}

export class VpcStack extends Stack {
    public readonly vpc: Vpc;

    constructor(scope: Construct, id: string, props: VpcStackProps) {
        super(scope, id, props);

        this.vpc = new Vpc(this, `${props.stackCreationInfo.stackPrefix}-Vpc`, {
            cidr: '10.0.0.0/16',
            natGateways: 0,
            maxAzs: Stack.of(this).availabilityZones.length,
            subnetConfiguration: [
                {
                    cidrMask: 20,
                    subnetType: SubnetType.PUBLIC,
                    name: 'Public',
                },
                {
                    cidrMask: 20,
                    subnetType: SubnetType.PRIVATE_ISOLATED,
                    name: 'Isolated',
                },
            ],
            // TODO: add flow log https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.FlowLogOptions.html
            // flowLogRetentionDays: RetentionDays.TEN_YEARS,
        });

        // const dynamoGatewayEndpoint = this.vpc.addGatewayEndpoint('dynamoGatewayEndpoint', {
        //     service: GatewayVpcEndpointAwsService.DYNAMODB,
        // });
        //
        // // ref-link: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_ec2.GatewayVpcEndpoint.html
        // // This allows to customize the endpoint policy
        // dynamoGatewayEndpoint.addToPolicy(
        //     new PolicyStatement({
        //         principals: [ new AnyPrincipal() ],
        //         actions: [ 'dynamodb:*' ],
        //         resources: [ '*' ],
        //     }),
        // );

        const bucketGatewayEndpoint = this.vpc.addGatewayEndpoint('bucketGatewayEndpoint', {
            service: GatewayVpcEndpointAwsService.S3,
        });

        bucketGatewayEndpoint.addToPolicy(new PolicyStatement({
            principals: [ new AnyPrincipal() ],
            actions: [ 's3:*' ],
            resources: [ '*' ],
        }));
    }
}