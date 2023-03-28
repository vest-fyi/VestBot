// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CluConfig } from "./cluConfig";
import { TurnContext } from "botbuilder";
import {
    AnalyzeConversationResponse,
    ConversationalTask,
    ConversationAnalysisClient
} from "@azure/ai-language-conversations";
const { AzureKeyCredential } = require('@azure/core-auth');

export class CluRecognizer {
    private conversationsClient: ConversationAnalysisClient;
    private options: CluConfig;
    private readonly CluTraceLabel: string;

    constructor(options: CluConfig) {
        this.conversationsClient = new ConversationAnalysisClient(options.endpoint, new AzureKeyCredential(options.endpointKey));
        this.options = options;
        this.CluTraceLabel = 'CLU Trace';
    }

    async recognizeAsync(turnContext: TurnContext): Promise<AnalyzeConversationResponse> {
        const utterance = turnContext.activity.text;
        return await this.recognizeInternalAsync(utterance, turnContext);
    }

    private async recognizeInternalAsync(utterance: string, turnContext: TurnContext): Promise<AnalyzeConversationResponse> {
        const request: ConversationalTask =
        {
            analysisInput:
            {
                conversationItem:
                {
                    text: utterance,
                    id: '1',
                    participantId: '1'
                }
            },
            parameters:
            {
                projectName: this.options.projectName,
                deploymentName: this.options.deploymentName
            },
            kind: 'Conversation'
        };

        const cluResponse = await this.conversationsClient.analyzeConversation(request);

        const traceInfo = { response: cluResponse };

        await turnContext.sendTraceActivity('CLU Recognizer', traceInfo, this.CluTraceLabel);
        return cluResponse;
    }

}