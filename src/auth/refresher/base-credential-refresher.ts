import { AuthCredential } from '../auth-credential';
import { AuthScheme } from '../auth-schemes';
import { experimental } from '../../utils/feature-decorator';

/**
 * Base exception for credential refresh errors.
 */
export class CredentialRefresherError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CredentialRefresherError';
    }
}

/**
 * Base interface for credential refreshers.
 * 
 * Credential refreshers are responsible for checking if a credential is expired
 * or needs to be refreshed, and for refreshing it if necessary.
 */
@experimental()
export abstract class BaseCredentialRefresher {
    /**
     * Checks if a credential needs to be refreshed.
     * 
     * @param authCredential The credential to check
     * @param authScheme The authentication scheme (optional, some refreshers don't need it)
     * @returns Promise resolving to true if the credential needs to be refreshed, false otherwise
     */
    abstract isRefreshNeeded(
        authCredential: AuthCredential,
        authScheme?: AuthScheme
    ): Promise<boolean>;

    /**
     * Refreshes a credential if needed.
     * 
     * @param authCredential The credential to refresh
     * @param authScheme The authentication scheme (optional, some refreshers don't need it)
     * @returns Promise resolving to the refreshed credential
     * @throws {CredentialRefresherError} If credential refresh fails
     */
    abstract refresh(
        authCredential: AuthCredential,
        authScheme?: AuthScheme
    ): Promise<AuthCredential>;
}