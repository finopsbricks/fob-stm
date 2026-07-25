import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function submitPasswordHandler(argv) {
  const { id, password } = argv;
  const creds = requireCreds();

  const result = await apiPost(
    `/api/v1/statements/${encodeURIComponent(id)}/password`,
    { password },
    { credentials: creds },
  );

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result?.data ?? {};
  console.log(
    `Password accepted for statement ${id}; re-processing from step '${d.step ?? 'read_file'}' (job ${d.job_id ?? '?'}).`,
  );
}
