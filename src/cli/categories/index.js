/**
 * Subtree builder for `fob-stm categories <action>`.
 */

import { Command } from 'commander';

import { safe } from '../_helpers.js';
import { aggregateListOptions } from '../_aggregate-options.js';
import { listCategoriesHandler } from './list.js';

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
