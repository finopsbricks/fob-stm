// @ts-check
import { clientFor } from '../_helpers.js';

/**
 * Retroactively apply a rule to existing transactions.
 * Default: only transactions with type='unknown'. --force-all: all matches.
 */
export async function runRuleHandler(argv) {
  const stm = clientFor();
  const body = argv.forceAll ? { force_all: true } : {};
  const d = (await stm.rules.run(argv.id, body)) ?? {};

  if (argv.json) {
    console.log(JSON.stringify(d, null, 2));
    return;
  }

  const scope = argv.forceAll ? 'all matching' : "matching + type='unknown'";
  console.log(`Ran rule ${argv.id} (${scope}): matched ${d.matched_count ?? 0}, updated ${d.updated_count ?? 0}.`);
}
