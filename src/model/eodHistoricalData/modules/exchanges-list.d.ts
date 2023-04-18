import { EHDExchange } from '../model'
import { EHDFormatConfig } from './shared'

type EHDExchangeListConfig = EHDFormatConfig

export interface EHDExchangeListModule {
  exchangesList: (config?: EHDExchangeListConfig) => Promise<EHDExchange[]>
}
