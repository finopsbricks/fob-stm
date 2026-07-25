import { apiGet } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export const REPORT_NAMES = [
  'expense',
  'cashflow',
  'income',
  'asset',
  'liability',
  'transfer',
  'balance',
  'overview',
  'inflow_outflow',
  'data-coverage',
];

export async function showReportHandler(argv) {
  const { name } = argv;
  const creds = requireCreds();

  const result = await apiGet(`/api/v1/reports/${encodeURIComponent(name)}`, {
    searchParams: {
      date_from: argv.from,
      date_to: argv.to,
      group_by: argv.groupBy,
      accounts: argv.accounts,
      particulars: argv.particulars,
      entity: argv.entity,
      category: argv.category,
    },
    credentials: creds,
  });

  // Reports return a custom shape (e.g. { data, period, accounts }) that
  // doesn't fit a table. Print as JSON for v1.
  console.log(JSON.stringify(result, null, 2));
}
