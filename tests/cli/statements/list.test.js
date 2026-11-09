import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

const statements = { list: jest.fn(), getAll: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ statements })),
}));
jest.unstable_mockModule('../../../src/http.js', () => ({ MAX_ALL_ROWS: 15000 }));

const { listStatementsHandler } = await import('../../../src/cli/statements/list.js');

describe('listStatementsHandler — scope/format orthogonality', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('bare --json fetches a single page via statements.list, not getAll', async () => {
    statements.list.mockResolvedValue({
      data: [{ id: 's1', file_name: 'jan.pdf' }],
      page_context: { has_more: true, page: 1 },
    });

    await listStatementsHandler({ page: 1, limit: 100, json: true });

    expect(statements.list).toHaveBeenCalled();
    expect(statements.getAll).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(1);
    expect(payload.count).toBe(1);
    expect(payload.truncated).toBe(false);
  });

  it('--json --limit 500 --page 2 returns that page, not the full set', async () => {
    statements.list.mockResolvedValue({
      data: [{ id: 's501', file_name: 'feb.pdf' }],
      page_context: { has_more: false, page: 2 },
    });

    await listStatementsHandler({ page: 2, limit: 500, json: true });

    expect(statements.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 500 }));
    expect(statements.getAll).not.toHaveBeenCalled();
  });

  it('--all --json fetches every page via statements.getAll', async () => {
    statements.getAll.mockResolvedValue([
      { id: 's1', file_name: 'jan.pdf' },
      { id: 's2', file_name: 'feb.pdf' },
    ]);

    await listStatementsHandler({ all: true, json: true });

    expect(statements.getAll).toHaveBeenCalled();
    expect(statements.list).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(2);
    expect(payload.count).toBe(2);
  });

  it('--totals aggregates over the full set while still displaying one page', async () => {
    statements.getAll.mockResolvedValue([
      { id: 's1', file_name: 'jan.pdf', file_type: 'pdf', file_size: 100 },
      { id: 's2', file_name: 'feb.csv', file_type: 'csv', file_size: 200 },
    ]);

    await listStatementsHandler({ page: 1, limit: 1, totals: true });

    expect(statements.getAll).toHaveBeenCalled();
    expect(out.stdout).toContain('TOTALS (2 statements)');
  });
});

describe('listStatementsHandler — partial results', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('carries total, page and has_more in --json output and notes the partial result on stderr', async () => {
    // Arrange
    statements.list.mockResolvedValue({
      data: [{ id: 'x1', file_name: 'one' }],
      page_context: { count: 1, page: 1, per_page: 1, total: 3, has_more: true },
    });

    // Act
    await listStatementsHandler({ page: 1, limit: 1, json: true });

    // Assert
    expect(JSON.parse(out.stdout)).toMatchObject({ count: 1, total: 3, page: 1, has_more: true, truncated: false });
    expect(out.stderr).toContain('(showing 1 of 3 — page 1; use --page 2 for more)');
  });

  it('prints no notice when the page holds every matching row', async () => {
    statements.list.mockResolvedValue({
      data: [{ id: 'x1', file_name: 'one' }],
      page_context: { count: 1, page: 1, per_page: 100, total: 1, has_more: false },
    });

    await listStatementsHandler({ page: 1, limit: 100, format: 'csv' });

    expect(out.stderr).not.toContain('showing');
  });
});
