/**
 * Tests for plan-drift-write-guard.sh — the deterministic write guard for the pipeline
 * planning §1 Step 3 factual-reconciliation write (GH-4208120881 fix).
 *
 * The Dot system review on artyhoo/getff#2079 (GH-4208120881, 2026-10-09) found the shared-plan
 * write boundary resting on writer self-inspection — attention-is-not-a-mechanism §1 names that
 * as neither a deterministic gate nor a named cold protocol. The guard binds repo/path, the exact
 * pre-image (snapshot sha + unique declared fragment) and the minimal permitted factual diff, and
 * emits a receipt bound to the ACTUAL postimage; strategy-class content routes to the named cold
 * check (.agents/roles/plan-drift-semantic-auditor.md) and is never auto-accepted.
 *
 * Verification arms (per the review's correction):
 *   1. wrong row                      → BLOCKED (rc 1)
 *   2. concurrent pre-image change    → BLOCKED (rc 1)
 *   3. dependency/priority strategy   → SEMANTIC-REVIEW-REQUIRED (rc 3) — routed, not accepted
 *   4. failed write (no change)       → BLOCKED (rc 1)
 *   5. incomplete evidence            → SEMANTIC-REVIEW-REQUIRED (rc 3)
 *   6. exact allowed factual change   → ALLOWED (rc 0) + receipt
 *   7. receipt bound to actual postimage (postimage_sha == sha256 of the live file)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_REAL = resolve(HERE, '../../..');
const GUARD = resolve(
  REPO_ROOT_REAL,
  '.agents/procedures/pipeline/helpers/plan-drift-write-guard.sh',
);

let tmpRoot: string;
const createdDirs: string[] = [];

interface GuardResult {
  status: number;
  stdout: string;
  stderr: string;
}

function sha256(path: string): string {
  return execFileSync(
    'bash',
    ['-c', `if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'; else shasum -a 256 "$1" | awk '{print $1}'; fi`, '_', path],
    { encoding: 'utf8' },
  ).trim();
}

function runGuard(args: string[]): GuardResult {
  const res = spawnSync('bash', [GUARD, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return { status: res.status ?? -1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

const BASE_PLAN = [
  '# Wave sequencing plan',
  '',
  '| Wave | What | Verified status | Evidence |',
  '|---|---|---|---|',
  '| N3 | enforcement substrate | ✅ DONE | #107 MERGED |',
  '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |',
  '| N5 | give the conscience back | 🔲 BLOCKED (dependency): gated on N7 | niche-roadmap §N5 |',
  '',
].join('\n');

/** Fixture: git-init'ed tmp repo with plan.md + pre-image snapshot + its sha. */
function makeFixture(planContent: string = BASE_PLAN): {
  plan: string;
  snapshot: string;
  sha: string;
} {
  const plan = join(tmpRoot, 'plan.md');
  const snapshot = join(tmpRoot, 'preimage.md');
  writeFileSync(plan, planContent, 'utf8');
  writeFileSync(snapshot, planContent, 'utf8');
  return { plan, snapshot, sha: sha256(snapshot) };
}

function guardArgs(f: ReturnType<typeof makeFixture>, target: string, replacement: string): string[] {
  return [
    '--plan', f.plan,
    '--preimage', f.snapshot,
    '--expected-preimage-sha', f.sha,
    '--expect-target', target,
    '--expect-new', replacement,
  ];
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'plan-guard-test-'));
  createdDirs.push(tmpRoot);
  execFileSync('git', ['init', '-q', tmpRoot]);
});

afterEach(() => {
  for (const d of createdDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

const SLOW_SHELL_MS = 30_000;

describe('plan-drift-write-guard.sh — verification arms (GH-4208120881)', { timeout: SLOW_SHELL_MS }, () => {
  it('ARM 6: the exact allowed factual change passes with an ALLOWED receipt', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    const replacement = '| N4a | claim-detector fix | ✅ DONE 2026-10-09 | #98 MERGED, re-verified |';
    writeFileSync(f.plan, BASE_PLAN.replace(target, replacement), 'utf8');

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('PLAN-WRITE-RECEIPT: verdict=ALLOWED');
    expect(r.stdout).toContain('guard=plan-drift-write-guard.sh/1');
  });

  it('ARM 1: an edit to a row OTHER than the declared target is blocked (wrong row)', () => {
    const f = makeFixture();
    // Writer declared N4a but actually edited N3.
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    writeFileSync(
      f.plan,
      BASE_PLAN.replace('| N3 | enforcement substrate | ✅ DONE | #107 MERGED |', '| N3 | enforcement substrate | ✅ DONE 2026-10-09 | #107 MERGED |'),
      'utf8',
    );

    const r = runGuard(guardArgs(f, target, '| N4a | anything |'));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('outside the declared target span');
    expect(r.stdout).not.toContain('PLAN-WRITE-RECEIPT');
  });

  it('ARM 2: a concurrent pre-image change (extra intruder row) is blocked', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    const replacement = '| N4a | claim-detector fix | ✅ DONE 2026-10-09 | #98 MERGED |';
    // The writer's own edit applied, but a concurrent session also added a row elsewhere.
    writeFileSync(
      f.plan,
      (BASE_PLAN.replace(target, replacement) + '| N9 | intruder row | ✅ DONE | 2026-10-09 |\n'),
      'utf8',
    );

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('outside the declared target span');
  });

  it('ARM 2b: a concurrent in-row change is blocked — the landing text is not the declared replacement', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    // The row now carries a concurrent change, not the writer's declared replacement.
    const concurrent = '| N4a | claim-detector fix | ✅ DONE 2026-10-01 | #98 MERGED |';
    writeFileSync(f.plan, BASE_PLAN.replace(target, concurrent), 'utf8');

    const r = runGuard(guardArgs(f, target, '| N4a | claim-detector fix | ✅ DONE 2026-10-09 | #98 MERGED |'));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('does not contain the declared replacement');
  });

  it('ARM 3: a dependency/priority (strategy) edit routes to the cold check (rc 3), never auto-accepted', () => {
    const f = makeFixture();
    const target = '| N5 | give the conscience back | 🔲 BLOCKED (dependency): gated on N7 | niche-roadmap §N5 |';
    const replacement = '| N5 | give the conscience back | ✅ DONE 2026-10-09 | #98 MERGED |';
    writeFileSync(f.plan, BASE_PLAN.replace(target, replacement), 'utf8');

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(3);
    expect(r.stdout).toContain('SEMANTIC-REVIEW-REQUIRED');
    expect(r.stdout).toContain('plan-drift-semantic-auditor');
    expect(r.stdout).not.toContain('PLAN-WRITE-RECEIPT');
  });

  it('ARM 4: a failed write (postimage byte-identical to the pre-image) is blocked', () => {
    const f = makeFixture(); // plan.md untouched == snapshot
    const r = runGuard(guardArgs(f, '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |', '| N4a | x | 2026-10-09 |'));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('failed write');
  });

  it('ARM 5: an evidence-free "factual-looking" replacement routes to the cold check (rc 3)', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    const replacement = '| N4a | claim-detector fix | ✅ DONE | trust me it is fine |';
    writeFileSync(f.plan, BASE_PLAN.replace(target, replacement), 'utf8');

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(3);
    expect(r.stdout).toContain('SEMANTIC-REVIEW-REQUIRED');
    expect(r.stdout).toContain('not mechanically classifiable as factual fields carrying evidence');
  });

  it('ARM 7: the receipt is bound to the ACTUAL postimage sha256', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    const replacement = '| N4a | claim-detector fix | ✅ DONE 2026-10-09 | #98 MERGED |';
    writeFileSync(f.plan, BASE_PLAN.replace(target, replacement), 'utf8');

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(0);
    const m = r.stdout.match(/postimage_sha=([0-9a-f]{64})/);
    expect(m, `receipt with postimage_sha in: ${r.stdout}`).not.toBeNull();
    expect(m![1]).toBe(sha256(f.plan));
  });

  it('a snapshot that is not the bytes that were read (sha mismatch) is blocked', () => {
    const f = makeFixture();
    writeFileSync(f.plan, BASE_PLAN.replace('| #98 MERGED |', '| #98 MERGED, 2026-10-09 |'), 'utf8');
    const r = runGuard([
      '--plan', f.plan,
      '--preimage', f.snapshot,
      '--expected-preimage-sha', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      '--expect-target', '| N4a',
      '--expect-new', '| N4a | y |',
    ]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('pre-image snapshot sha mismatch');
  });

  it('a non-unique declared fragment is blocked (not uniquely identified)', () => {
    const f = makeFixture();
    // Append an IDENTICAL copy of the target row → the fragment occurs twice in the pre-image.
    const dupPlan = BASE_PLAN + '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |\n';
    writeFileSync(f.plan, dupPlan, 'utf8');
    writeFileSync(f.snapshot, dupPlan, 'utf8');
    // The snapshot changed → recompute the expected sha so the sha-mismatch arm does not
    // fire first; this arm isolates the uniqueness check.
    const sha = sha256(f.snapshot);
    const r = runGuard([
      '--plan', f.plan,
      '--preimage', f.snapshot,
      '--expected-preimage-sha', sha,
      '--expect-target', '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |',
      '--expect-new', '| x | 2026-10-09 |',
    ]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('not uniquely identified');
  });

  it('a malformed table row (missing trailing pipe) is blocked as a syntax defect', () => {
    const f = makeFixture();
    const target = '| N4a | claim-detector fix | ✅ DONE | #98 MERGED |';
    const replacement = '| N4a | claim-detector fix | ✅ DONE 2026-10-09 | #98 MERGED';
    writeFileSync(f.plan, BASE_PLAN.replace(target, replacement), 'utf8');

    const r = runGuard(guardArgs(f, target, replacement));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('BLOCKED');
    expect(r.stdout).toContain('table syntax');
  });
});
