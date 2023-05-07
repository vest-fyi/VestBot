import qs from 'qs';
import axios from 'axios';
import { EOD_HISTORICAL_DATA_BASE_URL, EOD_HISTORICAL_DATA_ENDPOINT } from '../model/eodHistoricalData/constant';
import { SymbolNotFoundError } from '../error/SymbolNotFoundError';
import { EodHistoricalDataApiError } from '../error/EodHistoricalDataApiError';
import { SymbolIsFundError } from '../error/SymbolIsFundError';
import { NoDividendError } from '../error/NoDividendError';
import {
    EHDETFData,
    EHDNumberDividendsForYear,
    EHDSearchResponse,
    EHDSearchResult,
    EHDStockHighlights,
    EHDStockValuation,
    NumberDividendsByYear,
} from '../model/eodHistoricalData/model';
import { FundamentalType } from '../model/fundamental/fundamentalType';
import { CalendarEarningsResponse } from '../model/eodHistoricalData/modules/calendar';
import { NoEarningsError } from '../error/NoEarningsError';
import { StockEarnings } from '../model/fundamental/stockEarnings';
import { StockAnalystRating } from '../model/fundamental/stockAnalystRating';
import { NoAnalystRatingError } from '../error/NoAnalystRatingError';
import { DatetimeUtil } from './datetime';
import { EHDSymbolType } from '../model/eodHistoricalData/literals';
import { EodHistoricalDataResponseError } from '../error/EodHistoricalDataResponseError';
import { FundEarnings } from '../model/fundamental/fundEarnings';
import { Stage } from '../model/stage';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { BETA_SERVER_SECRET_ARN, SERVER_SECRET, VEST_DEFAULT_REGION } from './constant';
import { SecretsManagerUtil } from './secrets-manager';
import { StockDividend } from '../model/fundamental/stockDividend';
import { StockPriceEarningsRatio } from '../model/fundamental/stockPriceEarningsRatio';
import { logger } from './logger';
import { FundAnalystRating } from '../model/fundamental/fundAnalystRating';
import { FundPriceEarningsRatio } from '../model/fundamental/fundPriceEarningsRatio';
import { FundDividend } from '../model/fundamental/fundDividend';

export type GetFundamentalResponse =
    number
    | StockEarnings
    | FundEarnings
    | StockAnalystRating
    | FundAnalystRating
    | StockDividend
    | FundDividend
    | StockPriceEarningsRatio
    | FundPriceEarningsRatio;

export class EodHistoricDataUtil {
    private apiToken: string;

    private isInitialized() {
        return this.apiToken != undefined;
    }

    /**
     * Constructor for EodHistoricDataUtil
     *
     * @Return {EodHistoricDataUtil} - EodHistoricDataUtil initialized class instance
     */
    public async init(): Promise<EodHistoricDataUtil> {
        // bring your own .env file for local testing
        if (process.env.STAGE == Stage.LOCAL || !process.env.STAGE) {
            const { EODHistoricalDataAPIKey } = process.env;
            this.apiToken = EODHistoricalDataAPIKey;
        } else {
            const client = new SecretsManagerClient({ region: VEST_DEFAULT_REGION });
            const secretMgr = new SecretsManagerUtil(client);
            const serverSecret = await secretMgr.getServerSecret(process.env.STAGE == Stage.ALPHA ? BETA_SERVER_SECRET_ARN : SERVER_SECRET);
            this.apiToken = serverSecret.EODHistoricalDataAPIKey;
        }

        if (!this.isInitialized()) {
            throw new Error('No token provided');
        }

        return this;
    }

    /**
     * search for the stock or fund by symbol or name
     * @param {string} stock - The stock to search for. Can be a symbol or a name.
     * @return the top result of the search
     *
     * @throws {SymbolNotFoundError} if no stock found
     * @throws {EodHistoricalDataApiError} if any other error
     */
    public async searchStock(stock: string): Promise<EHDSearchResult> {
        try {
            if (!this.isInitialized()) {
                await this.init();
            }

            const response = (await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.SEARCH}/${stock}`, {
                exchange: 'US',
            })) as EHDSearchResponse;

            if (!response || response.length === 0) {
                throw new SymbolNotFoundError(`No stock found for ${stock}`);
            }

            return response[0];
        } catch (error) {
            logger.error(error, 'Search stock failed with error: ');
            if (error instanceof SymbolNotFoundError) {
                throw error;
            }

            throw new EodHistoricalDataApiError(error);
        }
    }

    /**
     * get fundamental of a stock or fund
     * @param {string} symbol - The stock or fund symbol
     * @param {string} fundamentalType - The fundamental type
     * @param stockType
     * @param {string} date - The date of the fundamental
     * @return the fundamental data
     *
     * @throws {SymbolNotFoundError} if no stock found
     * @throws {EodHistoricalDataResponseError} if market cap not found for common stock stock type
     * @throws {EodHistoricalDataApiError} if any other error
     *
     *
     */
    public async getFundamental(
        symbol: string,
        fundamentalType: FundamentalType,
        stockType: EHDSymbolType,
        // TODO: support date VES-30
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        date?: Date
    ): Promise<GetFundamentalResponse> {
        try {
            if (!this.isInitialized()) {
                await this.init();
            }
            switch (stockType) {
                case EHDSymbolType.COMMON_STOCK:
                    switch (fundamentalType) {
                        case FundamentalType.MARKET_CAPITALIZATION:
                            return await this.getMarketCap(symbol);

                        case FundamentalType.EARNINGS:
                            return await this.getStockEarnings(symbol);

                        case FundamentalType.ANALYST_RATING:
                            return await this.getStockAnalystRating(symbol);

                        case FundamentalType.DIVIDEND:
                            return await this.getStockDividend(symbol);

                        case FundamentalType.PRICE_EARNINGS_RATIO:
                            return await this.getPriceEarningsRatio(symbol);

                        default:
                            throw new Error('Unreachable code');
                    }
                case EHDSymbolType.ETF:
                case EHDSymbolType.FUND:
                case EHDSymbolType.INDEX:
                    switch (fundamentalType) {
                        case FundamentalType.MARKET_CAPITALIZATION:
                            throw new SymbolIsFundError(EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.MARKET_CAPITALIZATION));

                        case FundamentalType.EARNINGS:
                            return await this.getFundEarnings(symbol);

                        case FundamentalType.ANALYST_RATING:
                            return await this.getFundAnalystRating(symbol);

                        case FundamentalType.DIVIDEND:
                            return await this.getFundDividend(symbol);

                        case FundamentalType.PRICE_EARNINGS_RATIO:
                            return await this.getPriceEarningsRatio(symbol);

                        default:
                            throw new Error('Unreachable code');
                    }
                    return await this.getFundEarnings(symbol);
                default:
            }

        } catch (error) {
            logger.error(error, 'get fundamentals failed with error: ');
            throw error;
        }
    }

    private async getMarketCap(symbol: string): Promise<number> {
        if (!this.isInitialized()) {
            await this.init();
        }

        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: 'Highlights::MarketCapitalization',
        });
        if (response === 'NA') {
            throw new EodHistoricalDataResponseError(`Symbol ${symbol} does not have market capitalization`);
        }
        return Number(response);
    }

    /**
     * handles user query on FundamentalType.EARNINGS
     *
     * @throws {NoEarningsError} if no earnings found (symbol might be fund)
     *
     * @param symbol
     * @private
     */
    private async getStockEarnings(symbol: string): Promise<StockEarnings> {
        // also validates symbol has earnings
        const previousEarningsDateString = DatetimeUtil.dateToDateString(await this.getPreviousEarningsDate(symbol));
        const quarterDateString = DatetimeUtil.getLastQuarterDateString();
        const previousQuarterDateString = DatetimeUtil.getPreviousQuarterDateString(quarterDateString);

        const earningsHistoryKey = `Earnings::History::${previousEarningsDateString}`;
        const earningsAnnualKey = `Earnings::Annual::${new Date().getFullYear() - 1}-12-31`;

        const balanceSheetKey = `Financials::Balance_Sheet::quarterly::${quarterDateString}`;
        const previousBalanceSheetKey = `Financials::Balance_Sheet::quarterly::${previousQuarterDateString}`;
        const cashFlowKey = `Financials::Cash_Flow::quarterly::${quarterDateString}`;
        const previousCashFlowKey = `Financials::Cash_Flow::quarterly::${previousQuarterDateString}`;
        const incomeStatementKey = `Financials::Income_Statement::quarterly::${quarterDateString}`;
        const previousIncomeStatementKey = `Financials::Income_Statement::quarterly::${previousQuarterDateString}`;

        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: `Highlights,Valuation,${earningsHistoryKey},${earningsAnnualKey},${balanceSheetKey},${cashFlowKey},${incomeStatementKey},${previousBalanceSheetKey},${previousCashFlowKey},${previousIncomeStatementKey}`,
        });

        const highlights: EHDStockHighlights = response.Highlights;

        return {
            // Fundamentals::Highlights
            epsEstimateCurrentYear: highlights.EPSEstimateCurrentYear,
            epsEstimateNextYear: highlights.EPSEstimateNextYear,
            epsEstimateNextQuarter: highlights.EPSEstimateNextQuarter,
            epsEstimateCurrentQuarter: highlights.EPSEstimateCurrentQuarter,
            profitMargin: highlights.ProfitMargin,
            returnOnEquityTTM: highlights.ReturnOnEquityTTM,
            revenueTTM: highlights.RevenueTTM,
            revenuePerShareTTM: highlights.RevenuePerShareTTM,
            quarterlyRevenueGrowthYOY: highlights.QuarterlyRevenueGrowthYOY,
            grossProfitTTM: highlights.GrossProfitTTM,
            quarterlyEarningsGrowthYOY: highlights.QuarterlyEarningsGrowthYOY,

            // Earnings::History
            previousQuarterEarnings: response[earningsHistoryKey],

            // Financials::Balance_Sheet::quarterly
            previousQuarterBalanceSheets: [ response[balanceSheetKey], response[previousBalanceSheetKey] ],

            // Financials::Cash_Flow::quarterly
            previousQuarterCashFlows: [ response[cashFlowKey], response[previousCashFlowKey] ],

            // Financials::Income_Statement::quarterly
            previousQuarterIncomeStatements: [ response[incomeStatementKey], response[previousIncomeStatementKey] ],
        } as StockEarnings;
    }

    public static getUnsupportedGetFundamentalMessage(symbol: string, symbolType: EHDSymbolType, fundamentalType: FundamentalType): string {
        return `${symbol} is a ${symbolType}. Sorry, I don't support ${fundamentalType} for ${symbolType} yet.`;
    }

    /**
     * handles user query on FundamentalType.EARNINGS
     *
     * @throws {NoEarningsError} if no earnings found (symbol might be fund)
     *
     * @param symbol
     * @private
     */
    private async getFundEarnings(symbol: string): Promise<FundEarnings> {
        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: 'ETF_Data',
        }) as EHDETFData;

        const { Returns_YTD, Returns_1Y, Returns_3Y, Returns_5Y, Returns_10Y } = response.Performance;
        return {
            // ETF_Data
            expenseRatio: Number(response.NetExpenseRatio),
            inceptionDate: response.Inception_Date,

            // ETF_Data::Performance
            ytdReturn: Number(Returns_YTD) * 0.001,
            oneYearReturn: Number(Returns_1Y) * 0.001,
            threeYearReturn: Number(Returns_3Y) * 0.001,
            fiveYearReturn: Number(Returns_5Y) * 0.001,
            tenYearReturn: Number(Returns_10Y) * 0.001,
        } as FundEarnings;
    }

    private async getFundAnalystRating(symbol: string): Promise<FundAnalystRating> {
        const forwardPEKey = 'ETF_Data::Valuations_Growth::Valuations_Rates_To_Category::Price/Prospective Earnings';
        const longTermProjectedEarningsGrowthKey = 'ETF_Data::Valuations_Growth::Growth_Rates_Portfolio::Long-Term Projected Earnings Growth';
        const morningStarRatioKey = 'ETF_Data::MorningStar::Ratio';
        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: `${forwardPEKey},${longTermProjectedEarningsGrowthKey},${morningStarRatioKey}`,
        });

        return {
            forwardPE: Number(response[forwardPEKey]),
            longTermProjectedEarningsGrowth: Number(response[longTermProjectedEarningsGrowthKey]),
            morningStarRatio: Number(response[morningStarRatioKey]),
        };
    }


    private async getStockAnalystRating(symbol: string): Promise<StockAnalystRating> {
        const previousEarningsDate = await this.getPreviousEarningsDate(symbol);
        const nextEarningsDateString = DatetimeUtil.dateToDateString(
            new Date(previousEarningsDate.getFullYear(), previousEarningsDate.getMonth() + 4, 1)
        );
        logger.debug(nextEarningsDateString, 'nextEarningsDate is ');

        const earningsHistoryKey = `Earnings::History::${nextEarningsDateString}`;
        const earningsTrendKey = `Earnings::Trend::${nextEarningsDateString}`;

        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: `Valuation,AnalystRatings,${earningsHistoryKey},${earningsTrendKey}`,
        });

        if (response.AnalystRatings === 'NA' || response.AnalystRatings === undefined) {
            throw new NoAnalystRatingError(`Symbol ${symbol} is a fund and does not have analyst rating`);
        }

        return {
            // Valuation
            forwardPE: response.Valuation.ForwardPE,

            // Analyst Rating
            analystRating: response.AnalystRatings,

            // Earnings
            // estimate for upcoming quarter
            nextQuarterEstimates: response[earningsTrendKey],
            nextQuarterDateAndEps: response[earningsHistoryKey],
        } as StockAnalystRating;
    }

    private async getStockDividend(symbol: string): Promise<StockDividend> {
        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: 'SplitsDividends,Highlights::DividendShare,Highlights::DividendYield',
        });

        if (response['Highlights::DividendYield'] === 'NA') {
            throw new NoDividendError(`Symbol ${symbol} is a fund and does not have dividends`);
        }

        return {
            annualDividendPerShareTTM: response['Highlights::DividendShare'] === "NA" ? 0 : response['Highlights::DividendShare'],
            dividendYield: response['Highlights::DividendYield'],
            forwardAnnualDividendRate: Number(response.SplitsDividends.ForwardAnnualDividendRate),
            forwardAnnualDividendYield: Number(response.SplitsDividends.ForwardAnnualDividendYield),
            numberOfDividendsPerYear: EodHistoricDataUtil.getAverageNumberOfDividendsPerYear(
                response.SplitsDividends.NumberDividendsByYear
            ),
            dividendDate: response.SplitsDividends.DividendDate,
            exDividendDate: response.SplitsDividends.ExDividendDate,
            payoutRatio: Number(response.SplitsDividends.PayoutRatio),
        } as StockDividend;
    }

    private async getFundDividend(symbol: string): Promise<FundDividend> {
        const dividendYieldParentKey = 'ETF_Data::Valuations_Growth::Valuations_Rates_Portfolio';
        const dividendPayingFrequencyKey = 'ETF_Data::Dividend_Paying_Frequency';
        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: `${dividendYieldParentKey},${dividendPayingFrequencyKey}`,
        });

        return {
            dividendYield: Number(response[dividendYieldParentKey]['Dividend-Yield Factor']),
            dividendPayingFrequency: response[dividendPayingFrequencyKey],
        };
    }

    // for both stock and fund
    private async getPriceEarningsRatio(symbol: string): Promise<StockPriceEarningsRatio | FundPriceEarningsRatio> {
        const etfForwardPEKey = 'ETF_Data::Valuations_Growth::Valuations_Rates_To_Category::Price/Prospective Earnings';
        const response = await this.fetchEodHistoricalData(`${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`, {
            filter: `Highlights,Valuation,General::Type,${etfForwardPEKey}`,
        });

        const stockType = response['General::Type'];
        switch (stockType) {
            case EHDSymbolType.COMMON_STOCK:
                const highlights: EHDStockHighlights = response.Highlights as EHDStockHighlights;

                return {
                    // Highlights
                    // WARNING: for BRK.A/B, PE ratio is null
                    pe: highlights.PERatio ?? 'not available',

                    // Valuation
                    // WARNING: for BRK.A/B, trailing PE ratio is 0
                    trailingPE:
                        (response.Valuation as EHDStockValuation).TrailingPE === 0
                            ? 'not available'
                            : (response.Valuation as EHDStockValuation).TrailingPE,
                    forwardPE: (response.Valuation as EHDStockValuation).ForwardPE,
                } as StockPriceEarningsRatio;

            case EHDSymbolType.ETF:
            case EHDSymbolType.FUND:
            case EHDSymbolType.INDEX:
                return {
                    forwardPE: response[etfForwardPEKey],
                } as FundPriceEarningsRatio;
            default:
                throw new SymbolIsFundError(EodHistoricDataUtil.getUnsupportedGetFundamentalMessage(symbol, stockType, FundamentalType.PRICE_EARNINGS_RATIO));
        }
    }

    private async fetchEodHistoricalData(subPath: string, queryParams?: Record<string, any>): Promise<any> {
        let response: any;
        try {
            const defaultQueryParams = {
                api_token: this.apiToken,
                fmt: 'json',
            };
            const queryString = qs.stringify(Object.assign({}, defaultQueryParams, queryParams));

            const url = `${EOD_HISTORICAL_DATA_BASE_URL}${subPath}?${queryString}`;

            response = await axios.get(url);
            logger.debug(response.data, `Received response for fetchEodHistoricalData request ${subPath}: `);

            if (response.status === 404) {
                throw new SymbolNotFoundError(`No stock found for ${subPath}`);
            }
            if (response.status !== 200) {
                throw new EodHistoricalDataApiError(`HTTP Error Response: ${response.status} ${response.statusText}`);
            }

            return response.data;
        } catch (error) {
            if (error instanceof EodHistoricalDataApiError || error instanceof SymbolNotFoundError) {
                throw error;
            }

            logger.error(error.message,
                `Error fetching data for ${subPath}, ${queryParams ? JSON.stringify(queryParams) : 'no queryParams'}:`
            );
            throw new EodHistoricalDataApiError(error);
        }
    }

    private static getAverageNumberOfDividendsPerYear(numberDividendsByYear: NumberDividendsByYear): number {
        const numberDividendsByYearArray: EHDNumberDividendsForYear[] = Object.values(numberDividendsByYear);
        numberDividendsByYearArray.sort((a, b) => a.Year - b.Year); // sort by year in ascending order, in case it is not
        const countArray = numberDividendsByYearArray.map((item) => item.Count); // extract count values

        countArray.pop(); // remove the last element, which is the current year, because the count is incomplete
        countArray.shift(); // remove the first element, because the count may be incomplete

        return this.getAverage(countArray);
    }

    private static getAverage(numArray: number[]) {
        if (numArray.length === 0) {
            return 0;
        }

        const sum = numArray.reduce((a, b) => a + b, 0);
        return sum / numArray.length;
    }

    /**
     * Returns the date of the previous earnings call for the given symbol
     *
     * @description this is not the date of the earnings call, but the date of the end of the quarter
     *
     * @param symbol
     * @throws NoEarningsError if no earnings are found for the symbol (symbol might be fund)
     * @private
     */
    private async getPreviousEarningsDate(symbol: string): Promise<Date> {
        try {
            const today = new Date();
            const aYearAgo = new Date(today.setFullYear(today.getFullYear() - 1));
            const aYearAgoDateStr = DatetimeUtil.dateToDateString(aYearAgo);

            const response = (await this.fetchEodHistoricalData(
                `${EOD_HISTORICAL_DATA_ENDPOINT.CALENDAR + EOD_HISTORICAL_DATA_ENDPOINT.EARNINGS}`,
                {
                    from: aYearAgoDateStr,
                    symbols: symbol,
                }
            )) as CalendarEarningsResponse;

            const earnings = response.earnings;

            if (earnings.length === 0) {
                throw new NoEarningsError(`No earnings found for ${symbol}`);
            }

            response.earnings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // sort by descending date

            return new Date(response.earnings[0].date);
        } catch (error) {
            logger.error(error, 'get previous earnings date failed with error: ');
            throw error;
        }
    }
}
