// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatTable, formatAmount } from '../utils/format.js';
import { scaleMilliAmount } from '../utils/amounts.js';

/**
 * Scale the milli-unit amounts inside parsed_data (metadata balances +
 * per-transaction inflow/outflow/balance) so JSON output matches the scaled
 * table view. Non-amount fields and unknown shapes pass through untouched.
 */
function scaleParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const out = { ...parsed };
  if (parsed.metadata && typeof parsed.metadata === 'object') {
    out.metadata = {
      ...parsed.metadata,
      opening_balance: scaleMilliAmount(parsed.metadata.opening_balance),
      closing_balance: scaleMilliAmount(parsed.metadata.closing_balance),
    };
  }
  if (Array.isArray(parsed.transactions)) {
    out.transactions = parsed.transactions.map((t) => ({
      ...t,
      inflow: scaleMilliAmount(t.inflow),
      outflow: scaleMilliAmount(t.outflow),
      balance: scaleMilliAmount(t.balance),
    }));
  }
  return out;
}

export async function extractedStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const s = await stm.statements.get(id);
  if (!s) {
    console.error(`No statement found for id: ${id}`);
    process.exit(1);
  }

  if (argv.raw) {
    if (argv.json) {
      console.log(JSON.stringify(s.raw_data ?? null, null, 2));
    } else {
      console.log(typeof s.raw_data === 'string' ? s.raw_data : JSON.stringify(s.raw_data ?? null, null, 2));
    }
    return;
  }

  if (argv.json) {
    console.log(JSON.stringify(scaleParsed(s.parsed_data ?? null), null, 2));
    return;
  }

  const parsed = s.parsed_data;
  if (!parsed) {
    console.log('(no extracted data — statement has not been parsed yet)');
    return;
  }

  const meta = parsed.metadata ?? {};
  const txns = parsed.transactions ?? [];
  const w = 16;

  console.log(`Extracted data for ${s.file_name ?? id}:`);
  console.log(formatField('Parser', s.parser_type, w));
  console.log(formatField('Account No', meta.acc_no, w));
  console.log(formatField('Account Name', meta.acc_name, w));
  console.log(formatField('Date From', meta.date_from, w));
  console.log(formatField('Date To', meta.date_to, w));
  console.log(formatField('Opening', formatAmount(meta.opening_balance), w));
  console.log(formatField('Closing', formatAmount(meta.closing_balance), w));
  console.log(formatField('Currency', meta.currency, w));
  console.log(formatField('Transactions', String(txns.length), w));

  if (txns.length === 0) {
    return;
  }

  const limit = argv.limit ?? 20;
  const slice = txns.slice(0, limit);

  const headers = ['DATE', 'PARTICULARS', 'INFLOW', 'OUTFLOW', 'BALANCE'];
  const rows = slice.map((t) => [
    t.date ?? '',
    (t.particulars ?? '').slice(0, 50),
    formatAmount(t.inflow),
    formatAmount(t.outflow),
    formatAmount(t.balance),
  ]);
  console.log('');
  console.log(
    formatTable(headers, rows, { align: ['left', 'left', 'right', 'right', 'right'] }),
  );

  if (txns.length > slice.length) {
    console.log(`\n(showing first ${slice.length} of ${txns.length}; use --limit to see more or --json for all)`);
  }
}
