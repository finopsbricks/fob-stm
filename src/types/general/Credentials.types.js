/**
 * Statements API credentials. Any field may be omitted — the transport falls
 * back to the matching FOB_STM_API_* env var.
 * @typedef {Object} Credentials
 * @property {string} [api_url]    Origin-only base URL (no /api/v1).
 * @property {string} [api_key]
 * @property {string} [api_secret]
 */

/**
 * Options accepted by the transport request methods.
 * @typedef {Object} RequestOptions
 * @property {Credentials} [credentials]
 * @property {Record<string, any>} [searchParams]
 */

export {};
