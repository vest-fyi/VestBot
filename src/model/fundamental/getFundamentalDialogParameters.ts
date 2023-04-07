// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { FundamentalType } from './fundamentalType';
import { EHDSearchResult } from "../eodHistoricalData/model";

export class GetFundamentalDialogParameters {
    // stock input from customer as recognized by CLU
    public stockSymbol: string; // with exchange suffix. E.g., AAPL.US
    public fundamentalType: FundamentalType;
    public stock: EHDSearchResult;

    // TODO: add support for retrieval with date VES-30
    // public fundamentalTimex?: string; // when user prompts for a specific fundamental data date or when user prompts for a fundamental data date range (serve as fundamentalStartTimex)
    // public fundamentalEndTimex?: Date; // when user prompts for a fundamental data date range
    // public fundamentalDate?: Date; // TS type for fundamentalTimex
    // public fundamentalEndDate?: Date; // TS type for fundamentalEndTimex
}
