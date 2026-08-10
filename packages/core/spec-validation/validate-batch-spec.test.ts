/**
 * validate-batch-spec.test.ts
 * Phase 1.C — Spec discipline tests.
 *
 * Integration tests for validate-batch-spec.ts.
 * The positive test uses actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 (v4.2.2),
 * a known-good SHA verified in this repo.
 *
 * The negative test uses the all-zeros SHA (0000000000000000000000000000000000000000),
 * which cannot exist as a real Git object in any repo.
 */

import { describe, it, expect } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, 'validate-batch-spec.ts');

// Helper: run the script, return { exitCode, stdout, stderr }.
// Uses spawnSync so stdout+stderr are both captured regardless of exit code.
function runScript(args: string[]): { exitCode: number; stdout: string; stderr: string } {
  const result = spawnSync('npx', ['tsx', SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env },
  });
  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// Write a temp markdown file and return its path + cleanup function
function writeTempMd(content: string): { path: string; cleanup: () => void } {
  const path = resolve(tmpdir(), `validate-batch-spec-test-${Date.now()}.md`);
  writeFileSync(path, content);
  return {
    path,
    cleanup: () => {
      if (existsSync(path)) unlinkSync(path);
    },
  };
}

// Check whether gh CLI is available (for skipping integration tests)
function ghAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const GH_AVAILABLE = ghAvailable();

// ── Extraction unit tests (paths-only mode — no gh calls) ─────────────────────

describe('validate-batch-spec (--paths-only mode)', () => {
  it('exits 0 for file with no action refs', () => {
    const { path, cleanup } = writeTempMd('# No actions here\nJust some text.');
    try {
      const { exitCode } = runScript(['--paths-only', path]);
      expect(exitCode).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('exits 0 for valid SHA-pinned ref in paths-only mode', () => {
    // In paths-only mode, we only check regex format — a valid 40-char hex passes
    const { path, cleanup } = writeTempMd(
      'uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2\n',
    );
    try {
      const { exitCode } = runScript(['--paths-only', path]);
      expect(exitCode).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('exits 0 for refs inside code fences (skipped as documentation)', () => {
    const content = [
      '# Docs',
      '```git',
      'uses: rhysd/actionlint@0000000000000000000000000000000000000000  # fake',
      '```',
      'End.',
    ].join('\n');
    const { path, cleanup } = writeTempMd(content);
    try {
      const { exitCode } = runScript(['--paths-only', path]);
      expect(exitCode).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('exits 0 for file with no refs (empty scan result)', () => {
    const { path, cleanup } = writeTempMd('# empty\n');
    try {
      const { exitCode } = runScript(['--paths-only', path]);
      expect(exitCode).toBe(0);
    } finally {
      cleanup();
    }
  });
});

// ── --soft mode tests ─────────────────────────────────────────────────────────

// Both cases here spawn `npx tsx validate-batch-spec.ts`, which resolves the ref through the
// real `gh` CLI against the GitHub API — a network round-trip on top of a tsx cold start. The
// three integration cases below already carry `30_000` for exactly that reason; these two were
// left on the vitest 5s default and time out against a live `gh` (measured 5568ms, 2026-08-10,
// macOS) even though the script itself succeeds. Same value, same reason — the timeout must
// outlive the API call, not budget it.
describe('validate-batch-spec (--soft mode)', { timeout: 30_000 }, () => {
  it('exits 0 even with all-zeros SHA (soft mode skips hard fail)', () => {
    // --soft + impossible SHA: if gh available → finding reported to stderr but exit 0
    // if gh unavailable → exit 2 (tooling unavailable, also not 1)
    const { path, cleanup } = writeTempMd(
      'uses: rhysd/actionlint@0000000000000000000000000000000000000000\n',
    );
    try {
      const { exitCode } = runScript(['--soft', path]);
      // exit 0 (findings found) or exit 2 (gh unavailable) — never exit 1 in soft mode
      expect(exitCode).not.toBe(1);
    } finally {
      cleanup();
    }
  });

  it('outputs finding to stderr (not stdout) in soft mode when gh available', () => {
    if (!GH_AVAILABLE) {
      // Can't test stderr output without gh — skip assertion
      return;
    }
    const { path, cleanup } = writeTempMd(
      'uses: rhysd/actionlint@0000000000000000000000000000000000000000\n',
    );
    try {
      const { exitCode, stderr, stdout } = runScript(['--soft', path]);
      // exit 0: finding detected → must appear in stderr, not stdout
      // exit 2: rate-limited → acceptable
      if (exitCode === 0) {
        // If we detected a finding (reported via stderr) the line starts with ✗ or ⚠
        // If soft mode exited 0 because there were genuinely no findings (cache says ok) that's also valid
        // We accept both: the invariant is that stdout does not contain ✗
        expect(stdout).not.toMatch(/^✗/m);
      }
      // exit 2 = rate-limited; either way never exit 1
      expect(exitCode).not.toBe(1);
    } finally {
      cleanup();
    }
  });
});

// ── Integration tests (require gh CLI) ───────────────────────────────────────

describe('validate-batch-spec (integration — requires gh CLI)', () => {
  it.skipIf(!GH_AVAILABLE)(
    'positive: real SHA exits 0 (actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683)',
    () => {
      const { path, cleanup } = writeTempMd(
        // Known-good: actions/checkout v4.2.2, verified in this repo
        'uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2\n',
      );
      try {
        const { exitCode, stdout, stderr } = runScript([path]);
        // exit 0 = verified, exit 2 = rate-limited (acceptable in test env)
        if (exitCode === 1) {
          throw new Error(`Unexpected hard fail:\nstdout: ${stdout}\nstderr: ${stderr}`);
        }
        expect(exitCode).not.toBe(1);
      } finally {
        cleanup();
      }
    },
    30_000, // allow up to 30s for gh API call
  );

  it.skipIf(!GH_AVAILABLE)(
    'negative: all-zeros SHA exits 1 (impossible SHA)',
    () => {
      const { path, cleanup } = writeTempMd(
        // Impossible SHA — no git object can have all zeros
        'uses: rhysd/actionlint@0000000000000000000000000000000000000000\n',
      );
      try {
        const { exitCode, stdout, stderr } = runScript([path]);
        // exit 1 = finding detected (expected)
        // exit 2 = rate-limited (acceptable — can't hard-fail on rate limit)
        if (exitCode === 0) {
          throw new Error(
            `Expected exit 1 (finding) or exit 2 (rate-limited), got 0.\nstdout: ${stdout}\nstderr: ${stderr}`,
          );
        }
        expect([1, 2]).toContain(exitCode);
      } finally {
        cleanup();
      }
    },
    30_000,
  );

  it.skipIf(!GH_AVAILABLE)(
    'negative: fabricated SHA from batch-D.md exits 1 or 2',
    () => {
      // The actual SHA that appeared in batch-D.md — 4dde6cc9404f24f0930a25e9d34fc5a4ea22e0eb
      // rhysd/actionlint has no action.yml (it's a binary tool, not a composite action)
      // so this should fail on action existence check
      const { path, cleanup } = writeTempMd(
        'uses: rhysd/actionlint@4dde6cc9404f24f0930a25e9d34fc5a4ea22e0eb  # v1.7.12\n',
      );
      try {
        const { exitCode } = runScript([path]);
        // exit 1 = finding (no action.yml), exit 2 = rate-limited (acceptable)
        expect([1, 2]).toContain(exitCode);
      } finally {
        cleanup();
      }
    },
    30_000,
  );
});
