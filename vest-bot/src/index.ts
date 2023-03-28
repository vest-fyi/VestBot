import * as restify from 'restify';
import { INodeSocket } from 'botframework-streaming';

// Import required bot services.
// See https://aka.ms/bot-services to learn more about the different parts of a bot.
import {
    CloudAdapter,
    ConfigurationServiceClientCredentialFactory,
    ConversationState,
    createBotFrameworkAuthenticationFromConfiguration,
    MemoryStorage,
    UserState,
} from 'botbuilder';

// The bot and its main dialog.
import { DialogAndWelcomeBot } from './bots/dialogAndWelcomeBot';
import { MainDialog } from './dialogs/mainDialog';

// The bot's booking dialog
import { BookingDialog } from './dialogs/bookingDialog';

// The helper-class recognizer that calls LUIS
import { FlightBookingRecognizer } from './clu/flightBookingRecognizer';
import { CluConfig } from './clu/cluConfig';

import { config } from 'dotenv';
import * as path from 'path';

// import env file
const ENV_FILE = path.join(__dirname, '../..', '.env');
config({ path: ENV_FILE });

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.MicrosoftAppId,
    MicrosoftAppPassword: process.env.MicrosoftAppPassword,
    MicrosoftAppType: process.env.MicrosoftAppType,
    MicrosoftAppTenantId: process.env.MicrosoftAppTenantId,
});

const botFrameworkAuthentication =
    createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

// Create adapter.
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

// If configured, pass in the FlightBookingRecognizer. (Defining it externally allows it to be mocked for tests)
const { CluAPIKey, CluAPIHostName, CluProjectName, CluDeploymentName } =
    process.env;
const cluConfig = new CluConfig({
    endpointKey: CluAPIKey,
    endpoint: `https://${CluAPIHostName}`,
    projectName: CluProjectName,
    deploymentName: CluDeploymentName,
});

const cluRecognizer = new FlightBookingRecognizer(cluConfig);

// Create the main dialog.
const BOOKING_DIALOG = 'bookingDialog';
const bookingDialog = new BookingDialog(BOOKING_DIALOG);
const dialog = new MainDialog(cluRecognizer, bookingDialog);
const bot = new DialogAndWelcomeBot(conversationState, userState, dialog);

// Create HTTP server
const server = restify.createServer();
server.use(restify.plugins.bodyParser());

server.listen(process.env.port || process.env.PORT || 3978, () => {
    console.log(`\n${server.name} listening to ${server.url}`);
    console.log(
        '\nGet Bot Framework Emulator: https://aka.ms/botframework-emulator'
    );
    console.log('\nTo talk to your bot, open the emulator select "Open Bot"');
});

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', async (req, res) => {
    // Route received a request to adapter for processing
    await adapter.process(req, res, (context) => bot.run(context));
});

// Listen for Upgrade requests for Streaming.
server.on('upgrade', async (req, socket, head) => {
    // Create an adapter scoped to this WebSocket connection to allow storing session data.
    const streamingAdapter = new CloudAdapter(botFrameworkAuthentication);

    // Set onTurnError for the CloudAdapter created for each connection.
    streamingAdapter.onTurnError = onTurnErrorHandler;

    await streamingAdapter.process(
        req,
        socket as unknown as INodeSocket,
        head,
        (context) => bot.run(context)
    );
});
