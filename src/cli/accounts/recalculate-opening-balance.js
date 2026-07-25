import { apiGet, apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';
import { formatCurrency } from '../../utils/format.js';

export async function recalculateOpeningBalanceHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;

  const before = await apiGet(`/api/v1/accounts/${encodeURIComponent(id)}`, { credentials: creds });
  const result = await apiPost(`/api/v1/accounts/${encodeURIComponent(id)}/recalculate-opening-balance`, undefined, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const before_data = before?.data ?? {};
  const after = result?.data ?? {};
  console.log(`Recalculated opening balance for account ${id}.`);
  console.log(
    `  ${formatCurrency(before_data.opening_balance) || '(none)'} (${before_data.opening_balance_date ?? '—'})` +
      ` -> ${formatCurrency(after.opening_balance) || '0.00'} (${after.opening_balance_date})`,
  );
}
