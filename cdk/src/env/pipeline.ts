import { REGION, sharedStageEnvironmentConfiguration, STAGE } from 'aha-common-cdk';
import { App } from 'aws-cdk-lib';
import { SERVICE_NAME } from '../constant';
import { PipelineStack } from '../stack/pipeline';

export function createPipeline(app: App) {
  const pipelineAccountInfo = sharedStageEnvironmentConfiguration[STAGE.BETA];
  const pipelineAccountId = pipelineAccountInfo.accountId;

  new PipelineStack(app, `${SERVICE_NAME}-Pipeline`, {
    env: {
      region: REGION.APN1,
      account: pipelineAccountId,
    },
  });

}
