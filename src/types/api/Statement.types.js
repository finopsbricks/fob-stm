/**
 * A bank/credit-card statement (an uploaded file and its processing state), as
 * returned by the statements API (`/api/v1/statements`). Mirrors the app's
 * public statement fields.
 * @typedef {Object} Statement
 * @property {string} id
 * @property {string} [file_name]
 * @property {string} [mime_type]
 * @property {string} [file_type]
 * @property {number} [file_size]
 * @property {string} [parser_type]
 * @property {string} [step]
 * @property {string} [error]
 * @property {string} [account_id]
 * @property {string} [account_name]
 * @property {string} [account_currency] - The linked account's currency
 * @property {string} [account]  CLI-side alias sometimes present for the account label.
 * @property {boolean} [is_archived]
 * @property {string} [created_at]
 * @property {string} [period_start]
 * @property {string} [period_end]
 * @property {number} [opening_balance]
 * @property {number} [closing_balance]
 * @property {object} [data_source]
 * @property {{ is_done?: boolean, at?: string, type?: string }} [review]
 * @property {string} [job_id]
 * @property {any} [raw_data]
 * @property {StatementParsedData} [parsed_data]
 */

/**
 * The structured data extracted from a parsed statement.
 * @typedef {Object} StatementParsedData
 * @property {StatementParsedMetadata} [metadata]
 * @property {StatementParsedTransaction[]} [transactions]
 */

/**
 * @typedef {Object} StatementParsedMetadata
 * @property {string} [acc_no]
 * @property {string} [acc_name]
 * @property {string} [date_from]
 * @property {string} [date_to]
 * @property {number} [opening_balance]
 * @property {number} [closing_balance]
 * @property {string} [currency]
 */

/**
 * @typedef {Object} StatementParsedTransaction
 * @property {string} [date]
 * @property {string} [particulars]
 * @property {number} [inflow]
 * @property {number} [outflow]
 * @property {number} [balance]
 */

/**
 * The result of deleting a statement's linked transactions.
 * @typedef {Object} StatementDeleteTransactionsResult
 * @property {number} [deleted]
 */

export {};
