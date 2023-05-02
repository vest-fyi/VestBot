import { CluRecognizer } from './cluRecognizer';
import { CluConfig } from './cluConfig';
import {
    AnalyzeConversationResponse,
    BaseResolutionUnion, ConversationPrediction,
    DateTimeResolution, ListKey,
} from '@azure/ai-language-conversations';
import { Entity } from '../model/entityTypeMap';
import { TurnContext } from 'botbuilder';
import { Intent } from '../model/intent';
import { InvalidIntentError } from '../error/InvalidIntentError';
import { GetFundamentalDialogParameters } from '../model/fundamental/getFundamentalDialogParameters';
import { FundamentalType } from '../model/fundamental/fundamentalType';
import { VestUtil } from '../util/vestUtil';
import { Stage } from '../model/stage';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { BETA_SERVER_SECRET_ARN, SERVER_SECRET, VEST_DEFAULT_REGION } from '../util/constant';
import { SecretsManagerUtil } from '../util/secrets-manager';
import { logger } from '../util/logger';

export class StockResearchRecognizer {
    private recognizer: CluRecognizer;

    /**
     * Initialize the recognizer. workaround for async not callable in constructor
     *
     * @returns {Promise<void>}
     */
    public async init(): Promise<StockResearchRecognizer> {
        let cluAPIKey, cluAPIHostName, cluProjectName, cluDeploymentName;

        // bring your own .env file for local testing
        if (process.env.STAGE == Stage.LOCAL || !process.env.STAGE) {
            cluAPIKey = process.env.CluAPIKey;
            cluAPIHostName = process.env.CluAPIHostName;
            cluProjectName = process.env.CluProjectName;
            cluDeploymentName = process.env.CluDeploymentName;
        } else {
            const client = new SecretsManagerClient({ region: VEST_DEFAULT_REGION });
            const secretMgr = new SecretsManagerUtil(client);

            const serverSecret = await secretMgr.getServerSecret(process.env.STAGE == Stage.ALPHA ? BETA_SERVER_SECRET_ARN : SERVER_SECRET);
            logger.debug(serverSecret, 'serverSecret is');
            cluAPIKey = serverSecret.CluAPIKey;
            cluAPIHostName = serverSecret.CluAPIHostName;
            cluProjectName = serverSecret.CluProjectName;
            cluDeploymentName = serverSecret.CluDeploymentName;

            logger.debug(cluAPIKey, 'cluAPIKey: ');
            logger.debug(cluAPIHostName, 'cluAPIHostName: ');
            logger.debug(cluProjectName, 'cluProjectName: ');
            logger.debug(cluDeploymentName, 'cluDeploymentName: ');
        }

        const cluConfig = new CluConfig({
            endpointKey: cluAPIKey,
            endpoint: `https://${cluAPIHostName}`,
            projectName: cluProjectName,
            deploymentName: cluDeploymentName,
        });

        this.recognizer = new CluRecognizer(cluConfig);

        if (this.recognizer === undefined) {
            throw new Error(
                'FlightBookingRecognizer is not configured. Please check your configuration.'
            );
        }

        return this;
    }

    /**
     * Returns an object with preformatted CLU results for the bot's dialogs to consume.
     * @param {TurnContext} context
     */
    public async executeCluQuery(
        context: TurnContext
    ): Promise<AnalyzeConversationResponse> {
        return await this.recognizer.recognizeAsync(context);
    }

    /**
     * Returns an object with preformatted CLU results
     * @param utterance
     */
    public async executeCluQueryOnUtterance(
        utterance: string
    ): Promise<AnalyzeConversationResponse> {
        return await this.recognizer.recognizeUtteranceAsync(utterance);
    }

    public static getGetFundamentalDialogEntitiesFromCluResponse(
        response: AnalyzeConversationResponse
    ): GetFundamentalDialogParameters {
        const getFundamentalRequest = new GetFundamentalDialogParameters();

        const entities = (response.result.prediction as ConversationPrediction).entities;
        entities.forEach((entity) => {
            switch (VestUtil.removeCapitalization(entity.category)) {
                case Entity.STOCK:
                    getFundamentalRequest.symbol = entity.text;
                    break;
                case Entity.FUNDAMENTAL_TYPE:
                    getFundamentalRequest.fundamentalType =
                        VestUtil.enumFromStringValue(FundamentalType, (entity.extraInformation.filter(
                            (extraInfo) =>
                                extraInfo.extraInformationKind === 'ListKey'
                        )[0] as ListKey).key);

                    break;

                // TODO: add support for retrieval with date VES-30
                // case Entity.DATA_DATE:
                //     getFundamentalRequest.fundamentalTimex =
                //         StockResearchRecognizer.getTimexFromDatetimeEntity(
                //             entity.resolution
                //         );
                //     break;
                // case Entity.DATA_END_DATE:
                //     getFundamentalRequest.fundamentalTimex =
                //         StockResearchRecognizer.getTimexFromDatetimeEntity(
                //             entity.resolution
                //         );
                //     break;
            }
        });

        return getFundamentalRequest;
    }

    /**
     * Returns the top intent from the CLU response
     * @throws InvalidIntentError if the top intent is not a valid Intent
     *
     * @param response  CLU response
     */
    public getTopIntent(response: AnalyzeConversationResponse): Intent {
        const topIntent = response.result.prediction.topIntent;

        const intent = VestUtil.enumFromStringValue(Intent, topIntent);

        if (intent) {
            return intent;
        } else {
            throw new InvalidIntentError(`Invalid top intent: ${topIntent}`);
        }
    }

    /**
     * Returns the top intent confidence from the CLU response
     *
     * @param response  CLU response
     */
    public getTopIntentConfidence(response: AnalyzeConversationResponse): number {
        return response.result.prediction.intents[0].confidence;
    }

    private static getTimexFromDatetimeEntity(
        datetimeEntity: BaseResolutionUnion[]
    ) {
        if (!datetimeEntity || !datetimeEntity[0]) return undefined;

        const timex = (datetimeEntity[0] as DateTimeResolution).timex;
        if (!timex) return undefined;

        return timex;
    }

}
