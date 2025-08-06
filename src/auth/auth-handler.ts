import { OAuth2Client } from '@badgateway/oauth2-client';
import { AuthCredential } from './auth-credential';
import { OpenIdConnectWithConfig } from './auth-schemes';
import { SecuritySchemeType, SecurityBase } from './openapi_models';
import { AuthConfig } from './auth-tool';
import { OAuth2CredentialExchanger } from './exchanger/oauth2-credential-exchanger';

// Type-only import equivalent
import type { State } from '../sessions/state';

// OAuth2 availability check
let OAUTH2_AVAILABLE = true;
try {
    // Check if the OAuth2Client is available
    if (!OAuth2Client) {
        OAUTH2_AVAILABLE = false;
    }
} catch (error) {
    OAUTH2_AVAILABLE = false;
}

interface AuthUriResult {
    uri: string;
    state: string;
}

export class AuthHandler {
    /**
     * A handler that handles the auth flow in Agent Development Kit to help
     * orchestrate the credential request and response flow (e.g. OAuth flow)
     * This class should only be used by Agent Development Kit.
     */

    private authConfig: AuthConfig;

    constructor(authConfig: AuthConfig) {
        this.authConfig = authConfig;
    }

    async exchangeAuthToken(): Promise<AuthCredential> {
        if (!this.authConfig.exchangedAuthCredential) {
            throw new Error('No exchanged auth credential available for token exchange');
        }

        const exchanger = new OAuth2CredentialExchanger();
        return await exchanger.exchange(
            this.authConfig.exchangedAuthCredential,
            this.authConfig.authScheme
        );
    }

    async parseAndStoreAuthResponse(state: State): Promise<void> {
        const credentialKey = `temp:${this.authConfig.credentialKey}`;

        state[credentialKey] = this.authConfig.exchangedAuthCredential;

        if (
            !this.authConfig.authScheme ||
            ![SecuritySchemeType.oauth2, SecuritySchemeType.openIdConnect].includes(
                this.authConfig.authScheme.type
            )
        ) {
            return;
        }

        state[credentialKey] = await this.exchangeAuthToken();
    }

    private validate(): void {
        if (!this.authConfig.authScheme) {
            throw new Error('auth_scheme is empty.');
        }
    }

    getAuthResponse(state: State): AuthCredential | null {
        const credentialKey = `temp:${this.authConfig.credentialKey}`;
        return state[credentialKey] || null;
    }

    async generateAuthRequest(): Promise<AuthConfig> {
        if (
            !this.authConfig.authScheme ||
            ![SecuritySchemeType.oauth2, SecuritySchemeType.openIdConnect].includes(
                this.authConfig.authScheme.type
            )
        ) {
            return this.deepCopy(this.authConfig);
        }

        // auth_uri already in exchanged credential
        if (
            this.authConfig.exchangedAuthCredential &&
            this.authConfig.exchangedAuthCredential.oauth2 &&
            this.authConfig.exchangedAuthCredential.oauth2.authUri
        ) {
            return this.deepCopy(this.authConfig);
        }

        // Check if raw_auth_credential exists
        if (!this.authConfig.rawAuthCredential) {
            throw new Error(
                `Auth Scheme ${this.authConfig.authScheme.type} requires auth_credential.`
            );
        }

        // Check if oauth2 exists in raw_auth_credential
        if (!this.authConfig.rawAuthCredential.oauth2) {
            throw new Error(
                `Auth Scheme ${this.authConfig.authScheme.type} requires oauth2 in auth_credential.`
            );
        }

        // auth_uri in raw credential
        if (this.authConfig.rawAuthCredential.oauth2.authUri) {
            return new AuthConfig({
                authScheme: this.authConfig.authScheme,
                rawAuthCredential: this.authConfig.rawAuthCredential,
                exchangedAuthCredential: this.deepCopy(this.authConfig.rawAuthCredential),
            });
        }

        // Check for client_id and client_secret
        if (
            !this.authConfig.rawAuthCredential.oauth2.clientId ||
            !this.authConfig.rawAuthCredential.oauth2.clientSecret
        ) {
            throw new Error(
                `Auth Scheme ${this.authConfig.authScheme.type} requires both client_id and client_secret in auth_credential.oauth2.`
            );
        }

        // Generate new auth URI
        const exchangedCredential = await this.generateAuthUri();
        return new AuthConfig({
            authScheme: this.authConfig.authScheme,
            rawAuthCredential: this.authConfig.rawAuthCredential,
            exchangedAuthCredential: exchangedCredential,
        });
    }

    async generateAuthUri(): Promise<AuthCredential | null> {
        /**
         * Generates a response containing the auth uri for user to sign in.
         *
         * Returns:
         *     An AuthCredential object containing the auth URI and state.
         *
         * Throws:
         *     Error: If the authorization endpoint is not configured in the auth scheme.
         */
        if (!OAUTH2_AVAILABLE) {
            return this.authConfig.rawAuthCredential
                ? this.deepCopy(this.authConfig.rawAuthCredential)
                : null;
        }

        const authScheme = this.authConfig.authScheme;
        const authCredential = this.authConfig.rawAuthCredential;

        if (!authCredential) {
            throw new Error('Raw auth credential is required for generating auth URI');
        }

        if (!authCredential.oauth2) {
            throw new Error('OAuth2 configuration is required in auth credential');
        }

        let authorizationEndpoint: string;
        let tokenEndpoint: string;
        let scopes: string[];

        if (authScheme instanceof OpenIdConnectWithConfig) {
            authorizationEndpoint = authScheme.authorizationEndpoint;
            scopes = authScheme.scopes || [];
            // Assuming tokenEndpoint is also available in OpenIdConnectWithConfig
            tokenEndpoint = authScheme.tokenEndpoint || '';
        } else {
            authorizationEndpoint =
                (authScheme.flows.implicit?.authorizationUrl) ||
                (authScheme.flows.authorizationCode?.authorizationUrl) ||
                (authScheme.flows.clientCredentials?.tokenUrl) ||
                (authScheme.flows.password?.tokenUrl) ||
                '';

            tokenEndpoint =
                (authScheme.flows.authorizationCode?.tokenUrl) ||
                (authScheme.flows.clientCredentials?.tokenUrl) ||
                (authScheme.flows.password?.tokenUrl) ||
                '';

            const scopesObj =
                authScheme.flows.implicit?.scopes ||
                authScheme.flows.authorizationCode?.scopes ||
                authScheme.flows.clientCredentials?.scopes ||
                authScheme.flows.password?.scopes ||
                {};

            scopes = Object.keys(scopesObj);
        }

        // Create OAuth2Client instance
        const client = new OAuth2Client({
            clientId: authCredential.oauth2.clientId || '',
            clientSecret: authCredential.oauth2.clientSecret || '',
            authorizationEndpoint,
            tokenEndpoint,
        });

        // Generate authorization URL with state
        const state = this.generateRandomState();
        const codeChallenge = this.generateCodeChallenge(); // For PKCE support

        const authorizationUrl = await client.authorizationCode.getAuthorizeUri({
            redirectUri: authCredential.oauth2.redirectUri || '',
            scope: scopes,
            state,
            // Include PKCE parameters if supported
            extraParams: {
                accessType: 'offline',
                prompt: 'consent',
                codeChallenge,
                codeChallengeMethod: 'S256',
            }
        });

        const exchangedAuthCredential = this.deepCopy(authCredential);

        if (!exchangedAuthCredential.oauth2) {
            throw new Error('OAuth2 configuration missing in exchanged credential');
        }

        exchangedAuthCredential.oauth2.authUri = authorizationUrl;
        exchangedAuthCredential.oauth2.state = state;

        return exchangedAuthCredential;
    }

    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code: string, state: string): Promise<AuthCredential> {
        if (!OAUTH2_AVAILABLE) {
            throw new Error('OAuth2 library not available');
        }

        const authScheme = this.authConfig.authScheme;
        const authCredential = this.authConfig.rawAuthCredential;

        if (!authCredential) {
            throw new Error('Raw auth credential is required for exchanging code for tokens');
        }

        if (!authCredential.oauth2) {
            throw new Error('OAuth2 configuration is required in auth credential');
        }

        let tokenEndpoint: string;

        if (authScheme instanceof OpenIdConnectWithConfig) {
            tokenEndpoint = authScheme.tokenEndpoint || '';
        } else {
            tokenEndpoint =
                (authScheme.flows.authorizationCode?.tokenUrl) ||
                (authScheme.flows.clientCredentials?.tokenUrl) ||
                '';
        }

        const client = new OAuth2Client({
            clientId: authCredential.oauth2.clientId || '',
            clientSecret: authCredential.oauth2.clientSecret || '',
            tokenEndpoint,
        });

        try {
            const tokenResponse = await client.authorizationCode.getToken({
                code,
                redirectUri: authCredential.oauth2.redirectUri || '',
                // Include code verifier if PKCE was used
                codeVerifier: this.getStoredCodeVerifier(state),
            });

            const exchangedCredential = this.deepCopy(authCredential);
            if (!exchangedCredential.oauth2) {
                throw new Error('OAuth2 configuration missing in exchanged credential');
            }
            exchangedCredential.oauth2.accessToken = tokenResponse.accessToken;
            exchangedCredential.oauth2.refreshToken = tokenResponse.refreshToken;
            exchangedCredential.oauth2.expiresAt = tokenResponse.expiresAt;

            return exchangedCredential;
        } catch (error) {
            throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(refreshToken: string): Promise<AuthCredential> {
        if (!OAUTH2_AVAILABLE) {
            throw new Error('OAuth2 library not available');
        }

        const authScheme = this.authConfig.authScheme;
        const authCredential = this.authConfig.rawAuthCredential;

        if (!authCredential) {
            throw new Error('Raw auth credential is required for refreshing access token');
        }

        if (!authCredential.oauth2) {
            throw new Error('OAuth2 configuration is required in auth credential');
        }

        let tokenEndpoint: string;

        if (authScheme instanceof OpenIdConnectWithConfig) {
            tokenEndpoint = authScheme.tokenEndpoint || '';
        } else {
            tokenEndpoint =
                (authScheme.flows.authorizationCode?.tokenUrl) ||
                (authScheme.flows.clientCredentials?.tokenUrl) ||
                '';
        }

        const client = new OAuth2Client({
            clientId: authCredential.oauth2.clientId || '',
            clientSecret: authCredential.oauth2.clientSecret || '',
            tokenEndpoint,
        });

        try {
            const tokenResponse = await client.refreshToken({
                accessToken: '', // Not needed for refresh
                refreshToken,
                expiresAt: new Date().getDate(), // Not needed for refresh
            });

            const exchangedCredential = this.deepCopy(authCredential);
            if (!exchangedCredential.oauth2) {
                throw new Error('OAuth2 configuration missing in exchanged credential');
            }
            exchangedCredential.oauth2.accessToken = tokenResponse.accessToken;
            exchangedCredential.oauth2.refreshToken = tokenResponse.refreshToken || refreshToken;
            exchangedCredential.oauth2.expiresAt = tokenResponse.expiresAt;

            return exchangedCredential;
        } catch (error) {
            throw new Error(`Failed to refresh access token: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private deepCopy<T>(obj: T): T {
        // TypeScript equivalent of Python's model_copy(deep=True)
        return JSON.parse(JSON.stringify(obj));
    }

    private generateRandomState(): string {
        // Generate a random state for OAuth2 flow
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    private generateCodeChallenge(): string {
        // Generate PKCE code challenge (simplified version)
        // In production, use proper crypto libraries
        const codeVerifier = this.generateRandomState();
        // Store code verifier for later use
        this.storeCodeVerifier(codeVerifier);

        // This is a simplified version - use proper SHA256 hashing in production
        return btoa(codeVerifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    private storeCodeVerifier(codeVerifier: string): void {
        // Store code verifier temporarily (implement proper storage)
        // This could be stored in memory, session, or secure storage
        (this as any)._codeVerifier = codeVerifier;
    }

    private getStoredCodeVerifier(state: string): string {
        // Retrieve stored code verifier (implement proper retrieval)
        return (this as any)._codeVerifier || '';
    }
}
