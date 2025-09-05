import { OAuth2Client } from '@badgateway/oauth2-client';
import { AuthCredential } from '../auth-credential';
import { AuthScheme } from '../auth-schemes';
import {
  BaseCredentialExchanger,
  CredentialExchangeError,
} from './base-credential-exchanger';

// Logger setup - using console for simplicity, you can replace with your preferred logging library
const logger = {
  warning: (message: string) =>
    console.warn(`[OAuth2CredentialExchanger] ${message}`),
  debug: (message: string) =>
    console.debug(`[OAuth2CredentialExchanger] ${message}`),
  error: (message: string, error?: any) =>
    console.error(`[OAuth2CredentialExchanger] ${message}`, error),
};

// Check OAuth2 library availability
let OAUTH2_AVAILABLE = true;
try {
  if (!OAuth2Client) {
    OAUTH2_AVAILABLE = false;
  }
} catch {
  OAUTH2_AVAILABLE = false;
}

/**
 * @experimental
 * Exchanges OAuth2 credentials from authorization responses.
 */
export class OAuth2CredentialExchanger extends BaseCredentialExchanger {
  /**
   * Exchange OAuth2 credential from authorization response.
   * If credential exchange failed, the original credential will be returned.
   *
   * @param authCredential - The OAuth2 credential to exchange.
   * @param authScheme - The OAuth2 authentication scheme.
   * @returns The exchanged credential with access token.
   * @throws CredentialExchangeError - If auth_scheme is missing.
   */
  async exchange(
    authCredential: AuthCredential,
    authScheme?: AuthScheme
  ): Promise<AuthCredential> {
    if (!authScheme) {
      throw new CredentialExchangeError(
        'auth_scheme is required for OAuth2 credential exchange'
      );
    }

    if (!OAUTH2_AVAILABLE) {
      // If OAuth2 client is not available, we cannot exchange the credential.
      // We return the original credential without exchange.
      // The client using this tool can decide to exchange the credential
      // themselves using other lib.
      logger.warning(
        'OAuth2 client is not available, skipping OAuth2 credential exchange.'
      );
      return authCredential;
    }

    if (authCredential.oauth2?.accessToken) {
      return authCredential;
    }

    const { client, tokenEndpoint } = await this.createOAuth2Session(
      authScheme,
      authCredential
    );
    if (!client || !tokenEndpoint) {
      logger.warning('Could not create OAuth2 session for token exchange');
      return authCredential;
    }

    try {
      let tokens;

      // Handle different OAuth2 flows
      if (authCredential.oauth2?.authCode) {
        // Authorization Code flow
        tokens = await client.authorizationCode.getToken({
          code: authCredential.oauth2.authCode,
          redirectUri: authCredential.oauth2?.redirectUri || '',
        });
      } else if (authCredential.oauth2?.authResponseUri) {
        // Extract code from auth response URI and exchange
        const url = new URL(authCredential.oauth2.authResponseUri);
        const code = url.searchParams.get('code');

        if (code) {
          tokens = await client.authorizationCode.getToken({
            code,
            redirectUri: authCredential.oauth2?.redirectUri || '',
          });
        } else {
          throw new Error('No authorization code found in auth response URI');
        }
      } else {
        throw new Error(
          'No authorization code or auth response URI available for token exchange'
        );
      }

      this.updateCredentialWithTokens(authCredential, tokens);
      logger.debug('Successfully exchanged OAuth2 tokens');
    } catch (error) {
      // TODO: reconsider whether we should raise errors in this case
      logger.error('Failed to exchange OAuth2 tokens:', error);
      // Return original credential on failure
      return authCredential;
    }

    return authCredential;
  }

  /**
   * Create OAuth2 client session from auth scheme and credential.
   */
  private async createOAuth2Session(
    authScheme: AuthScheme,
    authCredential: AuthCredential
  ): Promise<{ client: OAuth2Client | null; tokenEndpoint: string | null }> {
    try {
      if (
        !authCredential.oauth2?.clientId ||
        !authCredential.oauth2?.clientSecret
      ) {
        logger.warning('Missing client credentials for OAuth2 session');
        return { client: null, tokenEndpoint: null };
      }

      // Extract endpoints from auth scheme
      let tokenEndpoint = '';
      let authorizationEndpoint = '';

      if ('flows' in authScheme) {
        // OAuth2 scheme
        tokenEndpoint =
          authScheme.flows.authorizationCode?.tokenUrl ||
          authScheme.flows.clientCredentials?.tokenUrl ||
          authScheme.flows.password?.tokenUrl ||
          '';

        authorizationEndpoint =
          authScheme.flows.authorizationCode?.authorizationUrl ||
          authScheme.flows.implicit?.authorizationUrl ||
          '';
      } else if ('tokenEndpoint' in authScheme) {
        // OpenID Connect scheme
        tokenEndpoint = (authScheme as any).tokenEndpoint;
        authorizationEndpoint = (authScheme as any).authorizationEndpoint || '';
      }

      if (!tokenEndpoint) {
        logger.warning('No token endpoint found in auth scheme');
        return { client: null, tokenEndpoint: null };
      }

      const client = new OAuth2Client({
        clientId: authCredential.oauth2.clientId,
        clientSecret: authCredential.oauth2.clientSecret,
        tokenEndpoint,
        authorizationEndpoint,
      });

      return { client, tokenEndpoint };
    } catch (error) {
      logger.error('Error creating OAuth2 session:', error);
      return { client: null, tokenEndpoint: null };
    }
  }

  /**
   * Update auth credential with received tokens.
   */
  private updateCredentialWithTokens(
    authCredential: AuthCredential,
    tokens: any
  ): void {
    if (!authCredential.oauth2) {
      authCredential.oauth2 = {} as any;
    }
    if (authCredential.oauth2) {
      authCredential.oauth2.accessToken =
        tokens.accessToken || tokens.access_token;
      authCredential.oauth2.refreshToken =
        tokens.refreshToken || tokens.refresh_token;
      // Set token expiration
      if (tokens.expiresAt) {
        authCredential.oauth2.expiresAt = tokens.expiresAt;
      } else if (tokens.expires_in) {
        authCredential.oauth2.expiresAt = new Date(
          Date.now() + tokens.expires_in * 1000
        ).getTime();
      }

      // Set token type
      authCredential.oauth2.tokenType =
        tokens.tokenType || tokens.token_type || 'Bearer';

      // Set scope if provided
      if (tokens.scope) {
        authCredential.oauth2.scope = tokens.scope;
      }
    }
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshAccessToken(
    authCredential: AuthCredential,
    authScheme: AuthScheme
  ): Promise<AuthCredential> {
    if (!authCredential.oauth2?.refreshToken) {
      throw new CredentialExchangeError('No refresh token available');
    }

    const { client } = await this.createOAuth2Session(
      authScheme,
      authCredential
    );
    if (!client) {
      throw new CredentialExchangeError(
        'Could not create OAuth2 session for token refresh'
      );
    }

    try {
      const tokens = await client.refreshToken({
        accessToken: '', // Not needed for refresh
        refreshToken: authCredential.oauth2.refreshToken,
        expiresAt: new Date().getDate(), // Not needed for refresh
      });

      this.updateCredentialWithTokens(authCredential, tokens);
      logger.debug('Successfully refreshed OAuth2 access token');

      return authCredential;
    } catch (error) {
      logger.error('Failed to refresh OAuth2 access token:', error);
      throw new CredentialExchangeError(
        `Failed to refresh access token: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if access token is expired or about to expire.
   */
  isTokenExpired(
    authCredential: AuthCredential,
    bufferMinutes: number = 5
  ): boolean {
    if (!authCredential.oauth2?.expiresAt) {
      return false; // If no expiration time, assume it's valid
    }

    const expiresAt = authCredential.oauth2.expiresAt;
    const expirationTime: Date =
      (expiresAt as any) instanceof Date
        ? (expiresAt as unknown as Date)
        : new Date(expiresAt as any);

    const bufferTime = bufferMinutes * 60 * 1000; // Convert to milliseconds
    return expirationTime.getTime() - bufferTime <= Date.now();
  }
}
