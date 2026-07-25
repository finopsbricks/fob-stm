// @ts-check
/**
 * @fob/stm — the importable statements client.
 *
 * Construct a client with credentials bound once, then call resource namespaces:
 *
 *   import { fobStm } from '@fob/stm';
 *   const stm = fobStm(credentials);        // omit → falls back to FOB_STM_API_* env
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

/**
 * @typedef {import('./http.js').Credentials} Credentials
 * @typedef {import('./resources/accounts.js').AccountsApi} AccountsApi
 */

/**
 * The statements client. Explicit (not inferred) so callers — CLI handlers and
 * workers alike — get a checked, autocompleted surface.
 * @typedef {Object} StmClient
 * @property {AccountsApi} accounts
 * @property {() => Promise<{ org_id: string, org_slug: string, org_name: string }|null>} whoami
 */

/**
 * @param {Credentials} [credentials]
 *   Omit to use FOB_STM_API_URL/API_KEY/API_SECRET from the environment.
 * @returns {StmClient}
 */
export function fobStm(credentials) {
  const ctx = createTransport(credentials);
  return {
    accounts: buildAccounts(ctx),
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
