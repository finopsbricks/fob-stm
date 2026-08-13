/**
 * `fob-stm categories <action>` and `fob-stm entities <action>` — commander port
 * of src/cli/{categories,entities}/index.js.
 *
 * The two are identical apart from naming, and shared a builder on yargs too
 * (`categoriesEntitiesListOptions`), so they live in one file here.
 */

import { Command, Option } from 'commander';

import { safe } from './_helpers.js';
import { listCategoriesHandler } from '../cli/categories/list.js';
import { listEntitiesHandler } from '../cli/entities/list.js';

/** The shared period-aggregate list flags. */
function aggregateListOptions(cmd, defaultFieldsLabel) {
  return cmd
    .requiredOption('--from <date>', 'Start date (YYYY-MM-DD), required')
    .requiredOption('--to <date>', 'End date (YYYY-MM-DD), required')
    .option('--accounts <ids>', 'Filter to account IDs (comma-separated)')
    .addOption(
      new Option('--type <type>', 'Filter by transaction type').choices([
        'income',
        'expense',
        'asset',
        'liability',
        'transfer',
        'unknown',
      ]),
    )
    .option('--fields <list>', `Columns to show, comma-separated (default: ${defaultFieldsLabel})`)
    .addOption(new Option('--format <format>', 'Output format').choices(['table', 'csv', 'json']))
    .option('--output <path>', 'Write output to a file instead of stdout (for csv/json)')
    .option('--totals', 'Show count + inflow/outflow sums over all matching transactions');
}

export function buildCategoriesCommand() {
  const categories = new Command('categories').description('Query category aggregates (read-only)');

  aggregateListOptions(
    categories
      .command('list')
      .description(
        'List categories with period-aggregated count and inflow/outflow (read-only; mirrors the Categories page)',
      ),
    'category,type,count,inflow,outflow',
  ).action(safe(listCategoriesHandler));

  return categories;
}

export function buildEntitiesCommand() {
  const entities = new Command('entities').description('Query entity aggregates (read-only)');

  aggregateListOptions(
    entities
      .command('list')
      .description(
        'List entities with period-aggregated count and inflow/outflow (read-only; mirrors the Entities page)',
      ),
    'entity,type,count,inflow,outflow',
  ).action(safe(listEntitiesHandler));

  return entities;
}
