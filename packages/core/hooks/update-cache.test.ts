/**
 * Functional meta-tests for the meta-orchestrator plan-cache writer
 * (.claude/skills/pipeline/helpers/update-cache.sh) — paired-negative
 * contract for the umbrella skill-memory deliverable C.
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §10 item 5.
 * Class C → Class A-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract (matches update-cache.sh §1.3 round-3 scope reduction —
 * helper writes ONLY the `## Last invocation` section deterministically):
 *
 *   ✅ FRESH-CACHE creation: missing file → template skeleton + filled `Last invocation`
 *   ✅ IDEMPOTENT update: pre-existing file → ONLY 4 `Last invocation` fields rewritten;
 *      all other sections (including manual hand-edits) preserved verbatim
 *   ❌ MALFORMED handling: file missing `## Last invocation` header → exit 1 + stderr
 *      diagnostic + rename to `<basename>.broken.<timestamp>.md`
 *
 * Spawns the real helper with on-disk fixture files in mkdtempSync sandboxes.
 * Uses MO_CACHE_FILE / MO_TIMESTAMP / MO_GIT_HEAD seams (matches plan-currency-check.sh
 * convention) to keep tests hermetic — no dependence on git state or wall-clock.
 *
 * Reference pattern: packages/core/hooks/check-hook-marker.test.ts
 * (vitest + spawnSync + mkdtempSync; helper-only — no jq needed).
 *
 * T3 compliance: each assertion cites the helper source line/region it targets.
 * T-M4-B compliance: asserts both exit code AND stderr diagnostic / stdout marker.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  lstatSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
  readdirSync,
} from 'node:fs';
import { symlinkOrJunctionOrSkip } from './symlink-or-junction-or-skip.ts';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(
  REPO_ROOT,
  '.agents/procedures/pipeline/helpers/update-cache.sh',
);

const FIXED_TS = '2026-05-25T22:40:00Z';
const FIXED_SHA = 'abc1234';

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'update-cache-test-'));
  sandboxes.push(d);
  return d;
}

function runHelper(
  sandbox: string,
  args: [string, string],
  envOverrides: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const cachePath = join(sandbox, 'cache.md');
  const r = spawnSync('bash', [HELPER, args[0], args[1]], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MO_CACHE_FILE: cachePath,
      MO_TIMESTAMP: FIXED_TS,
      MO_GIT_HEAD: FIXED_SHA,
      ...envOverrides,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('update-cache.sh — plan-cache writer (paired-negative contract)', () => {
  it('SYMLINK-AWARE: cache symlinked into CANON survives update — share preserved (would FAIL on plain mv)', (ctx) => {
    // Regression guard for coordination-persistence SW-B: a shared symlink must be
    // written THROUGH, not replaced. `mv tmp <symlink>` replaces the link → share lost.
    const sandbox = makeSandbox();
    const canonDir = join(sandbox, 'canon');
    const wtDir = join(sandbox, 'wt');
    mkdirSync(canonDir, { recursive: true });
    mkdirSync(wtDir, { recursive: true });
    const canonCache = join(canonDir, '_plan-cache.md');
    // Seed the canonical file with a valid template (helper writes it fresh).
    runHelper(sandbox, ['seed', 'seed'], { MO_CACHE_FILE: canonCache });
    const wtCache = join(wtDir, '_plan-cache.md');
    // file target: junctions cannot express it → named win32 skip (POSIX unchanged)
    symlinkOrJunctionOrSkip(ctx, canonCache, wtCache);

    const r = runHelper(sandbox, ['umbrella-x', 'outcome-y'], { MO_CACHE_FILE: wtCache });
    expect(r.status).toBe(0);
    expect(lstatSync(wtCache).isSymbolicLink()).toBe(true); // symlink preserved
    expect(readFileSync(canonCache, 'utf8')).toMatch(/umbrella-x/); // written through to CANON
  });

  it('FRESH-CACHE: missing file → exit 0, template written with filled `Last invocation`', () => {
    // Targets helper §write_initial_template + decision-tree branch `if [ ! -f ... ]` (line ~95).
    const sandbox = makeSandbox();
    const cachePath = join(sandbox, 'cache.md');
    expect(existsSync(cachePath)).toBe(false);

    const r = runHelper(sandbox, ['skill-memory', 'fresh-cache smoke']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/fresh cache written/);
    expect(existsSync(cachePath)).toBe(true);

    const body = readFileSync(cachePath, 'utf8');
    // All required sections present per umbrella §1.1.
    expect(body).toContain('## Last invocation');
    expect(body).toContain('## Last priority ranking');
    expect(body).toContain('## DRIFT items surfaced last time');
    expect(body).toContain('## DECISION-NEEDED pending maintainer');
    expect(body).toContain('## Deferred follow-ups');
    expect(body).toContain('## Stale-cache marker');
    // @dual-pair marker matching SKILL.md §10 item 5 read-side (umbrella §1.3).
    expect(body).toContain('@dual-pair: meta-orchestrator-plan-cache');
    // `Last invocation` filled from $1 / $2 / MO_TIMESTAMP / MO_GIT_HEAD.
    expect(body).toContain(`- Timestamp (UTC): ${FIXED_TS}`);
    expect(body).toContain('- Umbrella: skill-memory');
    expect(body).toContain(`- Git HEAD: ${FIXED_SHA}`);
    expect(body).toContain('- Session outcome: fresh-cache smoke');
  });

  it('IDEMPOTENT: pre-existing file → only the 4 `Last invocation` fields change; other sections preserved verbatim', () => {
    // Targets helper §update_existing awk state-machine (line ~115).
    const sandbox = makeSandbox();

    // First invocation: bootstrap.
    runHelper(sandbox, ['umbrella-A', 'outcome A']);

    // Manually edit a non-«Last invocation» section to prove preservation.
    const cachePath = join(sandbox, 'cache.md');
    const hand = readFileSync(cachePath, 'utf8').replace(
      '## DRIFT items surfaced last time\n<numbered list from §1 verdict, with resolution status: RESOLVED / OPEN / STALE — populated by direct Edit>',
      '## DRIFT items surfaced last time\n1. DRIFT-manual-edit: this line MUST survive idempotent update — proves the awk state machine is scoped to `## Last invocation` only.',
    );
    writeFileSync(cachePath, hand, 'utf8');

    // Second invocation with different args + different timestamp / SHA.
    const NEW_TS = '2026-05-25T23:00:00Z';
    const NEW_SHA = 'def5678';
    const r2 = runHelper(sandbox, ['umbrella-B', 'outcome B'], {
      MO_TIMESTAMP: NEW_TS,
      MO_GIT_HEAD: NEW_SHA,
    });
    expect(r2.status).toBe(0);
    expect(r2.stdout).toMatch(/updated.*umbrella=umbrella-B.*head=def5678/);

    const after = readFileSync(cachePath, 'utf8');
    // Last invocation fields updated.
    expect(after).toContain(`- Timestamp (UTC): ${NEW_TS}`);
    expect(after).toContain('- Umbrella: umbrella-B');
    expect(after).toContain(`- Git HEAD: ${NEW_SHA}`);
    expect(after).toContain('- Session outcome: outcome B');
    // Old fields gone.
    expect(after).not.toContain(`- Timestamp (UTC): ${FIXED_TS}`);
    expect(after).not.toContain('- Umbrella: umbrella-A');
    expect(after).not.toContain('- Session outcome: outcome A');
    // Manual edit preserved verbatim — proves scope is `## Last invocation` only.
    expect(after).toContain('DRIFT-manual-edit: this line MUST survive');
  });

  it('MALFORMED: file missing `## Last invocation` header → exit 1 + stderr diagnostic + .broken rename', () => {
    // Targets helper malformed-detection branch (line ~120, `if ! grep -q`).
    const sandbox = makeSandbox();
    const cachePath = join(sandbox, 'cache.md');

    // Bootstrap a valid file, then corrupt the section header. Use anchored regex so
    // only the literal section-header line is replaced — the prose blockquote on line ~3
    // contains the substring `## Last invocation` inline; helper's grep is line-anchored
    // (`grep -q '^## Last invocation$'`) so the bare-string replace would miss the real target.
    runHelper(sandbox, ['umbrella-A', 'outcome A']);
    const bad = readFileSync(cachePath, 'utf8').replace(
      /^## Last invocation$/m,
      '## BORKED',
    );
    writeFileSync(cachePath, bad, 'utf8');

    const r = runHelper(sandbox, ['umbrella-X', 'outcome X']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/cache corrupt — missing '## Last invocation' header/);
    expect(r.stderr).toMatch(/renamed to .*\.broken\.[\d-T]+Z?\.md/);
    // Original path gone; .broken file present.
    expect(existsSync(cachePath)).toBe(false);
    const brokenFiles = readdirSync(sandbox).filter((f) =>
      /^cache\.broken\..*\.md$/.test(f),
    );
    expect(brokenFiles).toHaveLength(1);
  });

  it('BOUNDARY: invocation with wrong arg count → exit 2 + usage diagnostic', () => {
    // Targets helper arg-count check (line ~43, `if [ "$#" -ne 2 ]`).
    const sandbox = makeSandbox();
    const cachePath = join(sandbox, 'cache.md');
    const r = spawnSync('bash', [HELPER, 'only-one-arg'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MO_CACHE_FILE: cachePath,
        MO_TIMESTAMP: FIXED_TS,
        MO_GIT_HEAD: FIXED_SHA,
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/);
    expect(existsSync(cachePath)).toBe(false);
  });
});
