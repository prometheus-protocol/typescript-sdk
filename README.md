# `@prometheus-protocol/typescript-sdk`

This is the official TypeScript SDK for the [Prometheus Protocol](https://github.com/prometheus-protocol/prometheus-protocol). It provides a simple and powerful way to integrate the Prometheus authentication and payment rail into both frontend and backend JavaScript/TypeScript applications.

The SDK is divided into two main parts:

- **Browser Client:** For frontend applications (SPAs, React, Svelte, etc.) to handle user authentication and authorization.
- **Server Client:** For backend services (Node.js) to register themselves as resource servers and to initiate microtransactions.

## Installation

```bash
npm install @prometheus-protocol/typescript-sdk
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
    // This one function handles everything.
    const prometheusClient = await createPrometheusClient({
      // The canister ID of the main Prometheus auth canister.
      authCanisterId: import.meta.env.VITE_AUTH_CANISTER_ID,

      // The full base URL of the target resource server API (e.g., "https://api.myapp.com").
      resourceServerUrl: import.meta.env.VITE_RESOURCE_SERVER_URL,

      // The host for the Internet Computer (e.g., "https://icp-api.io" for production).
      icHost: import.meta.env.VITE_IC_HOST,

      // Metadata for this client application. This is used for Dynamic Client Registration.
      clientMetadata: {
        client_name: 'My Awesome App',
        grant_types: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_method: 'none', // Public clients don't use a secret
        scope: 'profile openid', // The permissions you are requesting
      },
    });

    // If the promise resolves, the user is successfully authenticated.
    console.log('Authentication successful!');
    const accessToken = prometheusClient.getAccessToken();
    const userPrincipal = prometheusClient.getPrincipal();

    // Now you can update your UI and make authenticated API calls.
    // Example: fetch('https://api.myapp.com/data', { headers: { 'Authorization': `Bearer ${accessToken}` } });
  } catch (error) {
    // This catch block is expected to run on the first login attempt,
    // as the function will trigger a page redirect and the promise will not resolve.
    console.error('Authentication flow failed or was redirected:', error);
  }
}

// Run the authentication flow when the application loads.
handleAuthentication();
```

**How it Works:**

- On the first run for a new user, `createPrometheusClient` will automatically redirect the browser to the Prometheus login page. In this case, the returned promise will **never resolve**.
- After the user logs in and is redirected back to your app, `createPrometheusClient` will handle the token exchange. If successful, the promise will resolve and return an authenticated client instance.

---

## Usage: Server (Backend - Node.js)

For backend services that need to register themselves with the protocol or charge users for services.

### Example: Registering a Resource Server

This is typically a one-time setup step for your service.

```typescript
// scripts/register.ts
import { PrometheusServerClient } from '@prometheus-protocol/typescript-sdk/server';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import fs from 'fs';

// Load your server's private key. This identity must have an ICRC-2 allowance
// set for the Prometheus auth canister to pay any registration fees.
const pemKey = fs.readFileSync('./path/to/your/server-identity.pem', 'utf8');
const identity = Ed25519KeyIdentity.fromPEM(pemKey);

async function register() {
  const registration = await PrometheusServerClient.register({
    authCanisterId: 'YOUR_AUTH_CANISTER_ID',
    identity: identity,
    clientName: 'My Awesome API Service',
    clientType: 'confidential', // Backend services are confidential clients
    redirectUris: [], // Not needed for a service-to-service client
  });

  console.log('Successfully registered service!');
  console.log('Client ID:', registration.client_id);
  console.log('Client Secret:', registration.client_secret); // <-- Store this securely!
}

register();
```

### Example: Charging a User for a Service

This is how your API can trigger a microtransaction.

```typescript
// src/api/charge-endpoint.ts
import { PrometheusServerClient } from '@prometheus-protocol/typescript-sdk/server';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Principal } from '@dfinity/principal';

// Load your server's identity.
const pemKey = fs.readFileSync('./path/to/your/server-identity.pem', 'utf8');
const identity = Ed25519KeyIdentity.fromPEM(pemKey);

async function chargeUserForThing(userPrincipal: string, amount: bigint) {
  try {
    const result = await PrometheusServerClient.charge({
      authCanisterId: 'YOUR_AUTH_CANISTER_ID',
      identity: identity, // The identity of the service initiating the charge.
      userToCharge: Principal.fromText(userPrincipal),
      amount: amount, // Amount in the smallest denomination (e.g., e8s).
    });

    if (result.ok) {
      console.log('Successfully charged user!');
      return { success: true };
    } else {
      console.error('Payment failed:', result.err);
      return { success: false, error: result.err };
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return { success: false, error: 'Charge failed' };
  }
}
```

## API Reference

For detailed information on all exported functions, types, and interfaces, please refer to the TSDoc comments within the source code. Modern IDEs like VS Code will automatically display this information via IntelliSense.

## Contributing

Contributions are welcome! Please see the main [Prometheus Protocol repository](https://github.com/prometheus-protocol/prometheus-protocol) for overall project goals and contribution guidelines.

## License

This SDK is licensed under the [MIT License](LICENSE).
