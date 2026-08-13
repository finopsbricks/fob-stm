/**
 * Subtree builder for `fob-stm entities <action>`.
 */

import { Command } from 'commander';

import { safe } from '../_helpers.js';
import { aggregateListOptions } from '../_aggregate-options.js';
import { listEntitiesHandler } from './list.js';

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
