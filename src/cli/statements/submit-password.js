// @ts-check
import { clientFor } from '../_helpers.js';

export async function submitPasswordHandler(argv) {
  const stm = clientFor();
  const { id, password } = argv;

  const result = await stm.statements.submitPassword(id, password);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result;
  console.log(
    `Password accepted for statement ${id}; re-processing from step '${d.step ?? 'read_file'}' (job ${d.job_id ?? '?'}).`,
  );
}
