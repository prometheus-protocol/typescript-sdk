/**
 * @module
 * This module provides a concrete implementation of the `OAuthClientProvider` interface
 * using the browser's Web Storage API. It persists long-term credentials like client
 * information and tokens in `localStorage`, and short-term, flow-specific secrets
 * like the PKCE code verifier in `sessionStorage`.
 */

import {
  type OAuthClientProvider,
  type OAuthClientMetadata,
  type OAuthClientInformation,
  type OAuthTokens,
  type OAuthClientInformationFull,
} from './browser';

/**
 * An implementation of the `OAuthClientProvider` that uses the browser's
 * `localStorage` and `sessionStorage` to persist OAuth credentials.
 *
 * @internal This class is an internal implementation detail of the SDK and is not
 * intended for direct use by application developers.
 */
export class LocalStorageOAuthProvider implements OAuthClientProvider {
  /** @private The key used to store client information in localStorage. */
  private readonly CLIENT_INFO_KEY = 'prometheus_client_info';
  /** @private The key used to store OAuth tokens in localStorage. */
  private readonly TOKENS_KEY = 'prometheus_tokens';
  /** @private The key used to store the PKCE code verifier in sessionStorage. */
  private readonly CODE_VERIFIER_KEY = 'prometheus_code_verifier';

  /** The client metadata provided during initialization. */
  public readonly clientMetadata: OAuthClientMetadata;
  /** The redirect URL for this client. */
  public readonly redirectUrl: string;

  /**
   * Initializes a new instance of the LocalStorageOAuthProvider.
   * @param metadata The static metadata describing the client application.
   * @param redirectUrl The URL the user will be redirected to after authorization.
   */
  constructor(metadata: OAuthClientMetadata, redirectUrl: string) {
    this.clientMetadata = metadata;
    this.redirectUrl = redirectUrl;
  }

  // --- Client Information ---

  /**
   * Retrieves the stored client information from `localStorage`.
   * @returns The stored `OAuthClientInformation`, or `undefined` if not found.
   */
  clientInformation(): OAuthClientInformation | undefined {
    const stored = localStorage.getItem(this.CLIENT_INFO_KEY);
    return stored ? JSON.parse(stored) : undefined;
  }

  /**
   * Saves the client information to `localStorage`.
   * @param info The full client information received after dynamic registration.
   */
  saveClientInformation(info: OAuthClientInformationFull): void {
    localStorage.setItem(this.CLIENT_INFO_KEY, JSON.stringify(info));
  }

  // --- Tokens ---

  /**
   * Retrieves the stored OAuth tokens from `localStorage`.
   * @returns The stored `OAuthTokens`, or `undefined` if not found.
   */
  tokens(): OAuthTokens | undefined {
    const stored = localStorage.getItem(this.TOKENS_KEY);
    return stored ? JSON.parse(stored) : undefined;
  }

  /**
   * Saves the OAuth tokens to `localStorage`.
   * @param tokens The tokens to save.
   */
  saveTokens(tokens: OAuthTokens): void {
    localStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
  }

  // --- PKCE Flow ---

  /**
   * Saves the PKCE code verifier to `sessionStorage`.
   * Uses `sessionStorage` because the code verifier is a short-lived secret
   * tied to a single authorization flow and should be cleared when the tab is closed.
   * @param codeVerifier The code verifier string to save.
   */
  saveCodeVerifier(codeVerifier: string): void {
    sessionStorage.setItem(this.CODE_VERIFIER_KEY, codeVerifier);
  }

  /**
   * Retrieves the PKCE code verifier from `sessionStorage`.
   * @returns The stored code verifier.
   * @throws `Error` if the code verifier is not found in storage.
   */
  codeVerifier(): string {
    const verifier = sessionStorage.getItem(this.CODE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Code verifier not found in session storage.');
    }
    return verifier;
  }

  // --- Redirect ---

  /**
   * Redirects the user's browser to the provided authorization URL.
   * This will cause a full page navigation.
   * @param authorizationUrl The URL of the authorization server's `/authorize` endpoint.
   */
  redirectToAuthorization(authorizationUrl: URL): void {
    window.location.href = authorizationUrl.toString();
  }

  // --- State Param ---

  /**
   * Generates a random state parameter for CSRF protection.
   * This should be used in the authorization request to prevent CSRF attacks.
   * @returns A random string to be used as the state parameter.
   */
  state(): string {
    const array = new Uint32Array(10);
    window.crypto.getRandomValues(array);
    return Array.from(array, (num) => num.toString(36)).join('');
  }

  // --- Invalidation ---

  /**
   * Clears stored credentials from browser storage. Useful for logout functionality
   * or handling authentication errors that require a fresh start.
   * @param scope Specifies which parts of the stored credentials to clear.
   */
  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): void {
    console.log(`Invalidating credentials for scope: ${scope}`);
    if (scope === 'all' || scope === 'tokens') {
      localStorage.removeItem(this.TOKENS_KEY);
    }
    if (scope === 'all' || scope === 'client') {
      localStorage.removeItem(this.CLIENT_INFO_KEY);
    }
    if (scope === 'all' || scope === 'verifier') {
      sessionStorage.removeItem(this.CODE_VERIFIER_KEY);
    }
  }
}
