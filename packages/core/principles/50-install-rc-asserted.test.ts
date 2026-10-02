/**
 * Principle 50 — an install-sh test that runs install.sh asserts install.sh's exit code
 *
 * > **Authoritative for:** which `tests/install-sh/*.test.sh` invocations of `install.sh` count
 * > as rc-asserted, the per-file ratchet of the legacy unasserted ones, and its escape.
 * > **NOT authoritative for:** project goal — see README.md#why-this-exists. The bash-3.2 /
 * > BSD shapes that make an install abort on a Mac — `scripts/check-bash32.sh` (its header).
 *
 * ## Why this gate exists
 *
 * install.sh runs under `set -euo pipefail`, so a bash-3.2 defect (an empty array under
 * `set -u`, GH #531 / PR #544) ABORTS it mid-way. 133 of the 134 suite files run under
 * `set -uo pipefail` WITHOUT `-e`, so a bare `( cd "$T" && bash "$REPO_ROOT/install.sh" … )
 * >/dev/null 2>&1` does not stop the test when the install dies: the arms that follow read
 * whatever the install wrote before it died, and on that incident they read clean — a crashed
 * install reported green. Only a file that asserts `rc=0` (arch-target-monorepo) caught it.
 *
 * ## What counts as asserted
 *
 * One invocation (a line, joined across `\` continuations, running `bash|sh <path>` or `<path>` at
 * command position, where `<path>` is any `$VAR/install.sh` spelling or `$INSTALL` / `$INSTALL_SH`;
 * `bash -n` only parses and is not an invocation) is asserted when ONE of:
 *  - its status is captured (`; rc=$?`, `|| rc=$?`, or `rc=$?` alone on the next line) into a
 *    name that is compared (`[ "$rc" -eq 0 ]`, `-ne`, `=`, `!=`, `case "$rc"`) AFTER the capture
 *    and before the name is assigned again;
 *  - it sits in the condition of an `if` / `elif` / `while` / `until` (not in its body);
 *  - the same logical line carries a failure branch: `|| bad`, `|| fail`, `|| exit N`
 *    (`&& ok` alone reports nothing when the install fails and does not count);
 *  - errexit is on at that line (`set -e` seen and not undone by a later `set +e`) and the
 *    invocation is not masked by `|| true` / `|| :`.
 * A masked invocation (`|| true`) is never asserted. A file check on the NEXT line
 * (`[ -f "$T/x" ] && ok || bad`) is not an assertion of the install's exit code: an install that
 * aborted after writing that file passes it (cold review 2026-10-01 found 43 such credits).
 *
 * ESCAPE — `# install-rc: <rationale>` on the invocation line or the comment line directly
 * above, rationale >= 20 characters (e.g. an arm that expects a non-zero exit and checks the
 * output instead). A shorter rationale is itself a finding.
 *
 * ## The ratchet
 *
 * Measured 2026-10-01: 332 of 436 invocations, in 73 of 90 files, unasserted. They are recorded
 * per file in `50-install-rc-asserted.baseline.json`. A file may never hold MORE unasserted
 * invocations than its baseline (a file absent from it holds zero), and a file that holds FEWER
 * fails too until its baseline is lowered — so the number only goes down and a fix cannot leave
 * slack for the next regression. Raising an entry is itself refused: where `origin/staging` is
 * fetched (pre-push, a full clone) no entry may exceed its value there.
 *
 * ## Channel (.claude/rules/rule-enforcement-channel-selection.md)
 *
 * Mechanically decidable per line, so a gate: the principle suite runs at pre-push and in CI.
 *
 * ## Prior art — SSOT #305 (row renumbered from 302 on 2026-10-03: staging's concurrent append
 * took 300-304, and the register allocates the next free ID — see the renumber note on the row)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findUnasserted,
  measureSuite,
  ratchetProblems,
} from './50-install-rc-asserted.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASELINE: Record<string, number> = JSON.parse(
  readFileSync(
    resolve(
      REPO_ROOT,
      'packages/core/principles/50-install-rc-asserted.baseline.json',
    ),
    'utf8',
  ),
).unasserted;

const NO_E = '#!/usr/bin/env bash\nset -uo pipefail\n';
const WITH_E = '#!/usr/bin/env bash\nset -euo pipefail\n';
const RUN =
  '( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1';

describe('principle 50 — install.sh exit code is asserted (live suite)', () => {
  it('holds the per-file ratchet over tests/install-sh/*.test.sh', () => {
    const measured = measureSuite(REPO_ROOT);
    const problems = ratchetProblems(measured.counts, BASELINE);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('never raises a baseline entry above its value on origin/staging', () => {
    let base: Record<string, number>;
    try {
      base = JSON.parse(
        execFileSync(
          'git',
          [
            'show',
            'origin/staging:packages/core/principles/50-install-rc-asserted.baseline.json',
          ],
          {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          },
        ),
      ).unasserted;
    } catch {
      return; // no origin/staging here (shallow CI clone) or the baseline is not on it yet
    }
    const raised = Object.entries(BASELINE)
      .filter(([f, n]) => n > (base[f] ?? 0))
      .map(([f, n]) => `${f}: ${n} > ${base[f] ?? 0} on origin/staging`);
    expect(raised, raised.join('\n')).toEqual([]);
  });

  it('measures a non-empty population (a moved suite must not pass vacuously)', () => {
    const measured = measureSuite(REPO_ROOT);
    expect(measured.files).toBeGreaterThan(50);
    expect(measured.invocations).toBeGreaterThan(300);
  });
});

describe('principle 50 — the detector (paired arms)', () => {
  it.each([
    [
      'a bare statement in a file without set -e (the GH #531 shape)',
      NO_E + RUN,
    ],
    ['a captured rc that is never compared', NO_E + RUN + '; rc=$?\necho done'],
    ['|| true masks it even under set -e', WITH_E + RUN + ' || true'],
    [
      'an $(…) capture masked by || true',
      NO_E + 'out=$( cd "$C" && bash "$INSTALL" cargo 2>&1 ) || true',
    ],
    [
      'a line-continued invocation left unchecked',
      NO_E +
        '( cd "$E" && bash "$REPO_ROOT/install.sh" ts-server </dev/null) \\\n  >/dev/null 2>&1',
    ],
    [
      'an escape whose rationale is under 20 characters',
      NO_E + '# install-rc: expected\n' + RUN,
    ],
    [
      'a file check on the next line is not an rc assertion',
      NO_E + RUN + '\n[ -f "$T/x" ] && ok "x" || bad "x"',
    ],
    ['&& ok alone reports nothing on failure', NO_E + RUN + ' && ok "ran"'],
    [
      'a second capture reusing rc, compared only once before it',
      NO_E +
        RUN +
        '; rc=$?\n[ "$rc" -eq 0 ] && ok a\n' +
        RUN +
        '; rc=$?\necho end',
    ],
    [
      'an rc compared only BEFORE the capture',
      NO_E + 'x=1; rc=$?\n[ "$rc" -eq 0 ]\n' + RUN + '; rc=$?',
    ],
    [
      'an invocation in the BODY of an if',
      NO_E + 'if [ -d "$T" ]; then ' + RUN + '; fi',
    ],
    ['set -e undone by set +e', WITH_E + 'set +e\n' + RUN],
    [
      'a direct run without bash',
      NO_E + '( cd "$T" && "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1',
    ],
    [
      'the quote before the slash',
      NO_E +
        '( cd "$T" && bash "$REPO_ROOT"/install.sh ts-server ) >/dev/null 2>&1',
    ],
    [
      'another root variable',
      NO_E + '( cd "$T" && bash "$ROOT/install.sh" ts-server ) >/dev/null 2>&1',
    ],
  ])('flags: %s', (_label, text) => {
    expect(findUnasserted(text).length).toBeGreaterThan(0);
  });

  it.each([
    [
      'a captured rc compared with -eq',
      NO_E + RUN + '; rc=$?\n[ "$rc" -eq 0 ] && ok x || bad x',
    ],
    [
      'rc captured on the next line and compared with =',
      NO_E + RUN + '\nMONO_RC=$?\nif [ "$MONO_RC" = 0 ]; then ok a; fi',
    ],
    [
      '&& rc=0 || rc=$? then case',
      NO_E +
        'out=$(bash "$INSTALL" cargo 2>&1) && rc=0 || rc=$?\ncase "$rc" in 0) ok;; esac',
    ],
    [
      'the invocation is an if condition',
      NO_E + 'if ' + RUN + '; then ok a; else bad a; fi',
    ],
    [
      'chained into && ok / || bad',
      NO_E + RUN + ' && ok "installs" || bad "installs"',
    ],
    ['a bare statement in a set -e file', WITH_E + RUN],
    [
      'an escape with a real rationale',
      NO_E +
        '# install-rc: this arm expects a refusal and asserts the output instead\n' +
        RUN,
    ],
    [
      'a comment naming install.sh',
      NO_E + '# we run bash "$REPO_ROOT/install.sh" below',
    ],
    ['|| exit 1 on the same line', NO_E + RUN + ' || exit 1'],
    [
      'bash -n only parses the script',
      NO_E + 'bash -n "$REPO_ROOT/install.sh"',
    ],
    [
      'a file test naming install.sh is not a run',
      NO_E + '[ -f "$REPO_ROOT/install.sh" ] || exit 1',
    ],
    [
      'an assignment of the path is not a run',
      NO_E + 'INSTALL="$REPO_ROOT/install.sh"',
    ],
  ])('accepts: %s', (_label, text) => {
    expect(findUnasserted(text)).toEqual([]);
  });

  it('counts each unasserted invocation once and reports its line', () => {
    const found = findUnasserted(NO_E + RUN + '\necho mid\n' + RUN);
    expect(found.map((f) => f.line)).toEqual([3, 5]);
  });
});

describe('principle 50 — the ratchet', () => {
  it('fails a file that grew above its baseline, and a new file with any', () => {
    const p = ratchetProblems(
      { 'a.test.sh': 3, 'new.test.sh': 1 },
      { 'a.test.sh': 2 },
    );
    expect(p.join('\n')).toMatch(/a\.test\.sh.*3.*baseline 2/);
    expect(p.join('\n')).toMatch(/new\.test\.sh.*1.*baseline 0/);
  });

  it('fails a file that fell below its baseline until the baseline is lowered', () => {
    const p = ratchetProblems(
      { 'a.test.sh': 1 },
      { 'a.test.sh': 2, 'gone.test.sh': 4 },
    );
    expect(p.join('\n')).toMatch(/a\.test\.sh.*1.*lower/);
    expect(p.join('\n')).toMatch(/gone\.test\.sh.*0.*lower/);
  });

  it('passes an exact match', () => {
    expect(ratchetProblems({ 'a.test.sh': 2 }, { 'a.test.sh': 2 })).toEqual([]);
  });
});
