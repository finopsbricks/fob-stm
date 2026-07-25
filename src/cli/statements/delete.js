import { confirm } from '@inquirer/prompts';
import { apiGet, apiDelete, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function deleteStatementHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();

  let statement = null;
  try {
    const result = await apiGet(`/api/v1/statements/${encodeURIComponent(id)}`, { credentials: creds });
    statement = result?.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No statement found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Statement: ${statement.file_name ?? id}`);
    if (statement.account_name) console.log(`Account:   ${statement.account_name}`);
    const ok = await confirm({
      message: `Permanently delete statement ${id}? (Use 'archive' instead to keep history.)`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  try {
    await apiDelete(`/api/v1/statements/${encodeURIComponent(id)}`, { credentials: creds });
  } catch (err) {
    if (err instanceof ApiError && err.code === 'HAS_LINKED_TRANSACTIONS') {
      console.error(`${err.message}`);
      console.error(
        `Tip: 'fob-stm statements delete-transactions ${id}' first, or 'fob-stm statements archive ${id}'.`,
      );
      process.exit(1);
    }
    throw err;
  }

  console.log(`Deleted statement ${id}.`);
}
