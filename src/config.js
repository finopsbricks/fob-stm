/**
 * CLI credential store — reads/writes ~/.fob-stm/config.yml (mode 0600) and
 * resolves which credentials the current command uses.
 *
 * CLI-only: the importable client (src/index.js) never imports this. CLI
 * handlers call resolveCredentials() and pass the result to client functions as
 * the `credentials` override. Single tool, per-org (no per-app nesting — that
 * belonged to the multi-app `fobs` aggregator this package replaces).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import yaml from 'js-yaml';

const CONFIG_DIR = process.env.FOB_STM_CONFIG_DIR || join(homedir(), '.fob-stm');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yml');

// Legacy `fobs` aggregator config, migrated on first run.
const FOBS_CONFIG_DIR = process.env.FOBS_CONFIG_DIR || join(homedir(), '.fobs');
const FOBS_CONFIG_PATH = join(FOBS_CONFIG_DIR, 'config.yml');

let orgOverride = null;

/** Set by the `--org <name>` global flag (yargs middleware). Beats env + current_org. */
export function setOrgOverride(name) {
  orgOverride = name;
}

/**
 * Build a fob-stm config from the legacy `~/.fobs/config.yml`, promoting each
 * org's `apps.statements` block to org-level. Returns null if there's nothing
 * to migrate. Non-destructive — never writes to the fobs file.
 */
function migrateFromFobs() {
  if (!existsSync(FOBS_CONFIG_PATH)) return null;
  let old;
  try {
    old = yaml.load(readFileSync(FOBS_CONFIG_PATH, 'utf8')) || {};
  } catch {
    return null;
  }
  const orgs = {};
  for (const [name, org] of Object.entries(old.orgs ?? {})) {
    const stm = org?.apps?.statements;
    if (stm?.api_url && stm?.api_key && stm?.api_secret) {
      orgs[name] = { api_url: stm.api_url, api_key: stm.api_key, api_secret: stm.api_secret };
    }
  }
  if (Object.keys(orgs).length === 0) return null;
  const current_org = orgs[old.current_org] ? old.current_org : Object.keys(orgs)[0];
  return { current_org, orgs };
}

export function loadConfig() {
  if (existsSync(CONFIG_PATH)) {
    const cfg = yaml.load(readFileSync(CONFIG_PATH, 'utf8')) || {};
    return { current_org: cfg.current_org ?? null, orgs: cfg.orgs ?? {} };
  }
  // First run: migrate statements credentials out of the legacy fobs config.
  const migrated = migrateFromFobs();
  if (migrated) {
    saveConfig(migrated);
    console.error(
      `(migrated ${Object.keys(migrated.orgs).length} org(s)' statements credentials ` +
        `from ${FOBS_CONFIG_PATH} → ${CONFIG_PATH})`,
    );
    return migrated;
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
  if (!cfg.orgs[name]) throw new Error(`No configured org named '${name}'.`);
  delete cfg.orgs[name];
  if (cfg.current_org === name) cfg.current_org = Object.keys(cfg.orgs)[0] ?? null;
  saveConfig(cfg);
  return cfg;
}

export function useOrg(name) {
  const cfg = loadConfig();
  if (!cfg.orgs[name]) throw new Error(`No configured org named '${name}'. Run \`fob-stm config add ${name}\`.`);
  cfg.current_org = name;
  saveConfig(cfg);
  return cfg;
}

export function listOrgs() {
  const cfg = loadConfig();
  return { current: cfg.current_org, orgs: Object.keys(cfg.orgs) };
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
    if (!org) throw new Error(`--org '${orgOverride}' is not configured. Run \`fob-stm config add ${orgOverride}\`.`);
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
    "No statements credentials. Run `fob-stm config add <org>`, or set FOB_STM_API_URL/API_KEY/API_SECRET.",
  );
}
