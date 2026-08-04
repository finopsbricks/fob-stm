import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

const rules = { list: jest.fn(), getAll: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ rules })),
}));
jest.unstable_mockModule('../../../src/http.js', () => ({ MAX_ALL_ROWS: 15000 }));

const { listRulesHandler } = await import('../../../src/cli/rules/list.js');

describe('listRulesHandler — scope/format orthogonality', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('bare --json fetches a single page via rules.list, not getAll', async () => {
    rules.list.mockResolvedValue({
      data: [{ id: 'r1', name: 'Rent', priority: 1, enabled: true }],
      page_context: { has_more: true, page: 1 },
    });

    await listRulesHandler({ page: 1, limit: 100, json: true });

    expect(rules.list).toHaveBeenCalled();
    expect(rules.getAll).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(1);
    expect(payload.count).toBe(1);
    expect(payload.truncated).toBe(false);
  });

  it('--json --limit 500 --page 2 returns that page, not the full set', async () => {
    rules.list.mockResolvedValue({
      data: [{ id: 'r501', name: 'Utilities', priority: 2, enabled: true }],
      page_context: { has_more: false, page: 2 },
    });

    await listRulesHandler({ page: 2, limit: 500, json: true });

    expect(rules.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 500 }));
    expect(rules.getAll).not.toHaveBeenCalled();
  });

  it('--all --json fetches every page via rules.getAll', async () => {
    rules.getAll.mockResolvedValue([
      { id: 'r1', name: 'Rent', priority: 1, enabled: true },
      { id: 'r2', name: 'Utilities', priority: 2, enabled: false },
    ]);

    await listRulesHandler({ all: true, json: true });

    expect(rules.getAll).toHaveBeenCalled();
    expect(rules.list).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(2);
    expect(payload.count).toBe(2);
  });

  it('--totals aggregates over the full set while still displaying one page', async () => {
    rules.getAll.mockResolvedValue([
      { id: 'r1', name: 'Rent', priority: 1, enabled: true },
      { id: 'r2', name: 'Utilities', priority: 2, enabled: false },
    ]);

    await listRulesHandler({ page: 1, limit: 1, totals: true });

    expect(rules.getAll).toHaveBeenCalled();
    expect(out.stdout).toContain('TOTALS (2 rules)');
  });
});
