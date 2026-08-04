# Separate output format from fetch scope in `list` commands (`--json` shouldn't change pagination)

## Status: COMPLETE

**Root issue:** `--json` is an *output-format* flag but currently also changes the *business logic* —
it switches the fetch from one page to **all pages**. Format and fetch-scope are two orthogonal
concerns that got collapsed into one flag, so the *same query* returns a *different result set*
depending on how you ask it to be rendered. The visible symptom: `list` commands
(`transactions`, `statements`, `accounts`, `rules`) accept `--limit`/`--page`
in every mode but **silently ignore them** under `--json`/`--csv`/`--totals` (which fetch all matching
rows, capped at 15 000) — so a manual `--json --page N` loop returns the identical full set every page
→ infinite loop / duplicate processing. This work makes **scope** (`--limit`/`--page`/`--all`) and
**format** (`--json`/`--csv`/`table`) orthogonal, so a format flag only renders and never decides which
rows are fetched. This is a deliberate breaking change, shipped in one step — no deprecation window,
no dual-behavior transition. The old "format decides scope" behavior was a mistake, not a contract
worth preserving.

---

## Problem Statement

**Repro** (account with 4 822 txns):
```
fob-stm transactions list --account 0UhpwM9gA2g3 --limit 500 --page 1 --json | jq '.data|length'  # 4822
fob-stm transactions list --account 0UhpwM9gA2g3 --limit 500 --page 2 --json | jq '.data|length'  # 4822 (same rows!)
```
Both pages return all 4 822 rows. A script that loops "fetch page N until a page returns `< limit`
rows" never terminates.

**Root cause** — this is *intended* data behaviour, exposed with no signal:
- `src/cli/transactions/list.js:160-166` — `format = argv.json ? 'json' : 'table'`; then
  `needsAllRows = format === 'csv' || format === 'json' || argv.totals`, and when set it calls
  `stm.transactions.getAll(...)` instead of the single-page `.list({ page, limit })`.
- `src/http.js:245-248` (`apiGetAll`) — **explicitly `delete baseParams.page; delete baseParams.limit;`**
  and walks `page_context.has_more` at max page size, capping at `MAX_ALL_ROWS = 15000`.
- The same `needsAllRows` pattern is duplicated in every other `*/list.js` handler (statements,
  accounts, rules).

`categories list`/`entities list` are unaffected — they're pure aggregation endpoints (grouped by
category/entity over a required `--from`/`--to` range) with no `--limit`/`--page`/`getAll` at all
(confirmed in `src/cli/categories/index.js`, `entities/index.js`). Nothing to fix there; excluded below.

So the current contract bundles two orthogonal concerns into format flags:

| | fetch scope (which rows) | render format (how) |
|---|---|---|
| **should be** | `--limit`/`--page`/`--all` | `table` / `--json` / `--csv` |
| **is today** | *also driven by `--json`/`--csv`* (→ all rows) | `--json`/`--csv` |

The design errors, separated:
1. **`--json`/`--csv` decide fetch scope** — a *format* flag silently means "fetch every page." This is
   the root violation: rendering shouldn't change the result set.
2. `--limit`/`--page` are accepted but **silently ignored** in those modes (no warning).
3. `--json`'s help is just *"Output raw JSON"* — never says it returns all rows or ignores paging.
4. The 15 000 cap (`truncated`) goes **only to stderr**; the `{ data }` envelope has no `count`/`truncated`.

Note `--totals` is *not* the same error: a total over a partial page is *wrong*, so `--totals` is an
**aggregation** that legitimately spans the full set (ideally computed server-side). The offender is
**`--json`/`--csv` = format flags masquerading as scope flags.**

**Desired outcome:** scope and format are orthogonal. Format only renders the rows that the scope flags
selected; `--all` is the single, explicit "every page" opt-in; `--limit`/`--page` always mean a page.

## Proposed Solution

**Make scope and format orthogonal, in one step.** No deprecation window: `--json`/`--csv` flip to
one-page-by-default immediately. Existing callers that relied on the old "no scope flags = all rows"
behavior break and need `--all` added — that's the point. This is a CLI contract fix, not a feature; a
half-migrated contract (warn-but-still-wrong) is worse than a clean break plus a CHANGELOG entry.

Two independent axes:
- **Scope** — `--limit` + `--page` (one page; default is page 1), or `--all` (every page, capped at
  `MAX_ALL_ROWS`). Nothing else changes the row set.
- **Format** — `table` (default) | `--json` | `--csv`. Renders whatever scope selected, nothing more.
- **`--totals`** — a full-set aggregation, orthogonal to both (a partial total is a lie).

Target behaviour:
```
list                              → 1 page, table
list --json                       → 1 page, JSON        (BREAKING: was "all rows")
list --all --json                 → all pages, JSON      (the explicit full-set fetch)
list --limit 500 --page 2 --json  → page 2 of 500, JSON  (BREAKING: was silently ignored → all rows)
list --all                        → all pages, table     (guard/confirm on very large sets)
list --totals                     → aggregate over the full matching set
```

## Implementation Phases

### Phase 1: Orthogonal scope + format, shipped as one breaking change ✅
- [x] Add `--all` (fetch every page, capped at `MAX_ALL_ROWS`) — works with any format, decoupled from
      `--json`/`--csv`.
- [x] Remove the `needsAllRows` format-driven branch. `--json`/`--csv` with no scope flags → **one page**
      (page 1, default limit), same as `table`. `--all` is the only way to get every page.
- [x] `--limit`/`--page` always mean "fetch this page," in every format, with no exceptions.
- [x] `--totals` stays a full-set aggregation (already correct) — computed over `--all`'s fetch
      regardless of the scope flags a user passed alongside it.
- [x] Self-describing JSON envelope: `{ data, count, truncated }` (`truncated` only meaningful under
      `--all`), so consumers see scope/cap without scraping stderr.
- [x] Route all four affected list commands (`transactions`, `statements`, `accounts`, `rules`)
      through a shared scope/format resolver in `src/cli/utils/list.js` — replace the
      duplicated `needsAllRows`/`format` boilerplate in each handler, don't just fix it four times.
- [x] Update `--json`/`--all`/`--limit`/`--page` `describe` strings in each `src/cli/*/index.js` +
      README to state the scope/format contract explicitly.
- [x] CHANGELOG entry marking this as a breaking change; bump version accordingly.
- [x] Sweep known internal consumers (ops/bookkeeping skills: `plan-jobs`, `resolve-statement-overlaps`,
      `backup-app-state`) to pass `--all` where they need the full set — done as part of this change,
      not a follow-up. Also caught `identify-transfers`, a fourth consumer with the same pattern that
      wasn't named when this WIP was written.
- [x] Tests: `--all` fetches all pages; bare `--json`/`--csv` return one page; `--json --limit N --page
      M` returns that page; `--totals` still full-set; envelope has `count`/`truncated`. Added coverage
      for all four commands (`statements`/`rules` had no prior list tests at all).

## Related Files

- `src/cli/transactions/list.js` — `needsAllRows` branch + JSON emit (`:160-215`)
- `src/cli/statements/list.js`, `src/cli/accounts/list.js`, `src/cli/rules/list.js` — same pattern
- `src/http.js` — `apiGetAll` strips `page`/`limit`, caps at `MAX_ALL_ROWS` (`:238-275`)
- `src/cli/categories/list.js`, `src/cli/entities/list.js` — out of scope, no pagination flags exist
- `src/cli/utils/list.js` — home for the shared scope/format resolver (already houses
  `buildColumnSelector`, `parseStatus`, `parseArchived`)
- `src/cli/*/index.js` — option `describe` strings ("csv/json auto-paginate (max 15000 rows)")

## Discovery note

Surfaced 2026-08-03 while building `resolve-statement-overlaps` in the ops/bookkeeping repo: a
manual `--json --page N` pagination loop against a 4 822-txn account hung, because every page returned
the full set. The consumer was fixed to a single `--json` call; this WIP fixes the CLI-side footgun so
the next consumer isn't caught.
