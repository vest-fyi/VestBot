import { App } from 'aws-cdk-lib';
import {
  VEST_DEFAULT_REGION,
  getEnvFromStackCreationInfo,
  STAGE,
  createStackCreationInfo,
} from 'vest-common-cdk';
import { DeploymentStacks } from '../stack/deployment-stacks';

export function createAlphaStacks(app: App, devAccountId: string) {
  const stackCreationInfo = createStackCreationInfo(devAccountId, VEST_DEFAULT_REGION, STAGE.ALPHA);

  new DeploymentStacks(app, `${ stackCreationInfo.stackPrefix }-DeploymentStacks`, {
    stackCreationInfo,
    env: getEnvFromStackCreationInfo(stackCreationInfo),
  });

}
