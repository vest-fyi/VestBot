import { PromptValidatorContext } from 'botbuilder-dialogs';
import { PromptValidator } from 'botbuilder-dialogs/src/prompts/prompt';
import { MAX_RETRY_COUNT, MAX_RETRY_COUNT_EXCEEDED } from '../util/constant';
import { StockResearchRecognizer } from '../clu/stockResearchRecognizer';
import { AnalyzeConversationResponse } from '@azure/ai-language-conversations';
import { EodHistoricalDataApiError } from "../error/EodHistoricalDataApiError";
import { SymbolNotFoundError } from "../error/SymbolNotFoundError";
import { EodHistoricDataUtil } from "../util/eodHistoricDataUtil";
import { EHDSearchResult } from "../model/eodHistoricalData/model";
import { EHDSymbolType } from '../model/eodHistoricalData/literals';
import { logger } from '../util/logger';

export enum PromptName {
    TEXT_PROMPT = 'textPrompt',
    STOCK_PROMPT = 'stockPrompt',
    FUNDAMENTAL_TYPE_PROMPT = 'fundamentalTypePrompt',
}


export const PromptValidatorMap: Partial<
    Record<PromptName, PromptValidator<any>>
> = {
    [PromptName.STOCK_PROMPT]: stockValidator,
    [PromptName.FUNDAMENTAL_TYPE_PROMPT]: fundamentalTypeValidator,
};

export type StockPromptValidatedResponse = {
    stockSymbol: string;
    stockType: EHDSymbolType;
}

/**
 * Validate the stock input. Override the promptContext.recognized.value with the stock symbol if the stock input is valid.
 *
 * @param promptContext
 */
async function stockValidator(
    promptContext: PromptValidatorContext<string>
): Promise<boolean> {
    if (promptContext.recognized.succeeded) {
        const stockInput = promptContext.recognized.value;
        try {
            const eodHistoricDataUtil = new EodHistoricDataUtil();
            const stock: EHDSearchResult =
                await eodHistoricDataUtil.searchStock(stockInput);

            // update GetFundamentalDialogParameters.stockInput with stock symbol
            promptContext.recognized.value = JSON.stringify({
                stockSymbol: stock.Code + '.' + stock.Exchange,
                stockType: stock.Type,
            } as StockPromptValidatedResponse);

            return true;
        } catch (error) {
            logger.error(error, 'Caught error in stockValidator');

            if (error instanceof EodHistoricalDataApiError) {
                await promptContext.context.sendActivity(
                    'Sorry our service is not available at the moment. Please try again.'
                );
            }
            if (error instanceof SymbolNotFoundError) {
                await promptContext.context.sendActivity(
                    `Sorry we cannot find the stock by the name of ${promptContext.recognized.value}. Please try again.`
                );
            }
        }
    } else if (promptContext.attemptCount >= MAX_RETRY_COUNT) {
        promptContext.recognized.value = MAX_RETRY_COUNT_EXCEEDED;
        return true;
    }

    await promptContext.context.sendActivity(
        'Please try again with a valid company or fund name, or its stock symbol. For symbols with \'.\', please use \'-\' instead. For example, BRK-B.'
    );

    return false;
}

/**
 * Validate the stock input. Override the promptContext.recognized.value with the stock symbol if the stock input is valid.
 *
 * @param promptContext
 */
async function fundamentalTypeValidator(
    promptContext: PromptValidatorContext<string>
): Promise<boolean> {
    if (promptContext.recognized.succeeded) {
        const cluResult: AnalyzeConversationResponse =
            await (await new StockResearchRecognizer().init()).executeCluQueryOnUtterance(
                promptContext.recognized.value
            );

        const getFundamentalParameters =
            StockResearchRecognizer.getGetFundamentalDialogEntitiesFromCluResponse(
                cluResult
            );
        if (getFundamentalParameters.fundamentalType) {
            promptContext.recognized.value =
                getFundamentalParameters.fundamentalType;
            return true;
        }
    } else if (promptContext.attemptCount >= MAX_RETRY_COUNT) {
        promptContext.recognized.value = MAX_RETRY_COUNT_EXCEEDED;
        return true;
    }

    await promptContext.context.sendActivity(
        'Please try again with a valid fundamental type.'
    );
    return false;
}
