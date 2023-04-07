// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    ActivityHandler,
    BotState,
    ConversationState,
    StatePropertyAccessor,
    TurnContext,
    UserState,
} from 'botbuilder';
import { Dialog, DialogState } from 'botbuilder-dialogs';
import { MainDialog } from '../dialogs/mainDialog';
import { AdaptiveCardInvokeResponse, AdaptiveCardInvokeValue } from "botframework-schema";

export class DialogBot extends ActivityHandler {
    private conversationState: BotState;
    private userState: BotState;
    private dialog: Dialog;
    private dialogState: StatePropertyAccessor<DialogState>;

    /**
     *
     * @param {BotState} conversationState
     * @param {BotState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState: BotState, userState: BotState, dialog: Dialog) {
        super();
        if (!conversationState) {
            throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        }
        if (!userState) {
            throw new Error('[DialogBot]: Missing parameter. userState is required');
        }
        if (!dialog) {
            throw new Error('[DialogBot]: Missing parameter. dialog is required');
        }

        this.conversationState = conversationState as ConversationState;
        this.userState = userState as UserState;
        this.dialog = dialog;
        this.dialogState = this.conversationState.createProperty<DialogState>('DialogState');

        // this.onTurn(async (context, next) => {
        //     // call onAdaptiveCardInvoke if the activity is an invoke activity
        //     if (context.activity.type === 'invoke') {
        //         console.debug('Current context for invoke activity is ', context);
        //         await this.onAdaptiveCardInvoke(
        //             context,
        //             context.activity as unknown as AdaptiveCardInvokeValue
        //         );
        //     }
        //
        //     await next();
        // });
        //
        // this.onEvent(async (context, next) => {
        //     console.debug('Current context is .', context);
        //
        //     // By calling next() you ensure that the next BotHandler is run.
        //     await next();
        //
        // });

        this.onMessage(async (context, next) => {
            console.log('Running dialog with Message Activity.');

            // console.debug('Current context is .', context);

            // Run the Dialog with the new message Activity.
            await (this.dialog as MainDialog).run(context, this.dialogState);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }

    protected onAdaptiveCardInvoke(
      context: TurnContext,
      invokeValue: AdaptiveCardInvokeValue
    ): Promise<AdaptiveCardInvokeResponse> {
        // console.debug('Current context is .', context);

        return Promise.resolve({
            "statusCode": 200,
            "type": "<string>",
            "value": {
                "message": "Hello World"
            }
        });
    }
}

