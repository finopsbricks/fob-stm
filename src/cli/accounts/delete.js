import { confirm } from '@inquirer/prompts';
import { apiGet, apiDelete, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function deleteAccountHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;

  let account = null;
  try {
    const result = await apiGet(`/api/v1/accounts/${encodeURIComponent(id)}`, { credentials: creds });
    account = result?.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No account found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Account:  ${account.name ?? id}`);
    if (account.category) console.log(`Category: ${account.category}`);
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
    await apiDelete(`/api/v1/accounts/${encodeURIComponent(id)}`, { credentials: creds });
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
