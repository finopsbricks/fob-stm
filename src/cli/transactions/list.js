import { writeFileSync } from 'fs';
import { apiGet, apiGetAll } from '../../http.js';
import { requireCreds } from '../_helpers.js';
import {
  formatTable,
  formatPaginationHint,
  formatAmount,
  formatCsv,
} from '../../utils/format.js';
import { buildColumnSelector } from '../../utils/list.js';

// Public fields the API exposes (mirrors statements app PUBLIC_FIELDS).
const PUBLIC_FIELDS = [
  'id', 'date', 'particulars', 'inflow', 'outflow', 'balance',
  'entity', 'category', 'po', 'comments', 'type', 'account', 'statement',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'date', 'account', 'particulars', 'type', 'category', 'entity', 'inflow', 'outflow',
];

const COLUMNS = {
  id:          { header: 'ID',          align: 'left',  render: (t) => String(t.id ?? ''),                       raw: (t) => t.id },
  date:        { header: 'DATE',        align: 'left',  render: (t) => t.date ?? '',                             raw: (t) => t.date },
  particulars: { header: 'PARTICULARS', align: 'left',  render: (t) => (t.particulars ?? '').slice(0, 50),       raw: (t) => t.particulars },
  inflow:      { header: 'INFLOW',      align: 'right', render: (t) => formatAmount(t.inflow),                   raw: (t) => t.inflow },
  outflow:     { header: 'OUTFLOW',     align: 'right', render: (t) => formatAmount(t.outflow),                  raw: (t) => t.outflow },
  balance:     { header: 'BALANCE',     align: 'right', render: (t) => formatAmount(t.balance),                  raw: (t) => t.balance },
  entity:      { header: 'ENTITY',      align: 'left',  render: (t) => t.entity ?? '',                           raw: (t) => t.entity },
  category:    { header: 'CATEGORY',    align: 'left',  render: (t) => t.category ?? '',                         raw: (t) => t.category },
  type:        { header: 'TYPE',        align: 'left',  render: (t) => t.type ?? '',                             raw: (t) => t.type },
  po:          { header: 'PO',          align: 'left',  render: (t) => t.po ?? '',                               raw: (t) => t.po },
  comments:    { header: 'COMMENTS',    align: 'left',  render: (t) => (t.comments ?? '').slice(0, 30),          raw: (t) => t.comments },
  account:     { header: 'ACCOUNT',     align: 'left',  render: (t) => t.account_name ?? t.account_id ?? '',     raw: (t) => t.account_name ?? t.account_id },
  statement:   { header: 'STATEMENT',   align: 'left',  render: (t) => t.statement ?? '',                        raw: (t) => t.statement },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

function normalizeSort(value) {
  if (!value) return undefined;
  const upper = String(value).toUpperCase();
  if (upper !== 'ASC' && upper !== 'DESC') {
    throw new Error(`--sort must be 'asc' or 'desc' (got '${value}')`);
  }
  return upper;
}

function buildSearchParams(argv) {
  return {
    fields: argv.fields,
    accounts: argv.account,
    statement: argv.statement,
    date_from: argv.from,
    date_to: argv.to,
    particulars: argv.particulars,
    comments: argv.comments,
    entity: argv.entity,
    category: argv.category,
    type: argv.type,
    amount_from: argv.amountFrom,
    amount_to: argv.amountTo,
    flow_type: argv.flow,
    sort_order: normalizeSort(argv.sort),
  };
}

function emit(text, outputPath) {
  if (outputPath) {
    writeFileSync(outputPath, text);
    console.error(`Wrote ${outputPath}`);
  } else {
    console.log(text);
  }
}

function computeTotals(txns) {
  let inflow = 0;
  let outflow = 0;
  for (const t of txns) {
    inflow += Number(t.inflow) || 0;
    outflow += Number(t.outflow) || 0;
  }
  return { count: txns.length, inflow, outflow, net: inflow - outflow };
}

function renderTotals(totals, truncated) {
  const fmt = (n) => (n / 1000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const inflow = fmt(totals.inflow);
  const outflow = fmt(totals.outflow);
  const net = fmt(totals.net);
  const width = Math.max(inflow.length, outflow.length, net.length);
  const count = `${totals.count} transaction${totals.count === 1 ? '' : 's'}${truncated ? ', truncated' : ''}`;
  return [
    '',
    `TOTALS (${count}):`,
    `  Inflow:   ${inflow.padStart(width)}`,
    `  Outflow:  ${outflow.padStart(width)}`,
    `  Net:      ${net.padStart(width)}`,
  ].join('\n');
}

export async function listTransactionsHandler(argv) {
  const creds = requireCreds();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');

  // CSV/JSON/--totals all need every matching row, so auto-paginate up front.
  const needsAllRows = format === 'csv' || format === 'json' || argv.totals;

  if (needsAllRows) {
    const result = await apiGetAll('/api/v1/transactions', {
      searchParams: buildSearchParams(argv),
      credentials: creds,
    });
    const totals = argv.totals ? computeTotals(result.data) : null;

    if (format === 'json') {
      const payload = { data: result.data, page_context: result.page_context };
      if (totals) payload.totals = totals;
      emit(JSON.stringify(payload, null, 2), argv.output);
    } else if (format === 'csv') {
      emit(formatCsv(fields, selector.rawRows(result.data, fields)), argv.output);
      if (totals) console.error(renderTotals(totals, result.truncated));
    } else {
      // table + --totals: show first --limit rows of the all-rows fetch, then totals
      const txns = result.data;
      if (txns.length === 0) {
        console.log('(no transactions)');
      } else {
        const start = ((argv.page ?? 1) - 1) * (argv.limit ?? 100);
        const slice = txns.slice(start, start + (argv.limit ?? 100));
        console.log(
          formatTable(selector.headersFor(fields), selector.renderRows(slice, fields), {
            align: selector.alignFor(fields),
          }),
        );
        if (txns.length > slice.length) {
          console.log(
            `\n(showing ${slice.length} of ${txns.length}${result.truncated ? '+ (truncated)' : ''}; use --page ${(argv.page ?? 1) + 1} for more)`,
          );
        }
      }
      if (totals) console.log(renderTotals(totals, result.truncated));
    }

    if (result.truncated && format !== 'table') {
      console.error('(truncated to first 15000 rows — refine filters to narrow the result set)');
    }
    return;
  }

  // table format, no totals — single page
  const result = await apiGet('/api/v1/transactions', {
    searchParams: {
      page: argv.page,
      limit: argv.limit,
      ...buildSearchParams(argv),
    },
    credentials: creds,
  });

  const txns = result?.data ?? [];
  if (txns.length === 0) {
    console.log('(no transactions)');
    return;
  }

  console.log(
    formatTable(selector.headersFor(fields), selector.renderRows(txns, fields), {
      align: selector.alignFor(fields),
    }),
  );

  const hint = formatPaginationHint(result?.page_context);
  if (hint) console.log(`\n${hint}`);
}
