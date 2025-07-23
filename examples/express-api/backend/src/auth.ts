// src/auth.ts
import axios from 'axios';
import { createPrometheusJwtVerifier } from '@prometheus-protocol/typescript-sdk';
import { mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { config } from './config';

export async function configureAuth() {
  // 1. Fetch metadata from the Authorization Server
  const { data: oauthMetadata } = await axios.get(
    `${config.AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );

  // 2. Create the JWT verifier using the SDK helper
  const verifier = createPrometheusJwtVerifier({
    issuerUrl: config.AUTH_ISSUER,
    audienceUrl: config.SERVER_URL,
  });

  // 3. Define the scopes this server requires
  const requiredScopes = ['openid', 'prometheus:charge'];

  // 4. Create the bearer auth middleware that replaces the old `checkJwt`
  const bearerAuthMiddleware = requireBearerAuth({
    verifier,
    requiredScopes,
    resourceMetadataUrl: `${config.SERVER_URL}/.well-known/oauth-protected-resource`,
  });

  // 5. Create the metadata router that replaces the manual `.well-known` endpoint
  const metadataRouter = mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: new URL(config.SERVER_URL),
    scopesSupported: requiredScopes,
    resourceName: 'MCP Express Demo Server',
  });

  return { bearerAuthMiddleware, metadataRouter };
}
