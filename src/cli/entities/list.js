// @ts-check
import { writeFileSync } from 'fs';
import { formatTable, formatCsv, formatCurrency } from '../../utils/format.js';
import { buildColumnSelector } from '../../utils/list.js';
import { clientFor, validateDateRange } from '../_helpers.js';

// Public fields the API exposes.
const PUBLIC_FIELDS = ['entity', 'type', 'count', 'inflow', 'outflow'];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = ['entity', 'type', 'count', 'inflow', 'outflow'];

const COLUMNS = {
  entity:   { header: 'ENTITY',   align: 'left',  render: (r) => r.entity ?? '(none)',           raw: (r) => r.entity },
  type:     { header: 'TYPE',     align: 'left',  render: (r) => r.type ?? '',                   raw: (r) => r.type },
  count:    { header: 'COUNT',    align: 'right', render: (r) => String(r.count ?? 0),           raw: (r) => r.count },
  inflow:   { header: 'INFLOW',   align: 'right', render: (r) => formatCurrency(r.inflow),       raw: (r) => r.inflow },
  outflow:  { header: 'OUTFLOW',  align: 'right', render: (r) => formatCurrency(r.outflow),      raw: (r) => r.outflow },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

function emit(text, outputPath) {
  if (outputPath) {
    writeFileSync(outputPath, text);
    console.error(`Wrote ${outputPath}`);
  } else {
    console.log(text);
  }
}

function renderTotals(totals) {
  return [
    '',
    `TOTALS (${totals.count} transaction${totals.count === 1 ? '' : 's'}):`,
    `  Inflow:   ${formatCurrency(totals.inflow) || '0.00'}`,
    `  Outflow:  ${formatCurrency(totals.outflow) || '0.00'}`,
  ].join('\n');
}

export async function listEntitiesHandler(argv) {
  validateDateRange({ from: argv.from, to: argv.to });
  const stm = clientFor();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');

  const result = await stm.entities.list({
    date_from: argv.from,
    date_to: argv.to,
    accounts: argv.accounts,
    type: argv.type,
  });

  const payload = result?.data;
  const rows = payload.data ?? [];

  if (format === 'json') {
    emit(JSON.stringify(payload, null, 2), argv.output);
    return;
  }

  if (format === 'csv') {
    emit(formatCsv(fields, selector.rawRows(rows, fields)), argv.output);
    if (argv.totals && payload.totals) console.error(renderTotals(payload.totals));
    return;
  }

  if (rows.length === 0) {
    console.log('(no entities)');
  } else {
    console.log(
      formatTable(selector.headersFor(fields), selector.renderRows(rows, fields), {
        align: selector.alignFor(fields),
      }),
    );
  }
  if (argv.totals && payload.totals) console.log(renderTotals(payload.totals));
}
