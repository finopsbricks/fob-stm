import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { captureOutput } from '../helpers.js';

// The config store reads FOB_STM_CONFIG_DIR at import, so set it first.
process.env.FOB_STM_CONFIG_DIR = join(mkdtempSync(join(tmpdir(), 'stm-')), 'nested');

const { addOrg, setOrgOverride } = await import('../../src/cli/config-store.js');
const { run } = await import('../../src/cli/index.js');

const creds = (n) => ({ api_url: `https://${n}.example/`, api_key: `k_${n}`, api_secret: `s_${n}` });

describe('--org / --profile global flag', () => {
  let out;

  beforeAll(() => {
    addOrg('acme', creds('acme')); // the first org added becomes current
    addOrg('other', creds('other'));
  });

  beforeEach(() => { out = captureOutput(); });

  afterEach(() => {
    out.restore();
    setOrgOverride(null);
  });

  it.each(['--org', '--profile'])('uses the named profile instead of the current one with %s', (flag) => {
    run(['config', 'profiles', 'current', '--json', flag, 'other']);

    expect(JSON.parse(out.stdout)).toMatchObject({ name: 'other' });
  });

  it('uses the current profile when neither flag is passed', () => {
    run(['config', 'profiles', 'current', '--json']);

    expect(JSON.parse(out.stdout)).toMatchObject({ name: 'acme' });
  });
});
