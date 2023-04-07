// enum value must match https://language.cognitive.azure.com/clu/projects/StockResearch/build/fundamentalType
export enum FundamentalType {
  ANALYST_RATING = 'AnalystRating',
  DIVIDEND = 'Dividend',
  EARNINGS = 'Earnings',
  MARKET_CAPITALIZATION = 'MarketCapitalization',
  PRICE_EARNINGS_RATIO = 'PriceEarningsRatio',
}

export const fundamentalTypePromptName:
  Record<FundamentalType, string> = {
    [FundamentalType.MARKET_CAPITALIZATION]: 'market capitalization',
    [FundamentalType.PRICE_EARNINGS_RATIO]: 'price-to-earnings ratio',
    [FundamentalType.EARNINGS]: 'earnings',
    [FundamentalType.DIVIDEND]: 'dividend',
    [FundamentalType.ANALYST_RATING]: 'analyst rating',
};
