// @ts-check
import { confirm } from '@inquirer/prompts';
import { ApiError } from '../../http.js';
import { clientFor } from '../_helpers.js';

export async function deleteRuleHandler(argv) {
  const stm = clientFor();
  const { id } = argv;

  let rule = null;
  try {
    rule = await stm.rules.get(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No rule found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Rule: ${rule?.name ?? id} (priority ${rule?.priority}, enabled: ${rule?.enabled})`);
    const ok = await confirm({
      message: `Permanently delete rule ${id}? (Use 'edit --disable' to keep it but stop it applying.)`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  await stm.rules.delete(id);
  console.log(`Deleted rule ${id}.`);
}
