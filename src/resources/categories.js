// @ts-check
/**
 * The `categories` resource — the category-rollup endpoint, defined once.
 *
 * `buildCategories(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a small namespace. This is what
 * `fobStm(creds).categories` is, and the single place category paths live — the
 * CLI handlers call these; they hold no paths of their own.
 *
 * The categories endpoint is a single date-ranged rollup (not paginated like
 * accounts), so `list` alone suffices. It returns the raw response envelope
 * (`{ data: { data, totals } }`); the handler drills into it.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Category.types.js').Category} Category
 */

/**
 * The category client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildCategories`'s `@returns`
 * binds this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} CategoriesApi
 * @property {(params?: object) => Promise<{ data: { data: Category[], totals?: object }|null }>} list
 */

/** Unwrap a single-record response body; null if there's no data.
 * @param {any} r
 * @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {CategoriesApi}
 */
export function buildCategories(ctx) {
  return {
    /** Category rollup for a date range. Returns the raw `{ data: { data, totals } }` envelope. */
    list: (params = {}) => ctx.get('/api/v1/categories', { searchParams: params }),
  };
}
