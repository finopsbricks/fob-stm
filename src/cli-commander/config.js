/**
 * `fob-stm config <resource> <action>` — commander port of src/cli/config/index.js.
 *
 * The only three-level subtree, and the only one using command aliases
 * (`profiles|orgs`, `current|whoami`, `remove|rm`).
 */

import { Command } from 'commander';

import { safe, jsonOption } from './_helpers.js';
import { DEFAULT_API_URL } from '../http.js';
import { addConfigHandler } from '../cli/config/add.js';
import { listConfigHandler } from '../cli/config/list.js';
import { useConfigHandler } from '../cli/config/use.js';
import { removeConfigHandler } from '../cli/config/remove.js';
import { refreshConfigHandler } from '../cli/config/refresh.js';
import { currentConfigHandler } from '../cli/config/current.js';
import { listSettingsHandler, setSettingsHandler } from '../cli/config/settings.js';
import { AMOUNT_DISPLAY_MODES } from '../cli/config-store.js';

/**
 * Global (non-profile) CLI preferences. Kept a sibling namespace of `profiles`
 * so `config` stays the umbrella: `fob-stm config settings <action>`.
 */
function buildSettingsCommand() {
  const settings = new Command('settings').description('View or change global CLI settings');

  jsonOption(settings.command('list').description('Show current CLI settings')).action(
    safe(listSettingsHandler),
  );

  settings
    .command('set')
    .description(`Set a setting (e.g. amount-display ${AMOUNT_DISPLAY_MODES.join('|')})`)
    .argument('<key>', 'Setting name (amount-display)')
    .argument('<value>', 'New value')
    .action(safe(setSettingsHandler));

  return settings;
}

/**
 * The multi-tenant object is a "profile" — a named set of credentials. fob-stm's
 * profiles map 1:1 to statements orgs, so `orgs` is offered as an alias. `config`
 * is a namespace, not the object: `fob-stm config profiles <action>`.
 */
function buildProfilesCommand() {
  const profiles = new Command('profiles')
    .alias('orgs')
    .description('Manage credential profiles (alias: orgs)');

  jsonOption(profiles.command('list').description('List profiles (current marked with *)')).action(
    safe(listConfigHandler),
  );

  jsonOption(
    profiles
      .command('current')
      .alias('whoami')
      .description('Show the active profile + resolution source'),
  ).action(safe(currentConfigHandler));

  profiles
    .command('add')
    .description("Add or update a profile's statements credentials")
    .argument('<name>', 'Profile name')
    .option('--api-url <url>', `API base URL (origin only). Optional; defaults to ${DEFAULT_API_URL}`, DEFAULT_API_URL)
    .requiredOption('--api-key <key>', 'API key')
    .requiredOption('--api-secret <secret>', 'API secret')
    .action(safe(addConfigHandler));

  profiles
    .command('use')
    .description('Set the current profile')
    .argument('<name>', 'Profile name')
    .action(safe(useConfigHandler));

  profiles
    .command('remove')
    .alias('rm')
    .description('Remove a profile')
    .argument('<name>', 'Profile name')
    .action(safe(removeConfigHandler));

  profiles
    .command('refresh')
    .description("Refresh a profile's org identity from the server (--all for every profile)")
    .argument('[name]', 'Profile name (omit with --all)')
    .option('--all', 'Refresh every profile')
    .action(safe(refreshConfigHandler));

  return profiles;
}

export function buildConfigCommand() {
  return new Command('config')
    .description('Manage credential profiles (alias: orgs)')
    .addCommand(buildProfilesCommand())
    .addCommand(buildSettingsCommand());
}
