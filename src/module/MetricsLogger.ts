import { MemoryTranscriptStore, TranscriptStore, TurnContext } from 'botbuilder';
import { TranscriptMessage } from '../model/transcriptMessage';
import { Metric, MetricUser } from '../model/feedbackResponse';
import { logger } from '../util/logger';
import { Auth, google } from 'googleapis';
import { Stage } from '../model/stage';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { BETA_SERVER_SECRET_ARN, SERVER_SECRET, VEST_DEFAULT_REGION } from '../util/constant';
import { SecretsManagerUtil } from '../util/secrets-manager';
import { VestUtil } from '../util/vestUtil';

/**
 * Singleton class to manage transcript logging
 */
export class MetricsLogger {
    private static instance: MetricsLogger;
    private static transcriptStore: TranscriptStore;    // there can only be one per bot app
    private static sheetsClient: any;
    private static logMetrics: boolean;
    private static stage: Stage;

    private constructor() {
        // private constructor to prevent instantiation
    }

    public static async getInstance(): Promise<MetricsLogger> {
        if (!MetricsLogger.instance) {
            logger.debug('Initializing Metrics Logger');
            MetricsLogger.transcriptStore = new MemoryTranscriptStore();

            let sheetsApiServiceAccount;
            let sheetsApiPrivateKey;

            MetricsLogger.stage = VestUtil.enumFromStringValue(Stage, process.env.STAGE);
            // skip metrics logging in local and alpha environment
            MetricsLogger.logMetrics = !(!process.env.STAGE || MetricsLogger.stage == Stage.LOCAL || MetricsLogger.stage == Stage.ALPHA);

            if (MetricsLogger.logMetrics) {
                const client = new SecretsManagerClient({ region: VEST_DEFAULT_REGION });
                const secretMgr = new SecretsManagerUtil(client);

                const serverSecret = await secretMgr.getServerSecret(process.env.STAGE == Stage.ALPHA ? BETA_SERVER_SECRET_ARN : SERVER_SECRET);

                sheetsApiServiceAccount = serverSecret.SheetsApiServiceAccount;
                sheetsApiPrivateKey = serverSecret.SheetsApiPrivateKey;
                const authClient = new Auth.JWT({
                    email: sheetsApiServiceAccount,
                    key: sheetsApiPrivateKey,
                    scopes: [ 'https://www.googleapis.com/auth/spreadsheets' ],
                });

                MetricsLogger.sheetsClient = google.sheets({
                    version: 'v4',
                    auth: authClient,
                });
            }

            MetricsLogger.instance = new MetricsLogger();

            logger.debug('Successfully initializing Metrics Logger');
        }

        return MetricsLogger.instance;
    }

    public getTranscriptStore(): TranscriptStore {
        return MetricsLogger.transcriptStore;
    }

    /**
     * Log feedback response
     * @remark invoke this method asynchronously without await for better performance
     * @param context turn context
     */
    public async logFeedback(context: TurnContext): Promise<void> {
        logger.debug('Logging feedback');
        if (!MetricsLogger.logMetrics) {
            return;
        }

        const transcript = await this.getTranscript(context);
        await this.sendMetricToSheets({
            timestamp: Date.now(),
            metricUser: this.getMetricUserFromTranscript(transcript),
            feedbackResponse: context.activity.value,
            transcript: transcript
        } as Metric);
    }

    private async getTranscript(context: TurnContext): Promise<TranscriptMessage[]> {
        const transcriptStore = (await MetricsLogger.getInstance()).getTranscriptStore();

        const activityItems: any[] = [];

        let continuationToken = undefined;
        do {
            const activities = await transcriptStore.getTranscriptActivities(
                context.activity.channelId,
                context.activity.conversation.id,
                continuationToken
            );

            activities.items.forEach(activityItem => {
                activityItems.push(activityItem);
            });

            continuationToken = activities.continuationToken;
        } while (continuationToken !== undefined);

        // filter messages and shorten static adaptive cards
        return activityItems.reduce((filtered, activityItem) => {
            if (activityItem.type === 'message') {
                let text = activityItem.text;
                if (activityItem.attachments && activityItem.attachments.length > 0) {
                    const attachment = activityItem.attachments[0];
                    if (attachment.contentType === 'application/vnd.microsoft.card.adaptive' && attachment.content.id) {
                        text = attachment.content.id;
                    } else {
                        text = attachment.content;
                    }
                }

                filtered.push({
                    id: activityItem.id,
                    from: activityItem.from,
                    text: text,
                } as TranscriptMessage);
            }
            return filtered;
        }, []);
    }

    private getMetricUserFromTranscript(transcript: TranscriptMessage[]): MetricUser {
        let index = transcript.length - 1;
        while (index >= 0) {
            if (transcript[index].from.role === 'user') {
                return {
                    username: transcript[index].from.name,
                    userId: transcript[index].from.id
                };
            }
            index--;
        }
        logger.warn(transcript, 'Unable to find user info in transcript!');
        return undefined;
    }

    private async sendMetricToSheets(metric: Metric): Promise<void> {
        try {
            await MetricsLogger.sheetsClient.spreadsheets.values.append({
                // spreadsheetId: process.env.METRICS_SPREADSHEET_ID,
                spreadsheetId: '1UKmrvrJDEsppOUFzZm5T00SiYZLIIHbS61fGf5aa8ig',
                range: `${MetricsLogger.stage}!A1:F1`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [
                        [
                            metric.timestamp,
                            metric.feedbackResponse.feedback,
                            metric.feedbackResponse.feedbackInput,
                            metric.metricUser.username,
                            metric.metricUser.userId,
                            JSON.stringify(metric.transcript),
                        ]
                    ]
                }
            });

            logger.info(metric, 'Metrics sent');
        } catch (error) {
            logger.error(error, 'Error sending metric');
        }
    }
}
