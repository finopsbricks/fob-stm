/**
 * Commander port of src/cli/index.js (56 LOC on yargs) — prototype.
 * Only the `accounts` subtree is ported; see docs/wip/commander-prototype.md.
 */

import { Command } from 'commander';

import { setOrgOverride } from '../cli/config-store.js';
import { configureTreeHelp } from './_helpers.js';
import { buildAccountsCommand } from './accounts.js';

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
    })
    .addCommand(buildAccountsCommand())
    // yargs' .strict() equivalent: reject unknown flags rather than ignoring them.
    .allowUnknownOption(false)
    .showHelpAfterError();

  // Help formatting — the point of the experiment. Applied tree-wide because
  // commander does not inherit configureHelp() through addCommand().
  configureTreeHelp(program);

  program.parse(argv, { from: 'user' });
}
