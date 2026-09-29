/**
 * Principle 47 — an early-exit grep never reads a pipe under `pipefail`.
 *
 * Mechanism, measurements, predicate and escape: `47-pipefail-grep-early-exit.ts`. This file is
 * the gate: one real-tree arm over the install-sh battery, a non-vacuity arm, and paired
 * seeds — every positive and negative property of upstream ShellCheck SC2337 (PR #3498), plus
 * the corpus shapes the lexer must follow (heredoc bodies, `case` patterns, `$(…)` inside
 * double quotes, continued lines).
 *
 * CHANNEL (.claude/rules/rule-enforcement-channel-selection.md §3). The shape is mechanically
 * detectable, so it is a gate. A principle test runs at pre-push (`principlesMetaSection`) and
 * in CI, and adds no coverage hole of its own — the argument principle 41 made for the same
 * choice. ShellCheck would be the natural home, and is the retirement path: once a release
 * carries SC2337 and CI runs it over `tests/install-sh`, this file goes, and the escapes stay
 * valid because they are ShellCheck's own directive.
 *
 * POPULATION — `tests/install-sh`, every tracked `*.sh`. Measured 2026-09-29 with this module
 * over staging at b1fbe4eaaaa: 508 flagged sites in the battery (129 files, 1,440 greps
 * reached), and 1 after the battery sweep (126563fef12). Train B (b9f14b666bc) then landed
 * seven PRs written before that sweep and brought 46 new sites in 10 files; the change that
 * adds this gate rewrites all of them, so the battery holds 0.
 *
 * DECLARED LIMIT — the class is not closed repo-wide. Same measurement, same tree: 11 sites in
 * `.claude/hooks` (shipped to consumers), 39 in `scripts`, 80 in `tests/` outside the battery,
 * 3 in `.husky/pre-commit`, and 11 in `setup.d` — which sets no pipefail itself but is sourced
 * by `install.sh` under its `set -euo pipefail` (install.sh:52, :61), and is owned by a
 * parallel fix.
 * Each surface joins `POPULATION` by one line once it measures zero.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  earlyExitFlags,
  ESCAPE_REASON_FLOOR,
  scanSource,
  setsPipefail,
} from './47-pipefail-grep-early-exit.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

/** Pathspecs the gate holds. Widen one line at a time as each surface comes clean. */
const POPULATION = ['tests/install-sh'];

/** A sourced library inherits pipefail from the test that sources it. */
const isSourcedLib = (f: string): boolean => /(^|\/)lib\//.test(f);

function population(): string[] {
  const out = execFileSync('git', ['ls-files', '-z', '--', ...POPULATION], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return out
    .split('\0')
    .filter((f) => f.endsWith('.sh'))
    .sort();
}

function scanFile(f: string): ReturnType<typeof scanSource> {
  const src = readFileSync(join(REPO_ROOT, f), 'utf8');
  return scanSource(f, src, setsPipefail(src) || isSourcedLib(f));
}

/** Seed helper: flagged lines (1-based) of a pipefail snippet. */
const flagged = (src: string): number[] =>
  scanSource('seed.sh', `set -o pipefail\n${src}\n`).sites.map((s) => s.line - 1);

describe('Principle 47 — no early-exit grep reads a pipe under pipefail', () => {
  it('(a) real tree: the install-sh battery carries no unescaped site and no weak escape', () => {
    const sites = population().flatMap((f) => scanFile(f).sites);
    const weak = population().flatMap((f) => scanFile(f).weakEscapes);
    expect(
      sites.map((s) => `${s.file}:${s.line} [${s.flags.join(' ')}] ${s.text}`),
      'an early-exit grep reads a pipe under pipefail — the producer can die of SIGPIPE (141) ' +
        'AFTER grep matched, and pipefail turns the match into a failure. Rewrite as ' +
        '`grep -q P <<<"$v"`, `v=$(cmd) && grep -q P <<<"$v"`, `grep -q P < <(cmd)` or ' +
        '`grep -q P file`; or, where the status is never read, put ' +
        '`# shellcheck disable=SC2337 # <reason>` on the line above the command',
    ).toEqual([]);
    expect(
      weak.map((w) => `${w.file}:${w.line} reason="${w.reason}"`),
      `an SC2337 escape needs a reason of ≥${ESCAPE_REASON_FLOOR} chars after a second \`#\``,
    ).toEqual([]);
  });

  it('(b) non-vacuity: the population is the battery and the lexer reaches its greps', () => {
    const pop = population();
    expect(pop.length, 'population collapsed — git ls-files pathspec is broken').toBeGreaterThan(100);
    const inScope = pop.filter((f) => setsPipefail(readFileSync(join(REPO_ROOT, f), 'utf8')));
    expect(inScope.length, 'pipefail detection stopped matching the battery').toBeGreaterThan(100);
    const greps = pop.reduce((n, f) => n + scanFile(f).grepsSeen, 0);
    // ~1,900 grep commands at the time of writing; a floor far under it catches a lexer that
    // stopped reaching command words without breaking on every edit.
    expect(greps, 'the lexer reaches almost no grep — it is not reading the corpus').toBeGreaterThan(500);
  });

  it('(c) SC2337 positives: every upstream verify() property is flagged', () => {
    for (const src of [
      'cat file | grep -q pattern',
      'cat file | grep --quiet pattern',
      'cat file | grep -iq pattern',
      'cmd1 | cmd2 | grep -q pattern',
      'cmd | grep -m 2 foo | cmd2',
      'cmd | grep -L foo | cmd2',
      'cat file | egrep -q pattern',
      'cat file | fgrep -q pattern',
    ]) {
      expect(flagged(src), src).toEqual([1]);
    }
    expect(scanSource('s.sh', 'set -euo pipefail; cmd | grep -q foo\n').sites).toHaveLength(1);
  });

  it('(d) SC2337 negatives: every upstream verifyNot() property stays clean', () => {
    expect(scanSource('s.sh', 'cat file | grep -q pattern\n').sites, 'no pipefail').toEqual([]);
    for (const src of [
      'grep -q pattern file',
      'cat file | grep pattern',
      'grep -q pattern | cat',
      "cmd1 | bash -c 'grep -q pattern file'",
      'cmd1 | grep -e -q',
      'cmd1 | grep -eq pattern',
      'cmd1 | grep --regexp -q',
      'cmd1 | grep -- -q',
    ]) {
      expect(flagged(src), src).toEqual([]);
    }
  });

  it('(e) incident shapes: the two gh-934 arms and the r2-auto-wire awk arm, as they were', () => {
    // Verbatim from tests/install-sh/gh-934-ship-eot-hook.test.sh before 126563fef12 (:86-87,
    // :110-111) and r2-auto-wire.test.sh arm G — the sites that flaked on the PC.
    const src = [
      `if [ "$(printf '%s' "$OUT_RU" | jq -r '.decision' 2>/dev/null)" = "block" ] \\`,
      `   && printf '%s' "$OUT_RU" | jq -r '.reason' 2>/dev/null | grep -q 'Простыми словами'; then`,
      '  ok "(E)"',
      'fi',
      `if [ "$(printf '%s' "$OUT_STORY" | jq -r '.decision' 2>/dev/null)" = "block" ] \\`,
      `   && printf '%s' "$OUT_STORY" | jq -r '.reason' 2>/dev/null | grep -qF 'Что изменилось за сессию'; then`,
      '  ok "(E2)"',
      'fi',
      `awk '/START/{on=1} on' "$LOG" | grep -q 'RULE_GLOBS.boundary.*eslint.config.mjs' && ok G`,
    ].join('\n');
    expect(flagged(src)).toEqual([2, 6, 9]);
  });

  it('(f) nesting: pipes inside $(…), backticks, double quotes and process substitution', () => {
    expect(flagged('x=$(cmd | grep -m1 foo)')).toEqual([1]);
    expect(flagged('echo "got: $(cmd | grep -q foo && echo y)"')).toEqual([1]);
    expect(flagged('x=`cmd | grep -q foo`')).toEqual([1]);
    expect(flagged('grep -q foo < <(cmd | grep -m1 bar)')).toEqual([1]);
    expect(flagged('cmd |& grep -q foo')).toEqual([1]);
    expect(flagged('cmd \\\n  | grep -q foo')).toEqual([2]);
    expect(flagged('cmd |\n  grep -q foo')).toEqual([2]);
    expect(flagged('a && b | grep -q foo || c')).toEqual([1]);
    expect(flagged('! cmd | grep -q foo')).toEqual([1]);
  });

  it('(g) the lexer does not invent pipes: here-strings, ||, comments, heredocs, case, [[ ]]', () => {
    for (const src of [
      'grep -q foo <<<"$(cmd)"',
      'v=$(cmd) && grep -q foo <<<"$v"',
      'grep -q foo < <(cmd)',
      'cmd || grep -q foo file',
      '# cmd | grep -q foo',
      'echo "literal | grep -q foo"',
      "echo 'literal | grep -q foo'",
      'cat <<EOF\ncmd | grep -q foo\nEOF\ngrep -q x file',
      "cat <<-'EOF'\n\tcmd | grep -q foo\n\tEOF\ngrep -q x file",
      'case "$x" in a|b) grep -q foo file ;; *"|"*) grep -q bar file ;; esac',
      '[[ $x =~ a|b ]] && grep -q foo file',
      'x=$((a | b)); grep -q foo file',
      'grep -q foo file | cat',
    ]) {
      expect(flagged(src), src).toEqual([]);
    }
    // A pipe AFTER the heredoc body is still seen — the body skip ends at its delimiter.
    expect(flagged('cat <<EOF\nbody\nEOF\ncmd | grep -q foo')).toEqual([4]);
    // Inside a case arm the list is ordinary code.
    expect(flagged('case "$x" in a|b) cmd | grep -q foo ;; esac')).toEqual([1]);
  });

  it('(h) escape: the ShellCheck directive above the command, with a ≥20-char reason', () => {
    const good = scanSource(
      's.sh',
      'set -o pipefail\n# shellcheck disable=SC2337 # display-only $(...), its status is never read\necho "$(cmd | grep -m1 foo | head -c 300)"\n',
    );
    expect(good.sites).toEqual([]);
    expect(good.escaped).toHaveLength(1);

    // Above the FIRST line of a continued command, as ShellCheck reads it.
    const continued = scanSource(
      's.sh',
      'set -o pipefail\n# shellcheck disable=SC2130,SC2337 # status unread: the arm prints only\ncmd \\\n  | grep -q foo\n',
    );
    expect(continued.sites).toEqual([]);
    expect(continued.escaped).toHaveLength(1);

    const short = scanSource('s.sh', 'set -o pipefail\n# shellcheck disable=SC2337 # ok\ncmd | grep -q foo\n');
    expect(short.sites).toEqual([]);
    expect(short.weakEscapes).toEqual([{ file: 's.sh', line: 2, reason: 'ok' }]);

    const bare = scanSource('s.sh', 'set -o pipefail\n# shellcheck disable=SC2337\ncmd | grep -q foo\n');
    expect(bare.weakEscapes).toHaveLength(1);

    // Same-line trailing directive: ShellCheck rejects it (SC1126), so it does not escape.
    expect(flagged('cmd | grep -q foo # shellcheck disable=SC2337 # a long enough reason here')).toEqual([1]);
    // A different code does not escape SC2337.
    expect(flagged('# shellcheck disable=SC2086 # unrelated but long enough reason\ncmd | grep -q foo')).toEqual([2]);
  });

  it('(i) option parsing follows getopt', () => {
    expect(earlyExitFlags(['-q', 'x'])).toEqual(['-q']);
    expect(earlyExitFlags(['-Eqi', 'x'])).toEqual(['-q']);
    expect(earlyExitFlags(['-m1', 'x'])).toEqual(['-m']);
    expect(earlyExitFlags(['--max-count=1', 'x'])).toEqual(['--max-count']);
    expect(earlyExitFlags(['--silent', 'x'])).toEqual(['--silent']);
    expect(earlyExitFlags(['-e', '-q'])).toEqual([]);
    expect(earlyExitFlags(['-f', '-q'])).toEqual([]);
    expect(earlyExitFlags(['x', '-q'])).toEqual(['-q']);
    expect(earlyExitFlags(['-c', '-o', '-n', 'x'])).toEqual([]);
    expect(earlyExitFlags(['\u0000'])).toEqual([]);
  });

  it('(j) pipefail detection and the sourced-library rule', () => {
    expect(setsPipefail('set -uo pipefail\n')).toBe(true);
    expect(setsPipefail('set -e -o pipefail\n')).toBe(true);
    expect(setsPipefail('# set -o pipefail\n')).toBe(false);
    expect(setsPipefail('echo pipefail\n')).toBe(false);
    const lib = population().filter(isSourcedLib);
    expect(lib.length, 'the battery has a sourced lib/ — the rule is live, not hypothetical').toBeGreaterThan(0);
    expect(scanSource('lib/x.sh', 'cmd | grep -q foo\n', true).sites).toHaveLength(1);
  });
});
