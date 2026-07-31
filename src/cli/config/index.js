import { safe, localOptions } from '../_helpers.js';
import { DEFAULT_API_URL } from '../../http.js';
import { addConfigHandler } from './add.js';
import { listConfigHandler } from './list.js';
import { useConfigHandler } from './use.js';
import { removeConfigHandler } from './remove.js';
import { refreshConfigHandler } from './refresh.js';
import { currentConfigHandler } from './current.js';
import { listSettingsHandler, setSettingsHandler } from './settings.js';
import { AMOUNT_DISPLAY_MODES } from '../config-store.js';

/**
 * Global (non-profile) CLI preferences. Kept a sibling namespace of `profiles`
 * so `config` stays the umbrella: `fob-stm config settings <action>`.
 */
function buildSettingsSubcommands(yargs) {
  return yargs
    .usage('$0 config settings <action> [options]')
    .command(
      'list',
      'Show current CLI settings',
      (y) => localOptions(y).option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(listSettingsHandler),
    )
    .command(
      'set <key> <value>',
      `Set a setting (e.g. amount-display ${AMOUNT_DISPLAY_MODES.join('|')})`,
      (y) =>
        localOptions(
          y
            .positional('key', { describe: 'Setting name (amount-display)', type: 'string' })
            .positional('value', { describe: 'New value', type: 'string' }),
        ),
      safe(setSettingsHandler),
    )
    .demandCommand(1, 'Specify an action: list, set');
}

/**
 * The multi-tenant object is a "profile" — a named set of credentials. fob-stm's
 * profiles map 1:1 to statements orgs, so `orgs` is offered as an alias. `config`
 * is a namespace, not the object: `fob-stm config profiles <action>`.
 */
function buildProfilesSubcommands(yargs) {
  return yargs
    .usage('$0 config profiles <action> [options]')
    .command(
      'list',
      'List profiles (current marked with *)',
      (y) => localOptions(y).option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(listConfigHandler),
    )
    .command(
      ['current', 'whoami'],
      'Show the active profile + resolution source',
      (y) => localOptions(y).option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(currentConfigHandler),
    )
    .command(
      'add <name>',
      "Add or update a profile's statements credentials",
      (y) =>
        localOptions(y.positional('name', { describe: 'Profile name', type: 'string' }))
          .option('api-url', {
            describe: `API base URL (origin only). Optional; defaults to ${DEFAULT_API_URL}`,
            type: 'string',
            default: DEFAULT_API_URL,
          })
          .option('api-key', { describe: 'API key', type: 'string', demandOption: true })
          .option('api-secret', { describe: 'API secret', type: 'string', demandOption: true }),
      safe(addConfigHandler),
    )
    .command(
      'use <name>',
      'Set the current profile',
      (y) => y.positional('name', { describe: 'Profile name', type: 'string' }),
      safe(useConfigHandler),
    )
    .command(
      ['remove <name>', 'rm <name>'],
      'Remove a profile',
      (y) => y.positional('name', { describe: 'Profile name', type: 'string' }),
      safe(removeConfigHandler),
    )
    .command(
      'refresh [name]',
      "Refresh a profile's org identity from the server (--all for every profile)",
      (y) =>
        localOptions(y.positional('name', { describe: 'Profile name (omit with --all)', type: 'string' }))
          .option('all', { describe: 'Refresh every profile', type: 'boolean' }),
      safe(refreshConfigHandler),
    )
    .demandCommand(1, 'Specify an action: list, current, add, use, remove, refresh');
}

export function buildConfigSubcommands(yargs) {
  return yargs
    .usage('$0 config <resource> <action> [options]')
    .command(
      ['profiles', 'orgs'],
      'Manage credential profiles (alias: orgs)',
      buildProfilesSubcommands,
    )
    .command(
      'settings',
      'View or change global CLI settings',
      buildSettingsSubcommands,
    )
    .demandCommand(1, 'Specify a resource: profiles (alias: orgs), settings');
}
