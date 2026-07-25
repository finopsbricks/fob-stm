// @ts-check
/**
 * The `work-records` resource — lib-only (workers post work records; no CLI).
 * @typedef {import('../types/general/index.js').Transport} Transport
 */

/**
 * @typedef {Object} WorkRecordsApi
 * @property {(data: object) => Promise<any>} create   Create a work record. Returns the created record.
 */

/** @param {any} r @returns {any} */
const unwrap = (r) => r?.data ?? null;

/**
 * @param {Transport} ctx
 * @returns {WorkRecordsApi}
 */
export function buildWorkRecords(ctx) {
  return {
    create: (data) => ctx.post('/api/v1/work-records', data).then(unwrap),
  };
}
