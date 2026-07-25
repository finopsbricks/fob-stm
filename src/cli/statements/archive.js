import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function archiveStatementHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();
  const result = await apiPost(`/api/v1/statements/${encodeURIComponent(id)}/archive`, undefined, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Archived statement ${id}.`);
}

export async function unarchiveStatementHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();
  const result = await apiPost(`/api/v1/statements/${encodeURIComponent(id)}/unarchive`, undefined, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Unarchived statement ${id}.`);
}
