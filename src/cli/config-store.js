/**
 * CLI credential store — reads/writes ~/.fob/fob-stm/config.yml (mode 0600) and
 * resolves which credentials the current command uses.
 *
 * Config lives under the shared family root ~/.fob/ so every fob-<tool> wrapper
 * keeps its config in one place. Path is home-dir based (os.homedir()) for
 * multi-OS support; not XDG. Override the whole dir with FOB_STM_CONFIG_DIR.
 *
 * CLI-only: the importable client (src/index.js) never imports this. CLI
 * handlers call resolveCredentials() and pass the result to client functions as
 * the `credentials` override. Single tool, per-org (no per-app nesting).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';

const CONFIG_DIR = process.env.FOB_STM_CONFIG_DIR || join(homedir(), '.fob', 'fob-stm');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yml');

let orgOverride = null;

/** Set by the `--profile <name>` global flag (alias `--org`; yargs middleware). Beats env + current_org. */
export function setOrgOverride(name) {
  orgOverride = name;
}

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const cfg = yaml.load(readFileSync(CONFIG_PATH, 'utf8')) || {};
    return {
      current_org: cfg.current_org ?? null,
      orgs: cfg.orgs ?? {},
      settings: cfg.settings ?? {},
    };
  }
  return { current_org: null, orgs: {}, settings: {} };
}

export function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, yaml.dump(cfg), { mode: 0o600 });
}

export function addOrg(name, { api_url, api_key, api_secret }) {
  const cfg = loadConfig();
  cfg.orgs[name] = { api_url, api_key, api_secret };
  if (!cfg.current_org) cfg.current_org = name;
  saveConfig(cfg);
  return cfg;
}

export function removeOrg(name) {
  const cfg = loadConfig();
  if (!cfg.orgs[name]) throw new Error(`No profile named '${name}'.`);
  delete cfg.orgs[name];
  if (cfg.current_org === name) cfg.current_org = Object.keys(cfg.orgs)[0] ?? null;
  saveConfig(cfg);
  return cfg;
}

export function useOrg(name) {
  const cfg = loadConfig();
  if (!cfg.orgs[name]) throw new Error(`No profile named '${name}'. Run \`fob-stm config profiles add ${name}\`.`);
  cfg.current_org = name;
  saveConfig(cfg);
  return cfg;
}

export function listOrgs() {
  const cfg = loadConfig();
  return { current: cfg.current_org, orgs: Object.keys(cfg.orgs) };
}

/** Absolute path to the config file (shown in the `profiles list` footer). */
export function configPath() {
  return CONFIG_PATH;
}

/**
 * Profiles for display. Returns the current profile name, the config path, and
 * one row per profile with non-secret metadata only (api_url, plus org_id /
 * org_slug once resolved — WIP decision G). Secrets are never included.
 */
export function listProfiles() {
  const cfg = loadConfig();
  const profiles = Object.entries(cfg.orgs).map(([name, o]) => ({
    name,
    current: name === cfg.current_org,
    api_url: o.api_url,
    org_id: o.org_id,
    org_slug: o.org_slug,
    org_name: o.org_name,
  }));
  return { current: cfg.current_org, path: CONFIG_PATH, profiles };
}

/** Raw credentials for a named profile (for identity refresh). */
export function getProfileCredentials(name) {
  const cfg = loadConfig();
  const o = cfg.orgs[name];
  if (!o) throw new Error(`No profile named '${name}'.`);
  return { api_url: o.api_url, api_key: o.api_key, api_secret: o.api_secret };
}

/**
 * Merge server-resolved identity (org_id/org_slug/org_name — WIP decision G)
 * into a stored profile as non-secret metadata. Leaves credentials untouched.
 */
export function setProfileIdentity(name, { org_id, org_slug, org_name } = {}) {
  const cfg = loadConfig();
  if (!cfg.orgs[name]) throw new Error(`No profile named '${name}'.`);
  cfg.orgs[name] = { ...cfg.orgs[name], org_id, org_slug, org_name };
  saveConfig(cfg);
  return cfg.orgs[name];
}

/** Valid values for the `amount_display` setting. */
export const AMOUNT_DISPLAY_MODES = ['actual', 'raw'];

/**
 * How monetary values from milli-unit endpoints (transactions, statements) are
 * shown. `actual` (default) divides the stored ×1000 integer down to human
 * decimals in every view; `raw` passes the integer through untouched. Other
 * endpoints already return decimals from the API and are unaffected either way.
 * @returns {'actual'|'raw'}
 */
export function getAmountDisplay() {
  const cfg = loadConfig();
  const v = cfg.settings?.amount_display;
  return AMOUNT_DISPLAY_MODES.includes(v) ? v : 'actual';
}

/** Persist the `amount_display` setting. Throws on an unknown mode. */
export function setAmountDisplay(mode) {
  if (!AMOUNT_DISPLAY_MODES.includes(mode)) {
    throw new Error(`amount-display must be one of: ${AMOUNT_DISPLAY_MODES.join(', ')} (got '${mode}')`);
  }
  const cfg = loadConfig();
  cfg.settings = { ...cfg.settings, amount_display: mode };
  saveConfig(cfg);
  return cfg.settings;
}

/** Non-secret snapshot of all settings, with defaults applied. Powers `config settings list`. */
export function listSettings() {
  return { amount_display: getAmountDisplay() };
}

/**
 * Resolve credentials for the current command from the config profiles.
 * Precedence: `--profile`/`--org` override > config `current_org`. The CLI's
 * credential model is profiles (config.yml); it does not read FOB_STM_API_* env
 * — an env var that silently overrode the active profile would be a footgun.
 * @returns {{ api_url: string, api_key: string, api_secret: string, source: string }}
 */
export function resolveCredentials() {
  const cfg = loadConfig();

  if (orgOverride) {
    const org = cfg.orgs[orgOverride];
    if (!org) throw new Error(`Profile '${orgOverride}' is not configured. Run \`fob-stm config profiles add ${orgOverride}\`.`);
    return { ...org, name: orgOverride, source: `profile '${orgOverride}'` };
  }

  if (cfg.current_org && cfg.orgs[cfg.current_org]) {
    return { ...cfg.orgs[cfg.current_org], name: cfg.current_org, source: `profile '${cfg.current_org}'` };
  }

  throw new Error(
    "No statements profile selected. Run `fob-stm config profiles add <name>`, then `fob-stm config profiles use <name>` (or pass --profile <name>).",
  );
}

/**
 * Non-secret description of the identity the CLI would use right now — the same
 * flag > current-profile resolution as resolveCredentials(), minus the secrets.
 * Returns null when nothing is configured. Powers `profiles current`.
 * @returns {{ api_url: string, source: string, name: string|null, org_id?: string, org_slug?: string, org_name?: string }|null}
 */
export function describeCurrent() {
  let creds;
  try {
    creds = resolveCredentials();
  } catch {
    return null;
  }
  const { api_key, api_secret, ...rest } = creds;
  return rest;
}
