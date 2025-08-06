// auth_credentials.ts

/**
 * Represents the secret token value for HTTP authentication, like user name, password, oauth token, etc.
 */
export interface HttpCredentials {
    username?: string | null;
    password?: string | null;
    token?: string | null;
  }
  
  /**
   * The credentials and metadata for HTTP authentication.
   * The name of the HTTP Authorization scheme to be used in the Authorization
   * header as defined in RFC7235. Examples: 'basic', 'bearer'
   */
  export interface HttpAuth {
    scheme: string;
    credentials: HttpCredentials;
  }
  
  /**
   * Represents credential value and its metadata for a OAuth2 credential.
   */
  export interface OAuth2Auth {
    clientId?: string | null;
    clientSecret?: string | null;
    /** Tool or adk can generate the auth_uri with the state info thus client can verify the state */
    authUri?: string | null;
    state?: string | null;
    /** Tool or adk can decide the redirect_uri if they don't want client to decide */
    redirectUri?: string | null;
    authResponseUri?: string | null;
    authCode?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    expiresAt?: number | null;
    expiresIn?: number | null;
    tokenType?: string | null;
    scope?: string | null;
    idToken?: string | null;
  }
  
  /**
   * Represents Google Service Account configuration.
   * 
   * @example
   * ```
   * const config: ServiceAccountCredential = {
   *   type: "service_account",
   *   projectId: "your_project_id",
   *   privateKeyId: "your_private_key_id",
   *   privateKey: "-----BEGIN PRIVATE KEY-----...",
   *   clientEmail: "...@....iam.gserviceaccount.com",
   *   clientId: "your_client_id",
   *   authUri: "https://accounts.google.com/o/oauth2/auth",
   *   tokenUri: "https://oauth2.googleapis.com/token",
   *   authProviderX509CertUrl: "https://www.googleapis.com/oauth2/v1/certs",
   *   clientX509CertUrl: "https://www.googleapis.com/robot/v1/metadata/x509/...",
   *   universeDomain: "googleapis.com"
   * };
   * ```
   */
  export interface ServiceAccountCredential {
    /** The type should be "service_account". */
    type: string;
    projectId: string;
    privateKeyId: string;
    privateKey: string;
    clientEmail: string;
    clientId: string;
    authUri: string;
    tokenUri: string;
    authProviderX509CertUrl: string;
    clientX509CertUrl: string;
    universeDomain: string;
  }
  
  /**
   * Represents Google Service Account configuration.
   */
  export interface ServiceAccount {
    serviceAccountCredential?: ServiceAccountCredential | null;
    scopes: string[];
    useDefaultCredential?: boolean;
  }
  
  /**
   * Represents the type of authentication credential.
   */
  export enum AuthCredentialTypes {
    /** API Key credential */
    API_KEY = "apiKey",
    /** Credentials for HTTP Auth schemes */
    HTTP = "http",
    /** OAuth2 credentials */
    OAUTH2 = "oauth2",
    /** OpenID Connect credentials */
    OPEN_ID_CONNECT = "openIdConnect",
    /** Service Account credentials */
    SERVICE_ACCOUNT = "serviceAccount"
  }
  
  /**
   * Data class representing an authentication credential.
   *
   * To exchange for the actual credential, please use
   * CredentialExchanger.exchangeCredential().
   * 
   * @example API Key Auth
   * ```
   * const apiKeyAuth: AuthCredential = {
   *   authType: AuthCredentialTypes.API_KEY,
   *   apiKey: "1234"
   * };
   * ```
   * 
   * @example HTTP Auth
   * ```
   * const httpAuth: AuthCredential = {
   *   authType: AuthCredentialTypes.HTTP,
   *   http: {
   *     scheme: "basic",
   *     credentials: { username: "user", password: "password" }
   *   }
   * };
   * ```
   * 
   * @example OAuth2 Bearer Token
   * ```
   * const bearerAuth: AuthCredential = {
   *   authType: AuthCredentialTypes.HTTP,
   *   http: {
   *     scheme: "bearer",
   *     credentials: { token: "eyAkaknabna...." }
   *   }
   * };
   * ```
   * 
   * @example OAuth2 Authorization Code Flow
   * ```
   * const oauth2Auth: AuthCredential = {
   *   authType: AuthCredentialTypes.OAUTH2,
   *   oauth2: {
   *     clientId: "1234",
   *     clientSecret: "secret"
   *   }
   * };
   * ```
   */
  export interface AuthCredential {
    authType: AuthCredentialTypes;
    /** Resource reference for the credential. This will be supported in the future. */
    resourceRef?: string | null;
    apiKey?: string | null;
    http?: HttpAuth | null;
    serviceAccount?: ServiceAccount | null;
    oauth2?: OAuth2Auth | null;
  }
  
  // Utility functions for creating credentials (optional helpers)
  
  /**
   * Creates an HttpCredentials object from a data object.
   */
  export function createHttpCredentials(data: {
    username?: string;
    password?: string;
    token?: string;
  }): HttpCredentials {
    return {
      username: data.username ?? null,
      password: data.password ?? null,
      token: data.token ?? null
    };
  }
  
  /**
   * Validates and creates an HttpCredentials object from any data.
   */
  export function validateHttpCredentials(data: Record<string, any>): HttpCredentials {
    return createHttpCredentials({
      username: data.username,
      password: data.password,
      token: data.token
    });
  }
  