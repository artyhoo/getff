/**
 * Functional meta-tests for the meta-orchestrator master-backlog-delta read-side
 * helper (.claude/skills/pipeline/helpers/delta-diff.sh) — paired-negative
 * contract for Stage 3 of the meta-orchestrator-mode-triage-and-planner umbrella.
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5 Step 8.
 * Class C → Class B-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract — the helper computes deterministic set differences
 * between .untracked_seen[].id in a delta JSON file and a current id set passed
 * as positional args; emits "NEW-SINCE-LAST: <id>" and "RESOLVED-SINCE-LAST: <id>"
 * lines. Label-mutation falsifier: swapping NEW/RESOLVED prefixes in the helper
 * would cause MIXED-DIFF + ALL-RESOLVED to fail (each asserts both labels with
 * specific id content, not just non-empty output).
 *
 *   ✅ EMPTY-SEEN: missing delta file → every current id emits as NEW
 *   ✅ IDENTICAL: seen == current → silent (0 NEW, 0 RESOLVED)
 *   ✅ MIXED-DIFF: 1 retained + 1 dropped + 1 new → 1 NEW(<new-id>) + 1 RESOLVED(<dropped-id>)
 *   ✅ ALL-RESOLVED: empty current with populated seen → all RESOLVED
 *   ✅ SPECIAL-CHARS: ids with §, /, : (real namespace shapes per priority-score.sh)
 *   ❌ CORRUPT-JSON: invalid JSON → exit 1 + stderr; no output
 *   ❌ BOUNDARY: zero args → exit 2 + usage diagnostic
 *
 * Reference pattern: packages/core/hooks/update-delta.test.ts.
 * T3 compliance: each assertion cites helper line/region targeted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/delta-diff.sh',
);

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'delta-diff-test-'));
  sandboxes.push(d);
  return d;
}

function writeDelta(sandbox: string, seenIds: string[]): string {
  const path = join(sandbox, 'd.json');
  const body = {
    last_check_ts: '2026-05-26T12:00:00Z',
    last_check_git_head: 'abc1234',
    untracked_seen: seenIds.map((id) => ({ id, first_seen: '2026-05-26T12:00:00Z' })),
    closed_since_last: [] as unknown[],
  };
  writeFileSync(path, JSON.stringify(body, null, 2), 'utf8');
  return path;
}

function runHelper(
  ctx: Skippable,
  deltaPath: string,
  currentIds: string[],
): { status: number; stdout: string; stderr: string } {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  const r = spawnBashOrSkip(ctx, 'bash', [HELPER, deltaPath, ...currentIds], { encoding: 'utf8' });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('delta-diff.sh — master-backlog-delta read-side set-diff (paired-negative)', () => {
  it('EMPTY-SEEN: missing delta file → every current id emits as NEW (line ~53 `if [ -f ... ]` false branch)', (ctx) => {
    const sandbox = makeSandbox();
    const r = runHelper(ctx, join(sandbox, 'absent.json'), ['alpha', 'beta']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('NEW-SINCE-LAST: alpha');
    expect(r.stdout).toContain('NEW-SINCE-LAST: beta');
    expect(r.stdout).not.toContain('RESOLVED-SINCE-LAST:');
  });

  it('IDENTICAL: seen == current → silent (line ~65 comm -23 + comm -13 both empty)', (ctx) => {
    const sandbox = makeSandbox();
    const delta = writeDelta(sandbox, ['alpha', 'beta', 'gamma']);
    const r = runHelper(ctx, delta, ['alpha', 'beta', 'gamma']);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('');
  });

  it('MIXED-DIFF: 1 retained + 1 dropped + 1 new → exactly 1 NEW + 1 RESOLVED with correct id-to-label mapping (line ~65-67)', (ctx) => {
    const sandbox = makeSandbox();
    const delta = writeDelta(sandbox, ['alpha', 'beta', 'gamma']);
    // Current: alpha retained, beta retained, gamma dropped, delta new.
    const r = runHelper(ctx, delta, ['alpha', 'beta', 'delta']);
    expect(r.status).toBe(0);

    const newLines = r.stdout.split('\n').filter((l) => l.startsWith('NEW-SINCE-LAST:'));
    const resolvedLines = r.stdout.split('\n').filter((l) => l.startsWith('RESOLVED-SINCE-LAST:'));

    // Label-mutation falsifier: assert the specific id binds to the specific label.
    // Swapping prefixes in the helper would make these assertions fail.
    expect(newLines).toEqual(['NEW-SINCE-LAST: delta']);
    expect(resolvedLines).toEqual(['RESOLVED-SINCE-LAST: gamma']);

    // Retained ids appear nowhere — proves intersection is correctly excluded.
    expect(r.stdout).not.toContain('alpha');
    expect(r.stdout).not.toContain('beta');
  });

  it('ALL-RESOLVED: empty current + populated seen → all RESOLVED, no NEW (line ~67 comm -13 only)', (ctx) => {
    const sandbox = makeSandbox();
    const delta = writeDelta(sandbox, ['x', 'y', 'z']);
    const r = runHelper(ctx, delta, []);
    expect(r.status).toBe(0);

    const newLines = r.stdout.split('\n').filter((l) => l.startsWith('NEW-SINCE-LAST:'));
    const resolvedLines = r.stdout.split('\n').filter((l) => l.startsWith('RESOLVED-SINCE-LAST:'));
    expect(newLines).toEqual([]);
    // Sorted output (sort -u in helper, lines ~57+62).
    expect(resolvedLines).toEqual([
      'RESOLVED-SINCE-LAST: x',
      'RESOLVED-SINCE-LAST: y',
      'RESOLVED-SINCE-LAST: z',
    ]);
  });

  it('SPECIAL-CHARS: ids with §, /, : (real namespace shapes per priority-score.sh) round-trip correctly', (ctx) => {
    const sandbox = makeSandbox();
    const delta = writeDelta(sandbox, ['openq-§13-42', 'todo-packages/core/foo.ts:60']);
    const r = runHelper(ctx, delta, ['openq-§13-42', 'residual-2026-05-25-design-§future']);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('NEW-SINCE-LAST: residual-2026-05-25-design-§future');
    expect(r.stdout).toContain('RESOLVED-SINCE-LAST: todo-packages/core/foo.ts:60');
    expect(r.stdout).not.toContain('NEW-SINCE-LAST: openq-§13-42');
    expect(r.stdout).not.toContain('RESOLVED-SINCE-LAST: openq-§13-42');
  });

  it('CORRUPT-JSON: invalid JSON in delta → exit 1 + stderr (line ~55-57 `jq empty` fail branch)', (ctx) => {
    const sandbox = makeSandbox();
    const path = join(sandbox, 'd.json');
    writeFileSync(path, '{ not valid json', 'utf8');
    const r = runHelper(ctx, path, ['x']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/delta corrupt — invalid JSON/);
    expect(r.stdout.trim()).toBe('');
  });

  it('BOUNDARY: zero args → exit 2 + usage diagnostic (line ~45-48 arg-count check)', (ctx) => {
    // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
    const r = spawnBashOrSkip(ctx, 'bash', [HELPER], { encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/);
  });
});
