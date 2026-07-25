import { safe } from '../_helpers.js';
import { listEntitiesHandler } from './list.js';

function categoriesEntitiesListOptions(yargs) {
  return yargs
    .option('from', { describe: 'Start date (YYYY-MM-DD), required', type: 'string', demandOption: true })
    .option('to', { describe: 'End date (YYYY-MM-DD), required', type: 'string', demandOption: true })
    .option('accounts', { describe: 'Filter to account IDs (comma-separated)', type: 'string' })
    .option('type', {
      describe: 'Filter by transaction type',
      type: 'string',
      choices: ['income', 'expense', 'asset', 'liability', 'transfer', 'unknown'],
    })
    .option('fields', {
      describe: 'Columns to show, comma-separated (default: category|entity,type,count,inflow,outflow)',
      type: 'string',
    })
    .option('format', {
      describe: 'Output format',
      type: 'string',
      choices: ['table', 'csv', 'json'],
    })
    .option('output', {
      describe: 'Write output to a file instead of stdout (for csv/json)',
      type: 'string',
    })
    .option('totals', {
      describe: 'Show count + inflow/outflow sums over all matching transactions',
      type: 'boolean',
    });
}

export function buildEntitiesSubcommands(yargs) {
  return yargs
    .usage('$0 entities <action> [options]')
    .command(
      'list',
      'List entities with period-aggregated count and inflow/outflow (read-only; mirrors the Entities page)',
      categoriesEntitiesListOptions,
      safe(listEntitiesHandler),
    )
    .demandCommand(1, 'Specify an action: list');
}
