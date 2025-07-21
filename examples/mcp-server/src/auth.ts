import 'dotenv/config';
import axios from 'axios';
import { mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types';

// --- Environment Variables ---
const AUTH_ISSUER = process.env.AUTH_ISSUER!;
const AUTH_JWKS_URI = `${AUTH_ISSUER}/.well-known/jwks.json`;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:3000`;
const AUTH_AUDIENCE = SERVER_URL; // Use the server URL as the audience

// --- JWT Verification Logic (from previous step) ---
const jwksRsaClient = jwksClient({ jwksUri: AUTH_JWKS_URI });

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  if (!header.kid) return callback(new Error('Token is missing KID'));
  jwksRsaClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

async function verifyJwtAndGetAuthContext(token: string): Promise<AuthInfo> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      { audience: AUTH_AUDIENCE, issuer: AUTH_ISSUER, algorithms: ['ES256'] },
      (err, decoded) => {
        if (err) {
          console.error('JWT verification failed:', err);
          return reject(new InvalidTokenError(err.message));
        }
        const payload = decoded as jwt.JwtPayload;

        console.log('--- Decoded Payload by MCP Server ---');
        console.log(payload);

        resolve({
          token,
          clientId: payload.azp || payload.client_id,
          scopes: payload.scope ? payload.scope.split(' ') : [],
          expiresAt: payload.exp,
          resource: new URL(SERVER_URL),
          extra: { user_id: payload.sub },
        });
      },
    );
  });
}

// --- Main Auth Configuration Function ---
export async function configureAuth() {
  // 1. Fetch metadata dynamically from the Authorization Server
  console.log(
    `Fetching OAuth metadata from: ${AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );
  const { data: oauthMetadata } = await axios.get(
    `${AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );
  console.log('Successfully fetched OAuth metadata.');

  const scopes = ['openid', 'prometheus:charge'];

  // 2. Create the bearer auth middleware for protecting routes
  const bearerAuthMiddleware = requireBearerAuth({
    verifier: { verifyAccessToken: verifyJwtAndGetAuthContext },
    requiredScopes: scopes, // Example scope
    resourceMetadataUrl: `${SERVER_URL}/.well-known/oauth-protected-resource`,
  });

  // 3. Create the metadata router using the fetched data
  const metadataRouter = mcpAuthMetadataRouter({
    oauthMetadata, // Use the dynamically fetched metadata here!
    resourceServerUrl: new URL(SERVER_URL),
    scopesSupported: scopes, // Scopes your resource server supports
    resourceName: 'MCP Demo Server',
  });

  return { bearerAuthMiddleware, metadataRouter };
}
