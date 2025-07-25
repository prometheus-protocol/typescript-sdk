import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { configureAuth } from './auth';
import morgan from 'morgan';
import {
  identityFromPem,
  identityFromPemContent,
  PrometheusServerClient,
} from '@prometheus-protocol/typescript-sdk';
import { Principal } from '@dfinity/principal';
import { config } from './config';

const MAX_BALANCE = 100; // The maximum balance a user can hold
const CLAIM_AMOUNT = 10; // The amount a user receives per claim

// +++ 3. CONFIGURE THE PROMETHEUS CLIENT CORRECTLY +++
// The SDK is smart enough to handle the host and fetchRootKey logic.
// We just need to provide the core configuration.
// Identity setup is now cleaner
const identity = config.IDENTITY_PEM_CONTENT
  ? identityFromPemContent(config.IDENTITY_PEM_CONTENT)
  : identityFromPem(config.IDENTITY_PEM_PATH!);

const payoutPrincipal = Principal.fromText(config.PAYOUT_PRINCIPAL);

const prometheusClient = new PrometheusServerClient({
  identity,
  payoutPrincipal,
});

const getServer = () => {
  const server = new McpServer({
    name: 'PMP Faucet',
    version: '1.0.0',
  });
  server.registerTool(
    'get_test_tokens',
    {
      title: 'PMP Token Faucet',
      description: `Claim ${CLAIM_AMOUNT} PMP test tokens. Your balance cannot exceed ${MAX_BALANCE} PMP.`,
      inputSchema: {}, // No input needed
    },
    async (_, { authInfo }) => {
      const userPrincipal = authInfo?.extra?.caller as string;
      if (!userPrincipal) {
        throw new Error('Authentication error: Could not identify the caller.');
      }

      // Step 1: Check the user's current balance.
      const balanceResult = await prometheusClient.getBalance({
        userPrincipal,
        tokenSymbol: 'PMP',
      });

      if (!balanceResult.ok) {
        throw new Error(`Could not check balance: ${balanceResult.error}`);
      }

      const currentBalance = balanceResult.balance;
      console.log(
        `User ${userPrincipal} has current balance of ${currentBalance} PMP.`,
      );

      // Step 2: Enforce the maximum balance rule.
      if (currentBalance >= MAX_BALANCE) {
        throw new Error(
          `Your balance is ${currentBalance} PMP, which is at or above the maximum of ${MAX_BALANCE}. Please spend some tokens on an MCP server to claim more.`,
        );
      }

      // Step 3: Calculate the top-up amount.
      const amountToPayout = Math.min(
        CLAIM_AMOUNT,
        MAX_BALANCE - currentBalance,
      );

      console.log(
        `Topping up user ${userPrincipal} with ${amountToPayout} PMP.`,
      );

      // Step 4: Perform the payout.
      const payoutResult = await prometheusClient.payout({
        userToReceive: userPrincipal,
        amount: amountToPayout,
        tokenSymbol: 'PMP',
      });

      if (!payoutResult.ok) {
        throw new Error(`Faucet payout failed: ${payoutResult.error}`);
      }

      const successMessage = `Successfully sent ${amountToPayout.toFixed(2)} PMP to your account. Your new balance is approximately ${(currentBalance + amountToPayout).toFixed(2)} PMP.`;
      return { content: [{ type: 'text', text: successMessage }] };
    },
  );
  return server;
};

// --- Main Application Logic (no major changes here) ---
async function main() {
  const app = express();
  app.use(express.json());
  app.use(morgan('dev'));

  const { bearerAuthMiddleware, metadataRouter } = await configureAuth();
  app.use(metadataRouter);

  app.post(
    '/mcp',
    bearerAuthMiddleware,
    async (req: Request, res: Response) => {
      console.log(
        'Authenticated request received. Body:',
        JSON.stringify(req.body),
      );
      try {
        const server = getServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
        });
        res.on('close', () => {
          console.log('Request closed, cleaning up.');
          transport.close();
          server.close();
        });
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: { code: -32603, message: 'Internal server error' },
            id: req.body?.id || null,
          });
        }
      }
    },
  );

  // Other endpoints
  app.get('/mcp', (req, res) =>
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found.' },
      id: null,
    }),
  );
  app.delete('/mcp', (req, res) =>
    res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32601, message: 'Method not found.' },
      id: null,
    }),
  );

  const PORT = config.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`MCP Stateless HTTP Server listening on port ${PORT}`);
    console.log(`Protected endpoint available at ${config.SERVER_URL}/mcp`);
    console.log(
      `OAuth metadata available at ${config.SERVER_URL}/.well-known/oauth-protected-resource`,
    );
  });
  server.on('error', (error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Failed to start server during setup:', error);
  process.exit(1);
});
