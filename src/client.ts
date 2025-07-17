/**
 * @module
 * This module provides the main entry point for browser-based applications to integrate
 * with the Prometheus Protocol. It simplifies the complex OAuth2 flow into a single
 * function call.
 */

import { auth, type OAuthClientMetadata, type OAuthTokens } from './oauth';
import { LocalStorageOAuthProvider } from './provider';

/**
 * Configuration options for the Prometheus Browser Client.
 */
export interface PrometheusClientOptions {
  /** The canister Principal ID of the main Prometheus auth canister. */
  authCanisterId: string;
  /** The full base URL of the target resource server API (e.g., "https://api.myapp.com"). */
  resourceServerUrl: string;
  /** The host URL for the Internet Computer (e.g., "https://icp-api.io" for production). */
  icHost: string;
  /**
   * Metadata for this client application, used for Dynamic Client Registration.
   * The `redirect_uris` will be automatically set to the current window's origin.
   */
  clientMetadata: Omit<OAuthClientMetadata, 'redirect_uris'>;
}

/**
 * Represents an authenticated client instance returned after a successful login flow.
 * It holds the user's tokens and provides convenience methods for accessing them.
 */
export interface PrometheusClient {
  /** The raw OAuth tokens (`access_token`, `refresh_token`, etc.). */
  tokens: OAuthTokens;
  /** A method to get the user's Principal ID (the `sub` claim) from the access token. */
  getPrincipal: () => string;
  /** A method to get the raw access token string, suitable for use in an `Authorization: Bearer` header. */
  getAccessToken: () => string;
}

/**
 * Handles the entire browser-based OAuth2 flow, including Dynamic Client
 * Registration, token exchange, and token refresh. This is the recommended entry
 * point for browser applications.
 *
 * **IMPORTANT:** This function is designed to be called on every page load.
 * On the first run for a new user, it will trigger a full-page redirect to the
 * Prometheus login page. In this scenario, the returned promise will **never resolve**,
 * as the page context is navigated away.
 *
 * After the user authenticates and is redirected back to your application, this
 * function should be called again. It will automatically handle the authorization
 * code exchange, clear the code from the URL, and resolve with an authenticated
 * `PrometheusClient` instance.
 *
 * @param options The configuration options for the client.
 * @returns A promise that resolves with an authenticated `PrometheusClient` instance.
 *          This promise does not resolve if a redirect is initiated.
 * @throws `Error` if the authorization flow completes successfully but no tokens are
 *         found in storage, indicating an internal state inconsistency.
 */
export async function createPrometheusClient(
  options: PrometheusClientOptions,
): Promise<PrometheusClient> {
  // 1. The provider is an internal implementation detail that handles storage.
  const provider = new LocalStorageOAuthProvider(
    {
      ...options.clientMetadata,
      redirect_uris: [window.location.origin], // Automatically use the current origin.
    },
    window.location.origin,
  );

  // 2. Construct the URL to discover the resource server's metadata.
  const resourceMetadataUrl = new URL(
    '/.well-known/oauth-protected-resource',
    options.resourceServerUrl,
  );

  // 3. Check if an authorization code is present in the URL from a redirect.
  const authCode =
    new URLSearchParams(window.location.search).get('code') ?? undefined;

  // 4. Call the low-level orchestrator which handles all OAuth logic.
  const result = await auth(provider, {
    serverUrl: options.resourceServerUrl,
    authorizationCode: authCode,
    scope: options.clientMetadata.scope,
    resourceMetadataUrl,
  });

  // 5. If the flow is complete, construct and return a useful client object.
  if (result === 'AUTHORIZED') {
    const tokens = provider.tokens();
    if (!tokens) {
      // This should not happen in a correct flow, but we check for safety.
      throw new Error('Authorization successful but no tokens found.');
    }

    // Clean the authorization code from the URL for a better user experience.
    history.replaceState({}, document.title, window.location.pathname);

    return {
      tokens,
      getAccessToken: () => tokens.access_token,
      getPrincipal: () => {
        // The principal is the 'sub' (subject) claim in the JWT payload.
        const payload = JSON.parse(atob(tokens.access_token.split('.')[1]));
        return payload.sub;
      },
    };
  }

  // If the result was 'REDIRECT', this part of the code is unreachable
  // because the browser has already navigated away. We add a fallback
  // for type safety and unexpected states.
  throw new Error('Authentication flow did not complete or redirect.');
}
