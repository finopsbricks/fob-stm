// @ts-check
import { formatField, formatDate } from '../utils/format.js';
import { clientFor } from '../_helpers.js';

export async function showRuleHandler(argv) {
  const stm = clientFor();
  const { id } = argv;
  const r = await stm.rules.get(id);

  if (argv.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }

  if (!r) {
    console.error(`No rule found for id: ${id}`);
    process.exit(1);
  }

  const w = 14;
  console.log(formatField('ID', r.id, w));
  console.log(formatField('Name', r.name, w));
  console.log(formatField('Description', r.description, w));
  console.log(formatField('Priority', r.priority, w));
  console.log(formatField('Enabled', r.enabled ? 'yes' : 'no', w));
  console.log(formatField('Created', formatDate(r.created_at), w));

  if (r.conditions != null) {
    console.log('\nConditions:');
    console.log(JSON.stringify(r.conditions, null, 2));
  }
  if (r.actions != null) {
    console.log('\nActions:');
    console.log(JSON.stringify(r.actions, null, 2));
  }
}
