import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageOAuthProvider } from '../src/provider';
import {
  type OAuthClientInformationFull,
  type OAuthTokens,
} from '../src/oauth';

// Test data
const mockMetadata = {
  client_name: 'Test App',
  scope: 'openid',
  redirect_uris: ['http://localhost:3000'],
};
const mockRedirectUrl = 'http://localhost:3000';

describe('LocalStorageOAuthProvider', () => {
  let provider: LocalStorageOAuthProvider;

  // Ensure a clean state before each test by clearing storage
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    provider = new LocalStorageOAuthProvider(mockMetadata, mockRedirectUrl);
  });

  it('should save and retrieve client information', () => {
    const clientInfo: OAuthClientInformationFull = {
      client_id: 'test-client-id',
      client_secret: 'test-client-secret',
      // Include all required fields for the full client information
      client_name: 'Test App',
      scope: 'openid',
      redirect_uris: ['http://localhost:3000'],
    };
    provider.saveClientInformation(clientInfo);
    const retrieved = provider.clientInformation();
    expect(retrieved).toEqual(clientInfo);
  });

  it('should save and retrieve tokens', () => {
    const tokens: OAuthTokens = {
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid',
    };
    provider.saveTokens(tokens);
    const retrieved = provider.tokens();
    expect(retrieved).toEqual(tokens);
  });

  it('should save and retrieve code verifier from sessionStorage', () => {
    const codeVerifier = 'my-secret-code-verifier';
    provider.saveCodeVerifier(codeVerifier);
    const retrieved = provider.codeVerifier();
    expect(retrieved).toBe(codeVerifier);
  });

  it('should throw an error if code verifier is not found', () => {
    expect(() => provider.codeVerifier()).toThrow(
      'Code verifier not found in session storage.',
    );
  });

  it('should invalidate all credentials', () => {
    provider.saveClientInformation({ client_id: 'id', redirect_uris: [] });
    provider.saveTokens({ access_token: 'token', token_type: 'Bearer' });
    provider.saveCodeVerifier('verifier');

    provider.invalidateCredentials('all');

    expect(provider.clientInformation()).toBeUndefined();
    expect(provider.tokens()).toBeUndefined();
    expect(() => provider.codeVerifier()).toThrow();
  });
});
