import { writeFileSync } from 'fs';
import { apiGet, apiGetAll } from '../../http.js';
import { requireCreds } from '../_helpers.js';
import {
  formatTable,
  formatPaginationHint,
  formatAmount,
  formatBytes,
  formatCsv,
  formatDate,
} from '../../utils/format.js';
import { buildColumnSelector, parseArchived } from '../../utils/list.js';

// Public fields the API exposes (mirrors statements app PUBLIC_FIELDS).
const PUBLIC_FIELDS = [
  'id', 'file_name', 'mime_type', 'file_type', 'file_size', 'parser_type',
  'step', 'error', 'account_id', 'account_name', 'is_archived', 'created_at',
  'period_start', 'period_end', 'opening_balance', 'closing_balance',
  'data_source', 'review',
  // Alias keys (CLI-only; not part of the API fields vocabulary).
  'account',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'file_name', 'account', 'period_start', 'period_end', 'file_size',
  'parser_type', 'step',
];

// Pipeline steps accepted by the API.
const STEPS = [
  'uploaded', 'read_file', 'identify_statement', 'parse_statement',
  'detect_account', 'detect_duplicates', 'create_transactions', 'complete',
];

const COLUMNS = {
  id:              { header: 'ID',          align: 'left',  render: (s) => String(s.id ?? ''),                       raw: (s) => s.id },
  file_name:       { header: 'FILE',        align: 'left',  render: (s) => (s.file_name ?? '').slice(0, 40),         raw: (s) => s.file_name },
  mime_type:       { header: 'MIME',        align: 'left',  render: (s) => s.mime_type ?? '',                        raw: (s) => s.mime_type },
  file_type:       { header: 'FILE TYPE',   align: 'left',  render: (s) => s.file_type ?? '',                        raw: (s) => s.file_type },
  file_size:       { header: 'SIZE',        align: 'right', render: (s) => formatBytes(s.file_size),                 raw: (s) => s.file_size },
  parser_type:     { header: 'PARSER',      align: 'left',  render: (s) => (s.parser_type ?? '').slice(0, 24),       raw: (s) => s.parser_type },
  step:            { header: 'STEP',        align: 'left',  render: (s) => s.step ?? '',                             raw: (s) => s.step },
  error:           { header: 'ERROR',       align: 'left',  render: (s) => (s.error ?? '').slice(0, 40),             raw: (s) => s.error },
  account:         { header: 'ACCOUNT',     align: 'left',  render: (s) => (s.account_name ?? s.account_id ?? '').slice(0, 24), raw: (s) => s.account_name ?? s.account_id },
  account_id:      { header: 'ACCOUNT ID',  align: 'left',  render: (s) => s.account_id ?? '',                       raw: (s) => s.account_id },
  account_name:    { header: 'ACCOUNT',     align: 'left',  render: (s) => s.account_name ?? '',                     raw: (s) => s.account_name },
  is_archived:     { header: 'ARCHIVED',    align: 'left',  render: (s) => (s.is_archived ? 'yes' : ''),             raw: (s) => s.is_archived },
  created_at:      { header: 'CREATED',     align: 'left',  render: (s) => formatDate(s.created_at),                 raw: (s) => s.created_at },
  period_start:    { header: 'PERIOD START',align: 'left',  render: (s) => s.period_start ?? '',                     raw: (s) => s.period_start },
  period_end:      { header: 'PERIOD END',  align: 'left',  render: (s) => s.period_end ?? '',                       raw: (s) => s.period_end },
  opening_balance: { header: 'OPENING',     align: 'right', render: (s) => formatAmount(s.opening_balance),          raw: (s) => s.opening_balance },
  closing_balance: { header: 'CLOSING',     align: 'right', render: (s) => formatAmount(s.closing_balance),          raw: (s) => s.closing_balance },
  data_source:     { header: 'SOURCE',      align: 'left',  render: (s) => s.data_source ? JSON.stringify(s.data_source).slice(0, 40) : '', raw: (s) => s.data_source },
  review:          { header: 'REVIEW',      align: 'left',  render: (s) => (s.review?.is_done ? 'done' : 'pending'), raw: (s) => s.review },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

// CLI key → API field name(s). 'account' is a CLI convenience column that needs
// both account_id and account_name from the API to render `account_name ?? account_id`.
const FIELDS_TO_API = {
  account: ['account_id', 'account_name'],
};

function translateFieldsForApi(cliFields) {
  if (!cliFields) return undefined;
  const out = new Set();
  for (const f of cliFields.split(',').map((s) => s.trim()).filter(Boolean)) {
    const mapped = FIELDS_TO_API[f] ?? [f];
    for (const m of mapped) out.add(m);
  }
  return [...out].join(',');
}

function buildSearchParams(argv) {
  return {
    fields: translateFieldsForApi(argv.fields),
    account: argv.account,
    step: argv.step,
    file_type: argv.fileType,
    parser_type: argv.parserType,
    period_from: argv.periodFrom,
    period_to: argv.periodTo,
    period_source: argv.periodSource,
    period_missing: argv.periodMissing ? 'true' : undefined,
    upload_from: argv.uploadFrom,
    upload_to: argv.uploadTo,
    reviewed: argv.reviewed === undefined ? undefined : String(argv.reviewed),
    sort_by: argv.sortBy,
    sort_order: argv.sortOrder,
    is_archived: parseArchived(argv.archived),
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

function computeTotals(statements) {
  const byFileType = {};
  let totalSize = 0;
  for (const s of statements) {
    const ft = s.file_type ?? 'unknown';
    byFileType[ft] = (byFileType[ft] ?? 0) + 1;
    totalSize += Number(s.file_size) || 0;
  }
  return { count: statements.length, byFileType, totalSize };
}

function renderTotals(totals, truncated) {
  const lines = [
    '',
    `TOTALS (${totals.count} statement${totals.count === 1 ? '' : 's'}${truncated ? ', truncated' : ''}):`,
  ];
  for (const [ft, n] of Object.entries(totals.byFileType)) {
    lines.push(`  ${ft.padEnd(14)} ${n}`);
  }
  lines.push(`  Total size:    ${formatBytes(totals.totalSize) || '0 B'}`);
  return lines.join('\n');
}

export async function listStatementsHandler(argv) {
  const creds = requireCreds();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');
  const needsAllRows = format === 'csv' || format === 'json' || argv.totals;

  if (needsAllRows) {
    const result = await apiGetAll('/api/v1/statements', {
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
      const statements = result.data;
      if (statements.length === 0) {
        console.log('(no statements)');
      } else {
        const start = ((argv.page ?? 1) - 1) * (argv.limit ?? 100);
        const slice = statements.slice(start, start + (argv.limit ?? 100));
        console.log(
          formatTable(selector.headersFor(fields), selector.renderRows(slice, fields), {
            align: selector.alignFor(fields),
          }),
        );
        if (statements.length > slice.length) {
          console.log(
            `\n(showing ${slice.length} of ${statements.length}${result.truncated ? '+ (truncated)' : ''}; use --page ${(argv.page ?? 1) + 1} for more)`,
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

  const result = await apiGet('/api/v1/statements', {
    searchParams: {
      page: argv.page,
      limit: argv.limit,
      ...buildSearchParams(argv),
    },
    credentials: creds,
  });

  const statements = result?.data ?? [];
  if (statements.length === 0) {
    console.log('(no statements)');
    return;
  }

  console.log(
    formatTable(selector.headersFor(fields), selector.renderRows(statements, fields), {
      align: selector.alignFor(fields),
    }),
  );

  const hint = formatPaginationHint(result?.page_context);
  if (hint) console.log(`\n${hint}`);
}

export { STEPS };
