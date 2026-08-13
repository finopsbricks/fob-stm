import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const bin = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'cli.js');

/** Run `<command> --help` and return the heading lines in the order shown. */
function helpHeadings(args) {
  const out = execFileSync('node', [bin, ...args.split(' '), '--help'], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter((l) => /^(Arguments:|Options:|Global Options:)$/.test(l));
}

describe('help layout', () => {
  it("shows a command's own options above the inherited global ones", () => {
    // accounts show: Arguments (id) → Options (json) → Global Options (profile/help)
    expect(helpHeadings('accounts show')).toEqual([
      'Arguments:',
      'Options:',
      'Global Options:',
    ]);
  });

  it('keeps positional arguments first when field options are bundled before them', () => {
    // rules create bundles its field options; the argument must still lead.
    expect(helpHeadings('rules create')).toEqual([
      'Arguments:',
      'Options:',
      'Global Options:',
    ]);
  });

  it('groups global options under their own heading even without arguments', () => {
    expect(helpHeadings('categories list')).toEqual(['Options:', 'Global Options:']);
  });

  it('renders arguments, then options, then globals for a command with no flags of its own', () => {
    // `config profiles use <name>` declares no options. The Options: group is
    // still shown because -h/--help lives there — unlike the previous parser,
    // which omitted the heading entirely. Ordering is what this suite guards.
    expect(helpHeadings('config profiles use')).toEqual([
      'Arguments:',
      'Options:',
      'Global Options:',
    ]);
  });
});

describe('help formatting', () => {
  it('lists bare subcommand names, without repeating the parent command path', () => {
    const out = execFileSync('node', [bin, 'accounts', '--help'], { encoding: 'utf8' });
    expect(out).toMatch(/^ {2}show <id> {2,}Show an account by ID$/m);
    expect(out).not.toMatch(/fob-stm accounts show/);
  });

  it('surfaces command aliases in the listing', () => {
    const out = execFileSync('node', [bin, 'config', 'profiles', '--help'], { encoding: 'utf8' });
    expect(out).toMatch(/remove\|rm <name>/);
    expect(out).toMatch(/current\|whoami/);
  });

  it('wraps long descriptions on word boundaries, indented to the description column', () => {
    const out = execFileSync('node', [bin, 'accounts', '--help'], {
      encoding: 'utf8',
      env: { ...process.env, COLUMNS: '92' },
    });
    // No line may exceed the terminal width, and no word may be split across
    // lines (the failure mode of the previous parser: "fr|om", "[yyyy-mm-d|d]").
    for (const line of out.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(100);
    }
    expect(out).not.toMatch(/\w-\n/);
  });
});
