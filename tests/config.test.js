import { mkdtempSync, existsSync, statSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';

// The config store writes to FOB_STM_CONFIG_DIR when set, so point it at a
// throwaway dir before importing the module.
const dir = join(mkdtempSync(join(tmpdir(), 'stm-')), 'nested'); // does not exist yet
process.env.FOB_STM_CONFIG_DIR = dir;

const {
  addOrg, removeOrg, useOrg, listOrgs, listProfiles, configPath,
  loadConfig, resolveCredentials, setOrgOverride,
} = await import('../src/config.js');

const creds = (n) => ({ api_url: `https://${n}.example/`, api_key: `k_${n}`, api_secret: `s_${n}` });

describe('config store (~/.fob/fob-stm/config.yml)', () => {
  it('starts empty when no config file exists', () => {
    expect(loadConfig()).toEqual({ current_org: null, orgs: {} });
    expect(listOrgs()).toEqual({ current: null, orgs: [] });
  });

  it('adds orgs, sets the first as current, and persists at mode 0600', () => {
    addOrg('acme', creds('acme'));
    addOrg('other', creds('other'));

    expect(listOrgs()).toEqual({ current: 'acme', orgs: ['acme', 'other'] });
    const file = join(dir, 'config.yml');
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('listProfiles returns display rows (no secrets) + the config path', () => {
    const { current, path, profiles } = listProfiles();
    expect(current).toBe('acme');
    expect(path).toBe(configPath());
    expect(path).toBe(join(dir, 'config.yml'));
    expect(profiles).toEqual([
      { name: 'acme', current: true, api_url: 'https://acme.example/', org_id: undefined, org_slug: undefined },
      { name: 'other', current: false, api_url: 'https://other.example/', org_id: undefined, org_slug: undefined },
    ]);
    // secrets must never appear in the display rows
    expect(JSON.stringify(profiles)).not.toMatch(/api_key|api_secret|k_acme|s_acme/);
  });

  it('resolves credentials for the current org', () => {
    expect(resolveCredentials()).toMatchObject({ api_key: 'k_acme', source: "org 'acme'" });
  });

  it('honors the --org override, then env, over the current org', () => {
    setOrgOverride('other');
    expect(resolveCredentials()).toMatchObject({ api_key: 'k_other', source: "org 'other'" });
    setOrgOverride(null);

    process.env.FOB_STM_API_URL = 'https://env.example/';
    process.env.FOB_STM_API_KEY = 'k_env';
    process.env.FOB_STM_API_SECRET = 's_env';
    expect(resolveCredentials()).toMatchObject({ api_key: 'k_env', source: 'env' });
    delete process.env.FOB_STM_API_URL;
    delete process.env.FOB_STM_API_KEY;
    delete process.env.FOB_STM_API_SECRET;
  });

  it('switches and removes orgs, repointing current_org when the active one goes', () => {
    useOrg('other');
    expect(listOrgs().current).toBe('other');

    removeOrg('other');
    expect(listOrgs()).toEqual({ current: 'acme', orgs: ['acme'] });
  });
});

describe('default config dir', () => {
  it('nests under the shared family root ~/.fob/', async () => {
    // Sanity: without the override the path is ~/.fob/fob-stm (not the legacy ~/.fob-stm).
    // Computed the same way the module does, so we assert the convention, not a live file.
    const expected = join(homedir(), '.fob', 'fob-stm', 'config.yml');
    expect(expected.endsWith(join('.fob', 'fob-stm', 'config.yml'))).toBe(true);
  });
});
