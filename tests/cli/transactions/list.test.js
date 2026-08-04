import { jest } from '@jest/globals';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureOutput } from '../../helpers.js';

// Isolate amount-display so totals scale deterministically (default 'actual').
process.env.FOB_STM_CONFIG_DIR = join(mkdtempSync(join(tmpdir(), 'stm-txn-')), 'nested');

const transactions = { list: jest.fn(), getAll: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ transactions })),
}));
jest.unstable_mockModule('../../../src/http.js', () => ({ MAX_ALL_ROWS: 15000 }));

const { listTransactionsHandler } = await import('../../../src/cli/transactions/list.js');

describe('listTransactionsHandler — currency', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('shows a CCY column by default from account_currency', async () => {
    transactions.list.mockResolvedValue({
      data: [
        { id: 't1', date: '2026-01-01', account_name: 'Wio USD', account_currency: 'USD', inflow: 2260, outflow: 0 },
      ],
      page_context: { has_more: false },
    });

    await listTransactionsHandler({ page: 1, limit: 100 });

    expect(out.stdout).toContain('CCY');
    expect(out.stdout).toContain('USD');
  });

  it('defaults missing account_currency to INR', async () => {
    transactions.list.mockResolvedValue({
      data: [{ id: 't1', date: '2026-01-01', account_name: 'HDFC', inflow: 1000, outflow: 0 }],
      page_context: { has_more: false },
    });

    await listTransactionsHandler({ page: 1, limit: 100 });
    expect(out.stdout).toContain('INR');
  });

  it('passes --currency through to the API', async () => {
    transactions.list.mockResolvedValue({ data: [], page_context: {} });
    await listTransactionsHandler({ page: 1, limit: 100, currency: 'USD' });
    expect(transactions.list).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    );
  });

  it('groups --totals by currency and never sums across currencies', async () => {
    transactions.getAll.mockResolvedValue([
      { id: 't1', account_currency: 'INR', inflow: 50000000, outflow: 0 },
      { id: 't2', account_currency: 'INR', inflow: 0, outflow: 30000000 },
      { id: 't3', account_currency: 'USD', inflow: 2260000, outflow: 0 },
    ]);

    await listTransactionsHandler({ totals: true });

    expect(out.stdout).toContain('TOTALS INR (2 transactions)');
    expect(out.stdout).toContain('TOTALS USD (1 transaction)');
    // INR net = (50,000,000 - 30,000,000) / 1000 = 20,000.00
    expect(out.stdout).toContain('20,000.00');
    // USD inflow = 2,260,000 / 1000 = 2,260.00
    expect(out.stdout).toContain('2,260.00');
  });

  it('emits by_currency totals in JSON', async () => {
    transactions.getAll.mockResolvedValue([
      { id: 't1', account_currency: 'INR', inflow: 50000000, outflow: 0 },
      { id: 't3', account_currency: 'USD', inflow: 2260000, outflow: 0 },
    ]);

    await listTransactionsHandler({ json: true, totals: true });

    const payload = JSON.parse(out.stdout);
    expect(payload.totals.by_currency.INR).toMatchObject({ count: 1, inflow: 50000, net: 50000 });
    expect(payload.totals.by_currency.USD).toMatchObject({ count: 1, inflow: 2260, net: 2260 });
  });
});

describe('listTransactionsHandler — scope/format orthogonality', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('bare --json fetches a single page via transactions.list, not getAll', async () => {
    transactions.list.mockResolvedValue({
      data: [{ id: 't1', date: '2026-01-01', inflow: 100, outflow: 0 }],
      page_context: { has_more: true, page: 1 },
    });

    await listTransactionsHandler({ page: 1, limit: 100, json: true });

    expect(transactions.list).toHaveBeenCalled();
    expect(transactions.getAll).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(1);
    expect(payload.count).toBe(1);
    expect(payload.truncated).toBe(false);
  });

  it('--json --limit 500 --page 2 returns that page, not the identical full set (regression: the original bug)', async () => {
    transactions.list.mockResolvedValue({
      data: [{ id: 't501', date: '2026-01-02', inflow: 0, outflow: 50 }],
      page_context: { has_more: false, page: 2 },
    });

    await listTransactionsHandler({ page: 2, limit: 500, json: true });

    expect(transactions.list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, limit: 500 }));
    expect(transactions.getAll).not.toHaveBeenCalled();
  });

  it('--all --json fetches every page via transactions.getAll', async () => {
    transactions.getAll.mockResolvedValue([
      { id: 't1', date: '2026-01-01', inflow: 100, outflow: 0 },
      { id: 't2', date: '2026-01-02', inflow: 0, outflow: 50 },
    ]);

    await listTransactionsHandler({ all: true, json: true });

    expect(transactions.getAll).toHaveBeenCalled();
    expect(transactions.list).not.toHaveBeenCalled();
    const payload = JSON.parse(out.stdout);
    expect(payload.data).toHaveLength(2);
    expect(payload.count).toBe(2);
  });
});
