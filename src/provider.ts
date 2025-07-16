import {
  type OAuthClientProvider,
  type OAuthClientMetadata,
  type OAuthClientInformation,
  type OAuthTokens,
  type OAuthClientInformationFull,
} from '@prometheus-protocol/typescript-sdk/browser';

// Implementation of the provider that uses browser storage
export class LocalStorageOAuthProvider implements OAuthClientProvider {
  private readonly CLIENT_INFO_KEY = 'prometheus_client_info';
  private readonly TOKENS_KEY = 'prometheus_tokens';
  private readonly CODE_VERIFIER_KEY = 'prometheus_code_verifier';

  public readonly clientMetadata: OAuthClientMetadata;
  public readonly redirectUrl: string;

  constructor(metadata: OAuthClientMetadata, redirectUrl: string) {
    this.clientMetadata = metadata;
    this.redirectUrl = redirectUrl;
  }

  // --- Client Information ---
  clientInformation(): OAuthClientInformation | undefined {
    const stored = localStorage.getItem(this.CLIENT_INFO_KEY);
    return stored ? JSON.parse(stored) : undefined;
  }

  saveClientInformation(info: OAuthClientInformationFull): void {
    localStorage.setItem(this.CLIENT_INFO_KEY, JSON.stringify(info));
  }

  // --- Tokens ---
  tokens(): OAuthTokens | undefined {
    const stored = localStorage.getItem(this.TOKENS_KEY);
    return stored ? JSON.parse(stored) : undefined;
  }

  saveTokens(tokens: OAuthTokens): void {
    localStorage.setItem(this.TOKENS_KEY, JSON.stringify(tokens));
  }

  // --- PKCE Flow ---
  saveCodeVerifier(codeVerifier: string): void {
    // Use sessionStorage for the verifier as it's tied to a single auth flow
    sessionStorage.setItem(this.CODE_VERIFIER_KEY, codeVerifier);
  }

  codeVerifier(): string {
    const verifier = sessionStorage.getItem(this.CODE_VERIFIER_KEY);
    if (!verifier) {
      throw new Error('Code verifier not found in session storage.');
    }
    return verifier;
  }

  // --- Redirect ---
  redirectToAuthorization(authorizationUrl: URL): void {
    window.location.href = authorizationUrl.toString();
  }

  // --- Invalidation ---
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
