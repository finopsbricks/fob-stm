import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function addIdentifierHandler(argv) {
  const creds = requireCreds();
  const { id, value } = argv;
  const result = await apiPost(`/api/v1/accounts/${encodeURIComponent(id)}/identifiers`, { value }, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const identifier = result?.data?.identifier ?? [];
  console.log(`Added identifier '${value}' to account ${id}.`);
  console.log(`  identifiers: ${identifier.join(', ') || '(none)'}`);
}
