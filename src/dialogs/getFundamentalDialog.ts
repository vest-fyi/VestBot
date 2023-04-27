// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { InputHints, MessageFactory } from 'botbuilder';
import { DialogTurnResult, TextPrompt, WaterfallDialog, WaterfallStepContext } from 'botbuilder-dialogs';
import { CancelAndHelpDialog } from './cancelAndHelpDialog';
import { DateResolverDialog } from './dateResolverDialog';
import { EodHistoricDataUtil, GetFundamentalResponse } from '../util/eodHistoricDataUtil';
import { PromptName, PromptValidatorMap, StockPromptValidatedResponse } from './promptValidator';
import { MAX_RETRY_COUNT_EXCEEDED } from '../util/constant';
import { Dialog } from '../model/dialog';
import { EodHistoricalDataApiError } from '../error/EodHistoricalDataApiError';
import { SymbolNotFoundError } from '../error/SymbolNotFoundError';
import { MaxRetryCountExceededError } from '../error/MaxRetryCountExceededError';
import { GetFundamentalDialogParameters } from '../model/fundamental/getFundamentalDialogParameters';
import { FundamentalType, fundamentalTypePromptName } from '../model/fundamental/fundamentalType';
import { getAnalystCount, StockAnalystRating } from '../model/fundamental/stockAnalystRating';
import { BotResponseHelper } from '../util/BotResponseHelper';
import { EHDBeforeAfterMarket, EHDSearchResult } from '../model/eodHistoricalData/model';
import { StockEarnings } from '../model/fundamental/stockEarnings';
import { DatetimeUtil } from '../util/datetime';
import { SymbolIsFundError } from '../error/SymbolIsFundError';
import { VestUtil } from '../util/vestUtil';
import { EHDSymbolType } from '../model/eodHistoricalData/literals';
import { FundEarnings } from '../model/fundamental/fundEarnings';
import { FieldNotFoundError } from '../error/FieldNotFoundError';
import { StockPriceEarningsRatio } from '../model/fundamental/stockPriceEarningsRatio';
import { StockDividend } from '../model/fundamental/stockDividend';
import { logger } from '../util/logger';
import { FundAnalystRating } from '../model/fundamental/fundAnalystRating';
import { FundPriceEarningsRatio } from '../model/fundamental/fundPriceEarningsRatio';
import { FundDividend } from '../model/fundamental/fundDividend';

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
                    this.stockStep.bind(this),
                    this.fundamentalTypeStep.bind(this),
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
        if (stepContext.options.symbol) {
            // CLU recognized user stock input may be a company or fund name, or a stock symbol. Search for/validate the stock symbol with this input.
            try {
                const stock: EHDSearchResult = await this.eodHistoricDataUtil.searchStock(stepContext.options.symbol);

                return await stepContext.next(
                    `${JSON.stringify({
                        stockSymbol: stock.Code + '.' + stock.Exchange,
                        stockType: stock.Type,
                    } as StockPromptValidatedResponse)}`
                );
            } catch (error) {
                logger.error(error, 'Caught error in stock step of get fundamental dialog');

                if (error instanceof EodHistoricalDataApiError) {
                    await stepContext.context.sendActivity(
                        'Sorry our service is not available at the moment. Please try again later.'
                    );
                    return await stepContext.endDialog(error);
                }
                if (error instanceof SymbolNotFoundError) {
                    await stepContext.context.sendActivity(
                        `Sorry we cannot find the stock by the name of ${stepContext.options.symbol}. Please try again.`
                    );
                }
            }
        }

        const messageText = 'Please enter a publicly traded company or fund name, or its stock symbol.';
        const message = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt(PromptName.STOCK_PROMPT, {
            prompt: message,
            retryPrompt: 'Sorry, I didn\'t get that. ' + messageText,
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
        const validatedStockPrompt = JSON.parse(stepContext.result) as StockPromptValidatedResponse;

        stepContext.options.symbol = validatedStockPrompt.stockSymbol;
        stepContext.options.stockType = validatedStockPrompt.stockType;

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
            retryPrompt: 'Sorry, I didn\'t get that. ' + messageText,
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

        try {
            // process intent
            await this.handleGetFundamental(stepContext);

            // TODO: [VES-32] offer suggestions prompts
            return await stepContext.endDialog(stepContext.options);

        } catch (error) {
            if (error instanceof EodHistoricalDataApiError) {
                await stepContext.context.sendActivity(
                    'Sorry our service is not available at the moment. Please try again later.'
                );
                return await stepContext.endDialog(error);
            }

            if (error instanceof SymbolIsFundError) {
                await stepContext.context.sendActivity(
                    `Sorry we cannot retrieve ${VestUtil.toSpaceSeparated(stepContext.options.fundamentalType)} for ${
                        stepContext.options.symbol
                    } because it is an ETF or managed fund.`
                );
                return await stepContext.endDialog(error);
            }
        }
    }

    private async handleGetFundamental(stepContext: WaterfallStepContext<GetFundamentalDialogParameters>): Promise<void> {
        const { symbol, fundamentalType, stockType } = stepContext.options;

        const getFundamentalResponse = await this.eodHistoricDataUtil.getFundamental(
            symbol,
            fundamentalType,
            stockType
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
    }

    private async handleAnalystRatingIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const { symbol, stockType } = stepContext.options;

        let resp;
        let messageText;
        switch (stockType) {
            case EHDSymbolType.FUND:
            case EHDSymbolType.ETF:
            case EHDSymbolType.INDEX:
                resp = getFundamentalResponse as FundAnalystRating;
                messageText = `The forward P/E of ${symbol} is ${resp.forwardPE}.
            Forward P/E, or forward price-to-earnings ratio, is a valuation metric used to estimate the future earnings of a company or an index. It is calculated by dividing the current price of the security by the estimated earnings per share (EPS) for the next fiscal year.
            \nForward P/E is significant for ETFs (Exchange Traded Funds) because it provides investors with a way to compare the relative value of different ETFs that track different indexes or sectors. A low forward P/E indicates that a particular ETF is relatively undervalued compared to its expected earnings growth, while a high forward P/E may suggest that the ETF is overvalued.
            \nInvestors can use forward P/E to identify potentially undervalued ETFs that may provide good long-term investment opportunities. However, it's important to keep in mind that the forward P/E is only an estimate and should be used in conjunction with other financial metrics and analysis before making any investment decisions.
            \nThe long-term projected earning growth (LTPEG) for ${symbol} is ${resp.longTermProjectedEarningsGrowth}%.
            \nLTPEG is an estimate of the expected annual growth rate in earnings per share (EPS) for an index or company over a multi-year period, typically 3-5 years.
            \nETFs that has high LTPEG may be expected to deliver stronger earnings growth in the future, which could lead to higher returns over the long term.           
            \nIt has a MorningStar ratio of ${resp.morningStarRatio}. A ratio above 1.00 indicates that the stock’s price is higher than Morningstar’s estimate of its fair value.
            \nHowever, it's important to note that forward P/E, LTPEG, and MorningStar Ratio are only estimates, and there are many factors that can impact a company's or index's earnings growth over time, including economic conditions, industry trends, and competition. Investors should also consider other financial metrics and analysis when evaluating an ETF, such as historical performance, expense ratios, and risk factors.
            \nVest cannot provide you with financial recommendations.You should make your own independent evaluation of the merits and risks associated with investing in any ETF before making any investment decisions.
            `;
                await stepContext.context.sendActivity(messageText);
                break;
            case EHDSymbolType.COMMON_STOCK:
                resp = getFundamentalResponse as StockAnalystRating;

                messageText = `Please note Vest cannot provide you with financial recommendations. You should make your own independent evaluation of the merits and risks associated with investing in any stock before making any investment decisions.
                \nOf ${getAnalystCount(resp.analystRating)} analysts,
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
                    [ 'Next Quarter Average Estimated EPS', resp.nextQuarterEstimates.earningsEstimateAvg ],
                    [ 'Next Quarter Lowest Estimated Earnings', resp.nextQuarterEstimates.earningsEstimateLow ],
                    [ 'Next Quarter Highest Estimated Earnings', resp.nextQuarterEstimates.earningsEstimateHigh ],
                    [ 'Next Quarter Average Estimated EPS 7 days ago', resp.nextQuarterEstimates.epsTrend7daysAgo ],
                    [ 'Next Quarter Average Estimated EPS 30 days ago', resp.nextQuarterEstimates.epsTrend30daysAgo ],
                    [ 'Next Quarter Average Estimated EPS 60 days ago', resp.nextQuarterEstimates.epsTrend60daysAgo ],
                    [ 'Next Quarter Average Estimated EPS 90 days ago', resp.nextQuarterEstimates.epsTrend90daysAgo ],
                    [ 'Next Quarter Estimated Revenue Growth', resp.nextQuarterEstimates.revenueEstimateGrowth ],
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
                return;
            default:
                await stepContext.context.sendActivity(EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.ANALYST_RATING));
                return;
        }
    }

    private async handleDividendIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const { symbol, stockType } = stepContext.options;

        let resp;
        let messageText;
        switch (stockType) {
            case EHDSymbolType.FUND:
            case EHDSymbolType.ETF:
            case EHDSymbolType.INDEX:
                resp = getFundamentalResponse as FundDividend;
                logger.debug(resp, 'handleDividendIntent response: ');

                if (resp.dividendYield === 0) {
                    messageText = `${symbol} does not pay dividends.`;
                } else {
                    messageText = `The dividend yield factor for ${symbol} is ${resp.dividendYield}. ${symbol} pays its shareholders dividends on a ${resp.dividendPayingFrequency} basis.
                    A dividend yield factor is a measure of the amount of dividends paid out by the underlying stocks held in the ETF relative to the ETF's price. 
                    \nThe dividend yield factor is calculated by taking the total annual dividend payment per share of the ETF and dividing it by the current market price of the ETF.
                    For example, if an ETF has a total annual dividend payment of $2 per share and a current market price of $50 per share, its dividend yield factor would be 4% ($2 divided by $50).
                    \nInvestors often look at the dividend yield factor of an ETF as a way to assess the potential income that the ETF may provide. ETFs that have higher dividend yields may be more attractive to income-oriented investors who are seeking to generate income from their investments. However, it's important to note that high dividend yields may also indicate higher risk or lower growth potential, as companies that pay higher dividends may not be reinvesting as much in their businesses for future growth.
                    `;
                }
                break;

            case EHDSymbolType.COMMON_STOCK:
                resp = getFundamentalResponse as StockDividend;
                messageText = `${stepContext.options.symbol} paid $${
                    resp.annualDividendPerShareTTM
                } per share of dividends in the last 12 months. 
    The dividend yield, which is the dividends per share divided by the price per share, is ${
                    (resp.dividendYield * 100).toFixed(3)
                }%.
    \nFor ${new Date().getFullYear().toString()}, it is projected the annual dividend payout of ${symbol} is $${
                    resp.forwardAnnualDividendRate
                } per share, and the dividend yield is ${(resp.forwardAnnualDividendYield * 100).toFixed(3)}%.
    ${symbol} pays its shareholders dividends ${
                    resp.numberOfDividendsPerYear.toFixed(3)
                } times a year. The last time ${symbol} paid dividends was on ${
                    resp.dividendDate
                }. If you bought ${symbol} prior to ${resp.dividendDate}, you are eligible to receive $${
                    resp.annualDividendPerShareTTM
                } for each share you own.
    \nCurrently, ${symbol} has a payout ratio of ${(resp.payoutRatio * 100).toFixed(3)}%. In other words, ${symbol} uses ${
                    (resp.payoutRatio * 100).toFixed(3)
                }% of its net income to pay dividends. \nThe payout ratio is a measure of how much of a company's earnings are paid out as dividends. A high payout ratio is generally not sustainable, and indicates that the company may not be able to sustain its dividend payments. A low payout ratio is generally a good thing, and indicates that the company has plenty of earnings to reinvest in the business.`;
                break;

            default:
                messageText = EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.DIVIDEND);
        }

        await stepContext.context.sendActivity(messageText);

        return;
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
        const { symbol, stockType } = stepContext.options;

        let resp;
        switch (stockType) {
            case EHDSymbolType.FUND:
            case EHDSymbolType.ETF:
            case EHDSymbolType.INDEX:
                resp = getFundamentalResponse as FundEarnings;

                const messageText = `${symbol} has seen a year-to-date return of ${
                    resp.ytdReturn
                } in ${DatetimeUtil.getCurrentYear()}.
            \n${symbol} has an expense ratio of ${
                    resp.expenseRatio * 100
                }%. This means that for every $100 invested in the fund, $${
                    resp.expenseRatio * 100
                } is paid to the fund's management team for managing the fund per year.
            \nHere are some additional statistics for ${symbol}:`;

                const tableData = [];
                if (resp.oneYearReturn) {
                    tableData.push([ 'One Year Return', `${resp.oneYearReturn * 100}%` ]);
                }
                if (resp.threeYearReturn) {
                    tableData.push([ 'Three Year Return', `${resp.threeYearReturn * 100}%` ]);
                }
                if (resp.fiveYearReturn) {
                    tableData.push([ 'Five Year Return', `${resp.fiveYearReturn * 100}%` ]);
                }
                if (resp.tenYearReturn) {
                    tableData.push([ 'Ten Year Return', `${resp.tenYearReturn * 100}%` ]);
                }
                const table = BotResponseHelper.createAsciiTable(tableData);

                await stepContext.context.sendActivity(messageText + '\n```\n' + table + '\n```\n');
                return;
            case EHDSymbolType.COMMON_STOCK:
                await this.respondStockEarnings(getFundamentalResponse as StockEarnings, stepContext);
                return;
            default:
                await stepContext.context.sendActivity(EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.EARNINGS));
        }

        return;
    }

    private async respondStockEarnings(resp: StockEarnings, stepContext: WaterfallStepContext<GetFundamentalDialogParameters>) {
        const { symbol } = stepContext.options;

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

        const tableData = [
            [ 'Profit Margin', (Number(resp.profitMargin) * 100).toFixed(2) + '%' ],
            [ 'Return on Equity (Trailing 12 months)', (Number(resp.returnOnEquityTTM) * 100).toFixed(2) + '%' ],
            [
                'Total Revenue',
                BotResponseHelper.getLargeNumberFormat(
                    Number(
                        this.getFieldFromObjectArrayWithFallback(resp.previousQuarterIncomeStatements, 'totalRevenue')
                    )
                ),
            ],
            [ 'Revenue (Trailing 12 Months)', BotResponseHelper.getLargeNumberFormat(Number(resp.revenueTTM)) ],
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
            [ 'Gross Profit (Trailing 12 Months)', BotResponseHelper.getLargeNumberFormat(Number(resp.revenueTTM)) ],
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
        ];

        // dividendsPaid can be null for some stocks such as BRK-A/B
        try {
            const dividendsField = this.getFieldFromObjectArrayWithFallback(
                resp.previousQuarterCashFlows,
                'dividendsPaid'
            );
            tableData.push([
                'Dividends Paid',
                BotResponseHelper.getLargeNumberFormat(Number(this.trimLeadingDash(dividendsField))),
            ]);
        } catch (error) {
            if (!(error instanceof FieldNotFoundError)) {
                throw error;    // unknown error
            }
        }

        const table = BotResponseHelper.createAsciiTable(tableData);

        await stepContext.context.sendActivity(messageText + '\n```\n' + table + '\n```\n');

    }

    private async handleMarketCapIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const { symbol, stockType } = stepContext.options;

        let messageText;
        switch (stockType) {
            case EHDSymbolType.COMMON_STOCK:
                messageText = `The market capitalization for ${
                    symbol
                } is ${BotResponseHelper.getLargeNumberFormat(getFundamentalResponse as number)}`;
                break;
            default:
                messageText = EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.MARKET_CAPITALIZATION);
        }

        await stepContext.context.sendActivity(messageText);
    }

    private async handlePriceEarningsRatioIntent(
        getFundamentalResponse: GetFundamentalResponse,
        stepContext: WaterfallStepContext<GetFundamentalDialogParameters>
    ): Promise<void> {
        const { symbol, stockType } = stepContext.options;

        let resp;
        let messageText;
        switch (stockType) {
            case EHDSymbolType.FUND:
            case EHDSymbolType.ETF:
            case EHDSymbolType.INDEX:
                resp = getFundamentalResponse as FundPriceEarningsRatio;
                messageText = `The forward price-to-earnings (forward PE) ratio for ${symbol} is ${resp.forwardPE}.
                the forward P/E ratio is calculated based on the company's estimated EPS for the next 12 months. Estimations are produced by averaging Wall Street analysts' estimates.`;
                break;
            case EHDSymbolType.COMMON_STOCK:
                resp = getFundamentalResponse as StockPriceEarningsRatio;
                messageText = `The price-to-earnings (PE) ratio for ${symbol} is ${resp.pe}.
                PE ratio is for valuing a company that measures its current share price relative to its earnings per share (EPS).
                A high P/E ratio could mean that a company's stock is overvalued, or that investors are expecting high growth rates in the future.
                \n\n${symbol} has a trailing PE ratio of ${resp.trailingPE} and a forward PE ratio of ${resp.forwardPE}.
                Trailing P/E is calculated by dividing the current market value, or share price, by the EPS over the previous 12 months.
                Similarly, the forward P/E ratio is calculated based on the company's estimated EPS for the next 12 months. Estimations are produced by averaging Wall Street analysts' estimates.
                `;
                break;
            default:
                messageText = EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.PRICE_EARNINGS_RATIO);
        }

        await stepContext.context.sendActivity(messageText);
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
     * @throws FieldNotFoundError if the field is not found in either object
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
            throw new FieldNotFoundError(
                `unable to retrieve field ${fieldName} from object array ${JSON.stringify(arr)}`
            );
        }
    }
}
