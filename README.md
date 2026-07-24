# @fob/stm

Statements app client **and** the `fob-stm` CLI in one package (a 2-in-1). Import the client in
a worker, or drive the same functions from the terminal. Supersedes `@fob/lib-worker-statements`.

Built to the CLI standard: `engineering-standards/cli/`.

## As a library (workers)

```js
import { getAccounts, getAccountBalance } from '@fob/stm';

// Credentials from FOB_STM_API_* env, or pass an explicit override to reach
// another org from the same process:
const accounts = await getAccounts({ category: 'bank' });
const balance = await getAccountBalance(accountId, '2026-03-31', orgBCredentials);
```

Client functions: accounts, statements, transactions, rules, work-records. Each takes an
optional `credentials` override (`{ api_url, api_key, api_secret }`). See `src/client.js`.

## As a CLI

```bash
fob-stm config add alex --api-url https://statements.finopsbricks.com/ \
  --api-key fob_stm_xxx --api-secret yyy
fob-stm config use alex

fob-stm accounts list
fob-stm accounts list --category bank --status active
fob-stm accounts list --format csv --output accounts.csv
fob-stm accounts show <id>
fob-stm accounts show <id> --json
```

Grammar: `fob-stm <resource> <action> [target] [options]`. Every read command supports `--json`.
`--org <name>` overrides the current org for one command.

### Credentials

Precedence: `--org` flag → `FOB_STM_API_*` env (all three set) → current org in
`~/.fob-stm/config.yml` (mode 0600). The base URL is origin-only; the client adds `/api/v1`.

## Status

Vertical slice: client core complete; CLI covers `config` + `accounts`. Remaining resources
(transactions, statements, rules, reports, categories, entities) fan out next — see
`engineering-standards/docs/wip/cli-standards-and-wrappers.md` (Phase 3).

## Test

```bash
npm install
npm test
```
