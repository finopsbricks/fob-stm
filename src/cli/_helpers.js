/**
 * Shared CLI helpers.
 *
 * Two groups live here:
 *  - command-tree helpers (`safe`, the option builders, `configureTreeHelp`),
 *    used by the per-resource builders;
 *  - handler-facing helpers (`validateDateRange`, `requireCreds`, `clientFor`),
 *    used by the handlers themselves and independent of the CLI framework.
 */

import { Command } from 'commander';

import { resolveCredentials } from './config-store.js';
import { fobStm } from '../index.js';
import { MAX_ALL_ROWS } from '../http.js';

/**
 * Adapt a handler taking one merged `argv` to commander's
 * `(…positionals, opts, cmd)` signature, and give it clean-exit behaviour on an
 * unexpected throw (`FOB_DEBUG=1` for the stack).
 *
 * Merging positionals and options back into one object is what lets every
 * handler stay framework-agnostic — they receive the same shape regardless of
 * what parses the command line. Positional names come from the command's own
 * declaration (`cmd.registeredArguments`), camelised the same way option names
 * are, so `merge <retain-id> <delete-id>` yields `{ retainId, deleteId }`.
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
    // Global options live on the root command, not the leaf — merge them down so
    // handlers reading argv.profile keep working. Leaf values win.
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

/** `acc-no` → `accNo`, matching commander's option-name camelisation. */
function toCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Standard pagination + JSON output options for list commands. */
export function paginationOptions(cmd) {
  return cmd
    .option('--page <n>', 'Page number', Number, 1)
    .option('--limit <n>', 'Page size (max 500)', Number, 100)
    .option('--json', 'Output raw JSON');
}

/**
 * Pagination options plus `--all`, for list commands backed by a resource with
 * a `getAll()` (every matching row, capped at MAX_ALL_ROWS). Scope
 * (`--all`/`--limit`/`--page`) is independent of output format — `--json`/
 * `--csv` fetch exactly one page unless `--all` is also passed.
 */
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
 * The `<id>` + `--json` command shape, which recurs ~10× across the tree
 * (`retire`, `archive`, `retry`, …).
 */
export function idJsonCommand(parent, name, description, idDescription, handler) {
  return jsonOption(
    parent.command(name).description(description).argument('<id>', idDescription),
  ).action(safe(handler));
}

/**
 * Help formatting for the whole tree.
 *
 * `subcommandTerm` drops commander's default `[options]` suffix, which would
 * otherwise pad the name column wide enough to leave no room for descriptions to
 * wrap. Aliases are preserved (`remove|rm`), since help is the only place a
 * reader discovers them.
 *
 * `showGlobalOptions` renders the mandated `Options:` above `Global Options:`
 * layout (see the CLI standard's command-grammar note).
 *
 * Commander does **not** inherit `configureHelp()` through `addCommand()`, so
 * this walks the tree rather than being set once at the root.
 */
export function configureTreeHelp(cmd) {
  cmd.configureHelp({
    helpWidth: process.stdout.columns || 92,
    showGlobalOptions: true,
    subcommandTerm: (c) => {
      const name = c.aliases().length ? `${c.name()}|${c.aliases().join('|')}` : c.name();
      return `${name} ${c.usage().replace(/\[options\] ?/, '')}`.trim();
    },
  });
  for (const child of cmd.commands) configureTreeHelp(child);
  return cmd;
}

/** A `Command` with this tree's conventions already applied. */
export function resourceCommand(name, description) {
  return new Command(name).description(description);
}

/**
 * Validate a --from/--to date range using the CLI's own flag names.
 * Presence is enforced by the parser; this checks format and ordering.
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
