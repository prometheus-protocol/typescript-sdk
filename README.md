# `@prometheus-protocol/typescript-sdk`

This is the official TypeScript SDK for the [Prometheus Protocol](https://github.com/prometheus-protocol). It provides a simple and powerful way to integrate the Prometheus authentication and payment rail into both frontend and backend JavaScript/TypeScript applications.

## Key Features

The SDK is a monorepo that provides several packages, but the key components for developers are:

- **Browser Client:** For frontend applications (SPAs, React, Svelte, etc.) to handle the user-facing OAuth2 authentication flow.
- **Server Components:** For backend services (Node.js) to protect API endpoints and initiate microtransactions. This includes a built-in JWT verifier that handles all complex token validation.
- **Prometheus CLI (`prometheus-cli`):** A command-line tool to streamline the registration and configuration of your local development environment.

## Installation

```bash
# Install the SDK and required peer dependencies for a backend server
npm install @prometheus-protocol/typescript-sdk express cors axios
```

---

## Live Ecosystem & Demos

Prometheus is live on ICP mainnet. You can interact with the protocol and see it in action through these resources:

- **[Prometheus Protocol Dashboard](https://bmfnl-jqaaa-aaaai-q32ha-cai.icp0.io/):** Manage your client applications, grants, and allowances.
- **[PMP Token Faucet](https://remote-mcp-servers.com/servers/e4dc7647-14d3-43da-8513-3087e013cd3b):** A live MCP server that provides free PMP test tokens to help you get started with development.
- **[Sentiment Analysis Demo](https://remote-mcp-servers.com/servers/491314bc-27b3-4070-b2c2-39ad971c36c4):** A simple, monetized AI tool built with our TypeScript SDK that demonstrates the end-to-end payment flow.

## Full Tutorial: Building an MCP Server from Scratch

This guide will walk you through creating a brand new, monetized Node.js API server from an empty directory.

### Step 1: Project Initialization

First, set up a new Node.js project with TypeScript.

```bash
# Create and enter the project directory
mkdir my-mcp-server
cd my-mcp-server

# Initialize a new npm project
npm init -y

# Install production dependencies
npm install @prometheus-protocol/typescript-sdk express cors axios zod

# Install development dependencies
npm install -D typescript ts-node-dev @types/node @types/express @types/cors
```

### Step 2: Configure TypeScript

Create a `tsconfig.json` file in your project root. This configuration is set up for a modern Node.js project with ES Modules.

**`tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 3: Setup with `prometheus-cli`

The `prometheus-cli` tool replaces all manual `dfx` commands for identity creation and service registration.

For a new server, run `register`. This will guide you through creating a dedicated service identity and registering your server with the protocol.

```bash
npx prometheus-cli register
```

This command will create two important files:

- `.env`: Contains your local environment variables. **Do not commit this file.**
- `prometheus-tokens.json`: A list of supported payment tokens. **Commit this file.**

### Step 4: Write the Server Code

Create a `src` directory and add the following files. This structure separates concerns for a clean, maintainable server.

**`src/config.ts`** (Handles all environment variable loading and validation)

```typescript
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3000),
    AUTH_ISSUER: z.string().url(),
    SERVER_URL: z.string().url(),
    PAYOUT_PRINCIPAL: z.string().min(1),
    IDENTITY_PEM_PATH: z.string().optional(),
    IDENTITY_PEM_CONTENT: z.string().optional(),
  })
  .refine((data) => data.IDENTITY_PEM_PATH || data.IDENTITY_PEM_CONTENT, {
    message:
      'Either IDENTITY_PEM_PATH or IDENTITY_PEM_CONTENT must be defined.',
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsedEnv.error.flatten().fieldErrors,
  );
  throw new Error('Invalid environment variables.');
}

export const config = Object.freeze(parsedEnv.data);
```

**`src/auth.ts`** (Configures all authentication and metadata endpoints)

```typescript
import axios from 'axios';
import {
  mcpAuthMetadataRouter,
  requireBearerAuth,
  createPrometheusJwtVerifier,
} from '@prometheus-protocol/typescript-sdk';
import { config } from './config.js';

export async function configureAuth() {
  const { data: oauthMetadata } = await axios.get(
    `${config.AUTH_ISSUER}/.well-known/oauth-authorization-server`,
  );

  const verifier = createPrometheusJwtVerifier({
    issuerUrl: config.AUTH_ISSUER,
    audienceUrl: config.SERVER_URL,
  });

  const requiredScopes = ['openid', 'prometheus:charge'];

  const bearerAuthMiddleware = requireBearerAuth({
    verifier,
    requiredScopes,
    resourceMetadataUrl: `${config.SERVER_URL}/.well-known/oauth-protected-resource`,
  });

  const metadataRouter = mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: new URL(config.SERVER_URL),
    scopesSupported: requiredScopes,
    resourceName: 'My Awesome API Server',
  });

  return { bearerAuthMiddleware, metadataRouter };
}
```

**`src/index.ts`** (The main application entry point)

```typescript
import express from 'express';
import cors from 'cors';
import {
  PrometheusServerClient,
  identityFromPem,
  identityFromPemContent,
} from '@prometheus-protocol/typescript-sdk';
import { Principal } from '@dfinity/principal';
import { config } from './config.js';
import { configureAuth } from './auth.js';
import fs from 'fs';

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const { bearerAuthMiddleware, metadataRouter } = await configureAuth();
  app.use(metadataRouter);

  const identity = config.IDENTITY_PEM_CONTENT
    ? identityFromPemContent(config.IDENTITY_PEM_CONTENT)
    : identityFromPem(fs.readFileSync(config.IDENTITY_PEM_PATH!, 'utf-8'));

  const prometheusClient = new PrometheusServerClient({
    identity,
    payoutPrincipal: Principal.fromText(config.PAYOUT_PRINCIPAL),
    tokenConfigPath: './prometheus-tokens.json',
  });

  const paymentMiddleware = async (req, res, next) => {
    const userPrincipal = req.auth.sub;
    const result = await prometheusClient.charge({
      userToCharge: Principal.fromText(userPrincipal),
      amount: 0.1, // Example: charge 0.1 ICP of the token specified in registration
    });

    if (result.ok) {
      console.log(`✅ Payment successful for ${userPrincipal}.`);
      next();
    } else {
      res.status(402).json({ error: 'Payment Required', details: result.err });
    }
  };

  app.get(
    '/api/secret-data',
    bearerAuthMiddleware,
    paymentMiddleware,
    (req, res) => {
      res.json({
        message: `Access granted to ${req.auth.sub}. The secret data is: 42.`,
      });
    },
  );

  app.listen(config.PORT, () =>
    console.log(`Server listening on port ${config.PORT}`),
  );
}

main().catch(console.error);
```

### Step 5: Run the Server

Add a `start` script to your `package.json`.

**`package.json`**

```json
{
  // ... other fields
  "type": "module",
  "scripts": {
    "start": "ts-node-dev --respawn --transpile-only src/index.ts"
  }
}
```

Now, start your server!

```bash
npm run start
```

Your monetized API is now running locally.

### Step 6: Next Steps - Deployment

To deploy your server, you need to containerize it with a `Dockerfile` and host it on a platform like Google Cloud Run, AWS ECS, or Azure App Service. Review the "Production Deployment Concepts" section in the `sentiment-analyzer`'s README for best practices on handling secrets and environment variables in a production environment.

---

## Contributing

Contributions are welcome! Please see the main [Prometheus Protocol repository](https://github.com/prometheus-protocol) for overall project goals and contribution guidelines.

## License

This SDK is licensed under the [MIT License](LICENSE).
