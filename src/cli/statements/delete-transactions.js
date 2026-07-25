import { confirm } from '@inquirer/prompts';
import { apiGet, apiDelete, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function deleteStatementTransactionsHandler(argv) {
  const { id } = argv;
  const creds = requireCreds();

  let statement = null;
  try {
    const result = await apiGet(`/api/v1/statements/${encodeURIComponent(id)}`, {
      searchParams: { fields: 'id,file_name,account_name' },
      credentials: creds,
    });
    statement = result?.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No statement found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  let linkedCount = null;
  try {
    const result = await apiGet('/api/v1/transactions', {
      searchParams: { statement: id, limit: 1 },
      credentials: creds,
    });
    linkedCount = result?.page_context?.total ?? null;
  } catch {
    // non-fatal — count unknown
  }

  if (!argv.yes) {
    console.log(`Statement: ${statement.file_name ?? id}`);
    if (statement.account_name) console.log(`Account:   ${statement.account_name}`);
    if (linkedCount != null) console.log(`Linked transactions: ${linkedCount}`);
    const ok = await confirm({
      message: `Delete all transactions linked to statement ${id}? Statement itself stays. (Re-run with 'retry' to recreate from parsed_data.)`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const result = await apiDelete(`/api/v1/statements/${encodeURIComponent(id)}/transactions`, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const deleted = result?.data?.deleted ?? 0;
  console.log(`Deleted ${deleted} transaction${deleted === 1 ? '' : 's'} from statement ${id}.`);
}
