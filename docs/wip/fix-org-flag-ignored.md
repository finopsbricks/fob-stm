# Fix `--org` / `--profile` Being Ignored

## Status: IN PROGRESS (~85%)

`fob-stm` silently ignores `--org` and `--profile` and uses `current_org` instead. Line SI in
factory-alex passes `--org alex`, so personal statements have been uploading to the Chisel org.
This work fixes the flag, stops the misrouting and moves the affected statements to `alex`.

---

## Problem Statement

`src/cli/index.js` declares `.option('--profile, --org <name>')`. Commander 15 stores that option
under `org`, but the `preAction` hook reads `opts().profile`, which is always undefined. So
`setOrgOverride()` never runs and `resolveCredentials()` falls through to `current_org`, which is
`chisel` on alex-linux-pc.

Confirmed on 2026-11-05:

- `fob-stm config profiles current --org alex` and `--profile alex` both return Chisel.
- A bare commander test: `--org alex` and `--profile alex` both parse to `{"org":"alex"}`.

The existing test (`tests/config.test.js`, "honors the --org override") calls `setOrgOverride()`
directly, so it never exercises the flag parsing. That is why it passed.

### Affected statements

Of the 12 most recent SI uploads, these 8 are in Chisel. Their `upload-result.json` says
`org: "alex"`, because it records the configured org, not where the file went.

| Workpiece | Statement id | Uploaded (UTC) | File |
|-----------|--------------|----------------|------|
| si-112 | `TXpBHz8gq364` | 2026-10-16 | `115905500131.txt` |
| si-113 | `uznpwkdN5cFV` | 2026-10-24 | `115905500131.txt` |
| si-114 | `bgy2ryM1lZGE` | 2026-10-30 | `115905500131.txt` |
| si-116 | `6PVudor8CG5h` | 2026-11-02 | `Alex_J_Vazhatharayil_31102026_180618640.pdf` |
| si-118 | `TgKpDrAgTTy4` | 2026-11-04 | `Statement_2026MTH10_779523539.pdf` |
| si-119 | `1NjkOOPAHZi0` | 2026-11-04 | `Statement_2026MTH10_568560093.pdf` |
| si-120 | `QeGKOv1t2Mv1` | 2026-11-04 | `Statement_2026MTH10_165562358.pdf` |
| si-121 | `3pOs4BHzH4yr` | 2026-11-05 | `Email_Bank_Statement_xxxx20260189.pdf` |

si-108 to si-111 (up to 2026-10-09) are not in Chisel. Older uploads were not checked. Any
upload after 2026-11-05 12:02 UTC needs adding to this list.

## Proposed Solution

Read `opts().org` in the `preAction` hook, and add a test that goes through `run()` with each flag
so the parsing is covered. Do this before the nginx fix
(`ops/devops/docs/wip/statements-upload-size-limit.md`), because requeuing si-115 and si-117
before this lands sends them to Chisel too.

Don't run `fob-stm config profiles use alex` as a stopgap until `factory-chisel` is checked: it
may rely on the current default.

## Implementation Phases

### Phase 1: Stop the misrouting ✅
- [x] Pausing SI1 not needed: `fob-stm` on alex-linux-pc is linked to this repo, so the fix is
      live there as soon as it is saved
- [x] No uploads since this WIP was written, so the table is complete for recent uploads

### Phase 2: Fix the flag 🔄
- [x] Read `opts().org` in the `preAction` hook in `src/cli/index.js`
- [x] Add a test through `run()` for both `--org` and `--profile`
- [x] Commit from the Mac (`3723ee1`)
- [x] Push (`81fdd84`)
- [ ] Release `fob-stm`
- [x] Confirm `fob-stm config profiles current --org alex` returns the alex org

### Phase 3: Check other callers 🔄
- [x] `fobs stm` is not affected: it is on yargs and its `--org` middleware works
- [ ] Check `ops/bookkeeping` runs since 2026-08-13. These pass `--org` or `--profile`, so they ran
      against `current_org`: `fetch-accounts.js`, `reconcile-period.js`, `analyze-overlaps.mjs`,
      `check-anchor.mjs` (reads) and `label-unknown-transactions.js --apply`, `rename-statement.js`
      (writes). `fetch-statements.js` and the `bookkeeping-alex` jobs need the same check
- [x] All 121 SI uploads checked: 112 in `alex`, 8 in Chisel (the table above), 1 in neither (si-111)

### Phase 4: Move the statements ✅
- [x] Re-uploaded all 8 to `alex`
- [x] Deleted all 8 from Chisel, and the 5 transactions on si-112 and si-114 after confirming
      they matched `alex`
- [x] Recorded the new ids in `upload-result.json`, with the old id in `misrouted_statement_id`

### Phase 5: Confirm ✅
- [x] Confirm the next SI upload lands in `alex` (si-115 and si-117, 2026-11-05)

### Phase 6: Leftovers ✅
- [x] Deleted the empty `ICICI Bank 0131` account (`KCBd1642z3Hb`) from Chisel
- [x] Re-uploaded si-111 to `alex` as `3bZld1hfLQjI`, closing the 2026-10-03 to 2026-10-09 gap

## Related Files

- `src/cli/index.js` - declares the flag; the `preAction` hook has the bug
- `src/cli/config-store.js` - `setOrgOverride()`, `resolveCredentials()`
- `tests/config.test.js` - the override test that skips flag parsing
- `~/ec2code/assemblyline/factories/factory-alex/src/utils/statement-upload.js` - passes `--org`
- `~/ec2code/assemblyline/factories/factory-alex/.orchestrator/stations/SI1__upload_statement.json` - `org: alex`
