// @ts-check
import { clientFor } from '../_helpers.js';

export async function retryStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const result = await stm.statements.retry(id);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result;
  console.log(`Queued retry for statement ${id} at step '${d.step ?? 'read_file'}' (job ${d.job_id ?? '?'}).`);
}
