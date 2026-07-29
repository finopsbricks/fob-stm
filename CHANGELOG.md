# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
