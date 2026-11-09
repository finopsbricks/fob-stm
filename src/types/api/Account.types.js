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

/**
 * Statement coverage for one account (`/api/v1/accounts/:id/coverage`, and each
 * entry of the `statement-coverage` report).
 * @typedef {Object} AccountCoverage
 * @property {string} account_id
 * @property {string} account_name
 * @property {{ date_from: string|null, date_to: string|null }} [period]
 * @property {Array<{ start: string, end: string }>} coverage - Merged statement periods
 * @property {Array<{ gap_start: string, gap_end: string, days: number }>} gaps - Days no statement covers
 * @property {Array<{ id: string, file_name: string|null, period_start: string|null, period_end: string|null, step: string }>} incomplete_statements - Statements not at `complete`
 * @property {{ data_coverage_date: string|null, last_transaction_date: string|null, days_since: number|null, status: string, upload_frequency: string }} upload_status
 */

export {};
