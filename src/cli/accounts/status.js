import { apiPut } from '../../http.js';
import { requireCreds } from '../_helpers.js';

async function setStatus(argv, status, verb) {
  const creds = requireCreds();
  const { id } = argv;
  const result = await apiPut(`/api/v1/accounts/${encodeURIComponent(id)}`, { status }, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${verb} account ${id}.`);
}

export async function retireAccountHandler(argv) {
  await setStatus(argv, 'retired', 'Retired');
}

export async function quarantineAccountHandler(argv) {
  await setStatus(argv, 'quarantined', 'Quarantined');
}

export async function reactivateAccountHandler(argv) {
  await setStatus(argv, 'active', 'Reactivated');
}
