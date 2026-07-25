// @ts-check
import { clientFor } from '../_helpers.js';

export async function archiveStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const result = await stm.statements.archive(id);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Archived statement ${id}.`);
}

export async function unarchiveStatementHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const result = await stm.statements.unarchive(id);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Unarchived statement ${id}.`);
}
