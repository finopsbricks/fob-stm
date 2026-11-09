// @ts-check
import { clientFor } from '../_helpers.js';
import { formatTable } from '../utils/format.js';

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
  'statement-coverage',
];

/**
 * One row per account: when its data runs to, the gaps in the period, and how
 * many statements in the period are not yet `complete`.
 * @param {import('../../types/api/Account.types.js').AccountCoverage[]} accounts
 * @returns {string}
 */
function formatStatementCoverage(accounts) {
  return formatTable(
    ['account', 'data_until', 'gaps', 'gap_days', 'incomplete'],
    accounts.map((a) => [
      a.account_name,
      a.upload_status.data_coverage_date ?? '',
      String(a.gaps.length),
      String(a.gaps.reduce((n, g) => n + g.days, 0)),
      String(a.incomplete_statements.length),
    ]),
    { align: ['left', 'left', 'right', 'right', 'right'] },
  );
}

export async function showReportHandler(argv) {
  const { name } = argv;
  const stm = clientFor();

  const result = await stm.reports.get(name, {
    date_from: argv.from,
    date_to: argv.to,
    group_by: argv.groupBy,
    accounts: argv.accounts,
    particulars: argv.particulars,
    entity: argv.entity,
    category: argv.category,
  });

  if (name === 'statement-coverage' && !argv.json) {
    console.log(formatStatementCoverage(result?.data?.accounts ?? []));
    return;
  }

  // Other reports return a custom shape (e.g. { data, period, accounts }) that
  // doesn't fit a table. Print as JSON for v1.
  console.log(JSON.stringify(result, null, 2));
}
