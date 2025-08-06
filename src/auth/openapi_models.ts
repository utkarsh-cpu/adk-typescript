// openapi_models.ts

/**
 * Base configuration for models allowing extra properties
 */
export interface BaseModelWithConfig {
    [key: string]: any; // Allows extra properties like Pydantic's "extra": "allow"
  }
  
  /**
   * Email string type (simplified from Pydantic EmailStr)
   */
  export type EmailStr = string;
  
  /**
   * Contact information
   */
  export interface Contact extends BaseModelWithConfig {
    name?: string;
    url?: string;
    email?: EmailStr;
  }
  
  /**
   * License information
   */
  export interface License extends BaseModelWithConfig {
    name: string;
    identifier?: string;
    url?: string;
  }
  
  /**
   * API Info Object
   */
  export interface Info extends BaseModelWithConfig {
    title: string;
    summary?: string;
    description?: string;
    termsOfService?: string;
    contact?: Contact;
    license?: License;
    version: string;
  }
  
  /**
   * Server Variable Object
   */
  export interface ServerVariable extends BaseModelWithConfig {
    enum?: string[];
    default: string;
    description?: string;
  }
  
  /**
   * Server Object
   */
  export interface Server extends BaseModelWithConfig {
    url: string;
    description?: string;
    variables?: Record<string, ServerVariable>;
  }
  
  /**
   * Reference Object
   */
  export interface Reference {
    $ref: string;
  }
  
  /**
   * Discriminator Object
   */
  export interface Discriminator {
    propertyName: string;
    mapping?: Record<string, string>;
  }
  
  /**
   * XML Object
   */
  export interface XML extends BaseModelWithConfig {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
  }
  
  /**
   * External Documentation Object
   */
  export interface ExternalDocumentation extends BaseModelWithConfig {
    description?: string;
    url: string;
  }
  
  /**
   * Schema Object (JSON Schema 2020-12 + OpenAPI extensions)
   */
  export interface Schema extends BaseModelWithConfig {
    // Core Vocabulary
    $schema?: string;
    $vocabulary?: string;
    $id?: string;
    $anchor?: string;
    $dynamicAnchor?: string;
    $ref?: string;
    $dynamicRef?: string;
    $defs?: Record<string, SchemaOrBool>;
    $comment?: string;
    
    // Applying Subschemas
    allOf?: SchemaOrBool[];
    anyOf?: SchemaOrBool[];
    oneOf?: SchemaOrBool[];
    not?: SchemaOrBool;
    if?: SchemaOrBool;
    then?: SchemaOrBool;
    else?: SchemaOrBool;
    dependentSchemas?: Record<string, SchemaOrBool>;
    prefixItems?: SchemaOrBool[];
    items?: SchemaOrBool | SchemaOrBool[];
    contains?: SchemaOrBool;
    properties?: Record<string, SchemaOrBool>;
    patternProperties?: Record<string, SchemaOrBool>;
    additionalProperties?: SchemaOrBool;
    propertyNames?: SchemaOrBool;
    unevaluatedItems?: SchemaOrBool;
    unevaluatedProperties?: SchemaOrBool;
    
    // Structural Validation
    type?: string;
    enum?: any[];
    const?: any;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: number;
    minimum?: number;
    exclusiveMinimum?: number;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxContains?: number;
    minContains?: number;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    dependentRequired?: Record<string, Set<string>>;
    
    // Semantic Content
    format?: string;
    
    // String-Encoded Data
    contentEncoding?: string;
    contentMediaType?: string;
    contentSchema?: SchemaOrBool;
    
    // Meta-Data Annotations  
    title?: string;
    description?: string;
    default?: any;
    deprecated?: boolean;
    readOnly?: boolean;
    writeOnly?: boolean;
    examples?: any[];
    
    // OpenAPI Extensions
    discriminator?: Discriminator;
    xml?: XML;
    externalDocs?: ExternalDocumentation;
    /** @deprecated Use examples instead */
    example?: any;
  }
  
  /**
   * Schema or Boolean type
   */
  export type SchemaOrBool = Schema | boolean;
  
  /**
   * Example Object
   */
  export interface Example {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
    [key: string]: any; // Allow extra properties
  }
  
  /**
   * Parameter location enum
   */
  export enum ParameterInType {
    query = "query",
    header = "header", 
    path = "path",
    cookie = "cookie"
  }
  
  /**
   * Encoding Object
   */
  export interface Encoding extends BaseModelWithConfig {
    contentType?: string;
    headers?: Record<string, Header | Reference>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
  }
  
  /**
   * Media Type Object
   */
  export interface MediaType extends BaseModelWithConfig {
    schema?: Schema | Reference;
    example?: any;
    examples?: Record<string, Example | Reference>;
    encoding?: Record<string, Encoding>;
  }
  
  /**
   * Parameter Base
   */
  export interface ParameterBase extends BaseModelWithConfig {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: Schema | Reference;
    example?: any;
    examples?: Record<string, Example | Reference>;
    content?: Record<string, MediaType>;
  }
  
  /**
   * Parameter Object
   */
  export interface Parameter extends ParameterBase {
    name: string;
    in: ParameterInType;
  }
  
  /**
   * Header Object
   */
  export interface Header extends ParameterBase {}
  
  /**
   * Request Body Object
   */
  export interface RequestBody extends BaseModelWithConfig {
    description?: string;
    content: Record<string, MediaType>;
    required?: boolean;
  }
  
  /**
   * Link Object
   */
  export interface Link extends BaseModelWithConfig {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, any | string>;
    requestBody?: any | string;
    description?: string;
    server?: Server;
  }
  
  /**
   * Response Object
   */
  export interface Response extends BaseModelWithConfig {
    description: string;
    headers?: Record<string, Header | Reference>;
    content?: Record<string, MediaType>;
    links?: Record<string, Link | Reference>;
  }
  
  /**
   * Operation Object
   */
  export interface Operation extends BaseModelWithConfig {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
    operationId?: string;
    parameters?: (Parameter | Reference)[];
    requestBody?: RequestBody | Reference;
    responses?: Record<string, Response | any>;
    callbacks?: Record<string, Record<string, PathItem> | Reference>;
    deprecated?: boolean;
    security?: Record<string, string[]>[];
    servers?: Server[];
  }
  
  /**
   * Path Item Object
   */
  export interface PathItem extends BaseModelWithConfig {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: Operation;
    put?: Operation;
    post?: Operation;
    delete?: Operation;
    options?: Operation;
    head?: Operation;
    patch?: Operation;
    trace?: Operation;
    servers?: Server[];
    parameters?: (Parameter | Reference)[];
  }
  
  /**
   * Security Scheme Type enum
   */
  export enum SecuritySchemeType {
    apiKey = "apiKey",
    http = "http",
    oauth2 = "oauth2", 
    openIdConnect = "openIdConnect"
  }
  
  /**
   * Security Base
   */
  export interface SecurityBase extends BaseModelWithConfig {
    type: SecuritySchemeType;
    description?: string;
  }
  
  /**
   * API Key location enum
   */
  export enum APIKeyIn {
    query = "query",
    header = "header",
    cookie = "cookie"
  }
  
  /**
   * API Key Security Scheme
   */
  export interface APIKey extends SecurityBase {
    type: SecuritySchemeType.apiKey;
    in: APIKeyIn;
    name: string;
  }
  
  /**
   * HTTP Security Scheme Base
   */
  export interface HTTPBase extends SecurityBase {
    type: SecuritySchemeType.http;
    scheme: string;
  }
  
  /**
   * HTTP Bearer Security Scheme
   */
  export interface HTTPBearer extends HTTPBase {
    scheme: "bearer";
    bearerFormat?: string;
  }
  
  /**
   * OAuth Flow Base
   */
  export interface OAuthFlow extends BaseModelWithConfig {
    refreshUrl?: string;
    scopes: Record<string, string>;
  }
  
  /**
   * OAuth Implicit Flow
   */
  export interface OAuthFlowImplicit extends OAuthFlow {
    authorizationUrl: string;
  }
  
  /**
   * OAuth Password Flow
   */
  export interface OAuthFlowPassword extends OAuthFlow {
    tokenUrl: string;
  }
  
  /**
   * OAuth Client Credentials Flow
   */
  export interface OAuthFlowClientCredentials extends OAuthFlow {
    tokenUrl: string;
  }
  
  /**
   * OAuth Authorization Code Flow
   */
  export interface OAuthFlowAuthorizationCode extends OAuthFlow {
    authorizationUrl: string;
    tokenUrl: string;
  }
  
  /**
   * OAuth Flows Object
   */
  export interface OAuthFlows extends BaseModelWithConfig {
    implicit?: OAuthFlowImplicit;
    password?: OAuthFlowPassword;
    clientCredentials?: OAuthFlowClientCredentials;
    authorizationCode?: OAuthFlowAuthorizationCode;
  }
  
  /**
   * OAuth2 Security Scheme
   */
  export interface OAuth2 extends SecurityBase {
    type: SecuritySchemeType.oauth2;
    flows: OAuthFlows;
  }
  
  /**
   * OpenID Connect Security Scheme
   */
  export interface OpenIdConnect extends SecurityBase {
    type: SecuritySchemeType.openIdConnect;
    openIdConnectUrl: string;
  }
  
  /**
   * Security Scheme Union Type
   */
  export type SecurityScheme = APIKey | HTTPBase | OAuth2 | OpenIdConnect | HTTPBearer;
  
  /**
   * Components Object
   */
  export interface Components extends BaseModelWithConfig {
    schemas?: Record<string, Schema | Reference>;
    responses?: Record<string, Response | Reference>;
    parameters?: Record<string, Parameter | Reference>;
    examples?: Record<string, Example | Reference>;
    requestBodies?: Record<string, RequestBody | Reference>;
    headers?: Record<string, Header | Reference>;
    securitySchemes?: Record<string, SecurityScheme | Reference>;
    links?: Record<string, Link | Reference>;
    callbacks?: Record<string, Record<string, PathItem> | Reference | any>;
    pathItems?: Record<string, PathItem | Reference>;
  }
  
  /**
   * Tag Object
   */
  export interface Tag extends BaseModelWithConfig {
    name: string;
    description?: string;
    externalDocs?: ExternalDocumentation;
  }
  
  /**
   * OpenAPI Document Object
   */
  export interface OpenAPI extends BaseModelWithConfig {
    openapi: string;
    info: Info;
    jsonSchemaDialect?: string;
    servers?: Server[];
    paths?: Record<string, PathItem | any>;
    webhooks?: Record<string, PathItem | Reference>;
    components?: Components;
    security?: Record<string, string[]>[];
    tags?: Tag[];
    externalDocs?: ExternalDocumentation;
  }
  
  // Type guards for runtime type checking
  export function isAPIKey(scheme: SecurityScheme): scheme is APIKey {
    return scheme.type === SecuritySchemeType.apiKey;
  }
  
  export function isHTTPBase(scheme: SecurityScheme): scheme is HTTPBase {
    return scheme.type === SecuritySchemeType.http;
  }
  
  export function isOAuth2(scheme: SecurityScheme): scheme is OAuth2 {
    return scheme.type === SecuritySchemeType.oauth2;
  }
  
  export function isOpenIdConnect(scheme: SecurityScheme): scheme is OpenIdConnect {
    return scheme.type === SecuritySchemeType.openIdConnect;
  }
  
  export function isHTTPBearer(scheme: SecurityScheme): scheme is HTTPBearer {
    return scheme.type === SecuritySchemeType.http && 'scheme' in scheme && scheme.scheme === 'bearer';
  }
  