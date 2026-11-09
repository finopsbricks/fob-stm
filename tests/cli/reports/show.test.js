import { jest } from '@jest/globals';
import { captureOutput } from '../../helpers.js';

const reports = { get: jest.fn() };
jest.unstable_mockModule('../../../src/cli/_helpers.js', () => ({
  clientFor: jest.fn(() => ({ reports })),
}));

const { showReportHandler, REPORT_NAMES } = await import('../../../src/cli/reports/show.js');

const COVERAGE = {
  data: {
    period: { date_from: '2024-04-01', date_to: '2024-04-30' },
    accounts: [
      {
        account_id: 'a1',
        account_name: 'Acme Bank',
        coverage: [{ start: '2024-04-01', end: '2024-04-30' }],
        gaps: [],
        incomplete_statements: [],
        upload_status: { data_coverage_date: '2024-04-30' },
      },
      {
        account_id: 'a2',
        account_name: 'Acme Card',
        coverage: [],
        gaps: [
          { gap_start: '2024-04-16', gap_end: '2024-04-19', days: 4 },
          { gap_start: '2024-04-26', gap_end: '2024-04-30', days: 5 },
        ],
        incomplete_statements: [{ id: 's3', step: 'detect_account' }],
        upload_status: { data_coverage_date: '2024-04-25' },
      },
    ],
  },
};

describe('showReportHandler', () => {
  let out;
  beforeEach(() => {
    jest.clearAllMocks();
    out = captureOutput();
  });
  afterEach(() => out.restore());

  it('offers statement-coverage as a report', () => {
    expect(REPORT_NAMES).toContain('statement-coverage');
  });

  it('sends --from/--to/--accounts as the report filters', async () => {
    reports.get.mockResolvedValue(COVERAGE);
    await showReportHandler({ name: 'statement-coverage', from: '2024-04-01', to: '2024-04-30', accounts: 'a1,a2' });
    expect(reports.get).toHaveBeenCalledWith(
      'statement-coverage',
      expect.objectContaining({ date_from: '2024-04-01', date_to: '2024-04-30', accounts: 'a1,a2' }),
    );
  });

  it('renders statement-coverage as one row per account', async () => {
    reports.get.mockResolvedValue(COVERAGE);
    await showReportHandler({ name: 'statement-coverage', from: '2024-04-01', to: '2024-04-30' });

    expect(out.stdout).toMatch(/account\s+data_until\s+gaps\s+gap_days\s+incomplete/);
    expect(out.stdout).toMatch(/Acme Bank\s+2024-04-30\s+0\s+0\s+0/);
    expect(out.stdout).toMatch(/Acme Card\s+2024-04-25\s+2\s+9\s+1/);
  });

  it('prints statement-coverage as JSON under --json', async () => {
    reports.get.mockResolvedValue(COVERAGE);
    await showReportHandler({ name: 'statement-coverage', from: '2024-04-01', to: '2024-04-30', json: true });
    expect(JSON.parse(out.stdout)).toEqual(COVERAGE);
  });

  it('keeps printing other reports as JSON', async () => {
    reports.get.mockResolvedValue({ data: { total: 1 } });
    await showReportHandler({ name: 'expense', from: '2024-04-01', to: '2024-04-30' });
    expect(JSON.parse(out.stdout)).toEqual({ data: { total: 1 } });
  });
});
