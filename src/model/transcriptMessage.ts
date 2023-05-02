export interface TranscriptMessage {
    id: string;
    from: From;
    text: string;
}

export interface From {
    id: string;
    name: string;
    role: string;
}
