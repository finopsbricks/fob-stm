// @ts-check
/**
 * The `checks` resource — lib-only (workers push maker/checker results; no CLI).
 * @typedef {import('../types/general/index.js').Transport} Transport
 */

/**
 * @typedef {Object} ChecksApi
 * @property {(data: object) => Promise<any>} update   Upsert checks. Returns the API result.
 */

/** @param {any} r @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {ChecksApi}
 */
export function buildChecks(ctx) {
  return {
    update: (data) => ctx.put('/api/v1/checks', data).then(unwrap),
  };
}
