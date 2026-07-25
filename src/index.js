// @ts-check
/**
 * @fob/stm — the importable statements client.
 *
 * Construct a client with credentials bound once, then call resource namespaces:
 *
 *   import { fobStm } from '@fob/stm';
 *   const stm = fobStm({ api_key, api_secret });   // api_url optional (defaults to the hosted origin)
 *   const { data } = await stm.accounts.list({ category: 'bank' });
 *   const acct = await stm.accounts.get(id);
 *
 * The `fob-stm` CLI builds the same client (see src/cli/_helpers.js `clientFor`)
 * and calls these same namespaces — so the CLI and the library can never drift:
 * every endpoint is defined once, in src/resources/.
 *
 * Multi-tenant workers construct one client per org: `fobStm(orgACreds)`,
 * `fobStm(orgBCreds)`.
 */

import { createTransport } from './http.js';
import { buildAccounts } from './resources/accounts.js';
import { buildStatements } from './resources/statements.js';
import { buildTransactions } from './resources/transactions.js';
import { buildRules } from './resources/rules.js';
import { buildReports } from './resources/reports.js';
import { buildCategories } from './resources/categories.js';
import { buildEntities } from './resources/entities.js';
import { buildWorkRecords } from './resources/work-records.js';
import { buildChecks } from './resources/checks.js';

/**
 * @typedef {import('./http.js').Credentials} Credentials
 * @typedef {import('./resources/accounts.js').AccountsApi} AccountsApi
 * @typedef {import('./resources/statements.js').StatementsApi} StatementsApi
 * @typedef {import('./resources/transactions.js').TransactionsApi} TransactionsApi
 * @typedef {import('./resources/rules.js').RulesApi} RulesApi
 * @typedef {import('./resources/reports.js').ReportsApi} ReportsApi
 * @typedef {import('./resources/categories.js').CategoriesApi} CategoriesApi
 * @typedef {import('./resources/entities.js').EntitiesApi} EntitiesApi
 * @typedef {import('./resources/work-records.js').WorkRecordsApi} WorkRecordsApi
 * @typedef {import('./resources/checks.js').ChecksApi} ChecksApi
 */

/**
 * The statements client. Explicit (not inferred) so callers — CLI handlers and
 * workers alike — get a checked, autocompleted surface.
 * @typedef {Object} StmClient
 * @property {AccountsApi} accounts
 * @property {StatementsApi} statements
 * @property {TransactionsApi} transactions
 * @property {RulesApi} rules
 * @property {ReportsApi} reports
 * @property {CategoriesApi} categories
 * @property {EntitiesApi} entities
 * @property {WorkRecordsApi} workRecords
 * @property {ChecksApi} checks
 * @property {() => Promise<{ org_id: string, org_slug: string, org_name: string }|null>} whoami
 */

/**
 * @param {Credentials} credentials  Required: `{ api_key, api_secret }`. Optional
 *   `api_url` (origin-only) overrides the default hosted endpoint. The library
 *   never reads these from the environment — inject them explicitly.
 * @returns {StmClient}
 */
export function fobStm(credentials) {
  const ctx = createTransport(credentials);
  return {
    accounts: buildAccounts(ctx),
    statements: buildStatements(ctx),
    transactions: buildTransactions(ctx),
    rules: buildRules(ctx),
    reports: buildReports(ctx),
    categories: buildCategories(ctx),
    entities: buildEntities(ctx),
    workRecords: buildWorkRecords(ctx),
    checks: buildChecks(ctx),
    /** Resolve the authed key's org identity ({ org_id, org_slug, org_name }), or null. */
    whoami: () => ctx.get('/api/v1/whoami').then((r) => r?.data ?? null),
  };
}

// Transport primitives — an escape hatch for one-off calls the namespaces don't cover.
export {
  ApiError,
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
  apiGetAll,
  apiPostForm,
  apiGetStream,
  buildAuthedUrl,
  createTransport,
  parseContentDispositionFilename,
  MAX_ALL_ROWS,
} from './http.js';
