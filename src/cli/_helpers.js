/**
 * Shared yargs helpers.
 */

import { resolveCredentials } from './config-store.js';
import { fobStm } from '../index.js';

/**
 * Wrap a handler so unexpected exceptions exit cleanly without a stack trace.
 * Set FOB_DEBUG=1 to see the full stack.
 */
export function safe(handler) {
  return async (argv) => {
    try {
      await handler(argv);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      if (process.env.FOB_DEBUG) console.error(err.stack);
      process.exit(1);
    }
  };
}

/** Standard pagination + JSON output options for list commands. */
export function paginationOptions(yargs) {
  return yargs
    .option('page', { describe: 'Page number', type: 'number', default: 1 })
    .option('limit', { describe: 'Page size (max 500)', type: 'number', default: 100 })
    .option('json', { describe: 'Output raw JSON', type: 'boolean' });
}

/**
 * Validate a --from/--to date range using the CLI's own flag names.
 * Presence is enforced by yargs; this checks format and ordering.
 */
export function validateDateRange({ from, to }) {
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !DATE_RE.test(from)) throw new Error('--from must be in YYYY-MM-DD format');
  if (to && !DATE_RE.test(to)) throw new Error('--to must be in YYYY-MM-DD format');
  if (from && to && from > to) throw new Error('--from must be before or equal to --to');
}

// Print the credential-source hint at most once per invocation.
let hintPrinted = false;

/**
 * Resolve the current command's credentials from the CLI config, printing a
 * one-time hint to stderr about which identity is in use. Handlers pass the
 * returned object to client functions as the `credentials` override.
 */
export function requireCreds() {
  const creds = resolveCredentials();
  if (!hintPrinted) {
    console.error(`(using statements credentials from ${creds.source})`);
    hintPrinted = true;
  }
  return creds;
}

/**
 * Build a credential-bound `fobStm` client for the current command — the same
 * client workers construct, so a handler exercises the exact library path.
 * Prints the one-time credential-source hint via requireCreds().
 */
export function clientFor() {
  return fobStm(requireCreds());
}
