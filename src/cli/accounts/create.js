import { clientFor } from '../_helpers.js';
import { formatCurrency } from '../../utils/format.js';

export async function createAccountHandler(argv) {
  const stm = clientFor();
  const body = { name: argv.name };
  if (argv.category !== undefined) body.category = argv.category;
  if (argv.currency !== undefined) body.currency = argv.currency;
  if (argv.accNo !== undefined) body.acc_no = argv.accNo;
  if (argv.description !== undefined) body.description = argv.description;
  if (argv.color !== undefined) body.color = argv.color;
  if (argv.opening !== undefined) body.opening_balance = argv.opening;
  if (argv.uploadFrequency !== undefined) body.upload_frequency = argv.uploadFrequency;

  const a = (await stm.accounts.create(body)) ?? {};

  if (argv.json) {
    console.log(JSON.stringify(a, null, 2));
    return;
  }

  console.log(`Created account ${a.id}: ${a.name}`);
  console.log(
    `  category: ${a.category ?? '—'}   currency: ${a.currency ?? '—'}   upload_frequency: ${a.upload_frequency}`,
  );
  if (a.opening_balance) console.log(`  opening balance: ${formatCurrency(a.opening_balance)}`);
}
