# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
