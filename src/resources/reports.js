// @ts-check
/**
 * The `reports` resource — every report endpoint, defined once.
 *
 * `buildReports(ctx)` binds a credential-carrying transport (see http.js
 * `createTransport`) into a flat namespace of report methods. This is what
 * `fobStm(creds).reports` is, and the single place report paths live — the CLI
 * handlers call these; they hold no paths of their own.
 */

/**
 * @typedef {import('../types/general/index.js').Transport} Transport
 * @typedef {import('../types/api/Report.types.js').Report} Report
 */

/**
 * The report client surface. Explicit because `checkJs` treats an inferred
 * object literal as expando (unknown-property access wouldn't error) — only a
 * declared type gives callers real checking. `buildReports`'s `@returns` binds
 * this, so the implementation below is verified against it by `tsc`.
 * @typedef {Object} ReportsApi
 * @property {(name: string, params?: object) => Promise<Report|null>} get
 */

/**
 * @param {Transport} ctx
 * @returns {ReportsApi}
 */
export function buildReports(ctx) {
  return {
    /**
     * One generated report by name, with report filters as `params`. Reports
     * return a custom envelope (e.g. `{ data, period, accounts }`) that is the
     * report itself, so the whole response is returned unwrapped.
     */
    get: (name, params = {}) =>
      ctx.get(`/api/v1/reports/${encodeURIComponent(name)}`, { searchParams: params }),
  };
}
