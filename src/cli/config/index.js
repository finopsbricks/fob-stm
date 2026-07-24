import { safe } from '../_helpers.js';
import { addConfigHandler } from './add.js';
import { listConfigHandler } from './list.js';
import { useConfigHandler } from './use.js';
import { removeConfigHandler } from './remove.js';

export function buildConfigSubcommands(yargs) {
  return yargs
    .usage('$0 config <action> [options]')
    .command(
      'add <org>',
      "Add or update an org's statements credentials",
      (y) =>
        y
          .positional('org', { describe: 'Org name', type: 'string' })
          .option('api-url', { describe: 'API base URL (origin only)', type: 'string', demandOption: true })
          .option('api-key', { describe: 'API key', type: 'string', demandOption: true })
          .option('api-secret', { describe: 'API secret', type: 'string', demandOption: true }),
      safe(addConfigHandler),
    )
    .command(
      'list',
      'List configured orgs (current marked with *)',
      (y) => y.option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(listConfigHandler),
    )
    .command(
      'use <org>',
      'Set the current org',
      (y) => y.positional('org', { describe: 'Org name', type: 'string' }),
      safe(useConfigHandler),
    )
    .command(
      'remove <org>',
      'Remove an org',
      (y) => y.positional('org', { describe: 'Org name', type: 'string' }),
      safe(removeConfigHandler),
    )
    .demandCommand(1, 'Specify an action: add, list, use, remove');
}
