import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { identityFromDfx, identityFromPem } from '../identity.js';
import type { _SERVICE } from '../declarations/oauth_backend/oauth_backend.did.js';
import { IcrcLedgerCanister, mapTokenMetadata } from '@dfinity/ledger-icrc';
import type { TokenInfo } from '../server.js';
import type { Principal } from '@dfinity/principal';

// Define the cache filename
const TOKEN_CONFIG_FILENAME = 'prometheus-tokens.json';

/**
 * Fetches metadata from ICRC ledgers and saves it to the local prometheus-tokens.json file.
 * This overwrites the file completely to ensure it's always in sync with the provided list.
 * @param tokenPrincipals An array of Principals for the token canisters to sync.
 */
export async function syncTokenConfig(
  tokenPrincipals: Principal[],
): Promise<void> {
  if (tokenPrincipals.length === 0) {
    console.log('   No tokens to sync. Skipping token config generation.');
    // Ensure the file is empty if no tokens are provided
    fs.writeFileSync(TOKEN_CONFIG_FILENAME, JSON.stringify([], null, 2));
    return;
  }

  console.log(`\nSyncing local token config to ./${TOKEN_CONFIG_FILENAME}...`);

  const tokenInfos: TokenInfo[] = [];
  const anonymousAgent = new HttpAgent({ host: 'https://icp-api.io' });

  for (const tokenPrincipal of tokenPrincipals) {
    try {
      const ledger = IcrcLedgerCanister.create({
        agent: anonymousAgent,
        canisterId: tokenPrincipal,
      });

      const metadataRes = await ledger.metadata({});
      const metadata = mapTokenMetadata(metadataRes);

      if (!metadata) {
        console.warn(
          `   ⚠️  No metadata found for ${tokenPrincipal.toText()}. Skipping.`,
        );
        continue;
      }

      tokenInfos.push({
        canister_id: tokenPrincipal.toText(),
        symbol: metadata?.symbol,
        decimals: metadata?.decimals,
      });
      console.log(
        `   ✅ Synced config for ${metadata?.symbol} (${tokenPrincipal.toText()})`,
      );
    } catch (error) {
      if (error instanceof Error) {
        console.warn(
          `   ⚠️  Error fetching metadata for ${tokenPrincipal.toText()}: ${error.message}`,
        );
        continue;
      }
    }
  }

  const absolutePath = path.resolve(TOKEN_CONFIG_FILENAME); // Get the absolute path
  fs.writeFileSync(absolutePath, JSON.stringify(tokenInfos, null, 2));

  // Also update the .env file with the absolute path
  updateEnvFile({ TOKEN_CONFIG_PATH: absolutePath });

  console.log(`\nToken configuration saved successfully.`);
}

/**
 * Gets the currently selected DFX identity.
 */
export function getDfxIdentity(): Identity {
  try {
    const identityName = execSync('dfx identity whoami').toString().trim();
    const pemPath = path.join(
      os.homedir(),
      '.config',
      'dfx',
      'identity',
      identityName,
      'identity.pem',
    );
    return identityFromPem(pemPath);
  } catch (error) {
    console.error('❌ Failed to get DFX identity.');
    console.error(
      'Please ensure `dfx` is installed and you have a selected identity.',
    );
    throw error;
  }
}

/**
 * Adds patterns to the .gitignore file if they don't already exist.
 */
export async function updateGitignore(patterns: string[]): Promise<void> {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let existingPatterns = new Set<string>();
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    existingPatterns = new Set(content.split('\n').map((line) => line.trim()));
  } catch (error) {
    // .gitignore file doesn't exist, which is fine.
  }
  const patternsToAdd = patterns.filter((p) => !existingPatterns.has(p));
  if (patternsToAdd.length > 0) {
    const header = '\n# Prometheus Protocol Secrets - DO NOT COMMIT\n';
    const contentToAppend = header + patternsToAdd.join('\n') + '\n';
    fs.appendFileSync(gitignorePath, contentToAppend);
    console.log(`   ✅ Added ${patternsToAdd.join(', ')} to .gitignore.`);
  } else {
    console.log('   ✅ .gitignore is already configured to ignore secrets.');
  }
}

/**
 * Safely updates a .env file by merging new values with existing ones.
 */
export function updateEnvFile(newData: Record<string, string>): void {
  const envPath = path.join(process.cwd(), '.env');
  let existingData: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(envPath, 'utf-8');
    existingData = dotenv.parse(raw);
  } catch (error) {
    // .env file doesn't exist, which is fine.
  }
  const combinedData = { ...existingData, ...newData };
  const content = Object.entries(combinedData)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const header = `# This file is managed by the Prometheus Protocol configuration script.\n# Last updated: ${new Date().toISOString()}\n`;
  fs.writeFileSync(envPath, header + '\n' + content);
}

/**
 * Creates an authenticated actor for the Prometheus backend canister.
 */
export async function createPrometheusActor(): Promise<_SERVICE> {
  const operatorIdentity = getDfxIdentity();
  const agent = new HttpAgent({
    host: 'https://icp-api.io',
    identity: operatorIdentity,
  });
  const { idlFactory } = await import(
    '../declarations/oauth_backend/oauth_backend.did.js'
  );
  return Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId: 'bfggx-7yaaa-aaaai-q32gq-cai',
  });
}

/**
 * Returns a clean list of all available dfx identity names.
 */
export function getDfxIdentitiesList(): string[] {
  try {
    return execSync('dfx identity list')
      .toString()
      .split('\n')
      .map((line) => line.replace('(current)', '').trim())
      .filter(Boolean); // Remove any empty strings
  } catch (error) {
    console.error('❌ Failed to get DFX identity list.');
    throw error;
  }
}
/**
 * Loads an unencrypted dfx identity from the filesystem.
 * @param dfxIdentityName The name of the dfx identity to load.
 * @returns An object containing the loaded identity and the path to the PEM file.
 */
export function loadIdentity(dfxIdentityName: string) {
  // The new identityFromDfx function handles all the logic and error checking.
  return identityFromDfx(dfxIdentityName);
}
