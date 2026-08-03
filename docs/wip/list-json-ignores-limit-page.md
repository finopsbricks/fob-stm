# Separate output format from fetch scope in `list` commands (`--json` shouldn't change pagination)

## Status: NOT STARTED

**Root issue:** `--json` is an *output-format* flag but currently also changes the *business logic* —
it switches the fetch from one page to **all pages**. Format and fetch-scope are two orthogonal
concerns that got collapsed into one flag, so the *same query* returns a *different result set*
depending on how you ask it to be rendered. The visible symptom: `list` commands
(`transactions`, `statements`, `accounts`, `rules`, `categories`, `entities`) accept `--limit`/`--page`
in every mode but **silently ignore them** under `--json`/`--csv`/`--totals` (which fetch all matching
rows, capped at 15 000) — so a manual `--json --page N` loop returns the identical full set every page
→ infinite loop / duplicate processing. This work makes **scope** (`--limit`/`--page`/`--all`) and
**format** (`--json`/`--csv`/`table`) orthogonal, so a format flag only renders and never decides which
rows are fetched.

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
- The same `needsAllRows` pattern is duplicated in every other `*/list.js` handler.

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

**Make scope and format orthogonal.** Two independent axes:
- **Scope** — `--limit` + `--page` (one page; the default is page 1), or `--all` (every page, capped at
  `MAX_ALL_ROWS`). Nothing else changes the row set.
- **Format** — `table` (default) | `--json` | `--csv`. Renders whatever scope selected, nothing more.
- **`--totals`** — a full-set aggregation, orthogonal to both (a partial total is a lie).

Target behaviour once complete:
```
list                          → 1 page, table
list --json                   → 1 page, JSON          (CHANGED from "all rows")
list --all --json             → all pages, JSON        (the explicit full-set fetch)
list --limit 500 --page 2 --json → page 2 of 500, JSON (today: silently ignored)
list --all                    → all pages, table       (guard/confirm on very large sets)
list --totals                 → aggregate over the full matching set
```

**This is a breaking change, so it must be phased — the danger is *silent truncation*.** Flipping
`--json`'s default from all→one-page in one step would quietly cut every existing consumer down to 100
rows. Worse than the current footgun. Migrate instead:

### Phase 1: Orthogonal scope, backward-compatible ❌
- [ ] Add `--all` (fetch every page, capped) — works with any format, decoupled from `--json`/`--csv`.
- [ ] **Honour `--limit`/`--page` under `--json`/`--csv`** when explicitly passed → return that one page.
      Fixes the footgun immediately; back-compatible (no one relies on a flag being ignored).
- [ ] Keep default `--json`/`--csv` (no scope flags) = all rows *for now*, but emit a **deprecation
      note** to stderr: *"defaulting to all rows is deprecated; pass --all for every page or
      --limit/--page for one. The default becomes a single page in vNEXT."*
- [ ] Route all six list commands through a shared scope/format resolver (`src/cli/utils/list.js`).
- [ ] Tests: `--all` fetches all; `--json --limit N` returns one page; deprecation note fires only on
      bare `--json`; `--totals` still full-set.

### Phase 2: Self-describing JSON envelope ❌
- [ ] Add `count` + `truncated` (+ `page_context` where relevant) to the `{ data }` payload, so
      consumers see scope/cap without scraping stderr: `{ "data": [...], "count": N, "truncated": false }`.
- [ ] Update `--json`/`--all`/`--limit`/`--page` `describe` strings + README.

### Phase 3: Flip the default (breaking — major version) ❌
- [ ] `--json`/`--csv` with no scope flags → **one page** (fully orthogonal). `--all` required for the
      full set. Remove the deprecation note.
- [ ] CHANGELOG + migration guide; sweep known consumers (incl. the ops/bookkeeping skills:
      `plan-jobs`, `resolve-statement-overlaps`, `backup-app-state`) to pass `--all`.

## Related Files

- `src/cli/transactions/list.js` — `needsAllRows` branch + JSON emit (`:160-215`)
- `src/cli/statements/list.js`, `src/cli/accounts/list.js`, `src/cli/rules/list.js`,
  `src/cli/categories/list.js`, `src/cli/entities/list.js` — same pattern
- `src/http.js` — `apiGetAll` strips `page`/`limit`, caps at `MAX_ALL_ROWS` (`:238-275`)
- `src/cli/utils/list.js` — candidate home for the shared warn + envelope helper
- `src/cli/*/index.js` — option `describe` strings ("csv/json auto-paginate (max 15000 rows)")

## Discovery note

Surfaced 2026-08-03 while building `resolve-statement-overlaps` in the ops/bookkeeping repo: a
manual `--json --page N` pagination loop against a 4 822-txn account hung, because every page returned
the full set. The consumer was fixed to a single `--json` call; this WIP fixes the CLI-side footgun so
the next consumer isn't caught.
