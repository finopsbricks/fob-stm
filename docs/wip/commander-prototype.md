# WIP — Prototyping `fob-stm` on commander

**Status:** in progress, started 2026-08-13
**Goal:** a side-by-side comparison of the same CLI written on yargs and on commander, to decide
which is cleaner and more maintainable *for this codebase* — not in the abstract.
**Parent evaluation:** [yargs-alternatives](../../fob-cli/docs/wip/yargs-alternatives.md)
**Decision this would revisit:** [D1](../../fob-cli/docs/decisions/0001-yargs-as-cli-framework.md)

## Why `fob-stm`

It is a **plain API wrapper** — no local filesystem state, no step discovery, no bin conveyors. The
CLI layer is uniform CRUD over HTTP resources, so a port exercises the framework rather than the
domain. Contrast `fob-worker`, whose CLI is tangled with worker-local concerns and would confound
the comparison.

It is not the *smallest* CLI (`fob-orc` is: 33 commands vs 59), but it is the most *representative*:
eight resources all shaped the same way, which is exactly the repetition where framework ergonomics
show up.

### The port surface is small

Only **12 of 82 source files** import yargs, all of them command-tree builders:

```
src/cli/index.js            56 LOC   root command tree
src/cli/_helpers.js                  safe(), localOptions(), listOptions(), paginationOptions()
src/cli/{accounts,transactions,statements,rules,reports,categories,entities,config}/index.js
```

The eight resource builders total **935 LOC**:

| Builder | LOC |
|---|---|
| `statements/index.js` | 252 |
| `accounts/index.js` | 193 |
| `rules/index.js` | 158 |
| `config/index.js` | 110 |
| `transactions/index.js` | 110 |
| `categories/index.js` | 43 |
| `entities/index.js` | 43 |
| `reports/index.js` | 26 |

Everything else — ~70 files, the handlers in `src/cli/*/`, the client in `src/resources/`, the types —
is **framework-agnostic** and must not change. That is the single most important constraint on this
prototype: *if a handler needs editing, the port is doing something wrong.*

## Scope

**Extended 2026-08-13 to a full migration of all eight resources** (originally `accounts` only), on
the reasoning that one complete CLI is what hardens the pattern for future ones. Existing CLIs stay
on yargs. See [Full migration](#full-migration-all-eight-resources) below.

The original single-resource scope is kept for context:

**Port `accounts` only.** 193 LOC, 13 commands, and it exercises every pattern in the codebase:

| Pattern | Example in `accounts` |
|---|---|
| plain action | `list` |
| required positional | `show <id>` |
| optional positional | `balance <id> [yyyy-mm-dd]` |
| two positionals | `merge <retain-id> <delete-id>` |
| `choices` validation | `--category bank\|credit_card` |
| `default` values | `--status active` |
| `demandOption` | `create --name` |
| shared option group | `accountFieldOptions()` — reused by `create` + `update` |
| alias | `--yes` / `-y` |
| numeric coercion | `--opening 5000.50` |

If commander handles these thirteen cleanly, it handles the other 46 commands.

**Out of scope for the prototype:** the other seven resources, completion (already measured in the
parent WIP — 104 hand-written lines vs 48 generated), and publishing.

## What is being compared

Explicit criteria, agreed before writing code so the comparison is not rationalised afterwards:

| # | Criterion | How it is measured |
|---|---|---|
| 1 | **LOC** | `accounts/index.js` before vs after |
| 2 | **Repetition** | the `localOptions(y.positional('id',…)).option('json',…)` block appears **8×** in the yargs version — does commander reduce it? |
| 3 | **Help output** | side-by-side capture at 92 cols; does commander's `Help` class fix the [hanging-indent / bare-name problems](../../fob-worker/docs/wip/cli-help-readability.md) yargs structurally cannot? |
| 4 | **Handler compatibility** | do handlers run **unmodified**? Commander passes `(args, opts, cmd)`; yargs passes one `argv`. An adapter may be needed — how ugly is it? |
| 5 | **Option grouping** | can `Options:` / `Global Options:` (per [the CLI standard](https://github.com/alexjv89/engineering-standards/blob/main/cli/command-grammar.md)) be reproduced? yargs needs the `localOptions()` hack; commander has `helpGroup()`. |
| 6 | **Strictness** | yargs `.strict()` rejects unknown flags — commander equivalent? |
| 7 | **Middleware** | the root `--profile` → `setOrgOverride()` middleware; commander's `.hook('preAction')`. |
| 8 | **Test survival** | does `tests/help-ordering.test.js` still pass, or does it need rewriting? |

## Hypotheses (recorded before building, to be checked after)

1. **LOC will be roughly a wash.** Both frameworks are builder-chains; the command count dominates.
2. **Commander's help will be visibly better** — that is its documented strength and yargs' documented
   gap.
3. **The handler signature will be the friction point.** `(args, opts, cmd)` vs one merged `argv` is
   the one genuinely incompatible thing, and it touches all 70 otherwise-untouched files unless an
   adapter absorbs it.
4. **kebab-case → camelCase** conversion differs between the two and may silently break handlers that
   read `argv['acc-no']` vs `argv.accNo`.

Hypothesis 3 is the one that decides this. If the adapter is a clean one-liner, migration is
mechanical across all six repos. If it leaks into handlers, the migration cost is the whole 395-command
surface and the answer is "stay."

## Layout

The port lives at `src/cli-commander/` alongside the real `src/cli/`, so both can be run and diffed
in the same checkout. Nothing under `src/cli/` is modified. A throwaway `bin/fob-stm-commander.js`
runs the prototype.

**This is a prototype, not a migration.** It gets deleted or promoted after the comparison — it does
not ship half-done.

> **To run it:** `npm install --no-save commander` first. Commander is deliberately *not* added to
> `package.json` — the prototype must not change what the published package depends on. So
> `bin/fob-stm-commander.js` will fail on a fresh clone until that install is run.

## Findings

Port completed 2026-08-13 against `commander@15.0.0`. Files:
`src/cli-commander/{index,accounts,_helpers}.js`, runner `bin/fob-stm-commander.js`.

### 1. LOC — a modest win, not a landslide

| File | yargs | commander | Δ |
|---|---|---|---|
| `accounts` builder | 193 | 173 | **−20** |
| root `index.js` | 56 | 37 | **−19** |
| `_helpers.js` | 92 | 109 | **+17** |
| **net** | **341** | **319** | **−22 (−6%)** |

Hypothesis 1 (roughly a wash) was **right**. The helpers grew because the argv adapter lives there;
the builders shrank because the repeated `<id>` + `--json` block collapses into one `idCommand()`
helper. Not a reason to switch on its own.

### 2. Handlers run **completely unmodified** — the decisive result

Hypothesis 3 said this would be the friction point. It wasn't. A ~25-line adapter inside `safe()`
merges commander's `(…positionals, opts, cmd)` back into yargs' single `argv`:

```
argv = {"json":true,"yes":true,"retainId":"A1","deleteId":"B2"}
```

Identical to what yargs produces, camelCase and all — positional names come from
`cmd.registeredArguments`, so `merge <retain-id> <delete-id>` yields `retainId`/`deleteId`. Global
options are walked up from parent commands so `argv.profile` still resolves.

Verified end-to-end: `accounts list --limit 3` produces **byte-identical output** through both
binaries, including error formatting and credential resolution. **All 70 non-yargs files, and every
handler, were untouched.**

This is the finding that matters. It means a migration is mechanical and per-resource, not a rewrite
— and it can proceed one resource at a time behind a working CLI.

Hypothesis 4 (kebab→camel breakage) did **not** materialise; commander's `opts()` camelises the same
way (`--acc-no` → `accNo`).

### 3. Help output — commander wins decisively

The problem that started this whole thread. Same commands, 92 columns:

**yargs** (mangled — mid-word breaks, prefix repeated on every row):
```
  fob-stm accounts balance <id> [yyyy-mm-d  Show an account's computed balance a
  d]                                        s of a date (defaults to today)
  fob-stm accounts quarantine <id>          Quarantine an account (suspect data;
                                             hidden from live UI and excluded fr
                                            om reports)
```

**commander** (bare names, hanging indent, word-boundary wrapping):
```
  balance <id> [yyyy-mm-dd]         Show an account's computed balance as of a date
                                    (defaults to today)
  quarantine <id>                   Quarantine an account (suspect data; hidden from live UI
                                    and excluded from reports)
```

Achieved with `configureHelp({ helpWidth, subcommandTerm })`. Both knobs were needed:

- `helpWidth` — commander does not wrap to the terminal by default
- `subcommandTerm` — strips commander's default `[options]` suffix, which otherwise pads the name
  column to 44 chars and re-creates the exact wide-column problem yargs has

The difference is that in commander **it is fixable**. yargs exposes no formatter API at all.

### 4. Where commander is *worse*

Recorded deliberately, since the prototype was run by someone who expected commander to win:

- **`configureHelp()` is not inherited through `addCommand()`.** Setting it on the root does nothing
  for subcommands. A `configureTreeHelp()` recursive walk is needed — a real wart, and the reason the
  helpers file grew.
- **No wrapping by default.** yargs at least wraps out of the box (badly); commander does nothing
  until told.
- **`[options]` in the default term** is actively harmful to layout, and has to be stripped.
- **Option grouping** — initially flagged as the one standard-compliance risk, now **resolved in
  commander's favour.** `configureHelp({ showGlobalOptions: true })` reproduces the mandated layout
  exactly:

  ```
  Options:
    --api-key <k>     API key
    --api-secret <s>  API secret
    -h, --help        display help for command

  Global Options:
    --profile <name>  Use credentials from a specific configured profile
  ```

  That is a documented one-line flag, against yargs' `localOptions()` group-ordering workaround —
  which the CLI standard has to spend two paragraphs of "yargs mechanics" explaining. Commander is
  *better* here, not merely equal.

### 5. Untested in this prototype

- Completion (measured separately in the parent WIP — 104 hand-written lines either way)
- `tests/help-ordering.test.js` — would need rewriting; it asserts yargs' exact help layout
- The other seven resources, notably `statements` (252 LOC, the largest)
- `.conflicts()` (3 uses family-wide) and `--json`-vs-`--format` interactions

## Full migration — all eight resources

Completed 2026-08-13. Every resource ported; `src/cli/` untouched throughout.

| File | Covers | LOC |
|---|---|---|
| `index.js` | root tree, `--profile` hook, `getting-started` | 64 |
| `_helpers.js` | argv adapter, option helpers, tree-wide help config | 130 |
| `accounts.js` | 13 commands | 166 |
| `statements.js` | 14 commands | 200 |
| `rules.js` | 7 commands | 147 |
| `transactions.js` | 3 commands | 73 |
| `config.js` | 3-level tree, aliases | 100 |
| `aggregates.js` | `categories` + `entities` | 65 |
| `reports.js` | 1 command | 27 |

**1083 LOC (yargs, 12 files) → 972 LOC (commander, 9 files) — a 10% reduction.**

The saving is not from commander being terser per-call; it comes from the repetition collapsing.
`idJsonCommand()` replaces ~10 hand-written `<id>` + `--json` blocks, and `categories`/`entities` —
two near-identical 43-LOC files on yargs — merge into one `aggregates.js`.

### Every pattern in the tree ported cleanly

| Pattern | yargs | commander |
|---|---|---|
| repeatable option | `array: true` | `--match <c...>` |
| mutually exclusive | `.conflicts('enable','disable')` | `new Option(…).conflicts('disable')` |
| command aliases | `['remove <name>','rm <name>']` | `.alias('rm')` |
| 3-level nesting | nested builders | `addCommand()` |
| choices on positional | `.positional(…, {choices})` | `new Argument(…).choices()` |
| required option | `demandOption: true` | `.requiredOption()` |
| numeric coercion | `type: 'number'` | `.option(…, Number)` |
| usage example | `.example()` | `.addHelpText('after', …)` |
| strict mode | `.strict()` | `.allowUnknownOption(false)` |
| root middleware | `.middleware()` | `.hook('preAction')` |

Two required a different shape rather than a direct swap:

- **Per-command middleware.** `rules edit` used `.middleware()` to fold `--enable`/`--disable` into
  one `enabled` field. Commander has no per-command hook, so the transform moved into the action
  wrapper. Equivalent, marginally less tidy.
- **Boolean negation.** yargs' `type: 'boolean'` accepts `--no-reviewed` implicitly; commander needs
  `--no-reviewed` declared explicitly alongside `--reviewed`. More verbose, but more honest — the
  negation now appears in `--help`, where before it was only discoverable from prose.

### Verified

- **Runtime parity.** `accounts list`, `transactions list`, `statements list`, `rules list`,
  `config profiles list`, `config settings list` — byte-identical output through both binaries,
  including `config settings list`, which runs fully without credentials.
- **Validation parity.** Conflicts, `choices`, unknown-flag rejection, and missing-required-option all
  behave correctly, with somewhat more specific messages than yargs
  (`option '--format <format>' argument 'bogus' is invalid. Allowed choices are table, csv, json.`
  vs yargs' bare `Invalid values:`).
- **Aliases work** at runtime (`config orgs`, `profiles rm`) and now render in help as
  `remove|rm <name>` — this needed an explicit fix, since the `subcommandTerm` override initially
  dropped them.
- **Option grouping** matches the CLI standard: `Options:` above `Global Options:`, via
  `showGlobalOptions: true`.
- **All 48 existing tests pass** — the port is purely additive.

### Still not done

- `tests/help-ordering.test.js` and the other suites exercise the **yargs** tree. They pass because
  nothing was removed; they do not cover `src/cli-commander/`. Promoting the port means repointing
  them.
- No handler was run against a live API — no profile is configured in this environment, so every
  resource stops at credential resolution. Parity is verified up to that boundary, not past it.
- Completion is not wired for the commander tree.


## Recommendation

**The migration works. Commander is the better fit, and `fob-stm` is now the reference
implementation for new `fob-<tool>` CLIs.**

Evidence, after porting all 59 commands:

1. **Handlers need zero changes.** All ~70 non-yargs files untouched; a ~25-line adapter absorbs the
   entire signature difference. This is what makes the pattern safe to recommend.
2. **Help output is fixed** — bare command names, hanging indent, word-boundary wrapping. The problem
   that started this whole thread, and one yargs structurally cannot solve.
3. **Option grouping** matching the CLI standard is a documented one-liner
   (`showGlobalOptions: true`) rather than yargs' `localOptions()` group-ordering workaround.
4. **10% less code** (1083 → 972), 12 files → 9.
5. **Zero dependencies** vs ~7; ~2× faster cold start.
6. **Every pattern ported** — repeatable options, conflicts, aliases, 3-level nesting, choices on
   positionals, strict mode. Nothing needed a workaround; only two needed a different shape.

Costs, stated plainly:

- Commander's warts are real: `configureHelp()` doesn't inherit through `addCommand()`, it doesn't
  wrap at all by default, and its `[options]` term must be stripped. All are absorbed once in
  `configureTreeHelp()` — exactly what a reference implementation exists to carry.
- Boolean negations must be declared explicitly.
- Per-command middleware has no direct equivalent.

### Path forward

**New `fob-<tool>` CLIs use commander, copying `fob-stm`'s `src/cli-commander/` skeleton.** The
copy-not-package rule makes a mixed family survivable — each CLI already carries its own skeleton, so
"new ones use commander" costs nothing in coordination.

**Existing CLIs stay on yargs.** 395 commands / 803 options across five other repos is not worth
re-typing for a formatting improvement, and a half-migrated family is worse than either end state.
They migrate only if substantially reworked anyway.

### To promote this port to be `fob-stm`'s real CLI

Not done yet — deliberately, since it changes what ships:

1. Add `commander` to `package.json` dependencies (currently installed `--no-save`).
2. Point `bin/cli.js` at `src/cli-commander/`, delete `bin/fob-stm-commander.js`.
3. Repoint the 9 test suites at the commander tree; rewrite `help-ordering.test.js`, which asserts
   yargs' exact layout.
4. Smoke-test against a live profile — **nothing here has been run past credential resolution.**
5. Delete `src/cli/`'s builders, or keep one release cycle as a fallback.
6. Remove `yargs` from dependencies.

### Decisions this implies

Adopting the path above needs a new decision record superseding
[D1](../../fob-cli/docs/decisions/0001-yargs-as-cli-framework.md), and an amendment to the
[CLI standard](https://github.com/alexjv89/engineering-standards/blob/main/cli/command-grammar.md),
whose help section documents yargs mechanics (`localOptions()`, the group-ordering explanation) as if
they were the only option. Both should wait until the port actually ships.
