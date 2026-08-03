# List commands silently ignore `--limit`/`--page` in JSON/CSV/totals mode

## Status: NOT STARTED

`list` commands (`transactions`, `statements`, `accounts`, `rules`, `categories`, `entities`) accept
`--limit` and `--page` in every mode, but **silently ignore them** whenever `--json`, `--csv`, or
`--totals` is set — those modes fetch *all* matching rows (auto-paginated, capped at 15 000). A caller
who paginates JSON manually (`--json --page 1`, `--page 2`, …) gets the **identical full result set on
every page**, which reads as "the page never ends" → infinite loop / duplicate processing. This work
makes the ignored-flags behaviour **loud and self-describing** instead of a silent footgun.

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

So JSON/CSV/totals = "the full set for scripting" **by design**. The bug is UX, not data:
1. `--limit`/`--page` are accepted but ignored in these modes, with **no warning**.
2. `--json`'s help is just *"Output raw JSON"* — it never says it returns all rows or ignores paging.
3. The 15 000-row cap (`truncated`) is reported **only to stderr**; the JSON envelope (`{ data }`)
   carries no `count`/`truncated`, so a programmatic consumer can't see the full-set semantics.

**Desired outcome:** the flags either work or announce that they don't, and the JSON envelope is
self-describing — no caller can be lured into a manual-pagination loop again.

## Proposed Solution

Keep the design (JSON/CSV/totals = full set); make it **explicit**. Three layers, low-risk:

1. **Warn on ignored flags (the footgun-killer).** When `--limit` or `--page` is *explicitly* passed
   **and** `needsAllRows`, emit to **stderr**:
   `note: --limit/--page are ignored with --json/--csv/--totals — returning all matching rows (max 15000). Use --format table to paginate.`
   (Only when the user actually set them, so default runs stay quiet.)
2. **Self-describing help text.**
   - `--json`: *"Output raw JSON — all matching rows (max 15000); ignores --limit/--page."*
   - `--limit` / `--page`: append *"(table mode only)."*
3. **Self-describing JSON envelope.** Add `count` and `truncated` alongside `data` (and keep
   `totals` where present), so consumers detect the full-set + cap without scraping stderr:
   `{ "data": [...], "count": 4822, "truncated": false }`.

Centralise (1) — and ideally the envelope shape (3) — in a shared helper (`src/cli/utils/list.js`)
so all six list commands stay consistent rather than each re-implementing it.

**Explicitly out of scope:** making `--json` honour `--limit`/`--page` for real single-page JSON.
That contradicts the "JSON = full set for scripting" contract and the auto-paginate promise; if a
caller wants one page of JSON they can slice locally. Revisit only if a concrete need appears.

## Implementation Phases

### Phase 1: Warn + help text ❌
- [ ] Shared guard: if `(argv.limit != null || argv.page != null) && needsAllRows` → stderr note.
- [ ] Wire into all six list handlers (or the shared `utils/list.js`).
- [ ] Update `--json` / `--limit` / `--page` `describe` strings across the list commands.
- [ ] Tests: assert the note fires for `--json --limit`, is silent without the flags, and that
      `--format table` still paginates.

### Phase 2: Self-describing JSON envelope ❌
- [ ] Add `count` + `truncated` to the `{ data }` payload (all list commands).
- [ ] Tests for the envelope shape; check no downstream consumer assumes exactly `{ data }`.
- [ ] Note the shape in README / help.

### Phase 3: Consistency sweep ❌
- [ ] Confirm identical behaviour across transactions / statements / accounts / rules / categories /
      entities; fold any divergence into the shared helper.

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
