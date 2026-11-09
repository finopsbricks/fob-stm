# Fix `accounts balance` ignoring its date

## Status: IN PROGRESS (~80%) — released as 0.9.1 in git; npm publish pending

`fob-stm accounts balance <id> <yyyy-mm-dd>` always returns today's balance. The date never reaches the API.

---

## Problem Statement

`safe()` in `src/cli/_helpers.js` camelises positional names (`yyyy-mm-dd` → `yyyyMmDd`), the same way it does option names. `src/cli/accounts/balance.js` still reads `argv['yyyy-mm-dd']`, gets `undefined`, and falls back to `todayLocal()`. The API (`GET /api/v1/accounts/:id/balance?as_of=`) is fine.

Seen while checking month-end balances for a close: `accounts balance <id> 2026-09-30 --json` returned `as_of_date: <today>`. No other handler reads a hyphenated positional.

## Proposed Solution

Read `argv.yyyyMmDd`. Test through the command itself (`buildAccountsCommand().parseAsync`), not the handler alone: a handler-only test passes the key by hand and can't catch this.

## Implementation Phases

### Phase 1: Fix and test ✅
- [x] `balance.js` reads `argv.yyyyMmDd`
- [x] `tests/cli/accounts/balance.test.js`: the date argument reaches `accounts.balance`; no date means today
- [x] CHANGELOG, version 0.9.1 (test fails without the fix, passes with it; 106 tests, typecheck clean)

### Phase 2: Release 🔄
- [x] Push with tag; Unison to alex-linux-pc
- [ ] `npm publish` (Alex)
- [ ] Delete this WIP

## Related Files

- `src/cli/accounts/balance.js` — the handler
- `src/cli/_helpers.js` — `safe()`, which camelises positional names
- `src/cli/accounts/index.js` — declares `[yyyy-mm-dd]`
