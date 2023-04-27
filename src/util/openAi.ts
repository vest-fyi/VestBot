import { Stage } from '../model/stage';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { BETA_SERVER_SECRET_ARN, OPEN_AI_MAX_TOKENS, SERVER_SECRET, VEST_DEFAULT_REGION } from './constant';
import { SecretsManagerUtil } from './secrets-manager';
import { logger } from './logger';
import { Configuration, OpenAIApi } from 'openai';

// TODO: get from secret manager

export class OpenAi {
    private apiToken: string;
    private client: OpenAIApi;

    /**
     * @constructor
     */
    public static async create(): Promise<OpenAi> {
        const openAi = new OpenAi();
        await openAi.init();
        return openAi;
    }

    private isInitialized() {
        return this.apiToken != undefined && this.client != undefined;
    }

    /**
     * Constructor for EodHistoricDataUtil
     *
     * @Return {EodHistoricDataUtil} - EodHistoricDataUtil initialized class instance
     */
    public async init(): Promise<OpenAi> {
        // bring your own .env file for local testing
        if (process.env.STAGE == Stage.LOCAL || !process.env.STAGE) {
            const { OpenAiApiKey } = process.env;
            this.apiToken = OpenAiApiKey;
        } else {
            const client = new SecretsManagerClient({ region: VEST_DEFAULT_REGION });
            const secretMgr = new SecretsManagerUtil(client);

            const serverSecret = await secretMgr.getServerSecret(process.env.STAGE == Stage.ALPHA ? BETA_SERVER_SECRET_ARN : SERVER_SECRET);
            logger.debug(serverSecret, 'serverSecret: ');

            this.apiToken = serverSecret.OpenAiApiKey;
        }

        const configuration = new Configuration({
            apiKey: this.apiToken,
        });
        this.client = new OpenAIApi(configuration);

        if (!this.isInitialized()) {
            throw new Error('OpenAI Client not initialized');
        }

        return this;
    }

    /**
     * Returns the answer to a stock-related question
     *
     * @param question
     * @returns {Promise<string>} - answer to the question
     * @throws {Error} - if the client is not initialized or API faulure
     */
    public async getAnswer(question: string): Promise<string> {
        try {
            const response = await this.client.createChatCompletion({
                model: 'gpt-4',
                temperature: 0.1,
                max_tokens: OPEN_AI_MAX_TOKENS,
                n: 1,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful stock research assistant that gives factual, up-to-date information by stating the date that knowledgable is applicable to. You also politely refusing to answer non-investment related questions'
                    },
                    { role: 'user', content: question }
                ],
            });

            logger.debug(response.data, 'response body: ');
            logger.debug(response.status, 'response status: ');
            logger.debug(response.headers, 'response headers: ');

            const choice = response.data.choices[0];

            if (choice.finish_reason.toLowerCase() !== 'stop') {
                logger.warn(response.data, 'OpenAi.getAnswer() did not finish completely: ');
            }

            return choice.message.content;
        } catch (error) {
            logger.error(error, 'Received error in OpenAi.getAnswer(): ');
            throw error;
        }

    }
}
