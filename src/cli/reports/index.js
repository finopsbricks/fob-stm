/**
 * Subtree builder for `fob-stm reports <action>`.
 */

import { Argument, Command, Option } from 'commander';

import { safe } from '../_helpers.js';
import { showReportHandler, REPORT_NAMES } from './show.js';

export function buildReportsCommand() {
  const reports = new Command('reports').description('Compute reports');

  reports
    .command('show')
    .description('Compute and print a report (JSON output; statement-coverage prints a table)')
    .addArgument(new Argument('<name>', 'Report name').choices(REPORT_NAMES))
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .addOption(new Option('--group-by <bucket>', 'Time bucket').choices(['day', 'week', 'month', 'year']))
    .option('--accounts <ids>', 'Filter to account IDs (comma-separated)')
    .option('--particulars <text>', 'Filter by particulars (free-text)')
    .option('--entity <entity>', 'Filter by entity')
    .option('--category <category>', 'Filter by category')
    .option('--json', 'Output raw JSON (statement-coverage prints a table without it; other reports always print JSON)')
    .action(safe(showReportHandler));

  return reports;
}
