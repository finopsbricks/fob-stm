// @ts-check
/**
 * The `entities` resource — every entity endpoint, defined once.
 *
 * `buildEntities(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of methods. This is what
 * `fobStm(creds).entities` is, and the single place entity paths live — the CLI
 * handlers call these; they hold no paths of their own.
 *
 * The entities endpoint is not paginated: `list` returns the raw response body,
 * whose `data` is an aggregation envelope (`{ data: Entity[], totals }`).
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Entity.types.js').Entity} Entity
 */

/**
 * The entity client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildEntities`'s `@returns` binds
 * this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} EntitiesApi
 * @property {(params?: object) => Promise<{ data: { data: Entity[], totals?: object }|null, page_context?: object|null }>} list
 */

/**
 * @param {Transport} ctx
 * @returns {EntitiesApi}
 */
export function buildEntities(ctx) {
  return {
    /** Entity aggregation over a date range. Returns the raw response envelope. */
    list: (params = {}) => ctx.get('/api/v1/entities', { searchParams: params }),
  };
}
