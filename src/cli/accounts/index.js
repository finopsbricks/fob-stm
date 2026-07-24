import { safe, paginationOptions } from '../_helpers.js';
import { listAccountsHandler } from './list.js';
import { showAccountHandler } from './show.js';

export function buildAccountsSubcommands(yargs) {
  return yargs
    .usage('$0 accounts <action> [options]')
    .command(
      'list',
      'List accounts',
      (y) =>
        paginationOptions(y)
          .option('category', { describe: 'Filter by category', type: 'string' })
          .option('status', { describe: "Filter by status (active|retired|quarantined|all)", type: 'string' })
          .option('fields', { describe: 'Comma-separated columns (see --help)', type: 'string' })
          .option('format', { describe: 'Output format: table|csv|json', type: 'string' })
          .option('output', { describe: 'Write output to a file instead of stdout', type: 'string' }),
      safe(listAccountsHandler),
    )
    .command(
      'show <id>',
      'Show one account in detail',
      (y) =>
        y
          .positional('id', { describe: 'Account id', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(showAccountHandler),
    )
    .demandCommand(1, 'Specify an action: list, show');
}
