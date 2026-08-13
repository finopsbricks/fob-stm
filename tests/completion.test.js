import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.js');

/**
 * Ask the CLI what it would complete. Mirrors how the shell script calls it:
 * the binary name first, then the completed words, then the partial word (empty
 * when the cursor sits after a space).
 */
function complete(...line) {
  const out = execFileSync('node', [bin, '--get-yargs-completions', 'fob-stm', ...line], {
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

describe('completion candidates', () => {
  it('lists resources at the top level', () => {
    expect(complete('')).toEqual(
      expect.arrayContaining(['accounts', 'statements', 'rules', 'config']),
    );
  });

  it('filters the top level by the partial word', () => {
    expect(complete('co')).toEqual(['config']);
  });

  it('lists a resource actions', () => {
    expect(complete('accounts', '')).toEqual(
      expect.arrayContaining(['list', 'show', 'balance', 'merge']),
    );
  });

  it('descends three levels', () => {
    expect(complete('config', 'profiles', '')).toEqual(
      expect.arrayContaining(['list', 'add', 'use', 'refresh']),
    );
  });

  it('resolves a command alias when descending', () => {
    // `orgs` is an alias of `profiles` — completing through it must still work.
    expect(complete('config', 'orgs', '')).toEqual(
      expect.arrayContaining(['list', 'add', 'use']),
    );
  });

  it('offers aliases as candidates in their own right', () => {
    expect(complete('config', 'profiles', 'r')).toEqual(
      expect.arrayContaining(['remove', 'rm', 'refresh']),
    );
  });

  it('completes long flags once a dash is typed', () => {
    expect(complete('accounts', 'list', '--to')).toEqual(['--totals']);
  });

  it('does not offer the implicit help subcommand', () => {
    expect(complete('accounts', '')).not.toContain('help');
  });

  it('returns nothing past the end of the command tree', () => {
    // `show` takes a positional id; there is nothing to suggest after it.
    expect(complete('accounts', 'show', 'some-id', '')).toEqual([]);
  });
});

describe('completion script', () => {
  it('emits a sourceable script that registers for the binary', () => {
    const out = execFileSync('node', [bin, 'completion'], { encoding: 'utf8' });
    expect(out).toContain('complete -o bashdefault -o default -F _fob_stm_completions fob-stm');
    // The script must call back through the same protocol the tests above use,
    // or the two halves drift apart.
    expect(out).toContain('--get-yargs-completions');
  });
});
