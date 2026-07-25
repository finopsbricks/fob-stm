/**
 * Shared helpers for list-endpoint CLI handlers.
 *
 * Each list handler defines a COLUMNS map of `{ header, align, render, raw }`
 * per field, a DEFAULT_FIELDS array, and PUBLIC_FIELDS (the API's projection
 * vocabulary). buildColumnSelector() bundles validation + row rendering so
 * every handler shares the same --fields semantics and error message style.
 */

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
