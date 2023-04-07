import {
  EHDBalanceSheet,
  EHDCashFlow,
  EHDEarningsAnnual,
  EHDEarningsHistorical,
  EHDIncomeStatement
} from "../eodHistoricalData/model";

export interface Earnings {
  // Fundamentals::Highlights
  epsEstimateCurrentYear: number,
  epsEstimateNextYear: number,
  epsEstimateNextQuarter: number,
  epsEstimateCurrentQuarter: number,
  profitMargin: number,
  returnOnEquityTTM: number,
  revenueTTM: number,
  revenuePerShareTTM: number,
  quarterlyRevenueGrowthYOY: number,  // cant verify this data against historical total revenue. NOT USED
  grossProfitTTM: number,
  quarterlyEarningsGrowthYOY: number, // not sure what it means. NOT USED

  // Earnings::History
  previousQuarterEarnings: EHDEarningsHistorical,

  // Earnings::Annual
  // previousAnnualEps: EHDEarningsAnnual,
  // NOT USED variable date key (can be 2022-09-30 or 2022-12-31, etc)

  // Financials::Balance_Sheet::quarterly
  // include the previous quarter and the quarter before that, in that order
  previousQuarterBalanceSheets: EHDBalanceSheet[],

  // Financials::Cash_Flow::quarterly
  // include the previous quarter and the quarter before that, in that order
  previousQuarterCashFlows: EHDCashFlow[],

  // Financials::Income_Statement::quarterly
  // include the previous quarter and the quarter before that, in that order
  previousQuarterIncomeStatements: EHDIncomeStatement[],
}

