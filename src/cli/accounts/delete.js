import { confirm } from '@inquirer/prompts';
import { ApiError } from '../../http.js';
import { clientFor } from '../_helpers.js';

export async function deleteAccountHandler(argv) {
  const stm = clientFor();
  const { id } = argv;

  let account = null;
  try {
    account = await stm.accounts.get(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No account found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Account:  ${account?.name ?? id}`);
    if (account?.category) console.log(`Category: ${account.category}`);
    const ok = await confirm({
      message: `Permanently delete account ${id}? (Use 'archive' instead to keep history.)`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  try {
    await stm.accounts.delete(id);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'HAS_LINKED_TRANSACTIONS') {
      console.error(`${err.message}`);
      console.error(
        `Tip: reassign or delete this account's transactions first (e.g. 'fob-stm transactions list --account ${id}'), or 'fob-stm accounts retire ${id}' instead.`,
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(`Deleted account ${id}.`);
}
