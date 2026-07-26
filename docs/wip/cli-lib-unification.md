# Unify the `fob-stm` CLI and Library on One Shared Resource Layer

## Status: COMPLETE (100%) — all 6 phases done. Shared resource layer is the single source of endpoint truth; both workers rewritten onto `fobStm` (explicit creds, no ambient env); live smoke-run validated against real creds (2026-07-26).

The CLI and the importable library currently re-implement the same endpoints in two
places, so they drift. This refactor introduces a single **resource layer** that owns every
endpoint exactly once; the CLI keeps only its presentation/feedback logic and the library is
exposed as a bound client factory with per-resource namespaces (`stm.accounts.create(...)`).
The promise: *whatever the CLI can do, the library can do — by construction, not by discipline.*

---

> **Parent WIP:** `cli/fob-stm/docs/wip/cli-standards-and-wrappers.md` (Phase 3). This refactor
> **supersedes** that phase's "make `@fob/stm` a superset of `lib-worker-statements`" plan: we are
> rewriting worker consumers (no backward-compat shim), so the drop-in/legacy-env/`/api/v1`-tolerance
> work is dropped. The uncommitted accounts-superset changes (`http.js` legacy-env fallback,
> `client.js` array `getAllAccounts`, `tests/lib/accounts.test.js`) are **rolled into / reverted by**
> this effort.

## Problem Statement

**Current state.** `fob-stm` is a 2-in-1 repo (CLI + importable client) but the two halves share
no data code:

- **The CLI inlines its endpoints.** Each handler hardcodes the path + method:
  `src/cli/accounts/create.js:16` → `apiPost('/api/v1/accounts', body)`,
  `src/cli/accounts/delete.js:35` → `apiDelete('/api/v1/accounts/{id}')`, etc. Data-fetch logic and
  presentation are interleaved in the same file.
- **The library re-declares the same endpoints** in a separate flat file, `src/client.js`
  (`getAccount`, `getAllAccounts`, `updateStatement`, …).
- **Result: drift.** "The CLI does X, so the library does X" is not guaranteed — the two are wired
  independently. `client.js` is also a growing flat file of `getFoo`/`updateFoo` wrappers that scales
  badly and reads nothing like the CRUD-shaped `src/cli/` tree.

**Desired outcome.** One shared, DRY data layer used by both callers; a library ergonomic enough to
use like a lightweight ORM (`stm.accounts.list()`), organised in files that mirror the CLI's CRUD
structure. No drift possible, because there is exactly one definition of each endpoint.

## Proposed Solution

Decisions locked in during brainstorming (2026-07-25):

1. **A shared `src/resources/` layer is the single source of endpoint truth.** Both the CLI and the
   library call it. It is the only layer (besides `http.js`) that knows a path or an HTTP method.
   This is the anti-drift mechanism.

2. **Library = a bound client factory** (chosen over per-call creds / static namespace).
   `fobStm(credentials)` returns an object of resource namespaces with credentials bound once.
   Omitting `credentials` falls back to env. Multi-org = construct one client per org. Functional,
   no classes — namespaces are plain objects of functions.
   ```js
   import { fobStm } from '@fob/stm';
   const stm = fobStm(creds);              // or fobStm() → env default
   const { data, page_context } = await stm.accounts.list({ category: 'bank' });
   const acct = await stm.accounts.get(id);
   await stm.accounts.delete(id);
   const a = fobStm(orgACreds), b = fobStm(orgBCreds);   // multi-org
   ```

3. **Category-based return shapes** (chosen over faithful-envelope-everywhere):
   | Op kind | Method | Returns |
   |---|---|---|
   | single record | `get`, `create`, `update`, `balance`, `retire`, … | the record (unwrapped `.data`) |
   | collection (one page) | `list` | `{ data, page_context }` (CLI needs the meta) |
   | collection (all) | `getAll` | a flat array (auto-paginated) |

4. **One file per resource** (revised 2026-07-25 during the accounts review — reverses the earlier
   folder-per-resource pick). Methods are thin one-line wrappers, so a folder of ~15 single-line
   files was more ceremony than the code earns. Each resource is one file exporting `buildX(ctx)`:
   ```
   src/resources/accounts.js     # buildAccounts(ctx) → the whole namespace
   src/resources/statements.js
   ```
   **Paths are inlined literally** (no `_base.js`/`ROOT` constant): endpoints rarely change, the
   literal reads clearer at the call site, and find-and-replace within one file is trivial —
   avoiding a premature abstraction. One tiny local `unwrap = (r) => r?.data ?? null` helper de-noises
   the repeated single-record unwrap.

5. **Bound-transport (`ctx`) pattern threads creds exactly once.** The factory builds a `ctx`
   (`http.js`'s `apiGet`/`apiPost`/… with creds closed over) and hands it to each `buildX(ctx)`, which
   returns a flat object of `ctx`-closured methods — creds-free, no path knowledge outside the file.
   ```js
   // src/resources/accounts.js
   export function buildAccounts(ctx) {
     return {
       get: (id) => ctx.get(`/api/v1/accounts/${encodeURIComponent(id)}`).then(unwrap),
       list: (params = {}) => ctx.get('/api/v1/accounts', { searchParams: params }),
       // …
     };
   }
   ```

6. **CLI handlers become presentation-only.** They (a) map `argv` → a clean domain object (flag
   names, camelCase→snake_case — a CLI concern), (b) call `stm.<resource>.<action>()`, (c) render
   output / feedback / confirmations / error tips. They obtain a client via a `clientFor(argv)`
   helper (`fobStm(resolveCredentials(argv))`). No handler touches a path or `apiX` again.

7. **No backward-compat.** Workers are being rewritten onto `fobStm`, so we drop the superset
   drop-in signatures, the legacy `FOB_STATEMENTS_*` env fallback, and `/api/v1`-base tolerance.
   Simpler than the superseded plan.

8. **Truncation flag for the CLI `list` bulk path.** `getAll → array` loses `apiGetAll`'s
   `truncated` flag. The CLI derives its "hit the 15000-row cap" warning from
   `rows.length >= MAX_ALL_ROWS` (a constant exported from `http.js`). No second paginator; the
   `getAll → array` contract stays clean.

## Open Questions

- [ ] **`whoami`/identity placement:** root `stm.whoami()` (lean) vs a `stm.identity.whoami()`
      namespace. It is a single non-CRUD call; leaning root method.
- [ ] **Multiword resource namespace names:** `stm.workRecords.create()` / `stm.checks.update()`
      (camelCase JS properties) — confirm naming vs the API's `work-records`/`checks` paths.
- [ ] **Escape hatch:** keep exporting the raw transport primitives (`apiGet`, `ApiError`, …) from
      the package for advanced/one-off use? Leaning yes.

## Implementation Phases

### Phase 1: Transport factory (the `ctx` seam) ✅
- [x] Added `createTransport(credentials)` to `src/http.js` → `{ get, post, put, patch, delete, getAll,
      postForm, getStream, buildUrl }`, each pre-applying `credentials` (undefined ⇒ env default).
- [x] Exported a `MAX_ALL_ROWS` constant (the `apiGetAll` cap) for the CLI truncation heuristic.

### Phase 2: Accounts vertical slice — REVIEW GATE ✅ (reviewed & extended)
The reviewable prototype (one object, end to end) before fanning out.
- [x] `src/resources/accounts.js` — one file, `buildAccounts(ctx)` with the whole namespace (list,
      getAll, get, balance, create, update, setStatus/retire/quarantine/reactivate, delete, merge,
      add/removeIdentifier, recalculateOpeningBalance). Paths inlined; endpoints ported faithfully
      from `src/cli/accounts/*`. (Consolidated from the initial per-action folder during review.)
- [x] `fobStm(creds)` factory in `src/index.js` exposing `accounts` (+ root `whoami`); `clientFor()`
      helper in `src/cli/_helpers.js`. Transport primitives kept as an escape hatch.
- [x] Refactored all 12 `src/cli/accounts/*` handlers to presentation-only (argv→domain mapping +
      `stm.accounts.*` + rendering). No handler holds a path or calls `apiX` anymore.
- [x] Tests: `tests/resources/accounts.test.js` (mock `fetch`, 7 cases); reshaped
      `tests/cli/accounts/list.test.js` to mock the `accounts` namespace. Suite 19/19 green. CLI
      help tree walks; no-creds → clean exit 1.
- [x] **Type-checking + written types (per `engineering-standards` jsdoc notes)**: `jsconfig.json`
      (gradual `checkJs:false`, aligned to the statements app's config), `typecheck` script,
      `typescript` + `@types/node` devDeps. Written types in `src/types/` — `general/` (Credentials,
      Transport plumbing, barrel) and `api/` (Account/AccountBalance response shapes; **`api/` not
      `database/`** — this is an API wrapper, not an app). Client-surface types (`AccountsApi`,
      `StmClient`) co-located with explicit `@returns`. `@ts-check` on the service layer **and**
      `show.js` (proof handler). `npm run typecheck` → 0 errors; tests 19/19.
- [x] **REVIEWED.** Key finding: in `checkJs`, inferred object literals are *expando* (unknown-prop
      access doesn't error) — only **declared** typedefs get real checking. Hence written `AccountsApi`
      + `@returns`, which also makes `tsc` verify the impl matches the type (drift caught). Proven:
      bad method call, bad record field, and impl/type drift all error.

### Phase 3: Fan out remaining resources ✅
Each resource follows the accounts recipe: `src/types/api/<R>.types.js` (response shapes) +
`src/resources/<r>.js` (`@ts-check`, co-located `<R>Api` typedef, `buildX(ctx)` with `@returns`) +
wired into `fobStm`/`StmClient` + `src/cli/<r>/*` handlers reduced to presentation (`@ts-check`).
Fanned out in parallel (one subagent per resource), then integrated + type-checked centrally.
- [x] transactions   [x] categories   [x] entities   [x] reports   [x] rules   [x] statements
- [x] work-records + checks (lib-only namespaces on `fobStm`, no CLI)
- [x] **All handlers `@ts-check`'d; `npm run typecheck` → 0 errors; tests 19/19; all 7 CLI help
      trees wired; no-creds → clean exit 1.** The `?? {}` idiom was dropped everywhere (it created
      `Record | {}`, which fails property access under the declared types); strictNullChecks-off makes
      `Record|null` field access fine. `statements` added `linkedTransactionCount`/`downloadUrl` helpers
      so no handler holds a raw path; upload builds FormData in the handler → `ctx.postForm`, download
      streams in the handler off `ctx.getStream`/`ctx.buildUrl`.

**Behavior changes (intentional, from the category-return model):** `--json` on single-record ops now
prints the unwrapped record (not the `{data}` envelope); `list --json` bulk output drops the
(meaningless) last-page `page_context`; `rules preview` lost its pagination hint (total now =
transactions.length). Dropping `?? {}` means an abnormal null API write-response now throws rather
than printing `undefined`.

### Phase 4: Retire the old library shape ✅
- [x] Deleted `src/client.js`; `src/index.js` exports `fobStm` + transport primitives.
- [x] Superseded accounts-superset changes were reverted back in the Phase-2 commit prep.
- [x] Migrated `_identity.js` onto `fobStm(creds).whoami()`; nothing imports `client.js` anymore.

### Phase 5: Rewrite worker consumers 🔄 (source done; blocked on publish/test)
Rewrote all 16 files onto `fobStm` (worker-sarveda ×3, worker-alex ×13). **Clean cut** (no compat):
- `import { fobStm } from '@fob/stm'`; global-env steps use `fobStm()`, the multi-org AV line uses
  `fobStm(resolveOrgCredentials(org))`. `resolveOrgCredentials` + both `.env.example`s renamed to
  **`FOB_STM_API_*` (origin-only)**; `package.json` deps swapped to `@fob/stm`.
- Return-shape fixes: `get*/balance/create*/updateStatement/updateChecks/runRule` now return the
  record (dropped `.data`); `list`/`getAll` unchanged. `getAllStatementsForAccount(id)` →
  `stm.statements.getAll({ account: id })`; `getAllTransactions(id)` → `stm.transactions.getAll({ accounts: id })`.
- P3_03's `/transactions/search` (no namespace method) uses the transport escape hatch
  `apiPost('/api/v1/transactions/search', …)`; rule-link builders read origin-only `FOB_STM_API_URL`.
- All files syntax-clean; no `@fob/lib-worker-statements` / `FOB_STATEMENTS_` left.

**Publish + push (done):**
- [x] **Published `@fob/stm`** — `github.com/finopsbricks/fob-stm` (private), release **`v0.1.0`**
      (tag `b05f159`). Worker deps confirmed at `github:finopsbricks/fob-stm#v0.1.0`.
- [x] **Pushed all three repos in sequence**: fob-stm (+release), worker-alex (`0bfdb2e`),
      worker-sarveda (`ec8cb1b`). Committed only the migration files (excluded each repo's unrelated
      pre-existing changes).
- [x] **Validated the chain**: `npm install` in both workers resolves `@fob/stm#v0.1.0` from GitHub;
      all 16 migrated step files import cleanly. Lockfiles updated + committed.

**Deploy (workers run locally, not via devops/PM2):**
- [x] worker-alex local `.env` renamed to `FOB_STM_API_*` (origin-only, `/api/v1` stripped), verified
      byte-for-byte. worker-sarveda skipped (its `.env` uses `FOB_TXN_API_*` — creds decision pending).
- [x] **Live smoke-run** — validated a worker-alex step (`resolveAccounts`) against real creds:
      `stmClient()` builds the bound client with all namespaces wired; `stm.accounts.get(account_id)`
      returned the **unwrapped** record (ICICI 651 — real fields, no `{data}` envelope), confirming the
      category-return contract works end-to-end against the live statements API. [tested 2026-07-26]

### Phase 6: Explicit credentials — no ambient env (v0.2.0) ✅
Design follow-up: `fobStm()` reading `process.env.FOB_STM_*` was **ambient configuration** — impure,
imposed env-var names, action-at-a-distance. Switched to **explicit injection**.
- [x] `fobStm({ api_key, api_secret })` required + explicit; the transport never reads `process.env`.
      `api_url` optional, defaults to `https://statements.finopsbricks.com` (`DEFAULT_API_URL`).
- [x] CLI `config.js`: dropped the `FOB_STM_API_*` env branch — resolves purely from profiles
      (`--profile` > `current_org`); env can no longer silently override the active profile.
- [x] Added `transactions.search` so callers don't need the `apiPost` escape hatch.
- [x] worker-alex global steps use a `stmClient()` helper (the one place the worker names its env);
      AV line already injected per-org. Released **`v0.2.0`**; worker dep bumped + reinstalled; typecheck
      clean; steps import cleanly. Commits: fob-stm `f7dc063`, worker-alex `191dcb3`.
- [x] New engineering standard: **[No Ambient Configuration](../../../../alex/engineering-standards/principles/no-ambient-configuration.md)** (`9300730`).

## Related Files

**Being created:**
- `src/resources/<resource>/*.js` — the shared data layer (Phase 2+)
- `src/index.js` — `fobStm` factory (replaces `export * from client.js`)

**Being refactored:**
- `src/http.js` — add `createTransport` + `MAX_ALL_ROWS`
- `src/cli/<resource>/*.js` — reduced to presentation
- `src/cli/_helpers.js` — add `clientFor(argv)`

**Being retired:**
- `src/client.js` — flat `getFoo`/`updateFoo` wrappers, replaced by `resources/`

## Related Notes

- [Parent WIP: CLI Standards & the fob-<tool> Wrapper Family](./cli-standards-and-wrappers.md)
- [WIP Files Pattern](/Users/alex/ec2code/alex/engineering-standards/git-workflow/wip-files.md)
- [Separate Presentation from Logic](/Users/alex/ec2code/alex/engineering-standards/principles/scripting/separate-presentation-from-logic.md)
