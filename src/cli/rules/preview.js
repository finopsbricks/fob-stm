import { apiGet } from '../../http.js';
import { formatTable, formatAmount, formatPaginationHint } from '../../utils/format.js';
import { requireCreds } from '../_helpers.js';

const COLUMNS = ['ID', 'DATE', 'PARTICULARS', 'TYPE', 'INFLOW', 'OUTFLOW'];
const ALIGN = ['left', 'left', 'left', 'left', 'right', 'right'];

export async function previewRuleHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;
  const result = await apiGet(`/api/v1/rules/${encodeURIComponent(id)}/preview`, {
    searchParams: {
      page: argv.page,
      limit: argv.limit,
      force_all: argv.forceAll,
    },
    credentials: creds,
  });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const transactions = result?.data ?? [];
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

  const hint = formatPaginationHint(result?.page_context);
  if (hint) console.log(`\n${hint}`);

  const total = result?.page_context?.total ?? transactions.length;
  const scope = argv.forceAll ? '' : " (type='unknown' only; use --force-all to preview against all matching transactions)";
  console.log(`\nMatched ${total} transaction${total === 1 ? '' : 's'}${scope}.`);
}
