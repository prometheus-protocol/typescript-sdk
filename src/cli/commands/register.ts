import type { Command } from 'commander';
import prompts from 'prompts';
import { execSync } from 'node:child_process';
import { Principal } from '@dfinity/principal';
import {
  createPrometheusActor,
  updateEnvFile,
  updateGitignore,
  syncTokenConfig,
  loadIdentity,
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
        // +++ SIMPLIFIED UX FOR SCOPES +++
        {
          type: 'confirm',
          name: 'willCharge',
          message: 'Will this server charge users for services?',
          initial: true,
        },
        {
          type: 'text',
          name: 'tokens',
          message: 'Accepted ICRC-2 Canisters (comma-separated):',
          initial: 'cngnf-vqaaa-aaaar-qag4q-cai',
        },
      ]);

      // ... (dfx identity creation logic remains the same) ...
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
        const { useEncryption } = await prompts({
          type: 'confirm',
          name: 'useEncryption',
          message: 'Do you want to protect this identity with a password?',
          initial: true,
        });
        const storageMode = useEncryption ? '' : '--storage-mode plaintext';
        execSync(`dfx identity new "${dfxIdentityName}" ${storageMode}`, {
          stdio: 'inherit',
        });
        console.log(`   ✅ Successfully created identity.`);
      } else {
        console.log(`   ✅ Using existing dfx identity '${dfxIdentityName}'.`);
      }

      const { identity: servicePrincipalIdentity, pemPath } =
        loadIdentity(dfxIdentityName);
      const servicePrincipal = servicePrincipalIdentity.getPrincipal();

      // +++ BUILD SCOPES BASED ON THE SIMPLE PROMPT +++
      const finalScopes: [string, string][] = [
        [
          'openid',
          "Grants access to the user's unique identifier (Principal).",
        ],
      ];

      if (serverDetails.willCharge) {
        finalScopes.push([
          'prometheus:charge',
          'Allows the server to request payments from the user.',
        ]);
      }

      const tokenPrincipals = serverDetails.tokens
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p)
        .map((p: string) => Principal.fromText(p));

      const actor = await createPrometheusActor();
      const args = {
        name: serverDetails.name,
        initial_service_principal: servicePrincipal,
        logo_uri: serverDetails.logo,
        uris: [serverDetails.url],
        accepted_payment_canisters: tokenPrincipals,
        scopes: finalScopes,
      };
      const result = await actor.register_resource_server(args);
      if ('err' in result) throw new Error(`Operation failed: ${result.err}`);
      console.log(
        `   ✅ Successfully registered server '${serverDetails.name}'`,
      );

      // ... (rest of the file remains the same) ...
      console.log('\n2. Generating configuration files...');
      const envData = {
        AUTH_ISSUER: 'https://bfggx-7yaaa-aaaai-q32gq-cai.icp0.io',
        IDENTITY_PEM_PATH: pemPath,
        PAYOUT_PRINCIPAL: servicePrincipal.toText(),
        SERVER_URL: serverDetails.url,
      };
      updateEnvFile(envData);
      console.log(`   ✅ Created/updated .env file.`);
      await syncTokenConfig(tokenPrincipals);
      await updateGitignore(['.env']);
      console.log('\n🎉 Configuration complete!');
    });
}
