import { AuthCredential } from '../auth-credential';
import { AuthConfig } from '../auth-tool';
import { CallbackContext } from '../../agents/callback-context';
import { experimental } from '../../utils/feature-decorator';
import { BaseCredentialService } from './base-credential-service';

/**
 * Class for implementation of credential service using session state as the store.
 * 
 * Note: store credential in session may not be secure, use at your own risk.
 */
@experimental()
export class SessionStateCredentialService extends BaseCredentialService {

    /**
     * Loads the credential by auth config and current callback context from the
     * backend credential store.
     *
     * @param authConfig - The auth config which contains the auth scheme and auth
     * credential information. authConfig.getCredentialKey will be used to
     * build the key to load the credential.
     * 
     * @param callbackContext - The context of the current invocation when the tool is
     * trying to load the credential.
     *
     * @returns The credential saved in the store, or null if not found.
     */
    override async loadCredential(
        authConfig: AuthConfig,
        callbackContext: CallbackContext
    ): Promise<AuthCredential | null> {
        if (!authConfig.credentialKey) {
            return null;
        }

        return callbackContext.state.get(authConfig.credentialKey) || null;
    }

    /**
     * Saves the exchanged_auth_credential in auth config to the backend credential
     * store.
     *
     * @param authConfig - The auth config which contains the auth scheme and auth
     * credential information. authConfig.getCredentialKey will be used to
     * build the key to save the credential.
     * 
     * @param callbackContext - The context of the current invocation when the tool is
     * trying to save the credential.
     *
     * @returns Promise that resolves when the credential is saved.
     */
    override async saveCredential(
        authConfig: AuthConfig,
        callbackContext: CallbackContext
    ): Promise<void> {
        if (!authConfig.credentialKey || !authConfig.exchangedAuthCredential) {
            throw new Error('Cannot save credential: credentialKey and exchangedAuthCredential must be provided');
        }

        callbackContext.state[authConfig.credentialKey] = authConfig.exchangedAuthCredential;
    }
}
