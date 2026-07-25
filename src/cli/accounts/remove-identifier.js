import { apiDelete } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function removeIdentifierHandler(argv) {
  const creds = requireCreds();
  const { id, value } = argv;
  const result = await apiDelete(
    `/api/v1/accounts/${encodeURIComponent(id)}/identifiers/${encodeURIComponent(value)}`,
    { credentials: creds },
  );

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const identifier = result?.data?.identifier ?? [];
  console.log(`Removed identifier '${value}' from account ${id}.`);
  console.log(`  identifiers: ${identifier.join(', ') || '(none)'}`);
}
