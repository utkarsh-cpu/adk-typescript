import { AuthCredential } from '../auth-credential';
import { AuthConfig } from '../auth-tool';
import { CallbackContext } from '../../agents/callback-context';
import { experimental } from '../../utils/feature-decorator';
import { BaseCredentialService } from './base-credential-service';

/**
 * Class for in memory implementation of credential service (Experimental)
 */
@experimental()
export class InMemoryCredentialService extends BaseCredentialService {
    private readonly _credentials: Record<string, Record<string, Record<string, AuthCredential>>>;

    constructor() {
        super();
        this._credentials = {};
    }

    override async loadCredential(
        authConfig: AuthConfig,
        callbackContext: CallbackContext
    ): Promise<AuthCredential | null> {
        if (!authConfig.credentialKey) {
            return null;
        }

        const credentialBucket = this._getBucketForCurrentContext(callbackContext);
        return credentialBucket[authConfig.credentialKey] || null;
    }

    override async saveCredential(
        authConfig: AuthConfig,
        callbackContext: CallbackContext
    ): Promise<void> {
        if (!authConfig.credentialKey || !authConfig.exchangedAuthCredential) {
            throw new Error('Cannot save credential: credentialKey and exchangedAuthCredential must be provided');
        }

        const credentialBucket = this._getBucketForCurrentContext(callbackContext);
        credentialBucket[authConfig.credentialKey] = authConfig.exchangedAuthCredential;
    }

    private _getBucketForCurrentContext(
        callbackContext: CallbackContext
    ): Record<string, AuthCredential> {
        const appName = callbackContext._invocationContext.appName;
        const userId = callbackContext._invocationContext.userId;

        if (!this._credentials[appName]) {
            this._credentials[appName] = {};
        }
        if (!this._credentials[appName][userId]) {
            this._credentials[appName][userId] = {};
        }
        return this._credentials[appName][userId];
    }
}
