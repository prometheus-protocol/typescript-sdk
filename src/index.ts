import { HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createActor } from './declarations/oauth_backend/index.js';
import { type _SERVICE } from './declarations/oauth_backend/oauth_backend.did.js';

export { identityFromPem } from './identity';

// Define the structure for our server client's configuration
export interface ServerClientConfig {
  // The canister ID of the main Prometheus Auth Canister
  authCanisterId: string;
  // The server's own identity, loaded from its secure .pem file
  identity: Identity;
  // Optional: specify the IC host. Defaults to the mainnet.
  host?: string;
}

// Define the arguments for the charge method
export interface ChargeOptions {
  // The Principal of the user to charge (extracted from their JWT)
  userToCharge: Principal;
  // The amount to charge (in the smallest unit of the token)
  amount: bigint;
}

// Define the structure of the result from the charge method
export type ChargeResult = { ok: true } | { ok: false; error: string };

/**
 * The main client for interacting with the Prometheus Protocol from a secure server environment (e.g., Node.js).
 */
export class PrometheusServerClient {
  private actor: _SERVICE; // Replace 'any' with the specific Actor type if you have it

  constructor(config: ServerClientConfig) {
    // Create an HttpAgent authenticated with the server's identity
    const agent = new HttpAgent({
      host: config.host ?? 'https://icp-api.io',
      identity: config.identity,
    });

    // Create an Actor instance to interact with the auth canister
    this.actor = createActor(config.authCanisterId, {
      agent,
    });
  }

  /**
   * Charges a user for a specific action by calling the Prometheus Auth Canister.
   * This should be called from a trusted server backend.
   * @param options - The details of the charge.
   * @returns A result object indicating success or failure.
   */
  public async charge(options: ChargeOptions): Promise<ChargeResult> {
    try {
      const result = await this.actor.charge_user(
        options.userToCharge,
        options.amount,
      );

      if ('ok' in result) {
        return { ok: true };
      } else if ('err' in result) {
        return { ok: false, error: result.err };
      } else {
        return { ok: false, error: 'Unknown' };
      }
    } catch (e) {
      console.error('Error calling chargeUserFromTrustedService:', e);
      return { ok: false, error: 'Unknown' };
    }
  }
}

// We'll leave the BrowserClient as a placeholder for now
export class PrometheusBrowserClient {
  constructor() {
    console.log('Prometheus Browser Client Initialized.');
  }
}
