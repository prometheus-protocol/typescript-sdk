import type { Command } from 'commander';
import { createPrometheusActor } from '../utils.js';

export function registerListCommand(program: Command) {
  program
    .command('list')
    .description('List all resource servers registered by your identity.')
    .action(async () => {
      console.log('Fetching your registered resource servers...');
      const actor = await createPrometheusActor();
      const result = await actor.list_my_resource_servers();

      if ('err' in result) {
        throw new Error(`Failed to list servers: ${result.err}`);
      }
      if (result.ok.length === 0) {
        console.log('You have no resource servers registered.');
        return;
      }
      console.table(
        result.ok.map((s) => ({
          Name: s.name,
          'Resource Server ID': s.resource_server_id,
          URL: s.uris[0],
        })),
      );
    });
}
