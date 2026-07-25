// @ts-check
import { clientFor } from '../_helpers.js';

export async function renameStatementHandler(argv) {
  const stm = clientFor();
  const { id, name } = argv;
  const result = await stm.statements.rename(id, name);

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Renamed statement ${id} → ${result?.file_name ?? name}`);
}
