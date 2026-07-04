/**
 * Refusal-RED gate for the per-harness rule-channel matrix (CTX Stage 3,
 * scripts/render-rule-channels.mjs, "channel-as-data" lite — design §4 Тезис B).
 *
 * Channel: test:hooks (`vitest run hooks/`), already armed in CI at
 * audit-self.yml:244 — no workflow edit needed (same channel as the sibling
 * harness-config-drift.test.ts, #894).
 *
 * Two enforcement surfaces:
 *   • REAL-TREE (always in CI): `.ai-factory/rule-channel-capabilities.json` +
 *     `.ai-factory/rule-channel-degradations.json` are BOTH tracked → `--check`
 *     against the repo root verifies the live-computed matrix has zero
 *     undeclared refusals and the manifest is not stale, every run.
 *   • SANDBOX (N-S3-a paired-negative): a mutated COPY of the capability matrix
 *     (never the real tree) that removes zcode's only fallback primitives,
 *     forcing every zcode verdict to "refused" — proving the gate actually
 *     fires RED when a refusal goes undeclared, not just that it stays green
 *     on an already-honest tree (the T2 "gate never actually tested" class).
 *
 * Paired-negative contract (N-S3-a):
 *   N-S3-a  zcode loses postToolUseInject+sessionStartHook -> --check exit 1,
 *           names every undeclared (rule,harness) pair + manifest drift lines.
 *   P1      fresh sandbox (real matrix + manifest copied verbatim) -> exit 0.
 *
 * honest-degraded invariant (attention-is-not-a-mechanism.md §1): a `refused`
 * verdict not present in the tracked degradation manifest is a GATE FAILURE
 * (exit 1), never a silently-dropped row or a prose warning.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const GEN = resolve(REPO_ROOT, 'scripts/render-rule-channels.mjs');

function run(root: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync('node', [GEN, ...args, '--root', root], { encoding: 'utf8' });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const sandboxes: string[] = [];
/** A fresh tmpdir carrying the real matrix + manifest + rule population (never the real tree). */
function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rule-channels-'));
  sandboxes.push(dir);
  mkdirSync(join(dir, '.ai-factory'), { recursive: true });
  mkdirSync(join(dir, '.claude/rules'), { recursive: true });
  copyFileSync(
    join(REPO_ROOT, '.ai-factory/rule-channel-capabilities.json'),
    join(dir, '.ai-factory/rule-channel-capabilities.json'),
  );
  copyFileSync(
    join(REPO_ROOT, '.ai-factory/rule-channel-capabilities.schema.json'),
    join(dir, '.ai-factory/rule-channel-capabilities.schema.json'),
  );
  copyFileSync(
    join(REPO_ROOT, '.ai-factory/rule-channel-degradations.json'),
    join(dir, '.ai-factory/rule-channel-degradations.json'),
  );
  // Copy the real rule population so the sandbox has an in-scope rule set identical
  // to the real tree's. computeMatrix()'s file lookup tries `git ls-files` first and
  // falls back to plain readdirSync when git is unavailable (no .git dir in this
  // tmpdir) — so a verbatim file copy, without `git init`, is sufficient here.
  const rulesDir = join(REPO_ROOT, '.claude/rules');
  for (const f of readdirSync(rulesDir)) {
    if (f.endsWith('.md')) copyFileSync(join(rulesDir, f), join(dir, '.claude/rules', f));
  }
  return dir;
}
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p: string, v: unknown) => writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`);

afterAll(() => { for (const d of sandboxes) rmSync(d, { recursive: true, force: true }); });

describe('rule-channel-degradation — real tree (always gated in CI)', () => {
  it('the live-computed matrix has zero undeclared refusals and the manifest is current', () => {
    const { status, out } = run(REPO_ROOT, '--check');
    expect(status, out).toBe(0);
    expect(out).toMatch(/0 undeclared refusals/);
  });
});

describe('rule-channel-degradation — negative (N-S3-a)', () => {
  it('N-S3-a: a forced refusal (zcode loses its fallback primitives) is caught — exit 1, names every gap', () => {
    const s = sandbox();
    const capsPath = join(s, '.ai-factory/rule-channel-capabilities.json');
    const caps = readJson(capsPath);
    caps.harnesses.zcode.postToolUseInject = false;
    caps.harnesses.zcode.sessionStartHook = false;
    writeJson(capsPath, caps);

    const c = run(s, '--check');
    expect(c.status).toBe(1);
    expect(c.out).toContain('UNDECLARED REFUSALS');
    expect(c.out).toContain('zcode: refused, but not declared');
    // At least one Tier-0 rule and one paths:-rule must both be named — proving the
    // negative reaches BOTH branches of computeVerdict(), not just one.
    expect(c.out).toContain('ai-laziness-traps on zcode');
    expect(c.out).toContain('ci-tool-pinning on zcode');
    // Manifest drift is ALSO reported (previously-declared "degraded" rows are now stale).
    expect(c.out).toContain('MANIFEST DRIFT');
  });

  it('P1: an untouched sandbox copy of the real matrix + manifest stays green', () => {
    const s = sandbox();
    const c = run(s, '--check');
    expect(c.status, c.out).toBe(0);
  });
});
