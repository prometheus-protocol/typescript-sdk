/**
 * @module
 * This module provides the server-side client and utilities for interacting with the
 * Prometheus Protocol from a secure backend environment like Node.js.
 */

import { HttpAgent, type Identity } from '@dfinity/agent';
import { type Principal } from '@dfinity/principal';
// Import the ICRC-1 Ledger Canister utility
import {
  IcrcLedgerCanister,
  type TransferFromParams,
} from '@dfinity/ledger-icrc';

export { identityFromPem } from './identity.js';

/**
 * Defines the configuration for the PrometheusServerClient.
 */
export interface ServerClientConfig {
  /**
   * The server's own identity, typically loaded from a secure PEM file.
   */
  identity: Identity;
  /**
   * The Principal that will receive the funds from charges.
   */
  payoutPrincipal: Principal;
  /** The host URL for the Internet Computer. Defaults to `https://icp-api.io`. */
  host?: string;
  /**
   * Explicitly set whether to fetch the root key.
   * In most cases, this can be omitted. The SDK will automatically fetch the root
   * key if the host is 'localhost' or '127.0.0.1', and will not fetch it for
   * production hosts. This is an escape hatch for non-standard local setups.
   */
  fetchRootKey?: boolean;
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
export type ChargeResult =
  | { ok: true; blockIndex: bigint }
  | { ok: false; error: string };

/**
 * The main client for interacting with the Prometheus Protocol from a secure server
 * environment (e.g., Node.js). It handles direct, authenticated calls to ICRC-2 ledgers.
 */
export class PrometheusServerClient {
  private agent: HttpAgent;
  private payoutPrincipal: Principal;

  /**
   * Creates an instance of the PrometheusServerClient.
   * @param config The configuration for the client.
   */
  constructor(config: ServerClientConfig) {
    const host = config.host ?? 'https://icp-api.io';

    // Determine if we should fetch the root key.
    // 1. Use the explicit setting if provided (the "escape hatch").
    // 2. Otherwise, auto-detect based on the host URL.
    const fetchRootKey =
      typeof config.fetchRootKey === 'boolean'
        ? config.fetchRootKey
        : host.includes('localhost') || host.includes('127.0.0.1');

    // The agent is authenticated with the server's service principal identity.
    this.agent = new HttpAgent({
      host,
      identity: config.identity,
      shouldFetchRootKey: fetchRootKey, // Use our determined value
    });

    this.payoutPrincipal = config.payoutPrincipal;
  }

  /**
   * Charges a user by executing an `icrc2_transfer_from` call directly on the specified ledger.
   * This method uses the server's identity (provided in the constructor) as the `spender`.
   * The call will only succeed if the user has previously granted a sufficient allowance
   * to this server's identity via the Prometheus Protocol frontend.
   *
   * @param options An object containing the details of the charge.
   * @returns A promise that resolves to a result object indicating the outcome of the charge.
   */
  public async charge(options: ChargeOptions): Promise<ChargeResult> {
    try {
      // Create an IcrcLedgerCanister instance for the target ledger.
      const ledgerCanister = IcrcLedgerCanister.create({
        agent: this.agent,
        canisterId: options.icrc2LedgerId,
      });

      // Construct the arguments for the transfer_from call.
      const transferArgs: TransferFromParams = {
        from: {
          owner: options.userToCharge,
          subaccount: [], // Use the default subaccount
        },
        to: {
          owner: this.payoutPrincipal, // Send funds to the configured payout address
          subaccount: [],
        },
        amount: options.amount,
        // The `spender_subaccount` is automatically handled by the agent's identity.
      };

      const txId = await ledgerCanister.transferFrom(transferArgs);

      return { ok: true, blockIndex: txId };
    } catch (e) {
      // Catch any other exceptions (network errors, canister traps) and format them.
      const errorMessage =
        e instanceof Error ? e.message : 'An unknown error occurred.';
      console.error('Error calling transferFrom:', e);
      return { ok: false, error: errorMessage };
    }
  }
}
