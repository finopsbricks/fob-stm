/**
 * Subtree builder for `fob-stm accounts <action>`.
 */

import { safe, paginationOptions } from '../_helpers.js';

import { listAccountsHandler } from './list.js';
import { showAccountHandler } from './show.js';
import { balanceAccountHandler } from './balance.js';
import { createAccountHandler } from './create.js';
import { updateAccountHandler } from './update.js';
import { retireAccountHandler, quarantineAccountHandler, reactivateAccountHandler } from './status.js';
import { deleteAccountHandler } from './delete.js';
import { mergeAccountsHandler } from './merge.js';
import { addIdentifierHandler } from './add-identifier.js';
import { removeIdentifierHandler } from './remove-identifier.js';
import { recalculateOpeningBalanceHandler } from './recalculate-opening-balance.js';

function accountFieldOptions(yargs) {
  return yargs
    .option('category', { describe: 'Account category', type: 'string', choices: ['bank', 'credit_card'] })
    .option('currency', { describe: 'Currency code (e.g. INR, USD)', type: 'string' })
    .option('acc-no', { describe: 'Account number', type: 'string' })
    .option('description', { describe: 'Account description', type: 'string' })
    .option('color', { describe: 'Display color (hex)', type: 'string' })
    .option('opening', { describe: 'Opening balance, currency units (e.g. 5000.50 = ₹5000.50)', type: 'number' })
    .option('upload-frequency', {
      describe: 'Expected statement upload cadence',
      type: 'string',
      choices: ['daily', 'weekly', 'monthly', 'quarterly', 'manual'],
    })
    .option('json', { describe: 'Output raw JSON', type: 'boolean' });
}

export function buildAccountsSubcommands(yargs) {
  return yargs
    .usage('$0 accounts <action> [options]')
    .command(
      'list',
      'List accounts (sorted by name ASC — server-side, not overridable)',
      (yargs) =>
        paginationOptions(yargs)
          .option('category', {
            describe: 'Filter by category',
            type: 'string',
            choices: ['bank', 'credit_card'],
          })
          .option('status', {
            describe: 'Filter by lifecycle status',
            type: 'string',
            choices: ['all', 'active', 'retired', 'quarantined'],
            default: 'active',
          })
          .option('fields', {
            describe:
              'Columns to show, comma-separated (default: id,name,category,acc_no,currency,opening_balance,upload_frequency,status)',
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
            describe: 'Show count, count-by-category, and opening_balance sum',
            type: 'boolean',
          }),
      safe(listAccountsHandler),
    )
    .command(
      'show <id>',
      'Show an account by ID',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(showAccountHandler),
    )
    .command(
      'balance <id> [yyyy-mm-dd]',
      "Show an account's computed balance as of a date (defaults to today)",
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .positional('yyyy-mm-dd', {
            describe: 'As-of date; defaults to today (local TZ)',
            type: 'string',
          })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(balanceAccountHandler),
    )
    .command(
      'create',
      'Create a new account',
      (yargs) =>
        accountFieldOptions(yargs).option('name', { describe: 'Account name', type: 'string', demandOption: true }),
      safe(createAccountHandler),
    )
    .command(
      'update <id>',
      'Update account fields (only passed flags are changed)',
      (yargs) =>
        accountFieldOptions(yargs)
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('name', { describe: 'Account name', type: 'string' }),
      safe(updateAccountHandler),
    )
    .command(
      'retire <id>',
      'Retire an account (closed but real; hidden from live UI, still counted in reports)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(retireAccountHandler),
    )
    .command(
      'quarantine <id>',
      'Quarantine an account (suspect data; hidden from live UI and excluded from reports)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(quarantineAccountHandler),
    )
    .command(
      'reactivate <id>',
      'Reactivate an account (set status back to active)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(reactivateAccountHandler),
    )
    .command(
      'delete <id>',
      'Permanently delete an account (fails if it still has linked transactions)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' }),
      safe(deleteAccountHandler),
    )
    .command(
      'merge <retain-id> <delete-id>',
      "Merge <delete-id> into <retain-id> (destructive — deletes <delete-id>'s transactions and the account itself)",
      (yargs) =>
        yargs
          .positional('retain-id', { describe: 'Account ID to keep', type: 'string' })
          .positional('delete-id', { describe: 'Account ID to merge away and delete', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(mergeAccountsHandler),
    )
    .command(
      'add-identifier <id> <value>',
      "Add a value to the account's statement-matching identifier list",
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .positional('value', { describe: 'Identifier value to add', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(addIdentifierHandler),
    )
    .command(
      'remove-identifier <id> <value>',
      "Remove a value from the account's statement-matching identifier list",
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .positional('value', { describe: 'Identifier value to remove', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(removeIdentifierHandler),
    )
    .command(
      'recalculate-opening-balance <id>',
      'Recompute opening balance/date from the earliest statement on file',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Account ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(recalculateOpeningBalanceHandler),
    )
    .demandCommand(
      1,
      'Specify an action: list, show, balance, create, update, retire, quarantine, reactivate, delete, merge, add-identifier, remove-identifier, recalculate-opening-balance',
    );
}
