// @ts-check
import { clientFor } from '../_helpers.js';

export async function removeIdentifierHandler(argv) {
  const stm = clientFor();
  const { id, value } = argv;
  const account = await stm.accounts.removeIdentifier(id, value);

  if (argv.json) {
    console.log(JSON.stringify(account, null, 2));
    return;
  }

  const identifier = account?.identifier ?? [];
  console.log(`Removed identifier '${value}' from account ${id}.`);
  console.log(`  identifiers: ${identifier.join(', ') || '(none)'}`);
}
