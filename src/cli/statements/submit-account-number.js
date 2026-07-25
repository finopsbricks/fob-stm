import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function submitAccountNumberHandler(argv) {
  const { id, accNo } = argv;
  const creds = requireCreds();

  const result = await apiPost(
    `/api/v1/statements/${encodeURIComponent(id)}/account-number`,
    { acc_no: accNo },
    { credentials: creds },
  );

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result?.data ?? {};
  console.log(
    `Account number set for statement ${id}; re-running account detection (job ${d.job_id ?? '?'}).`,
  );
}
