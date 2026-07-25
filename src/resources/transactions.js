// @ts-check
/**
 * The `transactions` resource — every transaction endpoint, defined once.
 *
 * `buildTransactions(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of read/update methods. This is what
 * `fobStm(creds).transactions` is, and the single place transaction paths live —
 * the CLI handlers call these; they hold no paths of their own.
 *
 * Return shapes: single-record ops return the unwrapped record; `list` returns
 * the raw `{ data, page_context }` envelope; `getAll` returns a flat array.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Transaction.types.js').Transaction} Transaction
 */

/**
 * The transaction client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildTransactions`'s `@returns`
 * binds this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} TransactionsApi
 * @property {(params?: object) => Promise<{ data: Transaction[], page_context: object|null }>} list
 * @property {(params?: object) => Promise<Transaction[]>} getAll
 * @property {(id: string) => Promise<Transaction|null>} get
 * @property {(id: string, data: object) => Promise<Transaction|null>} update
 * @property {(id: string, data: object) => Promise<Transaction|null>} edit
 */

/** Unwrap a single-record response body; null if there's no data.
 * @param {any} r
 * @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {TransactionsApi}
 */
export function buildTransactions(ctx) {
  return {
    /** One page of transactions. Returns the `{ data, page_context }` envelope. */
    list: (params = {}) => ctx.get('/api/v1/transactions', { searchParams: params }),

    /** Every transaction, walking pagination. Returns a flat array (capped at MAX_ALL_ROWS). */
    getAll: async (params = {}) => (await ctx.getAll('/api/v1/transactions', { searchParams: params })).data,

    /** One transaction by id, or null if absent. */
    get: (id) => ctx.get(`/api/v1/transactions/${encodeURIComponent(id)}`).then(unwrap),

    /** Update editable transaction fields (PUT). Returns the updated record. */
    update: (id, data) => ctx.put(`/api/v1/transactions/${encodeURIComponent(id)}`, data).then(unwrap),

    /** Alias of `update` — edit metadata fields on a transaction. Returns the updated record. */
    edit: (id, data) => ctx.put(`/api/v1/transactions/${encodeURIComponent(id)}`, data).then(unwrap),
  };
}
