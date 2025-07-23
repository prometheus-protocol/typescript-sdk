import type { Command } from 'commander';
import prompts from 'prompts';
import { Principal } from '@dfinity/principal';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  createPrometheusActor,
  syncTokenConfig,
  updateEnvFile,
} from '../utils.js';
import type { UpdateResourceServerArgs } from '../../declarations/oauth_backend/oauth_backend.did.js';

export function registerUpdateCommand(program: Command) {
  program
    .command('update')
    .description('Update the details of an existing resource server.')
    .action(async () => {
      console.log('Fetching your registered resource servers...');
      const actor = await createPrometheusActor();
      const listResult = await actor.list_my_resource_servers();

      if ('err' in listResult) {
        throw new Error(`Failed to list servers: ${listResult.err}`);
      }
      const existingServers = listResult.ok;

      if (existingServers.length === 0) {
        console.log('You have no resource servers to update.');
        return;
      }

      const { serverToManageId } = await prompts({
        type: 'select',
        name: 'serverToManageId',
        message: 'Which server would you like to update?',
        choices: existingServers.map((s) => ({
          title: `${s.name} (${s.resource_server_id})`,
          value: s.resource_server_id,
        })),
      });

      if (!serverToManageId) {
        console.log('\nUpdate cancelled. Exiting.');
        return;
      }

      const serverToUpdate = existingServers.find(
        (s) => s.resource_server_id === serverToManageId,
      )!;

      // Determine initial state for the charging prompt. Handles malformed data gracefully.
      const currentlyCharges = serverToUpdate.scopes.some(
        (scope) => Array.isArray(scope) && scope[0] === 'prometheus:charge',
      );

      // ... (payout principal logic is unchanged) ...
      let currentPayoutPrincipal = '';
      try {
        const envPath = path.join(process.cwd(), '.env');
        const raw = fs.readFileSync(envPath, 'utf-8');
        const existingData = dotenv.parse(raw);
        currentPayoutPrincipal = existingData.PAYOUT_PRINCIPAL || '';
      } catch (error) {
        // .env file doesn't exist or is invalid, which is fine.
      }

      console.log(`\n📝 Updating '${serverToUpdate.name}'...`);
      const response = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Resource Server Name:',
          initial: serverToUpdate.name,
        },
        {
          type: 'text',
          name: 'url',
          message: 'Production URL:',
          initial: serverToUpdate.uris[0],
        },
        {
          type: 'text',
          name: 'logo',
          message: 'Logo URL:',
          initial: serverToUpdate.logo_uri,
        },
        // +++ SIMPLIFIED UX FOR SCOPES +++
        {
          type: 'confirm',
          name: 'willCharge',
          message: 'Will this server charge users for services?',
          initial: currentlyCharges,
        },
        {
          type: 'text',
          name: 'tokens',
          message: 'Accepted ICRC-2 Canisters (comma-separated):',
          initial: serverToUpdate.accepted_payment_canisters
            .map((p) => p.toText())
            .join(', '),
        },
        {
          type: 'text',
          name: 'payoutPrincipal',
          message: 'Payout Principal (leave blank to keep current):',
          initial: currentPayoutPrincipal,
        },
      ]);

      const newTokens = response.tokens
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p)
        .map((p: string) => Principal.fromText(p));

      // +++ REBUILD SCOPES FROM SCRATCH, CLEANING UP ANY BAD DATA +++
      const newScopes: [string, string][] = [
        [
          'openid',
          "Grants access to the user's unique identifier (Principal).",
        ],
      ];

      if (response.willCharge) {
        newScopes.push([
          'prometheus:charge',
          'Allows the server to request payments from the user.',
        ]);
      }

      const args: UpdateResourceServerArgs = {
        resource_server_id: serverToUpdate.resource_server_id,
        name: [response.name],
        uris: [[response.url]],
        logo_uri: [response.logo],
        accepted_payment_canisters: [newTokens],
        scopes: [newScopes],
        service_principals: [],
      };

      const result = await actor.update_resource_server(args);
      if ('err' in result) throw new Error(`Operation failed: ${result.err}`);

      // ... (rest of the file remains the same) ...
      console.log(
        `   ✅ Successfully updated server '${response.name}' on-chain.`,
      );
      console.log('   Updating local .env file...');
      const envUpdates: Record<string, string> = { SERVER_URL: response.url };
      if (
        response.payoutPrincipal &&
        response.payoutPrincipal !== currentPayoutPrincipal
      ) {
        envUpdates.PAYOUT_PRINCIPAL = response.payoutPrincipal;
      }
      updateEnvFile(envUpdates);
      await syncTokenConfig(newTokens);
      console.log(
        '\nUpdate complete. Local .env file and token config have been updated.',
      );
    });
}
