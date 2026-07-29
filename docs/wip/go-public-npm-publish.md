# Publish `fob-stm` publicly to npm

## Status: EVALUATION

Decide whether `fob-stm` stays private (curl-installable) or goes public on npm under the
`finopsbricks` org, then make the changes to publish. This WIP records the security/secrecy
inspection and the concrete change list. Reference for install UX + packaging: the
already-published `@highlyreco/cli` (`/Users/alex/ec2code/highlyreco-cli`).

---

## Problem Statement

`fob-stm` is a private, unpublished CLI + client library (a "2-in-1": `src/index.js` is an
importable client; `bin/cli.js` is the CLI). We want others to use it. Two distribution paths:

1. Keep it private, install via `curl` (needs a private registry or a hosted install script).
2. Make the repo public and publish to npm under `@finopsbricks/…` (matches `@highlyreco/cli`).

Before choosing, we need to answer: **is there anything worth keeping secret, and are we
exposing anything sensitive?**

## Findings — is there a secret worth protecting?

**No.** `fob-stm` is a thin, well-factored wrapper over a public, authenticated REST API
(`https://statements.finopsbricks.com/api/v1`). Concretely:

- **No proprietary logic.** Every command maps 1:1 to an API endpoint (`src/resources/*`).
  All the business logic lives server-side behind the API. The client just marshals args →
  HTTP → formats output.
- **No embedded secrets.** Grepped the whole tree for keys/tokens/passwords/private keys —
  nothing. Auth is entirely user-supplied `api-key` / `api-secret` headers (`src/http.js`).
- **The only hardcoded host is public:** `DEFAULT_API_URL = https://statements.finopsbricks.com`
  (`src/http.js:41`). That origin is already the public API; exposing it reveals nothing.
- **No internal infra leaked** — no IPs, AWS/S3 buckets, internal hostnames, or DB strings.
- **The endpoint surface is already reachable** by anyone holding an org API key. Publishing
  the client doesn't widen the attack surface; it just documents calls a competitor could
  discover with a proxy in five minutes.

**On the competitive-moat concern:** the moat is the API/product, not the CLI. Any competitor
can regenerate an equivalent wrapper from the public API in an afternoon with an LLM. Keeping
the wrapper private buys ~zero protection and costs us install friction. **Recommendation:
go public + publish to npm.** It's strictly simpler than running a private registry or a
curl install-script, and matches how `@highlyreco/cli` already ships.

## Findings — are we exposing anything sensitive?

Mostly clean, with **two things to fix before shipping**:

1. **⚠️ npm tarball currently leaks `.claude/settings.local.json`.** `package.json` has **no
   `files` allow-list**, so `npm pack --dry-run` bundles everything not gitignored — including
   `.claude/settings.local.json` (local absolute paths like `/Users/alex/…`, internal repo
   names `fob-email` / `worker-alex` / `worker-sarveda` / `cli-fobs` / `engineering-standards`,
   and a long dev command history), plus `.env.example`, `docs/wip/`, `tests/`, `jsconfig.json`,
   `jest.config.cjs`. None are credentials, but it's internal-info disclosure and noise.
   **Fix:** add `"files": ["bin", "src", "README.md"]` (exactly what `@highlyreco/cli` does).
   `.claude/settings.local.json` is **untracked** (not in `git ls-files`), so a public *repo*
   won't leak it — this is an npm-tarball-only problem the `files` field closes.

2. **`docs/wip/cli-lib-unification.md` is git-tracked** → visible if the repo is made public.
   It's internal design notes referencing sibling packages/workers. Not secret, but review
   before flipping the repo public (keep, sanitize, or move it out of the public repo). The
   `files` field already keeps it out of the npm tarball regardless.

**Credential storage at rest** (`~/.fob/fob-stm/config.yml`, mode `0600`, plaintext) is the
documented baseline decision ([[cli-secret-storage-decision]]) and matches norms (aws/gh CLIs).
Not a blocker. Encryption remains additive/opt-in later.

**Git history:** 33 commits. Making a repo public exposes full history. Low risk (no secrets in
the tree today), but scan history for accidental secrets before flipping — see Phase 1.

## Doc/correctness bugs to fix while we're here

The current `README.md` is internal-facing and partly **wrong about the actual command grammar**:

- README shows `fob-stm config add alex …` and `fob-stm whoami`. The real surface (per
  `src/cli/config/index.js` + `src/cli/index.js`) is:
  - `fob-stm config profiles add <name> --api-url … --api-key … --api-secret …`
  - `fob-stm config profiles use <name>`
  - `fob-stm config profiles current` (alias `whoami`) — there is **no** top-level `fob-stm whoami`.
- README says config lives in `~/.fob-stm/config.yml`; code uses `~/.fob/fob-stm/config.yml`
  (`src/cli/config-store.js:19`). Fix the README to match the code.
- README references internal-only context: `engineering-standards/cli/`,
  `@fob/lib-worker-statements` ("Supersedes"/"retired `fobs statements`"), and a `docs/wip`
  link. Strip these from the public README (keep an internal note elsewhere if needed).

## Package-name decision — RESOLVED

Published name: **`@finopsbricks/fob-stm`** (was `@fob/stm`). Package tail matches the
`fob-<tool>` family + the binary name; leaves room for `@finopsbricks/fob-email`, etc. Binary
stays `fob-stm`.

---

## Implementation Phases

### Phase 0: Decisions 🔄
- [x] Go public (repo public + npm publish) — confirmed.
- [x] Published package name: **`@finopsbricks/fob-stm`**.
- [x] `docs/wip/*` → **remove from public repo** before flipping public.
- [ ] Confirm the org grants public access for scoped publishes (or plan `--access public`).
- [ ] Get/confirm the public **API-key creation URL** for the README getting-started
      (e.g. `https://statements.finopsbricks.com/settings/api-keys` — verify it exists).

### Phase 1: Pre-publish safety ❌
- [ ] Add `"files": ["bin", "src", "README.md"]` to `package.json`; re-run `npm pack --dry-run`
      and confirm `.claude/`, `.env.example`, `docs/`, `tests/`, config files are all gone.
- [ ] `git rm -r docs/wip` (keep a copy outside the public repo if still useful internally).
- [ ] Scan full git history for secrets before making the repo public
      (e.g. `git log -p | grep -iE 'secret|api[-_]?key|password|token'`, or trufflehog/gitleaks).

### Phase 2: package.json for publish ❌
- [ ] Rename `name` → chosen scope (e.g. `@finopsbricks/fob-stm`).
- [ ] Add `"publishConfig": { "access": "public" }` (scoped pkgs default to restricted).
- [ ] Add `repository`, `homepage`, `bugs` fields pointing at the (public) GitHub repo.
- [ ] Update `keywords` (add `statements`, `finopsbricks`, `bank-statements`).
- [ ] Bump version for the first public release (e.g. `0.3.0` or `1.0.0`) + CHANGELOG entry.
- [ ] Add a `LICENSE` file (declared MIT; no file present — `@highlyreco/cli` also omits it,
      but adding one is correct for a public repo).

### Phase 3: Public README rewrite ❌ (model on `@highlyreco/cli` README)
- [ ] Lead with `npm install -g @finopsbricks/fob-stm`.
- [ ] Getting-started: create API key → `fob-stm config profiles add <name> --api-url … --api-key … --api-secret …`
      → `fob-stm config profiles use <name>` → verify with `fob-stm config profiles current`.
- [ ] Fix config path to `~/.fob/fob-stm/config.yml` (mode 0600).
- [ ] Correct command grammar (no `config add` shortcut, no top-level `whoami`).
- [ ] Keep the "As a library" section but with the published name; drop internal references
      (`engineering-standards`, `@fob/lib-worker-statements`, docs/wip).
- [ ] Document `--json` / `--format csv` / `--output`, `--profile`/`--org`, `FOB_STM_DEBUG` if any.

### Phase 4: Publish ❌
- [ ] `npm login` under an account that's a member of the `finopsbricks` org.
- [ ] `npm publish` (add `--access public` if publishConfig not honored on first publish).
- [ ] Verify the public tarball contents + a clean `npm install -g` in a scratch dir.
- [ ] Make the GitHub repo public (after Phase 1 history scan).
- [ ] Tag the release / update CHANGELOG `[Unreleased]` → version.

## Related Files

- `package.json` — add `files`, `publishConfig`, repo metadata; rename scope, bump version.
- `README.md` — full public rewrite; fix command grammar + config path.
- `.claude/settings.local.json` — untracked; kept out of npm tarball by the `files` field.
- `docs/wip/cli-lib-unification.md` — tracked internal notes; decide fate for public repo.
- `src/http.js:41` — `DEFAULT_API_URL` (public origin; fine to expose).
- `src/cli/config-store.js:19` — real config path `~/.fob/fob-stm/config.yml`.
- `src/cli/config/index.js`, `src/cli/index.js` — canonical command grammar for the README.
- `/Users/alex/ec2code/highlyreco-cli/{package.json,README.md}` — the packaging/UX reference.
