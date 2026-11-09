import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

const accounts = { coverage: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ accounts })),
}));

const { coverageAccountHandler } = await import('../../../src/cli/accounts/coverage.js');

const BODY = {
  account_id: 'acc1',
  account_name: 'Acme Bank',
  period: { date_from: '2024-01-01', date_to: '2024-03-31' },
  coverage: [
    { start: '2024-01-01', end: '2024-01-31' },
    { start: '2024-03-01', end: '2024-03-20' },
  ],
  gaps: [
    { gap_start: '2024-02-01', gap_end: '2024-02-29', days: 29 },
    { gap_start: '2024-03-21', gap_end: '2024-03-31', days: 11 },
  ],
  incomplete_statements: [
    { id: 'stm2', file_name: 'mar.pdf', period_start: '2024-03-01', period_end: '2024-03-20', step: 'create_transactions' },
  ],
  upload_status: {
    data_coverage_date: '2024-03-20',
    last_transaction_date: '2024-03-19',
    days_since: 12,
    status: 'ok',
    upload_frequency: 'monthly',
  },
};

describe('coverageAccountHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('passes --from/--to as the API window', async () => {
    accounts.coverage.mockResolvedValue(BODY);
    await coverageAccountHandler({ id: 'acc1', from: '2024-01-01', to: '2024-03-31' });
    expect(accounts.coverage).toHaveBeenCalledWith('acc1', { date_from: '2024-01-01', date_to: '2024-03-31' });
  });

  it('renders data-until, gaps with their day total, and incomplete statements', async () => {
    accounts.coverage.mockResolvedValue(BODY);
    await coverageAccountHandler({ id: 'acc1', from: '2024-01-01', to: '2024-03-31' });

    expect(out.stdout).toContain('Acme Bank (acc1)');
    expect(out.stdout).toContain('2024-01-01 → 2024-03-31');
    expect(out.stdout).toContain('2024-03-20 (12 days ago, ok; monthly cadence)');
    expect(out.stdout).toContain('Gaps (2, 40 days)');
    expect(out.stdout).toMatch(/2024-03-21\s+2024-03-31\s+11/);
    expect(out.stdout).toContain('Statements not complete (1)');
    expect(out.stdout).toMatch(/stm2\s+mar\.pdf.*create_transactions/);
  });

  it('labels a call without a window as gaps between statements only', async () => {
    accounts.coverage.mockResolvedValue({ ...BODY, period: { date_from: null, date_to: null } });
    await coverageAccountHandler({ id: 'acc1' });
    expect(out.stdout).toContain('all statements (gaps between statements only)');
  });

  it('prints the raw body under --json', async () => {
    accounts.coverage.mockResolvedValue(BODY);
    await coverageAccountHandler({ id: 'acc1', json: true });
    expect(JSON.parse(out.stdout)).toEqual(BODY);
  });
});
