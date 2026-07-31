# LLM-Friendly CLI Improvements

## Status: NOT STARTED

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

**⚠️ Audit needed — scaling is currently inconsistent.** Not every resource
treats amounts as milli-units today:

- Milli-unit (÷1000 via `formatAmount`): `transactions` (inflow/outflow/balance),
  `statements` (opening/closing balance), `accounts balance`.
- **No division** (`formatCurrency` used directly): `categories` &
  `entities` aggregates (inflow/outflow), `accounts list` `opening_balance`.

Before wiring the toggle, determine per field whether the API returns milli-units
or already-decimal values, so the toggle scales exactly the fields that are
milli-unit encoded and doesn't double-scale the rest. This may reveal a
pre-existing display bug (accounts/categories/entities under-scaling) worth fixing
alongside — decide whether that's in-scope or a follow-up.

**Monetary vs. non-monetary fields.** Only amount fields get scaled — `count`,
`id`, dates, names must pass through untouched. Enumerate the monetary field set
per resource as part of the audit above.

## Implementation Phases

### Phase 1: Optional --api-url ❌
- [ ] Import `DEFAULT_API_URL` into `src/cli/config/index.js`
- [ ] Drop `demandOption`, add `default: DEFAULT_API_URL`, update `describe`
- [ ] Update README getting-started + add example
- [ ] Test: `config profiles add` works without `--api-url`

### Phase 2: getting-started command ❌
- [ ] Add `src/cli/getting-started.js` handler (print walkthrough)
- [ ] Detect existing profiles; branch message (configured vs. not)
- [ ] Register top-level command in `src/cli/index.js`
- [ ] Reflect optional `--api-url` in printed text
- [ ] Test: output with 0 profiles vs. ≥1 profile

### Phase 3: Amount-display toggle ❌
- [ ] Audit every monetary field: milli-unit vs. already-decimal (resolve the
      formatAmount/formatCurrency inconsistency)
- [ ] Add `settings` section + get/set helpers to `config-store.js`
- [ ] Add `config settings` subcommands (list, set) in `config/index.js`
- [ ] Central scaling helper honoring `amount_display`; default `actual`
- [ ] Apply in `formatAmount`, `raw:` renderers, and inline totals divisions
- [ ] Update README "Output" section documenting the setting
- [ ] Tests: actual vs. raw across table / JSON / CSV; totals; non-monetary
      fields untouched

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
