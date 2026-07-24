import { writeFileSync } from 'node:fs';
import { getAccounts, getAllAccounts } from '../../client.js';
import { requireCreds } from '../_helpers.js';
import {
  formatTable,
  formatPaginationHint,
  formatCurrency,
  formatCsv,
  formatDate,
} from '../../utils/format.js';
import { buildColumnSelector, parseStatus } from '../../utils/list.js';

// Public fields the statements API exposes for accounts.
const PUBLIC_FIELDS = [
  'id', 'name', 'category', 'description', 'acc_no', 'currency', 'color',
  'opening_balance', 'opening_balance_date', 'status', 'upload_frequency', 'created_at',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'name', 'category', 'acc_no', 'currency', 'opening_balance', 'upload_frequency', 'status',
];

const COLUMNS = {
  id:                   { header: 'ID',           align: 'left',  render: (a) => String(a.id ?? ''),                raw: (a) => a.id },
  name:                 { header: 'NAME',         align: 'left',  render: (a) => a.name ?? '',                      raw: (a) => a.name },
  category:             { header: 'CATEGORY',     align: 'left',  render: (a) => a.category ?? '',                  raw: (a) => a.category },
  description:          { header: 'DESCRIPTION',  align: 'left',  render: (a) => (a.description ?? '').slice(0, 40), raw: (a) => a.description },
  acc_no:               { header: 'ACCT NO',      align: 'left',  render: (a) => a.acc_no ?? '',                    raw: (a) => a.acc_no },
  currency:             { header: 'CCY',          align: 'left',  render: (a) => a.currency ?? '',                  raw: (a) => a.currency },
  color:                { header: 'COLOR',        align: 'left',  render: (a) => a.color ?? '',                     raw: (a) => a.color },
  opening_balance:      { header: 'OPENING',      align: 'right', render: (a) => formatCurrency(a.opening_balance), raw: (a) => a.opening_balance },
  opening_balance_date: { header: 'OPENING DATE', align: 'left',  render: (a) => a.opening_balance_date ?? '',      raw: (a) => a.opening_balance_date },
  status:               { header: 'STATUS',       align: 'left',  render: (a) => a.status ?? '',                    raw: (a) => a.status },
  upload_frequency:     { header: 'UPLOAD FREQ',  align: 'left',  render: (a) => a.upload_frequency ?? '',          raw: (a) => a.upload_frequency },
  created_at:           { header: 'CREATED',      align: 'left',  render: (a) => formatDate(a.created_at),          raw: (a) => a.created_at },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

function buildParams(argv) {
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

export async function listAccountsHandler(argv) {
  const creds = requireCreds();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');
  const needsAllRows = format === 'csv' || format === 'json';

  if (needsAllRows) {
    const result = await getAllAccounts(buildParams(argv), creds);
    if (format === 'json') {
      emit(JSON.stringify({ data: result.data, page_context: result.page_context }, null, 2), argv.output);
    } else {
      emit(formatCsv(fields, selector.rawRows(result.data, fields)), argv.output);
    }
    if (result.truncated) {
      console.error('(truncated to first 15000 rows — refine filters to narrow the result set)');
    }
    return;
  }

  const result = await getAccounts(
    { page: argv.page, limit: argv.limit, ...buildParams(argv) },
    creds,
  );

  const accounts = result?.data ?? [];
  if (accounts.length === 0) {
    console.log('(no accounts)');
    return;
  }

  console.log(
    formatTable(selector.headersFor(fields), selector.renderRows(accounts, fields), {
      align: selector.alignFor(fields),
    }),
  );

  const hint = formatPaginationHint(result?.page_context);
  if (hint) console.log(`\n${hint}`);
}
