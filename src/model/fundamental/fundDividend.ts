import { EHDPeriod } from '../eodHistoricalData/literals';

export interface FundDividend {
  //  ETF_Data::Valuations_Growth::Dividend-Yield Factor
  dividendYield: number;
  // ETF_Data::Dividend_Paying_Frequency
  dividendPayingFrequency: EHDPeriod;
}

