/**
 * @module
 * This module provides server-side utilities for loading UNENCRYPTED cryptographic identities
 * from PEM files, compatible with the format used by `dfx`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import pemfile from 'pem-file';

// --- Public API Functions ---

/**
 * Creates an identity from the raw string content of a plaintext PEM file.
 * This is the core decoding utility.
 * @param pemContent The string content of the PEM file.
 */
export function identityFromPemContent(
  pemContent: string,
): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const pemBuffer = Buffer.from(pemContent);
  const rawKey = pemfile.decode(pemBuffer);
  if (pemBuffer.toString('utf-8').includes('EC PRIVATE KEY')) {
    if (rawKey.length !== 118) {
      throw new Error(
        `Invalid Secp256k1 key format: expecting byte length 118 but got ${rawKey.length}`,
      );
    }
    return Secp256k1KeyIdentity.fromSecretKey(rawKey.subarray(7, 39));
  }
  if (rawKey.length !== 85) {
    throw new Error(
      `Invalid Ed25519 key format: expecting byte length 85 but got ${rawKey.length}`,
    );
  }
  const secretKey = rawKey.subarray(16, 48);
  return Ed25519KeyIdentity.fromSecretKey(secretKey);
}

/**
 * Creates an identity by reading a single, unencrypted PEM file from a given path.
 * This is ideal for server environments using secrets management.
 * @param path The direct file path to the unencrypted PEM file.
 */
export function identityFromPem(
  path: string,
): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const pemContent = fs.readFileSync(path, 'utf-8');
  return identityFromPemContent(pemContent);
}

/**
 * Creates an identity by reading an unencrypted `dfx` identity from the filesystem.
 * This function does NOT support encrypted identities.
 *
 * @param identityName The name of the dfx identity (e.g., 'my-id').
 * @returns An object containing the identity and the path to the PEM file.
 */
export function identityFromDfx(identityName: string): {
  identity: Ed25519KeyIdentity | Secp256k1KeyIdentity;
  pemPath: string;
} {
  const identityDir = path.join(
    process.env.HOME!,
    '.config',
    'dfx',
    'identity',
    identityName,
  );
  const pemPath = path.join(identityDir, 'identity.pem');
  const encryptedPath = path.join(identityDir, 'identity.pem.encrypted');

  if (fs.existsSync(encryptedPath)) {
    throw new Error(
      `Identity '${identityName}' is encrypted. This tool does not support encrypted identities directly.\n\nPlease export the key to a temporary unencrypted file:\n\ndfx identity export ${identityName} > temp-key.pem\n\nThen use the --identity flag with the path to the new file.`,
    );
  }

  if (!fs.existsSync(pemPath)) {
    throw new Error(`Could not find identity.pem in ${identityDir}`);
  }

  const identity = identityFromPem(pemPath);
  return { identity, pemPath };
}
