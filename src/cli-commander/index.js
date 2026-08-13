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

import { setOrgOverride } from '../cli/config-store.js';
import { safe, configureTreeHelp } from './_helpers.js';
import { gettingStartedHandler } from '../cli/getting-started.js';
import { buildConfigCommand } from './config.js';
import { buildAccountsCommand } from './accounts.js';
import { buildTransactionsCommand } from './transactions.js';
import { buildStatementsCommand } from './statements.js';
import { buildRulesCommand } from './rules.js';
import { buildReportsCommand } from './reports.js';
import { buildCategoriesCommand, buildEntitiesCommand } from './aggregates.js';

export function run(argv) {
  const program = new Command();

  program
    .name('fob-stm')
    .usage('<resource> <action> [target] [options]')
    .option(
      '--profile, --org <name>',
      'Use credentials from a specific configured profile (overrides current + env)',
    )
    // yargs' .middleware() equivalent — runs before any action handler.
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
    // yargs' .strict() equivalent: reject unknown flags rather than ignoring them.
    .allowUnknownOption(false)
    .showHelpAfterError();

  // Help formatting — the point of the experiment. Applied tree-wide because
  // commander does not inherit configureHelp() through addCommand().
  configureTreeHelp(program);

  program.parse(argv, { from: 'user' });
}
