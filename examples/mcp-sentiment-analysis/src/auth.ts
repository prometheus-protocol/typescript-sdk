import axios from 'axios';
import { mcpAuthMetadataRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { config } from './config';
import { createPrometheusJwtVerifier } from './verifier';

// --- Main Auth Configuration Function ---
export async function configureAuth() {
  // 1. Fetch metadata dynamically from the Authorization Server
  console.log(
    `Fetching OAuth metadata from: ${config.AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );
  const { data: oauthMetadata } = await axios.get(
    `${config.AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );
  console.log('Successfully fetched OAuth metadata.');

  // 2. Create the JWT verifier with a single line of code from the SDK
  const verifier = createPrometheusJwtVerifier({
    issuerUrl: config.AUTH_ISSUER,
    audienceUrl: config.SERVER_URL,
  });

  // 3. Define the scopes this specific server requires
  const requiredScopes = ['openid', 'prometheus:charge'];

  // 4. Create the bearer auth middleware for protecting routes
  const bearerAuthMiddleware = requireBearerAuth({
    verifier, // Use the verifier created by the SDK
    requiredScopes,
    resourceMetadataUrl: `${config.SERVER_URL}/.well-known/oauth-protected-resource`,
  });

  // 5. Create the metadata router using the fetched data
  const metadataRouter = mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: new URL(config.SERVER_URL),
    scopesSupported: requiredScopes,
    resourceName: 'Sentiment Analyzer Server', // Updated for this specific server
  });

  return { bearerAuthMiddleware, metadataRouter };
}
