import {
    GetSecretValueCommand,
    ResourceNotFoundException,
    SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

import { ResourceNotFoundError } from '../error/ResourceNotFoundError';
import { InternalError } from '../error/InternalError';
import { ServerSecret } from '../model/secret';

export class SecretsManagerUtil {
    public constructor(private readonly client: SecretsManagerClient) {
    }

    /**
     * Retrieves the contents of the specified secret either as a string or as a
     *
     * @param secretName The name or arn of the secret
     * @throws {ResourceNotFoundError} when secret is not found
     * @throws {InternalError} unknown issue occur
     */
    public async getServerSecret(secretName: string): Promise<ServerSecret> {
        try {
            const secret: ServerSecret = JSON.parse(
                await this.getSecretString(secretName)
            );

            if (this.hasNullKey(secret)) {
                throw new ResourceNotFoundError(
                    `The retrieved server secret is incomplete: ${secret}`
                );
            }

            return secret;
        } catch (error) {
            if (error instanceof ResourceNotFoundError) {
                throw error;
            }

            console.error(
                `Error occurred in getServerSecret() for ${secretName}`,
                error
            );

            throw new InternalError(
                `Error occurred in getServerSecret() for ${secretName}`
            );
        }
    }

    /**
     * Retrieve the secret string from AWS Secrets Manager
     *
     * @throws {ResourceNotFoundError} when secret is not found
     * @throws {InternalError} unknown issue occur
     * @param secretKey
     */
    public async getSecretString(secretKey: string): Promise<string> {
        try {
            const res = await this.client.send(
                new GetSecretValueCommand({
                    SecretId: secretKey,
                })
            );

            return res.SecretString as string;
        } catch (error) {
            if (error instanceof ResourceNotFoundException) {
                throw new ResourceNotFoundError(`${secretKey} not found`);
            }

            // Jest seem to swallow stack trace
            console.error(error);

            throw new InternalError(`Error occurred in getSecretString(${secretKey})`);
        }
    }

    private hasNullKey<T>(obj: T): boolean {
        for (const key in obj) {
            if (obj[key] === null || obj[key] === undefined) {
                return true;
            }
        }
        return false;
    }

}
