import { safe, paginationOptions } from '../_helpers.js';
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

export function buildStatementsResourceSubcommands(yargs) {
  return yargs
    .usage('$0 statements <action> [options]')
    .command(
      'list',
      'List statements (uploaded files; default sort created_at DESC, override with --sort-by/--sort-order)',
      (yargs) =>
        paginationOptions(yargs)
          .option('account', { describe: 'Filter by account ID', type: 'string' })
          .option('period-from', { describe: 'Period start (YYYY-MM-DD)', type: 'string' })
          .option('period-to', { describe: 'Period end (YYYY-MM-DD)', type: 'string' })
          .option('file-type', { describe: 'Filter by file type (e.g. csv, pdf, excel)', type: 'string' })
          .option('parser-type', { describe: 'Filter by parser type (e.g. hdfc_savings__pdf)', type: 'string' })
          .option('step', {
            describe: 'Filter by pipeline step',
            type: 'string',
            choices: [
              'uploaded', 'read_file', 'identify_statement', 'parse_statement',
              'detect_account', 'detect_duplicates', 'create_transactions', 'complete',
            ],
          })
          .option('period-source', {
            describe: "Filter by data_source for period fields (e.g. 'extracted', 'computed', 'user_entered')",
            type: 'string',
          })
          .option('period-missing', {
            describe: 'Only statements missing period_start',
            type: 'boolean',
          })
          .option('upload-from', { describe: 'Uploaded on/after (YYYY-MM-DD)', type: 'string' })
          .option('upload-to', { describe: 'Uploaded on/before (YYYY-MM-DD)', type: 'string' })
          .option('reviewed', {
            describe: 'Filter by review status (--reviewed / --no-reviewed; false includes never-reviewed)',
            type: 'boolean',
          })
          .option('sort-by', {
            describe: 'Sort column (default: created_at)',
            type: 'string',
            choices: ['created_at', 'period_start', 'period_end', 'file_size'],
          })
          .option('sort-order', {
            describe: 'Sort direction (default: DESC)',
            type: 'string',
            choices: ['ASC', 'DESC', 'asc', 'desc'],
          })
          .option('archived', {
            describe: 'Filter by archive status',
            type: 'string',
            choices: ['all', 'active', 'archived'],
            default: 'active',
          })
          .option('fields', {
            describe:
              'Columns to show, comma-separated (default: id,file_name,account,period_start,period_end,file_size,parser_type,step)',
            type: 'string',
          })
          .option('format', {
            describe: 'Output format. csv/json auto-paginate (max 15000 rows)',
            type: 'string',
            choices: ['table', 'csv', 'json'],
          })
          .option('output', {
            describe: 'Write output to a file instead of stdout (for csv/json)',
            type: 'string',
          })
          .option('totals', {
            describe: 'Show count, count-by-file-type, and total size',
            type: 'boolean',
          }),
      safe(listStatementsHandler),
    )
    .command(
      'upload <file>',
      'Upload a statement file (pdf/csv/xls/xlsx) and start processing',
      (yargs) =>
        yargs
          .positional('file', { describe: 'Path to the statement file', type: 'string' })
          .option('account', {
            describe: 'Pre-assign to an account ID (skips auto-detection)',
            type: 'string',
          })
          .option('parser-type', {
            describe: 'Force a specific parser (e.g. hdfc_savings__pdf)',
            type: 'string',
          })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(uploadStatementHandler),
    )
    .command(
      'show <id>',
      'Show a statement by ID',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON (includes parsed_data / raw_data)', type: 'boolean' }),
      safe(showStatementHandler),
    )
    .command(
      'download <id>',
      'Download the original uploaded file for a statement',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('output', {
            describe:
              'Where to write the file (default: server-provided filename in cwd)',
            type: 'string',
          })
          .option('force', {
            describe: 'Overwrite if the destination file already exists',
            type: 'boolean',
          })
          .option('print-url', {
            describe:
              "Print the API URL the CLI would call (don't download). Useful for curl/scripting.",
            type: 'boolean',
          }),
      safe(downloadStatementHandler),
    )
    .command(
      'extracted <id>',
      'Show the data extracted from a statement (parsed_data: metadata + transactions)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('limit', {
            describe: 'Max transactions to print in table (default 20)',
            type: 'number',
          })
          .option('raw', {
            describe: 'Print raw_data instead of parsed_data (the source file content)',
            type: 'boolean',
          })
          .option('json', { describe: 'Output as JSON', type: 'boolean' }),
      safe(extractedStatementHandler),
    )
    .command(
      'rename <id> <name>',
      'Rename a statement (update file_name)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .positional('name', { describe: 'New file name', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(renameStatementHandler),
    )
    .command(
      'update <id>',
      'Update period dates, balances, or review status',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('period-start', { describe: 'Period start (YYYY-MM-DD)', type: 'string' })
          .option('period-end', { describe: 'Period end (YYYY-MM-DD)', type: 'string' })
          .option('opening', {
            describe: 'Opening balance in currency units (e.g. 5000.50 = ₹5000.50)',
            type: 'number',
          })
          .option('closing', {
            describe: 'Closing balance in currency units',
            type: 'number',
          })
          .option('review-done', {
            describe: 'Mark review as done (true) or undone (false)',
            type: 'boolean',
          })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(updateStatementHandler),
    )
    .command(
      'archive <id>',
      'Archive a statement (hide from default list; reversible)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(archiveStatementHandler),
    )
    .command(
      'unarchive <id>',
      'Unarchive a statement',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(unarchiveStatementHandler),
    )
    .command(
      'retry <id>',
      'Re-run statement processing from the read_file step',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(retryStatementHandler),
    )
    .command(
      'submit-password <id>',
      'Supply the password for an encrypted PDF/XLSX statement and re-process',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('password', {
            describe: 'The file password (validated server-side before it is stored)',
            type: 'string',
            demandOption: true,
          })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(submitPasswordHandler),
    )
    .command(
      'submit-account-number <id> <acc-no>',
      'Supply the account number for a statement that failed account matching',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .positional('acc-no', { describe: 'Account number to inject', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(submitAccountNumberHandler),
    )
    .command(
      'delete <id>',
      'Permanently delete a statement (fails if it still has linked transactions)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' }),
      safe(deleteStatementHandler),
    )
    .command(
      'delete-transactions <id>',
      'Delete all transactions linked to a statement (statement itself stays)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Statement ID', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(deleteStatementTransactionsHandler),
    )
    .demandCommand(
      1,
      'Specify an action: list, upload, show, download, extracted, rename, update, archive, unarchive, retry, submit-password, submit-account-number, delete, delete-transactions',
    );
}
