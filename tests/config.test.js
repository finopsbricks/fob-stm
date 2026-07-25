import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('config migration from ~/.fobs', () => {
  it('promotes each org\'s apps.statements to org-level on first run', async () => {
    const fobsDir = mkdtempSync(join(tmpdir(), 'fobs-'));
    const stmDir = join(mkdtempSync(join(tmpdir(), 'stm-')), 'nested'); // does not exist yet
    writeFileSync(
      join(fobsDir, 'config.yml'),
      [
        'current_org: acme',
        'orgs:',
        '  acme:',
        '    apps:',
        '      statements:',
        '        api_url: https://statements.example/',
        '        api_key: k_acme',
        '        api_secret: s_acme',
        '      billing:',
        '        api_url: https://billing.example/',
        '        api_key: k_bil',
        '        api_secret: s_bil',
        '  other:',
        '    apps:',
        '      statements:',
        '        api_url: https://statements.example/',
        '        api_key: k_other',
        '        api_secret: s_other',
        '',
      ].join('\n'),
    );

    process.env.FOBS_CONFIG_DIR = fobsDir;
    process.env.FOB_STM_CONFIG_DIR = stmDir;
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { loadConfig, resolveCredentials, listOrgs } = await import('../src/config.js');

    const cfg = loadConfig();
    expect(cfg.current_org).toBe('acme');
    // statements creds promoted to org level; billing app dropped.
    expect(cfg.orgs.acme).toEqual({ api_url: 'https://statements.example/', api_key: 'k_acme', api_secret: 's_acme' });
    expect(cfg.orgs.other).toEqual({ api_url: 'https://statements.example/', api_key: 'k_other', api_secret: 's_other' });
    expect(listOrgs()).toEqual({ current: 'acme', orgs: ['acme', 'other'] });
    // persisted so the migration notice shows only once.
    expect(existsSync(join(stmDir, 'config.yml'))).toBe(true);
    // resolveCredentials picks the current org.
    expect(resolveCredentials()).toMatchObject({ api_key: 'k_acme', source: "org 'acme'" });

    errSpy.mockRestore();
    delete process.env.FOBS_CONFIG_DIR;
    delete process.env.FOB_STM_CONFIG_DIR;
  });
});
