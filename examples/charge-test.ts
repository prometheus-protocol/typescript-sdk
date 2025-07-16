import { Principal } from '@dfinity/principal';
import { PrometheusServerClient } from '../src/index.ts'; // Import directly from src for easy testing
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load .env file
import { decodeFile } from '../src/identity.ts';
import * as url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- CONFIGURATION ---
// Create a .env file in the root of your SDK project with these variables
const AUTH_CANISTER_ID = process.env.AUTH_CANISTER_ID!;
const PEM_FILE_PATH = process.env.PEM_FILE_PATH!; // e.g., './server-identity.pem'
const USER_TO_CHARGE_PRINCIPAL = process.env.USER_TO_CHARGE_PRINCIPAL!;
const CHARGE_AMOUNT = BigInt(process.env.CHARGE_AMOUNT!); // e.g., 10000n

async function main() {
  if (
    !AUTH_CANISTER_ID ||
    !PEM_FILE_PATH ||
    !USER_TO_CHARGE_PRINCIPAL ||
    !CHARGE_AMOUNT
  ) {
    throw new Error(
      'Please create a .env file and set all required environment variables.',
    );
  }

  console.log('--- Live Fire Test: Charging a User ---');

  // 1. Load the server's identity from the PEM file
  console.log(`Loading server identity from ${PEM_FILE_PATH}...`);

  const identity = decodeFile(path.resolve(__dirname, '..', PEM_FILE_PATH));
  console.log(`Server Principal: ${identity.getPrincipal().toText()}`);

  // 2. Instantiate our SDK client
  const prometheusClient = new PrometheusServerClient({
    host: 'http://127.0.0.1:4943',
    authCanisterId: AUTH_CANISTER_ID,
    identity: identity,
  });

  // 3. Perform the charge
  console.log(
    `Attempting to charge ${USER_TO_CHARGE_PRINCIPAL} for ${CHARGE_AMOUNT} units...`,
  );
  const result = await prometheusClient.charge({
    userToCharge: Principal.fromText(USER_TO_CHARGE_PRINCIPAL),
    amount: CHARGE_AMOUNT,
  });

  // 4. Log the result
  if (result.ok) {
    console.log('✅ SUCCESS: Charge successful!');
  } else {
    console.error(`❌ FAILED: Charge failed with error: ${result.error}`);
  }
}

main().catch(console.error);
