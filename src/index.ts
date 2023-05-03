import * as restify from 'restify';

import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    ConversationState, createBotFrameworkAuthenticationFromConfiguration,
    MemoryStorage, MemoryTranscriptStore, ShowTypingMiddleware, TranscriptLoggerMiddleware, TranscriptStore,
    UserState,
} from 'botbuilder';

import { MainDialog } from './dialogs/mainDialog';
import { GetFundamentalDialog } from './dialogs/getFundamentalDialog';

import { config } from 'dotenv';
import * as path from 'path';
import { StockResearchRecognizer } from './clu/stockResearchRecognizer';
import { Dialog } from './model/dialog';
import { Stage } from './model/stage';
import { logger } from './util/logger';
import { SecretsManagerUtil } from './util/secrets-manager';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SERVER_SECRET, VEST_DEFAULT_REGION } from './util/constant';
import { ServerSecret } from './model/secret';
import { ConfigurationServiceClientCredentialFactoryOptions } from 'botbuilder-core/src/configurationServiceClientCredentialFactory';
import { DialogBot } from './bots/dialogBot';
import { MetricsLogger } from './module/MetricsLogger';


async function getServerSecret(): Promise<ServerSecret> {
    const secretMgr = new SecretsManagerUtil(new SecretsManagerClient({ region: VEST_DEFAULT_REGION }));
    const serverSecret = await secretMgr.getServerSecret(SERVER_SECRET);
    // DEBUG
    console.debug('server secret: ', serverSecret);
    return serverSecret;
    // return await secretMgr.getServerSecret(SERVER_SECRET);
}

(async () => {
    // import env file
    const ENV_FILE = path.join(__dirname, '../', '.env');
    config({ path: ENV_FILE });
    const healthCheckPath = process.env.HEALTH_CHECK_PATH;

    // for local and alpha, bot is not registered to Azure Bot Service as it requires HTTPS, and thus not capable of Direct Line (Web Chat) for frontend
    let botFrameworkAuthentication;
    if (process.env.STAGE === Stage.LOCAL || process.env.STAGE === Stage.ALPHA) {
        botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, new ConfigurationServiceClientCredentialFactory());
    } else {
        const serverSecret = await getServerSecret();
        botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, new ConfigurationServiceClientCredentialFactory({
            MicrosoftAppId: serverSecret.MicrosoftAppId,
            MicrosoftAppPassword: serverSecret.MicrosoftAppPassword,
            MicrosoftAppType: serverSecret.MicrosoftAppType,
            MicrosoftAppTenantId: serverSecret.MicrosoftAppTenantId
        } as ConfigurationServiceClientCredentialFactoryOptions));
    }

    // create an adapter to handle connectivity with the channels
    // See https://aka.ms/about-bot-adapter to learn more about adapters.
    const adapter = new CloudAdapter(botFrameworkAuthentication);
    adapter.use(new ShowTypingMiddleware());
    adapter.use(new TranscriptLoggerMiddleware((await MetricsLogger.getInstance()).getTranscriptStore()));

    // Catch-all for errors.
    const onTurnErrorHandler = async (context, error) => {
        // This check writes out errors to console log .vs. app insights.
        // NOTE: In production environment, you should consider logging this to Azure
        //       application insights.
        logger.error(error, `\n [onTurnError] unhandled error`);

        // Send a trace activity, which will be displayed in Bot Framework Emulator
        await context.sendTraceActivity(
            'OnTurnError Trace',
            `${error}`,
            'https://www.botframework.com/schemas/error',
            'TurnError'
        );

        // Send a message to the user
        await context.sendActivity('The bot encountered an error or bug.');
        await context.sendActivity(
            'To continue to run this bot, please fix the bot source code.'
        );
        // Clear out state
        await conversationState.delete(context);
    };

    // Set the onTurnError for the singleton CloudAdapter.
    adapter.onTurnError = onTurnErrorHandler;

    // Define a state store for your bot. See https://aka.ms/about-bot-state to learn more about using MemoryStorage.
    // A bot requires a state store to persist the dialog and user state between messages.
    // For local development and MVP, in-memory storage is used.
    // CAUTION: When the bot is restarted, anything stored in memory will be gone.
    const memoryStorage = new MemoryStorage();
    const conversationState: ConversationState = new ConversationState(
        memoryStorage
    );
    const userState: UserState = new UserState(memoryStorage);

    // Create the main dialog.
    const dialog = new MainDialog(
        await new StockResearchRecognizer().init(),
        new GetFundamentalDialog()
    );
    const bot = new DialogBot(conversationState, userState, dialog);

    // Create HTTP server
    const server = restify.createServer();
    server.use(restify.plugins.bodyParser());
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    server.use(require('restify-pino-logger')({
        logger: logger,
        autoLogging: false
    }));

    server.listen(process.env.port || process.env.PORT || 3978, () => {
        logger.info(`Vest bot at ${process.env.STAGE} is ${server.name} listening to ${server.url}`);

        if (process.env.STAGE === Stage.LOCAL) {
            logger.info(
                'Get Bot Framework Emulator: https://aka.ms/botframework-emulator'
            );
            logger.info('To talk to your bot, open the emulator select "Open Bot"');
        }

    });

    // Listen for incoming activities and route them to your bot main dialog.
    server.post('/api/messages', async (req, res) => {
        logger.debug(req, 'Incoming request: ');
        // Route received a request to adapter for processing
        await adapter.process(req, res, (context) => {
            logger.debug(context, 'Adapter processing context: ')
            return bot.run(context);
        });

        logger.debug(res, 'Adapter processed response: ');
    });

    server.get(healthCheckPath, (req, res) => {
        res.send(200, 'OK');
    });

})();
