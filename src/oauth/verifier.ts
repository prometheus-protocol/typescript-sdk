import { InvalidTokenError } from './errors';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import type { AuthInfo } from './types';

/**
 * Configuration for the Prometheus JWT Verifier.
 */
export interface PrometheusJwtVerifierConfig {
  /** The URL of the OAuth 2.0 Authorization Server (e.g., "https://auth.portal.one"). */
  issuerUrl: string;
  /** The public URL of your Resource Server (e.g., "https://api.my-service.com"). */
  audienceUrl: string;
}

/**
 * Creates a verifier object that can validate Prometheus-compliant JWT access tokens.
 * This handles JWKS key fetching and standard JWT claim validation.
 *
 * @param config The configuration containing the issuer and audience URLs.
 * @returns An object with a `verifyAccessToken` method.
 */
export function createPrometheusJwtVerifier(
  config: PrometheusJwtVerifierConfig,
) {
  const { issuerUrl, audienceUrl } = config;
  const jwksUri = `${issuerUrl}/.well-known/jwks.json`;
  const jwksRsaClient = jwksClient({ jwksUri });

  function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!header.kid) {
      return callback(
        new Error('Access token is missing a "kid" (Key ID) in the header.'),
      );
    }
    jwksRsaClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        return callback(err);
      }
      callback(null, key?.getPublicKey());
    });
  }

  async function verifyAccessToken(token: string): Promise<AuthInfo> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: audienceUrl,
          issuer: issuerUrl,
          algorithms: ['ES256'],
        },
        (err, decoded) => {
          if (err) {
            console.error('JWT verification failed:', err.message);
            return reject(new InvalidTokenError(err.message));
          }
          const payload = decoded as jwt.JwtPayload;

          if (!payload.azp && !payload.client_id) {
            return reject(
              new InvalidTokenError(
                'Access token is missing "azp" or "client_id" claim.',
              ),
            );
          }

          if (!payload.scope) {
            return reject(
              new InvalidTokenError('Access token is missing "scope" claim.'),
            );
          }

          if (!payload.exp) {
            return reject(
              new InvalidTokenError('Access token is missing "exp" claim.'),
            );
          }

          if (!payload.sub) {
            return reject(
              new InvalidTokenError('Access token is missing "sub" claim.'),
            );
          }

          resolve({
            token,
            clientId: payload.azp || payload.client_id,
            scopes: payload.scope ? payload.scope.split(' ') : [],
            expiresAt: payload.exp,
            resource: new URL(audienceUrl),
            extra: { caller: payload.sub },
          });
        },
      );
    });
  }

  return { verifyAccessToken };
}
