/**
 * CLI entry point — three-level command tree:
 *
 *   fob-stm <resource> <action> [target] [options]
 *
 * A single-tool CLI (statements only). Credentials come from ~/.fob/fob-stm/config.yml
 * or FOB_STM_API_* env; `config` manages the former.
 */

import yargs from 'yargs';

import { setOrgOverride } from './config-store.js';
import { safe } from './_helpers.js';
import { gettingStartedHandler } from './getting-started.js';
import { buildConfigSubcommands } from './config/index.js';
import { buildAccountsSubcommands } from './accounts/index.js';
import { buildTransactionsSubcommands } from './transactions/index.js';
import { buildStatementsResourceSubcommands } from './statements/index.js';
import { buildRulesSubcommands } from './rules/index.js';
import { buildReportsSubcommands } from './reports/index.js';
import { buildCategoriesSubcommands } from './categories/index.js';
import { buildEntitiesSubcommands } from './entities/index.js';

export function run(argv) {
  return yargs(argv)
    .scriptName('fob-stm')
    .usage('$0 <resource> <action> [target] [options]')
    .option('profile', {
      alias: 'org',
      describe: 'Use credentials from a specific configured profile (overrides current + env)',
      type: 'string',
    })
    .middleware((argv) => {
      if (argv.profile) setOrgOverride(argv.profile);
    })
    .command('getting-started', 'Print setup instructions (skips if a profile exists)', (y) => y, safe(gettingStartedHandler))
    .command('config <resource>', 'Manage credential profiles (alias: orgs)', buildConfigSubcommands)
    .command('accounts <action>', 'Query accounts', buildAccountsSubcommands)
    .command('transactions <action>', 'Query transactions', buildTransactionsSubcommands)
    .command('statements <action>', 'Query uploaded statement files', buildStatementsResourceSubcommands)
    .command('rules <action>', 'Query categorization rules', buildRulesSubcommands)
    .command('reports <action>', 'Compute reports', buildReportsSubcommands)
    .command('categories [action]', 'Query category aggregates (read-only)', buildCategoriesSubcommands)
    .command('entities [action]', 'Query entity aggregates (read-only)', buildEntitiesSubcommands)
    .demandCommand(1, 'Specify a resource. Try `fob-stm --help`.')
    .strict()
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    // Global options (inherited by every command) render under their own
    // heading; each command's own options stay under "Options:", shown first
    // via localOptions() in the command builders.
    .group(['profile', 'help', 'version'], 'Global Options:')
    .parse();
}
