/**
 * Paired-negative contract tests for the preset path of parse-override-flags.sh
 * (beta-delivery-ux S2 / spec A4) — the preset activation surface.
 *
 * Presets route via the §1 (kickoff §8a Park-1) flat JSON schema through seam #1
 * (parser). Each preset short-circuits the routing tree by emitting PRESET_MODE
 * + PRESET_REVIEWER_TIER + PRESET_MARKER (when set) + PRESET_*_PREDICATE lines
 * for downstream consumption.
 *
 * Coverage of kickoff §5 AC-1: presets activate flag-only (non-TTY).
 *
 *   ✅ FLAG-AIF:    `--preset aif`           → exit 0, PRESET_MODE=autonomous, marker set
 *   ✅ FLAG-ECONOMY:`--preset economy`       → exit 0, PRESET_MODE=whole-line-executor, marker set
 *   ✅ ENV-NIGHT:   AIF_PIPELINE_PRESET=night → exit 0, PRESET_MODE=mode-a-inline, no marker
 *   ✅ ENV-SDD:     AIF_PIPELINE_PRESET=sdd   → exit 0, PRESET_MODE=in-session, no marker
 *   ✅ COLLISION:   `--preset aif --mode-solo` → exit 2, multi-source collision
 *   ✅ UNKNOWN:     `--preset bogus`         → exit non-zero (resolver rejects)
 *   ✅ FLAG-OVER-ENV: both set → flag wins (aif over env=night)
 *
 * Reference: packages/core/hooks/parse-override-flags.test.ts (sibling test pattern).
 * T3 compliance: each assertion cites the command + output.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/parse-override-flags.sh',
);

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

describe('parse-override-flags.sh — preset activation (AC-1, seam #1)', () => {
  // ✅ FLAG-AIF (marker preset — emits marker line)
  it('FLAG-AIF: `--preset aif` → exit 0; PRESET_MODE=autonomous + marker set', () => {
    const r = runHelper('some-umbrella --preset aif');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PRESET_MODE=autonomous');
    expect(r.stdout).toContain('PRESET_MARKER=Claude Opus (plan+review)');
    expect(r.stdout).toContain('PRESET_REVIEWER_TIER=aif-own');
  });

  // ✅ FLAG-ECONOMY (marker preset — emits marker + maxReviewIterations hint)
  it('FLAG-ECONOMY: `--preset economy` → exit 0; PRESET_MODE=whole-line-executor + marker', () => {
    const r = runHelper('some-umbrella --preset economy');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PRESET_MODE=whole-line-executor');
    expect(r.stdout).toContain('PRESET_MARKER=Z.AI GLM-5.2 SDK');
    expect(r.stdout).toContain('PRESET_REVIEWER_TIER=executor-tier');
    // §8a Park-3: economy reviewer tier is executor-tier with maxReviewIterations=1
    expect(r.stdout).toContain('PRESET_AIF_MAX_REVIEW_ITERATIONS=1');
  });

  // ✅ ENV-NIGHT (no marker — Night mode is session-bound)
  it('ENV-NIGHT: AIF_PIPELINE_PRESET=night → exit 0; PRESET_MODE=mode-a-inline, no marker', () => {
    const r = runHelper('some-umbrella', { AIF_PIPELINE_PRESET: 'night' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PRESET_MODE=mode-a-inline');
    expect(r.stdout).toContain('PRESET_REVIEWER_TIER=session-bound');
    // No PRESET_MARKER line emitted for night
    expect(r.stdout).not.toMatch(/^PRESET_MARKER=/m);
  });

  // ✅ ENV-SDD (no marker — SDD is session-bound)
  it('ENV-SDD: AIF_PIPELINE_PRESET=sdd → exit 0; PRESET_MODE=in-session, no marker', () => {
    const r = runHelper('some-umbrella', { AIF_PIPELINE_PRESET: 'sdd' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PRESET_MODE=in-session');
    // No PRESET_MARKER line emitted for sdd
    expect(r.stdout).not.toMatch(/^PRESET_MARKER=/m);
  });

  // ✅ COLLISION (flag + mode-* → exit 2)
  it('COLLISION: `--preset aif --mode-solo` → exit 2; multi-source collision', () => {
    const r = runHelper('some-umbrella --preset aif --mode-solo');
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/multi-source collision|preset.{1,40}mode-/i);
  });

  // ✅ UNKNOWN PRESET (resolver exits non-zero, lists available)
  it('UNKNOWN: `--preset bogus` → exit non-zero (resolver rejects)', () => {
    const r = runHelper('some-umbrella --preset bogus');
    expect(r.status).not.toBe(0);
  });

  // ✅ FLAG-OVER-ENV (precedence: flag > env > default — §2 spec A4)
  it('FLAG-OVER-ENV: --preset aif beats AIF_PIPELINE_PRESET=night', () => {
    const r = runHelper('some-umbrella --preset aif', {
      AIF_PIPELINE_PRESET: 'night',
    });
    expect(r.status).toBe(0);
    // Flag wins → autonomous, not mode-a-inline
    expect(r.stdout).toContain('PRESET_MODE=autonomous');
    expect(r.stdout).not.toContain('PRESET_MODE=mode-a-inline');
  });

  // ✅ ALL-FOUR-PRESETS-ROUND-TRIP (label-mutation falsifier)
  it.each([
    ['aif', 'autonomous'],
    ['night', 'mode-a-inline'],
    ['economy', 'whole-line-executor'],
    ['sdd', 'in-session'],
  ] as const)(
    'ALL-FOUR-PRESETS-ROUND-TRIP: --preset %s → PRESET_MODE=%s',
    (preset, expectedMode) => {
      const r = runHelper(`umbrella --preset ${preset}`);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain(`PRESET_MODE=${expectedMode}`);
    },
  );
});
