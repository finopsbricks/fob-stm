import { safe, localOptions } from '../_helpers.js';
import { showReportHandler, REPORT_NAMES } from './show.js';

export function buildReportsSubcommands(yargs) {
  return yargs
    .usage('$0 reports <action> [options]')
    .command(
      'show <name>',
      'Compute and print a report (JSON output)',
      (yargs) =>
        localOptions(yargs.positional('name', { describe: 'Report name', type: 'string', choices: REPORT_NAMES }))
          .option('from', { describe: 'Start date (YYYY-MM-DD)', type: 'string' })
          .option('to', { describe: 'End date (YYYY-MM-DD)', type: 'string' })
          .option('group-by', {
            describe: 'Time bucket',
            type: 'string',
            choices: ['day', 'week', 'month', 'year'],
          })
          .option('accounts', { describe: 'Filter to account IDs (comma-separated)', type: 'string' })
          .option('particulars', { describe: 'Filter by particulars (free-text)', type: 'string' })
          .option('entity', { describe: 'Filter by entity', type: 'string' })
          .option('category', { describe: 'Filter by category', type: 'string' }),
      safe(showReportHandler),
    )
    .demandCommand(1, 'Specify an action: show');
}
