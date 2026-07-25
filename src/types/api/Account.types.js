/**
 * A bank or credit-card account, as returned by the statements API
 * (`/api/v1/accounts`). Mirrors the app's public account fields.
 * @typedef {Object} Account
 * @property {string} id
 * @property {string} name
 * @property {string} [category]
 * @property {string} [description]
 * @property {string} [acc_no]
 * @property {string[]} [identifier]  Values used to match incoming statements.
 * @property {string} [currency]
 * @property {string} [color]
 * @property {number} [opening_balance]
 * @property {string} [opening_balance_date]
 * @property {'active' | 'retired' | 'quarantined'} [status]
 * @property {string} [upload_frequency]
 * @property {string} [created_at]
 * @property {{ is_done?: boolean }} [review]
 */

/**
 * An account's computed running balance as of a date.
 * @typedef {Object} AccountBalance
 * @property {string} account_id
 * @property {string} [account_name]
 * @property {string} as_of_date
 * @property {number} balance
 */

export {};
