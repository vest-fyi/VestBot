// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
    ActivityHandler,
    BotState, CardFactory,
    ConversationState,
    StatePropertyAccessor,
    UserState,
    TurnContext
} from 'botbuilder';
import { DialogState } from 'botbuilder-dialogs';
import { MainDialog } from '../dialogs/mainDialog';
import * as WelcomeCard from '../resources/welcomeCard.json';
import { MetricsLogger } from '../module/MetricsLogger';
import { Attachment } from 'botframework-schema';
import { Stage } from '../model/stage';

export class DialogBot extends ActivityHandler {
    private conversationState: BotState;
    private userState: BotState;
    private dialog: MainDialog;
    private readonly dialogState: StatePropertyAccessor<DialogState>;

    /**
     *
     * @param {BotState} conversationState
     * @param {BotState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState: BotState, userState: BotState, dialog: MainDialog) {
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

        this.onMessage(async (context, next) => {
            if (this.isFeedbackResponse(context)) {
                // no await for non-blocking logging
                (await MetricsLogger.getInstance()).logFeedback(context);
                await context.sendActivity(`Thank you for your feedback! We review your feedback carefully and constantly use it to drive Vest forward.`);
            }

            // Run the Dialog with the new message Activity.
            await this.dialog.run(context, this.dialogState);

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

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (const member of membersAdded) {
                if (member.id !== context.activity.recipient.id) {
                    const welcomeCard = this.updateWelcomeCardImageUrl(CardFactory.adaptiveCard(WelcomeCard));
                    await context.sendActivity({ attachments: [ welcomeCard ] });

                    await dialog.run(
                        context,
                        conversationState.createProperty<DialogState>(
                            'DialogState'
                        )
                    );
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

    }

    private isFeedbackResponse(context: TurnContext): boolean {
        return context.activity.value && Object.prototype.hasOwnProperty.call(context.activity.value, 'feedback');
    }

    private updateWelcomeCardImageUrl(card: Attachment): Attachment {
        const stage = process.env.STAGE;
        if (stage !== Stage.ALPHA) {
            card.content.body[0].url = `https://static.bot.${process.env.STAGE}.us-west-2.api.vest.fyi.xx.vest.fyi/vest-icon.png`;
        }

        return card;
    }

}

