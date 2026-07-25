import { writeFileSync } from 'fs';
import { apiGet, apiGetAll } from '../../http.js';
import {
  formatTable,
  formatPaginationHint,
  formatCsv,
  formatDate,
} from '../../utils/format.js';
import { buildColumnSelector } from '../../utils/list.js';
import { requireCreds } from '../_helpers.js';

// API PUBLIC_FIELDS plus CLI-only derived columns (counts + cache subfields).
const PUBLIC_FIELDS = [
  // Direct API fields:
  'id', 'name', 'description', 'rationale', 'priority', 'conditions', 'actions',
  'enabled', 'created_at', 'updated_at', 'cache',
  // Derived (computed client-side from API fields):
  'conditions_count', 'actions_count', 'match_count', 'last_matched_at',
];

// Default printed columns when --fields is not specified.
const DEFAULT_FIELDS = [
  'id', 'name', 'priority', 'enabled', 'conditions_count', 'actions_count', 'match_count',
];

// CLI key → API field name(s). Derived columns are computed from underlying
// API fields and need those fields included in the projection.
const FIELDS_TO_API = {
  conditions_count: ['conditions'],
  actions_count: ['actions'],
  match_count: ['cache'],
  last_matched_at: ['cache'],
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

const COLUMNS = {
  id:               { header: 'ID',          align: 'left',  render: (r) => String(r.id ?? ''),                          raw: (r) => r.id },
  name:             { header: 'NAME',        align: 'left',  render: (r) => (r.name ?? '').slice(0, 30),                 raw: (r) => r.name },
  description:      { header: 'DESCRIPTION', align: 'left',  render: (r) => (r.description ?? '').slice(0, 40),          raw: (r) => r.description },
  rationale:        { header: 'RATIONALE',   align: 'left',  render: (r) => (r.rationale ?? '').slice(0, 40),            raw: (r) => r.rationale },
  priority:         { header: 'PRIORITY',    align: 'right', render: (r) => r.priority != null ? String(r.priority) : '', raw: (r) => r.priority },
  enabled:          { header: 'ENABLED',     align: 'left',  render: (r) => (r.enabled ? 'yes' : 'no'),                  raw: (r) => r.enabled },
  conditions:       { header: 'CONDITIONS',  align: 'left',  render: (r) => r.conditions ? JSON.stringify(r.conditions).slice(0, 40) : '', raw: (r) => r.conditions },
  actions:          { header: 'ACTIONS',     align: 'left',  render: (r) => r.actions ? JSON.stringify(r.actions).slice(0, 40) : '',       raw: (r) => r.actions },
  created_at:       { header: 'CREATED',     align: 'left',  render: (r) => formatDate(r.created_at),                    raw: (r) => r.created_at },
  updated_at:       { header: 'UPDATED',     align: 'left',  render: (r) => formatDate(r.updated_at),                    raw: (r) => r.updated_at },
  cache:            { header: 'CACHE',       align: 'left',  render: (r) => r.cache ? JSON.stringify(r.cache).slice(0, 40) : '',          raw: (r) => r.cache },
  // Derived (computed from underlying API fields):
  conditions_count: { header: '#COND',       align: 'right', render: (r) => String(r.conditions?.length ?? 0),           raw: (r) => r.conditions?.length ?? 0 },
  actions_count:    { header: '#ACT',        align: 'right', render: (r) => String(r.actions?.length ?? 0),              raw: (r) => r.actions?.length ?? 0 },
  match_count:      { header: 'MATCHES',     align: 'right', render: (r) => String(r.cache?.match_count ?? 0),           raw: (r) => r.cache?.match_count ?? 0 },
  last_matched_at:  { header: 'LAST MATCH',  align: 'left',  render: (r) => formatDate(r.cache?.last_matched_at),        raw: (r) => r.cache?.last_matched_at },
};

const selector = buildColumnSelector({
  columns: COLUMNS,
  defaultFields: DEFAULT_FIELDS,
  publicFields: PUBLIC_FIELDS,
});

function buildSearchParams(argv) {
  return {
    fields: translateFieldsForApi(argv.fields),
    enabled: argv.enabled,
    name: argv.name,
    condition_operators: argv.conditionOp,
    condition_fields: argv.conditionField,
    action_fields: argv.actionField,
    sort_by: argv.sortBy,
    sort_order: argv.sortOrder,
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

function computeTotals(rules) {
  let enabled = 0;
  let disabled = 0;
  for (const r of rules) {
    if (r.enabled) enabled++;
    else disabled++;
  }
  return { count: rules.length, enabled, disabled };
}

function renderTotals(totals, truncated) {
  return [
    '',
    `TOTALS (${totals.count} rule${totals.count === 1 ? '' : 's'}${truncated ? ', truncated' : ''}):`,
    `  Enabled:    ${totals.enabled}`,
    `  Disabled:   ${totals.disabled}`,
  ].join('\n');
}

export async function listRulesHandler(argv) {
  const creds = requireCreds();
  const fields = selector.parseFields(argv.fields);
  const format = argv.format ?? (argv.json ? 'json' : 'table');
  const needsAllRows = format === 'csv' || format === 'json' || argv.totals;

  if (needsAllRows) {
    const result = await apiGetAll('/api/v1/rules', {
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
      const rules = result.data;
      if (rules.length === 0) {
        console.log('(no rules)');
      } else {
        const start = ((argv.page ?? 1) - 1) * (argv.limit ?? 100);
        const slice = rules.slice(start, start + (argv.limit ?? 100));
        console.log(
          formatTable(selector.headersFor(fields), selector.renderRows(slice, fields), {
            align: selector.alignFor(fields),
          }),
        );
        if (rules.length > slice.length) {
          console.log(
            `\n(showing ${slice.length} of ${rules.length}${result.truncated ? '+ (truncated)' : ''}; use --page ${(argv.page ?? 1) + 1} for more)`,
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

  const result = await apiGet('/api/v1/rules', {
    searchParams: {
      page: argv.page,
      limit: argv.limit,
      ...buildSearchParams(argv),
    },
    credentials: creds,
  });

  const rules = result?.data ?? [];
  if (rules.length === 0) {
    console.log('(no rules)');
    return;
  }

  console.log(
    formatTable(selector.headersFor(fields), selector.renderRows(rules, fields), {
      align: selector.alignFor(fields),
    }),
  );

  const hint = formatPaginationHint(result?.page_context);
  if (hint) console.log(`\n${hint}`);
}
