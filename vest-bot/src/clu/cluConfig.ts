// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export interface CluConfigInterface {
    projectName: string;
    deploymentName: string;
    endpointKey: string;
    endpoint: string;
}

export class CluConfig implements CluConfigInterface {
    public projectName: string;
    public deploymentName: string;
    public endpointKey: string;
    public endpoint: string;

    constructor(
        config: CluConfigInterface
    ) {
        this.projectName = config.projectName;
        this.deploymentName = config.deploymentName;
        this.endpointKey = config.endpointKey;
        this.endpoint = config.endpoint;

        console.log('project name is ' + this.projectName);

        if (CluConfig.isNullOrWhitespace(this.projectName)) {
            throw new Error(
                'projectName value is Null or whitespace. Please use a valid projectName.'
            );
        }

        if (CluConfig.isNullOrWhitespace(this.deploymentName)) {
            throw new Error(
                'deploymentName value is Null or whitespace. Please use a valid deploymentName.'
            );
        }

        if (CluConfig.isNullOrWhitespace(this.endpointKey)) {
            throw new Error(
                'endpointKey value is Null or whitespace. Please use a valid endpointKey.'
            );
        }

        if (CluConfig.isNullOrWhitespace(this.endpoint)) {
            throw new Error(
                'Endpoint value is Null or whitespace. Please use a valid endpoint.'
            );
        }

        if (!CluConfig.tryParse(this.endpointKey)) {
            throw new Error(
                '"{endpointKey}" is not a valid CLU subscription key.'
            );
        }

        if (!CluConfig.isWellFormedUriString(this.endpoint)) {
            throw new Error('"{endpoint}" is not a valid CLU endpoint.');
        }
    }

    private static isNullOrWhitespace(input) {
        return !input || !input.trim();
    }

    private static tryParse(key) {
        const pattern = new RegExp('^[0-9a-f]{32}', 'i');
        return pattern.test(key);
    }

    private static isWellFormedUriString(url) {
        const pattern = new RegExp(
            '^(https?:\\/\\/)?' + // protocol
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                '(\\#[-a-z\\d_]*)?$',
            'i'
        ); // fragment locator
        return pattern.test(url);
    }
}