import { AuthCredential } from '../auth-credential';
import { AuthScheme } from '../auth-schemes';
import { createOAuth2SessionTuple, updateCredentialWithTokens, isTokenExpired } from '../oauth2-credential-util';
import { experimental } from '../../utils/feature-decorator';
import { BaseCredentialRefresher, CredentialRefresherError } from './base-credential-refresher';

// Logger placeholder - in a real implementation, use a proper logging library
const logger = {
    warning: (message: string) => console.warn(`[OAuth2CredentialRefresher] ${message}`),
    debug: (message: string) => console.debug(`[OAuth2CredentialRefresher] ${message}`),
    error: (message: string, error?: any) => console.error(`[OAuth2CredentialRefresher] ${message}`, error),
};

// Check OAuth2 library availability
let OAUTH2_AVAILABLE = true;
try {
    // Check if OAuth2Client is available
    const { OAuth2Client } = require('@badgateway/oauth2-client');
    if (!OAuth2Client) {
        OAUTH2_AVAILABLE = false;
    }
} catch (error) {
    OAUTH2_AVAILABLE = false;
}

/**
 * OAuth2 token interface for checking expiration
 */
interface OAuth2TokenInfo {
    expires_at?: number | null;
    expires_in?: number | null;
}

/**
 * Simple OAuth2 token class for expiration checking
 */
class OAuth2Token {
    private tokenInfo: OAuth2TokenInfo;

    constructor(tokenInfo: OAuth2TokenInfo) {
        this.tokenInfo = tokenInfo;
    }

    /**
     * Check if the token is expired
     * @returns True if token is expired, false otherwise
     */
    isExpired(): boolean {
        const { expires_at, expires_in } = this.tokenInfo;

        if (expires_at) {
            // expires_at is typically a Unix timestamp
            const expirationTime = typeof expires_at === 'number'
                ? expires_at * 1000 // Convert to milliseconds
                : new Date(expires_at).getTime();
            return Date.now() >= expirationTime;
        }

        if (expires_in) {
            // If we only have expires_in, we can't determine expiration without knowing when it was issued
            // For safety, assume it needs refresh
            return true;
        }

        // If no expiration info, assume it's not expired
        return false;
    }
}

/**
 * Refreshes OAuth2 credentials including Google OAuth2 JSON credentials.
 */
@experimental()
export class OAuth2CredentialRefresher extends BaseCredentialRefresher {
    /**
     * Check if the OAuth2 credential needs to be refreshed.
     * 
     * @param authCredential The OAuth2 credential to check
     * @param authScheme The OAuth2 authentication scheme (optional for Google OAuth2 JSON)
     * @returns Promise resolving to true if the credential needs to be refreshed, false otherwise
     */
    async isRefreshNeeded(
        authCredential: AuthCredential,
        authScheme?: AuthScheme
    ): Promise<boolean> {
        // Handle regular OAuth2 credentials
        if (authCredential.oauth2) {
            if (!OAUTH2_AVAILABLE) {
                return false;
            }

            const token = new OAuth2Token({
                expires_at: authCredential.oauth2.expiresAt,
                expires_in: authCredential.oauth2.expiresIn
            });

            return token.isExpired();
        }

        return false;
    }

    /**
     * Refresh the OAuth2 credential.
     * If refresh failed, return the original credential.
     * 
     * @param authCredential The OAuth2 credential to refresh
     * @param authScheme The OAuth2 authentication scheme (optional for Google OAuth2 JSON)
     * @returns Promise resolving to the refreshed credential
     */
    async refresh(
        authCredential: AuthCredential,
        authScheme?: AuthScheme
    ): Promise<AuthCredential> {
        // Handle regular OAuth2 credentials
        if (authCredential.oauth2 && authScheme) {
            if (!OAUTH2_AVAILABLE) {
                return authCredential;
            }

            if (!authCredential.oauth2) {
                return authCredential;
            }

            const token = new OAuth2Token({
                expires_at: authCredential.oauth2.expiresAt,
                expires_in: authCredential.oauth2.expiresIn
            });

            if (token.isExpired()) {
                const [client, tokenEndpoint] = createOAuth2SessionTuple(authScheme, authCredential);

                if (!client || !tokenEndpoint) {
                    logger.warning('Could not create OAuth2 session for token refresh');
                    return authCredential;
                }

                try {
                    if (!authCredential.oauth2.refreshToken) {
                        logger.warning('No refresh token available for OAuth2 credential refresh');
                        return authCredential;
                    }

                    // Refresh the token using the OAuth2 client
                    const tokenResponse = await client.refreshToken({
                        accessToken: authCredential.oauth2.accessToken || '',
                        refreshToken: authCredential.oauth2.refreshToken,
                        expiresAt: authCredential.oauth2.expiresAt || Date.now()
                    });

                    // Convert the token response to the expected format
                    const tokens = {
                        access_token: tokenResponse.accessToken,
                        refresh_token: tokenResponse.refreshToken || undefined,
                        expires_at: tokenResponse.expiresAt ? Math.floor(tokenResponse.expiresAt / 1000) : undefined,
                        token_type: 'Bearer'
                    };

                    if (typeof updateCredentialWithTokens === 'function') {
                        updateCredentialWithTokens(authCredential, tokens);
                    } else {
                        // Fallback: manually update the credential
                        if (authCredential.oauth2) {
                            authCredential.oauth2.accessToken = tokens.access_token || null;
                            authCredential.oauth2.refreshToken = tokens.refresh_token || null;
                            authCredential.oauth2.expiresAt = tokens.expires_at ? tokens.expires_at * 1000 : null;
                            authCredential.oauth2.tokenType = tokens.token_type || 'Bearer';
                        }
                    }
                    logger.debug('Successfully refreshed OAuth2 tokens');
                } catch (error) {
                    // TODO: reconsider whether we should raise error when refresh failed.
                    logger.error('Failed to refresh OAuth2 tokens:', error);
                    // Return original credential on failure
                    return authCredential;
                }
            }
        }

        return authCredential;
    }

    /**
     * Alternative refresh method using the utility function for token expiration checking
     * 
     * @param authCredential The OAuth2 credential to refresh
     * @param authScheme The OAuth2 authentication scheme
     * @param bufferSeconds Buffer time in seconds before actual expiration (default: 300 = 5 minutes)
     * @returns Promise resolving to the refreshed credential
     */
    async refreshWithBuffer(
        authCredential: AuthCredential,
        authScheme: AuthScheme,
        bufferSeconds: number = 300
    ): Promise<AuthCredential> {
        if (!authCredential.oauth2) {
            return authCredential;
        }

        if (isTokenExpired(authCredential, bufferSeconds)) {
            return await this.refresh(authCredential, authScheme);
        }

        return authCredential;
    }
}