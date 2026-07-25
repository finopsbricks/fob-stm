/**
 * A transaction-tagging rule, as returned by the statements API
 * (`/api/v1/rules`). Mirrors the app's public rule fields.
 * @typedef {Object} Rule
 * @property {string} id
 * @property {string} name
 * @property {string} [description]
 * @property {string} [rationale]
 * @property {number} [priority]
 * @property {boolean} [enabled]
 * @property {Array<{ field: string, operator: string, value?: any }>} [conditions]
 * @property {Array<{ field: string, value: any }>} [actions]
 * @property {{ match_count?: number, last_matched_at?: string }} [cache]
 * @property {string} [created_at]
 * @property {string} [updated_at]
 */

export {};
