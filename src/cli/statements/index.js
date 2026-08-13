/**
 * Subtree builder for `fob-stm statements <action>`.
 */

import { Command, Option } from 'commander';

import { safe, listOptions, jsonOption, idJsonCommand } from '../_helpers.js';
import { listStatementsHandler } from './list.js';
import { uploadStatementHandler } from './upload.js';
import { showStatementHandler } from './show.js';
import { downloadStatementHandler } from './download.js';
import { extractedStatementHandler } from './extracted.js';
import { renameStatementHandler } from './rename.js';
import { updateStatementHandler } from './update.js';
import { archiveStatementHandler, unarchiveStatementHandler } from './archive.js';
import { retryStatementHandler } from './retry.js';
import { submitPasswordHandler } from './submit-password.js';
import { submitAccountNumberHandler } from './submit-account-number.js';
import { deleteStatementHandler } from './delete.js';
import { deleteStatementTransactionsHandler } from './delete-transactions.js';

export function buildStatementsCommand() {
  const statements = new Command('statements').description('Query uploaded statement files');

  listOptions(
    statements
      .command('list')
      .description(
        'List statements (uploaded files; default sort created_at DESC, override with --sort-by/--sort-order)',
      ),
  )
    .option('--account <id>', 'Filter by account ID')
    .option('--period-from <date>', 'Period start (YYYY-MM-DD)')
    .option('--period-to <date>', 'Period end (YYYY-MM-DD)')
    .option('--file-type <type>', 'Filter by file type (e.g. csv, pdf, excel)')
    .option('--parser-type <type>', 'Filter by parser type (e.g. hdfc_savings__pdf)')
    .addOption(
      new Option('--step <step>', 'Filter by pipeline step').choices([
        'uploaded',
        'read_file',
        'identify_statement',
        'parse_statement',
        'detect_account',
        'detect_duplicates',
        'create_transactions',
        'complete',
      ]),
    )
    .option(
      '--period-source <source>',
      "Filter by data_source for period fields (e.g. 'extracted', 'computed', 'user_entered')",
    )
    .option('--period-missing', 'Only statements missing period_start')
    .option('--upload-from <date>', 'Uploaded on/after (YYYY-MM-DD)')
    .option('--upload-to <date>', 'Uploaded on/before (YYYY-MM-DD)')
    // Both halves are declared explicitly so the negation shows up in --help.
    .option('--reviewed', 'Filter by review status (--reviewed / --no-reviewed; false includes never-reviewed)')
    .option('--no-reviewed', 'Only statements not marked reviewed (includes never-reviewed)')
    .addOption(
      new Option('--sort-by <column>', 'Sort column (default: created_at)').choices([
        'created_at',
        'period_start',
        'period_end',
        'file_size',
      ]),
    )
    .addOption(
      new Option('--sort-order <order>', 'Sort direction (default: DESC)').choices([
        'ASC',
        'DESC',
        'asc',
        'desc',
      ]),
    )
    .addOption(
      new Option('--archived <status>', 'Filter by archive status')
        .choices(['all', 'active', 'archived'])
        .default('active'),
    )
    .option(
      '--fields <list>',
      'Columns to show, comma-separated (default: id,file_name,account,period_start,period_end,file_size,parser_type,step)',
    )
    .addOption(
      new Option('--format <format>', 'Output format (renders whatever --limit/--page/--all selected)').choices([
        'table',
        'csv',
        'json',
      ]),
    )
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count, count-by-file-type, and total size')
    .action(safe(listStatementsHandler));

  jsonOption(
    statements
      .command('upload')
      .description('Upload a statement file (pdf/csv/xls/xlsx) and start processing')
      .argument('<file>', 'Path to the statement file')
      .option('--account <id>', 'Pre-assign to an account ID (skips auto-detection)')
      .option('--parser-type <type>', 'Force a specific parser (e.g. hdfc_savings__pdf)'),
  ).action(safe(uploadStatementHandler));

  statements
    .command('show')
    .description('Show a statement by ID')
    .argument('<id>', 'Statement ID')
    .option('--json', 'Output raw JSON (includes parsed_data / raw_data)')
    .action(safe(showStatementHandler));

  statements
    .command('download')
    .description('Download the original uploaded file for a statement')
    .argument('<id>', 'Statement ID')
    .option('--output <path>', 'Where to write the file (default: server-provided filename in cwd)')
    .option('--force', 'Overwrite if the destination file already exists')
    .option('--print-url', "Print the API URL the CLI would call (don't download). Useful for curl/scripting.")
    .action(safe(downloadStatementHandler));

  jsonOption(
    statements
      .command('extracted')
      .description('Show the data extracted from a statement (parsed_data: metadata + transactions)')
      .argument('<id>', 'Statement ID')
      .option('--limit <n>', 'Max transactions to print in table (default 20)', Number)
      .option('--raw', 'Print raw_data instead of parsed_data (the source file content)'),
  ).action(safe(extractedStatementHandler));

  jsonOption(
    statements
      .command('rename')
      .description('Rename a statement (update file_name)')
      .argument('<id>', 'Statement ID')
      .argument('<name>', 'New file name'),
  ).action(safe(renameStatementHandler));

  jsonOption(
    statements
      .command('update')
      .description('Update period dates, balances, or review status')
      .argument('<id>', 'Statement ID')
      .option('--period-start <date>', 'Period start (YYYY-MM-DD)')
      .option('--period-end <date>', 'Period end (YYYY-MM-DD)')
      .option('--opening <amount>', 'Opening balance in currency units (e.g. 5000.50 = ₹5000.50)', Number)
      .option('--closing <amount>', 'Closing balance in currency units', Number)
      .option('--review-done', 'Mark review as done')
      .option('--no-review-done', 'Mark review as not done'),
  ).action(safe(updateStatementHandler));

  idJsonCommand(
    statements,
    'archive',
    'Archive a statement (hide from default list; reversible)',
    'Statement ID',
    archiveStatementHandler,
  );
  idJsonCommand(statements, 'unarchive', 'Unarchive a statement', 'Statement ID', unarchiveStatementHandler);
  idJsonCommand(
    statements,
    'retry',
    'Re-run statement processing from the read_file step',
    'Statement ID',
    retryStatementHandler,
  );

  jsonOption(
    statements
      .command('submit-password')
      .description('Supply the password for an encrypted PDF/XLSX statement and re-process')
      .argument('<id>', 'Statement ID')
      .requiredOption('--password <password>', 'The file password (validated server-side before it is stored)'),
  ).action(safe(submitPasswordHandler));

  jsonOption(
    statements
      .command('submit-account-number')
      .description('Supply the account number for a statement that failed account matching')
      .argument('<id>', 'Statement ID')
      .argument('<acc-no>', 'Account number to inject'),
  ).action(safe(submitAccountNumberHandler));

  statements
    .command('delete')
    .description('Permanently delete a statement (fails if it still has linked transactions)')
    .argument('<id>', 'Statement ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(safe(deleteStatementHandler));

  jsonOption(
    statements
      .command('delete-transactions')
      .description('Delete all transactions linked to a statement (statement itself stays)')
      .argument('<id>', 'Statement ID')
      .option('-y, --yes', 'Skip confirmation'),
  ).action(safe(deleteStatementTransactionsHandler));

  return statements;
}
