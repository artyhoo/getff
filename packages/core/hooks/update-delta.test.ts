/**
 * Functional meta-tests for the meta-orchestrator master-backlog-delta writer
 * (.claude/skills/pipeline/helpers/update-delta.sh) — paired-negative
 * contract for Stage 2B of the meta-orchestrator-mode-triage-and-planner umbrella.
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §2.5 (Stage 2C).
 * Class C → Class A-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract (mirrors update-cache.sh round-3 scope reduction —
 * helper writes ONLY `last_check_ts` + `last_check_git_head` deterministically;
 * arrays `untracked_seen` + `closed_since_last` are populated by SKILL.md §2.5):
 *
 *   ✅ FRESH-DELTA creation: missing file → initial template with all 4 schema keys,
 *      empty arrays, metadata filled from env seams
 *   ✅ IDEMPOTENT update: pre-existing file → ONLY metadata fields rewritten;
 *      array contents (untracked_seen + closed_since_last) preserved verbatim
 *   ❌ MALFORMED handling: file with invalid JSON → exit 1 + stderr diagnostic
 *      + rename to `<basename>.broken.<timestamp>.json`
 *   ❌ BOUNDARY: wrong arg count → exit 2 + usage diagnostic
 *
 * Spawns the real helper with on-disk fixture files in mkdtempSync sandboxes.
 * Uses MO_DELTA_FILE / MO_TIMESTAMP / MO_GIT_HEAD seams to keep tests hermetic —
 * no dependence on git state or wall-clock.
 *
 * Reference pattern: packages/core/hooks/update-cache.test.ts
 * (vitest + spawnSync + mkdtempSync; helper-only, jq required for JSON operations).
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
  '.agents/procedures/pipeline/helpers/update-delta.sh',
);

const FIXED_TS = '2026-05-26T12:00:00Z';
const FIXED_SHA = 'abc1234';
const NEW_TS = '2026-05-26T13:00:00Z';
const NEW_SHA = 'def5678';

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'update-delta-test-'));
  sandboxes.push(d);
  return d;
}

function runHelper(
  deltaPath: string,
  args: [string, string],
  envOverrides: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER, args[0], args[1]], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MO_DELTA_FILE: deltaPath,
      MO_TIMESTAMP: FIXED_TS,
      MO_GIT_HEAD: FIXED_SHA,
      ...envOverrides,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('update-delta.sh — master-backlog-delta writer (paired-negative contract)', () => {
  it('SYMLINK-AWARE: delta symlinked into CANON survives metadata update — share preserved (would FAIL on plain mv)', (ctx) => {
    const sandbox = makeSandbox();
    const canonDir = join(sandbox, 'canon');
    const wtDir = join(sandbox, 'wt');
    mkdirSync(canonDir, { recursive: true });
    mkdirSync(wtDir, { recursive: true });
    const canonDelta = join(canonDir, '_master-backlog-delta.json');
    runHelper(canonDelta, ['seed', 'seed']); // fresh template into canon
    const wtDelta = join(wtDir, '_master-backlog-delta.json');
    // file target: junctions cannot express it → named win32 skip (POSIX unchanged)
    symlinkOrJunctionOrSkip(ctx, canonDelta, wtDelta);

    const r = runHelper(wtDelta, ['umbrella-x', 'outcome-y']);
    expect(r.status).toBe(0);
    expect(lstatSync(wtDelta).isSymbolicLink()).toBe(true); // symlink preserved
    expect(() => JSON.parse(readFileSync(canonDelta, 'utf8'))).not.toThrow(); // canon valid JSON
  });

  it('FRESH-DELTA: missing file → exit 0, template written with all 4 schema keys + empty arrays + correct metadata', () => {
    // Targets helper §write_initial_template + decision-tree branch `if [ ! -f ... ]`
    // (update-delta.sh lines ~68-72: write_initial_template + exit 0).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    expect(existsSync(deltaPath)).toBe(false);

    const r = runHelper(deltaPath, ['test-umbrella', 'smoke outcome']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/fresh delta written/);
    expect(existsSync(deltaPath)).toBe(true);

    const raw = readFileSync(deltaPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      last_check_ts: string;
      last_check_git_head: string;
      untracked_seen: unknown[];
      closed_since_last: unknown[];
    };

    // All 4 schema keys present (design §7.1).
    expect(parsed).toHaveProperty('last_check_ts');
    expect(parsed).toHaveProperty('last_check_git_head');
    expect(parsed).toHaveProperty('untracked_seen');
    expect(parsed).toHaveProperty('closed_since_last');

    // Metadata filled from env seams.
    expect(parsed.last_check_ts).toBe(FIXED_TS);
    expect(parsed.last_check_git_head).toBe(FIXED_SHA);

    // Arrays start empty (Stage 2C populates them).
    expect(parsed.untracked_seen).toEqual([]);
    expect(parsed.closed_since_last).toEqual([]);
  });

  it('IDEMPOTENT: pre-existing file → ONLY metadata fields updated; arrays preserved verbatim', () => {
    // Targets helper §update_existing jq branch (update-delta.sh lines ~54-62:
    // update_existing function with `jq --arg ts --arg sha ...`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');

    // Bootstrap fresh.
    runHelper(deltaPath, ['u1', 'o1']);

    // Manually inject array entries to prove preservation across re-invocations.
    const initial = JSON.parse(readFileSync(deltaPath, 'utf8')) as {
      last_check_ts: string;
      last_check_git_head: string;
      untracked_seen: Array<{ id: string; first_seen: string }>;
      closed_since_last: Array<{ id: string; closed_at: string }>;
    };
    initial.untracked_seen = [{ id: 'manual-x', first_seen: '2026-05-26T00:00:00Z' }];
    initial.closed_since_last = [{ id: 'PR#999', closed_at: '2026-05-26T00:00:00Z' }];
    writeFileSync(deltaPath, JSON.stringify(initial, null, 2), 'utf8');

    // Re-invoke with new timestamp/SHA.
    const r2 = runHelper(deltaPath, ['umbrella-B', 'outcome B'], {
      MO_TIMESTAMP: NEW_TS,
      MO_GIT_HEAD: NEW_SHA,
    });
    expect(r2.status).toBe(0);
    expect(r2.stdout).toMatch(/updated.*umbrella=umbrella-B.*head=def5678/);

    const after = JSON.parse(readFileSync(deltaPath, 'utf8')) as {
      last_check_ts: string;
      last_check_git_head: string;
      untracked_seen: Array<{ id: string; first_seen: string }>;
      closed_since_last: Array<{ id: string; closed_at: string }>;
    };

    // Metadata fields updated to new values.
    expect(after.last_check_ts).toBe(NEW_TS);
    expect(after.last_check_git_head).toBe(NEW_SHA);

    // Arrays preserved verbatim — proves scope contract (helper-scope contract mirrors
    // update-cache.sh round-3; avoids #cache-writer-feature-creep per plan-cache.md §4).
    expect(after.untracked_seen).toEqual([
      { id: 'manual-x', first_seen: '2026-05-26T00:00:00Z' },
    ]);
    expect(after.closed_since_last).toEqual([
      { id: 'PR#999', closed_at: '2026-05-26T00:00:00Z' },
    ]);

    // Old metadata gone.
    expect(after.last_check_ts).not.toBe(FIXED_TS);
    expect(after.last_check_git_head).not.toBe(FIXED_SHA);
  });

  it('MALFORMED: file with invalid JSON → exit 1 + stderr diagnostic + .broken rename', () => {
    // Targets helper malformed-detection branch (update-delta.sh lines ~74-82:
    // `if ! jq empty ...; then` → rename to .broken.*.json + exit 1).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');

    // Bootstrap a valid file, then overwrite with invalid JSON.
    runHelper(deltaPath, ['u1', 'o1']);
    writeFileSync(deltaPath, '{ this is not json }', 'utf8');

    const r = runHelper(deltaPath, ['u2', 'o2']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/delta corrupt — invalid JSON/);
    expect(r.stderr).toMatch(/renamed to .*\.broken\.[0-9T\-]+Z?\.json/);

    // Original path gone after rename.
    expect(existsSync(deltaPath)).toBe(false);

    // Exactly one .broken.*.json file in sandbox dir.
    const brokenFiles = readdirSync(sandbox).filter((f) =>
      /^d\.broken\..*\.json$/.test(f),
    );
    expect(brokenFiles).toHaveLength(1);
  });

  it('BOUNDARY: invocation with wrong arg count → exit 2 + usage diagnostic, no file created', () => {
    // Targets helper arg-count check (update-delta.sh lines ~43-46:
    // `if [ "$#" -ne 2 ]; then ... exit 2`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');

    const r = spawnSync('bash', [HELPER, 'only-one-arg'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        MO_DELTA_FILE: deltaPath,
        MO_TIMESTAMP: FIXED_TS,
        MO_GIT_HEAD: FIXED_SHA,
      },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/);
    expect(existsSync(deltaPath)).toBe(false);
  });
});
