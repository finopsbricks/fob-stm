import { apiPost } from '../../http.js';
import { requireCreds } from '../_helpers.js';

/**
 * Retroactively apply a rule to existing transactions.
 * Default: only transactions with type='unknown'. --force-all: all matches.
 */
export async function runRuleHandler(argv) {
  const creds = requireCreds();
  const body = argv.forceAll ? { force_all: true } : {};
  const result = await apiPost(`/api/v1/rules/${encodeURIComponent(argv.id)}/run`, body, { credentials: creds });

  if (argv.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result?.data ?? {};
  const scope = argv.forceAll ? 'all matching' : "matching + type='unknown'";
  console.log(`Ran rule ${argv.id} (${scope}): matched ${d.matched_count ?? 0}, updated ${d.updated_count ?? 0}.`);
}
