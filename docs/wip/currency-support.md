# Currency Support (CLI consumer)

## Status: BLOCKED — waiting on the API to expose currency

Thin CLI-side follow-up: once the public API returns each row's currency, show it
and stop summing money across currencies. The real work (deriving/exposing
currency) lives in the API, tracked in the **statements app** repo:
`apps/statements.finopsbricks.com/docs/wip/api-currency-exposure.md`.

Deliberately kept minimal — the CLI is a pure API client, so we do not resolve
currency here (no client-side account→currency map). We just render the
`account_currency` field the API will provide.

---

## Problem Statement

`fob-stm transactions list` shows INFLOW/OUTFLOW with no currency, and `--totals`
sums them into one global figure — wrong for any org with >1 currency (the app's
rule is "money is never summed across currencies"). Currency is an account
attribute the transactions/statements API does not yet return.

## Blocked on

`api-currency-exposure.md` (statements app): adds `account_currency` (default
`INR`) to the transactions + statements `/api/v1` responses. Nothing here can
land until that field ships.

## Proposed Solution (once unblocked)

- Add a `currency` (CCY) column to `transactions list`, sourced from
  `account_currency`; add to `PUBLIC_FIELDS` + selectable `--fields`. Keep amount
  columns numeric/right-aligned — a plain code column, not symbols inline.
- Surface currency in `transactions show` and `statements list/show/extracted`.
- **`--totals` → group by currency** (table + JSON `by_currency`); never sum
  across currencies. This is the real correctness fix.
- Compose with the existing amount-display setting: route amounts through
  `formatAmount` / `scaleMilliAmount` so `raw`/`actual` still work.

## Implementation Phases

### Phase 1: Display ❌ (blocked)
- [ ] `currency`/CCY column on `transactions list` from `account_currency`
- [ ] Currency in `transactions show`, `statements list/show/extracted`

### Phase 2: Currency-aware totals ❌ (blocked)
- [ ] `--totals` → `by_currency` buckets (table + JSON); never cross-currency sum
- [ ] Tests: single-currency (unchanged) + multi-currency split

## Related Files

- `src/cli/transactions/list.js` — columns, JSON/CSV rows, totals
- `src/cli/transactions/show.js`, `src/cli/statements/{list,show,extracted}.js`
- `src/cli/utils/format.js`, `src/cli/utils/amounts.js` — amount-display composition

## Related

- Blocking API work: statements app `docs/wip/api-currency-exposure.md`
