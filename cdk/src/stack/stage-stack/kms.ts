import { AHA_ORGANIZATION_ID, StackCreationInfo, STAGE } from 'aha-common-cdk';
import { Stack } from 'aws-cdk-lib';
import { OrganizationPrincipal } from 'aws-cdk-lib/aws-iam';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { ParameterTier, StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { SERVICE_NAME } from '../../constant';

export interface KmsStackProps {
  readonly stackCreationInfo: StackCreationInfo;
  readonly terminationProtection?: boolean;
}

export class KmsStack extends Stack {
  private readonly alphaBetaStripeSubscriptionProductIds = {
    monthlyPlanProductId: 'prod_MymYGo335dzrsl',
    annuallyPlanProductId: 'prod_MymYT0OamaVdC4',
  };

  private readonly alphaBetaSpecialCouponIds = {
    userSharedCouponId: '9kliO2XB',
  };

  private readonly gammaProdSpecialCouponIds = {
    userSharedCouponId: 'mX68LOJb',
  };

  private readonly stripeProductIds: Record<
  STAGE,
  StripeSubscriptionProducts
  > = {
      [STAGE.ALPHA]: this.alphaBetaStripeSubscriptionProductIds,
      [STAGE.BETA]: this.alphaBetaStripeSubscriptionProductIds,
      [STAGE.GAMMA]: {
        monthlyPlanProductId: 'prod_N1Pj8HCE9TmMyG',
        annuallyPlanProductId: 'prod_N1PiFhY5rZWrKv',
      },
      [STAGE.PROD]: {
        monthlyPlanProductId: 'prod_N1PjzsRtbGwKWw',
        annuallyPlanProductId: 'prod_N1PkAu9cbzqqD2',
      },
    } as const;

  private readonly stripeCouponIds: Record<
  STAGE,
  StripeSpecialCoupons
  > = {
      [STAGE.ALPHA]: this.alphaBetaSpecialCouponIds,
      [STAGE.BETA]: this.alphaBetaSpecialCouponIds,
      [STAGE.GAMMA]: this.gammaProdSpecialCouponIds,
      [STAGE.PROD]: this.gammaProdSpecialCouponIds,
    } as const;

  constructor(scope: Construct, id: string, props: KmsStackProps) {
    super(scope, id, props);
    const { stage } = props.stackCreationInfo;

    const serviceKeyAlias = `${SERVICE_NAME}Key`;
    const serviceKey = new Key(this, serviceKeyAlias, {
      alias: serviceKeyAlias,
    });

    const secret = new Secret(this, `${SERVICE_NAME}ServerSecret`, {
      encryptionKey: serviceKey,
      secretName: 'aha-nft-mgmt-service/server-secret',
      description: 'aha-nft-mgmt-service server access key',
    });
    // Org principal is automatically added to Secret resource policy and KMS Key policy for cross account access
    secret.grantRead(new OrganizationPrincipal(AHA_ORGANIZATION_ID));

    new Secret(
      this,
      `${SERVICE_NAME}StripeSubscriptionWebhookSigningSecret`,
      {
        encryptionKey: serviceKey,
        secretName:
                    'aha-nft-mgmt-service/stripe-subscription-webhook-signing-secret',
        description:
                    'aha-nft-mgmt-service subscription event processor Stripe webhook signing secret',
      },
    );

    new Secret(
      this,
      `${SERVICE_NAME}StripePaymentWebhookSigningSecret`,
      {
        encryptionKey: serviceKey,
        secretName:
                    'aha-nft-mgmt-service/stripe-payment-webhook-signing-secret',
        description:
                    'aha-nft-mgmt-service payment event processor Stripe webhook signing secret',
      },
    );

    new StringParameter(this, 'Parameter', {
      description:
                'The product IDs for Pro Tier Subscription Stripe products',
      parameterName:
                '/aha-nft-mgmt-service/stripe-subscription-product-ids',
      stringValue: JSON.stringify(this.stripeProductIds[stage]),
      tier: ParameterTier.INTELLIGENT_TIERING,
    });

    new StringParameter(this, 'StripeCouponParameter', {
      description:
                'The coupon IDs for create user-shared discount code',
      parameterName:
                '/aha-nft-mgmt-service/stripe-coupon-ids',
      stringValue: JSON.stringify(this.stripeCouponIds[stage]),
      tier: ParameterTier.INTELLIGENT_TIERING,
    });

    // Sentry DSN is cross-stage, so we only deploy it to the 1st pipeline stage and access across stages
    if (stage == STAGE.BETA) {
      const sentrySecret = new Secret(
        this,
        `${SERVICE_NAME}SentrySecret`,
        {
          encryptionKey: serviceKey,
          secretName:
            'aha-nft-mgmt-service/sentry-secret',
          description:
            'aha-nft-mgmt-service sentry secret for metrics and alarms',
        },
      );
      // Org principal is automatically added to Secret resource policy and KMS Key policy for cross account access
      sentrySecret.grantRead(new OrganizationPrincipal(AHA_ORGANIZATION_ID));
    }

  }

}

interface StripeSubscriptionProducts {
  readonly monthlyPlanProductId: string;
  readonly annuallyPlanProductId: string;
}

interface StripeSpecialCoupons {
  readonly userSharedCouponId: string;
}

