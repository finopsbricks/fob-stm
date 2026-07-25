import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function retryStatementHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();
  const result = await apiPost(`/api/v1/statements/${encodeURIComponent(id)}/retry`, undefined, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result?.data ?? {};
  console.log(`Queued retry for statement ${id} at step '${d.step ?? 'read_file'}' (job ${d.job_id ?? '?'}).`);
}
