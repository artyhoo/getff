/**
 * Paired-negative contract tests for parse-override-flags.sh — the CLI override
 * flag parser for /pipeline (Stage 4 of meta-orchestrator-mode-triage-
 * and-planner umbrella).
 *
 * Channel: in-session helper invoked via !shell block from SKILL.md §0 preamble
 * (wiring deferred to follow-up after cap-bump; helper ships independently).
 * Class C → Class B-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract: the helper parses $1 (a single umbrella string)
 * for one of 6 override flags + reason; emits OVERRIDE_MODE + OVERRIDE_REASON
 * on stdout; exits 0/1/2.
 *
 *   ✅ NO-FLAG: no --mode-* in input → exit 1, empty stdout
 *   ✅ SINGLE-VALID: --mode-solo + long reason → exit 0; correct ALIAS emitted
 *   ✅ ALL-SIX-FLAGS-ROUND-TRIP: each of 6 flags → matching ALIAS (label-mutation)
 *   ✅ REASON-MISSING: --mode-solo, no --reason → exit 2, stderr --reason required
 *   ✅ REASON-TOO-SHORT: --mode-solo, --reason=short → exit 2, stderr ≥20 chars
 *   ✅ MULTI-FLAG-COLLISION: ≥2 flags → exit 2, stderr multi-flag collision
 *   ✅ REASON-MIN-OVERRIDE-VIA-SEAM: MO_OVERRIDE_REASON_MIN=5 + 5-char reason → exit 0
 *   ✅ REASON-WITH-EMBEDDED-SPACES: quoted reason with spaces → preserved verbatim
 *   ✅ EMPTY-INPUT: "" → exit 1, empty stdout (no flags = no override)
 *
 * Reference patterns:
 *   packages/core/hooks/delta-diff.test.ts (spawnSync shape + import style)
 *   packages/core/hooks/update-delta.test.ts (spawnSync shape)
 * T3 compliance: each assertion cites helper line/region targeted.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/pipeline/helpers/parse-override-flags.sh',
);

/** Invoke the helper with a single umbrella string (mirrors SKILL.md §0 calling convention). */
function runHelper(
  umbrellaString: string,
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER, umbrellaString], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('parse-override-flags.sh — CLI override flag parser (paired-negative)', () => {
  // ✅ Case 1: NO-FLAG
  it('NO-FLAG: no --mode-* flag in input → exit 1, empty stdout (line ~59 found_count==0 branch)', () => {
    const r = runHelper('some-umbrella');
    expect(r.status).toBe(1);
    expect(r.stdout.trim()).toBe('');
  });

  // ✅ Case 2: SINGLE-VALID
  it('SINGLE-VALID: --mode-solo with long reason → exit 0; OVERRIDE_MODE=SOLO and OVERRIDE_REASON emitted (lines ~89-101)', () => {
    const r = runHelper('some-umbrella --mode-solo --reason="because the kickoff is small enough"');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OVERRIDE_MODE=SOLO');
    expect(r.stdout).toContain('OVERRIDE_REASON=because the kickoff is small enough');
  });

  // ✅ Case 3: ALL-SIX-FLAGS-ROUND-TRIP (label-mutation falsifier)
  // Swapping any flag→alias mapping in the case statement would cause exactly
  // one of the 6 parametrised assertions below to fail.
  it.each([
    ['--mode-direct', 'DIRECT'],
    ['--mode-solo', 'SOLO'],
    ['--mode-bundle', 'BUNDLE'],
    ['--mode-pair', 'PAIR'],
    ['--mode-decompose', 'DECOMPOSE'],
    ['--mode-research', 'RESEARCH'],
  ] as const)(
    'ALL-SIX-FLAGS-ROUND-TRIP: %s → OVERRIDE_MODE=%s (case statement lines ~79-87)',
    (flag, expectedAlias) => {
      const r = runHelper(`my-task ${flag} --reason="because this is the right mode for sure"`);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`OVERRIDE_MODE=${expectedAlias}`);
    },
  );

  // ✅ Case 4: REASON-MISSING
  it('REASON-MISSING: --mode-solo with no --reason → exit 2; stderr contains --reason required (line ~95)', () => {
    const r = runHelper('some-umbrella --mode-solo');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--reason required');
  });

  // ✅ Case 5: REASON-TOO-SHORT
  it('REASON-TOO-SHORT: --reason=short (5 chars) below 20-char default → exit 2; stderr contains ≥20 chars (line ~95)', () => {
    const r = runHelper('some-umbrella --mode-solo --reason=short');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('--reason required (≥20 chars)');
    expect(r.stderr).toContain("got: 'short'");
  });

  // ✅ Case 6: MULTI-FLAG-COLLISION
  it('MULTI-FLAG-COLLISION: two flags → exit 2; stderr contains multi-flag collision (line ~68)', () => {
    const r = runHelper('some-umbrella --mode-solo --mode-pair --reason="because xyz xyz xyz"');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('multi-flag collision');
    expect(r.stderr).toContain('--mode-solo');
    expect(r.stderr).toContain('--mode-pair');
  });

  // ✅ Case 7: REASON-MIN-OVERRIDE-VIA-SEAM
  it('REASON-MIN-OVERRIDE-VIA-SEAM: MO_OVERRIDE_REASON_MIN=5 + 5-char reason → exit 0; OVERRIDE_MODE=SOLO (seam line ~38)', () => {
    const r = runHelper(
      'some-umbrella --mode-solo --reason=12345',
      { MO_OVERRIDE_REASON_MIN: '5' },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OVERRIDE_MODE=SOLO');
  });

  // ✅ Case 8: REASON-WITH-EMBEDDED-SPACES
  it('REASON-WITH-EMBEDDED-SPACES: double-quoted reason preserved verbatim (regex Form 1 line ~91)', () => {
    const r = runHelper(
      'some-umbrella --mode-solo --reason="because the kickoff is small enough and clear"',
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OVERRIDE_REASON=because the kickoff is small enough and clear');
  });

  // ✅ Case 9: EMPTY-INPUT
  it('EMPTY-INPUT: "" → exit 1, empty stdout (no flags = no override; line ~59 found_count==0 branch)', () => {
    const r = runHelper('');
    expect(r.status).toBe(1);
    expect(r.stdout.trim()).toBe('');
  });
});
