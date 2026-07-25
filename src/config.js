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

/** Set by the `--org <name>` global flag (yargs middleware). Beats env + current_org. */
export function setOrgOverride(name) {
  orgOverride = name;
}

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const cfg = yaml.load(readFileSync(CONFIG_PATH, 'utf8')) || {};
    return { current_org: cfg.current_org ?? null, orgs: cfg.orgs ?? {} };
  }
  return { current_org: null, orgs: {} };
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

/**
 * Resolve credentials for the current command.
 * Precedence: `--org` override > FOB_STM_API_* env (all three set) > config current_org.
 * @returns {{ api_url: string, api_key: string, api_secret: string, source: string }}
 */
export function resolveCredentials() {
  const cfg = loadConfig();

  if (orgOverride) {
    const org = cfg.orgs[orgOverride];
    if (!org) throw new Error(`--org '${orgOverride}' is not configured. Run \`fob-stm config profiles add ${orgOverride}\`.`);
    return { ...org, source: `org '${orgOverride}'` };
  }

  const { FOB_STM_API_URL, FOB_STM_API_KEY, FOB_STM_API_SECRET } = process.env;
  if (FOB_STM_API_URL && FOB_STM_API_KEY && FOB_STM_API_SECRET) {
    return {
      api_url: FOB_STM_API_URL,
      api_key: FOB_STM_API_KEY,
      api_secret: FOB_STM_API_SECRET,
      source: 'env',
    };
  }

  if (cfg.current_org && cfg.orgs[cfg.current_org]) {
    return { ...cfg.orgs[cfg.current_org], source: `org '${cfg.current_org}'` };
  }

  throw new Error(
    "No statements credentials. Run `fob-stm config profiles add <name>`, or set FOB_STM_API_URL/API_KEY/API_SECRET.",
  );
}
