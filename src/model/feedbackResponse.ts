import { TranscriptMessage } from './transcriptMessage';

export enum Feedback {
    POSITIVE = 'POSITIVE',
    NEGATIVE = 'NEGATIVE',
}

export interface FeedbackResponse {
    feedback: Feedback;
    feedbackInput?: string;
}

export interface MetricUser {
    username: string;
    userId: string;
}

export interface Metric {
    timestamp: number;  // Unix timestamp in milliseconds
    metricUser: MetricUser;
    feedbackResponse: FeedbackResponse;
    transcript: TranscriptMessage[];
}
