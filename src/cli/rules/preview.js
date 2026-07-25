// @ts-check
import { formatTable, formatAmount } from '../utils/format.js';
import { clientFor } from '../_helpers.js';

const COLUMNS = ['ID', 'DATE', 'PARTICULARS', 'TYPE', 'INFLOW', 'OUTFLOW'];
const ALIGN = /** @type {Array<'left'|'right'>} */ (['left', 'left', 'left', 'left', 'right', 'right']);

export async function previewRuleHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const transactions = (await stm.rules.preview(id, {
    page: argv.page,
    limit: argv.limit,
    force_all: argv.forceAll,
  })) ?? [];

  if (argv.json) {
    console.log(JSON.stringify(transactions, null, 2));
    return;
  }

  if (transactions.length === 0) {
    console.log('(no matching transactions)');
    return;
  }

  const rows = transactions.map((t) => [
    String(t.id ?? ''),
    t.date ?? '',
    (t.particulars ?? '').slice(0, 50),
    t.type ?? '',
    formatAmount(t.inflow),
    formatAmount(t.outflow),
  ]);

  console.log(formatTable(COLUMNS, rows, { align: ALIGN }));

  const total = transactions.length;
  const scope = argv.forceAll ? '' : " (type='unknown' only; use --force-all to preview against all matching transactions)";
  console.log(`\nMatched ${total} transaction${total === 1 ? '' : 's'}${scope}.`);
}
