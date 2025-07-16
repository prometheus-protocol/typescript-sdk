import { auth, type OAuthClientMetadata, type OAuthTokens } from './oauth';
import { LocalStorageOAuthProvider } from './provider';

/**
 * Configuration options for the Prometheus Browser Client.
 */
export interface PrometheusClientOptions {
  authCanisterId: string;
  resourceServerUrl: string; // The full base URL of the resource server API
  icHost: string;
  clientMetadata: Omit<OAuthClientMetadata, 'redirect_uris'>;
}

/**
 * An authenticated client instance.
 */
export interface PrometheusClient {
  tokens: OAuthTokens;
  getPrincipal: () => string;
  getAccessToken: () => string;
}

/**
 * Handles the entire browser-based OAuth2 flow, including Dynamic Client
 * Registration, token exchange, and token refresh.
 *
 * This is the recommended entry point for browser applications.
 *
 * @returns A promise that resolves with an authenticated client instance if login
 * is successful, or never resolves if a redirect is required.
 */
export async function createPrometheusClient(
  options: PrometheusClientOptions,
): Promise<PrometheusClient | void> {
  // 1. The provider is now an internal implementation detail.
  const provider = new LocalStorageOAuthProvider(
    {
      ...options.clientMetadata,
      redirect_uris: [window.location.origin],
    },
    window.location.origin,
  );

  const resourceMetadataUrl = new URL(
    '/.well-known/oauth-protected-resource',
    options.resourceServerUrl,
  );

  // 3. Parse the auth code from the URL.
  const authCode =
    new URLSearchParams(window.location.search).get('code') ?? undefined;

  // 4. Call the low-level orchestrator.
  const result = await auth(provider, {
    serverUrl: options.resourceServerUrl,
    authorizationCode: authCode,
    scope: options.clientMetadata.scope,
    resourceMetadataUrl,
  });

  if (result === 'AUTHORIZED') {
    // 5. On success, return a useful client object.
    const tokens = provider.tokens();
    if (!tokens) {
      throw new Error('Authorization successful but no tokens found.');
    }
    history.replaceState({}, document.title, window.location.pathname); // Clean URL

    return {
      tokens,
      getAccessToken: () => tokens.access_token,
      getPrincipal: () =>
        JSON.parse(atob(tokens.access_token.split('.')[1])).sub,
    };
  }
}
