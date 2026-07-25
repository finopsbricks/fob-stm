// @ts-check
import { confirm } from '@inquirer/prompts';
import { ApiError } from '../../http.js';
import { clientFor } from '../_helpers.js';

export async function mergeAccountsHandler(argv) {
  const stm = clientFor();
  const { retainId, deleteId } = argv;

  let retain_account = null;
  let delete_account = null;
  try {
    [retain_account, delete_account] = await Promise.all([
      stm.accounts.get(retainId),
      stm.accounts.get(deleteId),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Retain:  ${retain_account?.name ?? retainId} (${retainId})`);
    console.log(`Delete:  ${delete_account?.name ?? deleteId} (${deleteId})`);
    console.log(
      'This will permanently delete all transactions on the account being merged away, ' +
        're-process its statements onto the retained account, and then delete the account itself. ' +
        'This cannot be undone.',
    );
    const ok = await confirm({
      message: `Merge '${delete_account?.name ?? deleteId}' into '${retain_account?.name ?? retainId}'?`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const summary = await stm.accounts.merge(retainId, deleteId);

  if (argv.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Merged ${deleteId} into ${retainId}.`);
  console.log(`  transactions deleted:  ${summary.transactions_deleted}`);
  console.log(`  statements requeued:   ${summary.statements_requeued}`);
  console.log(`  merged identifiers:    ${(summary.merged_identifiers ?? []).join(', ') || '(none)'}`);
}
