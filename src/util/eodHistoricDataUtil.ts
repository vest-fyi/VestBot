import qs from 'qs';
import path from 'path';
import { config } from 'dotenv';
import axios from 'axios';
import {
    EOD_HISTORICAL_DATA_BASE_URL,
    EOD_HISTORICAL_DATA_ENDPOINT,
} from '../model/eodHistoricalData/constant';
import { SymbolNotFoundError } from '../error/SymbolNotFoundError';
import { EodHistoricalDataApiError } from '../error/EodHistoricalDataApiError';
import { SymbolIsFundError } from '../error/SymbolIsFundError';
import { NoDividendError } from '../error/NoDividendError';
import {
    EHDBalanceSheet,
    EHDCashFlow,
    EHDEarningsAnnual,
    EHDEarningsHistorical,
    EHDIncomeStatement,
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
import { Earnings } from '../model/fundamental/earnings';
import { NoPEError } from '../error/NoPEError';
import { AnalystRating } from '../model/fundamental/analystRating';
import { NoAnalystRatingError } from '../error/NoAnalystRatingError';
import { DatetimeUtil } from './datetime';

export type GetFundamentalResponse =
    | number
    | Earnings
    | AnalystRating
    | Dividend
    | PriceEarningsRatio;

export class EodHistoricDataUtil {
    private readonly apiToken: string;

    public constructor() {
        const ENV_FILE = path.join(__dirname, '../../.env');
        config({ path: ENV_FILE });
        const { EODHistoricalDataAPIKey } = process.env;

        this.apiToken = EODHistoricalDataAPIKey;

        if (!this.apiToken) {
            throw new Error('No token provided');
        }
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
            const response = (await this.fetchEodHistoricalData(
                `${EOD_HISTORICAL_DATA_ENDPOINT.SEARCH}/${stock}`
            )) as EHDSearchResponse;
            if (!response || response.length === 0) {
                throw new SymbolNotFoundError(`No stock found for ${stock}`);
            }

            return response[0];
        } catch (error) {
            console.error('Search stock failed', error);
            throw new EodHistoricalDataApiError(error);
        }
    }

    /**
     * get fundamental of a stock or fund
     * @param {string} symbol - The stock or fund symbol
     * @param {string} fundamentalType - The fundamental type
     * @param {string} date - The date of the fundamental
     * @return the fundamental data
     *
     * @throws {SymbolNotFoundError} if no stock found
     * @throws {EodHistoricalDataApiError} if any other error
     *
     */
    public async getFundamental(
        symbol: string,
        fundamentalType: FundamentalType,
        date?: Date
    ): Promise<GetFundamentalResponse> {
        try {
            switch (fundamentalType) {
                case FundamentalType.MARKET_CAPITALIZATION:
                    return await this.getMarketCapForGetFundamental(symbol);

                case FundamentalType.EARNINGS:
                    return await this.getEarningsForGetFundamental(symbol);

                case FundamentalType.ANALYST_RATING:
                    return await this.getAnalystRatingForGetFundamental(symbol);

                case FundamentalType.DIVIDEND:
                    return await this.getDividendForGetFundamental(symbol);

                case FundamentalType.PRICE_EARNINGS_RATIO:
                    return await this.getPriceEarningsRatioForGetFundamental(
                        symbol
                    );

                default:
                    throw new Error('Unreachable code');
            }
        } catch (error) {
            console.error('get fundamentals failed', error);
            throw error;
        }
    }

    private async getMarketCapForGetFundamental(
        symbol: string
    ): Promise<number> {
        const response = await this.fetchEodHistoricalData(
            `${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`,
            {
                filter: 'Highlights::MarketCapitalization',
            }
        );
        if (response === 'NA') {
            throw new SymbolIsFundError(
                `Symbol ${symbol} is a fund and does not have market capitalization`
            );
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
    private async getEarningsForGetFundamental(
        symbol: string
    ): Promise<Earnings> {
        // also validates symbol has earnings
        const previousEarningsDateString = DatetimeUtil.dateToDateString(
            await this.getPreviousEarningsDate(symbol)
        );
        const quarterDateString = DatetimeUtil.getLastQuarterDateString();
        const previousQuarterDateString =
            DatetimeUtil.getPreviousQuarterDateString(quarterDateString);

        const earningsHistoryKey = `Earnings::History::${previousEarningsDateString}`;
        const earningsAnnualKey = `Earnings::Annual::${
            new Date().getFullYear() - 1
        }-12-31`;

        const balanceSheetKey = `Financials::Balance_Sheet::quarterly::${quarterDateString}`;
        const previousBalanceSheetKey = `Financials::Balance_Sheet::quarterly::${previousQuarterDateString}`;
        const cashFlowKey = `Financials::Cash_Flow::quarterly::${quarterDateString}`;
        const previousCashFlowKey = `Financials::Cash_Flow::quarterly::${previousQuarterDateString}`;
        const incomeStatementKey = `Financials::Income_Statement::quarterly::${quarterDateString}`;
        const previousIncomeStatementKey = `Financials::Income_Statement::quarterly::${previousQuarterDateString}`;

        const response = await this.fetchEodHistoricalData(
            `${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`,
            {
                filter: `Highlights,Valuation,${earningsHistoryKey},${earningsAnnualKey},${balanceSheetKey},${cashFlowKey},${incomeStatementKey},${previousBalanceSheetKey},${previousCashFlowKey},${previousIncomeStatementKey}`,
            }
        );

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
            previousQuarterBalanceSheets: [
                response[balanceSheetKey],
                response[previousBalanceSheetKey],
            ],

            // Financials::Cash_Flow::quarterly
            previousQuarterCashFlows: [
                response[cashFlowKey],
                response[previousCashFlowKey],
            ],

            // Financials::Income_Statement::quarterly
            previousQuarterIncomeStatements: [
                response[incomeStatementKey],
                response[previousIncomeStatementKey],
            ],
        } as Earnings;
    }

    private async getAnalystRatingForGetFundamental(
        symbol: string
    ): Promise<AnalystRating> {
        const previousEarningsDate = await this.getPreviousEarningsDate(symbol);
        const nextEarningsDateString = DatetimeUtil.dateToDateString(
            new Date(
                previousEarningsDate.getFullYear(),
                previousEarningsDate.getMonth() + 4,
                1
            )
        );
        console.debug('nextEarningsDate is ', nextEarningsDateString);

        const earningsHistoryKey = `Earnings::History::${nextEarningsDateString}`;
        const earningsTrendKey = `Earnings::Trend::${nextEarningsDateString}`;

        const response = await this.fetchEodHistoricalData(
            `${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`,
            {
                filter: `Valuation,AnalystRatings,${earningsHistoryKey},${earningsTrendKey}`,
            }
        );

        if (
            response.AnalystRatings === 'NA' ||
            response.AnalystRatings === undefined
        ) {
            throw new NoAnalystRatingError(
                `Symbol ${symbol} is a fund and does not have analyst rating`
            );
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
        } as AnalystRating;
    }

    private async getDividendForGetFundamental(
        symbol: string
    ): Promise<Dividend> {
        const response = await this.fetchEodHistoricalData(
            `${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`,
            {
                filter: 'SplitsDividends,Highlights::DividendShare,Highlights::DividendYield',
            }
        );

        if (response['Highlights::DividendShare'] === 'NA') {
            throw new NoDividendError(
                `Symbol ${symbol} is a fund and does not have market capitalization`
            );
        }

        return {
            annualDividendPerShareTTM: response['Highlights::DividendShare'],
            dividendYield: response['Highlights::DividendYield'],
            forwardAnnualDividendRate: Number(
                response.SplitsDividends.ForwardAnnualDividendRate
            ),
            forwardAnnualDividendYield: Number(
                response.SplitsDividends.ForwardAnnualDividendYield
            ),
            numberOfDividendsPerYear:
                EodHistoricDataUtil.getAverageNumberOfDividendsPerYear(
                    response.SplitsDividends.NumberDividendsByYear
                ),
            dividendDate: response.SplitsDividends.DividendDate,
            exDividendDate: response.SplitsDividends.ExDividendDate,
            payoutRatio: Number(response.SplitsDividends.PayoutRatio),
        } as Dividend;
    }

    private async getPriceEarningsRatioForGetFundamental(
        symbol: string
    ): Promise<PriceEarningsRatio> {
        const response = await this.fetchEodHistoricalData(
            `${EOD_HISTORICAL_DATA_ENDPOINT.FUNDAMENTALS}/${symbol}`,
            {
                filter: 'Highlights,Valuation',
            }
        );

        const highlights: EHDStockHighlights =
            response.Highlights as EHDStockHighlights;
        if (
            highlights.PERatio === undefined ||
            highlights.PERatio === 0 ||
            highlights.PERatio === null
        ) {
            throw new NoPEError('No PE ratio found');
        }

        return {
            // Highlights
            pe: highlights.PERatio,

            // Valuation
            trailingPE: (response.Valuation as EHDStockValuation).TrailingPE,
            forwardPE: (response.Valuation as EHDStockValuation).ForwardPE,
        } as PriceEarningsRatio;
    }

    private async fetchEodHistoricalData(
        subPath: string,
        queryParams?: Record<string, any>
    ): Promise<any> {
        let response: any;
        try {
            const defaultQueryParams = {
                api_token: this.apiToken,
                fmt: 'json',
            };
            const queryString = qs.stringify(
                Object.assign({}, defaultQueryParams, queryParams)
            );

            const url = `${EOD_HISTORICAL_DATA_BASE_URL}${subPath}?${queryString}`;

            response = await axios.get(url);
            console.debug('response: ', response);

            if (response.status === 404) {
                throw new SymbolNotFoundError(`No stock found for ${subPath}`);
            }
            if (response.status !== 200) {
                throw new EodHistoricalDataApiError(
                    `HTTP Error Response: ${response.status} ${response.statusText}`
                );
            }

            return response.data;
        } catch (error) {
            if (
                error instanceof EodHistoricalDataApiError ||
                error instanceof SymbolNotFoundError
            ) {
                throw error;
            }

            console.error(
                `Error fetching data for ${subPath}, ${
                    queryParams ? JSON.stringify(queryParams) : 'no queryParams'
                }:`,
                error.message
            );
            throw new EodHistoricalDataApiError(error);
        }
    }

    private static getAverageNumberOfDividendsPerYear(
        numberDividendsByYear: NumberDividendsByYear
    ): number {
        const numberDividendsByYearArray: EHDNumberDividendsForYear[] =
            Object.values(numberDividendsByYear);
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
            const aYearAgo = new Date(
                today.setFullYear(today.getFullYear() - 1)
            );
            const aYearAgoDateStr = DatetimeUtil.dateToDateString(aYearAgo);

            const response = (await this.fetchEodHistoricalData(
                `${
                    EOD_HISTORICAL_DATA_ENDPOINT.CALENDAR +
                    EOD_HISTORICAL_DATA_ENDPOINT.EARNINGS
                }`,
                {
                    from: aYearAgoDateStr,
                    symbols: symbol,
                }
            )) as CalendarEarningsResponse;

            const earnings = response.earnings;

            if (earnings.length === 0) {
                throw new NoEarningsError(`No earnings found for ${symbol}`);
            }

            response.earnings.sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
            ); // sort by descending date

            return new Date(response.earnings[0].date);
        } catch (error) {
            console.error('get previous earnings date failed', error);
            throw error;
        }
    }
}
