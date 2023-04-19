export interface StockDividend {
  annualDividendPerShareTTM: number;
  dividendYield: number;
  forwardAnnualDividendRate: number; // in USD amount
  forwardAnnualDividendYield: number;
  numberOfDividendsPerYear: number; // median of dividend count excluding current year and 1st year
  dividendDate: string; // YYYY-MM-DD
  exDividendDate: string; // YYYY-MM-DD
  payoutRatio: number; // annualDividendPerShareTTM / earningsPerShareTTM or TotalDividends / TotalNetIncome
}

