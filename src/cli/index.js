/**
 * CLI entry point — three-level command tree:
 *
 *   fob-stm <resource> <action> [target] [options]
 *
 * A single-tool CLI (statements only). Credentials come from ~/.fob/fob-stm/config.yml
 * or FOB_STM_API_* env; `config` manages the former.
 *
 * Commander port of src/cli/index.js — see docs/wip/commander-prototype.md.
 */

import { Command } from 'commander';

import { setOrgOverride } from './config-store.js';
import { safe, configureTreeHelp } from './_helpers.js';
import { handleCompletion } from './_completion.js';
import { gettingStartedHandler } from './getting-started.js';
import { buildConfigCommand } from './config/index.js';
import { buildAccountsCommand } from './accounts/index.js';
import { buildTransactionsCommand } from './transactions/index.js';
import { buildStatementsCommand } from './statements/index.js';
import { buildRulesCommand } from './rules/index.js';
import { buildReportsCommand } from './reports/index.js';
import { buildCategoriesCommand } from './categories/index.js';
import { buildEntitiesCommand } from './entities/index.js';

export function run(argv) {
  const program = new Command();

  program
    .name('fob-stm')
    .usage('<resource> <action> [target] [options]')
    .option(
      '--profile, --org <name>',
      'Use credentials from a specific configured profile (overrides current + env)',
    )
    // Runs before any action handler, at any depth.
    .hook('preAction', (thisCommand) => {
      const { profile } = thisCommand.opts();
      if (profile) setOrgOverride(profile);
    });

  program
    .command('getting-started')
    .description('Print setup instructions (skips if a profile exists)')
    .action(safe(gettingStartedHandler));

  program
    .addCommand(buildConfigCommand())
    .addCommand(buildAccountsCommand())
    .addCommand(buildTransactionsCommand())
    .addCommand(buildStatementsCommand())
    .addCommand(buildRulesCommand())
    .addCommand(buildReportsCommand())
    .addCommand(buildCategoriesCommand())
    .addCommand(buildEntitiesCommand())
    // Reject unknown flags rather than silently ignoring them.
    .allowUnknownOption(false)
    .showHelpAfterError();

  // Applied tree-wide because configureHelp() is not inherited through
  // addCommand().
  configureTreeHelp(program);

  // Served before parse(): `--get-yargs-completions` is not a declared option and
  // allowUnknownOption(false) would reject it.
  if (handleCompletion(program, argv, 'fob-stm')) return;

  program.parse(argv, { from: 'user' });
}
