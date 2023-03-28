// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TimexProperty } from '@microsoft/recognizers-text-data-types-timex-expression';
import { BookingDetails } from './bookingDetails';

import { InputHints, MessageFactory, StatePropertyAccessor, TurnContext } from 'botbuilder';
import { LuisRecognizer } from 'botbuilder-ai';

import {
    ComponentDialog,
    DialogSet,
    DialogState,
    DialogTurnResult,
    DialogTurnStatus,
    TextPrompt,
    WaterfallDialog,
    WaterfallStepContext
} from 'botbuilder-dialogs';
import { BookingDialog } from './bookingDialog';
import { FlightBookingRecognizer } from '../clu/flightBookingRecognizer';

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';

export class MainDialog extends ComponentDialog {
    private cluRecognizer: FlightBookingRecognizer;

    constructor(flightBookingRecognizer: FlightBookingRecognizer, bookingDialog: BookingDialog) {
        super('MainDialog');

        if (!flightBookingRecognizer) throw new Error('[MainDialog]: Missing parameter \'cluRecognizer\' is required');
        this.cluRecognizer = flightBookingRecognizer;

        if (!bookingDialog) throw new Error('[MainDialog]: Missing parameter \'bookingDialog\' is required');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(bookingDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.actStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a DialogContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     *
     * @param {TurnContext} context
     */
    async run(context: TurnContext, accessor: StatePropertyAccessor<DialogState>) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(context);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }

    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     * Currently, this expects a booking request, like "book me a flight from Paris to Berlin on march 22"
     * Note that the sample LUIS model will only recognize Paris, Berlin, New York and London as airport cities.
     */
    private async introStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        if (!this.cluRecognizer.isConfigured) {
            const cluConfigMsg = 'NOTE: CLU is not configured.';
            await stepContext.context.sendActivity(cluConfigMsg, null, InputHints.IgnoringInput);
            return await stepContext.next();
        }

        const messageText = (stepContext.options as any).restartMsg ? (stepContext.options as any).restartMsg : 'What can I help you with today?\nSay something like "Book a flight from Paris to Berlin on March 22, 2020"';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }

    /**
     * Second step in the waterall.  This will use CLU to attempt to extract the origin, destination and travel dates.
     * Then, it hands off to the bookingDialog child dialog to collect any remaining details.
     */
    private async actStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        const bookingDetails = new BookingDetails();

        if (!this.cluRecognizer.isConfigured) {
            // CLU is not configured, we just run the BookingDialog path.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);
        }

        // Call CLU and gather any potential booking details. (Note the TurnContext has the response to the prompt)
        const cluResult = await this.cluRecognizer.executeCluQuery(stepContext.context);
        switch (this.cluRecognizer.topIntent(cluResult)) {
        case 'BookFlight':
            // Extract the values for the composite entities from the LUIS result.
            const fromEntities = this.cluRecognizer.getFromEntities(cluResult);
            const toEntities = this.cluRecognizer.getToEntities(cluResult);

            // Show a warning for Origin and Destination if we can't resolve them.
            await this.showWarningForUnsupportedCities(stepContext.context, fromEntities, toEntities);

            // Initialize BookingDetails with any entities we may have found in the response.
            bookingDetails.destination = toEntities.airport;
            bookingDetails.origin = fromEntities.airport;
            bookingDetails.travelDate = this.cluRecognizer.getTravelDate(cluResult);
            console.log('LUIS extracted these booking details:', JSON.stringify(bookingDetails));

            // Run the BookingDialog passing in whatever details we have from the LUIS call, it will fill out the remainder.
            return await stepContext.beginDialog('bookingDialog', bookingDetails);

        case 'GetWeather':
            // We haven't implemented the GetWeatherDialog so we just display a TODO message.
            const getWeatherMessageText = 'TODO: get weather flow here';
            await stepContext.context.sendActivity(getWeatherMessageText, getWeatherMessageText, InputHints.IgnoringInput);
            break;

        default:
            // Catch all for unhandled intents
            const didntUnderstandMessageText = `Sorry, I didn't get that. Please try asking in a different way (intent was ${ this.cluRecognizer.topIntent(cluResult) })`;
            await stepContext.context.sendActivity(didntUnderstandMessageText, didntUnderstandMessageText, InputHints.IgnoringInput);
        }

        return await stepContext.next();
    }

    /**
     * Shows a warning if the requested From or To cities are recognized as entities but they are not in the Airport entity list.
     * In some cases LUIS will recognize the From and To composite entities as a valid cities but the From and To Airport values
     * will be empty if those entity values can't be mapped to a canonical item in the Airport.
     */
    private async showWarningForUnsupportedCities(context, fromEntities, toEntities) {
        const unsupportedCities = [];
        if (fromEntities.from && !fromEntities.airport) {
            unsupportedCities.push(fromEntities.from);
        }

        if (toEntities.to && !toEntities.airport) {
            unsupportedCities.push(toEntities.to);
        }

        if (unsupportedCities.length) {
            const messageText = `Sorry but the following airports are not supported: ${ unsupportedCities.join(', ') }`;
            await context.sendActivity(messageText, messageText, InputHints.IgnoringInput);
        }
    }

    /**
     * This is the final step in the main waterfall dialog.
     * It wraps up the sample "book a flight" interaction with a simple confirmation.
     */
    private async finalStep(stepContext: WaterfallStepContext): Promise<DialogTurnResult> {
        // If the child dialog ("bookingDialog") was cancelled or the user failed to confirm, the Result here will be null.
        if (stepContext.result) {
            const result = stepContext.result as BookingDetails;
            // Now we have all the booking details.

            // This is where calls to the booking AOU service or database would go.

            // If the call to the booking service was successful tell the user.
            const timeProperty = new TimexProperty(result.travelDate);
            const travelDateMsg = timeProperty.toNaturalLanguage(new Date(Date.now()));
            const msg = `I have you booked to ${ result.destination } from ${ result.origin } on ${ travelDateMsg }.`;
            await stepContext.context.sendActivity(msg);
        }

        // Restart the main dialog waterfall with a different message the second time around
        return await stepContext.replaceDialog(this.initialDialogId, { restartMsg: 'What else can I do for you?' });
    }
}
