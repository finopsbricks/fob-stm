/**
 * CLI entry point — three-level command tree:
 *
 *   fob-stm <resource> <action> [target] [options]
 *
 * A single-tool CLI (statements only). Credentials come from ~/.fob-stm/config.yml
 * or FOB_STM_API_* env; `config` manages the former. Replaces `fobs statements …`.
 */

import yargs from 'yargs';

import { setOrgOverride } from '../config.js';
import { buildConfigSubcommands } from './config/index.js';
import { buildAccountsSubcommands } from './accounts/index.js';

export function run(argv) {
  return yargs(argv)
    .scriptName('fob-stm')
    .usage('$0 <resource> <action> [target] [options]')
    .option('org', {
      describe: 'Use credentials from a specific configured org (overrides current + env)',
      type: 'string',
    })
    .middleware((argv) => {
      if (argv.org) setOrgOverride(argv.org);
    })
    .command('config <action>', 'Manage statements credentials', buildConfigSubcommands)
    .command('accounts <action>', 'Query accounts', buildAccountsSubcommands)
    .demandCommand(1, 'Specify a resource. Try `fob-stm --help`.')
    .strict()
    .help()
    .alias('h', 'help')
    .version()
    .alias('v', 'version')
    .parse();
}
