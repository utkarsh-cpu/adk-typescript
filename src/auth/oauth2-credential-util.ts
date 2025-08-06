import { OAuth2Client } from '@badgateway/oauth2-client';
import { OAuth2, isOAuth2 } from './openapi_models';
import { AuthCredential } from './auth-credential';
import { AuthScheme, OpenIdConnectWithConfig } from './auth-schemes';
import { experimental } from '@/utils';
// Logger setup
const logger = {
    warning: (message: string) => console.warn(`[OAuth2Util] ${message}`),
    debug: (message: string) => console.debug(`[OAuth2Util] ${message}`),
    error: (message: string, error?: any) => console.error(`[OAuth2Util] ${message}`, error),
};

// Check OAuth2 library availability
let OAUTH2_AVAILABLE = true;
try {
    if (!OAuth2Client) {
        OAUTH2_AVAILABLE = false;
    }
} catch (error) {
    OAUTH2_AVAILABLE = false;
}

/**
 * OAuth2 token interface matching authlib's OAuth2Token structure
 */
interface OAuth2Token {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    [key: string]: any;
}

/**
 * Result type for OAuth2 session creation
 */
interface OAuth2SessionResult {
    client: OAuth2Client | null;
    tokenEndpoint: string | null;
}

/**
 * Create an OAuth2 session for token operations.
 *
 * @param authScheme - The authentication scheme configuration.
 * @param authCredential - The authentication credential.
 * @returns Object containing OAuth2Client and token endpoint, or null values if cannot create session.
 */
function _createOAuth2Session(
    authScheme: AuthScheme,
    authCredential: AuthCredential
): OAuth2SessionResult {
    let tokenEndpoint: string | null = null;
    let authorizationEndpoint: string | null = null;
    let scopes: string[] = [];

    // Handle OpenIdConnectWithConfig
    if (authScheme instanceof OpenIdConnectWithConfig) {
        if (!('tokenEndpoint' in authScheme)) {
            return { client: null, tokenEndpoint: null };
        }
        tokenEndpoint = authScheme.tokenEndpoint;
        authorizationEndpoint = authScheme.authorizationEndpoint || null;
        scopes = authScheme.scopes || [];
    }
    // Handle OAuth2 scheme
    else if (isOAuth2(authScheme)) {
        if (
            !authScheme.flows?.authorizationCode ||
            !authScheme.flows.authorizationCode.tokenUrl
        ) {
            return { client: null, tokenEndpoint: null };
        }
        tokenEndpoint = authScheme.flows.authorizationCode.tokenUrl;
        authorizationEndpoint = authScheme.flows.authorizationCode.authorizationUrl || null;
        scopes = authScheme.flows.authorizationCode.scopes
            ? Object.keys(authScheme.flows.authorizationCode.scopes)
            : [];
    } else {
        return { client: null, tokenEndpoint: null };
    }

    // Validate auth credential
    if (
        !authCredential ||
        !authCredential.oauth2 ||
        !authCredential.oauth2.clientId ||
        !authCredential.oauth2.clientSecret
    ) {
        return { client: null, tokenEndpoint: null };
    }

    try {
        const client = new OAuth2Client({
            clientId: authCredential.oauth2.clientId,
            clientSecret: authCredential.oauth2.clientSecret,
            tokenEndpoint,
            authorizationEndpoint: authorizationEndpoint || undefined,
        });

        return { client, tokenEndpoint };
    } catch (error) {
        logger.error('Failed to create OAuth2 session:', error);
        return { client: null, tokenEndpoint: null };
    }
}

// Export the experimental wrapped version
export const createOAuth2Session = experimental()(_createOAuth2Session);

/**
 * Create an OAuth2 session for token operations (alternative implementation returning tuple-like array).
 *
 * @param authScheme - The authentication scheme configuration.
 * @param authCredential - The authentication credential.
 * @returns Tuple-like array of [OAuth2Client, token_endpoint] or [null, null] if cannot create session.
 */
export function createOAuth2SessionTuple(
    authScheme: AuthScheme,
    authCredential: AuthCredential
): [OAuth2Client | null, string | null] {
    const result = createOAuth2Session(authScheme, authCredential);
    return [result.client, result.tokenEndpoint];
}

/**
 * Update the credential with new tokens.
 *
 * @param authCredential - The authentication credential to update.
 * @param tokens - The OAuth2Token object containing new token information.
 */
function _updateCredentialWithTokens(
    authCredential: AuthCredential,
    tokens: OAuth2Token
): void {
    if (!authCredential.oauth2) {
        // Initialize oauth2 object if it doesn't exist
        authCredential.oauth2 = {} as any;
    }

    // Update access token
    authCredential.oauth2!.accessToken = tokens.access_token || null;

    // Update refresh token
    authCredential.oauth2!.refreshToken = tokens.refresh_token || null;

    // Update expires_at (convert to timestamp if provided)
    if (tokens.expires_at) {
        authCredential.oauth2!.expiresAt = typeof tokens.expires_at === 'number'
            ? new Date(tokens.expires_at * 1000).getTime() // Convert Unix timestamp to milliseconds
            : new Date(tokens.expires_at).getTime();
    } else {
        authCredential.oauth2!.expiresAt = null;
    }

    // Update expires_in (keep as number)
    authCredential.oauth2!.expiresIn = tokens.expires_in
        ? parseInt(tokens.expires_in.toString(), 10)
        : null;

    // Update token type
    authCredential.oauth2!.tokenType = tokens.token_type || 'Bearer';

    // Update scope
    authCredential.oauth2!.scope = tokens.scope || null;
}

// Export the experimental wrapped version
export const updateCredentialWithTokens = experimental()(_updateCredentialWithTokens);

/**
 * Enhanced token update function with additional OAuth2 token properties.
 *
 * @param authCredential - The authentication credential to update.
 * @param tokens - The token response object.
 */
export function updateCredentialWithEnhancedTokens(
    authCredential: AuthCredential,
    tokens: any
): void {
    if (!authCredential.oauth2) {
        authCredential.oauth2 = {} as any;
    }

    // Handle both camelCase (modern) and snake_case (legacy) property names
    authCredential.oauth2!.accessToken = tokens.accessToken || tokens.access_token || null;
    authCredential.oauth2!.refreshToken = tokens.refreshToken || tokens.refresh_token || null;
    authCredential.oauth2!.tokenType = tokens.tokenType || tokens.token_type || 'Bearer';
    authCredential.oauth2!.scope = tokens.scope || null;

    // Handle expiration times
    if (tokens.expiresAt || tokens.expires_at) {
        const expirationTime = tokens.expiresAt || tokens.expires_at;
        authCredential.oauth2!.expiresAt = expirationTime instanceof Date
            ? expirationTime.getTime()
            : new Date(expirationTime).getTime();
    }

    if (tokens.expiresIn || tokens.expires_in) {
        const expiresIn = tokens.expiresIn || tokens.expires_in;
        authCredential.oauth2!.expiresIn = typeof expiresIn === 'number'
            ? expiresIn
            : parseInt(expiresIn.toString(), 10);

        // Also set expiresAt based on expiresIn if not already set
        if (!authCredential.oauth2!.expiresAt) {
            authCredential.oauth2!.expiresAt = new Date(Date.now() + authCredential.oauth2!.expiresIn! * 1000).getTime();
        }
    }

    // Handle ID token (for OpenID Connect)
    if (tokens.idToken || tokens.id_token) {
        authCredential.oauth2!.idToken = tokens.idToken || tokens.id_token;
    }
}

/**
 * Utility function to check if the current token is expired or about to expire.
 *
 * @param authCredential - The authentication credential to check.
 * @param bufferSeconds - Buffer time in seconds before actual expiration (default: 300 = 5 minutes).
 * @returns True if token is expired or about to expire.
 */
export function isTokenExpired(
    authCredential: AuthCredential,
    bufferSeconds: number = 300
): boolean {
    if (!authCredential.oauth2?.expiresAt) {
        return false; // If no expiration time, assume it's valid
    }

    const expirationTime = new Date(authCredential.oauth2.expiresAt);

    const bufferTime = bufferSeconds * 1000; // Convert to milliseconds
    return (expirationTime.getTime() - bufferTime) <= Date.now();
}

/**
 * Utility function to get the scope array from a space-separated scope string.
 *
 * @param scopeString - Space-separated scope string.
 * @returns Array of individual scopes.
 */
export function parseScopeString(scopeString: string): string[] {
    return scopeString ? scopeString.split(' ').filter(scope => scope.trim() !== '') : [];
}

/**
 * Utility function to join scope array into a space-separated string.
 *
 * @param scopes - Array of scopes.
 * @returns Space-separated scope string.
 */
export function joinScopes(scopes: string[]): string {
    return scopes.join(' ');
}
