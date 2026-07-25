// @ts-check
/**
 * The `statements` resource — every statement endpoint, defined once.
 *
 * `buildStatements(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of methods. This is what
 * `fobStm(creds).statements` is, and the single place statement paths live — the
 * CLI handlers call these; they hold no paths of their own.
 *
 * Return shapes: single-record ops and action verbs return the unwrapped record;
 * `list` returns the raw `{ data, page_context }` envelope; `getAll` returns a
 * flat array. `upload` posts multipart form-data; `download`/`downloadUrl` cover
 * the binary streaming path and expose the resolved URL for `--print-url`.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Statement.types.js').Statement} Statement
 * @typedef {import('../types/api/Statement.types.js').StatementDeleteTransactionsResult} StatementDeleteTransactionsResult
 */

/**
 * The statement client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildStatements`'s `@returns` binds
 * this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} StatementsApi
 * @property {(params?: object) => Promise<{ data: Statement[], page_context: object|null }>} list
 * @property {(params?: object) => Promise<Statement[]>} getAll
 * @property {(id: string, params?: object) => Promise<Statement|null>} get
 * @property {(formData: FormData) => Promise<Statement|null>} upload
 * @property {(id: string) => Promise<{ response: Response, url: URL }>} download
 * @property {(id: string) => URL} downloadUrl
 * @property {(id: string, data: object) => Promise<Statement|null>} update
 * @property {(id: string, fileName: string) => Promise<Statement|null>} rename
 * @property {(id: string) => Promise<Statement|null>} archive
 * @property {(id: string) => Promise<Statement|null>} unarchive
 * @property {(id: string) => Promise<Statement|null>} retry
 * @property {(id: string, accNo: string) => Promise<Statement|null>} submitAccountNumber
 * @property {(id: string, password: string) => Promise<Statement|null>} submitPassword
 * @property {(id: string) => Promise<any>} delete
 * @property {(id: string) => Promise<StatementDeleteTransactionsResult|null>} deleteTransactions
 * @property {(id: string) => Promise<number|null>} linkedTransactionCount
 */

/** Unwrap a single-record response body; null if there's no data.
 * @param {any} r
 * @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {StatementsApi}
 */
export function buildStatements(ctx) {
  return {
    /** One page of statements. Returns the `{ data, page_context }` envelope. */
    list: (params = {}) => ctx.get('/api/v1/statements', { searchParams: params }),

    /** Every statement, walking pagination. Returns a flat array (capped at MAX_ALL_ROWS). */
    getAll: async (params = {}) => (await ctx.getAll('/api/v1/statements', { searchParams: params })).data,

    /** One statement by id, or null if absent. `params` may carry a `fields` filter. */
    get: (id, params = {}) =>
      ctx.get(`/api/v1/statements/${encodeURIComponent(id)}`, { searchParams: params }).then(unwrap),

    /** Upload a statement file (multipart form-data). Returns the created record. */
    upload: (formData) => ctx.postForm('/api/v1/statements', formData).then(unwrap),

    /** Stream the original statement file. Returns the raw Response + resolved URL. */
    download: (id) => ctx.getStream(`/api/v1/statements/${encodeURIComponent(id)}/download`),

    /** The fully-resolved download URL (for `--print-url`). */
    downloadUrl: (id) => ctx.buildUrl(`/api/v1/statements/${encodeURIComponent(id)}/download`),

    /** Update statement fields (PATCH; body uses API field names). Returns the updated record. */
    update: (id, data) =>
      ctx.patch(`/api/v1/statements/${encodeURIComponent(id)}`, data).then(unwrap),

    /** Rename the statement file. Returns the updated record. */
    rename: (id, fileName) =>
      ctx.patch(`/api/v1/statements/${encodeURIComponent(id)}`, { file_name: fileName }).then(unwrap),

    /** Archive (soft-hide) the statement. Returns the updated record. */
    archive: (id) =>
      ctx.post(`/api/v1/statements/${encodeURIComponent(id)}/archive`, undefined).then(unwrap),

    /** Unarchive the statement. Returns the updated record. */
    unarchive: (id) =>
      ctx.post(`/api/v1/statements/${encodeURIComponent(id)}/unarchive`, undefined).then(unwrap),

    /** Re-queue processing from an earlier pipeline step. Returns the job/record. */
    retry: (id) =>
      ctx.post(`/api/v1/statements/${encodeURIComponent(id)}/retry`, undefined).then(unwrap),

    /** Supply a missing account number and re-run account detection. Returns the job/record. */
    submitAccountNumber: (id, accNo) =>
      ctx.post(`/api/v1/statements/${encodeURIComponent(id)}/account-number`, { acc_no: accNo }).then(unwrap),

    /** Supply a PDF password and re-process. Returns the job/record. */
    submitPassword: (id, password) =>
      ctx.post(`/api/v1/statements/${encodeURIComponent(id)}/password`, { password }).then(unwrap),

    /** Permanently delete the statement (fails server-side if it has linked transactions). */
    delete: (id) => ctx.delete(`/api/v1/statements/${encodeURIComponent(id)}`).then(unwrap),

    /** Delete all transactions linked to the statement (statement itself stays). Returns the summary. */
    deleteTransactions: (id) =>
      ctx.delete(`/api/v1/statements/${encodeURIComponent(id)}/transactions`).then(unwrap),

    /** Count of transactions linked to the statement (via the transactions list total), or null. */
    linkedTransactionCount: async (id) => {
      const result = await ctx.get('/api/v1/transactions', { searchParams: { statement: id, limit: 1 } });
      return result?.page_context?.total ?? null;
    },
  };
}
