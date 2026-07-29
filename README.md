# @finopsbricks/fob-stm

Command-line client **and** importable library for the [FinOpsBricks Statements](https://statements.finopsbricks.com)
API — a 2-in-1. Drive statements, accounts, transactions, rules and reports from your terminal,
or import the same functions into your own code.

```bash
npm install -g @finopsbricks/fob-stm
```

## Getting started

1. Create an API key for your org at
   `https://statements.finopsbricks.com/orgs/<your-org>/settings/apikeys` — copy the key and
   secret (the secret is shown once).
2. Add a profile:

   ```bash
   fob-stm config profiles add myorg \
     --api-url https://statements.finopsbricks.com/ \
     --api-key fob_stm_xxxxxxxxxxxx \
     --api-secret yyyyyyyyyyyyyyyy
   ```

3. Confirm it works:

   ```bash
   fob-stm config profiles current
   ```

## Usage

```
fob-stm <resource> <action> [target] [options]
```

A grammar like `gh`/`docker`: a resource, an action, an optional target, then options. Run
`fob-stm --help`, `fob-stm <resource> --help`, or `fob-stm <resource> <action> --help` at any
level. Every read command supports `--json`.

### Profiles

Credentials live in `~/.fob/fob-stm/config.yml` (mode `0600`). Multiple profiles are supported —
each maps to one Statements org. Switch the active one with `use`, or override per-command with
`--profile` (alias `--org`).

```bash
fob-stm config profiles list
fob-stm config profiles use myorg
fob-stm config profiles current          # alias: whoami
fob-stm config profiles refresh --all    # refresh cached org identity from the server
fob-stm config profiles remove myorg
fob-stm --profile staging accounts list  # one-off override
```

### Accounts

```bash
fob-stm accounts list
fob-stm accounts list --category bank --status active
fob-stm accounts show <id>
fob-stm accounts balance <id> 2026-03-31
```

### Transactions

```bash
fob-stm transactions list --account <id> --from 2026-01-01 --to 2026-03-31
fob-stm transactions show <id>
```

### Statements

```bash
fob-stm statements list
fob-stm statements upload ./march-statement.pdf --account <id>
fob-stm statements show <id>
fob-stm statements download <id> --output ./statement.pdf
fob-stm statements submit-password <id> --password ****   # for encrypted PDFs
```

### Rules, reports, categories, entities

```bash
fob-stm rules list
fob-stm rules preview <id>
fob-stm reports show <report> --from 2026-01-01 --to 2026-03-31
fob-stm categories list
fob-stm entities list
```

Run `fob-stm <resource>` to list a resource's actions.

## Output

Human-readable tables by default. Pass `--json` for machine-readable output; list commands also
support `--format csv` and `--output <file>`. Data goes to stdout; hints and errors to stderr.

## As a library

```js
import { fobStm } from '@finopsbricks/fob-stm';

const stm = fobStm({
  api_key: 'fob_stm_…',
  api_secret: '…',
  // api_url optional — defaults to https://statements.finopsbricks.com
});

const { data } = await stm.accounts.list({ category: 'bank' });
const account = await stm.accounts.get(accountId);
```

Credentials are passed explicitly (never read from the environment), so one process can talk to
multiple orgs by constructing a client per org. Namespaces: `accounts`, `statements`,
`transactions`, `rules`, `reports`, `categories`, `entities`, plus `whoami()`.

## License

[Apache-2.0](./LICENSE) © FinOpsBricks
