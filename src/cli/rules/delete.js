import { confirm } from '@inquirer/prompts';
import { apiGet, apiDelete, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

export async function deleteRuleHandler(argv) {
  const creds = requireCreds();
  const { id } = argv;

  let rule = null;
  try {
    const result = await apiGet(`/api/v1/rules/${encodeURIComponent(id)}`, { credentials: creds });
    rule = result?.data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      console.error(`No rule found for id: ${id}`);
      process.exit(1);
    }
    throw err;
  }

  if (!argv.yes) {
    console.log(`Rule: ${rule.name ?? id} (priority ${rule.priority}, enabled: ${rule.enabled})`);
    const ok = await confirm({
      message: `Permanently delete rule ${id}? (Use 'edit --disable' to keep it but stop it applying.)`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  await apiDelete(`/api/v1/rules/${encodeURIComponent(id)}`, { credentials: creds });
  console.log(`Deleted rule ${id}.`);
}
