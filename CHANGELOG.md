# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-08-13

### Changed
- **Argument parsing moved from yargs to commander.** `yargs` is gone from the dependencies;
  `commander` replaces it. Command syntax, flags, arguments and output are unchanged — every
  command you ran before runs the same way. Handlers were not touched at all: an adapter merges
  commander's `(…positionals, opts, cmd)` back into the single `argv` object they already expected,
  so the whole change is confined to the command-tree builders.
- **Help output is substantially more readable.** Subcommand listings now show bare command names
  (`show <id>`) instead of repeating the full path on every row (`fob-stm accounts show <id>`), and
  long descriptions wrap on word boundaries with a hanging indent instead of breaking mid-word
  (`fr|om`, `[yyyy-mm-d|d]`). yargs exposes no help-formatter API, which is what motivated the
  switch. Command aliases now appear in the listing as `remove|rm`, `current|whoami`,
  `profiles|orgs`.
- **Breaking (cosmetic):** for a command that declares no options of its own — e.g.
  `config profiles use <name>` — help now shows an `Options:` heading containing `-h, --help`.
  yargs omitted the heading entirely. Only affects anything parsing help text.

### Added
- Shell completion is now deliberate rather than incidental. `fob-stm completion` prints a
  sourceable bash/zsh script, and `fob-stm --get-yargs-completions <words…>` serves the candidates.
  Completion resolves aliases while descending (`config orgs …` completes like
  `config profiles …`), offers aliases as candidates, and completes long flags once a dash is typed.
  The flag keeps its historical name so the `fob` dispatcher reaches every tool in the family
  through one protocol — `fob stm <TAB>` and `fob-stm <TAB>` both work.

### Fixed
- `--version` / `-v` print the package version again. They were briefly broken during the migration
  (reported `unknown option` while exiting 0) and are now covered by a test.
- Commander's implicit `help [command]` subcommand no longer appears as a row in resource listings.

## [0.6.0] - 2026-08-04

### Changed
- **Breaking:** `transactions`/`statements`/`accounts`/`rules` `list` commands no longer let
  output format decide fetch scope. Bare `--json`/`--csv` now return exactly **one page** (page 1,
  limit 100), same as `table` — they used to silently auto-paginate every matching row (up to
  15,000), so `--limit`/`--page` were accepted but ignored under `--json`/`--csv`. A new `--all`
  flag is the explicit opt-in for fetching every page. `--limit`/`--page` now always mean a page,
  in every format. `--totals` still aggregates over the full matching set, but the *displayed*
  rows keep respecting scope. If a script relied on bare `--json`/`--csv` returning every row, add
  `--all`.
- `--json` output on these commands gains `count` and `truncated` fields so a script can tell how
  many rows came back and whether the 15,000-row cap was hit, without scraping stderr.

## [0.5.0] - 2026-07-31

### Added
- Currency support: transactions and statements now surface each row's account currency.
  `transactions list` shows a `CCY` column by default; `transactions show`,
  `statements show`, and `statements list` (via `--fields currency`) surface it too.
- `--currency <code>` filter on `transactions list` (e.g. `--currency USD`), passed
  through to the API.

### Changed
- `transactions list --totals` now groups sums **by currency** and never sums across
  currencies. The `--totals` JSON output shape changed accordingly, from a flat
  `{ count, inflow, outflow, net }` to `{ by_currency: { <code>: { count, inflow,
  outflow, net } } }`; the table prints one `TOTALS <CCY>` block per currency.

## [0.4.0] - 2026-07-31

### Added
- `getting-started` command that prints an orientation guide tailored for LLM agents.
- `amount-display` setting to render monetary amounts as actual values instead of raw
  milli-units across statements and transactions output.

### Changed
- `--api-url` is now optional and defaults to the hosted origin, so the flag only needs
  to be set when targeting a non-default deployment.

## [0.3.0] - 2026-07-29

First public release, published to npm as `@finopsbricks/fob-stm`.

### Changed
- Package renamed from `@fob/stm` to `@finopsbricks/fob-stm` and published publicly under
  the Apache-2.0 license.

### Added
- `files` allow-list, `publishConfig.access: public`, repository metadata, `LICENSE`, and
  `NOTICE` — the published tarball now ships only `bin/`, `src/`, and docs.
- Public-facing README with install, getting-started, and command reference.

## [0.2.1] - 2026-07-29

### Changed
- Help output: each command's own options now render under `Options:` above a dedicated `Global Options:` group (`--profile`/`--org`, `--help`, `--version`), instead of being interleaved. Help text only — no behavior change.
