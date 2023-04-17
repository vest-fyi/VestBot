import * as restify from 'restify';

import {
    CloudAdapter, ConfigurationServiceClientCredentialFactory,
    ConversationState, createBotFrameworkAuthenticationFromConfiguration,
    MemoryStorage,
    UserState,
} from 'botbuilder';

import { DialogAndWelcomeBot } from './bots/dialogAndWelcomeBot';
import { MainDialog } from './dialogs/mainDialog';
import { GetFundamentalDialog } from './dialogs/getFundamentalDialog';

import { config } from 'dotenv';
import * as path from 'path';
import { StockResearchRecognizer } from './clu/stockResearchRecognizer';
import { Dialog } from './model/dialog';
import { Stage } from './model/stage';


(async () => {
    // import env file
    const ENV_FILE = path.join(__dirname, '../', '.env');
    config({ path: ENV_FILE });
    const healthCheckPath = process.env.HEALTH_CHECK_PATH;

    const credentialsFactory = new ConfigurationServiceClientCredentialFactory();
    const botFrameworkAuthentication =
        createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

    // create an adapter to handle connectivity with the channels
    // See https://aka.ms/about-bot-adapter to learn more about adapters.
    const adapter = new CloudAdapter(botFrameworkAuthentication);

    // Catch-all for errors.
    const onTurnErrorHandler = async (context, error) => {
        // This check writes out errors to console log .vs. app insights.
        // NOTE: In production environment, you should consider logging this to Azure
        //       application insights.
        console.error(`\n [onTurnError] unhandled error: ${error}`);

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
    // For local development, in-memory storage is used.
    // CAUTION: The Memory Storage used here is for local bot debugging only. When the bot
    // is restarted, anything stored in memory will be gone.
    const memoryStorage = new MemoryStorage();
    const conversationState: ConversationState = new ConversationState(
        memoryStorage
    );
    const userState: UserState = new UserState(memoryStorage);

    // Create the main dialog.
    const dialog = new MainDialog(
        await new StockResearchRecognizer().init(),
        new GetFundamentalDialog(Dialog.GET_FUNDAMENTAL)
    );
    const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);

    // Create HTTP server
    const server = restify.createServer();
    server.use(restify.plugins.bodyParser());

    server.listen(process.env.port || process.env.PORT || 3978, () => {
        console.log(`\nVest bot at ${process.env.STAGE} is ${server.name} listening to ${server.url}`);
        if (process.env.STAGE === Stage.LOCAL) {
            console.log(
                '\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator'
            );
            console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
        }

    });

    // Listen for incoming activities and route them to your bot main dialog.
    server.post('/api/messages', async (req, res) => {
        // Route received a request to adapter for processing
        await adapter.process(req, res, (context) => bot.run(context));
    });

    server.get(healthCheckPath, (req, res) => {
        res.send(200, 'OK');
    });

})();
