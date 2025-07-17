/**
 * @module
 * This module provides the server-side client and utilities for interacting with the
 * Prometheus Protocol from a secure backend environment like Node.js.
 */

import { HttpAgent, type Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { createActor } from './declarations/oauth_backend/index.js';
import { type _SERVICE } from './declarations/oauth_backend/oauth_backend.did.js';

export { identityFromPem } from './identity.js';

/**
 * Defines the configuration for the PrometheusServerClient.
 */
export interface ServerClientConfig {
  /** The canister ID of the main Prometheus auth canister. */
  authCanisterId: string;
  /** The server's own identity, typically loaded from a secure PEM file using `identityFromPem`. */
  identity: Identity;
  /** The host URL for the Internet Computer. Defaults to `https://icp-api.io`. */
  host?: string;
}

/**
 * Defines the arguments for the `charge` method.
 */
export interface ChargeOptions {
  /** The Principal of the user to be charged. This should be securely extracted from a validated JWT. */
  userToCharge: Principal;
  /** The amount to charge, specified in the smallest unit of the token (e.g., e8s for ICP). */
  amount: bigint;
  /** The canister Principal of the ICRC-2 compliant ledger to use for the transaction. */
  icrc2LedgerId: Principal;
}

/**
 * Represents the outcome of a charge operation.
 */
export type ChargeResult = { ok: true } | { ok: false; error: string };

/**
 * The main client for interacting with the Prometheus Protocol from a secure server
 * environment (e.g., Node.js). It handles authenticated calls to the auth canister.
 */
export class PrometheusServerClient {
  private actor: _SERVICE;

  /**
   * Creates an instance of the PrometheusServerClient.
   * @param config The configuration for the client.
   */
  constructor(config: ServerClientConfig) {
    // Create an HttpAgent authenticated with the server's identity.
    const agent = new HttpAgent({
      host: config.host ?? 'https://icp-api.io',
      identity: config.identity,
    });

    // Create an Actor instance to interact with the auth canister.
    this.actor = createActor(config.authCanisterId, {
      agent,
    });
  }

  /**
   * Charges a user for a specific action by calling the Prometheus auth canister.
   * This should only be called from a trusted server backend, as it uses the server's
   * registered identity. If a network or canister error occurs, it will be caught
   * and returned as a failure result.
   *
   * @param options An object containing the details of the charge.
   * @returns A promise that resolves to a result object indicating the outcome of the charge.
   */
  public async charge(options: ChargeOptions): Promise<ChargeResult> {
    try {
      const result = await this.actor.charge_user({
        user_to_charge: options.userToCharge,
        amount: options.amount,
        icrc2_ledger_id: options.icrc2LedgerId,
      });

      if ('ok' in result) {
        return { ok: true };
      } else {
        // The 'err' case is explicitly handled.
        return { ok: false, error: result.err };
      }
    } catch (e) {
      // Catch any other exceptions (network errors, canister traps) and format them.
      const errorMessage =
        e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error('Error calling charge_user:', e);
      return { ok: false, error: errorMessage };
    }
  }
}
