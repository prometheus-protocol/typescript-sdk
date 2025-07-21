# `@prometheus-protocol/typescript-sdk`

This is the official TypeScript SDK for the [Prometheus Protocol](https://github.com/prometheus-protocol). It provides a simple and powerful way to integrate the Prometheus authentication and payment rail into both frontend and backend JavaScript/TypeScript applications.

The SDK is divided into two main parts:

- **Browser Client:** For frontend applications (SPAs, React, Svelte, etc.) to handle user authentication and authorization.
- **Server Client:** For backend services (Node.js) to register themselves as resource servers and to initiate microtransactions.

## Installation

```bash
npm install @prometheus-protocol/typescript-sdk @dfinity/identity express-jwt jwks-rsa
```

---

## Usage: Browser (Frontend)

The easiest way to add Prometheus authentication to your single-page application (SPA). The SDK handles the entire OAuth2 flow, including Dynamic Client Registration (DCR), redirects, and token management.

### Example: Authenticating a User in a SPA

The `createPrometheusClient` function is the main entry point. It encapsulates the entire authentication flow into a single promise-based function.

```typescript
// src/main.ts
import { createPrometheusClient } from '@prometheus-protocol/typescript-sdk/browser';

async function handleAuthentication() {
  try {
    const prometheusClient = await createPrometheusClient({
      authCanisterId: import.meta.env.VITE_AUTH_CANISTER_ID,
      resourceServerUrl: import.meta.env.VITE_RESOURCE_SERVER_URL,
      icHost: import.meta.env.VITE_IC_HOST,
      clientMetadata: {
        client_name: 'My Awesome App',
        grant_types: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_method: 'none',
        scope: 'openid prometheus:charge',
      },
    });

    // If the promise resolves, the user is successfully authenticated.
    const accessToken = prometheusClient.getAccessToken();
    // Now you can make authenticated API calls.
  } catch (error) {
    // This catch block is expected on the first login attempt, as it triggers a redirect.
    console.error('Authentication flow failed or was redirected:', error);
  }
}

handleAuthentication();
```

---

## Usage: Server (Backend - Node.js)

For backend services that need to register themselves with the protocol or charge users for services.

### Step 1: Create a Dedicated Service Identity

For security, your live server should use its own dedicated identity, not your personal developer identity.

**1. Create a new identity using `dfx`:**

```bash
dfx identity new service-identity
```

**2. Export the private key to a PEM file:** This file will be used by your Node.js server to sign requests.

```bash
# Make sure you are using the new identity
dfx identity use service-identity

# Export the key
dfx identity export service-identity > service-identity.pem
```

**3. Get the Principal ID:** You will need this principal when you register your service.

```bash
# Get the principal of your new service identity
dfx identity get-principal
# It will output a principal string like: jmjyx-d5aic-g6lug-uhffn-aiuid-...

# IMPORTANT: Switch back to your main developer identity for administrative tasks
dfx identity use default
```

Now you have a `service-identity.pem` file for your server and its corresponding Principal ID.

### Step 2: Registering Your Service (One-Time Setup)

Registration is an administrative task that proves your ownership of a service. This should be done using your primary developer identity (`default`).

**Using `dfx` (Recommended for simplicity):**

```bash
# Replace placeholders with your actual values
dfx canister call <auth_canister_id> register_resource_server '(record {
  name = "My Awesome API";
  initial_service_principal = principal "<the_principal_from_step_1>";
  uris = vec { "https://api.my-awesome-app.com" };
})'
```

### Step 3: Protecting Your API and Charging Users

This is the runtime logic for your live server. It uses the `service-identity.pem` file you created in Step 1.

**Example `server.js`:**

```javascript
import express from 'express';
import cors from 'cors';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import {
  PrometheusServerClient,
  identityFromPem,
} from '@prometheus-protocol/typescript-sdk/server';
import { Principal } from '@dfinity/principal';
import 'dotenv/config';

// --- CONFIGURATION ---
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const AUTH_CANISTER_ID = process.env.AUTH_CANISTER_ID;
const IC_HOST = process.env.IC_HOST || 'http://127.0.0.1:4943';
const RESOURCE_SERVER_URL = process.env.RESOURCE_SERVER_URL;

// --- JWT VALIDATION MIDDLEWARE ---
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `${IC_HOST}/.well-known/jwks.json?canisterId=${AUTH_CANISTER_ID}`,
  }),
  audience: RESOURCE_SERVER_URL,
  issuer: AUTH_CANISTER_ID,
  algorithms: ['ES256'],
});

// --- SDK INITIALIZATION ---
// Load your SERVICE's identity from the PEM file created in Step 1.
const serviceIdentity = identityFromPem('./service-identity.pem');
const prometheusClient = new PrometheusServerClient({
  authCanisterId: AUTH_CANISTER_ID,
  identity: serviceIdentity,
  host: IC_HOST,
  payoutPrincipal: Principal.fromText(process.env.PAYOUT_PRINCIPAL),
});

console.log(
  `Server running with Principal: ${serviceIdentity.getPrincipal().toText()}`,
);

// --- PAYMENT MIDDLEWARE ---
const paymentMiddleware = async (req, res, next) => {
  const userPrincipal = req.auth.sub;
  if (!userPrincipal) {
    return res.status(401).json({ error: 'User principal not found in JWT.' });
  }

  const result = await prometheusClient.charge({
    userToCharge: Principal.fromText(userPrincipal),
    amount: 10000n, // Example: charge 0.0001 of the token
    icrc2LedgerId: Principal.fromText('a4tbr-q4aaa-aaaaa-qaafq-cai'), // Replace with your ICRC2 ledger ID
  });

  if (result.ok) {
    console.log(`✅ Payment successful for ${userPrincipal}.`);
    next();
  } else {
    res.status(402).json({ error: 'Payment Required', details: result.err });
  }
};

// --- API ROUTES ---
app.get('/api/super-secret-data', checkJwt, paymentMiddleware, (req, res) => {
  res.json({
    message: `Access granted to ${req.auth.sub}. The secret data is: 42.`,
  });
});

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
```

## Contributing

Contributions are welcome! Please see the main [Prometheus Protocol repository](https://github.com/prometheus-protocol) for overall project goals and contribution guidelines.

## License

This SDK is licensed under the [MIT License](LICENSE).
