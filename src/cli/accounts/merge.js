import { confirm } from '@inquirer/prompts';
import { apiGet, apiPost, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function mergeAccountsHandler(argv) {
  const creds = requireCreds();
  const { retainId, deleteId } = argv;

  let retain_account = null;
  let delete_account = null;
  try {
    const [retain_result, delete_result] = await Promise.all([
      apiGet(`/api/v1/accounts/${encodeURIComponent(retainId)}`, { credentials: creds }),
      apiGet(`/api/v1/accounts/${encodeURIComponent(deleteId)}`, { credentials: creds }),
    ]);
    retain_account = retain_result?.data;
    delete_account = delete_result?.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Retain:  ${retain_account.name ?? retainId} (${retainId})`);
    console.log(`Delete:  ${delete_account.name ?? deleteId} (${deleteId})`);
    console.log(
      'This will permanently delete all transactions on the account being merged away, ' +
        're-process its statements onto the retained account, and then delete the account itself. ' +
        'This cannot be undone.',
    );
    const ok = await confirm({
      message: `Merge '${delete_account.name ?? deleteId}' into '${retain_account.name ?? retainId}'?`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const result = await apiPost(`/api/v1/accounts/${encodeURIComponent(retainId)}/merge`, {
    delete_account_id: deleteId,
    confirm: true,
  }, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const summary = result?.data ?? {};
  console.log(`Merged ${deleteId} into ${retainId}.`);
  console.log(`  transactions deleted:  ${summary.transactions_deleted}`);
  console.log(`  statements requeued:   ${summary.statements_requeued}`);
  console.log(`  merged identifiers:    ${(summary.merged_identifiers ?? []).join(', ') || '(none)'}`);
}
