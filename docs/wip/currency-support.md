# Currency Support (parity with the statements app)

## Status: NOT STARTED

Bring the CLI to parity with the statements web app on currency: show each
transaction's/statement's currency, format amounts with the right currency, and —
critically — never sum money across currencies in `--totals`. Today the CLI drops
currency entirely and sums inflow/outflow globally, which is wrong for any org
holding more than one currency.

---

## Problem Statement

`fob-stm transactions list` shows INFLOW/OUTFLOW as bare numbers with no currency,
and `--totals` sums them into a single global figure. The web app, by contrast:

- shows amounts with their currency (e.g. `₹500`), and
- splits stats **by currency** — "money is never summed across currencies"
  (`StatsBar`, keyed by `by_currency`).

An org with INR + USD + AED accounts (a real supported scenario) gets a
meaningless cross-currency sum from the CLI today.

### How currency actually works (verified in the statements app)

- **Transactions carry no currency of their own.** The `transactions` table has no
  currency column. Currency lives on the **account** (`accounts.currency`).
- The app resolves currency per row via an **account_id → currency map**, defaulting
  to `'INR'` when an account has none (`a.currency || 'INR'`). See
  `apps/.../transactions/page.jsx` (`getAccountCurrencies`) and its `by_currency`
  stats grouping.
- Amount formatting uses `Intl.NumberFormat('en-IN', { style: 'currency', currency })`
  — the currency **code** drives the symbol automatically; there is no manual
  symbol table (`apps/.../utils/currency/formatCurrency.js`). Stored values are the
  same ×1000 integers we already handle.

### ⚠️ The API question (does this need an API change?)

**The public transactions API does not return currency.** Both
`api/v1/transactions/route.js` and `.../search/route.js` join accounts for only
`['id', 'name']` → `account_id` / `account_name`. There is no `currency` field in
their `PUBLIC_FIELDS`, and the search route accepts no `currency` filter (the web
app filters by resolving accounts→ids in the page layer, not the API).

Two ways forward:

**Option A — resolve currency CLI-side (no API change). ✅ Recommended to ship first.**
- On `transactions list` (and `statements` views), fetch accounts once
  (`stm.accounts.getAll()` already returns `currency`), build an
  `account_id → currency` map defaulting to `'INR'`, and annotate each row.
- Exactly mirrors what the web app does today. Keeps fob-stm shippable on its own,
  no cross-repo coordination.
- Cost: one extra accounts request per transaction/statement command (accounts
  lists are small; cache within the invocation). A `--currency` filter would also
  resolve accounts→ids client-side and pass the existing `accounts` filter.

**Option B — extend the API to expose currency. (Separate repo; propose as follow-up.)**
- In the statements app, add `currency` to the accounts join
  (`attributes: ['id','name','currency']`) and to transactions `PUBLIC_FIELDS`
  as `account_currency`; optionally add a `currency` search filter.
- Cleaner: currency travels with the row in one request, and **importable-library
  consumers** (not just the CLI) benefit. But it lives in
  `apps/statements.finopsbricks.com`, needs deploy + version coordination, and the
  CLI must tolerate older servers that omit the field (fall back to Option A).
- Recommendation: file this against the app repo; once shipped, the CLI prefers
  `account_currency` when present and only falls back to the accounts-map.

## Proposed Solution

Ship **Option A** now; treat **Option B** as an independent server enhancement the
CLI opportunistically uses when available.

### Display

- **New `currency` (CCY) column** for `transactions list` — a plain currency code
  column (like `accounts list` already has `CCY`). Keep amount columns numeric and
  right-aligned; do **not** prefix symbols into the amount cells (mixed-currency
  columns can't align cleanly, and it muddies CSV/JSON). Add to `PUBLIC_FIELDS`
  and the default field set (or at least selectable via `--fields`).
- `transactions show`, `statements show/list/extracted`: surface currency as its
  own field, resolved the same way.
- Reuse a small currency formatter mirroring the app's `Intl.NumberFormat` currency
  style for the human single-value spots (e.g. `accounts balance`), where a symbol
  reads well and there's only one currency in play.

### Totals — must group by currency (the core correctness fix)

- `transactions list --totals` and its JSON `totals` must become **`by_currency`**:
  one inflow/outflow/net bucket per currency, never a cross-currency sum. Mirror
  the app's `by_currency` shape.
- Table rendering: one totals block per currency.

### Interactions

- **amount-display setting** (`actual` / `raw`, already shipped): currency
  formatting must honor it. `actual` → decimals (optionally with symbol/code);
  `raw` → the ×1000 integer, currency shown only as the CCY code (no symbol math).
  Route all amount rendering through the existing `formatAmount` / `scaleMilliAmount`
  so the two features compose.
- **Default currency `'INR'`** whenever an account's currency is missing, matching
  the app.

## Implementation Phases

### Phase 1: Currency resolution (Option A) ❌
- [ ] Helper: fetch accounts once per invocation → `account_id → currency` map
      (default `'INR'`); memoize within the command
- [ ] Annotate transactions/statements rows with resolved currency

### Phase 2: Display ❌
- [ ] Add `currency`/CCY column to `transactions list` (PUBLIC_FIELDS + fields)
- [ ] Surface currency in `transactions show`, `statements show/list/extracted`
- [ ] Currency-aware single-value formatting where a symbol reads well
      (`accounts balance`), honoring the amount-display setting

### Phase 3: Currency-aware totals ❌
- [ ] `--totals` → `by_currency` buckets (table + JSON); never sum across
      currencies
- [ ] Tests: single-currency (unchanged shape) + multi-currency split

### Phase 4: Filtering (optional) ❌
- [ ] `--currency <code>` on `transactions list`, resolved to `accounts` filter
      client-side (mirrors the web app)

### Phase 5: API enhancement (Option B — separate, in the app repo) ❌
- [ ] Propose `account_currency` on transactions API + `currency` filter in
      `apps/statements.finopsbricks.com`
- [ ] CLI prefers `account_currency` when present; falls back to Phase 1 map

## Related Files (this repo)

- `src/cli/transactions/list.js` — columns, JSON/CSV rows, `computeTotals`/`renderTotals`
- `src/cli/transactions/show.js` — single-record fields
- `src/cli/statements/{list,show,extracted}.js` — statement currency
- `src/cli/accounts/{list,balance}.js` — accounts already expose `currency`; reuse
- `src/cli/utils/format.js` — add currency-aware formatting alongside `formatAmount`
- `src/cli/utils/amounts.js` — amount-display mode the currency formatter must honor
- `src/resources/accounts.js` — `getAll()` returns `currency` (the map source)

## Reference (statements app — read-only, do not edit from here)

- `apps/statements.finopsbricks.com/src/app/orgs/[o_id]/transactions/page.jsx`
  — `getAccountCurrencies`, `by_currency` grouping (the canonical behavior)
- `apps/.../src/utils/currency/formatCurrency.js` — `Intl.NumberFormat` currency style
- `apps/.../src/app/api/v1/transactions/search/route.js` — current PUBLIC_FIELDS
  (no currency) → the basis for Option B
