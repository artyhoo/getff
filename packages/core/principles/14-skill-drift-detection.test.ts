/**
 * Principle 14 — Skill drift detection (D-AuditC-5 channel 3 / CI last resort)
 *
 * Verifies that scripts/check-skill-drift.sh exists, is executable, and
 * reports 0 broken refs + 0 missing frontmatter on the current repo state.
 *
 * Channel architecture (per decisions.md D-AuditC-5):
 *   Channel 1 — edit-time:  npm run check:skill-drift  (invokes the script directly)
 *   Channel 2 — pre-push:   .husky/pre-push section 3b  ([ -x ] guarded invocation)
 *   Channel 3 — CI/vitest:  this test  (delegates to the script; no logic re-impl)
 *
 * Slot 14 rationale: 1A workstream reserves 11 (BFR-default), 12 (ai-laziness-traps),
 * 13 (phase-research-coverage promo). Vitest uses glob — non-contiguous is fine.
 */
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const SCRIPT = resolve(REPO_ROOT, 'scripts/check-skill-drift.sh');

/**
 * Timeout for the script-spawning test. check-skill-drift.sh sweeps every SKILL.md in
 * ~1.5s in isolation, but under full-suite file-parallelism (.husky/pre-push runs
 * `npm test --workspace=@rules-as-tests/core`) it competes with other bash-spawning
 * principle tests and can exceed vitest's 5s default — a false timeout fail, not a
 * drift finding. Mirrors 20-bundle-classification's SLOW_SHELL_MS.
 */
const SLOW_SHELL_MS = 30_000;

describe('Principle 14 — skill drift detection (D-AuditC-5 channel 3 / CI last resort)', () => {
  it('script exists at scripts/check-skill-drift.sh and is executable', () => {
    const stat = statSync(SCRIPT);
    // 0o100 = owner execute bit
    expect(stat.mode & 0o100, 'script must be executable (owner bit)').toBeGreaterThan(0);
  });

  it('detects 0 broken refs and 0 missing frontmatter in current repo state', { timeout: SLOW_SHELL_MS }, () => {
    const result = spawnSync('bash', [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });

    // Exit 0 = clean. Exit 1 = broken-ref or missing-frontmatter detected.
    // Exit 127 = script missing (W3-1 not landed — would fail the previous test too).
    expect(
      result.status,
      `script stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    ).toBe(0);
  });
});
