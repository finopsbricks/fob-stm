import { apiGet } from '../../http.js';
import { requireCreds } from '../_helpers.js';
import { formatField, formatDate, formatCurrency } from '../../utils/format.js';

export async function showAccountHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;
  const result = await apiGet(`/api/v1/accounts/${encodeURIComponent(id)}`, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const acct = result?.data;
  if (!acct) {
    console.error(`No account found for id: ${id}`);
    process.exit(1);
  }

  const w = 18;
  console.log(formatField('ID', acct.id, w));
  console.log(formatField('Name', acct.name, w));
  console.log(formatField('Category', acct.category, w));
  console.log(formatField('Currency', acct.currency, w));
  console.log(formatField('Account No', acct.acc_no, w));
  console.log(formatField('Opening Balance', formatCurrency(acct.opening_balance), w));
  console.log(formatField('Upload Frequency', acct.upload_frequency, w));
  console.log(formatField('Status', acct.status ?? '', w));
  console.log(formatField('Created', formatDate(acct.created_at), w));
}
