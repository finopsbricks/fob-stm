import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureOutput, ExitError } from '../../helpers.js';

// Isolate amount-display so amounts scale deterministically (default 'actual').
const tmp = mkdtempSync(join(tmpdir(), 'stm-txn-del-'));
process.env.FOB_STM_CONFIG_DIR = join(tmp, 'nested');

class MockApiError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const transactions = { get: jest.fn(), delete: jest.fn() };
const confirm = jest.fn();
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ transactions })),
}));
jest.unstable_mockModule('../../../src/http.js', () => ({ ApiError: MockApiError }));
jest.unstable_mockModule('@inquirer/prompts', () => ({ confirm }));

const { deleteTransactionsHandler, parseIds } = await import('../../../src/cli/transactions/delete.js');

const ROWS = {
  t1: { id: 't1', date: '2026-09-01', account_name: 'ICICI 651', inflow: 0, outflow: 1234500, particulars: 'UPI/ACME', type: 'expense' },
  t2: { id: 't2', date: '2026-09-02', account_name: 'ICICI 651', inflow: 500000, outflow: 0, particulars: 'NEFT/ACME', type: 'income' },
};

/** get() resolves known ids and 404s the rest, like the API. */
function getFromRows(id) {
  if (ROWS[id]) return Promise.resolve(ROWS[id]);
  return Promise.reject(new MockApiError('Transaction not found', { code: 'NOT_FOUND', status: 404 }));
}

describe('deleteTransactionsHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    transactions.get.mockImplementation(getFromRows);
    transactions.delete.mockResolvedValue(null);
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('--dry-run shows each row and deletes nothing', async () => {
    await deleteTransactionsHandler({ ids: 't1,t2', dryRun: true });

    expect(transactions.get).toHaveBeenCalledTimes(2);
    expect(transactions.delete).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(out.stdout).toContain('2026-09-01');
    expect(out.stdout).toContain('ICICI 651');
    expect(out.stdout).toContain('1,234.50');
    expect(out.stdout).toContain('UPI/ACME');
    expect(out.stdout).toContain('expense');
    expect(out.stdout).toContain('2 to delete');
    expect(out.stdout).toContain('Dry run: nothing deleted.');
  });

  it('--dry-run exits 1 when an id is not found', async () => {
    await expect(deleteTransactionsHandler({ ids: 't1,nope', dryRun: true })).rejects.toThrow(ExitError);

    expect(transactions.delete).not.toHaveBeenCalled();
    expect(out.stdout).toContain('(not found)');
    expect(out.stdout).toContain('1 to delete, 1 not found');
  });

  it('asks before deleting, and deletes nothing when declined', async () => {
    confirm.mockResolvedValue(false);

    await deleteTransactionsHandler({ ids: 't1' });

    expect(confirm).toHaveBeenCalled();
    expect(transactions.delete).not.toHaveBeenCalled();
    expect(out.stdout).toContain('Cancelled.');
  });

  it('--yes deletes every id without asking', async () => {
    await deleteTransactionsHandler({ ids: 't1,t2', yes: true });

    expect(confirm).not.toHaveBeenCalled();
    expect(transactions.delete).toHaveBeenCalledWith('t1');
    expect(transactions.delete).toHaveBeenCalledWith('t2');
    expect(out.stdout).toContain('✓ t1  deleted');
    expect(out.stdout).toContain('Deleted 2/2.');
  });

  it('reads ids from --ids-file, one per line', async () => {
    const file = join(tmp, 'ids.txt');
    writeFileSync(file, 't1\n\nt2\n');

    await deleteTransactionsHandler({ idsFile: file, yes: true });

    expect(transactions.delete.mock.calls.map((c) => c[0])).toEqual(['t1', 't2']);
  });

  it('reads ids from --ids-file as a JSON array', async () => {
    const file = join(tmp, 'ids.json');
    writeFileSync(file, '["t2", "t1"]');

    await deleteTransactionsHandler({ idsFile: file, yes: true });

    expect(transactions.delete.mock.calls.map((c) => c[0])).toEqual(['t2', 't1']);
  });

  it('keeps going past a failure, reports each id and exits 1', async () => {
    transactions.delete.mockImplementation((id) =>
      id === 't1'
        ? Promise.reject(new MockApiError('Insufficient permissions', { code: 'FORBIDDEN', status: 403 }))
        : Promise.resolve(null),
    );

    await expect(deleteTransactionsHandler({ ids: 't1,nope,t2', yes: true })).rejects.toThrow(ExitError);

    expect(transactions.delete.mock.calls.map((c) => c[0])).toEqual(['t1', 't2']);
    expect(out.stdout).toContain('✗ t1  Insufficient permissions');
    expect(out.stdout).toContain('✗ nope  not found');
    expect(out.stdout).toContain('✓ t2  deleted');
    expect(out.stdout).toContain('Deleted 1/3.');
  });

  it('--json prints per-id results with the deleted row, amounts scaled', async () => {
    await expect(deleteTransactionsHandler({ ids: 't1,nope', yes: true, json: true })).rejects.toThrow(ExitError);

    const results = JSON.parse(out.stdout);
    expect(results).toEqual([
      expect.objectContaining({ id: 't1', ok: true, deleted: true, transaction: expect.objectContaining({ outflow: 1234.5 }) }),
      expect.objectContaining({ id: 'nope', ok: false, deleted: false, transaction: null, error: 'not found' }),
    ]);
  });

  it('--json --dry-run prints results on stdout and the table on stderr', async () => {
    await deleteTransactionsHandler({ ids: 't2', dryRun: true, json: true });

    const results = JSON.parse(out.stdout);
    expect(results).toEqual([expect.objectContaining({ id: 't2', ok: true, deleted: false })]);
    expect(out.stderr).toContain('NEFT/ACME');
    expect(transactions.delete).not.toHaveBeenCalled();
  });

  it('throws when no id is given', async () => {
    await expect(deleteTransactionsHandler({})).rejects.toThrow('No transaction ID given');
  });
});

describe('parseIds', () => {
  it('merges the positional and the file, trims, and drops duplicates', () => {
    const file = join(tmp, 'mixed.txt');
    writeFileSync(file, ' t2 \nt3\r\nt1\n');
    expect(parseIds({ ids: 't1, t2', idsFile: file })).toEqual(['t1', 't2', 't3']);
  });

  it("rejects an ids file that looks like JSON but doesn't parse", () => {
    const file = join(tmp, 'obj.json');
    writeFileSync(file, '[1, 2');
    expect(() => parseIds({ idsFile: file })).toThrow("doesn't parse");
  });
});
