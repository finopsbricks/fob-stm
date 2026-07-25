// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatTable, formatAmount } from '../../utils/format.js';

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
    console.log(JSON.stringify(s.parsed_data ?? null, null, 2));
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
