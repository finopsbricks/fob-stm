/**
 * Shell completion.
 *
 * Two halves, mirroring what a yargs-based CLI gets from `.completion()`:
 *
 *  - `<tool> completion` prints a bash/zsh script to source;
 *  - `<tool> --get-yargs-completions <words…>` prints the candidates for a
 *    partially-typed command line, which is what that script calls.
 *
 * The flag name is `--get-yargs-completions` despite yargs being gone: it is the
 * wire protocol the `fob` dispatcher already speaks to every tool in the family
 * (see fob-cli/src/dispatch.js). Keeping it means a commander CLI drops into the
 * existing dispatcher completion with no change there, and `fob stm <TAB>` works
 * the same as `fob worker <TAB>`.
 */

/**
 * Walk the command tree to the subcommand addressed by `words`, then return the
 * candidates that could come next.
 *
 * @param {import('commander').Command} program  the root command
 * @param {string[]} words  completed words after the binary name (partial word excluded)
 * @param {string} current  the partial word being typed, or ''
 * @returns {string[]}
 */
export function completionCandidates(program, words, current) {
  let cmd = program;

  for (const word of words) {
    const next = cmd.commands.find((c) => c.name() === word || c.aliases().includes(word));
    // An unrecognised word means the line is past the command tree (a positional
    // value, say) — nothing useful left to suggest.
    if (!next) return [];
    cmd = next;
  }

  const candidates = [];
  for (const child of cmd.commands) {
    // `help` is commander's implicit subcommand; it is noise in a completion list.
    if (child.name() === 'help') continue;
    candidates.push(child.name(), ...child.aliases());
  }
  // Offer this level's own flags once the user has typed a leading dash, so
  // `fob-stm accounts list --to<TAB>` completes --totals.
  if (current.startsWith('-')) {
    for (const opt of cmd.options) {
      if (opt.long) candidates.push(opt.long);
    }
  }

  return current ? candidates.filter((c) => c.startsWith(current)) : candidates;
}

/**
 * The bash/zsh completion script for direct `<tool> …` invocation.
 *
 * (`fob <tool> …` is handled separately by the dispatcher's own script, which
 * delegates here through the same flag.)
 */
export function completionScript(binName) {
  return `###-begin-${binName}-completions-###
#
# ${binName} command completion script
#
# Installation: ${binName} completion >> ~/.bashrc
#    or ${binName} completion >> ~/.bash_profile on OSX.
#
_${binName.replace(/-/g, '_')}_completions()
{
  local cur_word type_list
  cur_word="\${COMP_WORDS[COMP_CWORD]}"
  type_list=$("${binName}" --get-yargs-completions "\${COMP_WORDS[@]}" 2>/dev/null)
  COMPREPLY=( $(compgen -W "\${type_list}" -- \${cur_word}) )
  if [ \${#COMPREPLY[@]} -eq 0 ]; then
    COMPREPLY=()
  fi
  return 0
}
complete -o bashdefault -o default -F _${binName.replace(/-/g, '_')}_completions ${binName}
###-end-${binName}-completions-###
`;
}

/**
 * Handle the completion protocol before commander parses anything, since
 * `--get-yargs-completions` is not a real option and would otherwise be rejected
 * by `allowUnknownOption(false)`.
 *
 * @returns {boolean} true if the invocation was a completion request and has been served
 */
export function handleCompletion(program, argv, binName) {
  if (argv[0] === 'completion') {
    console.log(completionScript(binName));
    return true;
  }

  const flagIndex = argv.indexOf('--get-yargs-completions');
  if (flagIndex === -1) return false;

  // Everything after the flag is the command line being completed, starting with
  // the binary name. The last element is the partial word under the cursor —
  // empty when the cursor sits after a space.
  const line = argv.slice(flagIndex + 1);
  const afterBin = line.slice(1);
  const current = afterBin.length ? afterBin[afterBin.length - 1] : '';
  const words = afterBin.slice(0, -1).filter(Boolean);

  for (const candidate of completionCandidates(program, words, current)) {
    console.log(candidate);
  }
  return true;
}
