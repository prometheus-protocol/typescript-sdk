// server.js
import express from 'express';
import cors from 'cors';
import { expressjwt as jwt } from 'express-jwt'; // JWT validation middleware
import jwksRsa from 'jwks-rsa'; // To fetch public keys
import {
  identityFromPem,
  PrometheusServerClient,
} from '@prometheus-protocol/typescript-sdk';
import { Principal } from '@dfinity/principal';
import * as path from 'path';
import 'dotenv/config';
import * as url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- CONFIGURATION ---
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const AUTH_CANISTER_ID = process.env.AUTH_CANISTER_ID;
const IC_HOST = process.env.IC_HOST || 'http://127.0.0.1:4943'; // Use local replica by default
const PEM_FILE_PATH = './server-identity.pem';
const RESOURCE_SERVER_ID = process.env.RESOURCE_SERVER_ID;

// --- DEBUGGING ---
console.log('--- Environment Variables ---');
console.log('AUTH_CANISTER_ID:', AUTH_CANISTER_ID);
console.log('IC_HOST:', IC_HOST);
console.log('RESOURCE_SERVER_ID:', RESOURCE_SERVER_ID);
console.log('---------------------------');

// --- JWT VALIDATION MIDDLEWARE ---
// This middleware will automatically validate any incoming Bearer token.
// If the token is valid, it attaches the decoded payload to req.auth.
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    // This is the public endpoint of our Auth Canister that exposes the signing keys
    jwksUri: `${IC_HOST}/.well-known/jwks.json?canisterId=${AUTH_CANISTER_ID}`,
  }),
  // Specify the expected audience and issuer from our JWTs
  audience: RESOURCE_SERVER_ID,
  issuer: AUTH_CANISTER_ID,
  algorithms: ['ES256'], // Our canister uses ECDSA with P-256 curve
});

// --- SDK INITIALIZATION ---
const identity = identityFromPem(
  path.resolve(__dirname, '..', '..', '..', PEM_FILE_PATH),
);

const prometheusClient = new PrometheusServerClient({
  authCanisterId: AUTH_CANISTER_ID,
  identity,
  host: IC_HOST, // Use the same host for the SDK
});

console.log(
  `Server configured with Principal: ${identity.getPrincipal().toText()}`,
);
console.log(`Targeting IC Host: ${IC_HOST}`);

// --- PAYMENT MIDDLEWARE ---
const paymentMiddleware = async (req, res, next) => {
  // IMPORTANT: We get the user's principal from the *validated* JWT payload,
  // not from the request body. This is secure.
  const userPrincipal = req.auth.sub;
  if (!userPrincipal) {
    return res.status(401).json({ error: 'User principal not found in JWT.' });
  }

  console.log(`Initiating charge for user: ${userPrincipal}`);

  const result = await prometheusClient.charge({
    userToCharge: Principal.fromText(userPrincipal),
    amount: 10000n,
  });

  console.log(`Charge result for ${userPrincipal}:`, result);

  if (result.ok) {
    console.log('✅ Payment successful. Allowing request to proceed.');
    next();
  } else {
    res.status(402).json({ error: 'Payment Required', details: result.error });
  }
};

// --- API ROUTES ---
app.get('/', (req, res) => {
  res.send('This is a free resource. Welcome!');
});

// This endpoint is now protected by TWO middlewares:
// 1. checkJwt: Validates the token and extracts the user principal.
// 2. paymentMiddleware: Charges the user identified by the token.
app.get('/api/super-secret-data', checkJwt, paymentMiddleware, (req, res) => {
  res.json({
    message: `Access granted to ${req.auth.sub}. The secret data is: 42.`,
  });
});

// Error handler for the JWT middleware
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Invalid or missing token.' });
  } else {
    next(err);
  }
});

app.listen(PORT, () => {
  console.log(`Demo server listening on port ${PORT}`);
});

app.on('error', (err) => {
  console.error('Server error:', err);
});
