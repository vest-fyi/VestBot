import { Stack } from 'aws-cdk-lib';
import { OrganizationPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { StackCreationInfo, STAGE, VEST_ORGANIZATION_ID } from 'vest-common-cdk';
import { SERVICE_NAME } from '../../constant';

export interface ParamSecretStackProps {
    readonly stackCreationInfo: StackCreationInfo;
    readonly terminationProtection?: boolean;
}

export class ParamSecretStack extends Stack {
    constructor(scope: Construct, id: string, props: ParamSecretStackProps) {
        super(scope, id, props);

        const {stage} = props.stackCreationInfo;
        if(stage === STAGE.ALPHA){
            return;
        }

        const orgPrincipal = new OrganizationPrincipal(VEST_ORGANIZATION_ID);

        const serviceKeyAlias = `${SERVICE_NAME}Key`;
        const serviceKey = new Key(this, serviceKeyAlias, {
            alias: serviceKeyAlias,
        });
        serviceKey.grantEncryptDecrypt(orgPrincipal);

        const secret = new Secret(this, `${SERVICE_NAME}ServerSecret`, {
            encryptionKey: serviceKey,
            secretName: `${SERVICE_NAME}/server-secret`,
            description: `${SERVICE_NAME} server secrets`,
        });

        // Add cross account access to server secret to allow alpha to use beta server secret
        // Org principal is automatically added to Secret resource policy and KMS Key policy for cross account access
        secret.grantRead(orgPrincipal);
    }

}