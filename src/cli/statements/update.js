// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatAmount } from '../utils/format.js';

function toMilliUnits(value, label) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`--${label} must be a number (got '${value}')`);
  }
  return Math.round(n * 1000);
}

export async function updateStatementHandler(argv) {
  const { id } = argv;
  const body = {};

  if (argv.periodStart !== undefined) body.period_start = argv.periodStart;
  if (argv.periodEnd !== undefined) body.period_end = argv.periodEnd;
  if (argv.opening !== undefined) body.opening_balance = toMilliUnits(argv.opening, 'opening');
  if (argv.closing !== undefined) body.closing_balance = toMilliUnits(argv.closing, 'closing');
  if (argv.reviewDone !== undefined) {
    body.review = { is_done: argv.reviewDone, at: new Date().toISOString(), type: 'human' };
  }

  if (Object.keys(body).length === 0) {
    throw new Error(
      'Nothing to update. Pass at least one of --period-start, --period-end, --opening, --closing, --review-done.',
    );
  }

  const stm = clientFor();
  const s = await stm.statements.update(id, body);

  if (argv.json) {
    console.log(JSON.stringify(s, null, 2));
    return;
  }

  const w = 18;
  console.log(`Updated statement ${id}:`);
  if (body.period_start != null) console.log(formatField('Period Start', s.period_start, w));
  if (body.period_end != null) console.log(formatField('Period End', s.period_end, w));
  if (body.opening_balance != null) console.log(formatField('Opening Balance', formatAmount(s.opening_balance), w));
  if (body.closing_balance != null) console.log(formatField('Closing Balance', formatAmount(s.closing_balance), w));
  if (body.review != null) console.log(formatField('Review Done', s.review?.is_done ? 'yes' : 'no', w));
}
