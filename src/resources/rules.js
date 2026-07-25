// @ts-check
/**
 * The `rules` resource — every rule endpoint, defined once.
 *
 * `buildRules(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of CRUD-ish methods. This is what
 * `fobStm(creds).rules` is, and the single place rule paths live — the CLI
 * handlers call these; they hold no paths of their own.
 *
 * Return shapes: single-record ops return the unwrapped record; `list` returns
 * the raw `{ data, page_context }` envelope; `getAll` returns a flat array.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Rule.types.js').Rule} Rule
 */

/**
 * The rule client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildRules`'s `@returns` binds
 * this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} RulesApi
 * @property {(params?: object) => Promise<{ data: Rule[], page_context: object|null }>} list
 * @property {(params?: object) => Promise<Rule[]>} getAll
 * @property {(id: string) => Promise<Rule|null>} get
 * @property {(data: object) => Promise<Rule|null>} create
 * @property {(id: string, data: object) => Promise<Rule|null>} update
 * @property {(id: string, params?: object) => Promise<any>} preview
 * @property {(id: string, data?: object) => Promise<any>} run
 * @property {(id: string) => Promise<any>} delete
 */

/** Unwrap a single-record response body; null if there's no data.
 * @param {any} r
 * @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {RulesApi}
 */
export function buildRules(ctx) {
  return {
    /** One page of rules. Returns the `{ data, page_context }` envelope. */
    list: (params = {}) => ctx.get('/api/v1/rules', { searchParams: params }),

    /** Every rule, walking pagination. Returns a flat array (capped at MAX_ALL_ROWS). */
    getAll: async (params = {}) => (await ctx.getAll('/api/v1/rules', { searchParams: params })).data,

    /** One rule by id, or null if absent. */
    get: (id) => ctx.get(`/api/v1/rules/${encodeURIComponent(id)}`).then(unwrap),

    /** Create a rule (`data` uses API field names). Returns the created record. */
    create: (data) => ctx.post('/api/v1/rules', data).then(unwrap),

    /** Update rule fields (PUT). Returns the updated record. */
    update: (id, data) => ctx.put(`/api/v1/rules/${encodeURIComponent(id)}`, data).then(unwrap),

    /** Preview the transactions a rule matches. Returns the `{ data, page_context }` envelope. */
    preview: (id, params = {}) =>
      ctx.get(`/api/v1/rules/${encodeURIComponent(id)}/preview`, { searchParams: params }).then(unwrap),

    /** Retroactively apply a rule to existing transactions. Returns the run summary. */
    run: (id, data = {}) => ctx.post(`/api/v1/rules/${encodeURIComponent(id)}/run`, data).then(unwrap),

    /** Permanently delete a rule. */
    delete: (id) => ctx.delete(`/api/v1/rules/${encodeURIComponent(id)}`).then(unwrap),
  };
}
