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

/**
 * Loads a cryptographic identity from a PEM file.
 * This is the primary entry point for loading server-side identities. It reads the
 * file, decrypts it if a password is provided, and decodes it into a DFINITY Identity.
 *
 * @param file The file path to the PEM-encoded private key (e.g., './service-identity.pem').
 * @param password Optional password to decrypt the PEM file if it's encrypted.
 * @returns An `Ed25519KeyIdentity` or `Secp256k1KeyIdentity` instance.
 * @throws If the file cannot be read or the PEM format is invalid.
 */
export function identityFromPem(file: string, password?: string) {
  const rawKey = fs.readFileSync(file);
  if (password) {
    return decode(decrypt(rawKey, password));
  }
  return decode(rawKey);
}

/**
 * Decodes a raw PEM buffer into a DFINITY Identity object.
 * It distinguishes between key types based on substrings and buffer lengths.
 * @param rawKey The raw buffer content of the PEM file.
 * @returns An identity object.
 * @internal
 */
function decode(rawKey: Buffer): Ed25519KeyIdentity | Secp256k1KeyIdentity {
  const buf: Buffer = pemfile.decode(rawKey);
  if (rawKey.includes('EC PRIVATE KEY')) {
    // This is likely a Secp256k1 key
    if (buf.length !== 118) {
      throw new Error(
        `Invalid Secp256k1 key format: expecting byte length 118 but got ${buf.length}`,
      );
    }
    // The secret key is a 32-byte slice within the DER-encoded structure.
    return Secp256k1KeyIdentity.fromSecretKey(buf.subarray(7, 39));
  }
  // Otherwise, assume Ed25519
  if (buf.length !== 85) {
    throw new Error(
      `Invalid Ed25519 key format: expecting byte length 85 but got ${buf.length}`,
    );
  }
  // The secret key for Ed25519 is also a 32-byte slice.
  const secretKey = buf.subarray(16, 48);
  return Ed25519KeyIdentity.fromSecretKey(secretKey);
}

/** The encryption algorithm used for password-protected PEM files. */
const algorithm = 'aes-256-ctr';

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
  // Create a random initialization vector.
  const iv = crypto.randomBytes(16);
  // Create a new cipher using the algorithm, key, and iv.
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  // Create the new (encrypted) buffer.
  const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  return result;
}

/**
 * Decrypts a buffer that was encrypted with the `encrypt` function.
 * @param encrypted The encrypted buffer, which must be prefixed with the 16-byte IV.
 * @param password The password used for encryption.
 * @returns The original, decrypted buffer.
 * @internal
 */
function decrypt(encrypted: Buffer, password: string): Buffer {
  const key = crypto
    .createHash('sha256')
    .update(password)
    .digest('base64')
    .slice(0, 32);
  // Get the iv: the first 16 bytes.
  const iv = encrypted.subarray(0, 16);
  // Get the rest of the buffer.
  const encryptedData = encrypted.subarray(16);
  // Create a decipher.
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  // Actually decrypt it.
  const result = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  return result;
}
