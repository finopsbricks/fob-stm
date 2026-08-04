// @ts-check
import { writeFileSync } from 'fs';
import { MAX_ALL_ROWS } from '../../http.js';
import { clientFor } from '../_helpers.js';
import {
  formatTable,
  formatAmount,
  formatCsv,
} from '../utils/format.js';
import { scaleMilliAmount, amountMode } from '../utils/amounts.js';
import { buildColumnSelector, resolveListScope, formatScopeHint } from '../utils/list.js';

// Milli-unit fields on a transaction that the amount-display setting governs.
const MONEY_FIELDS = ['inflow', 'outflow', 'balance'];

/** Scale a transaction's milli-unit fields for machine output (JSON). */
function scaleTxn(t) {
  const out = { ...t };
  for (const f of MONEY_FIELDS) if (out[f] != null) out[f] = scaleMilliAmount(out[f]);
  return out;
}

// Public fields the API exposes (mirrors statements app PUBLIC_FIELDS).
const PUBLIC_FIELDS = [
  'id', 'date', 'particulars', 'inflow', 'outflow', 'balance',
  'entity', 'category', 'po', 'comments', 'type', 'account', 'currency', 'statement',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'date', 'account', 'particulars', 'type', 'category', 'entity', 'currency', 'inflow', 'outflow',
];

const COLUMNS = {
  id:          { header: 'ID',          align: 'left',  render: (t) => String(t.id ?? ''),                       raw: (t) => t.id },
  date:        { header: 'DATE',        align: 'left',  render: (t) => t.date ?? '',                             raw: (t) => t.date },
  particulars: { header: 'PARTICULARS', align: 'left',  render: (t) => (t.particulars ?? '').slice(0, 50),       raw: (t) => t.particulars },
  inflow:      { header: 'INFLOW',      align: 'right', render: (t) => formatAmount(t.inflow),                   raw: (t) => scaleMilliAmount(t.inflow) },
  outflow:     { header: 'OUTFLOW',     align: 'right', render: (t) => formatAmount(t.outflow),                  raw: (t) => scaleMilliAmount(t.outflow) },
  balance:     { header: 'BALANCE',     align: 'right', render: (t) => formatAmount(t.balance),                  raw: (t) => scaleMilliAmount(t.balance) },
  entity:      { header: 'ENTITY',      align: 'left',  render: (t) => t.entity ?? '',                           raw: (t) => t.entity },
  category:    { header: 'CATEGORY',    align: 'left',  render: (t) => t.category ?? '',                         raw: (t) => t.category },
  type:        { header: 'TYPE',        align: 'left',  render: (t) => t.type ?? '',                             raw: (t) => t.type },
  po:          { header: 'PO',          align: 'left',  render: (t) => t.po ?? '',                               raw: (t) => t.po },
  comments:    { header: 'COMMENTS',    align: 'left',  render: (t) => (t.comments ?? '').slice(0, 30),          raw: (t) => t.comments },
  account:     { header: 'ACCOUNT',     align: 'left',  render: (t) => t.account_name ?? t.account_id ?? '',     raw: (t) => t.account_name ?? t.account_id },
  currency:    { header: 'CCY',         align: 'left',  render: (t) => t.account_currency ?? 'INR',              raw: (t) => t.account_currency ?? 'INR' },
  statement:   { header: 'STATEMENT',   align: 'left',  render: (t) => t.statement ?? '',                        raw: (t) => t.statement },
};

// CLI field key → API field name(s). The CLI exposes friendly keys (`account`,
// `currency`) that map onto the API's `account_id`/`account_name`/`account_currency`.
const FIELDS_TO_API = {
  account: ['account_id', 'account_name'],
  currency: ['account_currency'],
};

function translateFieldsForApi(cliFields) {
  if (!cliFields) return undefined;
  const out = new Set();
  for (const f of cliFields.split(',').map((s) => s.trim()).filter(Boolean)) {
    for (const m of FIELDS_TO_API[f] ?? [f]) out.add(m);
  }
  return [...out].join(',');
}

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
    fields: translateFieldsForApi(argv.fields),
    accounts: argv.account,
    currency: argv.currency,
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

// Group totals by currency — money is never summed across currencies (a
// transaction's currency comes from its account, defaulting to INR). Returns an
// object keyed by currency code: { INR: { count, inflow, outflow, net }, ... }.
function computeTotals(txns) {
  const by = {};
  for (const t of txns) {
    const cur = t.account_currency || 'INR';
    const b = by[cur] ?? (by[cur] = { count: 0, inflow: 0, outflow: 0 });
    b.count += 1;
    b.inflow += Number(t.inflow) || 0;
    b.outflow += Number(t.outflow) || 0;
  }
  for (const cur of Object.keys(by)) by[cur].net = by[cur].inflow - by[cur].outflow;
  return by;
}

function renderTotals(byCurrency, truncated) {
  const fmt = (n) =>
    amountMode() === 'raw'
      ? Number(n).toLocaleString('en-US')
      : (n / 1000).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const blocks = [];
  for (const cur of Object.keys(byCurrency).sort()) {
    const totals = byCurrency[cur];
    const inflow = fmt(totals.inflow);
    const outflow = fmt(totals.outflow);
    const net = fmt(totals.net);
    const width = Math.max(inflow.length, outflow.length, net.length);
    const count = `${totals.count} transaction${totals.count === 1 ? '' : 's'}${truncated ? ', truncated' : ''}`;
    blocks.push(
      [
        '',
        `TOTALS ${cur} (${count}):`,
        `  Inflow:   ${inflow.padStart(width)}`,
        `  Outflow:  ${outflow.padStart(width)}`,
        `  Net:      ${net.padStart(width)}`,
      ].join('\n'),
    );
  }
  return blocks.join('\n');
}

export async function listTransactionsHandler(argv) {
  const stm = clientFor();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');

  const { rows: txns, allRows, truncated, pageContext } = await resolveListScope(argv, {
    list: stm.transactions.list,
    getAll: stm.transactions.getAll,
    searchParams: buildSearchParams(argv),
  });
  const totals = argv.totals ? computeTotals(allRows) : null;

  if (format === 'json') {
    const payload = { data: txns.map(scaleTxn), count: txns.length, truncated };
    if (totals) {
      // Keyed by currency; never a cross-currency sum.
      const by_currency = {};
      for (const cur of Object.keys(totals)) {
        const b = totals[cur];
        by_currency[cur] = {
          count: b.count,
          inflow: scaleMilliAmount(b.inflow),
          outflow: scaleMilliAmount(b.outflow),
          net: scaleMilliAmount(b.net),
        };
      }
      payload.totals = { by_currency };
    }
    emit(JSON.stringify(payload, null, 2), argv.output);
  } else if (format === 'csv') {
    emit(formatCsv(fields, selector.rawRows(txns, fields)), argv.output);
    if (totals) console.error(renderTotals(totals, truncated));
  } else {
    if (txns.length === 0) {
      console.log('(no transactions)');
    } else {
      console.log(
        formatTable(selector.headersFor(fields), selector.renderRows(txns, fields), {
          align: selector.alignFor(fields),
        }),
      );
      const hint = formatScopeHint(argv, { rows: txns, allRows, pageContext });
      if (hint) console.log(`\n${hint}`);
    }
    if (totals) console.log(renderTotals(totals, truncated));
  }

  if (truncated) {
    console.error(`(truncated to first ${MAX_ALL_ROWS} rows — refine filters to narrow the result set)`);
  }
}
