export interface ServerSecret {
    CluAPIKey: string;
    CluAPIHostName: string;
    CluProjectName: string;
    CluDeploymentName: string;
    EODHistoricalDataAPIKey: string;
    MicrosoftAppType: string;
    MicrosoftAppId: string;
    MicrosoftAppTenantId: string;
    MicrosoftAppPassword: string;
    OpenAiApiKey: string;
    // metrics logging disabled in alpha environment
    SheetsApiServiceAccount?: string;
    SheetsApiPrivateKey?: string;
}
