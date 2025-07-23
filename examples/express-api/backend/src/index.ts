// src/index.ts
import express from 'express';
import cors from 'cors';
import {
  PrometheusServerClient,
  identityFromPem,
  identityFromPemContent,
} from '@prometheus-protocol/typescript-sdk';
import { Principal } from '@dfinity/principal';
import { config } from './config';
import { configureAuth } from './auth';
import morgan from 'morgan';

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  // --- AUTH & METADATA SETUP ---
  // This replaces all the manual JWT and .well-known setup
  const { bearerAuthMiddleware, metadataRouter } = await configureAuth();
  app.use(metadataRouter);

  // --- SDK CLIENT INITIALIZATION ---
  // This logic handles loading identity from a file (local) or content (prod)
  const identity = config.IDENTITY_PEM_CONTENT
    ? identityFromPemContent(config.IDENTITY_PEM_CONTENT)
    : identityFromPem(config.IDENTITY_PEM_PATH!);

  // The new client constructor is simpler
  const prometheusClient = new PrometheusServerClient({
    identity,
    payoutPrincipal: Principal.fromText(config.PAYOUT_PRINCIPAL),
    tokenConfigPath: './prometheus-tokens.json', // Assumes file from `prometheus-cli`
  });

  console.log(
    `Server running with Principal: ${identity.getPrincipal().toText()}`,
  );

  // --- PAYMENT MIDDLEWARE ---
  const paymentMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const userPrincipal = req.auth?.extra?.caller as string; // req.auth is populated by bearerAuthMiddleware
    if (!userPrincipal) {
      return res
        .status(401)
        .json({ error: 'User principal not found in JWT.' });
    }

    // The new `charge` method gets the token info from the config file
    const result = await prometheusClient.charge({
      userToCharge: Principal.fromText(userPrincipal),
      amount: 0.1, // Example: charge 0.1 of the token
    });

    if (result.ok) {
      console.log(`✅ Payment successful for ${userPrincipal}.`);
      next();
    } else {
      res
        .status(402)
        .json({ error: 'Payment Required', details: result.error });
    }
  };

  // --- API ROUTES ---
  app.get('/', (req, res) => {
    res.send('This is a free resource. Welcome!');
  });

  // Protect your API route with the new middleware from the auth module
  app.get(
    '/api/super-secret-data',
    bearerAuthMiddleware,
    paymentMiddleware,
    (req, res) => {
      res.json({
        message: `Access granted to ${req.auth?.extra?.caller}. The secret data is: 42.`,
      });
    },
  );

  app.listen(config.PORT, () =>
    console.log(`Server listening on port ${config.PORT}`),
  );
}

main().catch(console.error);
