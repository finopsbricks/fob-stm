// @ts-check
import { clientFor } from '../_helpers.js';

export async function submitAccountNumberHandler(argv) {
  const stm = clientFor();
  const { id, accNo } = argv;

  const result = await stm.statements.submitAccountNumber(id, accNo);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result;
  console.log(
    `Account number set for statement ${id}; re-running account detection (job ${d.job_id ?? '?'}).`,
  );
}
