// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InputHints, MessageFactory } from 'botbuilder';
import { DialogTurnResult, TextPrompt, WaterfallDialog, WaterfallStepContext } from 'botbuilder-dialogs';
import { CancelAndHelpDialog } from './cancelAndHelpDialog';
import { DateResolverDialog } from './dateResolverDialog';
import { EodHistoricDataUtil, GetFundamentalResponse } from '../util/eodHistoricDataUtil';
import { PromptName, PromptValidatorMap } from '../model/promptValidator';
import { MAX_RETRY_COUNT_EXCEEDED } from '../util/constant';
import { Dialog } from '../model/dialog';
import { EodHistoricalDataApiError } from '../error/EodHistoricalDataApiError';
import { SymbolNotFoundError } from '../error/SymbolNotFoundError';
import { MaxRetryCountExceededError } from '../error/MaxRetryCountExceededError';
import { GetFundamentalDialogParameters } from '../model/fundamental/getFundamentalDialogParameters';
import { FundamentalType, fundamentalTypePromptName } from '../model/fundamental/fundamentalType';
import { AnalystRating, getAnalystCount } from '../model/fundamental/analystRating';
import { BotResponseHelper } from '../util/BotResponseHelper';
import { EHDBeforeAfterMarket, EHDSearchResult } from '../model/eodHistoricalData/model';
import { Earnings } from '../model/fundamental/earnings';
import { DatetimeUtil } from '../util/datetime';

const DATE_RESOLVER_DIALOG = 'dateResolverDialog';
const WATERFALL_DIALOG = 'waterfallDialog';

/**
 * This dialog helps customer retrieve stock fundamental data.
 */
export class GetFundamentalDialog extends CancelAndHelpDialog {
    private eodHistoricDataUtil: EodHistoricDataUtil;

    constructor(id: string) {
        super(id || Dialog.GET_FUNDAMENTAL);

        this.addDialog(new TextPrompt(PromptName.STOCK_PROMPT, PromptValidatorMap[PromptName.STOCK_PROMPT]))
            .addDialog(
                new TextPrompt(
                    PromptName.FUNDAMENTAL_TYPE_PROMPT,
                    PromptValidatorMap[PromptName.FUNDAMENTAL_TYPE_PROMPT]
                )
            )
            .addDialog(new DateResolverDialog(DATE_RESOLVER_DIALOG))
            .addDialog(
                new WaterfallDialog(WATERFALL_DIALOG, [
                    // TODO: add retry limit for each step VES-26
                    this.stockStep.bind(this),
                    this.fundamentalTypeStep.bind(this),
                    // this.travelDateStep.bind(this),
                    this.finalStep.bind(this),
                ])
            );

        this.initialDialogId = WATERFALL_DIALOG;
        this.eodHistoricDataUtil = new EodHistoricDataUtil();
    }

    /**
     * If a stock has not been provided, prompt for one.
     */
    private async stockStep(
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<DialogTurnResult> {
        if (stepContext.options.stockSymbol) {
            // CLU recognized user stock input may be a company or fund name, or a stock symbol. Search for/validate the stock symbol with this input.
            try {
                const stock: EHDSearchResult = await this.eodHistoricDataUtil.searchStock(
                    stepContext.options.stockSymbol
                );
                return await stepContext.next(stock.Code + stock.Exchange);
            } catch (error) {
                console.error(error);
                if (error instanceof EodHistoricalDataApiError) {
                    await stepContext.context.sendActivity(
                        'Sorry our service is not available at the moment. Please try again later.'
                    );
                    return await stepContext.endDialog(error);
                }
                if (error instanceof SymbolNotFoundError) {
                    await stepContext.context.sendActivity(
                        `Sorry we cannot find the stock by the name of ${stepContext.options.stockSymbol}. Please try again.`
                    );
                }
                console.error(error);
            }
        }

        const messageText = 'Please enter a publicly traded company or fund name, or its stock symbol.';
        const message = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(PromptName.STOCK_PROMPT, {
            prompt: message,
            retryPrompt: "Sorry, I didn't get that. " + messageText,
        });
    }

    private async fundamentalTypeStep(
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<DialogTurnResult> {
        // handle stock prompt response
        if (stepContext.result === MAX_RETRY_COUNT_EXCEEDED) {
            return await stepContext.endDialog(
                new MaxRetryCountExceededError('max retry count exceeded for stock prompt')
            );
        }
        stepContext.options.stockSymbol = stepContext.result;

        // validate or prompt for fundamental type
        if (stepContext.options.fundamentalType) {
            return await stepContext.next(stepContext.options.fundamentalType);
        }

        const messageText = 'Please select the type of fundamental data are you interested in: ';
        const message = MessageFactory.suggestedActions(
            Object.values(fundamentalTypePromptName),
            messageText,
            InputHints.ExpectingInput
        );

        return await stepContext.prompt(PromptName.FUNDAMENTAL_TYPE_PROMPT, {
            prompt: message,
            retryPrompt: "Sorry, I didn't get that. " + messageText,
        });
    }

    // TODO: add support for retrieval with date VES-30
    //  /**
    // //  * If a travel date has not been provided, prompt for one.
    // //  * This will use the DATE_RESOLVER_DIALOG.
    // //  */
    // private async travelDateStep(
    //     stepContext: WaterfallStepContext
    // ): Promise<DialogTurnResult> {
    //     const bookingDetails = stepContext.options as GetFundamentalRequest;
    //
    //     // Capture the results of the previous step
    //     bookingDetails.origin = stepContext.result;
    //     if (
    //         !bookingDetails.travelDate ||
    //         this.isAmbiguous(bookingDetails.travelDate)
    //     ) {
    //         return await stepContext.beginDialog(DATE_RESOLVER_DIALOG, {
    //             date: bookingDetails.travelDate,
    //         });
    //     } else {
    //         return await stepContext.next(bookingDetails.travelDate);
    //     }
    // }

    private async handleAnalystRatingIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const resp = getFundamentalResponse as AnalystRating;

        const messageText = `Of ${getAnalystCount(resp.analystRating)} analysts,
                ${resp.analystRating.StrongBuy} gave a strong buy rating, 
                ${resp.analystRating.Buy} gave a buy rating, ${resp.analystRating.Hold} gave a hold rating, ${
            resp.analystRating.Sell
        } gave a sell rating, and ${resp.analystRating.StrongSell} gave a sell rating.
                The average price target is ${resp.analystRating.TargetPrice}.
                The estimated forward PE is ${
                    resp.forwardPE
                }. Here are more details on the forecasts for next quarter \n`;

        const table = BotResponseHelper.createAsciiTable([
            [
                'Next Quarter Earnings Report Date',
                `${resp.nextQuarterDateAndEps.reportDate} ${
                    resp.nextQuarterDateAndEps.beforeAfterMarket === EHDBeforeAfterMarket.AFTER_MARKET
                        ? 'After Market'
                        : 'Before Market'
                }`,
            ],
            ['Next Quarter Average Estimated EPS', resp.nextQuarterEstimates.earningsEstimateAvg],
            ['Next Quarter Lowest Estimated Earnings', resp.nextQuarterEstimates.earningsEstimateLow],
            ['Next Quarter Highest Estimated Earnings', resp.nextQuarterEstimates.earningsEstimateHigh],
            ['Next Quarter Average Estimated EPS 7 days ago', resp.nextQuarterEstimates.epsTrend7daysAgo],
            ['Next Quarter Average Estimated EPS 30 days ago', resp.nextQuarterEstimates.epsTrend30daysAgo],
            ['Next Quarter Average Estimated EPS 60 days ago', resp.nextQuarterEstimates.epsTrend60daysAgo],
            ['Next Quarter Average Estimated EPS 90 days ago', resp.nextQuarterEstimates.epsTrend90daysAgo],
            ['Next Quarter Estimated Revenue Growth', resp.nextQuarterEstimates.revenueEstimateGrowth],
            [
                'Next Quarter Average Estimated Revenue',
                BotResponseHelper.getLargeNumberFormat(Number(resp.nextQuarterEstimates.revenueEstimateAvg)),
            ],
            [
                'Next Quarter Lowest Estimated Revenue',
                BotResponseHelper.getLargeNumberFormat(Number(resp.nextQuarterEstimates.revenueEstimateLow)),
            ],
            [
                'Next Quarter Highest Estimated Revenue',
                BotResponseHelper.getLargeNumberFormat(Number(resp.nextQuarterEstimates.revenueEstimateHigh)),
            ],
        ]);

        await stepContext.context.sendActivity(messageText + '\n```\n' + table + '\n```\n');
    }

    private async handleDividendIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const symbol = stepContext.options.stockSymbol;
        const resp = getFundamentalResponse as Dividend;

        const messageText = `${stepContext.options.stockSymbol} paid $${
            resp.annualDividendPerShareTTM
        } per share of dividends in the last 12 months. 
    The dividend yield, which is the dividends per share divided by the price per share, is ${
        resp.dividendYield * 100
    }%.
    \nFor ${new Date().getFullYear().toString()}, it is projected the annual dividend payout of ${symbol} is $${
            resp.forwardAnnualDividendRate
        } per share, and the dividend yield is ${resp.forwardAnnualDividendYield * 100}%.
    ${symbol} pays its shareholders dividends ${
            // round to 3 decimal places
            resp.numberOfDividendsPerYear.toFixed(3)
        } times a year. The last time ${symbol} paid dividends was on ${
            resp.dividendDate
        }. If you bought ${symbol} prior to ${resp.dividendDate}, you are eligible to receive $${
            resp.annualDividendPerShareTTM
        } for each share you own.
    \nCurrently, ${symbol} has a payout ratio of ${resp.payoutRatio * 100}%. In other words, ${symbol} uses ${
            resp.payoutRatio * 100
        }% of its net income to pay dividends. \nThe payout ratio is a measure of how much of a company's earnings are paid out as dividends. A high payout ratio is generally not sustainable, and indicates that the company may not be able to sustain its dividend payments. A low payout ratio is generally a good thing, and indicates that the company has plenty of earnings to reinvest in the business.`;

        await stepContext.context.sendActivity(messageText);
    }

    private trimLeadingDash(numberString: string): string {
        return numberString.replace(/^[-]/, '');
    }

    private removeNegative(num: number): number {
        if (num < 0) {
            return num * -1;
        }
        return num;
    }

    private async handleEarningsIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const symbol = stepContext.options.stockSymbol;
        const resp = getFundamentalResponse as Earnings;

        const messageText = `The last time ${symbol} reported earnings was on ${
            resp.previousQuarterEarnings.reportDate
        } for ${DatetimeUtil.parseYearFromDateString(
            resp.previousQuarterEarnings.date
        )} ${DatetimeUtil.mapDateToQuarter(resp.previousQuarterEarnings.date)}. 
        \nThe earnings per share (EPS) was ${resp.previousQuarterEarnings.epsActual}. It ${
            Number(resp.previousQuarterEarnings.surprisePercent) >= 0 ? 'beat' : 'missed'
        } the average Wall Street estimate of ${resp.previousQuarterEarnings.epsEstimate} by ${Number(
            this.removeNegative(resp.previousQuarterEarnings.surprisePercent)
        )}%.
        \nThe estimated EPS for the current quarter is ${
            resp.epsEstimateCurrentQuarter
        }, and the estimated EPS for the next quarter is ${resp.epsEstimateNextQuarter}.
        \nThe estimated annual EPS for ${DatetimeUtil.getCurrentYear()} is ${
            resp.epsEstimateCurrentYear
        }, and for ${DatetimeUtil.getNextYear()} it is ${resp.epsEstimateNextYear}.
        \n Here are more details on earnings:\n 
         `;

        const table = BotResponseHelper.createAsciiTable([
            ['Profit Margin', (Number(resp.profitMargin) * 100).toFixed(2) + '%'],
            ['Return on Equity (Trailing 12 months)', (Number(resp.returnOnEquityTTM) * 100).toFixed(2) + '%'],
            [
                'Total Revenue',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(resp.previousQuarterIncomeStatements, 'totalRevenue')
                    )
                ),
            ],
            ['Revenue (Trailing 12 Months)', BotResponseHelper.getLargeNumberFormat(Number(resp.revenueTTM))],
            [
                'Revenue Per Share (Trailing 12 Months)',
                `$${BotResponseHelper.getLargeNumberFormat(Number(resp.revenuePerShareTTM))}`,
            ],
            [
                'Gross Profit',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(resp.previousQuarterIncomeStatements, 'grossProfit')
                    )
                ),
            ],
            ['Gross Profit (Trailing 12 Months)', BotResponseHelper.getLargeNumberFormat(Number(resp.revenueTTM))],
            [
                'EBITA',
                BotResponseHelper.getLargeNumberFormat(
                    Number(this.getFieldFromObjectArrayWithFallback(resp.previousQuarterIncomeStatements, 'ebitda'))
                ),
            ],
            [
                'Net Income',
                BotResponseHelper.getLargeNumberFormat(
                    Number(this.getFieldFromObjectArrayWithFallback(resp.previousQuarterIncomeStatements, 'netIncome'))
                ),
            ],
            [
                'Total Assets',
                BotResponseHelper.getLargeNumberFormat(
                    Number(this.getFieldFromObjectArrayWithFallback(resp.previousQuarterBalanceSheets, 'totalAssets'))
                ),
            ],
            [
                'Cash',
                BotResponseHelper.getLargeNumberFormat(
                    Number(this.getFieldFromObjectArrayWithFallback(resp.previousQuarterBalanceSheets, 'cash'))
                ),
            ],
            [
                'Total Current Liabilities',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(
                            resp.previousQuarterBalanceSheets,
                            'totalCurrentLiabilities'
                        )
                    )
                ),
            ],
            [
                'Net Debt',
                BotResponseHelper.getLargeNumberFormat(
                    Number(this.getFieldFromObjectArrayWithFallback(resp.previousQuarterBalanceSheets, 'netDebt'))
                ),
            ],
            [
                'Total Current Assets',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(
                            resp.previousQuarterBalanceSheets,
                            'totalCurrentAssets'
                        )
                    )
                ),
            ],
            [
                'Dividends Paid',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.trimLeadingDash(
                            this.getFieldFromObjectArrayWithFallback(resp.previousQuarterCashFlows, 'dividendsPaid')
                        )
                    )
                ),
            ],
            [
                'Income Tax Expense',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(
                            resp.previousQuarterIncomeStatements,
                            'incomeTaxExpense'
                        )
                    )
                ),
            ],
        ]);

        await stepContext.context.sendActivity(messageText + '\n```\n' + table + '\n```\n');
    }

    private async handleMarketCapIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const messageText = `The market capitalization for ${stepContext.options.stockSymbol} is ${BotResponseHelper.getLargeNumberFormat(getFundamentalResponse as number)}`;

         await stepContext.context.sendActivity(messageText);
    }

    private async handlePriceEarningsRatioIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const symbol = stepContext.options.stockSymbol;
        const resp = getFundamentalResponse as PriceEarningsRatio;
        const messageText = `The price-to-earnings (PE) ratio for ${symbol} is ${resp.pe}.
        PE ratio is for valuing a company that measures its current share price relative to its earnings per share (EPS).
        A high P/E ratio could mean that a company's stock is overvalued, or that investors are expecting high growth rates in the future.
        \n\n${symbol} has a trailing PE ratio of ${resp.trailingPE} and a forward PE ratio of ${resp.forwardPE}.
        Trailing P/E is calculated by dividing the current market value, or share price, by the EPS over the previous 12 months.
        The forward P/E ratio is calculated similarly based on the company's estimated EPS for the next 12 months. Estimations are produced by averaging Wall Street analysts' estimates.
        `;

        await stepContext.context.sendActivity(messageText);
    }

        /**
     * Complete the interaction and end the dialog.
     */
    private async finalStep(
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<DialogTurnResult> {
        // handle fundamentalType prompt response
        if (stepContext.result === MAX_RETRY_COUNT_EXCEEDED) {
            return await stepContext.endDialog(
                new MaxRetryCountExceededError('max retry count exceeded for fundamentalType prompt')
            );
        }
        stepContext.options.fundamentalType = stepContext.result;

        // DEBUG
        // await stepContext.context.sendActivity(
        //     `;
        // stock: ${stepContext.options.stockSymbol},
        // fundamentalType: ${stepContext.options.fundamentalType}`
        // );

        const getFundamentalResponse = await this.eodHistoricDataUtil.getFundamental(
            stepContext.options.stockSymbol,
            stepContext.options.fundamentalType
        );

        switch (stepContext.options.fundamentalType) {
            case FundamentalType.ANALYST_RATING:
                await this.handleAnalystRatingIntent(getFundamentalResponse, stepContext);
                break;
            case FundamentalType.DIVIDEND:
                await this.handleDividendIntent(getFundamentalResponse, stepContext);
                break;
            case FundamentalType.EARNINGS:
                await this.handleEarningsIntent(getFundamentalResponse, stepContext);
                break;
            case FundamentalType.MARKET_CAPITALIZATION:
                await this.handleMarketCapIntent(getFundamentalResponse, stepContext);
                break;
            case FundamentalType.PRICE_EARNINGS_RATIO:
                await this.handlePriceEarningsRatioIntent(getFundamentalResponse, stepContext);
                break;
            default:
        }

        // TODO: [VES-32] offer suggestions prompts

        return await stepContext.endDialog(stepContext.options);
    }

    // TODO: add support for retrieval with date VES-30
    // private isAmbiguous(timex: string): boolean {
    //     const timexPropery = new TimexProperty(timex);
    //     return !timexPropery.types.has('definite');
    // }

    /**
     * Retrieve the value of a field from the 1st object in an array, with a fallback to the second object in the array.
     * @param arr
     * @param fieldName
     * @private
     */
    private getFieldFromObjectArrayWithFallback(arr: { [key: string]: any }[], fieldName: string): any {
        if (arr.length < 2) {
            throw new Error(`There is no 2nd fallback element in object array ${JSON.stringify(arr)}`);
        }

        if (arr[0] && arr[0][fieldName] !== null) {
            return arr[0][fieldName];
        } else if (arr[1] && arr[1][fieldName] !== null) {
            return arr[1][fieldName];
        } else {
            throw new Error(`unable to retrieve field ${fieldName} from object array ${JSON.stringify(arr)}`);
        }
    }
}
