import { CluRecognizer } from './cluRecognizer';
import { CluConfig } from './cluConfig';
import {
    AnalyzeConversationResponse,
    BaseResolutionUnion,
    DateTimeResolution,
} from '@azure/ai-language-conversations';
import { Entity } from "../model/entityTypeMap";
import { TurnContext } from 'botbuilder';
import { Intent } from '../model/intent';
import { InvalidIntentError } from '../error/InvalidIntentError';
import { GetFundamentalDialogParameters } from "../model/fundamental/getFundamentalDialogParameters";

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
        // @ts-expect-error since the response is not strictly typed: BasePredictionUnion = ConversationPrediction | OrchestrationPrediction
        response.result.prediction.entities.forEach((entity) => {
            console.debug('extracted entity ' + JSON.stringify(entity));
            switch (entity.category) {
                case Entity.STOCK:
                    getFundamentalRequest.stockSymbol = entity.text;
                    break;
                case Entity.FUNDAMENTAL_TYPE:
                    getFundamentalRequest.fundamentalType =
                        entity.extraInformation.filter(
                            (extraInfo) =>
                                extraInfo.extraInformationKind === 'ListKey'
                        )[0].key;
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

        const intent = this.enumFromStringValue(Intent, topIntent);

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

    private enumFromStringValue<T> (enm: { [s: string]: T}, value: string): T | undefined {
        return (Object.values(enm) as unknown as string[]).includes(value)
          ? value as unknown as T
          : undefined;
    }

}
