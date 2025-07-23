import type { Command } from 'commander';
import prompts from 'prompts';
import { execSync } from 'node:child_process';
import { Principal } from '@dfinity/principal';
import {
  createPrometheusActor,
  updateEnvFile,
  updateGitignore,
  syncTokenConfig,
  loadIdentityWithPrompt,
} from '../utils.js';

export function registerRegisterCommand(program: Command) {
  program
    .command('register')
    .description('Register a new resource server with the Prometheus Protocol.')
    .action(async () => {
      console.log('\n📝 Registering a new server...');
      const serverDetails = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Resource Server Name:',
          initial: 'My Monetized AI Server',
        },
        {
          type: 'text',
          name: 'url',
          message: 'Production URL:',
          initial: 'http://localhost:3000',
        },
        {
          type: 'text',
          name: 'logo',
          message: 'Logo URL:',
          initial:
            'https://placehold.co/128x128/1a1a1a/ffffff/png?text=My+Server',
        },
        {
          type: 'text',
          name: 'tokens',
          message: 'Accepted ICRC-2 Canisters (comma-separated):',
          initial: 'cngnf-vqaaa-aaaar-qag4q-cai',
        },
      ]);

      const suggestedIdentityName =
        serverDetails.name.toLowerCase().replace(/\s+/g, '-') + '-sa';
      const { dfxIdentityName } = await prompts({
        type: 'text',
        name: 'dfxIdentityName',
        message: 'Enter a name for the new dfx identity for this server:',
        initial: suggestedIdentityName,
      });

      if (!dfxIdentityName) {
        console.log('\nConfiguration cancelled. Exiting.');
        return;
      }

      const existingIdentities = execSync('dfx identity list')
        .toString()
        .split('\n');
      if (!existingIdentities.includes(dfxIdentityName)) {
        console.log(`   Creating new dfx identity '${dfxIdentityName}'...`);

        // Ask user if they want to encrypt the new identity
        const { useEncryption } = await prompts({
          type: 'confirm',
          name: 'useEncryption',
          message: 'Do you want to protect this identity with a password?',
          initial: true,
        });

        const storageMode = useEncryption ? '' : '--storage-mode plaintext';
        // Let dfx handle the interactive password prompt if encryption is chosen
        execSync(`dfx identity new "${dfxIdentityName}" ${storageMode}`);
        console.log(`   ✅ Successfully created identity.`);
      } else {
        console.log(`   ✅ Using existing dfx identity '${dfxIdentityName}'.`);
      }

      // Use the new utility to load the identity, which handles encryption
      const { identity: servicePrincipalIdentity, pemPath } =
        await loadIdentityWithPrompt(dfxIdentityName);

      const servicePrincipal = servicePrincipalIdentity.getPrincipal();
      const tokenPrincipals = serverDetails.tokens
        .split(',')
        .map((p: string) => Principal.fromText(p.trim()));

      const actor = await createPrometheusActor();
      const args = {
        name: serverDetails.name,
        initial_service_principal: servicePrincipal,
        logo_uri: serverDetails.logo,
        uris: [serverDetails.url],
        accepted_payment_canisters: tokenPrincipals,
        scopes: [],
      };
      const result = await actor.register_resource_server(args);
      if ('err' in result) throw new Error(`Operation failed: ${result.err}`);
      console.log(
        `   ✅ Successfully registered server '${serverDetails.name}'`,
      );

      console.log('\n2. Generating configuration files...');

      const envData = {
        AUTH_ISSUER: 'https://bfggx-7yaaa-aaaai-q32gq-cai.icp0.io',
        IDENTITY_PEM_PATH: pemPath, // Use the correct path from the utility
        PAYOUT_PRINCIPAL: servicePrincipal.toText(),
        SERVER_URL: serverDetails.url,
      };
      updateEnvFile(envData);
      console.log(`   ✅ Created/updated .env file.`);

      // Sync the token metadata to the local JSON file
      await syncTokenConfig(tokenPrincipals);

      await updateGitignore(['.env']);

      console.log('\n🎉 Configuration complete!');
      console.log(
        `   The identity for this server is named '${dfxIdentityName}'.`,
      );
      console.log(
        `   You can use it with dfx: \`dfx identity use ${dfxIdentityName}\``,
      );
      console.log(`   Then check its balance: \`dfx ledger balance\``);
    });
}
