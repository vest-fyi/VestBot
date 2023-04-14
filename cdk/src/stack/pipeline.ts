import { AhaPipeline, AhaPipelineProps, getEnvFromStackCreationInfo, GITHUB_STATUS_TRACKING_TOKEN_SECRET_ARN } from 'aha-common-cdk';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { CodePipelinePostToGitHub } from 'cdk-report-codepipeline-status-to-github';
import { Construct } from 'constructs';
import { INTEGRATION_TEST_PKG_NAME, SERVICE_NAME } from '../constant';
import { DeploymentStacks } from './deployment-stacks';
import { IntegrationTestStack } from './stage-stack/integration-test';

export class PipelineStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ahaPipeline = this.createPipeline();

    const githubToken = this.getGitHubToken(GITHUB_STATUS_TRACKING_TOKEN_SECRET_ARN);
    this.addGithubDeploymentStatusTracking(ahaPipeline.pipeline.pipeline, githubToken);
  }

 	private createPipeline(): AhaPipeline {
    const integrationTestRunCmds = [
      'yarn config set -H enableImmutableInstalls false', // work around https://stackoverflow.com/a/67740771/19867997
      'yarn run install:release',
      'yarn run test',
    ];

    const pipelineProps: AhaPipelineProps = {
      service: SERVICE_NAME,
      skipProdStages: false,
      prodManualApproval: false,
      // completeDeploymentCmds,
      trackingPackages: [
        {
          package: 'aha-nft-mgmt-service',
          branch: 'main',
        },
        {
          package: 'aha-common-cdk',
          branch: 'main',
        },
        {
          package: 'aha-nft-data-access',
          branch: 'main',
        },
        {
          package: INTEGRATION_TEST_PKG_NAME,
          branch: 'main',
        },
        {
          package: 'aha-nft-common',
          branch: 'main',
        },
      ],
      integrationTestProps: {
        integrationTestPackageName: INTEGRATION_TEST_PKG_NAME,
        executionRoleName: IntegrationTestStack.roleName,
        testRunCmds: integrationTestRunCmds,
      },
    };

    const pipeline = new AhaPipeline(
      this,
      `${ SERVICE_NAME }-Pipeline`,
      pipelineProps,
    );

    pipeline.deploymentGroupCreationProps.forEach(stageProps => {
      const { stackCreationInfo } = stageProps;

      const deploymentStacks = new DeploymentStacks(
        pipeline,
        `${ stackCreationInfo.stackPrefix }-DeploymentStacks`,
        {
          stackCreationInfo,
          env: getEnvFromStackCreationInfo(stackCreationInfo),
        },
      );

      pipeline.addDeploymentStage(
        stackCreationInfo,
        deploymentStacks,
      );
    });

    	pipeline.pipeline.buildPipeline();

    return pipeline;
  }

  private getGitHubToken(arn: string) {
    // Retrieve GitHub token from secretManager
    const secret = Secret.fromSecretAttributes(this, 'ImportedSecret', {
      secretCompleteArn: arn,
    });
    // Disable usage protection on this secret value
    return secret.secretValue.unsafeUnwrap().toString();
  }

  private addGithubDeploymentStatusTracking(pipeline: Pipeline, githubToken: string) {
    // Tracking pipeline status on github
    new CodePipelinePostToGitHub(this, 'CodePipelinePostToGitHub', {
      pipeline: pipeline,
      githubToken: githubToken,
    });
  }
}


