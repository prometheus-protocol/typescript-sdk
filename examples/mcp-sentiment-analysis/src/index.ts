import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { configureAuth } from './auth';
import morgan from 'morgan';
import Sentiment from 'sentiment';
import {
  identityFromPem,
  identityFromPemContent,
  PrometheusServerClient,
} from '@prometheus-protocol/typescript-sdk';
import { Principal } from '@dfinity/principal';
import { config } from './config';

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
    name: 'Demo: Sentiment Analysis',
    version: '1.0.0',
  });
  server.registerTool(
    'analyze_sentiment',
    {
      title: 'Sentiment Analysis Tool',
      description:
        'Analyzes the sentiment of a given text. Returns a detailed score. Costs 0.01 tokens per call.',
      inputSchema: { text: z.string() },
    },
    async ({ text }, { authInfo }) => {
      console.log(`Initiating charge for user: ${authInfo?.extra?.caller}`);
      const userToCharge = authInfo?.extra?.caller as string;

      const res = await prometheusClient.charge({
        userToCharge,
        amount: 0.01, // Charge 0.01 cents
      });

      // +++ THE FIX: Use a replacer function to handle BigInts +++
      const replacer = (key: string, value: any) =>
        typeof value === 'bigint' ? value.toString() : value;

      console.log(`Charge result: ${JSON.stringify(res, replacer)}`);

      // Check if the charge was successful before proceeding
      if (!res.ok) {
        // You might want to throw an error here to stop the tool execution
        // and return an error to the user.
        throw new Error(`Charge failed: ${res.error}`);
      }

      const sentiment = new Sentiment();
      const result = sentiment.analyze(text);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
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
