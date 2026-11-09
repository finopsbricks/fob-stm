// @ts-check
import { readFileSync } from 'node:fs';
import { confirm } from '@inquirer/prompts';
import { ApiError } from '../../http.js';
import { clientFor } from '../_helpers.js';
import { formatAmount, formatTable } from '../utils/format.js';
import { scaleMilliAmount } from '../utils/amounts.js';

/**
 * @typedef {Object} DeleteResult
 * @property {string} id
 * @property {boolean} ok - the row was found and (unless a dry run) deleted
 * @property {boolean} deleted
 * @property {object|null} transaction - the row as fetched before deleting
 * @property {string} [error]
 * @property {string} [code]
 */

/**
 * Parse the id list from the positional (comma-separated) and `--ids-file`
 * (one id per line, or a JSON array). Order is kept; duplicates are dropped so
 * a repeated id isn't deleted once and then reported as missing.
 * @param {{ ids?: string, idsFile?: string }} argv
 * @returns {string[]}
 */
export function parseIds({ ids, idsFile }) {
  const all = [];
  if (ids) all.push(...String(ids).split(','));
  if (idsFile) {
    const text = readFileSync(idsFile, 'utf8');
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) {
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`--ids-file ${idsFile} looks like JSON but doesn't parse: ${err.message}`);
      }
      if (!Array.isArray(parsed)) throw new Error(`--ids-file ${idsFile} must hold a JSON array of ids`);
      all.push(...parsed.map(String));
    } else {
      all.push(...text.split(/\r?\n/));
    }
  }
  return [...new Set(all.map((s) => s.trim()).filter(Boolean))];
}

/** A fetched row with milli-unit amounts scaled for JSON output. */
function scaled(t) {
  return { ...t, inflow: scaleMilliAmount(t.inflow), outflow: scaleMilliAmount(t.outflow), balance: scaleMilliAmount(t.balance) };
}

/** Turn an ApiError into a result's error fields; rethrow anything else. */
function apiFailure(err) {
  if (!(err instanceof ApiError)) throw err;
  if (err.status === 404) return { error: 'not found', code: err.code ?? 'NOT_FOUND' };
  return { error: err.message, code: err.code };
}

function previewTable(results) {
  const rows = results.map((r) =>
    r.transaction
      ? [
          r.id,
          r.transaction.date ?? '',
          r.transaction.account_name ?? r.transaction.account_id ?? '',
          formatAmount(r.transaction.inflow),
          formatAmount(r.transaction.outflow),
          String(r.transaction.particulars ?? '').slice(0, 60),
          r.transaction.type ?? '',
        ]
      : [r.id, '', '', '', '', `(${r.error})`, ''],
  );
  return formatTable(['ID', 'DATE', 'ACCOUNT', 'INFLOW', 'OUTFLOW', 'PARTICULARS', 'TYPE'], rows, {
    align: ['left', 'left', 'left', 'right', 'right', 'left', 'left'],
  });
}

/**
 * `transactions delete <ids> [--ids-file] [--dry-run] [-y] [--json]`.
 * Fetches every id first (that's the preview, and the record of what was
 * deleted), then loops the single-record DELETE over the ones that exist.
 * Exits 1 if any id was missing or failed, dry run included.
 */
export async function deleteTransactionsHandler(argv) {
  const ids = parseIds(argv);
  if (ids.length === 0) throw new Error('No transaction ID given. Pass <ids> or --ids-file <path>.');

  const stm = clientFor();
  // With --json, stdout carries only the JSON results; the preview goes to stderr.
  const say = argv.json ? console.error : console.log;

  /** @type {DeleteResult[]} */
  const results = [];
  for (const id of ids) {
    try {
      const t = await stm.transactions.get(id);
      if (t) results.push({ id, ok: true, deleted: false, transaction: t });
      else results.push({ id, ok: false, deleted: false, transaction: null, error: 'not found', code: 'NOT_FOUND' });
    } catch (err) {
      results.push({ id, ok: false, deleted: false, transaction: null, ...apiFailure(err) });
    }
  }
  const found = results.filter((r) => r.ok);
  const missing = results.length - found.length;

  say(previewTable(results));
  say(`\n${found.length} to delete${missing ? `, ${missing} not found or unreadable` : ''}.`);

  if (argv.dryRun) {
    if (argv.json) console.log(JSON.stringify(jsonResults(results), null, 2));
    else console.log('Dry run: nothing deleted.');
    if (missing) process.exit(1);
    return;
  }

  if (found.length > 0 && !argv.yes) {
    const ok = await confirm({
      message: `Permanently delete ${found.length} transaction(s)? This can't be undone.`,
      default: false,
    }, argv.json ? { output: process.stderr } : undefined);
    if (!ok) {
      say('Cancelled.');
      return;
    }
  }

  for (const r of found) {
    try {
      await stm.transactions.delete(r.id);
      r.deleted = true;
    } catch (err) {
      Object.assign(r, { ok: false, ...apiFailure(err) });
    }
  }

  if (argv.json) {
    console.log(JSON.stringify(jsonResults(results), null, 2));
  } else {
    for (const r of results) {
      console.log(r.deleted ? `✓ ${r.id}  deleted` : `✗ ${r.id}  ${r.error}`);
    }
    const deleted = results.filter((r) => r.deleted).length;
    console.log(`\nDeleted ${deleted}/${results.length}.`);
  }

  if (results.some((r) => !r.ok)) process.exit(1);
}

/** @param {DeleteResult[]} results */
function jsonResults(results) {
  return results.map((r) => ({ ...r, transaction: r.transaction ? scaled(r.transaction) : null }));
}
