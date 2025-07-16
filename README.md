### **Roadmap: Finalizing the `prometheus-js` SDK**

#### **1. Finalize Documentation (The Developer's First Impression)**

- [x] **Draft `README.md`:** We have a comprehensive draft that explains the architecture and usage for both the server and browser clients.
- [ ] **Commit `README.md`:** Let's commit the final version to the SDK's repository root.
- [ ] **Add API Documentation (TSDoc):** A professional SDK needs great inline documentation for IntelliSense. We need to go through all the exported functions and types and add TSDoc comments.

  **Example for `src/browser-client.ts`:**

  ```typescript
  /**
   * Configuration options for the Prometheus Browser Client.
   */
  export interface PrometheusClientOptions {
    /** The canister ID of the main Prometheus auth canister. */
    authCanisterId: string;
    /** The full base URL of the target resource server API (e.g., "https://api.myapp.com"). */
    resourceServerUrl: string;
    // ... and so on for every property
  }

  /**
   * Handles the entire browser-based OAuth2 flow, including Dynamic Client
   * Registration, token exchange, and token refresh.
   *
   * This is the recommended entry point for browser applications. On the first run
   * for a new user, this function will trigger a redirect to the login page and
   * the returned promise will never resolve. On subsequent runs, it will handle
   * token exchange and return an authenticated client instance.
   *
   * @param options The configuration for the client.
   * @returns A promise that resolves with an authenticated client instance.
   * @throws If the authentication flow requires a redirect or fails.
   */
  export async function createPrometheusClient(
    options: PrometheusClientOptions,
  ): Promise<PrometheusClient> {
    // ...
  }
  ```

#### **2. Implement Testing (The Guarantee of Quality)**

- [ ] **Unit Tests:** We need to add a testing framework (`vitest` is a great modern choice) and write unit tests for the critical, non-UI logic. This prevents future regressions.
  - **Key Test Targets:**
    - The `auth` orchestrator logic in `oauth.ts`.
    - The `LocalStorageOAuthProvider` to ensure it stores and retrieves data correctly.
    - Any helper functions (like our URL normalizers or builders).
- [x] **Integration Tests:** Our `examples/express` application serves as a perfect end-to-end integration test. We've proven that the SDK works in a real-world scenario.

#### **3. Publish to NPM (Shipping the Product)**

- [ ] **Final `package.json` Review:** We need to ensure all the metadata is correct for publishing.
  - `name`: `@prometheus-protocol/typescript-sdk`
  - `version`: `1.0.0` (or `0.1.0` for a beta)
  - `author`: "Prometheus Protocol"
  - `license`: "MIT"
  - `main`, `module`, `types`: Pointing to the correct build output files in the `dist` directory.
  - `files`: Explicitly list the `dist` directory and `README.md`.
- [ ] **Build for Production:** Run the final build command.
  ```bash
  npm run build
  ```
- [ ] **Publish:** Push the package to the public NPM registry.
  ```bash
  npm publish --access public
  ```

Once these three steps are complete, Phase 1 for the TypeScript SDK is officially done. We'll have a documented, tested, and publicly available library that developers can start using immediately.
