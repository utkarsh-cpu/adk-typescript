// auth_schemes.ts

/**
 * Security scheme types from OpenAPI 3.0 specification
 */

// auth_schemes_class.ts

import {
    SecuritySchemeType,
    OAuthFlows,
    SecurityScheme,
    SecurityBase
  } from './openapi_models';
  
  /**
   * OpenIdConnectWithConfig class representing an OpenID Connect security scheme
   * with extended configuration.
   */
  export class OpenIdConnectWithConfig implements SecurityBase {
    type: SecuritySchemeType = SecuritySchemeType.openIdConnect;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint?: string | null = null;
    revocationEndpoint?: string | null = null;
    tokenEndpointAuthMethodsSupported?: string[] | null = null;
    grantTypesSupported?: string[] | null = null;
    scopes?: string[] | null = null;
  
    constructor(config: {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userinfoEndpoint?: string | null;
      revocationEndpoint?: string | null;
      tokenEndpointAuthMethodsSupported?: string[] | null;
      grantTypesSupported?: string[] | null;
      scopes?: string[] | null;
    }) {
      this.authorizationEndpoint = config.authorizationEndpoint;
      this.tokenEndpoint = config.tokenEndpoint;
      this.userinfoEndpoint = config.userinfoEndpoint ?? null;
      this.revocationEndpoint = config.revocationEndpoint ?? null;
      this.tokenEndpointAuthMethodsSupported = config.tokenEndpointAuthMethodsSupported ?? null;
      this.grantTypesSupported = config.grantTypesSupported ?? null;
      this.scopes = config.scopes ?? null;
    }
  }
  
  export type AuthScheme = SecurityScheme | OpenIdConnectWithConfig;
  
  export enum OAuthGrantType {
    CLIENT_CREDENTIALS = "client_credentials",
    AUTHORIZATION_CODE = "authorization_code",  
    IMPLICIT = "implicit",
    PASSWORD = "password"
  }
  
  export namespace OAuthGrantType {
    export function fromFlow(flow: OAuthFlows): OAuthGrantType | null {
      if (flow.clientCredentials) {
        return OAuthGrantType.CLIENT_CREDENTIALS;
      }
      if (flow.authorizationCode) {
        return OAuthGrantType.AUTHORIZATION_CODE;
      }
      if (flow.implicit) {
        return OAuthGrantType.IMPLICIT;
      }
      if (flow.password) {
        return OAuthGrantType.PASSWORD;
      }
      return null;
    }
  }
  
  export type AuthSchemeType = SecuritySchemeType;
  