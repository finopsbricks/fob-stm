# LLM-Friendly CLI Improvements

## Status: COMPLETE

Three changes that make `fob-stm` easier for an LLM agent to drive on a user's
behalf: a self-describing `getting-started` command, an optional `--api-url` that
defaults to the hosted origin, and a configurable amount-display mode so agents
stop mis-scaling the integer milli-unit values the API returns.

---

## Problem Statement

The CLI is a "2-in-1" library + CLI often operated by an LLM coding agent. Three
rough edges trip agents up today:

1. **No onboarding entry point.** Setup instructions live only in the README.
   An agent driving the CLI has no in-band way to discover how to configure a
   profile, and no signal telling it to *skip* setup when a profile already
   exists — so it may re-run setup or ask the user for credentials it already has.

2. **`--api-url` is mandatory.** `config profiles add` requires `--api-url` even
   though the library already defaults to `https://statements.finopsbricks.com`
   (`src/http.js` → `DEFAULT_API_URL`). Nearly every user is on the hosted
   instance, so the flag is pure boilerplate the agent must remember to supply.

3. **Raw milli-unit amounts confuse LLMs.** The app stores money as integers
   scaled ×1000 (so `₹1,234.50` is stored as `1234500`) to keep exact
   arithmetic. Human table output already divides by 1000 via `formatAmount()`,
   but `--json` / `--format csv` emit the **raw** integer (the `raw:` column
   renderers pass values through untouched). LLMs reading JSON routinely assume
   the scale factor is 100 (cents) and report values 10× too high. We want a
   config toggle that controls whether amounts are shown as **actual** decimal
   values (default) or **raw** milli-units, applied consistently across table,
   JSON, and CSV.

## Proposed Solution

### 1. `getting-started` command

Add a top-level `fob-stm getting-started` command (registered in
`src/cli/index.js`) that prints the README "Getting started" walkthrough, adapted
for an agent audience. Key additions vs. the README copy:

- **Detect existing profiles first.** The command checks `listProfiles()` /
  `listOrgs()`. If one or more profiles are configured, it says so (naming the
  current profile) and tells the reader setup is already done — skip to running
  commands, and only re-run setup to add another org. If none are configured, it
  prints the full add-a-profile walkthrough.
- The printed text explicitly addresses the LLM ("Before setting up, check for
  existing profiles with `fob-stm config profiles current` — if one is
  configured, setup is complete").
- Reflects the now-optional `--api-url` (change #2): the example omits it.

Open choice: keep it purely informational (print + exit), which is the simplest
and matches how an agent would consume it. No `--json` needed for v1.

### 2. Optional `--api-url` (default to hosted origin)

- In `src/cli/config/index.js`, drop `demandOption: true` from the `api-url`
  option and give it `default: DEFAULT_API_URL` (import from `src/http.js`, the
  single source of truth — do not hardcode the string twice). Update the
  `describe` to note it's optional and show the default.
- `addConfigHandler` (`src/cli/config/add.js`) already forwards `argv.apiUrl`;
  with a yargs default it will always be populated, so `addOrg` keeps storing an
  explicit `api_url`. (Acceptable — keeps stored profiles self-describing. If we
  ever prefer storing `undefined` to inherit the library default, revisit here.)
- Update README "Getting started" + the `config profiles add` example to show
  `--api-url` as optional.

### 3. Amount-display toggle (actual vs. raw)

**Setting storage.** Amount display is a global preference, not per-org, so it
lives in a new top-level `settings` section in `config.yml` (sibling of `orgs` /
`current_org`), not inside a profile.

- Extend `config-store.js`: `loadConfig()` returns `settings` too; add
  `getSetting(key)` / `setSetting(key, value)` (or a small typed
  `getAmountDisplay()` / `setAmountDisplay()`). Default `amount_display` =
  `actual` when unset.
- Expose it via a new `fob-stm config settings` namespace paralleling `profiles`:
  - `config settings list` — show current settings
  - `config settings set amount-display <actual|raw>` — with validation
  - (optionally `config settings get amount-display`)
  Wire into `buildConfigSubcommands` in `src/cli/config/index.js`.

**Applying the setting.** Introduce a single scaling helper that reads the
setting once and is used by every monetary render/raw path:

- `formatAmount(milliUnits)` (`src/cli/utils/format.js`) divides by 1000 when
  `actual`, and shows the raw integer when `raw`.
- The `raw:` renderers for monetary columns (used by JSON/CSV) must also honor
  the setting — currently they pass the stored value straight through. Add a
  scaling helper (e.g. `scaleAmount(v)`) applied in the `raw:` functions for
  monetary fields, OR post-process monetary fields before JSON/CSV emit. Pick one
  approach and apply it uniformly.
- Totals computations that hand-divide by 1000 (`transactions/list.js`
  `renderTotals` does `/ 1000` inline) must go through the same helper so `raw`
  mode is respected there too.

**✅ Audit done (checked the statements app `api/v1/*/route.js`).** The API
scales *per endpoint*, and the CLI already mirrors it correctly — there is **no
pre-existing bug**:

| Endpoint | API returns | CLI display | Correct |
| --- | --- | --- | --- |
| transactions (inflow/outflow/balance) | milli-units (raw) | `formatAmount` ÷1000 | ✅ |
| statements (opening/closing balance) | milli-units (raw) | `formatAmount` ÷1000 | ✅ |
| categories / entities (inflow/outflow) | decimal — API divides ÷1000 | `formatCurrency` | ✅ |
| accounts `opening_balance` | decimal — API divides ÷1000 | `formatCurrency` | ✅ |
| accounts balance (EOD) | decimal — API divides ÷1000 | local formatter | ✅ |
| reports | milli-units (raw) | verbatim JSON dump | ⚠️ unscaled |

**Consequence for the toggle — narrower scope than first assumed.** The
milli-unit integers that confuse LLMs only reach output where the CLII itself
converts milli→decimal, i.e. the **transactions** and **statements** paths that
use `formatAmount`. Everywhere else the API already returns decimals, so those
outputs are unaffected by the toggle (and must NOT be re-scaled).

Semantics chosen: **`amount-display` governs the CLI's own milli-unit
conversion** (the `formatAmount` paths).
- `actual` (default): CLI divides milli-unit fields by 1000 → human decimals in
  *every* view (table, JSON, CSV). This is a behavior change for
  transactions/statements **JSON & CSV**, which currently emit the raw integer.
- `raw`: CLI performs no conversion; transactions/statements amounts pass through
  as the API's raw integers (old JSON/CSV behavior), and tables show the integer.

**In scope (fields the CLI converts via `formatAmount`):**
- `transactions` list/show: inflow, outflow, balance (+ inline `/1000` totals in
  `list.js renderTotals`).
- `statements` list/show/update/extracted: opening_balance, closing_balance,
  and extracted-transaction inflow/outflow/balance.

**Out of scope (do NOT scale — already decimal from the API):** categories,
entities, accounts list/balance. Non-monetary fields (`count`, `id`, dates,
names) are never touched.

**Known limitation:** `reports show` dumps freeform API JSON that is milli-unit
encoded but has no fixed amount-field schema, so the toggle can't cleanly scale
it in v1. Leave reports as-is and note it; revisit if it proves a real pain
point.

**Input flags unaffected.** Write flags like `statements update
--opening-balance 1234.50` always take actual currency units (they
`Math.round(n*1000)` on the way in). The toggle is display-only.

## Implementation Phases

### Phase 1: Optional --api-url ✅
- [x] Import `DEFAULT_API_URL` into `src/cli/config/index.js`
- [x] Drop `demandOption`, add `default: DEFAULT_API_URL`, update `describe`
- [x] Update README getting-started + add example
- [x] Test: `config profiles add` works without `--api-url`

### Phase 2: getting-started command ✅
- [x] Add `src/cli/getting-started.js` handler (print walkthrough)
- [x] Detect existing profiles; branch message (configured vs. not)
- [x] Register top-level command in `src/cli/index.js`
- [x] Reflect optional `--api-url` in printed text
- [x] Test: output with 0 profiles vs. ≥1 profile

### Phase 3: Amount-display toggle ✅
- [x] Audit every monetary field: milli-unit vs. already-decimal (found: no bug;
      CLI already mirrors per-endpoint API scaling — see table above)
- [x] Add `settings` section + get/set helpers to `config-store.js`
      (`getAmountDisplay`/`setAmountDisplay`/`listSettings`)
- [x] Add `config settings` subcommands (list, set) in `config/index.js`
- [x] Central scaling helper honoring `amount_display`; default `actual`
      (`src/cli/utils/amounts.js`, cached per-process)
- [x] Apply in `formatAmount` (table), transactions & statements JSON/CSV `raw`
      paths + full-object JSON dumps, extracted parsed_data, and inline totals
- [x] Update README "Output" section documenting the setting
- [x] Tests: actual vs. raw scaling + formatting; null/zero handling; validation

Notes / deliberate scope limits:
- `reports show` still dumps raw milli-unit JSON (no fixed amount schema) — left
  as a known limitation.
- `statements extracted --raw` (raw_data) is the parser's verbatim payload and is
  intentionally NOT scaled.
- Write flags (e.g. `statements update --opening`) always take actual currency
  units; the toggle is display-only.

## Related Files

- `src/cli/index.js` — top-level command tree; register `getting-started`
- `src/cli/config/index.js` — `--api-url` option; add `config settings` namespace
- `src/cli/config/add.js` — `addConfigHandler` (forwards `apiUrl`)
- `src/cli/config-store.js` — profiles + new `settings` section, get/set helpers
- `src/cli/utils/format.js` — `formatAmount` / new `scaleAmount` helper
- `src/cli/utils/list.js` — `buildColumnSelector` (`render`/`raw` paths)
- `src/cli/transactions/list.js` — monetary columns + inline `/ 1000` totals
- `src/cli/statements/{list,show,update,extracted}.js` — balances
- `src/cli/categories/list.js`, `src/cli/entities/list.js` — aggregates (audit)
- `src/cli/accounts/{list,balance}.js` — opening balance / EOD balance (audit)
- `src/cli/reports/show.js` — raw JSON dump (check for amount fields)
- `src/http.js` — `DEFAULT_API_URL` (single source for the default)
- `README.md` — Getting started, add example, Output section
