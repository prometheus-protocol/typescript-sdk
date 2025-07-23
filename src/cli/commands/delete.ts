// File: src/cli/commands/delete.ts

import type { Command } from 'commander';
import prompts from 'prompts';
import { createPrometheusActor } from '../utils.js';
import type { Result } from '../../declarations/oauth_backend/oauth_backend.did.js';

export function registerDeleteCommand(program: Command) {
  program
    .command('delete')
    .description('Delete an existing resource server.')
    .action(async () => {
      console.log('Fetching your registered resource servers...');
      const actor = await createPrometheusActor();
      const listResult = await actor.list_my_resource_servers();

      if ('err' in listResult) {
        throw new Error(`Failed to list servers: ${listResult.err}`);
      }
      const existingServers = listResult.ok;

      if (existingServers.length === 0) {
        console.log('You have no resource servers to delete.');
        return;
      }

      const { serverToManageId } = await prompts({
        type: 'select',
        name: 'serverToManageId',
        message: 'Which server would you like to delete?',
        choices: existingServers.map((s) => ({
          title: `${s.name} (${s.resource_server_id})`,
          value: s.resource_server_id,
        })),
      });

      if (!serverToManageId) {
        console.log('\nDelete operation cancelled. Exiting.');
        return;
      }

      const { confirmDelete } = await prompts({
        type: 'confirm',
        name: 'confirmDelete',
        message: `Are you sure you want to delete this server? This action cannot be undone.`,
        initial: false,
      });

      if (confirmDelete) {
        console.log('\nDeleting server...');
        const deleteResult: Result =
          await actor.delete_resource_server(serverToManageId);
        if ('err' in deleteResult)
          throw new Error(`Failed to delete server: ${deleteResult.err}`);
        console.log('   ✅ Server successfully deleted.');
      } else {
        console.log('\nDelete operation cancelled.');
      }
    });
}
