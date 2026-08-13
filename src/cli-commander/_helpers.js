/**
 * Commander equivalents of src/cli/_helpers.js — prototype only.
 *
 * See docs/wip/commander-prototype.md. The goal is that handlers in
 * src/cli/accounts/*.js run **unmodified**, so everything framework-shaped is
 * absorbed here.
 */

import { resolveCredentials } from '../cli/config-store.js';
import { fobStm } from '../index.js';
import { MAX_ALL_ROWS } from '../http.js';

/**
 * Adapt a yargs-style handler — one merged `argv` — to commander's
 * `(…positionals, opts, cmd)` signature.
 *
 * This is the crux of the port. yargs hands a handler a single object holding
 * positionals *and* options; commander splits them. Merging them back here means
 * every existing handler runs untouched.
 *
 * Positional names come from the command's own declaration (`cmd.registeredArguments`),
 * so `show <id>` yields `{ id }` and `merge <retain-id> <delete-id>` yields
 * `{ retainId, deleteId }` — matching yargs' camelCase conversion.
 *
 * Also wraps in the same clean-exit behaviour `safe()` provides.
 */
export function safe(handler) {
  return async (...args) => {
    const cmd = args[args.length - 1];
    const opts = args[args.length - 2];
    const positionals = args.slice(0, -2);

    const argv = { ...opts };
    const declared = cmd.registeredArguments ?? [];
    declared.forEach((arg, i) => {
      argv[toCamel(arg.name())] = positionals[i];
    });
    // Global options live on the root, not the leaf — merge them in so handlers
    // reading argv.profile keep working.
    let parent = cmd.parent;
    while (parent) {
      Object.assign(argv, parent.opts(), argv);
      parent = parent.parent;
    }

    try {
      await handler(argv);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      if (process.env.FOB_DEBUG) console.error(err.stack);
      process.exit(1);
    }
  };
}

/** `acc-no` → `accNo`, matching yargs' positional/option camelisation. */
function toCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Standard pagination + JSON output options for list commands.
 * Commander has no builder-chain equivalent of yargs' option groups, so these
 * are applied as a function over a Command.
 */
export function paginationOptions(cmd) {
  return cmd
    .option('--page <n>', 'Page number', Number, 1)
    .option('--limit <n>', 'Page size (max 500)', Number, 100)
    .option('--json', 'Output raw JSON');
}

/** Pagination options plus `--all`. */
export function listOptions(cmd) {
  return paginationOptions(cmd).option(
    '--all',
    `Fetch every matching row across all pages (capped at ${MAX_ALL_ROWS}), ignoring --limit/--page`,
  );
}

/** `--json` alone — the most repeated option in the tree. */
export function jsonOption(cmd) {
  return cmd.option('--json', 'Output raw JSON');
}

/**
 * Help formatting for the whole tree.
 *
 * This is what yargs cannot do — it has no formatter API at all, so its command
 * list breaks descriptions mid-word (`fr|om`, `[yyyy-mm-d|d]`).
 *
 * `subcommandTerm` drops commander's default `[options]` suffix. Without that the
 * name column pads to 44 chars, leaving too little room for descriptions to wrap
 * — the same wide-name-column failure yargs has, except here it is fixable.
 *
 * Note commander does **not** inherit `configureHelp()` through `addCommand()`,
 * so this must be applied to each Command in the tree rather than once at the
 * root. That is a real ergonomic wart, and the reason this helper exists.
 */
export function configureTreeHelp(cmd) {
  cmd.configureHelp({
    helpWidth: process.stdout.columns || 92,
    subcommandTerm: (c) => `${c.name()} ${c.usage().replace(/\[options\] ?/, '')}`.trim(),
  });
  for (const child of cmd.commands) configureTreeHelp(child);
  return cmd;
}

export { resolveCredentials, fobStm };
