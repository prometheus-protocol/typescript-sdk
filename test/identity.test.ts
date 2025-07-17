import { describe, it, expect } from 'vitest';
import { identityFromPem } from '../src/identity';
import path from 'path';
import { Secp256k1KeyIdentity } from '@dfinity/identity-secp256k1';

describe('identityFromPem', () => {
  it('should correctly load an Secp256k1 identity from a PEM file', () => {
    const pemFilePath = path.resolve(__dirname, 'dummy-identity.pem');

    const identity = identityFromPem(pemFilePath);

    // Check if it's the correct identity type
    expect(identity).toBeInstanceOf(Secp256k1KeyIdentity);

    // Check if the principal is correct for the known private key
    const expectedPrincipal =
      '4ee3b-wsprh-4pkwq-j7v6e-vmqcw-ius2e-7e4ar-ecanr-vo5qe-rpc6e-fqe';
    expect(identity.getPrincipal().toText()).toBe(expectedPrincipal);
  });
});
