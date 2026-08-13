/**
 * `fob-stm rules <action>` — commander port of src/cli/rules/index.js.
 *
 * The most demanding resource in the tree: repeatable options, mutually
 * exclusive flags, a per-command argv transform, and a usage example.
 */

import { Command, Option } from 'commander';

import { safe, listOptions, paginationOptions, jsonOption } from './_helpers.js';
import { OPERATORS } from '../cli/rules/_rule-args.js';
import { listRulesHandler } from '../cli/rules/list.js';
import { showRuleHandler } from '../cli/rules/show.js';
import { createRuleHandler } from '../cli/rules/create.js';
import { editRuleHandler } from '../cli/rules/edit.js';
import { runRuleHandler } from '../cli/rules/run.js';
import { previewRuleHandler } from '../cli/rules/preview.js';
import { deleteRuleHandler } from '../cli/rules/delete.js';

export function buildRulesCommand() {
  const rules = new Command('rules').description('Query categorization rules');

  listOptions(
    rules
      .command('list')
      .description('List rules (sorted by priority ASC then created_at DESC; server-side)'),
  )
    .option('--enabled', 'Filter to enabled rules')
    .option('--no-enabled', 'Filter to disabled rules')
    .option('--name <substring>', 'Filter by name substring (case-insensitive)')
    .option(
      '--condition-op <ops>',
      'Filter by condition operator(s), comma-separated (OR-combined, e.g. equals,contains)',
    )
    .option('--condition-field <fields>', 'Filter by condition field name(s), comma-separated (OR-combined)')
    .option('--action-field <fields>', 'Filter by action field name(s), comma-separated (OR-combined)')
    .addOption(
      new Option('--sort-by <column>', 'Sort column (default: priority)').choices([
        'priority',
        'name',
        'created_at',
      ]),
    )
    .addOption(
      new Option('--sort-order <order>', 'Sort direction (default: ASC)').choices([
        'ASC',
        'DESC',
        'asc',
        'desc',
      ]),
    )
    .option(
      '--fields <list>',
      'Columns to show, comma-separated (default: id,name,priority,enabled,conditions_count,actions_count,match_count)',
    )
    .addOption(
      new Option('--format <format>', 'Output format (renders whatever --limit/--page/--all selected)').choices([
        'table',
        'csv',
        'json',
      ]),
    )
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count + enabled count + disabled count')
    .action(safe(listRulesHandler));

  jsonOption(rules.command('show').description('Show a rule by ID').argument('<id>', 'Rule ID')).action(
    safe(showRuleHandler),
  );

  jsonOption(
    rules
      .command('create')
      .description('Create a categorization rule (auto-applies to future uploads)')
      .argument('<name>', 'Rule name')
      // `<v...>` is commander's repeatable form — equivalent to yargs' array: true.
      .option(
        '--match <condition...>',
        `Condition "field:operator:value" (repeatable; ALL must match). Operators: ${OPERATORS.join(', ')}`,
      )
      .option('--set <action...>', 'Action "field=value" (repeatable). Only fills empty fields on apply.')
      .option('--priority <n>', 'Priority (lower = evaluated first; default 50)', Number)
      .option('--description <text>', 'Rule description')
      .option('--rationale <text>', 'Why the rule exists')
      .option('--disabled', 'Create the rule disabled (does not apply)')
      .option('--conditions-json <json>', 'Raw conditions JSON array (overrides --match)')
      .option('--actions-json <json>', 'Raw actions JSON array (overrides --set)')
      .addHelpText(
        'after',
        '\nExample:\n  $ fob-stm rules create "Uber" --match particulars:contains:uber --set entity=Uber \\\n      --set "category=business expenses" --set type=expense',
      ),
  ).action(safe(createRuleHandler));

  jsonOption(
    rules
      .command('edit')
      .description('Edit a rule (--match/--set replace conditions/actions wholesale)')
      .argument('<id>', 'Rule ID')
      .option('--name <name>', 'New name')
      .option('--priority <n>', 'New priority', Number)
      .addOption(new Option('--enable', 'Enable the rule').conflicts('disable'))
      .addOption(new Option('--disable', 'Disable the rule'))
      .option('--description <text>', 'New description')
      .option('--rationale <text>', 'New rationale')
      .option('--match <condition...>', 'Replace conditions: "field:operator:value" (repeatable)')
      .option('--set <action...>', 'Replace actions: "field=value" (repeatable)')
      .option('--conditions-json <json>', 'Raw conditions JSON array (overrides --match)')
      .option('--actions-json <json>', 'Raw actions JSON array (overrides --set)'),
  ).action(
    // yargs used a per-command .middleware() to fold --enable/--disable into a
    // single `enabled`; commander has no per-command middleware, so the same
    // transform runs here before the handler sees argv.
    safe(async (argv) => {
      if (argv.enable) argv.enabled = true;
      if (argv.disable) argv.enabled = false;
      await editRuleHandler(argv);
    }),
  );

  jsonOption(
    rules
      .command('run')
      .description("Apply a rule to existing transactions (default: only type='unknown')")
      .argument('<id>', 'Rule ID')
      .option('--force-all', 'Apply to all matching transactions, not just type=unknown'),
  ).action(safe(runRuleHandler));

  paginationOptions(
    rules
      .command('preview')
      .description(
        "Dry-run a rule — see which transactions it would match, without applying it (default: only type='unknown')",
      )
      .argument('<id>', 'Rule ID'),
  )
    .option('--force-all', 'Preview against all matching transactions, not just type=unknown')
    .action(safe(previewRuleHandler));

  rules
    .command('delete')
    .description('Permanently delete a rule')
    .argument('<id>', 'Rule ID')
    .option('-y, --yes', 'Skip confirmation')
    .action(safe(deleteRuleHandler));

  return rules;
}
