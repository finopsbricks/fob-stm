// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatSection, formatTable } from '../utils/format.js';

/**
 * `accounts coverage <id> [--from --to]`: which days the account's statements
 * cover, the gaps, upload status, and statements still processing.
 * @param {{ id: string, from?: string, to?: string, json?: boolean }} argv
 */
export async function coverageAccountHandler(argv) {
  const stm = clientFor();
  const body = await stm.accounts.coverage(argv.id, { date_from: argv.from, date_to: argv.to });
  if (!body) {
    throw new Error(`Unexpected response shape for account ${argv.id}`);
  }

  if (argv.json) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const { upload_status: us, period } = body;
  const window =
    period?.date_from || period?.date_to
      ? `${period.date_from ?? '…'} → ${period.date_to ?? '…'}`
      : 'all statements (gaps between statements only)';
  const gap_days = body.gaps.reduce((n, g) => n + g.days, 0);
  const w = 17;

  console.log(formatField('Account', `${body.account_name} (${body.account_id})`, w));
  console.log(formatField('Window', window, w));
  console.log(
    formatField(
      'Data until',
      us.data_coverage_date
        ? `${us.data_coverage_date} (${us.days_since} days ago, ${us.status}; ${us.upload_frequency} cadence)`
        : `— (${us.status})`,
      w,
    ),
  );
  console.log(formatField('Last transaction', us.last_transaction_date ?? '—', w));

  console.log(formatSection(`Coverage (${body.coverage.length})`));
  console.log(formatTable(['start', 'end'], body.coverage.map((c) => [c.start, c.end])));

  console.log(formatSection(`Gaps (${body.gaps.length}, ${gap_days} days)`));
  console.log(
    formatTable(
      ['gap_start', 'gap_end', 'days'],
      body.gaps.map((g) => [g.gap_start, g.gap_end, String(g.days)]),
      { align: ['left', 'left', 'right'] },
    ),
  );

  console.log(formatSection(`Statements not complete (${body.incomplete_statements.length})`));
  console.log(
    formatTable(
      ['id', 'file_name', 'period_start', 'period_end', 'step'],
      body.incomplete_statements.map((s) => [s.id, s.file_name ?? '', s.period_start ?? '', s.period_end ?? '', s.step]),
    ),
  );
}
