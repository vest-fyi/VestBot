import { App } from 'aws-cdk-lib';
import { SERVICE_NAME } from '../constant';
import { PipelineStack } from '../stack/pipeline';
import { STAGE, stageEnvironmentConfiguration, VEST_DEFAULT_REGION } from 'vest-common-cdk';

export function createPipeline(app: App) {
  const pipelineAccountInfo = stageEnvironmentConfiguration[STAGE.BETA];
  const pipelineAccountId = pipelineAccountInfo.accountId;

  new PipelineStack(app, `${SERVICE_NAME}-Pipeline`, {
    env: {
      region: VEST_DEFAULT_REGION,
      account: pipelineAccountId,
    },
  });

}
