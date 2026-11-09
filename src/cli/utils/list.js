/**
 * Shared helpers for list-endpoint CLI handlers.
 *
 * Each list handler defines a COLUMNS map of `{ header, align, render, raw }`
 * per field, a DEFAULT_FIELDS array, and PUBLIC_FIELDS (the API's projection
 * vocabulary). buildColumnSelector() bundles validation + row rendering so
 * every handler shares the same --fields semantics and error message style.
 *
 * resolveListScope() + formatScopeHint() bundle the fetch-scope side: scope
 * (`--all` vs `--limit`/`--page`) and format (table/json/csv) are orthogonal —
 * format only renders whatever scope selected, it never decides how much to
 * fetch.
 */

import { MAX_ALL_ROWS } from '../../http.js';
import { formatPaginationHint } from './format.js';

/**
 * Resolve fetch scope for a list command. `--all` fetches every matching row
 * (capped at MAX_ALL_ROWS); otherwise a single page (`--limit`/`--page`) is
 * fetched. `--totals` needs the full matching set to aggregate correctly, so
 * it forces the full fetch even when the *displayed* rows are still a single
 * page — `allRows` carries that full set for totals math, `rows` is always
 * what the resolved scope selected for display.
 *
 * @param {{ all?: boolean, totals?: boolean, page?: number, limit?: number }} argv
 * @param {{
 *   list: (params: object) => Promise<{ data: any[], page_context: object|null }>,
 *   getAll: (params: object) => Promise<any[]>,
 *   searchParams: object,
 * }} opts
 * @returns {Promise<{ rows: any[], allRows: any[]|null, truncated: boolean, pageContext: object|null }>}
 */
export async function resolveListScope(argv, { list, getAll, searchParams }) {
  if (!argv.all && !argv.totals) {
    const result = await list({ page: argv.page, limit: argv.limit, ...searchParams });
    return { rows: result?.data ?? [], allRows: null, truncated: false, pageContext: result?.page_context ?? null };
  }

  const allRows = await getAll(searchParams);
  // getAll returns a plain array; hitting the cap is the truncation signal.
  const truncated = allRows.length >= MAX_ALL_ROWS;

  if (argv.all) {
    return { rows: allRows, allRows, truncated, pageContext: null };
  }

  const limit = argv.limit ?? 100;
  const start = ((argv.page ?? 1) - 1) * limit;
  return { rows: allRows.slice(start, start + limit), allRows, truncated, pageContext: null };
}

/**
 * Pagination facts for a resolveListScope() result, for machine output
 * (`--json`, `--format json`) to carry next to `data`/`count`/`truncated`:
 *  - single page: `total`, `page` and `has_more` come from the API's
 *    `page_context`;
 *  - `--totals` without `--all`: computed from the full fetched set;
 *  - `--all`: one result covering every page, so `page` is null.
 * `total` is null when the count is unknown (the `--all` cap was hit, or the
 * API sent no total). `has_more` is true whenever rows exist beyond `data`.
 *
 * @param {{ all?: boolean, page?: number, limit?: number }} argv
 * @param {{ rows: any[], allRows: any[]|null, truncated: boolean, pageContext: object|null }} scope
 * @returns {{ total: number|null, page: number|null, has_more: boolean }}
 */
export function scopePagination(argv, { rows, allRows, truncated, pageContext }) {
  if (allRows) {
    const total = truncated ? null : allRows.length;
    if (argv.all) return { total, page: null, has_more: truncated };
    const page = argv.page ?? 1;
    const start = (page - 1) * (argv.limit ?? 100);
    return { total, page, has_more: truncated || start + rows.length < allRows.length };
  }
  return {
    total: pageContext?.total ?? null,
    page: pageContext?.page ?? argv.page ?? 1,
    has_more: Boolean(pageContext?.has_more),
  };
}

/**
 * "There's more" notice for a resolveListScope() result, or null once
 * everything is shown. Handlers print it to stderr in every format, so a
 * script reading a single page of JSON/CSV is told it got part of the result.
 * Mirrors formatPaginationHint() for the plain single-page case; when
 * `--totals` forced a full fetch without `--all`, builds the equivalent hint
 * from the displayed slice vs the full fetched set. `--all` hitting the cap is
 * reported by the handlers' own truncation notice instead.
 */
export function formatScopeHint(argv, scope) {
  if (argv.all) return null;
  if (!scope.allRows) return formatPaginationHint(scope.pageContext);
  const { page, has_more } = scopePagination(argv, scope);
  if (!has_more) return null;
  const truncatedSuffix = scope.truncated ? '+ (truncated)' : '';
  return `(showing ${scope.rows.length} of ${scope.allRows.length}${truncatedSuffix}; use --page ${page + 1} for more)`;
}

/**
 * @typedef {object} ColumnDef
 * @property {string} header - Column header label
 * @property {'left'|'right'} align - Cell alignment for table view
 * @property {(item: object) => string} render - Cell content for table view (formatted/truncated)
 * @property {(item: object) => *} raw - Cell value for CSV/JSON export (raw, untruncated)
 */

/**
 * Build a column selector from a per-resource COLUMNS map.
 * @returns {object} Selector with parseFields/headersFor/alignFor/renderRows/rawRows
 */
export function buildColumnSelector({ columns, defaultFields, publicFields }) {
  const validFields = publicFields ?? Object.keys(columns);

  function parseFields(arg) {
    if (!arg) return defaultFields;
    const fields = arg.split(',').map((s) => s.trim()).filter(Boolean);
    const invalid = fields.filter((f) => !columns[f]);
    if (invalid.length) {
      throw new Error(
        `Unknown field(s): ${invalid.join(', ')}. Available: ${validFields.join(', ')}`,
      );
    }
    return fields;
  }

  return {
    parseFields,
    headersFor: (fields) => fields.map((f) => columns[f].header),
    alignFor: (fields) => fields.map((f) => columns[f].align),
    renderRows: (items, fields) =>
      items.map((item) => fields.map((f) => columns[f].render(item))),
    rawRows: (items, fields) =>
      items.map((item) => fields.map((f) => columns[f].raw(item))),
  };
}

export function parseStatus(value) {
  if (value === undefined || value === null || value === '' || value === 'all') {
    return undefined;
  }
  if (['active', 'retired', 'quarantined'].includes(value)) return value;
  throw new Error(`--status must be 'all', 'active', 'retired', or 'quarantined' (got '${value}')`);
}

/**
 * Parse an --archived tri-state flag into the API's `is_archived` boolean.
 * @returns {boolean|undefined} undefined = all rows, true = archived only, false = active only.
 */
export function parseArchived(value) {
  if (value === undefined || value === null || value === '' || value === 'all') {
    return undefined;
  }
  if (value === 'active') return false;
  if (value === 'archived') return true;
  throw new Error(`--archived must be 'all', 'active', or 'archived' (got '${value}')`);
}
