// @ts-check
import { clientFor } from '../_helpers.js';

async function setStatus(argv, status, verb) {
  const stm = clientFor();
  const { id } = argv;
  const record = await stm.accounts.setStatus(id, status);

  if (argv.json) {
    console.log(JSON.stringify(record, null, 2));
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
