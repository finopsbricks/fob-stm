import { apiGet } from '../../http.js';
import { requireCreds } from '../_helpers.js';

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// formatCurrency() in utils/format.js suppresses 0 (correct for dense
// tables); for a single-value snapshot 0 is the actual answer.
function formatAmount(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export async function balanceAccountHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;
  const date = argv['yyyy-mm-dd'] || todayLocal();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`date must be in YYYY-MM-DD format, got: ${date}`);
  }

  const result = await apiGet(
    `/api/v1/accounts/${encodeURIComponent(id)}/balance`,
    { searchParams: { as_of: date }, credentials: creds },
  );

  const body = result?.data;
  if (!body) {
    throw new Error(`Unexpected response shape for account ${id}`);
  }

  if (argv.json) {
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const label = body.account_name
    ? `${body.account_name} (${body.account_id})`
    : body.account_id;
  console.log(`EOD balance for ${label} on ${body.as_of_date} = ${formatAmount(body.balance)}`);
}
