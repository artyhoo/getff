/**
 * Contract tests for render-status.sh — the /pipeline status renderer
 * (beta-delivery-ux S2 / spec A5 §5 AC-4).
 *
 * AC-4: /pipeline status renders all three sections against live bricks.
 * This test exercises the renderer in a degraded environment (no bridge,
 * no gh, no tsx) — exactly the contract §3 specifies: each section degrades
 * gracefully when its brick is unavailable.
 *
 *   ✅ THREE-SECTIONS-PRESENT: In-factory / Parked questions / Ready-to-harvest
 *   ✅ HEADER-MARKER: starts with "## Pipeline status"
 *   ✅ SUGGESTED-NEXT-TAIL: ends with one or more "→ next:" suggestion lines
 *   ✅ GRACEFUL-BRICK-UNAVAILABLE: every section degrades, exit stays 0
 *
 * Note: in-container runs (CI / agent runtime), the bridge is typically
 * unreachable, `gh` may be absent, and `tsx` may be missing. These tests
 * assert the degraded-path output shape, NOT the live-data path. The
 * live-fired AC-4 evidence (against a running aif + open PR + parked
 * question) is captured in the PR body, separate from these contract tests.
 *
 * Reference: packages/core/hooks/parse-preset.test.ts (sibling).
 * T3 compliance: each assertion cites command + output excerpt.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/render-status.sh',
);

function runHelper(
  env?: Record<string, string>,
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('render-status.sh — /pipeline status (AC-4, degraded path)', () => {
  // ✅ THREE-SECTIONS-PRESENT
  it('THREE-SECTIONS-PRESENT: In-factory, Parked questions, Ready-to-harvest headers all present', () => {
    const r = runHelper({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:1' }); // unreachable
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/In-factory/i);
    expect(r.stdout).toMatch(/Parked questions/i);
    expect(r.stdout).toMatch(/Ready-to-harvest/i);
  });

  // ✅ HEADER-MARKER
  it('HEADER-MARKER: stdout starts with "## Pipeline status"', () => {
    const r = runHelper({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:1' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim().split('\n')[0]).toMatch(/^##\s+Pipeline status/);
  });

  // ✅ SUGGESTED-NEXT-TAIL
  it('SUGGESTED-NEXT-TAIL: stdout ends with one or more "→ next:" suggestion lines', () => {
    const r = runHelper({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:1' });
    expect(r.status).toBe(0);
    const lines = r.stdout.trim().split('\n');
    // Find at least one "→ next:" or "next:" suggestion in the last 6 lines.
    const tail = lines.slice(-6).join('\n');
    expect(tail).toMatch(/→\s*next:|next:/);
  });

  // ✅ GRACEFUL-BRICK-UNAVAILABLE — bridge unreachable → graceful message
  it('GRACEFUL-BRICK-UNAVAILABLE: bridge unreachable → graceful message in In-factory section', () => {
    const r = runHelper({ RUNTIME_BRIDGE_AIF_URL: 'http://localhost:1' });
    expect(r.status).toBe(0); // exit 0 — degraded is success per spec
    expect(r.stdout).toMatch(/bridge unreachable|unreachable/i);
  });

  // ✅ NO-CRASH-WHEN-GH-ABSENT — strip PATH so gh is missing
  it('NO-CRASH-WHEN-GH-ABSENT: missing gh → graceful Ready-to-harvest section, exit 0', () => {
    // Constrained PATH with only /usr/bin (typically no gh); helper must degrade.
    const r = spawnSync('bash', [HELPER], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: '/usr/bin:/bin',
        RUNTIME_BRIDGE_AIF_URL: 'http://localhost:1',
      },
    });
    expect(r.status ?? -1).toBe(0);
    expect(r.stdout).toMatch(/Ready-to-harvest/i);
  });
});
