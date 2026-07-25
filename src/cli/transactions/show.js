// @ts-check
import { clientFor } from '../_helpers.js';
import { formatField, formatDate, formatAmount } from '../utils/format.js';

export async function showTransactionHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const t = await stm.transactions.get(id);

  if (argv.json) {
    console.log(JSON.stringify(t, null, 2));
    return;
  }

  if (!t) {
    console.error(`No transaction found for id: ${id}`);
    process.exit(1);
  }

  const w = 16;
  console.log(formatField('ID', t.id, w));
  console.log(formatField('Date', t.date, w));
  console.log(formatField('Particulars', t.particulars, w));
  console.log(formatField('Inflow', formatAmount(t.inflow), w));
  console.log(formatField('Outflow', formatAmount(t.outflow), w));
  console.log(formatField('Balance', formatAmount(t.balance), w));
  console.log(formatField('Entity', t.entity, w));
  console.log(formatField('Category', t.category, w));
  console.log(formatField('Account', t.account_name ?? t.account, w));
  console.log(formatField('Type', t.type, w));
  console.log(formatField('PO', t.po, w));
  console.log(formatField('Comments', t.comments, w));
  console.log(formatField('Created', formatDate(t.created_at), w));
}
