import 'dotenv/config';
import express, { Request, Response } from 'express';
import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { configureAuth } from './auth'; // Import our new function
import morgan from 'morgan';

// --- MCP Server Definition (no changes here) ---
const getServer = () => {
  const server = new McpServer({ name: 'demo-server', version: '1.0.0' });
  server.registerTool(
    'add',
    {
      title: 'Addition Tool',
      description: 'Add two numbers',
      inputSchema: { a: z.number(), b: z.number() },
    },
    async ({ a, b }) => ({ content: [{ type: 'text', text: String(a + b) }] }),
  );
  server.registerResource(
    'greeting',
    new ResourceTemplate('greeting://{name}', { list: undefined }),
    { title: 'Greeting Resource', description: 'Dynamic greeting generator' },
    async (uri, { name }) => ({
      contents: [{ uri: uri.href, text: `Hello, ${name}!` }],
    }),
  );
  return server;
};

// --- Main Application Logic ---
async function main() {
  const app = express();
  app.use(express.json());
  app.use(morgan('dev'));

  // Configure auth dynamically at startup
  const { bearerAuthMiddleware, metadataRouter } = await configureAuth();

  // Use the metadata router to expose discovery endpoints
  app.use(metadataRouter);

  // Protect the /mcp endpoint with the bearer auth middleware
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

  // Start the server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`MCP Stateless HTTP Server listening on port ${PORT}`);
    console.log(
      `Protected endpoint available at ${process.env.SERVER_URL}/mcp`,
    );
    console.log(
      `OAuth metadata available at ${process.env.SERVER_URL}/.well-known/oauth-protected-resource`,
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
