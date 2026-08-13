/**
 * `fob-stm transactions <action>` — commander port of src/cli/transactions/index.js.
 */

import { Command, Option } from 'commander';

import { safe, listOptions, jsonOption } from './_helpers.js';
import { listTransactionsHandler } from '../cli/transactions/list.js';
import { showTransactionHandler } from '../cli/transactions/show.js';
import { editTransactionHandler } from '../cli/transactions/edit.js';

export function buildTransactionsCommand() {
  const transactions = new Command('transactions').description('Query transactions');

  listOptions(transactions.command('list').description('List transactions'))
    .option('--account <ids>', 'Filter by account ID(s), comma-separated for multiple')
    .option('--currency <code>', 'Filter by account currency code (e.g. USD)')
    .option('--statement <ids>', 'Filter by statement ID(s), comma-separated for multiple')
    .option('--from <date>', 'Start date (YYYY-MM-DD)')
    .option('--to <date>', 'End date (YYYY-MM-DD)')
    .option('--particulars <text>', 'Filter by particulars (case-insensitive)')
    .option('--comments <text>', "Filter by comments (case-insensitive; pass 'empty' for blank)")
    .option('--entity <entity>', "Filter by entity (case-insensitive; pass 'empty' for unset)")
    .option('--category <category>', "Filter by category (case-insensitive; pass 'empty' for unset)")
    .option('--type <type>', 'Filter by transaction type')
    .option('--amount-from <amount>', 'Minimum amount (currency units, e.g. 100 = ₹100)', Number)
    .option('--amount-to <amount>', 'Maximum amount (currency units)', Number)
    .addOption(
      new Option('--flow <flow>', 'Restrict --amount-from/--amount-to to inflow or outflow').choices([
        'all',
        'inflow',
        'outflow',
      ]),
    )
    .addOption(new Option('--sort <order>', 'Sort order by date').choices(['asc', 'desc']))
    .option(
      '--fields <list>',
      'Columns to show, comma-separated (default: id,date,account,particulars,type,category,entity,currency,inflow,outflow)',
    )
    .addOption(
      new Option('--format <format>', 'Output format (renders whatever --limit/--page/--all selected)').choices([
        'table',
        'csv',
        'json',
      ]),
    )
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count + inflow/outflow sums + net, grouped by currency')
    .action(safe(listTransactionsHandler));

  jsonOption(
    transactions
      .command('show')
      .description('Show a transaction by ID')
      .argument('<id>', 'Transaction ID'),
  ).action(safe(showTransactionHandler));

  jsonOption(
    transactions
      .command('edit')
      .description('Edit transaction metadata. Pass comma-separated IDs to bulk-edit.')
      .argument('<id>', 'Transaction ID(s), comma-separated for bulk edit')
      .option('--entity <entity>', 'Set entity (counterparty). Pass "" to clear.')
      .option('--category <category>', 'Set category. Pass "" to clear.')
      .option('--type <type>', 'Set transaction type (recognised: income, expense, transfer, asset, liability)')
      .option('--po <po>', 'Set PO. Pass "" to clear.')
      .option('--comments <text>', 'Set comments. Pass "" to clear.')
      .option('--particulars <text>', 'Set particulars (narration)')
      .option('-y, --yes', 'Skip confirmation'),
  ).action(safe(editTransactionHandler));

  return transactions;
}
