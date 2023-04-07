import {
  EHDAnalystRatings,
  EHDEarningsHistorical,
  EHDEarningsTrend,
} from "../eodHistoricalData/model";

export interface AnalystRating {
  // Valuation
  forwardPE: number;

  // Analyst Rating
  analystRating: EHDAnalystRatings;

  // Earnings
  // estimate for upcoming quarter
  nextQuarterEstimates: Omit<EHDEarningsTrend, 'code'>,
  nextQuarterDateAndEps: EHDEarningsHistorical
}

export function getAnalystCount(analystRating: EHDAnalystRatings): number {
  return analystRating.StrongBuy + analystRating.Buy + analystRating.Hold + analystRating.Sell + analystRating.StrongSell;
}