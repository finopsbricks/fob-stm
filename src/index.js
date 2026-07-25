/**
 * @fob/stm — the importable statements client.
 *
 * Workers import from here:
 *   import { getAccounts } from '@fob/stm';
 *   const accounts = await getAccounts({ category: 'bank' }, credentials);
 *
 * The `fob-stm` CLI calls these same functions. See src/client.js.
 */

export * from './client.js';
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
  parseContentDispositionFilename,
} from './http.js';
