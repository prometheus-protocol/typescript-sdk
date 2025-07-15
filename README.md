### **Task 1 (Top Priority): `prometheus-js` - The Web2 Bridge**

This is the most critical part of this phase. We'll build it as a standard NPM package with TypeScript.

**Week 1: The Server-Side Payment Engine (Node.js)**

*   **[x] Repo Setup:**
    *   Create a new GitHub repository: `prometheus-js-sdk`.
    *   Initialize it as an NPM package (`npm init`).
    *   Set up TypeScript, ESLint, and a bundler like Rollup or Vite to output both ESM and CJS modules.

*   **[ ] Core Logic: The `PrometheusServerClient`**
    *   Design the main class. A developer will instantiate it like this:
        ```typescript
        const prometheus = new PrometheusServerClient({
          authCanisterId: 'rrkah-fqaaa-aaaaa-aaaaq-cai',
          identity: Ed25519KeyIdentity.fromPEM(process.env.SERVER_PEM)
        });
        ```
    *   Implement the `charge()` method. This is the heart of the SDK.
        ```typescript
        // In an Express middleware
        const result = await prometheus.charge({
          userPrincipal: Principal.fromText(jwt.sub),
          amount: 10000, // The cost of this endpoint
          tokenSymbol: 'ckUSDC'
        });
        ```
    *   This method will encapsulate all the `agent-js` logic: creating the authenticated agent, creating the actor, and calling the `chargeUserFromTrustedService` method on our canister. It must handle errors gracefully (e.g., `InsufficientFunds`).

*   **[ ] Initial Testing:**
    *   Write unit tests that mock the `agent-js` actor calls.
    *   Perform a live integration test against our deployed Phase 0 canister to confirm a payment can be triggered from a local Node.js script.

**Week 2: The Client-Side Auth Helpers & Polish**

*   **[ ] The `PrometheusBrowserClient`:**
    *   Implement the client-side helpers for handling the OAuth2 PKCE flow.
    *   `redirectToLogin()`: This function will generate and store the `code_verifier`, create the `code_challenge`, and redirect the user to the `/authorize` endpoint with all necessary parameters.
    *   `handleRedirect()`: This function will be called on the callback page. It will parse the `authorization_code` from the URL.
    *   `exchangeCodeForToken()`: This function will retrieve the `code_verifier` and make the `POST` request to the `/token` endpoint to get the JWT.

*   **[ ] Documentation & Publishing:**
    *   Write a clear, concise README for the NPM package with usage examples for both frontend and backend.
    *   Publish version `0.1.0` to NPM.
