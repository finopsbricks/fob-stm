# Unify the `fob-stm` CLI and Library on One Shared Resource Layer

## Status: IN PROGRESS (~5%) — design decided, accounts prototype next

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

4. **Folder-per-resource, mirroring `src/cli/`** (chosen over one-file-per-resource). Each action is
   its own file, symmetric with the CLI tree:
   ```
   src/resources/accounts/{list,get,get-all,create,update,delete,balance,status,merge,
                           add-identifier,remove-identifier,recalculate-opening-balance}.js
   src/resources/accounts/index.js          # buildAccounts(ctx) → the namespace
   ```

5. **Bound-transport (`ctx`) pattern threads creds exactly once.** The factory builds a `ctx`
   (`http.js`'s `apiGet`/`apiPost`/… with creds closed over) and passes it to each `buildX(ctx)`.
   Action files are pure `(ctx, ...args)` functions — creds-free, testable with a fake `ctx`.
   ```js
   // src/resources/accounts/get.js
   export const get = (ctx, id) => ctx.get(`/api/v1/accounts/${encodeURIComponent(id)}`).then(r => r?.data ?? null);
   // src/resources/accounts/index.js
   export const buildAccounts = (ctx) => ({ get: (id) => get(ctx, id), list: (p) => list(ctx, p), /* … */ });
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

### Phase 1: Transport factory (the `ctx` seam) ❌
- [ ] Add `createTransport(credentials)` to `src/http.js` → `{ get, post, put, patch, delete, getAll,
      postForm, getStream, buildUrl }`, each pre-applying `credentials` (undefined ⇒ env default).
- [ ] Export a `MAX_ALL_ROWS` constant (the `apiGetAll` cap) for the CLI truncation heuristic.

### Phase 2: Accounts vertical slice — REVIEW GATE ❌
The reviewable prototype (one object, end to end) before fanning out.
- [ ] `src/resources/accounts/*` — one file per action + `index.js` `buildAccounts(ctx)`, faithfully
      porting the endpoints currently inlined in `src/cli/accounts/*` (status/merge/identifier/
      recalculate paths lifted from those handlers).
- [ ] `fobStm(creds)` factory in `src/index.js` exposing `accounts` (+ `whoami`); `clientFor(argv)`
      helper in `src/cli/_helpers.js`.
- [ ] Refactor `src/cli/accounts/*` to presentation-only: argv→domain mapping + `stm.accounts.*` +
      rendering. Remove all inline `apiX`/path usage.
- [ ] Tests: data-layer test for `resources/accounts` (mock `fetch`); reshape
      `tests/cli/accounts/list.test.js` to mock the `accounts` namespace instead of the transport.
- [ ] **REVIEW** the pattern before Phase 3.

### Phase 3: Fan out remaining resources ❌
Same pattern for: statements, transactions, rules, reports, categories, entities, work-records,
checks, identity. Each: `resources/<r>/*` + `buildX(ctx)` wired into `fobStm`, then refactor the
matching `src/cli/<r>/*` handlers to presentation-only, with tests.

### Phase 4: Retire the old library shape ❌
- [ ] Delete `src/client.js`; `src/index.js` exports `fobStm` + (decided) transport primitives.
- [ ] Revert the uncommitted accounts-superset changes (legacy env in `http.js`, array
      `getAllAccounts` in `client.js`, `tests/lib/accounts.test.js`) — folded into Phase 2's versions.
- [ ] Update `_identity.js` and any internal importer of `client.js` onto the factory.

### Phase 5: Rewrite worker consumers ❌
Tracked in the parent WIP's "migrate worker consumers" item — now a **rewrite** onto `fobStm`
(worker-alex ×13, worker-sarveda ×3), not a compat shim. Do after the CLI+lib refactor lands.

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
