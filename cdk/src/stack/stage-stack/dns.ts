import {
  DELEGATION_PARENT_DOMAIN,
  getStagelessServiceAccountId, HOSTED_ZONE_DELEGATION_ROLE_NAME,
  serviceDnsShortname,
  StackCreationInfo,
  STAGELESS_SERVICE,
} from 'aha-common-cdk';
import { Stack } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { Role } from 'aws-cdk-lib/aws-iam';
import { CrossAccountZoneDelegationRecord, PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';
import { SERVICE_NAME } from '../../constant';


export interface DnsStackProps {
  readonly stackCreationInfo: StackCreationInfo;
  readonly terminationProtection?: boolean;
}

export class DnsStack extends Stack {
  public readonly hostedZone: PublicHostedZone;
  public readonly acmCertificate: Certificate;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    this.hostedZone = this.createDelegatedHostedZoneForService(props.stackCreationInfo);

    this.acmCertificate = this.createAcmCertificate(this.hostedZone, `${ props.stackCreationInfo.stackPrefix }-EcsCertificate`);
  }

  // delegate from parent Hosted Zone in DNS account
  private createDelegatedHostedZoneForService(stackCreationInfo: StackCreationInfo): PublicHostedZone {
    const {
      stage,
      region,
    } = stackCreationInfo;

    const serviceDomain = `${ serviceDnsShortname.NftManagementService }.${ stage }.${ region }.${ DELEGATION_PARENT_DOMAIN }`;

    const subZone = new PublicHostedZone(this, `${ stage }${ SERVICE_NAME }Subdomain`, {
      zoneName: serviceDomain,
    });

    // import the delegation role by constructing the roleArn
    const delegationRoleArn = Stack.of(this).formatArn({
      region: '', // IAM is global in each partition
      service: 'iam',
      account: getStagelessServiceAccountId(STAGELESS_SERVICE.DNS_MANAGEMENT),
      resource: 'role',
      resourceName: HOSTED_ZONE_DELEGATION_ROLE_NAME,
    });
    const delegationRole = Role.fromRoleArn(this, `${ SERVICE_NAME }HZDelegationRole`, delegationRoleArn);

    // create the record
    new CrossAccountZoneDelegationRecord(this, `${ SERVICE_NAME }HZDelegationRecord`, {
      delegatedZone: subZone,
      parentHostedZoneName: DELEGATION_PARENT_DOMAIN,
      delegationRole,
    });

    return subZone;
  }

  private createAcmCertificate(hostedZone: PublicHostedZone, certificateName: string): Certificate {
    return new Certificate(this, certificateName, {
      domainName: hostedZone.zoneName,
      certificateName: certificateName,
      validation: CertificateValidation.fromDns(hostedZone),
    });
  }

}
