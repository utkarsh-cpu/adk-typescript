import { AuthCredentialTypes } from '../auth-credential';
import { experimental } from '../../utils/feature-decorator';
import { BaseCredentialRefresher } from './base-credential-refresher';

/**
 * Registry for credential refresher instances.
 */
@experimental()
export class CredentialRefresherRegistry {
    private readonly _refreshers: Record<AuthCredentialTypes, BaseCredentialRefresher> = {} as Record<AuthCredentialTypes, BaseCredentialRefresher>;

    constructor() {
        // Initialize empty registry
    }

    /**
     * Register a refresher instance for a credential type.
     * 
     * @param credentialType The credential type to register for
     * @param refresherInstance The refresher instance to register
     */
    register(
        credentialType: AuthCredentialTypes,
        refresherInstance: BaseCredentialRefresher
    ): void {
        this._refreshers[credentialType] = refresherInstance;
    }

    /**
     * Get the refresher instance for a credential type.
     * 
     * @param credentialType The credential type to get refresher for
     * @returns The refresher instance if registered, undefined otherwise
     */
    getRefresher(credentialType: AuthCredentialTypes): BaseCredentialRefresher | undefined {
        return this._refreshers[credentialType];
    }

    /**
     * Check if a refresher is registered for a credential type.
     * 
     * @param credentialType The credential type to check
     * @returns True if a refresher is registered, false otherwise
     */
    hasRefresher(credentialType: AuthCredentialTypes): boolean {
        return credentialType in this._refreshers;
    }

    /**
     * Unregister a refresher for a credential type.
     * 
     * @param credentialType The credential type to unregister
     * @returns True if a refresher was removed, false if none was registered
     */
    unregister(credentialType: AuthCredentialTypes): boolean {
        if (credentialType in this._refreshers) {
            delete this._refreshers[credentialType];
            return true;
        }
        return false;
    }

    /**
     * Get all registered credential types.
     * 
     * @returns Array of registered credential types
     */
    getRegisteredTypes(): AuthCredentialTypes[] {
        return Object.keys(this._refreshers) as AuthCredentialTypes[];
    }

    /**
     * Clear all registered refreshers.
     */
    clear(): void {
        for (const key of Object.keys(this._refreshers)) {
            delete this._refreshers[key as AuthCredentialTypes];
        }
    }
}