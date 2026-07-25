import { clientFor } from '../_helpers.js';

export async function addIdentifierHandler(argv) {
  const stm = clientFor();
  const { id, value } = argv;
  const account = await stm.accounts.addIdentifier(id, value);

  if (argv.json) {
    console.log(JSON.stringify(account, null, 2));
    return;
  }

  const identifier = account?.identifier ?? [];
  console.log(`Added identifier '${value}' to account ${id}.`);
  console.log(`  identifiers: ${identifier.join(', ') || '(none)'}`);
}
