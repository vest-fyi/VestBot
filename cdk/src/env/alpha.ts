import {
  AHA_DEFAULT_REGION,
  getEnvFromStackCreationInfo,
  STAGE,
  createStackCreationInfo,
} from 'aha-common-cdk';
import { App } from 'aws-cdk-lib';
import { DeploymentStacks } from '../stack/deployment-stacks';

export function createAlphaStacks(app: App, devAccountId: string) {
  const stackCreationInfo = createStackCreationInfo(devAccountId, AHA_DEFAULT_REGION, STAGE.ALPHA);

  new DeploymentStacks(app, `${ stackCreationInfo.stackPrefix }-DeploymentStacks`, {
    stackCreationInfo,
    env: getEnvFromStackCreationInfo(stackCreationInfo),
  });

}
