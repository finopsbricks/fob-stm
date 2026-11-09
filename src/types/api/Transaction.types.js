/**
 * A bank or credit-card transaction, as returned by the statements API
 * (`/api/v1/transactions`). Mirrors the app's public transaction fields.
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {string} [date]
 * @property {string} [particulars]
 * @property {number} [inflow]
 * @property {number} [outflow]
 * @property {number} [balance]
 * @property {string} [entity]
 * @property {string} [category]
 * @property {string} [type]
 * @property {string} [po]
 * @property {string} [comments]
 * @property {string} [account]
 * @property {string} [account_id]
 * @property {string} [account_name]
 * @property {string} [account_currency] - The account's currency (transactions inherit it)
 * @property {string} [statement]
 * @property {string} [created_at]
 */

export {};
