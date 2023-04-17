# VestBot

Serve stock queries

This bot has been created using [Bot Framework](https://dev.botframework.com), it shows how to:

- Use [CLU](https://language.cognitive.azure.com/) to implement core AI capabilities
- Implement a multi-turn conversation using Dialogs
- Handle user interruptions for such things as `Help` or `Cancel`
- Prompt for and validate requests for information from the user

## Prerequisites

This sample **requires** prerequisites in order to run.

### Overview

This bot uses [CLU](https://language.cognitive.azure.com/), an AI based cognitive service, to implement language understanding.

- [Node.js](https://nodejs.org) version 10.14.1 or higher


    ```bash
    # determine node version
    node --version
    ```


## To run the bot

- Install modules

    ```bash
    npm install
    ```
- Build the bot source code

    ```bash
    npm run build
    ```
- Setup CLU

- Start the bot

    ```bash
    npm start
    ```
  
## Testing the bot using Bot Framework Emulator

[Bot Framework Emulator](https://github.com/microsoft/botframework-emulator) is a desktop application that allows bot developers to test and debug their bots on localhost or running remotely through a tunnel.

- Install the Bot Framework Emulator version 4.9.0 or greater from [here](https://github.com/Microsoft/BotFramework-Emulator/releases) 

### Connect to the bot using Bot Framework Emulator

- Launch Bot Framework Emulator
- File -> Open Bot
- Enter a Bot URL of `http://localhost:8080/api/messages`

### Connecting to a deployed bot
- set the endpoint to the domain (http for alpha) 
  - alpha: `http://${ALPHA_BOT_DOMAIN}:80/api/messages`
  - else: `http://${BOT_DOMAIN}:443/api/messages`
- download ngrok v2  (https://dl.equinox.io/ngrok/ngrok/stable/archive) and configure "Path to ngrok" in Bot Framework Emulator to its location via gear icon at the bottom left 

## Further reading

- [Bot Framework Documentation](https://docs.botframework.com)
- [Bot Basics](https://docs.microsoft.com/azure/bot-service/bot-builder-basics?view=azure-bot-service-4.0)
- [Dialogs](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-concept-dialog?view=azure-bot-service-4.0)
- [Gathering Input Using Prompts](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-prompts?view=azure-bot-service-4.0)
- [Activity processing](https://docs.microsoft.com/en-us/azure/bot-service/bot-builder-concept-activity-processing?view=azure-bot-service-4.0)
- [Azure Bot Service Introduction](https://docs.microsoft.com/azure/bot-service/bot-service-overview-introduction?view=azure-bot-service-4.0)
- [Azure Bot Service Documentation](https://docs.microsoft.com/azure/bot-service/?view=azure-bot-service-4.0)
- [Azure CLI](https://docs.microsoft.com/cli/azure/?view=azure-cli-latest)
- [Azure Portal](https://portal.azure.com)
- [Channels and Bot Connector Service](https://docs.microsoft.com/en-us/azure/bot-service/bot-concepts?view=azure-bot-service-4.0)
- [TypeScript](https://www.typescriptlang.org)
- [Restify](https://www.npmjs.com/package/restify)
- [dotenv](https://www.npmjs.com/package/dotenv)
