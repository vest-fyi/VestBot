export const EOD_HISTORICAL_DATA_BASE_URL = 'https://eodhistoricaldata.com/api'

export enum EOD_HISTORICAL_DATA_ENDPOINT  {
  BOND_FUNDAMENTALS = '/bond-fundamentals',
  CALENDAR = '/calendar',
  DIVIDENDS = '/div',
  EARNINGS = '/earnings',
  EOD_BULK_LAST_DAY = '/eod-bulk-last-day',
  EOD_PRICE = '/eod',
  EXCHANGE_DETAILS = '/exchange-details',
  EXCHANGES_LIST = '/exchanges-list',
  EXCHANGE_SYMBOL_LIST = '/exchange-symbol-list',
  FUNDAMENTALS = '/fundamentals',
  INTRADAY = '/intraday',
  IPOS = '/ipos',
  MACRO_ECONOMIC = '/macro-indicator',
  OPTIONS = '/options',
  REAL_TIME = '/real-time',
  SCREENER = '/screener',
  SEARCH = '/search',
  SHORT_INTEREST = '/shorts',
  SPLITS = '/splits',
  TECHNICALS = '/technical',
  TRENDS = '/trends',
  USER = '/user'
}

export type EHDExchangeCode =
    | 'AS'
    | 'AT'
    | 'AU'
    | 'BA'
    | 'BE'
    | 'BK'
    | 'BOND'
    | 'BR'
    | 'BSE'
    | 'BUD'
    | 'CC'
    | 'CO'
    | 'COMM'
    | 'DU'
    | 'ETLX'
    | 'EUFUND'
    | 'F'
    | 'FOREX'
    | 'GBOND'
    | 'HA'
    | 'HE'
    | 'HK'
    | 'HM'
    | 'IC'
    | 'IL'
    | 'INDX'
    | 'IR'
    | 'IS'
    | 'JK'
    | 'JSE'
    | 'KAR'
    | 'KLSE'
    | 'KO'
    | 'KQ'
    | 'LIM'
    | 'LS'
    | 'LSE'
    | 'LU'
    | 'MC'
    | 'MCX'
    | 'MI'
    | 'MONEY'
    | 'MU'
    | 'MX'
    | 'NB'
    | 'NFN'
    | 'NSE'
    | 'OL'
    | 'PA'
    | 'PSE'
    | 'RG'
    | 'SA'
    | 'SG'
    | 'SHE'
    | 'SHG'
    | 'SN'
    | 'SR'
    | 'ST'
    | 'STU'
    | 'SW'
    | 'TA'
    | 'TO'
    | 'TW'
    | 'TWO'
    | 'US'
    | 'V'
    | 'VI'
    | 'VN'
    | 'VS'
    | 'VX'
    | 'WAR'
    | 'XETRA'
    | 'ZSE';

export type EHDSymbolType =
    | 'Common Stock'
    | 'Currency'
    | 'ETF'
    | 'FUND'
    | 'BOND'
    | 'MONEY'
    | 'INDEX';

export type EHDCurrencyCode =
    | 'USD'
    | 'EUR'
    | 'AUD'
    | 'GBP'
    | 'HRK'
    | 'PHP'
    | 'INR'
    | 'BRL'
    | 'DKK'
    | 'MYR'
    | 'SGD'
    | 'CZK'
    | 'HUF'
    | 'PLN'
    | 'THB'
    | 'TRY'
    | 'CNY'
    | 'CAD'
    | 'HKD'
    | 'RUB'
    | 'ZAR'
    | 'IDR'
    | 'JPY'
    | 'KRW'
    | 'PKR'
    | 'TWD'
    | 'MXN'
    | 'NZD'
    | 'NOK'
    | 'SEK'
    | 'CHF'
    | 'ILS'
    | 'SAR';
