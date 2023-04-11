import {
  EHDBalanceSheet,
  EHDCashFlow,
  EHDEarningsAnnual,
  EHDEarningsHistorical,
  EHDIncomeStatement
} from "../eodHistoricalData/model";

export interface FundEarnings {
  // ETF_Data
  expenseRatio: number, // fraction form representing percentage
  inceptionDate: string, // YYYY-MM-DD

  // ETF_Data::Performance
  ytdReturn: number, // fraction form representing percentage
  oneYearReturn: number, // fraction form representing percentage
  threeYearReturn: number, // fraction form representing percentage
  fiveYearReturn: number, // fraction form representing percentage
  tenYearReturn: number, // fraction form representing percentage
}

