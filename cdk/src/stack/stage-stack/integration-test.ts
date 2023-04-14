import { getAccountId, SERVICE, STAGE } from 'aha-common-cdk';
import { StackCreationInfo } from 'aha-common-cdk/src/index';
import { Stack } from 'aws-cdk-lib';
import { AccountPrincipal, AccountRootPrincipal, CompositePrincipal, ManagedPolicy, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { SERVICE_NAME } from '../../constant';

export interface IntegrationTestStackProps {
  readonly stackCreationInfo: StackCreationInfo;
  readonly terminationProtection?: boolean;
}

export class IntegrationTestStack extends Stack {
  public static readonly roleName = `${ SERVICE_NAME }IntegrationTestExecutionRole`;

  constructor(scope: Construct, id: string, props: IntegrationTestStackProps) {
    super(scope, id, props);

    this.createIntegrationTestExecutionRole();
  }

  private createIntegrationTestExecutionRole() {

    const serviceRole = new Role(this, IntegrationTestStack.roleName, {
      roleName: IntegrationTestStack.roleName,
      assumedBy: new CompositePrincipal(
        new AccountPrincipal(getAccountId(SERVICE.NFT_MGMT_SERVICE, STAGE.BETA)),
        new AccountRootPrincipal(),
      ),

      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    });

    serviceRole.addToPolicy(this.buildGetParameterPolicy());

    serviceRole.addToPolicy(this.buildGetSecretPolicy());

    serviceRole.addToPolicy(this.buildKmsPolicy());

    return serviceRole;
  }

  private buildGetParameterPolicy(): PolicyStatement {
    return new PolicyStatement({
      actions: ['ssm:DescribeParameters', 'ssm:GetParameter', 'ssm:GetParameters'],
      resources: ['*'],
    });
  }

  private buildGetSecretPolicy(): PolicyStatement {
    return new PolicyStatement({
      sid: 'AllowGetSecretValue',
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
    });
  }

  private buildKmsPolicy(): PolicyStatement {
    return new PolicyStatement({
      sid: 'AllowKMSDecrypt',
      actions: ['kms:Decrypt'],
      resources: ['*'],
    });
  }

}

