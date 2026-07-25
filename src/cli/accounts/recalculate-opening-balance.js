import { clientFor } from '../_helpers.js';
import { formatCurrency } from '../../utils/format.js';

export async function recalculateOpeningBalanceHandler(argv) {
  const stm = clientFor();
  const { id } = argv;

  const before_data = (await stm.accounts.get(id)) ?? {};
  const after = (await stm.accounts.recalculateOpeningBalance(id)) ?? {};

  if (argv.json) {
    console.log(JSON.stringify(after, null, 2));
    return;
  }

  console.log(`Recalculated opening balance for account ${id}.`);
  console.log(
    `  ${formatCurrency(before_data.opening_balance) || '(none)'} (${before_data.opening_balance_date ?? '—'})` +
      ` -> ${formatCurrency(after.opening_balance) || '0.00'} (${after.opening_balance_date})`,
  );
}
