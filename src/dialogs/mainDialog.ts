import {
    ActivityTypes, CardFactory,
    InputHints,
    MessageFactory,
    StatePropertyAccessor,
    TurnContext,
} from 'botbuilder';

import {
    ComponentDialog,
    DialogSet,
    DialogState,
    DialogTurnResult,
    DialogTurnStatus,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext,
} from 'botbuilder-dialogs';
import { GetFundamentalDialog } from './getFundamentalDialog';
import { StockResearchRecognizer } from '../clu/stockResearchRecognizer';
import { Dialog } from '../model/dialog';
import { Intent, IntentUtterance } from '../model/intent';
import { logger } from '../util/logger';
import { OpenAi } from '../util/openAi';
import * as FeedbackCard from '../resources/feedbackCard.json';

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

export class MainDialog extends ComponentDialog {
    private stockResearchRecognizer: StockResearchRecognizer;

    constructor(
        stockResearchRecognizer: StockResearchRecognizer,
        getFundamentalDialog: GetFundamentalDialog
    ) {
        super(Dialog.MAIN);

        this.validateConstructorParameters(
            stockResearchRecognizer,
            getFundamentalDialog
        );

        // Define the main dialog and its related components.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(getFundamentalDialog)
            .addDialog(
                new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                    this.introStep.bind(this),
                    this.actStep.bind(this),
                    this.finalStep.bind(this),
                ])
            );

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     *
     * @param {TurnContext} context
     * @param dialogStateAccessor
     */
    async run(
        context: TurnContext,
        dialogStateAccessor: StatePropertyAccessor<DialogState>
    ) {
        const dialogSet = new DialogSet(dialogStateAccessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(context);

        if (this.isWelcomeCardButtonAction(context)) {  // start a fresh dialog with one of the welcome card actions
            await dialogContext.beginDialog(this.id);
        } else {
            const results = await dialogContext.continueDialog();
            if (results.status === DialogTurnStatus.empty) {
                await dialogContext.beginDialog(this.id);
            }
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    private async introStep(
        stepContext: WaterfallStepContext
    ): Promise<DialogTurnResult> {
        if (this.isWelcomeCardButtonAction(stepContext.context)) {
            return await stepContext.next(stepContext.context.activity.text);
        }

        // prompt
        const messageText = (stepContext.options as any).restartMsg
            ? (stepContext.options as any).restartMsg
            : 'What can I help you with today?';
        const promptMessage = MessageFactory.text(
            messageText,
            messageText,
            InputHints.ExpectingInput
        );
        return await stepContext.prompt('TextPrompt', {
            prompt: promptMessage,
        });
    }

    /**
     * Second step in the waterfall.  This will use CLU to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
    private async actStep(
        stepContext: WaterfallStepContext
    ): Promise<DialogTurnResult> {
        const turnContext = stepContext.context;
        if (this.isWelcomeCardButtonAction(turnContext)) {
            return await stepContext.beginDialog(
                Dialog.GET_FUNDAMENTAL,
            );
        }

        // Call CLU and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const cluResult = await this.stockResearchRecognizer.executeCluQuery(turnContext);

        // DEBUG
        logger.debug(cluResult, 'CLU result is ');

        const confidenceScore = this.stockResearchRecognizer.getTopIntentConfidence(cluResult);
        if (confidenceScore < 0.85) {
            // use GPT-4 response as fallback
            await turnContext.sendActivity({ type: ActivityTypes.Typing })

            const openAi = await OpenAi.create();
            const response = await openAi.getAnswer(turnContext.activity.text);
            logger.debug(response, 'GPT-4 response is ');

            await turnContext.sendActivity(
                response,
                InputHints.IgnoringInput
            );

            return await stepContext.next();
        }

        const topIntent = this.stockResearchRecognizer.getTopIntent(cluResult);
        switch (topIntent) {
            case Intent.GET_FUNDAMENTAL:
                // Initialize getFundamentalParameters with any entities we may have found in the response.
                const getFundamentalParameters =
                    StockResearchRecognizer.getGetFundamentalDialogEntitiesFromCluResponse(
                        cluResult
                    );

                logger.debug(getFundamentalParameters, 'CLU extracted these get fundamental parameters from intent statement:');

                // Run the GetFundamental dialog passing in whatever details we have from the CLU call, it will fill out the remainder.
                return await stepContext.beginDialog(
                    Dialog.GET_FUNDAMENTAL,
                    getFundamentalParameters
                );

            default:
                // Catch all for unhandled intents
                const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${this.stockResearchRecognizer.getTopIntent(
                    cluResult
                )})`;
                await turnContext.sendActivity(
                    didntUnderstandMessageText,
                    InputHints.IgnoringInput
                );
        }

        return await stepContext.next();
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the child dialog interaction with a feedback.
     */
    private async finalStep(
        stepContext: WaterfallStepContext
    ): Promise<DialogTurnResult> {
        const feedbackCard = CardFactory.adaptiveCard(FeedbackCard);
        await stepContext.context.sendActivity({ attachments: [ feedbackCard ] });

        // Restart the main dialog waterfall with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, {
            restartMsg: 'What else can I do for you?',
        });
    }

    private validateConstructorParameters(
        stockResearchRecognizer: StockResearchRecognizer,
        getFundamentalDialog: GetFundamentalDialog
    ) {
        if (!stockResearchRecognizer) {
            throw new Error(
                '[MainDialog]: Missing parameter \'stockResearchRecognizer\' is required'
            );
        }
        this.stockResearchRecognizer = stockResearchRecognizer;

        if (!getFundamentalDialog)
            throw new Error(
                '[MainDialog]: Missing parameter \'getFundamentalDialog\' is required'
            );
    }

    private isWelcomeCardButtonAction(context: TurnContext): boolean {
        // TODO: expand other card actions
        return context.activity.type === 'message' && context.activity.text === IntentUtterance[Intent.GET_FUNDAMENTAL];
    }
}
