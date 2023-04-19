export interface FundAnalystRating {
  // ETF_Data::Valuations_Growth::Valuations_Rates_To_Category::Price/Prospective Earnings
  forwardPE: number;

  // ETF_Data::Valuations_Growth::Growth_Rates_Portfolio::Long-Term Projected Earnings Growth
  longTermProjectedEarningsGrowth: number;  // percent?

  // ETF_Data::MorningStar::Ratio
  morningStarRatio: number;  // decimal
}
