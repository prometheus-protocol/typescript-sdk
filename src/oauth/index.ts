import pkceChallenge from 'pkce-challenge';
import {
  type OAuthClientMetadata,
  type OAuthClientInformation,
  type OAuthTokens,
  type OAuthMetadata,
  type OAuthClientInformationFull,
  type OAuthProtectedResourceMetadata,
  OAuthErrorResponseSchema,
  OAuthClientInformationFullSchema,
  OAuthMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
  OAuthTokensSchema,
} from './types';
import { checkResourceAllowed, resourceUrlFromServerUrl } from './utils';
import {
  InvalidClientError,
  InvalidGrantError,
  OAUTH_ERRORS,
  OAuthError,
  ServerError,
  UnauthorizedClientError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';

// Explicitly re-export the TYPES from './types'
export type {
  OAuthClientMetadata,
  OAuthClientInformation,
  OAuthTokens,
  OAuthMetadata,
  OAuthClientInformationFull,
  OAuthProtectedResourceMetadata,
} from './types';

// Explicitly re-export the VALUES (schemas) from './types'
export {
  OAuthErrorResponseSchema,
  OAuthClientInformationFullSchema,
  OAuthMetadataSchema,
  OAuthProtectedResourceMetadataSchema,
  OAuthTokensSchema,
} from './types';

const LATEST_PROTOCOL_VERSION = '0.1.0';

/**
 * Implements an end-to-end OAuth client to be used with one MCP server.
 *
 * This client relies upon a concept of an authorized "session," the exact
 * meaning of which is application-defined. Tokens, authorization codes, and
 * code verifiers should not cross different sessions.
 */
export interface OAuthClientProvider {
  /**
   * The URL to redirect the user agent to after authorization.
   */
  get redirectUrl(): string | URL;

  /**
   * Metadata about this OAuth client.
   */
  get clientMetadata(): OAuthClientMetadata;

  /**
   * Returns a OAuth2 state parameter.
   */
  state?(): string | Promise<string>;

  /**
   * Loads information about this OAuth client, as registered already with the
   * server, or returns `undefined` if the client is not registered with the
   * server.
   */
  clientInformation():
    | OAuthClientInformation
    | undefined
    | Promise<OAuthClientInformation | undefined>;

  /**
   * If implemented, this permits the OAuth client to dynamically register with
   * the server. Client information saved this way should later be read via
   * `clientInformation()`.
   *
   * This method is not required to be implemented if client information is
   * statically known (e.g., pre-registered).
   */
  saveClientInformation?(
    clientInformation: OAuthClientInformationFull,
  ): void | Promise<void>;

  /**
   * Loads any existing OAuth tokens for the current session, or returns
   * `undefined` if there are no saved tokens.
   */
  tokens(): OAuthTokens | undefined | Promise<OAuthTokens | undefined>;

  /**
   * Stores new OAuth tokens for the current session, after a successful
   * authorization.
   */
  saveTokens(tokens: OAuthTokens): void | Promise<void>;

  /**
   * Invoked to redirect the user agent to the given URL to begin the authorization flow.
   */
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;

  /**
   * Saves a PKCE code verifier for the current session, before redirecting to
   * the authorization flow.
   */
  saveCodeVerifier(codeVerifier: string): void | Promise<void>;

  /**
   * Loads the PKCE code verifier for the current session, necessary to validate
   * the authorization result.
   */
  codeVerifier(): string | Promise<string>;

  /**
   * Adds custom client authentication to OAuth token requests.
   *
   * This optional method allows implementations to customize how client credentials
   * are included in token exchange and refresh requests. When provided, this method
   * is called instead of the default authentication logic, giving full control over
   * the authentication mechanism.
   *
   * Common use cases include:
   * - Supporting authentication methods beyond the standard OAuth 2.0 methods
   * - Adding custom headers for proprietary authentication schemes
   * - Implementing client assertion-based authentication (e.g., JWT bearer tokens)
   *
   * @param headers - The request headers (can be modified to add authentication)
   * @param params - The request body parameters (can be modified to add credentials)
   * @param url - The token endpoint URL being called
   * @param metadata - Optional OAuth metadata for the server, which may include supported authentication methods
   */
  addClientAuthentication?(
    headers: Headers,
    params: URLSearchParams,
    url: string | URL,
    metadata?: OAuthMetadata,
  ): void | Promise<void>;

  /**
   * If defined, overrides the selection and validation of the
   * RFC 8707 Resource Indicator. If left undefined, default
   * validation behavior will be used.
   *
   * Implementations must verify the returned resource matches the MCP server.
   */
  validateResourceURL?(
    serverUrl: string | URL,
    resource?: string,
  ): Promise<URL | undefined>;

  /**
   * If implemented, provides a way for the client to invalidate (e.g. delete) the specified
   * credentials, in the case where the server has indicated that they are no longer valid.
   * This avoids requiring the user to intervene manually.
   */
  invalidateCredentials?(
    scope: 'all' | 'client' | 'tokens' | 'verifier',
  ): void | Promise<void>;
}

export type AuthResult = 'AUTHORIZED' | 'REDIRECT';

export class UnauthorizedError extends Error {
  constructor(message?: string) {
    super(message ?? 'Unauthorized');
  }
}

type ClientAuthMethod = 'client_secret_basic' | 'client_secret_post' | 'none';

/**
 * Determines the best client authentication method to use based on server support and client configuration.
 *
 * Priority order (highest to lowest):
 * 1. client_secret_basic (if client secret is available)
 * 2. client_secret_post (if client secret is available)
 * 3. none (for public clients)
 *
 * @param clientInformation - OAuth client information containing credentials
 * @param supportedMethods - Authentication methods supported by the authorization server
 * @returns The selected authentication method
 */
function selectClientAuthMethod(
  clientInformation: OAuthClientInformation,
  supportedMethods: string[],
): ClientAuthMethod {
  const hasClientSecret = clientInformation.client_secret !== undefined;

  // If server doesn't specify supported methods, use RFC 6749 defaults
  if (supportedMethods.length === 0) {
    return hasClientSecret ? 'client_secret_post' : 'none';
  }

  // Try methods in priority order (most secure first)
  if (hasClientSecret && supportedMethods.includes('client_secret_basic')) {
    return 'client_secret_basic';
  }

  if (hasClientSecret && supportedMethods.includes('client_secret_post')) {
    return 'client_secret_post';
  }

  if (supportedMethods.includes('none')) {
    return 'none';
  }

  // Fallback: use what we have
  return hasClientSecret ? 'client_secret_post' : 'none';
}

/**
 * Applies client authentication to the request based on the specified method.
 *
 * Implements OAuth 2.1 client authentication methods:
 * - client_secret_basic: HTTP Basic authentication (RFC 6749 Section 2.3.1)
 * - client_secret_post: Credentials in request body (RFC 6749 Section 2.3.1)
 * - none: Public client authentication (RFC 6749 Section 2.1)
 *
 * @param method - The authentication method to use
 * @param clientInformation - OAuth client information containing credentials
 * @param headers - HTTP headers object to modify
 * @param params - URL search parameters to modify
 * @throws {Error} When required credentials are missing
 */
function applyClientAuthentication(
  method: ClientAuthMethod,
  clientInformation: OAuthClientInformation,
  headers: Headers,
  params: URLSearchParams,
): void {
  const { client_id, client_secret } = clientInformation;

  switch (method) {
    case 'client_secret_basic':
      applyBasicAuth(client_id, client_secret, headers);
      return;
    case 'client_secret_post':
      applyPostAuth(client_id, client_secret, params);
      return;
    case 'none':
      applyPublicAuth(client_id, params);
      return;
    default:
      throw new Error(`Unsupported client authentication method: ${method}`);
  }
}

/**
 * Applies HTTP Basic authentication (RFC 6749 Section 2.3.1)
 */
function applyBasicAuth(
  clientId: string,
  clientSecret: string | undefined,
  headers: Headers,
): void {
  if (!clientSecret) {
    throw new Error(
      'client_secret_basic authentication requires a client_secret',
    );
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);
  headers.set('Authorization', `Basic ${credentials}`);
}

/**
 * Applies POST body authentication (RFC 6749 Section 2.3.1)
 */
function applyPostAuth(
  clientId: string,
  clientSecret: string | undefined,
  params: URLSearchParams,
): void {
  params.set('client_id', clientId);
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }
}

/**
 * Applies public client authentication (RFC 6749 Section 2.1)
 */
function applyPublicAuth(clientId: string, params: URLSearchParams): void {
  params.set('client_id', clientId);
}

/**
 * Parses an OAuth error response from a string or Response object.
 *
 * If the input is a standard OAuth2.0 error response, it will be parsed according to the spec
 * and an instance of the appropriate OAuthError subclass will be returned.
 * If parsing fails, it falls back to a generic ServerError that includes
 * the response status (if available) and original content.
 *
 * @param input - A Response object or string containing the error response
 * @returns A Promise that resolves to an OAuthError instance
 */
export async function parseErrorResponse(
  input: Response | string,
): Promise<OAuthError> {
  const statusCode = input instanceof Response ? input.status : undefined;
  const body = input instanceof Response ? await input.text() : input;

  try {
    const result = OAuthErrorResponseSchema.parse(JSON.parse(body));
    const { error, error_description, error_uri } = result;
    const errorClass = OAUTH_ERRORS[error] || ServerError;
    return new errorClass(error_description || '', error_uri);
  } catch (error) {
    // Not a valid OAuth error response, but try to inform the user of the raw data anyway
    const errorMessage = `${statusCode ? `HTTP ${statusCode}: ` : ''}Invalid OAuth error response: ${error}. Raw body: ${body}`;
    return new ServerError(errorMessage);
  }
}

/**
 * Orchestrates the full auth flow with a server.
 *
 * This can be used as a single entry point for all authorization functionality,
 * instead of linking together the other lower-level functions in this module.
 */
export async function auth(
  provider: OAuthClientProvider,
  options: {
    serverUrl: string | URL;
    authorizationCode?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
  },
): Promise<AuthResult> {
  try {
    return await authInternal(provider, options);
  } catch (error) {
    // Handle recoverable error types by invalidating credentials and retrying
    if (
      error instanceof InvalidClientError ||
      error instanceof UnauthorizedClientError
    ) {
      await provider.invalidateCredentials?.('all');
      return await authInternal(provider, options);
    } else if (error instanceof InvalidGrantError) {
      await provider.invalidateCredentials?.('tokens');
      return await authInternal(provider, options);
    }

    // Throw otherwise
    throw error;
  }
}

async function authInternal(
  provider: OAuthClientProvider,
  {
    serverUrl,
    authorizationCode,
    scope,
    resourceMetadataUrl,
  }: {
    serverUrl: string | URL;
    authorizationCode?: string;
    scope?: string;
    resourceMetadataUrl?: URL;
  },
): Promise<AuthResult> {
  let resourceMetadata: OAuthProtectedResourceMetadata | undefined;
  let authorizationServerUrl = serverUrl;
  try {
    resourceMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl, {
      resourceMetadataUrl,
    });
    if (
      resourceMetadata.authorization_servers &&
      resourceMetadata.authorization_servers.length > 0
    ) {
      authorizationServerUrl = resourceMetadata.authorization_servers[0];
    }
  } catch {
    // Ignore errors and fall back to /.well-known/oauth-authorization-server
  }

  const resource: URL | undefined = await selectResourceURL(
    serverUrl,
    provider,
    resourceMetadata,
  );

  const metadata = await discoverOAuthMetadata(serverUrl, {
    authorizationServerUrl,
  });

  // Handle client registration if needed
  let clientInformation = await Promise.resolve(provider.clientInformation());
  if (!clientInformation) {
    if (authorizationCode !== undefined) {
      throw new Error(
        'Existing OAuth client information is required when exchanging an authorization code',
      );
    }

    if (!provider.saveClientInformation) {
      throw new Error(
        'OAuth client information must be saveable for dynamic registration',
      );
    }

    const fullInformation = await registerClient(authorizationServerUrl, {
      metadata,
      clientMetadata: provider.clientMetadata,
    });

    await provider.saveClientInformation(fullInformation);
    clientInformation = fullInformation;
  }

  // Exchange authorization code for tokens
  if (authorizationCode !== undefined) {
    const codeVerifier = await provider.codeVerifier();
    const tokens = await exchangeAuthorization(authorizationServerUrl, {
      metadata,
      clientInformation,
      authorizationCode,
      codeVerifier,
      redirectUri: provider.redirectUrl,
      resource,
      addClientAuthentication: provider.addClientAuthentication,
    });

    await provider.saveTokens(tokens);
    return 'AUTHORIZED';
  }

  const tokens = await provider.tokens();

  // Handle token refresh or new authorization
  if (tokens?.refresh_token) {
    try {
      // Attempt to refresh the token
      const newTokens = await refreshAuthorization(authorizationServerUrl, {
        metadata,
        clientInformation,
        refreshToken: tokens.refresh_token,
        resource,
        addClientAuthentication: provider.addClientAuthentication,
      });

      await provider.saveTokens(newTokens);
      return 'AUTHORIZED';
    } catch (error) {
      // If this is a ServerError, or an unknown type, log it out and try to continue. Otherwise, escalate so we can fix things and retry.
      if (!(error instanceof OAuthError) || error instanceof ServerError) {
        // Could not refresh OAuth tokens
      } else {
        // Refresh failed for another reason, re-throw
        throw error;
      }
    }
  }

  const state = provider.state ? await provider.state() : undefined;

  // Start new authorization flow
  const { authorizationUrl, codeVerifier } = await startAuthorization(
    authorizationServerUrl,
    {
      metadata,
      clientInformation,
      state,
      redirectUrl: provider.redirectUrl,
      scope: scope || provider.clientMetadata.scope,
      resource,
    },
  );

  await provider.saveCodeVerifier(codeVerifier);
  await provider.redirectToAuthorization(authorizationUrl);
  return 'REDIRECT';
}

export async function selectResourceURL(
  serverUrl: string | URL,
  provider: OAuthClientProvider,
  resourceMetadata?: OAuthProtectedResourceMetadata,
): Promise<URL | undefined> {
  const defaultResource = resourceUrlFromServerUrl(serverUrl);

  // If provider has custom validation, delegate to it
  if (provider.validateResourceURL) {
    return await provider.validateResourceURL(
      defaultResource,
      resourceMetadata?.resource,
    );
  }

  // Only include resource parameter when Protected Resource Metadata is present
  if (!resourceMetadata) {
    return undefined;
  }

  // Validate that the metadata's resource is compatible with our request
  if (
    !checkResourceAllowed({
      requestedResource: defaultResource,
      configuredResource: resourceMetadata.resource,
    })
  ) {
    throw new Error(
      `Protected resource ${resourceMetadata.resource} does not match expected ${defaultResource} (or origin)`,
    );
  }
  // Prefer the resource from metadata since it's what the server is telling us to request
  return new URL(resourceMetadata.resource);
}

/**
 * Extract resource_metadata from response header.
 */
export function extractResourceMetadataUrl(res: Response): URL | undefined {
  const authenticateHeader = res.headers.get('WWW-Authenticate');
  if (!authenticateHeader) {
    return undefined;
  }

  const [type, scheme] = authenticateHeader.split(' ');
  if (type.toLowerCase() !== 'bearer' || !scheme) {
    return undefined;
  }
  const regex = /resource_metadata="([^"]*)"/;
  const match = regex.exec(authenticateHeader);

  if (!match) {
    return undefined;
  }

  try {
    return new URL(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Looks up RFC 9728 OAuth 2.0 Protected Resource Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
export async function discoverOAuthProtectedResourceMetadata(
  serverUrl: string | URL,
  opts?: { protocolVersion?: string; resourceMetadataUrl?: string | URL },
): Promise<OAuthProtectedResourceMetadata> {
  const response = await discoverMetadataWithFallback(
    serverUrl,
    'oauth-protected-resource',
    {
      protocolVersion: opts?.protocolVersion,
      metadataUrl: opts?.resourceMetadataUrl,
    },
  );

  if (!response || response.status === 404) {
    throw new Error(
      `Resource server does not implement OAuth 2.0 Protected Resource Metadata.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`,
    );
  }
  return OAuthProtectedResourceMetadataSchema.parse(await response.json());
}

/**
 * Helper function to handle fetch with CORS retry logic
 */
async function fetchWithCorsRetry(
  url: URL,
  headers?: Record<string, string>,
): Promise<Response | undefined> {
  try {
    return await fetch(url, { headers });
  } catch (error) {
    if (error instanceof TypeError) {
      if (headers) {
        // CORS errors come back as TypeError, retry without headers
        return fetchWithCorsRetry(url);
      } else {
        // We're getting CORS errors on retry too, return undefined
        return undefined;
      }
    }
    throw error;
  }
}

/**
 * Constructs the well-known path for OAuth metadata discovery
 */
function buildWellKnownPath(wellKnownPrefix: string, pathname: string): string {
  let wellKnownPath = `/.well-known/${wellKnownPrefix}${pathname}`;
  if (pathname.endsWith('/')) {
    // Strip trailing slash from pathname to avoid double slashes
    wellKnownPath = wellKnownPath.slice(0, -1);
  }
  return wellKnownPath;
}

/**
 * Tries to discover OAuth metadata at a specific URL
 */
async function tryMetadataDiscovery(url: URL): Promise<Response | undefined> {
  const headers = {};
  return await fetchWithCorsRetry(url, headers);
}

/**
 * Determines if fallback to root discovery should be attempted
 */
function shouldAttemptFallback(
  response: Response | undefined,
  pathname: string,
): boolean {
  return !response || (response.status === 404 && pathname !== '/');
}

/**
 * Generic function for discovering OAuth metadata with fallback support
 */
async function discoverMetadataWithFallback(
  serverUrl: string | URL,
  wellKnownType: 'oauth-authorization-server' | 'oauth-protected-resource',
  opts?: {
    protocolVersion?: string;
    metadataUrl?: string | URL;
    metadataServerUrl?: string | URL;
  },
): Promise<Response | undefined> {
  const issuer = new URL(serverUrl);

  let url: URL;
  if (opts?.metadataUrl) {
    url = new URL(opts.metadataUrl);
  } else {
    // Try path-aware discovery first
    const wellKnownPath = buildWellKnownPath(wellKnownType, issuer.pathname);
    url = new URL(wellKnownPath, opts?.metadataServerUrl ?? issuer);
    url.search = issuer.search;
  }

  let response = await tryMetadataDiscovery(url);

  // If path-aware discovery fails with 404 and we're not already at root, try fallback to root discovery
  if (!opts?.metadataUrl && shouldAttemptFallback(response, issuer.pathname)) {
    const rootUrl = new URL(`/.well-known/${wellKnownType}`, issuer);
    response = await tryMetadataDiscovery(rootUrl);
  }

  return response;
}

/**
 * Looks up RFC 8414 OAuth 2.0 Authorization Server Metadata.
 *
 * If the server returns a 404 for the well-known endpoint, this function will
 * return `undefined`. Any other errors will be thrown as exceptions.
 */
export async function discoverOAuthMetadata(
  issuer: string | URL,
  {
    authorizationServerUrl,
    protocolVersion,
  }: {
    authorizationServerUrl?: string | URL;
    protocolVersion?: string;
  } = {},
): Promise<OAuthMetadata | undefined> {
  if (typeof issuer === 'string') {
    issuer = new URL(issuer);
  }
  if (!authorizationServerUrl) {
    authorizationServerUrl = issuer;
  }
  if (typeof authorizationServerUrl === 'string') {
    authorizationServerUrl = new URL(authorizationServerUrl);
  }
  protocolVersion ??= LATEST_PROTOCOL_VERSION;

  const response = await discoverMetadataWithFallback(
    authorizationServerUrl,
    'oauth-authorization-server',
    {
      protocolVersion,
      metadataServerUrl: authorizationServerUrl,
    },
  );

  if (!response || response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} trying to load well-known OAuth metadata`,
    );
  }

  return OAuthMetadataSchema.parse(await response.json());
}

/**
 * Begins the authorization flow with the given server, by generating a PKCE challenge and constructing the authorization URL.
 */
export async function startAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    redirectUrl,
    scope,
    state,
    resource,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    redirectUrl: string | URL;
    scope?: string;
    state?: string;
    resource?: URL;
  },
): Promise<{ authorizationUrl: URL; codeVerifier: string }> {
  const responseType = 'code';
  const codeChallengeMethod = 'S256';

  let authorizationUrl: URL;
  if (metadata) {
    authorizationUrl = new URL(metadata.authorization_endpoint);

    if (!metadata.response_types_supported.includes(responseType)) {
      throw new Error(
        `Incompatible auth server: does not support response type ${responseType}`,
      );
    }

    if (
      !metadata.code_challenge_methods_supported ||
      !metadata.code_challenge_methods_supported.includes(codeChallengeMethod)
    ) {
      throw new Error(
        `Incompatible auth server: does not support code challenge method ${codeChallengeMethod}`,
      );
    }
  } else {
    authorizationUrl = new URL('/authorize', authorizationServerUrl);
  }

  // Generate PKCE challenge
  const challenge = await pkceChallenge();
  const codeVerifier = challenge.code_verifier;
  const codeChallenge = challenge.code_challenge;

  authorizationUrl.searchParams.set('response_type', responseType);
  authorizationUrl.searchParams.set('client_id', clientInformation.client_id);
  authorizationUrl.searchParams.set('code_challenge', codeChallenge);
  authorizationUrl.searchParams.set(
    'code_challenge_method',
    codeChallengeMethod,
  );
  authorizationUrl.searchParams.set('redirect_uri', String(redirectUrl));

  if (state) {
    authorizationUrl.searchParams.set('state', state);
  }

  if (scope) {
    authorizationUrl.searchParams.set('scope', scope);
  }

  if (scope?.includes('offline_access')) {
    // if the request includes the OIDC-only "offline_access" scope,
    // we need to set the prompt to "consent" to ensure the user is prompted to grant offline access
    // https://openid.net/specs/openid-connect-core-1_0.html#OfflineAccess
    authorizationUrl.searchParams.append('prompt', 'consent');
  }

  if (resource) {
    authorizationUrl.searchParams.set('resource', resource.href);
  }

  return { authorizationUrl, codeVerifier };
}

/**
 * Exchanges an authorization code for an access token with the given server.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Falls back to appropriate defaults when server metadata is unavailable
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, auth code, etc.
 * @returns Promise resolving to OAuth tokens
 * @throws {Error} When token exchange fails or authentication is invalid
 */
export async function exchangeAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    authorizationCode,
    codeVerifier,
    redirectUri,
    resource,
    addClientAuthentication,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    authorizationCode: string;
    codeVerifier: string;
    redirectUri: string | URL;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
  },
): Promise<OAuthTokens> {
  const grantType = 'authorization_code';

  const tokenUrl = metadata?.token_endpoint
    ? new URL(metadata.token_endpoint)
    : new URL('/token', authorizationServerUrl);

  if (
    metadata?.grant_types_supported &&
    !metadata.grant_types_supported.includes(grantType)
  ) {
    throw new Error(
      `Incompatible auth server: does not support grant type ${grantType}`,
    );
  }

  // Exchange code for tokens
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    code: authorizationCode,
    code_verifier: codeVerifier,
    redirect_uri: String(redirectUri),
  });

  if (addClientAuthentication) {
    addClientAuthentication(headers, params, authorizationServerUrl, metadata);
  } else {
    // Determine and apply client authentication method
    const supportedMethods =
      metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(
      clientInformation,
      supportedMethods,
    );

    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }

  if (resource) {
    params.set('resource', resource.href);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthTokensSchema.parse(await response.json());
}

/**
 * Exchange a refresh token for an updated access token.
 *
 * Supports multiple client authentication methods as specified in OAuth 2.1:
 * - Automatically selects the best authentication method based on server support
 * - Preserves the original refresh token if a new one is not returned
 *
 * @param authorizationServerUrl - The authorization server's base URL
 * @param options - Configuration object containing client info, refresh token, etc.
 * @returns Promise resolving to OAuth tokens (preserves original refresh_token if not replaced)
 * @throws {Error} When token refresh fails or authentication is invalid
 */
export async function refreshAuthorization(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientInformation,
    refreshToken,
    resource,
    addClientAuthentication,
  }: {
    metadata?: OAuthMetadata;
    clientInformation: OAuthClientInformation;
    refreshToken: string;
    resource?: URL;
    addClientAuthentication?: OAuthClientProvider['addClientAuthentication'];
  },
): Promise<OAuthTokens> {
  const grantType = 'refresh_token';

  let tokenUrl: URL;
  if (metadata) {
    tokenUrl = new URL(metadata.token_endpoint);

    if (
      metadata.grant_types_supported &&
      !metadata.grant_types_supported.includes(grantType)
    ) {
      throw new Error(
        `Incompatible auth server: does not support grant type ${grantType}`,
      );
    }
  } else {
    tokenUrl = new URL('/token', authorizationServerUrl);
  }

  // Exchange refresh token
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  const params = new URLSearchParams({
    grant_type: grantType,
    refresh_token: refreshToken,
  });

  if (addClientAuthentication) {
    addClientAuthentication(headers, params, authorizationServerUrl, metadata);
  } else {
    // Determine and apply client authentication method
    const supportedMethods =
      metadata?.token_endpoint_auth_methods_supported ?? [];
    const authMethod = selectClientAuthMethod(
      clientInformation,
      supportedMethods,
    );

    applyClientAuthentication(authMethod, clientInformation, headers, params);
  }

  if (resource) {
    params.set('resource', resource.href);
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params,
  });
  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthTokensSchema.parse({
    refresh_token: refreshToken,
    ...(await response.json()),
  });
}

/**
 * Performs OAuth 2.0 Dynamic Client Registration according to RFC 7591.
 */
export async function registerClient(
  authorizationServerUrl: string | URL,
  {
    metadata,
    clientMetadata,
  }: {
    metadata?: OAuthMetadata;
    clientMetadata: OAuthClientMetadata;
  },
): Promise<OAuthClientInformationFull> {
  let registrationUrl: URL;

  if (metadata) {
    if (!metadata.registration_endpoint) {
      throw new Error(
        'Incompatible auth server: does not support dynamic client registration',
      );
    }

    registrationUrl = new URL(metadata.registration_endpoint);
  } else {
    registrationUrl = new URL('/register', authorizationServerUrl);
  }

  const response = await fetch(registrationUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clientMetadata),
  });

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  return OAuthClientInformationFullSchema.parse(await response.json());
}
