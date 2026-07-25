/**
 * Shared parsing for rule conditions/actions expressed on the command line.
 *
 * Conditions:  --match "field:operator:value"   (repeatable)
 * Actions:     --set    "field=value"            (repeatable)
 *
 * Raw JSON escape hatches (--conditions-json / --actions-json) take precedence
 * over the shorthand when both are supplied.
 */

export const OPERATORS = [
  'equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with',
  'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
  'regex', 'is_null', 'is_not_null', 'within_last_days', 'older_than_days',
];

const NO_VALUE_OPS = new Set(['is_null', 'is_not_null']);
const NUMERIC_OPS = new Set([
  'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
  'within_last_days', 'older_than_days',
]);

function toArray(v) {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Parse one --match token "field:operator:value" into a condition object.
 * The value may itself contain ':' (kept intact — only the first two ':' split).
 */
function parseMatchToken(token) {
  const parts = String(token).split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid --match "${token}". Expected "field:operator:value".`);
  }
  const field = parts[0].trim();
  const operator = parts[1].trim();
  const rawValue = parts.slice(2).join(':');

  if (!field) throw new Error(`Invalid --match "${token}": empty field.`);
  if (!OPERATORS.includes(operator)) {
    throw new Error(`Invalid operator "${operator}" in --match "${token}". Valid: ${OPERATORS.join(', ')}`);
  }

  const condition = { field, operator };
  if (!NO_VALUE_OPS.has(operator)) {
    if (rawValue === '') {
      throw new Error(`Operator "${operator}" needs a value in --match "${token}".`);
    }
    condition.value = NUMERIC_OPS.has(operator) ? Number(rawValue) : rawValue;
    if (NUMERIC_OPS.has(operator) && !Number.isFinite(condition.value)) {
      throw new Error(`Operator "${operator}" needs a numeric value in --match "${token}".`);
    }
  }
  return condition;
}

/** Parse one --set token "field=value" into an action object. */
function parseSetToken(token) {
  const idx = String(token).indexOf('=');
  if (idx === -1) {
    throw new Error(`Invalid --set "${token}". Expected "field=value".`);
  }
  const field = token.slice(0, idx).trim();
  const value = token.slice(idx + 1);
  if (!field) throw new Error(`Invalid --set "${token}": empty field.`);
  return { field, value };
}

/**
 * Resolve conditions from argv (--conditions-json wins over --match).
 * @returns {Array|undefined} undefined when nothing was supplied
 */
export function resolveConditions(argv) {
  if (argv.conditionsJson !== undefined) {
    const parsed = JSON.parse(argv.conditionsJson);
    if (!Array.isArray(parsed)) throw new Error('--conditions-json must be a JSON array.');
    return parsed;
  }
  const tokens = toArray(argv.match);
  if (tokens.length === 0) return undefined;
  return tokens.map(parseMatchToken);
}

/**
 * Resolve actions from argv (--actions-json wins over --set).
 * @returns {Array|undefined} undefined when nothing was supplied
 */
export function resolveActions(argv) {
  if (argv.actionsJson !== undefined) {
    const parsed = JSON.parse(argv.actionsJson);
    if (!Array.isArray(parsed)) throw new Error('--actions-json must be a JSON array.');
    return parsed;
  }
  const tokens = toArray(argv.set);
  if (tokens.length === 0) return undefined;
  return tokens.map(parseSetToken);
}

/** One-line human summary of a condition, e.g. `particulars contains "uber"`. */
export function formatCondition(c) {
  if (c.operator === 'is_null' || c.operator === 'is_not_null') {
    return `${c.field} ${c.operator}`;
  }
  return `${c.field} ${c.operator} "${c.value}"`;
}

/** One-line human summary of an action, e.g. `category = "business expenses"`. */
export function formatAction(a) {
  return `${a.field} = "${a.value}"`;
}
