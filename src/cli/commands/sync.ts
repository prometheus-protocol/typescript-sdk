import type { Command } from 'commander';
import prompts from 'prompts';
import {
  createPrometheusActor,
  getDfxIdentitiesList,
  updateEnvFile,
  syncTokenConfig,
  loadIdentity, // Import the new utility function
} from '../utils.js';

export function registerSyncCommand(program: Command) {
  program
    .command('sync')
    .description(
      'Sync a remote resource server configuration to your local .env file.',
    )
    .action(async () => {
      console.log('Fetching your registered resource servers...');
      const actor = await createPrometheusActor();
      const listResult = await actor.list_my_resource_servers();

      if ('err' in listResult) {
        throw new Error(`Failed to list servers: ${listResult.err}`);
      }
      const existingServers = listResult.ok;

      if (existingServers.length === 0) {
        console.log('You have no resource servers to sync.');
        return;
      }

      const { serverToSyncId } = await prompts({
        type: 'select',
        name: 'serverToSyncId',
        message: 'Which resource server would you like to sync locally?',
        choices: existingServers.map((s) => ({
          title: `${s.name} (${s.resource_server_id})`,
          value: s.resource_server_id,
        })),
      });

      if (!serverToSyncId) {
        console.log('\nSync cancelled. Exiting.');
        return;
      }

      const serverToSync = existingServers.find(
        (s) => s.resource_server_id === serverToSyncId,
      )!;

      const localIdentities = getDfxIdentitiesList();
      const { dfxIdentityName } = await prompts({
        type: 'select',
        name: 'dfxIdentityName',
        message: 'Which local dfx identity corresponds to this server?',
        choices: localIdentities.map((name) => ({ title: name, value: name })),
      });

      if (!dfxIdentityName) {
        console.log('\nSync cancelled. Exiting.');
        return;
      }

      // Use the new utility to load the identity, which handles encryption
      const { identity: localIdentity, pemPath } =
        loadIdentity(dfxIdentityName);

      const localPrincipal = localIdentity.getPrincipal();
      const remotePrincipal = serverToSync.service_principals[0];

      if (localPrincipal.toText() !== remotePrincipal.toText()) {
        throw new Error(
          `Principal mismatch! The selected identity '${dfxIdentityName}' (${localPrincipal.toText()}) does not match the principal registered for server '${serverToSync.name}' (${remotePrincipal.toText()}).`,
        );
      }

      console.log('\n✅ Principals match. Syncing configuration...');

      const envData = {
        AUTH_ISSUER: 'https://bfggx-7yaaa-aaaai-q32gq-cai.icp0.io',
        IDENTITY_PEM_PATH: pemPath, // Use the correct path from the utility
        PAYOUT_PRINCIPAL: remotePrincipal.toText(),
        SERVER_URL: serverToSync.uris[0],
      };
      updateEnvFile(envData);

      await syncTokenConfig(serverToSync.accepted_payment_canisters);

      console.log(
        `\n🎉 Successfully synced configuration for '${serverToSync.name}' to your .env file.`,
      );
    });
}
