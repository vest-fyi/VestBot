import { CluRecognizer } from './cluRecognizer';
import { CluConfig } from './cluConfig';
import {
    AnalyzeConversationResponse,
    BaseResolutionUnion, ConversationPrediction,
    DateTimeResolution, ListKey,
} from '@azure/ai-language-conversations';
import { Entity } from "../model/entityTypeMap";
import { TurnContext } from 'botbuilder';
import { Intent } from '../model/intent';
import { InvalidIntentError } from '../error/InvalidIntentError';
import { GetFundamentalDialogParameters } from "../model/fundamental/getFundamentalDialogParameters";
import { FundamentalType } from '../model/fundamental/fundamentalType';
import { VestUtil } from '../util/vestUtil';

export class StockResearchRecognizer {
    private readonly recognizer: CluRecognizer;

    public constructor() {
        const { CluAPIKey, CluAPIHostName, CluProjectName, CluDeploymentName } =
            process.env;
        const cluConfig = new CluConfig({
            endpointKey: CluAPIKey,
            endpoint: `https://${CluAPIHostName}`,
            projectName: CluProjectName,
            deploymentName: CluDeploymentName,
        });

        this.recognizer = new CluRecognizer(cluConfig);

        if (this.recognizer === undefined) {
            throw new Error(
                'FlightBookingRecognizer is not configured. Please check your configuration.'
            );
        }
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
            console.debug('extracted entity ' + JSON.stringify(entity));

            switch (VestUtil.removeCapitalization(entity.category)) {
                case Entity.STOCK:
                    getFundamentalRequest.stockSymbol = entity.text;
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
    public topIntent(response: AnalyzeConversationResponse): Intent {
        const topIntent = response.result.prediction.topIntent;

        const intent = VestUtil.enumFromStringValue(Intent, topIntent);

        if (intent) {
            return intent;
        } else {
            throw new InvalidIntentError(`Invalid top intent: ${topIntent}`);
        }
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
