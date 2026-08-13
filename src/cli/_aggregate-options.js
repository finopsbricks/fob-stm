/**
 * The period-aggregate list flags shared by `categories list` and
 * `entities list` — the two resources are identical apart from naming.
 */

import { Option } from 'commander';

/**
 * @param {import('commander').Command} cmd
 * @param {string} defaultFieldsLabel  the resource's default --fields list, for the help text
 */
export function aggregateListOptions(cmd, defaultFieldsLabel) {
  return cmd
    .requiredOption('--from <date>', 'Start date (YYYY-MM-DD), required')
    .requiredOption('--to <date>', 'End date (YYYY-MM-DD), required')
    .option('--accounts <ids>', 'Filter to account IDs (comma-separated)')
    .addOption(
      new Option('--type <type>', 'Filter by transaction type').choices([
        'income',
        'expense',
        'asset',
        'liability',
        'transfer',
        'unknown',
      ]),
    )
    .option('--fields <list>', `Columns to show, comma-separated (default: ${defaultFieldsLabel})`)
    .addOption(new Option('--format <format>', 'Output format').choices(['table', 'csv', 'json']))
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count + inflow/outflow sums over all matching transactions');
}
