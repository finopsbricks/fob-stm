/**
 * Statements app client — thin, typed wrappers over the HTTP transport.
 *
 * Every function takes an optional `credentials` override
 * ({ api_url, api_key, api_secret }); without it, FOB_STM_API_* env vars are
 * used. Workers import these directly; the CLI calls the same functions with
 * credentials resolved from its config file. One signature, two callers — this
 * is what lets you prototype in `fob-stm` and drop the same call into a worker.
 *
 * Supersedes @fob/lib-worker-statements. Paths carry the /api/v1 prefix; the
 * base URL is origin-only.
 */

import { apiGet, apiPost, apiPut, apiPatch, apiGetAll } from './http.js';

const V1 = '/api/v1';

// --- Identity -------------------------------------------------------------

/**
 * Resolve the authenticated key's org identity. Any valid key can call this
 * (no model scope required). Returns `{ org_id, org_slug, org_name }`, or null
 * if the response carries no data.
 */
export async function getIdentity(credentials) {
  const res = await apiGet(`${V1}/whoami`, { credentials });
  return res?.data ?? null;
}

// --- Accounts -------------------------------------------------------------

export function getAccounts(params = {}, credentials) {
  return apiGet(`${V1}/accounts`, { searchParams: params, credentials });
}

export function getAccount(id, credentials) {
  return apiGet(`${V1}/accounts/${encodeURIComponent(id)}`, { credentials });
}

/** Fetch all accounts, walking pagination. Returns { data, page_context, truncated }. */
export function getAllAccounts(params = {}, credentials) {
  return apiGetAll(`${V1}/accounts`, { searchParams: params, credentials });
}

/** Running balance as of a date (YYYY-MM-DD). */
export function getAccountBalance(accountId, asOfDate, credentials) {
  return apiGet(`${V1}/accounts/${encodeURIComponent(accountId)}/balance`, {
    searchParams: { as_of: asOfDate },
    credentials,
  });
}

// --- Statements -----------------------------------------------------------

export function getStatements(params = {}, credentials) {
  return apiGet(`${V1}/statements`, { searchParams: params, credentials });
}

export function getStatement(id, credentials) {
  return apiGet(`${V1}/statements/${encodeURIComponent(id)}`, { credentials });
}

export function updateStatement(id, updates, credentials) {
  return apiPatch(`${V1}/statements/${encodeURIComponent(id)}`, updates, { credentials });
}

// --- Transactions ---------------------------------------------------------

export function getTransactions(params = {}, credentials) {
  return apiGet(`${V1}/transactions`, { searchParams: params, credentials });
}

/** Fetch all transactions, walking pagination. Returns { data, page_context, truncated }. */
export function getAllTransactions(params = {}, credentials) {
  return apiGetAll(`${V1}/transactions`, { searchParams: params, credentials });
}

// --- Rules ----------------------------------------------------------------

export function getRules(params = {}, credentials) {
  return apiGet(`${V1}/rules`, { searchParams: params, credentials });
}

export function getRule(id, credentials) {
  return apiGet(`${V1}/rules/${encodeURIComponent(id)}`, { credentials });
}

export function createRule(data, credentials) {
  return apiPost(`${V1}/rules`, data, { credentials });
}

export function updateRule(id, data, credentials) {
  return apiPut(`${V1}/rules/${encodeURIComponent(id)}`, data, { credentials });
}

export function runRule(id, options = {}, credentials) {
  return apiPost(`${V1}/rules/${encodeURIComponent(id)}/run`, options, { credentials });
}

// --- Work records ---------------------------------------------------------

export function createWorkRecord(data, credentials) {
  return apiPost(`${V1}/work-records`, data, { credentials });
}
