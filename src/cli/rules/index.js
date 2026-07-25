import { safe, paginationOptions } from '../_helpers.js';
import { OPERATORS } from './_rule-args.js';
import { listRulesHandler } from './list.js';
import { showRuleHandler } from './show.js';
import { createRuleHandler } from './create.js';
import { editRuleHandler } from './edit.js';
import { runRuleHandler } from './run.js';
import { previewRuleHandler } from './preview.js';
import { deleteRuleHandler } from './delete.js';

export function buildRulesSubcommands(yargs) {
  return yargs
    .usage('$0 rules <action> [options]')
    .command(
      'list',
      'List rules (sorted by priority ASC then created_at DESC; server-side)',
      (yargs) =>
        paginationOptions(yargs)
          .option('enabled', {
            describe: 'Filter by enabled (true | false)',
            type: 'boolean',
          })
          .option('name', {
            describe: 'Filter by name substring (case-insensitive)',
            type: 'string',
          })
          .option('condition-op', {
            describe: 'Filter by condition operator(s), comma-separated (OR-combined, e.g. equals,contains)',
            type: 'string',
          })
          .option('condition-field', {
            describe: 'Filter by condition field name(s), comma-separated (OR-combined)',
            type: 'string',
          })
          .option('action-field', {
            describe: 'Filter by action field name(s), comma-separated (OR-combined)',
            type: 'string',
          })
          .option('sort-by', {
            describe: 'Sort column (default: priority)',
            type: 'string',
            choices: ['priority', 'name', 'created_at'],
          })
          .option('sort-order', {
            describe: 'Sort direction (default: ASC)',
            type: 'string',
            choices: ['ASC', 'DESC', 'asc', 'desc'],
          })
          .option('fields', {
            describe:
              'Columns to show, comma-separated (default: id,name,priority,enabled,conditions_count,actions_count,match_count)',
            type: 'string',
          })
          .option('format', {
            describe: 'Output format. csv/json auto-paginate (max 15000 rows)',
            type: 'string',
            choices: ['table', 'csv', 'json'],
          })
          .option('output', {
            describe: 'Write output to a file instead of stdout (for csv/json)',
            type: 'string',
          })
          .option('totals', {
            describe: 'Show count + enabled count + disabled count',
            type: 'boolean',
          }),
      safe(listRulesHandler),
    )
    .command(
      'show <id>',
      'Show a rule by ID',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Rule ID', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(showRuleHandler),
    )
    .command(
      'create <name>',
      'Create a categorization rule (auto-applies to future uploads)',
      (yargs) =>
        yargs
          .positional('name', { describe: 'Rule name', type: 'string' })
          .option('match', {
            describe:
              `Condition "field:operator:value" (repeatable; ALL must match). Operators: ${OPERATORS.join(', ')}`,
            type: 'string',
            array: true,
          })
          .option('set', {
            describe: 'Action "field=value" (repeatable). Only fills empty fields on apply.',
            type: 'string',
            array: true,
          })
          .option('priority', { describe: 'Priority (lower = evaluated first; default 50)', type: 'number' })
          .option('description', { describe: 'Rule description', type: 'string' })
          .option('rationale', { describe: 'Why the rule exists', type: 'string' })
          .option('disabled', { describe: 'Create the rule disabled (does not apply)', type: 'boolean' })
          .option('conditions-json', { describe: 'Raw conditions JSON array (overrides --match)', type: 'string' })
          .option('actions-json', { describe: 'Raw actions JSON array (overrides --set)', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' })
          .example('$0 rules create "Uber" --match particulars:contains:uber --set entity=Uber --set "category=business expenses" --set type=expense', ''),
      safe(createRuleHandler),
    )
    .command(
      'edit <id>',
      'Edit a rule (--match/--set replace conditions/actions wholesale)',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Rule ID', type: 'string' })
          .option('name', { describe: 'New name', type: 'string' })
          .option('priority', { describe: 'New priority', type: 'number' })
          .option('enable', { describe: 'Enable the rule', type: 'boolean' })
          .option('disable', { describe: 'Disable the rule', type: 'boolean' })
          .option('description', { describe: 'New description', type: 'string' })
          .option('rationale', { describe: 'New rationale', type: 'string' })
          .option('match', { describe: 'Replace conditions: "field:operator:value" (repeatable)', type: 'string', array: true })
          .option('set', { describe: 'Replace actions: "field=value" (repeatable)', type: 'string', array: true })
          .option('conditions-json', { describe: 'Raw conditions JSON array (overrides --match)', type: 'string' })
          .option('actions-json', { describe: 'Raw actions JSON array (overrides --set)', type: 'string' })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' })
          .conflicts('enable', 'disable')
          .middleware((argv) => {
            if (argv.enable) argv.enabled = true;
            if (argv.disable) argv.enabled = false;
          }),
      safe(editRuleHandler),
    )
    .command(
      'run <id>',
      "Apply a rule to existing transactions (default: only type='unknown')",
      (yargs) =>
        yargs
          .positional('id', { describe: 'Rule ID', type: 'string' })
          .option('force-all', {
            describe: 'Apply to all matching transactions, not just type=unknown',
            type: 'boolean',
          })
          .option('json', { describe: 'Output raw JSON', type: 'boolean' }),
      safe(runRuleHandler),
    )
    .command(
      'preview <id>',
      "Dry-run a rule — see which transactions it would match, without applying it (default: only type='unknown')",
      (yargs) =>
        paginationOptions(yargs)
          .positional('id', { describe: 'Rule ID', type: 'string' })
          .option('force-all', {
            describe: 'Preview against all matching transactions, not just type=unknown',
            type: 'boolean',
          }),
      safe(previewRuleHandler),
    )
    .command(
      'delete <id>',
      'Permanently delete a rule',
      (yargs) =>
        yargs
          .positional('id', { describe: 'Rule ID', type: 'string' })
          .option('yes', { describe: 'Skip confirmation', type: 'boolean', alias: 'y' }),
      safe(deleteRuleHandler),
    )
    .demandCommand(1, 'Specify an action: list, show, create, edit, run, preview, delete');
}
