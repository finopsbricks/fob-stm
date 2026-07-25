// @ts-check
/**
 * The `accounts` resource — every account endpoint, defined once.
 *
 * `buildAccounts(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of CRUD-ish methods. This is what
 * `fobStm(creds).accounts` is, and the single place account paths live — the CLI
 * handlers call these; they hold no paths of their own.
 *
 * Return shapes: single-record ops return the unwrapped record; `list` returns
 * the raw `{ data, page_context }` envelope; `getAll` returns a flat array.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Account.types.js').Account} Account
 * @typedef {import('../types/api/Account.types.js').AccountBalance} AccountBalance
 */

/**
 * The account client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildAccounts`'s `@returns` binds
 * this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} AccountsApi
 * @property {(params?: object) => Promise<{ data: Account[], page_context: object|null }>} list
 * @property {(params?: object) => Promise<Account[]>} getAll
 * @property {(id: string) => Promise<Account|null>} get
 * @property {(id: string, asOf: string) => Promise<AccountBalance|null>} balance
 * @property {(data: object) => Promise<Account|null>} create
 * @property {(id: string, data: object) => Promise<Account|null>} update
 * @property {(id: string, status: string) => Promise<Account|null>} setStatus
 * @property {(id: string) => Promise<Account|null>} retire
 * @property {(id: string) => Promise<Account|null>} quarantine
 * @property {(id: string) => Promise<Account|null>} reactivate
 * @property {(id: string) => Promise<any>} delete
 * @property {(retainId: string, deleteId: string) => Promise<any>} merge
 * @property {(id: string, value: string) => Promise<Account|null>} addIdentifier
 * @property {(id: string, value: string) => Promise<Account|null>} removeIdentifier
 * @property {(id: string) => Promise<Account|null>} recalculateOpeningBalance
 */

/** Unwrap a single-record response body; null if there's no data.
 * @param {any} r
 * @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {AccountsApi}
 */
export function buildAccounts(ctx) {
  return {
    /** One page of accounts. Returns the `{ data, page_context }` envelope. */
    list: (params = {}) => ctx.get('/api/v1/accounts', { searchParams: params }),

    /** Every account, walking pagination. Returns a flat array (capped at MAX_ALL_ROWS). */
    getAll: async (params = {}) => (await ctx.getAll('/api/v1/accounts', { searchParams: params })).data,

    /** One account by id, or null if absent. */
    get: (id) => ctx.get(`/api/v1/accounts/${encodeURIComponent(id)}`).then(unwrap),

    /** Computed EOD balance as of a date (YYYY-MM-DD). */
    balance: (id, asOf) =>
      ctx.get(`/api/v1/accounts/${encodeURIComponent(id)}/balance`, { searchParams: { as_of: asOf } }).then(unwrap),

    /** Create an account (`data` uses API field names). Returns the created record. */
    create: (data) => ctx.post('/api/v1/accounts', data).then(unwrap),

    /** Update account fields (PUT). Returns the updated record. */
    update: (id, data) => ctx.put(`/api/v1/accounts/${encodeURIComponent(id)}`, data).then(unwrap),

    /** Set lifecycle status ('active' | 'retired' | 'quarantined'). Returns the updated record. */
    setStatus: (id, status) => ctx.put(`/api/v1/accounts/${encodeURIComponent(id)}`, { status }).then(unwrap),
    retire: (id) => ctx.put(`/api/v1/accounts/${encodeURIComponent(id)}`, { status: 'retired' }).then(unwrap),
    quarantine: (id) => ctx.put(`/api/v1/accounts/${encodeURIComponent(id)}`, { status: 'quarantined' }).then(unwrap),
    reactivate: (id) => ctx.put(`/api/v1/accounts/${encodeURIComponent(id)}`, { status: 'active' }).then(unwrap),

    /** Permanently delete (fails server-side if it still has linked transactions). */
    delete: (id) => ctx.delete(`/api/v1/accounts/${encodeURIComponent(id)}`).then(unwrap),

    /** Merge `deleteId` into `retainId` (destructive). Sends the API's `confirm` flag. Returns the summary. */
    merge: (retainId, deleteId) =>
      ctx.post(`/api/v1/accounts/${encodeURIComponent(retainId)}/merge`, {
        delete_account_id: deleteId,
        confirm: true,
      }).then(unwrap),

    /** Add a statement-matching identifier. Returns the updated record. */
    addIdentifier: (id, value) =>
      ctx.post(`/api/v1/accounts/${encodeURIComponent(id)}/identifiers`, { value }).then(unwrap),

    /** Remove a statement-matching identifier. Returns the updated record. */
    removeIdentifier: (id, value) =>
      ctx.delete(`/api/v1/accounts/${encodeURIComponent(id)}/identifiers/${encodeURIComponent(value)}`).then(unwrap),

    /** Recompute opening balance/date from the earliest statement on file. Returns the updated record. */
    recalculateOpeningBalance: (id) =>
      ctx.post(`/api/v1/accounts/${encodeURIComponent(id)}/recalculate-opening-balance`).then(unwrap),
  };
}
