// @ts-check
import { resolveConditions, resolveActions, formatCondition, formatAction } from './_rule-args.js';
import { clientFor } from '../_helpers.js';

export async function editRuleHandler(argv) {
  const body = {};

  if (argv.name !== undefined) body.name = argv.name;
  if (argv.description !== undefined) body.description = argv.description;
  if (argv.rationale !== undefined) body.rationale = argv.rationale;
  if (argv.priority !== undefined) body.priority = argv.priority;
  if (argv.enabled !== undefined) body.enabled = argv.enabled;

  // --match / --conditions-json replace the whole conditions array; same for actions.
  const conditions = resolveConditions(argv);
  if (conditions !== undefined) body.conditions = conditions;
  const actions = resolveActions(argv);
  if (actions !== undefined) body.actions = actions;

  if (Object.keys(body).length === 0) {
    throw new Error(
      'Nothing to update. Pass --name, --priority, --enable/--disable, --description, --rationale, --match, or --set.',
    );
  }

  const stm = clientFor();
  const r = await stm.rules.update(argv.id, body);

  if (argv.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  console.log(`Updated rule ${r.id}: ${r.name}`);
  console.log(`  priority: ${r.priority}   enabled: ${r.enabled}`);
  if (body.conditions) {
    console.log(`  when ALL of:`);
    for (const c of r.conditions ?? []) console.log(`    - ${formatCondition(c)}`);
  }
  if (body.actions) {
    console.log(`  then set:`);
    for (const a of r.actions ?? []) console.log(`    - ${formatAction(a)}`);
  }
}
