import { confirm } from '@inquirer/prompts';
import { apiPut, ApiError } from '../../http.js';
import { requireCreds } from '../_helpers.js';

// Metadata fields the CLI lets you set. The API also accepts monetary/date/
// account changes, but those carry fingerprint/dedup implications and are left
// out of v1 (see docs/wip/transactions-edit.md).
const EDITABLE_FIELDS = ['entity', 'category', 'type', 'po', 'comments', 'particulars'];

export async function editTransactionHandler(argv) {
  const creds = requireCreds();
  const ids = String(argv.id)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    throw new Error('No transaction ID given.');
  }

  const body = {};
  for (const field of EDITABLE_FIELDS) {
    if (argv[field] !== undefined) body[field] = argv[field];
  }

  if (Object.keys(body).length === 0) {
    throw new Error(
      'Nothing to update. Pass at least one of --entity, --category, --type, --po, --comments, --particulars.',
    );
  }

  if (!argv.yes) {
    console.log(`About to update ${ids.length} transaction(s):`);
    for (const [key, value] of Object.entries(body)) {
      console.log(`  ${key} → ${value === '' ? '(cleared)' : value}`);
    }
    console.log(`  ids: ${ids.join(', ')}`);
    const ok = await confirm({
      message: `Apply to ${ids.length} transaction(s)?`,
      default: false,
    });
    if (!ok) {
      console.log('Cancelled.');
      return;
    }
  }

  const results = [];
  for (const id of ids) {
    try {
      const res = await apiPut(`/api/v1/transactions/${encodeURIComponent(id)}`, body, {
        credentials: creds,
      });
      results.push({ id, ok: true, data: res?.data ?? {} });
    } catch (err) {
      if (err instanceof ApiError) {
        results.push({ id, ok: false, error: err.message });
      } else {
        throw err;
      }
    }
  }

  if (argv.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  for (const r of results) {
    if (r.ok) {
      const changed = Object.keys(body)
        .map((k) => `${k}=${r.data[k] ?? ''}`)
        .join(', ');
      console.log(`✓ ${r.id}  ${changed}`);
    } else {
      console.log(`✗ ${r.id}  ${r.error}`);
    }
  }

  const ok_count = results.filter((r) => r.ok).length;
  console.log(`\nUpdated ${ok_count}/${results.length}.`);

  if (ok_count < results.length) process.exit(1);
}
