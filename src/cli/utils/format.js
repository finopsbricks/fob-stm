/**
 * Shared formatting helpers for CLI output.
 * Structured text readable by both humans and LLMs. Copied from the CLI standard's
 * reference set (engineering-standards/cli/output-formatting.md).
 */

/**
 * Format a label: value field with aligned label.
 * "Name:      Acme Corp"
 */
export function formatField(label, value, labelWidth = 0) {
  const padded = (label + ':').padEnd(labelWidth || label.length + 1);
  return `${padded}  ${value ?? '—'}`;
}

/**
 * Format a table with dynamic column widths.
 * @param {string[]} headers - Column header names
 * @param {string[][]} rows - Array of row arrays (strings)
 * @param {{ align?: Array<'left'|'right'> }} [options] - Per-column alignment; defaults to all 'left'
 * @returns {string} Formatted table string
 */
export function formatTable(headers, rows, options = {}) {
  if (rows.length === 0) {
    return headers.join('  ') + '\n(none)';
  }

  const align = options.align ?? [];
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] || '').length)),
  );

  const pad = (text, width, i) =>
    align[i] === 'right' ? text.padStart(width) : text.padEnd(width);

  const headerLine = headers.map((h, i) => pad(h, widths[i], i)).join('  ');
  const separator = '-'.repeat(headerLine.length);
  const dataLines = rows.map((row) =>
    row.map((cell, i) => pad(cell || '—', widths[i], i)).join('  '),
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

/**
 * Format rows as RFC-4180 CSV.
 * Cells containing commas, quotes, or newlines are double-quoted, and embedded
 * quotes are doubled. `null` / `undefined` become empty.
 */
export function formatCsv(headers, rows) {
  const escape = (value) => {
    if (value == null) return '';
    const s = String(value);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(escape).join(',')];
  for (const row of rows) lines.push(row.map(escape).join(','));
  return lines.join('\r\n');
}

/**
 * Format a decimal currency value with thousands separators and 2 decimals.
 * Returns '' for null / undefined / 0.
 */
export function formatCurrency(value) {
  if (value == null || value === '' || Number(value) === 0) return '';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format a monetary value stored as integer milli-units (× 1000).
 */
export function formatAmount(milliUnits) {
  if (milliUnits == null || milliUnits === '' || Number(milliUnits) === 0) return '';
  return formatCurrency(Number(milliUnits) / 1000);
}

/**
 * Format a byte count as a human-readable size. Returns '' for null/undefined.
 * "812 B", "1.5 KB", "3.2 MB".
 */
export function formatBytes(bytes) {
  if (bytes == null || bytes === '') return '';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format duration between two ISO timestamps.
 *   "1m" / "2h 15m" / "3d 4h"
 */
export function formatDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  if (ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHr = hours % 24;
  return remHr > 0 ? `${days}d ${remHr}h` : `${days}d`;
}

/**
 * Format an ISO date string to human-readable.
 * "2026-03-15 10:23:01"
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * One-line hint shown under a list when there are more pages.
 * Returns null when the response fits on one page.
 */
export function formatPaginationHint(pageContext) {
  if (!pageContext?.has_more) return null;
  return `(showing ${pageContext.count} of ${pageContext.total} — page ${pageContext.page}; use --page ${pageContext.page + 1} for more)`;
}

/**
 * Format a header line with right-aligned status.
 *   "Account: abc123                    active"
 */
export function formatHeader(label, id, status) {
  const left = `${label}: ${id}`;
  if (!status) return left;
  const minGap = 4;
  const width = Math.max(left.length + minGap + status.length, 60);
  return left + ' '.repeat(width - left.length - status.length) + status;
}

/**
 * Format a section divider.
 *   "--- Title ---"
 */
export function formatSection(title) {
  return `\n--- ${title} ---\n`;
}
