/**
 * `fob-stm accounts <action>` on commander — prototype port of
 * src/cli/accounts/index.js (193 LOC on yargs).
 *
 * Handlers are imported unchanged from src/cli/accounts/.
 */

import { Command, Option } from 'commander';

import { safe, listOptions, jsonOption } from './_helpers.js';

import { listAccountsHandler } from '../cli/accounts/list.js';
import { showAccountHandler } from '../cli/accounts/show.js';
import { balanceAccountHandler } from '../cli/accounts/balance.js';
import { createAccountHandler } from '../cli/accounts/create.js';
import { updateAccountHandler } from '../cli/accounts/update.js';
import {
  retireAccountHandler,
  quarantineAccountHandler,
  reactivateAccountHandler,
} from '../cli/accounts/status.js';
import { deleteAccountHandler } from '../cli/accounts/delete.js';
import { mergeAccountsHandler } from '../cli/accounts/merge.js';
import { addIdentifierHandler } from '../cli/accounts/add-identifier.js';
import { removeIdentifierHandler } from '../cli/accounts/remove-identifier.js';
import { recalculateOpeningBalanceHandler } from '../cli/accounts/recalculate-opening-balance.js';

/** Shared field flags for `create` and `update`. */
function accountFieldOptions(cmd) {
  return cmd
    .addOption(new Option('--category <category>', 'Account category').choices(['bank', 'credit_card']))
    .option('--currency <code>', 'Currency code (e.g. INR, USD)')
    .option('--acc-no <number>', 'Account number')
    .option('--description <text>', 'Account description')
    .option('--color <hex>', 'Display color (hex)')
    .option('--opening <amount>', 'Opening balance, currency units (e.g. 5000.50 = ₹5000.50)', Number)
    .addOption(
      new Option('--upload-frequency <cadence>', 'Expected statement upload cadence').choices([
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'manual',
      ]),
    )
    .option('--json', 'Output raw JSON');
}

/**
 * The `<id>`-plus-`--json` shape, which appears 6× below. On yargs this was
 * `localOptions(y.positional('id', {...})).option('json', {...})` spelled out
 * each time; here it collapses to one helper.
 */
function idCommand(parent, name, description, handler) {
  return jsonOption(parent.command(name).description(description).argument('<id>', 'Account ID')).action(
    safe(handler),
  );
}

export function buildAccountsCommand() {
  const accounts = new Command('accounts').description('Query accounts');

  listOptions(
    accounts
      .command('list')
      .description('List accounts (sorted by name ASC — server-side, not overridable)'),
  )
    .addOption(new Option('--category <category>', 'Filter by category').choices(['bank', 'credit_card']))
    .addOption(
      new Option('--status <status>', 'Filter by lifecycle status')
        .choices(['all', 'active', 'retired', 'quarantined'])
        .default('active'),
    )
    .option(
      '--fields <list>',
      'Columns to show, comma-separated (default: id,name,category,acc_no,currency,opening_balance,upload_frequency,status)',
    )
    .addOption(
      new Option('--format <format>', 'Output format (renders whatever --limit/--page/--all selected)').choices([
        'table',
        'csv',
        'json',
      ]),
    )
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count, count-by-category, and opening_balance sum')
    .action(safe(listAccountsHandler));

  idCommand(accounts, 'show', 'Show an account by ID', showAccountHandler);

  jsonOption(
    accounts
      .command('balance')
      .description("Show an account's computed balance as of a date (defaults to today)")
      .argument('<id>', 'Account ID')
      .argument('[yyyy-mm-dd]', 'As-of date; defaults to today (local TZ)'),
  ).action(safe(balanceAccountHandler));

  accountFieldOptions(accounts.command('create').description('Create a new account'))
    .requiredOption('--name <name>', 'Account name')
    .action(safe(createAccountHandler));

  accountFieldOptions(
    accounts
      .command('update')
      .description('Update account fields (only passed flags are changed)')
      .argument('<id>', 'Account ID'),
  )
    .option('--name <name>', 'Account name')
    .action(safe(updateAccountHandler));

  idCommand(
    accounts,
    'retire',
    'Retire an account (closed but real; hidden from live UI, still counted in reports)',
    retireAccountHandler,
  );
  idCommand(
    accounts,
    'quarantine',
    'Quarantine an account (suspect data; hidden from live UI and excluded from reports)',
    quarantineAccountHandler,
  );
  idCommand(
    accounts,
    'reactivate',
    'Reactivate an account (set status back to active)',
    reactivateAccountHandler,
  );

  accounts
    .command('delete')
    .description('Permanently delete an account (fails if it still has linked transactions)')
    .argument('<id>', 'Account ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(safe(deleteAccountHandler));

  jsonOption(
    accounts
      .command('merge')
      .description(
        "Merge <delete-id> into <retain-id> (destructive — deletes <delete-id>'s transactions and the account itself)",
      )
      .argument('<retain-id>', 'Account ID to keep')
      .argument('<delete-id>', 'Account ID to merge away and delete')
      .option('-y, --yes', 'Skip confirmation'),
  ).action(safe(mergeAccountsHandler));

  jsonOption(
    accounts
      .command('add-identifier')
      .description("Add a value to the account's statement-matching identifier list")
      .argument('<id>', 'Account ID')
      .argument('<value>', 'Identifier value to add'),
  ).action(safe(addIdentifierHandler));

  jsonOption(
    accounts
      .command('remove-identifier')
      .description("Remove a value from the account's statement-matching identifier list")
      .argument('<id>', 'Account ID')
      .argument('<value>', 'Identifier value to remove'),
  ).action(safe(removeIdentifierHandler));

  idCommand(
    accounts,
    'recalculate-opening-balance',
    'Recompute opening balance/date from the earliest statement on file',
    recalculateOpeningBalanceHandler,
  );

  return accounts;
}
