import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import {
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

/**
 * Configuration for the Prometheus JWT Verifier.
 */
export interface PrometheusJwtVerifierConfig {
  /** The URL of the OAuth 2.0 Authorization Server (e.g., "https://auth.portal.one"). */
  issuerUrl: string;
  /** The public URL of your Resource Server (e.g., "https://api.my-service.com"). */
  audienceUrl: string;
}

export function createPrometheusJwtVerifier(
  config: PrometheusJwtVerifierConfig,
) {
  const { issuerUrl, audienceUrl } = config;
  const jwksUri = `${issuerUrl}/.well-known/jwks.json`;
  // Configure a timeout for the JWKS client. If the auth server is slow,
  // we need to fail fast and not hang requests.
  const jwksRsaClient = jwksClient({
    jwksUri,
    cache: true, // Recommended for performance
    jwksRequestsPerMinute: 5, // Prevents overwhelming the auth server
    timeout: 5000, // 5 second timeout
  });

  /**
   * This function now distinguishes between different failure modes.
   */
  function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!header.kid) {
      // This is a client error: the token is malformed.
      return callback(
        new InvalidTokenError(
          'Token is missing a "kid" (Key ID) in the header.',
        ),
      );
    }

    jwksRsaClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        // THIS IS THE KEY CHANGE.
        // An error here means we failed to fetch the keys. This is a SERVER problem,
        // not a client token problem.
        console.error(
          `[ServerError] Failed to retrieve signing key for kid ${header.kid}:`,
          err,
        );
        return callback(
          new ServerError(
            `Upstream error: Could not retrieve signing keys from ${jwksUri}.`,
          ),
        );
      }
      if (!key) {
        // This is a client error: the token's kid is invalid or unknown.
        return callback(
          new InvalidTokenError(`Token contains an invalid "kid" (Key ID).`),
        );
      }
      callback(null, key.getPublicKey());
    });
  }

  async function verifyAccessToken(token: string): Promise<AuthInfo> {
    try {
      const decoded = await new Promise<jwt.JwtPayload>((resolve, reject) => {
        jwt.verify(
          token,
          getKey, // Our new, smarter getKey function
          {
            audience: audienceUrl,
            issuer: issuerUrl,
            algorithms: ['ES256'],
            ignoreExpiration: true,
          },
          (err, decodedPayload) => {
            // Let the outer catch block handle classification.
            // Just reject with the original error from jwt.verify or our getKey function.
            if (err) return reject(err);
            resolve(decodedPayload as jwt.JwtPayload);
          },
        );
      });

      // All checks below are for malformed but otherwise validly signed tokens.
      // These are all client errors.
      if (!decoded.azp)
        throw new InvalidTokenError('Token is missing "azp" claim.');
      if (!decoded.scope)
        throw new InvalidTokenError('Token is missing "scope" claim.');
      if (!decoded.exp)
        throw new InvalidTokenError('Token is missing "exp" claim.');
      if (!decoded.sub)
        throw new InvalidTokenError('Token is missing "sub" claim.');

      return {
        token,
        clientId: decoded.azp,
        scopes: decoded.scope.split(' '),
        expiresAt: decoded.exp,
        resource: new URL(audienceUrl),
        extra: { caller: decoded.sub },
      };
    } catch (error) {
      // This catch block now correctly classifies errors.
      if (error instanceof ServerError) {
        // If it's already a ServerError (from our getKey function), let it bubble up.
        console.error(
          '[ServerError] An error occurred during token verification:',
          error.message,
        );
        throw error;
      }

      if (error instanceof InvalidTokenError) {
        // If it's already an InvalidTokenError (from claim checks or getKey), let it bubble up.
        console.error(
          `[InvalidTokenError] JWT verification failed: ${error.message}`,
        );
        throw error;
      }

      // Any other error from the 'jsonwebtoken' library (e.g., TokenExpiredError, JsonWebTokenError for bad signature)
      // should be classified as an InvalidTokenError.
      if (error instanceof Error) {
        console.error(
          `[InvalidTokenError] JWT verification failed: ${error.message}`,
        );
        throw new InvalidTokenError(error.message);
      }

      // Fallback for truly unexpected throws.
      console.error(
        '[ServerError] An unknown error occurred during token verification:',
        error,
      );
      throw new ServerError(
        'An unknown internal error occurred during token verification.',
      );
    }
  }

  return { verifyAccessToken };
}
