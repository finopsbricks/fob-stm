// @ts-check
import { resolveConditions, resolveActions, formatCondition, formatAction } from './_rule-args.js';
import { clientFor } from '../_helpers.js';

export async function createRuleHandler(argv) {
  const conditions = resolveConditions(argv);
  const actions = resolveActions(argv);

  if (!conditions || conditions.length === 0) {
    throw new Error('A rule needs at least one condition. Use --match "field:operator:value".');
  }
  if (!actions || actions.length === 0) {
    throw new Error('A rule needs at least one action. Use --set "field=value".');
  }

  const body = {
    name: argv.name,
    conditions,
    actions,
  };
  if (argv.description !== undefined) body.description = argv.description;
  if (argv.rationale !== undefined) body.rationale = argv.rationale;
  if (argv.priority !== undefined) body.priority = argv.priority;
  if (argv.disabled) body.enabled = false;

  const stm = clientFor();
  const r = await stm.rules.create(body);

  if (argv.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log(`Created rule ${r.id}: ${r.name}`);
  console.log(`  priority: ${r.priority}   enabled: ${r.enabled}`);
  console.log(`  when ALL of:`);
  for (const c of r.conditions ?? []) console.log(`    - ${formatCondition(c)}`);
  console.log(`  then set:`);
  for (const a of r.actions ?? []) console.log(`    - ${formatAction(a)}`);
  console.log(`\nEnabled rules auto-apply to new transactions on upload. Backfill existing with: fob-stm rules run ${r.id}`);
}
