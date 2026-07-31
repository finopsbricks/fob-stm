/**
 * `fob-stm getting-started` — an in-band setup walkthrough aimed at LLM agents
 * driving the CLI on a user's behalf.
 *
 * It first checks for configured profiles: if one already exists, setup is done
 * and the command says so (naming the current profile) rather than walking the
 * agent through credentials it already has. Only when nothing is configured does
 * it print the full add-a-profile walkthrough.
 */

import { listProfiles } from './config-store.js';
import { DEFAULT_API_URL } from '../http.js';

function alreadyConfigured({ current, profiles, path }) {
  const names = profiles.map((p) => p.name).join(', ');
  const lines = [
    'Setup is already complete — no need to run through getting started.',
    '',
    `Configured profile(s): ${names}`,
    current ? `Active profile:        ${current}` : 'Active profile:        (none selected)',
    `Config file:           ${path}`,
    '',
    'You can start running commands now, for example:',
    '',
    '  fob-stm config profiles current   # confirm the active org',
    '  fob-stm accounts list',
    '  fob-stm transactions list --from 2026-01-01 --to 2026-03-31',
    '',
    'Only re-run setup to add another org:',
    '',
    '  fob-stm config profiles add <name> --api-key <key> --api-secret <secret>',
    '  fob-stm config profiles use <name>   # switch the active org',
  ];
  return lines.join('\n');
}

function notConfigured() {
  const lines = [
    'No profile is configured yet. Follow these steps to get started.',
    '',
    'Note for automated agents: always check for an existing profile first with',
    '`fob-stm config profiles current`. If one is configured, setup is complete —',
    'skip the steps below and start running commands.',
    '',
    '1. Create an API key for your org at',
    '   https://statements.finopsbricks.com/orgs/<your-org>/settings/apikeys',
    '   Copy the key and secret (the secret is shown once).',
    '',
    '2. Add a profile (ask the user for the key and secret — never invent them):',
    '',
    '   fob-stm config profiles add myorg \\',
    '     --api-key fob_stm_xxxxxxxxxxxx \\',
    '     --api-secret yyyyyyyyyyyyyyyy',
    '',
    `   --api-url is optional and defaults to ${DEFAULT_API_URL};`,
    '   pass it only to target a different instance.',
    '',
    '3. Confirm it works:',
    '',
    '   fob-stm config profiles current',
  ];
  return lines.join('\n');
}

export async function gettingStartedHandler() {
  const info = listProfiles();
  console.log(info.profiles.length > 0 ? alreadyConfigured(info) : notConfigured());
}
