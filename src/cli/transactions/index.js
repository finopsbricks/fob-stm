import { safe, paginationOptions, localOptions } from '../_helpers.js';

import { listTransactionsHandler } from './list.js';
import { showTransactionHandler } from './show.js';
import { editTransactionHandler } from './edit.js';

export function buildTransactionsSubcommands(yargs) {
  return yargs
    .usage('$0 transactions <action> [options]')
    .command(
      'list',
      'List transactions',
      (yargs) =>
        paginationOptions(yargs)
          .option('account', {
            describe: 'Filter by account ID(s), comma-separated for multiple',
            type: 'string',
          })
          .option('statement', {
            describe: 'Filter by statement ID(s), comma-separated for multiple',
            type: 'string',
          })
          .option('from', { describe: 'Start date (YYYY-MM-DD)', type: 'string' })
          .option('to', { describe: 'End date (YYYY-MM-DD)', type: 'string' })
          .option('particulars', { describe: 'Filter by particulars (case-insensitive)', type: 'string' })
          .option('comments', {
            describe: "Filter by comments (case-insensitive; pass 'empty' for blank)",
            type: 'string',
          })
          .option('entity', {
            describe: "Filter by entity (case-insensitive; pass 'empty' for unset)",
            type: 'string',
          })
          .option('category', {
            describe: "Filter by category (case-insensitive; pass 'empty' for unset)",
            type: 'string',
          })
          .option('type', { describe: 'Filter by transaction type', type: 'string' })
          .option('amount-from', {
            describe: 'Minimum amount (currency units, e.g. 100 = ₹100)',
            type: 'number',
          })
          .option('amount-to', { describe: 'Maximum amount (currency units)', type: 'number' })
          .option('flow', {
            describe: 'Restrict --amount-from/--amount-to to inflow or outflow',
            type: 'string',
            choices: ['all', 'inflow', 'outflow'],
          })
          .option('sort', {
            describe: 'Sort order by date',
            type: 'string',
            choices: ['asc', 'desc'],
          })
          .option('fields', {
            describe:
              'Columns to show, comma-separated (default: id,date,account,particulars,type,category,entity,inflow,outflow)',
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
            describe: 'Show count + inflow/outflow sums + net over all matching transactions',
            type: 'boolean',
          }),
      safe(listTransactionsHandler),
    )
    .command(
      'show <id>',
      'Show a transaction by ID',
      (yargs) =>
        localOptions(yargs.positional('id', { describe: 'Transaction ID', type: 'string' }))
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(showTransactionHandler),
    )
    .command(
      'edit <id>',
      'Edit transaction metadata. Pass comma-separated IDs to bulk-edit.',
      (yargs) =>
        localOptions(
          yargs.positional('id', {
            describe: 'Transaction ID(s), comma-separated for bulk edit',
            type: 'string',
          }),
        )
          .option('entity', { describe: 'Set entity (counterparty). Pass "" to clear.', type: 'string' })
          .option('category', { describe: 'Set category. Pass "" to clear.', type: 'string' })
          .option('type', {
            describe: 'Set transaction type (recognised: income, expense, transfer, asset, liability)',
            type: 'string',
          })
          .option('po', { describe: 'Set PO. Pass "" to clear.', type: 'string' })
          .option('comments', { describe: 'Set comments. Pass "" to clear.', type: 'string' })
          .option('particulars', { describe: 'Set particulars (narration)', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(editTransactionHandler),
    )
    .demandCommand(1, 'Specify an action: list, show, edit');
}
