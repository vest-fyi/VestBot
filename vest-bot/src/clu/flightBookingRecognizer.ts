// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CluRecognizer } from './cluRecognizer';
import { CluConfig } from './cluConfig';

export class FlightBookingRecognizer {
    private recognizer: CluRecognizer;

    constructor(config: CluConfig) {
        this.recognizer = new CluRecognizer(config);

        if (!this.isConfigured()) {
            throw new Error(
                'FlightBookingRecognizer is not configured. Please check your configuration.'
            );
        }
    }

    public isConfigured(): boolean {
        return this.recognizer !== undefined;
    }

    /**
     * Returns an object with preformatted CLU results for the bot's dialogs to consume.
     * @param {TurnContext} context
     */
    async executeCluQuery(context) {
        return await this.recognizer.recognizeAsync(context);
    }

    getFromEntities(response) {
        const result = response.result.prediction;
        let fromValue;

        const fromEntities = result.entities.filter((entity) => entity.category === Entity.FROM_CITY);
        if (fromEntities.length > 1) {
            throw new Error('More than one from city found');
        } else if (fromEntities.length === 1) {
            fromValue = fromEntities[0].text;
        } else {
            throw new Error('No from city found');
        }

        return { from: fromValue, airport: fromValue };
    }

    getToEntities(response) {
        const result = response.result.prediction;
        let toValue;

        const fromEntities = result.entities.filter((entity) => entity.category === Entity.TO_CITY);
        if (fromEntities.length > 1) {
            throw new Error('More than one to city found');
        } else if (fromEntities.length === 1) {
            toValue = fromEntities[0].text;
        } else {
            throw new Error('No to city found');
        }

        return { to: toValue, airport: toValue };
    }

    /**
     * This value will be a TIMEX. And we are only interested in a Date so grab the first result and drop the Time part.
     * TIMEX is a format that represents DateTime expressions that include some ambiguity. e.g. missing a Year.
     */
    getTravelDate(response) {
        const result = response.result.prediction;
        let datetimeEntity;

        for (const entity of result.entities) {
            if (entity.category === Entity.FLIGHT_DATE ) {
                datetimeEntity = entity.resolutions;
            }
        }

        if (!datetimeEntity || !datetimeEntity[0]) return undefined;

        const timex = datetimeEntity[0].timex;
        if (!timex) return undefined;

        return timex;
    }

    topIntent(response) {
        return response.result.prediction.topIntent;
    }
}

module.exports.FlightBookingRecognizer = FlightBookingRecognizer;
