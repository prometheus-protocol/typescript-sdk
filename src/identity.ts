/**
 * @module
 * This module provides server-side utilities for loading cryptographic identities from
 * PEM files, compatible with the format used by `dfx identity export`. It supports
 * both Ed25519 and Secp256k1 key types, as well as password-protected (encrypted)
 * PEM files.
 */

import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import { Ed25519KeyIdentity } from '@dfinity/identity';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';
import pemfile from 'pem-file';

// --- Internal Helper Functions (Unchanged) ---

function decode(rawKey: Buffer): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const buf: Buffer = pemfile.decode(rawKey);
  if (rawKey.includes('EC PRIVATE KEY')) {
    if (buf.length !== 118) {
      throw new Error(
        `Invalid Secp256k1 key format: expecting byte length 118 but got ${buf.length}`,
      );
    }
    return Secp256k1KeyIdentity.fromSecretKey(buf.subarray(7, 39));
  }
  if (buf.length !== 85) {
    throw new Error(
      `Invalid Ed25519 key format: expecting byte length 85 but got ${buf.length}`,
    );
  }
  const secretKey = buf.subarray(16, 48);
  return Ed25519KeyIdentity.fromSecretKey(secretKey);
}

const algorithm = 'aes-256-ctr';

function decrypt(encrypted: Buffer, password: string): Buffer {
  const key = crypto
    .createHash('sha256')
    .update(password)
    .digest('base64')
    .slice(0, 32);
  const iv = encrypted.subarray(0, 16);
  const encryptedData = encrypted.subarray(16);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}

// --- Public API Functions ---

/**
 * Creates an identity from the raw string content of a PEM file.
 * This is the primary function for creating an identity. It supports
 * encrypted and unencrypted PEMs of both Ed25519 and Secp256k1 types.
 *
 * @param pemContent The string content of the PEM file.
 * @param password An optional password to decrypt the PEM file.
 * @returns An Ed25519KeyIdentity or Secp256k1KeyIdentity.
 */
export function identityFromPemContent(
  pemContent: string,
  password?: string,
): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const rawKey = Buffer.from(pemContent);

  if (pemContent.includes('ENCRYPTED')) {
    if (!password) {
      throw new Error('PEM file is encrypted, but no password was provided.');
    }
    const decrypted = decrypt(pemfile.decode(rawKey), password);
    // After decryption, we get a new PEM structure, so we re-encode it to pass to decode.
    const decryptedPem = pemfile.encode(decrypted, 'PRIVATE KEY');
    return decode(Buffer.from(decryptedPem));
  }

  // If not encrypted, decode directly.
  return decode(rawKey);
}

/**
 * Creates an identity by reading a PEM file from the local filesystem.
 * This is a convenience wrapper around `identityFromPemContent`.
 *
 * @param path The file path to the PEM file.
 * @param password An optional password to decrypt the PEM file.
 * @returns An Ed25519KeyIdentity or Secp256k1KeyIdentity.
 */
export function identityFromPem(
  path: string,
  password?: string,
): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const pemContent = fs.readFileSync(path, 'utf-8');
  return identityFromPemContent(pemContent, password);
}

/**
 * Encrypts a buffer using AES-256-CTR with a password-derived key.
 * The initialization vector (IV) is prepended to the resulting buffer.
 * This is a utility function and not typically called directly by consumers of the SDK.
 *
 * @param buffer The buffer to encrypt.
 * @param password The password to use for encryption.
 * @returns The encrypted buffer, prefixed with the 16-byte IV.
 */
export function encrypt(buffer: Buffer, password: string): Buffer {
  const key = crypto
    .createHash('sha256')
    .update(password)
    .digest('base64')
    .slice(0, 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  return Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
}
