# Prometheus Protocol: Sentiment Analyzer Demo Server

This project is a reference implementation of a monetized AI service built with the **Prometheus Protocol**. It demonstrates how to create a server that performs a task (sentiment analysis) and requires payment from clients via a standardized, interoperable protocol.

The core user flow is simple: a client application uses OAuth 2.0 to get an access token for this server. If the client's wallet is empty, the OAuth flow provides an opportunity to fund it with one of the tokens specified by this server.

## Live Demo

On the RMCPS registry:

https://remote-mcp-servers.com/servers/491314bc-27b3-4070-b2c2-39ad971c36c4

Directly accessible at:

https://mcp-sentiment-analysis-b26rjhdb4q-uc.a.run.app/mcp

## Architecture Overview

This repository demonstrates a professional-grade setup that separates concerns between the application, a reusable SDK, and developer tooling.

- **Sentiment Analyzer (This Project)**
  The core application logic. It's an Express.js server that handles incoming requests, uses the SDK to process payments, and performs the sentiment analysis task. It is configured entirely via environment variables, making it portable to any deployment environment.

- **Prometheus SDK (`@prometheus-protocol/typescript-sdk`)**
  A reusable library that encapsulates the low-level details of the Model Context Protocol. It handles cryptographic identity, canister communication, and payment verification, allowing the application developer to focus on their business logic.

- **Prometheus CLI (`prometheus-cli`)**
  A developer convenience tool. Its primary job is to configure your **local development environment**. It interacts with your `dfx` identities and the Prometheus canister to generate a `prometheus-tokens.json` file and a local `.env` file, making setup a one-command process.

## Local Setup and Running

To run the server on your local machine for development and testing.

1.  **Clone the Repository**

    ```bash
    git clone <your-repo-url>
    cd sentiment-analyzer
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **First-Time Registration**
    The first time you set up the server, you must register it with the Prometheus Protocol's Authorization Server. This command will create a new `dfx` identity for your server, register it, and generate your initial configuration files.

    ```bash
    npx prometheus-cli register
    ```

    This will create two crucial files:
    - `prometheus-tokens.json`: A list of supported payment tokens. This file **should be committed to git**.
    - `.env`: Your local environment variables. This file is listed in `.gitignore` and should **never** be committed.

4.  **Handling the `SERVER_URL` for Local Development**
    A key challenge in OAuth 2.0 development is that the Authorization Server needs a stable, unique public URL for each instance of your server.
    - **The Limitation:** Every developer running a local server needs their own unique `SERVER_URL`.
    - **Solutions:**
      - **Recommended:** Use a tunneling service like **Cloudflare Tunnel** or **ngrok** to expose your local server on a public URL. Use this public URL during the `register` step.
      - **Alternative:** Use `http://localhost` with a unique, non-common port number (e.g., `http://localhost:8765`).

5.  **Run the Server**
    ```bash
    npm run start
    ```
    The server will start on the port specified in your `SERVER_URL`, using the configuration from your `.env` file.

## Production Deployment Concepts

Deploying this server to production requires adhering to best practices for security and portability. The application is packaged as a Docker container and can be deployed to any platform that supports containers (e.g., AWS ECS, Azure App Service, Google Cloud Run, or your own server).

The following principles are essential for any production deployment:

#### 1. Persistent Identity via Secrets Management

The server's identity must be permanent so that user allowances are not lost on redeployment.

- **Action:** The `prometheus-cli register` command handles the one-time creation of a dedicated `dfx` identity for your service.
- **Best Practice:** Store the _content_ of the exported `identity.pem` file in a secure secret manager provided by your cloud platform (e.g., AWS Secrets Manager, Azure Key Vault, HashiCorp Vault). **Do not** bake the PEM file into your Docker image.

#### 2. Configuration via Environment Variables

The Docker container is a stateless artifact. All environment-specific configuration must be injected at runtime.

- **Pre-Deployment Step:** Before deploying, you must update the Authorization Server with your final, public production URL. Run the following command and provide your public URL when prompted:
  ```bash
  npx prometheus-cli update
  ```
- **Action:** Your deployment process must provide the following environment variables to the running container:
  - `IDENTITY_PEM_CONTENT`: The PEM file content, injected from your secret manager.
  - `PAYOUT_PRINCIPAL`: The principal that will receive the collected funds.
  - `AUTH_ISSUER`: The URL of your OAuth Authorization Server.
  - `SERVER_URL`: The final, public URL of this deployed service.

#### 3. Bundled Static Configuration

Configuration that is public and changes infrequently should be bundled directly with the application.

- **Action:** The `prometheus-tokens.json` file is copied directly into the Docker image via the `Dockerfile`.
- **Best Practice:** This makes the application self-contained and removes a potential network dependency at startup. To update the token list, run `npx prometheus-cli sync`, commit the changed file, and redeploy.
