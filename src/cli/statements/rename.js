import { apiPatch } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function renameStatementHandler(argv) {
  const { id, name } = argv;
  const creds = requireCreds();
  const result = await apiPatch(`/api/v1/statements/${encodeURIComponent(id)}`, {
    file_name: name,
  }, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Renamed statement ${id} → ${result?.data?.file_name ?? name}`);
}
