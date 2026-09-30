/**
 * Principle 49 — an install-sh test that runs install.sh asserts install.sh's exit code
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
 * One invocation (a line, joined across `\` continuations, running `bash|sh` on
 * `$REPO_ROOT/install.sh`, `$INSTALL_ROOT/install.sh`, `$INSTALL` or `$INSTALL_SH`) is
 * asserted when ONE of:
 *  - its status is captured (`; rc=$?`, `|| rc=$?`, or `rc=$?` alone on the next line) into a
 *    name the file later compares (`[ "$rc" -eq 0 ]`, `-ne`, `=`, `!=`, `case "$rc"`);
 *  - it is itself a condition: `if` / `elif` / `while` / `until`, or chained into `&& ok` /
 *    `|| bad` / `|| fail` on the same or the next line;
 *  - the file runs `set -e` and the invocation is not masked by `|| true` / `|| :`.
 * A masked invocation (`|| true`) is never asserted, whatever the file's options.
 *
 * ESCAPE — `# install-rc: <rationale>` on the invocation line or the comment line directly
 * above, rationale >= 20 characters (e.g. an arm that expects a non-zero exit and checks the
 * output instead). A shorter rationale is itself a finding.
 *
 * ## The ratchet
 *
 * Measured 2026-10-01: 310 of 428 invocations, in 71 of 88 files, unasserted (16 of them masked
 * by `|| true`, 8 captured but never compared). They are recorded per file in `49-install-rc-asserted.baseline.json`. A file may never hold MORE
 * unasserted invocations than its baseline (a file absent from it holds zero), and a file that
 * holds FEWER fails too until its baseline is lowered — so the number only goes down and a fix
 * cannot leave slack for the next regression.
 *
 * ## Channel (.claude/rules/rule-enforcement-channel-selection.md)
 *
 * Mechanically decidable per line, so a gate: the principle suite runs at pre-push and in CI.
 *
 * ## Prior art — SSOT #302
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findUnasserted,
  measureSuite,
  ratchetProblems,
} from './49-install-rc-asserted.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const BASELINE: Record<string, number> = JSON.parse(
  readFileSync(
    resolve(
      REPO_ROOT,
      'packages/core/principles/49-install-rc-asserted.baseline.json',
    ),
    'utf8',
  ),
).unasserted;

const NO_E = '#!/usr/bin/env bash\nset -uo pipefail\n';
const WITH_E = '#!/usr/bin/env bash\nset -euo pipefail\n';
const RUN =
  '( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >/dev/null 2>&1';

describe('principle 49 — install.sh exit code is asserted (live suite)', () => {
  it('holds the per-file ratchet over tests/install-sh/*.test.sh', () => {
    const measured = measureSuite(REPO_ROOT);
    const problems = ratchetProblems(measured.counts, BASELINE);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('measures a non-empty population (a moved suite must not pass vacuously)', () => {
    const measured = measureSuite(REPO_ROOT);
    expect(measured.files).toBeGreaterThan(50);
    expect(measured.invocations).toBeGreaterThan(300);
  });
});

describe('principle 49 — the detector (paired arms)', () => {
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
  ])('accepts: %s', (_label, text) => {
    expect(findUnasserted(text)).toEqual([]);
  });

  it('counts each unasserted invocation once and reports its line', () => {
    const found = findUnasserted(NO_E + RUN + '\necho mid\n' + RUN);
    expect(found.map((f) => f.line)).toEqual([3, 5]);
  });
});

describe('principle 49 — the ratchet', () => {
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
