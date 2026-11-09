// @ts-check
import { writeFileSync } from 'fs';
import { MAX_ALL_ROWS } from '../../http.js';
import { clientFor } from '../_helpers.js';
import {
  formatTable,
  formatCurrency,
  formatCsv,
  formatDate,
} from '../utils/format.js';
import { buildColumnSelector, parseStatus, resolveListScope, scopePagination, formatScopeHint } from '../utils/list.js';

// Public fields the API exposes (mirrors statements app PUBLIC_FIELDS).
const PUBLIC_FIELDS = [
  'id', 'name', 'category', 'description', 'acc_no', 'currency', 'color',
  'opening_balance', 'opening_balance_date', 'status', 'upload_frequency',
  'created_at', 'review',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'name', 'category', 'acc_no', 'currency', 'opening_balance',
  'upload_frequency', 'status',
];

const COLUMNS = {
  id:                   { header: 'ID',            align: 'left',  render: (a) => String(a.id ?? ''),                          raw: (a) => a.id },
  name:                 { header: 'NAME',          align: 'left',  render: (a) => a.name ?? '',                                raw: (a) => a.name },
  category:             { header: 'CATEGORY',      align: 'left',  render: (a) => a.category ?? '',                            raw: (a) => a.category },
  description:          { header: 'DESCRIPTION',   align: 'left',  render: (a) => (a.description ?? '').slice(0, 40),          raw: (a) => a.description },
  acc_no:               { header: 'ACCT NO',       align: 'left',  render: (a) => a.acc_no ?? '',                              raw: (a) => a.acc_no },
  currency:             { header: 'CCY',           align: 'left',  render: (a) => a.currency ?? '',                            raw: (a) => a.currency },
  color:                { header: 'COLOR',         align: 'left',  render: (a) => a.color ?? '',                               raw: (a) => a.color },
  opening_balance:      { header: 'OPENING',       align: 'right', render: (a) => formatCurrency(a.opening_balance),           raw: (a) => a.opening_balance },
  opening_balance_date: { header: 'OPENING DATE',  align: 'left',  render: (a) => a.opening_balance_date ?? '',                raw: (a) => a.opening_balance_date },
  status:               { header: 'STATUS',        align: 'left',  render: (a) => a.status ?? '',                              raw: (a) => a.status },
  upload_frequency:     { header: 'UPLOAD FREQ',   align: 'left',  render: (a) => a.upload_frequency ?? '',                    raw: (a) => a.upload_frequency },
  created_at:           { header: 'CREATED',       align: 'left',  render: (a) => formatDate(a.created_at),                    raw: (a) => a.created_at },
  review:               { header: 'REVIEW',        align: 'left',  render: (a) => (a.review?.is_done ? 'done' : 'pending'),    raw: (a) => a.review },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

function buildSearchParams(argv) {
  return {
    fields: argv.fields,
    category: argv.category,
    status: parseStatus(argv.status),
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

function computeTotals(accounts) {
  const byCategory = {};
  let openingSum = 0;
  for (const a of accounts) {
    byCategory[a.category ?? 'unknown'] = (byCategory[a.category ?? 'unknown'] ?? 0) + 1;
    openingSum += Number(a.opening_balance) || 0;
  }
  return { count: accounts.length, byCategory, openingSum };
}

function renderTotals(totals, truncated) {
  const lines = [
    '',
    `TOTALS (${totals.count} account${totals.count === 1 ? '' : 's'}${truncated ? ', truncated' : ''}):`,
  ];
  for (const [cat, n] of Object.entries(totals.byCategory)) {
    lines.push(`  ${cat.padEnd(14)} ${n}`);
  }
  lines.push(`  Opening sum:   ${formatCurrency(totals.openingSum) || '0.00'}`);
  return lines.join('\n');
}

export async function listAccountsHandler(argv) {
  const stm = clientFor();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');

  const scope = await resolveListScope(argv, {
    list: stm.accounts.list,
    getAll: stm.accounts.getAll,
    searchParams: buildSearchParams(argv),
  });
  const { rows: accounts, allRows, truncated } = scope;
  const pagination = scopePagination(argv, scope);
  const totals = argv.totals ? computeTotals(allRows) : null;

  if (format === 'json') {
    /** @type {Record<string, any>} */
    const payload = { data: accounts, count: accounts.length, ...pagination, truncated };
    if (totals) payload.totals = totals;
    emit(JSON.stringify(payload, null, 2), argv.output);
  } else if (format === 'csv') {
    emit(formatCsv(fields, selector.rawRows(accounts, fields)), argv.output);
    if (totals) console.error(renderTotals(totals, truncated));
  } else {
    if (accounts.length === 0) {
      console.log('(no accounts)');
    } else {
      console.log(
        formatTable(selector.headersFor(fields), selector.renderRows(accounts, fields), {
          align: selector.alignFor(fields),
        }),
      );
    }
    if (totals) console.log(renderTotals(totals, truncated));
  }

  const hint = formatScopeHint(argv, scope);
  if (hint) console.error(hint);
  if (truncated) {
    console.error(`(truncated to first ${MAX_ALL_ROWS} rows — refine filters to narrow the result set)`);
  }
}
