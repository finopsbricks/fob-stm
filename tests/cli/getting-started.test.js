import { jest } from '@jest/globals';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Point the config store at a throwaway dir before importing anything.
const dir = join(mkdtempSync(join(tmpdir(), 'stm-gs-')), 'nested');
process.env.FOB_STM_CONFIG_DIR = dir;

const { addOrg } = await import('../../src/cli/config-store.js');
const { gettingStartedHandler } = await import('../../src/cli/getting-started.js');

function capture(fn) {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
  return Promise.resolve(fn()).then(() => {
    const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    spy.mockRestore();
    return out;
  });
}

describe('getting-started command', () => {
  it('prints the full walkthrough when no profile is configured', async () => {
    const out = await capture(() => gettingStartedHandler());
    expect(out).toMatch(/No profile is configured yet/);
    expect(out).toMatch(/config profiles add myorg/);
    // --api-url is shown as optional, not required
    expect(out).toMatch(/--api-url is optional/);
    // tells an agent to check for an existing profile first
    expect(out).toMatch(/check for an existing profile first/);
  });

  it('reports setup is complete and skips the walkthrough once a profile exists', async () => {
    addOrg('acme', { api_url: 'https://acme.example/', api_key: 'k', api_secret: 's' });
    const out = await capture(() => gettingStartedHandler());
    expect(out).toMatch(/Setup is already complete/);
    expect(out).toMatch(/Configured profile\(s\): acme/);
    expect(out).toMatch(/Active profile:\s+acme/);
    // must not walk through creating a first profile again
    expect(out).not.toMatch(/No profile is configured yet/);
  });
});
