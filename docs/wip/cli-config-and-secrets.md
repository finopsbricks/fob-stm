# CLI Config & Secrets — Standard for the `fob-<tool>` Family

## Status: IN PROGRESS (~85%)

Decide how `fob-stm` (and every future `fob-<tool>`) stores config, models multiple accounts, and
manages secrets — grounded in a survey of 14 mature CLIs. Goal: a **simple, secure-enough baseline**
we can ship across 20+ CLIs without slowing releases, plus a **documented upgrade path** to layer in
advanced security (keychain, scoped/short-lived tokens) over time. **Decided (2026-07-25):** the
baseline is plaintext `0600` under a single family root `~/.fob/<tool>/`; encryption and OS-native
dirs are added later as additive, opt-in layers. Credential profiles are managed under a
`config profiles <verb>` namespace (blanket `profiles` object + a per-CLI domain alias like `orgs`),
in a single `config.yml` (no config/credentials split). Profiles cache each org's server-resolved
identity (`org_id`/`org_slug`) via the statements-app `GET /api/v1/whoami` — **shipped end-to-end (G):
endpoint + `getIdentity()` + `profiles add`/`refresh` + enriched `list`, verified live**. Remaining:
`config status`/whoami polish (D). Token lifecycle (C) parked — no strong preference.

---

## Problem Statement

We're building toward 20+ CLIs. Auth/config is the highest-variance, highest-risk part of each one.
Two failure modes to avoid:

- **Over-build:** ship keychain + XDG + token rotation on day one → every new wrapper is a security
  project, releases slow, and users/maintainers face complexity they didn't ask for.
- **Under-build:** ship plaintext-forever with no path forward → we're stuck when a client or an
  audit demands encryption at rest, and retrofitting touches every wrapper.

Today `fob-stm` stores a long-lived api-key/secret per org in plaintext `~/.fob-stm/config.yml`
(`0600`). That's a reasonable baseline (matches aws/doctl/fly), but we've never *decided* it against
the alternatives, and the current standard
([engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md))
documents it without laying out the upgrade path.


## Proposed Solution

**Guiding principle (Alex, 2026-07-25):** optimize for release velocity + low day-one complexity,
and reach strong security by *layering*, not by front-loading. Pick the simplest baseline that is
secure-enough now and does not foreclose the advanced layer.

The research
([docs/wip/cli-industry-research/](./cli-industry-research/README.md)) splits the design into six
dimensions and, for each, separates what's **settled** from what's an **open decision**:

**Settled — adopt as the baseline (we already match all of these):**
1. Precedence `flag > env var > stored config`. Universal across all 14 tools.
2. Profile model = named entity + active pointer + `use`/`switch` + per-command flag. Our
   `org` / `current_org` / `config use` / `--org` is exactly this.
3. One CI env var path that bypasses storage (`FOB_STM_API_*`).
4. `0600` on any plaintext file; never log secrets; `--print-url` builds URLs without creds.

**Decided:**
- **A. Secret storage — DECIDED 2026-07-25.** Baseline = **plaintext `0600`**. Encryption/keychain
  arrives later as **additive, opt-in** layers, never a forced default. The
  [Claude Code hybrid](./cli-industry-research/secret-storage.md#how-claude-code-does-it-the-hybrid-to-copy)
  is the reference implementation: keychain on the laptop → plaintext `0600` fallback where no
  keychain exists → env var for automation, with one storage module choosing per environment.
- **B. Config dir — DECIDED 2026-07-25.** Baseline = home-dir dotdir nested under a single **family
  root**: `~/.fob/<tool>/config.yml` (`0600`), resolved via `os.homedir()` for multi-OS, override
  `FOB_<TOOL>_CONFIG_DIR`. **Not XDG** (Linux-centric, multiplies per-OS branches; a dotdir is one
  deterministic cross-OS path — the reasoning AWS/npm/fly use). Nest under `~/.fob/` so all wrappers
  share one backup/chmod/delete surface. Subdir = the **full binary name**: `~/.fob/fob-stm/`
  (grep / muscle-memory over the `@fob/stm` short name). **No migration** — pre-customer, so the
  legacy `~/.fob-stm` / `~/.fobs` paths and their migration code were removed outright (hard
  refactor). OS-native/XDG dirs remain a possible later opt-in layer. See
  [config-location.md](./cli-industry-research/config-location.md). Note: workers import the client
  and read `FOB_STM_API_*` env — they never touch this dir, so multi-OS here is CLI-only and
  `os.homedir()` covers it. **Implemented in `src/config.js` (2026-07-25).**
- **E. Command surface & profile naming — DECIDED 2026-07-25 (Option A). Implemented 2026-07-25
  (commit `007b2aa`).** Make `config` a **namespace, not an object**, and name the managed object
  explicitly. Fixes the
  ambiguity where `config list` reads as "list settings" but lists orgs.
  - **Canonical object = `profiles`**, family-wide. The standard defines one shape once:
    `fob-<tool> config profiles <list|add|use|remove>`. Precedent: gcloud
    `config configurations list`, kubectl `config get-contexts`, aws `configure list-profiles`.
  - **Per-CLI domain alias** allowed where a domain word is clearer. `fob-stm` adds `orgs` as an
    alias of `profiles` (yargs `.command(['profiles','orgs'], …)`), so both `config profiles list`
    and `config orgs list` work. Future: `fob-email config mailboxes …`, etc.
  - **Why blanket `profiles`:** the stored object is a *credential profile* — a named identity
    (`{api_url,api_key,api_secret}` for stm; `{host,port,user,pass}` for email) that only *maps to*
    an org in stm. "profile" is the honest, portable term; "org" is a domain label that doesn't
    generalize (fob-email has none). Blanket noun → the standard is one sentence and muscle memory
    transfers; alias → domain intuitiveness where it helps. Alias cost ≈ one yargs line.
  - **Verbs** unchanged: `list`, `add <name>`, `use <name>`, `remove <name>` (optional aliases
    `switch`→`use`, `rm`→`remove`). Optional `current` prints the active profile (folds into D).
  - **`list` output** regains what `fobs orgs list` had: current marker `*`, a `NAME` + `API URL`
    table, and a footer `(* = current)  config: <path>`. The footer also answers "which file /
    identity am I on" — **partially resolving D**.
  - **No back-compat** (pre-customer): the flat `config <verb>` commands move under
    `config profiles <verb>` (+ `orgs` alias); the old flat forms are removed.
  - **Feeds the standard:** primarily `engineering-standards/cli/command-grammar.md` (the
    `config <entity> <verb>` shape + "blanket object noun with optional per-CLI domain alias" rule),
    with a pointer from `auth-patterns.md`.
  - **Touch points when implemented:** `src/cli/config/index.js` (nest a `profiles`/`orgs` subtree),
    `src/cli/config/list.js` (table + footer), and the root wiring in `src/cli/index.js`.

**Still open — deferred until the research is read:**
- **C. Token lifecycle.** Whether to push the statements API team for scoped/expiring keys, and/or
  document a manual rotation habit now. API-gated. See
  [token-types-and-lifecycle.md](./cli-industry-research/token-types-and-lifecycle.md).
- **D. Small UX win.** Add `config status` / `whoami` printing active org + resolution source. See
  [profiles-and-switching.md](./cli-industry-research/profiles-and-switching.md).

**The layered roadmap the baseline must preserve:**
- Layer 1 (baseline, now): plaintext `0600`, single module owns storage.
- Layer 2 (opt-in, later): encrypt-file + key-in-keychain (`--use-keyring`), plaintext stays for
  headless/CI.
- Layer 3 (later): keychain-by-default with an explicit insecure escape hatch.
- Independent track: scoped/short-lived tokens — gated on statements-API support, not the CLI.

The one architectural constraint to honor from day one: **keep secret storage behind a single
`config.js` seam** so Layer 2/3 swap in without touching command handlers.

## Open Questions (gate the decision phase)

- [x] **A — secret storage: DECIDED 2026-07-25 — plaintext `0600` baseline; encryption is additive
      and opt-in later** (Claude Code hybrid as reference). Hard constraint carried forward: keep
      secret storage behind the single `config.js` seam so keychain/encryption layers drop in
      without touching command handlers. Low-cost enabler to consider when we next touch `config.js`:
      internally separate secret fields from metadata so a future keychain moves only the secret.
- [x] **B — config dir: DECIDED + DONE 2026-07-25 — `~/.fob/fob-stm/config.yml` (`0600`), family-root
      nested, `os.homedir()` for multi-OS, not XDG, no migration (pre-customer hard refactor).**
      Implemented in `src/config.js`; migration code removed; tests + CLI smoke pass.
- [x] **E — command surface & profile naming: DECIDED 2026-07-25 (Option A) — `config` is a
      namespace; canonical object `profiles` (`config profiles <verb>`) with a per-CLI domain alias
      (`orgs` in fob-stm); `list` regains table + `config: <path>` footer.** Implemented 2026-07-25
      (`007b2aa`); `config profiles`/`orgs` + `rm` alias, table+footer, `listProfiles()`, tests pass.
- [ ] **C — token lifecycle: PARKED 2026-07-25 (no strong opinion).** Not pursuing scoped/expiring
      keys now; revisit if/when the statements API offers them. Manual key rotation stays available
      via `profiles add` replacing creds.
- [ ] **D — `config status`/`whoami`:** in scope for the fob-stm baseline? (Partly covered by E's
      profile-list footer; a dedicated `config profiles current` may still be worth it.)
- [x] **F — one config file vs AWS-style `config`/`credentials` split: DECIDED 2026-07-25 — one
      file.** Keep a single `config.yml`; the metadata↔secret separation lives in the data model (A's
      enabler), and the AWS-style `credentials.yml` only ever appears later as the no-keychain
      fallback of the Layer-2 keychain work. Rationale kept below. Our non-secret data is
      thin (`current_org` + a near-constant `api_url`), so the AWS "share config, hide credentials"
      payoff is ~nil, while two files add sync edge-cases against the low-complexity principle. This
      split *is* the same secret-vs-metadata seam from A — so instead: formalize the metadata↔secret
      separation in the data model now (A's enabler; YAML nests, unlike AWS's INI), and let the
      AWS-style `credentials.yml` (0600) emerge as the **no-keychain fallback of the Layer-2 keychain
      work** (keychain present → secret to keychain; absent → secret to `credentials.yml`; metadata
      always in `config.yml`). See
      [global-vs-project-config.md](./cli-industry-research/global-vs-project-config.md).
- [x] **G — auto-resolve & cache each profile's org identity (`org_id`, `org_slug`): DECIDED
      2026-07-25 (design locked). Server `GET /api/v1/whoami` shipped, and the fob-stm CLI wiring
      SHIPPED 2026-07-25 (`7151257`) — verified live, all 6 profiles resolved.** The
      profile name (`alex`) is a local alias; the `api_key` actually authenticates as a specific org
      (slug `alex`, id `P8nxj0gb9hlF`) that only the server knows. Fetch that identity and store it
      as **non-secret metadata** so the config is self-describing and `config profiles list` shows
      what each profile *really* points at (profile name need not equal org slug). **Locked design:**
      - resolve on `profiles add`; re-sync via `fob-stm config profiles refresh <name>` (one) or
        `fob-stm config profiles refresh --all` (every profile);
      - server is source of truth; cache in the file for display; opportunistically re-sync whenever
        an API response already carries org info;
      - **never block adding creds on a failed identity fetch** — save the profile, warn on stderr,
        fill identity on the next successful call (no network round-trip required to add creds);
      - `api_key`→org binding is stable (`org_id` never changes, `org_slug` only on rename), so
        staleness risk is low and `refresh` covers it.
      Enriches E's list to `NAME | ORG SLUG | ORG ID | API URL`; sits on the metadata side of A/F's
      metadata↔secret separation. Precedent: `aws sts get-caller-identity` (live), `gh` caching the
      user in `hosts.yml` (cached). **Dependency (action, cross-repo): SHIPPED 2026-07-25** — the
      statements app now exposes `GET /api/v1/whoami` → `{ org_id, org_slug, org_name }` for the
      authed key (not scope-gated; any valid key identifies itself), and the shared client core
      (`@fob/lib-worker-statements`) gained `getIdentity(credentials)`. See
      [statements: docs/wip/whoami-endpoint.md](/Users/alex/ec2code/finopsbricks/apps/statements.finopsbricks.com/docs/wip/whoami-endpoint.md).
      **Remaining (fob-stm side, this repo):** wire `getIdentity` into the fob-stm CLI client
      (`src/client.js`), resolve identity on `profiles add`, add `config profiles refresh <name>` /
      `refresh --all`, store `org_id`/`org_slug` as non-secret metadata, enrich the `list` table.
      Until identity is wired in the CLI, `add`/`refresh` store creds without identity and warn.
      Example shape:
      ```yaml
      alex:
        org_id: P8nxj0gb9hlF     # server truth, non-secret
        org_slug: alex           # server truth, non-secret
        api_url: https://statements.finopsbricks.com/
        api_key: fob_stm_…
        api_secret: …
      ```
- [ ] **Whole-family vs fob-stm-first:** decide on fob-stm, then backport to the standard, or design
      the family standard up front? (fob-stm is the reference wrapper — likely decide here first.)

## Implementation Phases

### Phase 1: Research the field ✅
- [x] Survey 14 CLIs across config location, profiles, secrets, precedence, project-split, token
      lifecycle → [tool-matrix.md](./cli-industry-research/tool-matrix.md).
- [x] Write one atomic observation note per decision dimension, each with a **layering view**
      → [cli-industry-research/](./cli-industry-research/README.md).
- [x] Capture the guiding principle and separate settled vs open.

### Phase 2: Digest & decide 🔄
- [ ] Alex reads the six dimension notes; clarify any concepts (keychain, XDG, scope vs expiry).
- [ ] Resolve Open Questions A–D into locked decisions (record each in this doc).
- [ ] Confirm the layered roadmap and the `config.js` seam constraint.

### Phase 3: Baseline standard + fob-stm implementation 🔄
- [x] Added `engineering-standards/cli/config-and-secrets.md` (A, B, F, G) + updated
      `cli/auth-patterns.md` (config path + precedence + cross-link). [eng-std `5c447d8`]
- [x] Updated `engineering-standards/cli/command-grammar.md` with the `config <entity> <verb>`
      shape + blanket-`profiles`-with-domain-alias rule (E); README index + checklist. [eng-std `5c447d8`]
- [x] Apply to `fob-stm` (E): `config profiles`/`orgs` command surface + `list` table/footer +
      `listProfiles()`/`configPath()`. [`007b2aa`]
- [x] Apply to `fob-stm` (G): org-identity caching (`getIdentity`/`setProfileIdentity`),
      `profiles add` resolve-on-add, `profiles refresh <name>`/`--all`, enriched `list`. [`7151257`]
- [ ] Small wins: `config profiles current`; pre-split secret/metadata in the data model (A's enabler).
- [x] **Cross-repo dependency (G): DONE 2026-07-25.** `GET /api/v1/whoami` → `{ org_id, org_slug,
      org_name }` shipped in the statements app; `getIdentity(credentials)` added to the shared
      `@fob/lib-worker-statements` client core.
- [ ] Graduate durable conclusions from `cli-industry-research/` into the standard; archive the raw
      survey.

### Phase 4: Advanced layers (future, opt-in) ❌
- [ ] Layer 2: `--use-keyring` (encrypt file, key in OS keychain) as a copyable module.
- [ ] Token lifecycle track: scoped/expiring keys once the statements API supports them.

## Related Files

- [cli-industry-research/](./cli-industry-research/README.md) — the six dimension notes + tool matrix
- [engineering-standards: cli/auth-patterns.md](/Users/alex/ec2code/alex/engineering-standards/cli/auth-patterns.md) — current standard to refine
- [engineering-standards: cli/project-structure.md](/Users/alex/ec2code/alex/engineering-standards/cli/project-structure.md) — the `config.js` credential-source layer
- [engineering-standards WIP: cli-standards-and-wrappers.md](/Users/alex/ec2code/alex/engineering-standards/docs/wip/cli-standards-and-wrappers.md) — parent family effort (Phase 3 = fob-stm)
- [engineering-standards: cli/config-and-secrets.md](/Users/alex/ec2code/alex/engineering-standards/cli/config-and-secrets.md) — the standard these decisions graduated into
- `finopsbricks/lib/lib-email/docs/wip/cli-config-and-secrets.md` — sibling WIP applying this standard to fob-email
- `src/config.js` — credential store (plaintext `0600`, org model)
- `src/cli/config/` + `src/cli/index.js` — the `config profiles`/`orgs` command surface (E, done)

## Related Notes
- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
- [Knowledge vs Reports](/Users/alex/ec2code/alex/engineering-standards/principles/documentation/knowledge-vs-reports.md)
