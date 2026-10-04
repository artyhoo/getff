/**
 * Functional meta-tests for the meta-orchestrator master-backlog-delta arrays writer
 * (.claude/skills/pipeline/helpers/delta-write-from-state.sh) — paired-negative
 * contract for F.3 helper-collapse (meta-orch-f3-iphase umbrella, 2026-05-28).
 *
 * Channel: in-session helper invoked via Bash tool from SKILL.md §10 step 5b.
 * Class C → Class A-via-companion-test (this file is the companion test).
 *
 * Paired-negative contract (sibling-helper to update-delta.sh, scope = arrays only):
 *
 *   ✅ HAPPY-PATH: existing delta + valid args → arrays rewritten with {id, first_seen|closed_at}
 *      shape, metadata preserved verbatim
 *   ✅ IDEMPOTENT: second invocation with same args reproduces identical file content
 *      (modulo timestamp seam)
 *   ❌ MISSING-DELTA: delta file missing → exit 1 + stderr diagnostic "run update-delta.sh first"
 *   ❌ CORRUPT-DELTA: existing delta is invalid JSON → exit 1 + .broken rename + stderr diagnostic
 *   ❌ INVALID-CURRENT-JSON: current_ids arg is not a JSON array → exit 1 + stderr diagnostic
 *   ❌ INVALID-RESOLVED-JSON: resolved_ids arg is not a JSON array → exit 1 + stderr diagnostic
 *   ❌ BOUNDARY: wrong arg count → exit 2 + usage diagnostic, delta untouched
 *
 * Spawns the real helper with on-disk fixture files in mkdtempSync sandboxes.
 * Uses MO_DELTA_FILE / MO_TIMESTAMP seams to keep tests hermetic.
 *
 * Reference pattern: packages/core/hooks/update-delta.test.ts
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
  '.claude/skills/pipeline/helpers/delta-write-from-state.sh',
);
const BOOTSTRAP_HELPER = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/update-delta.sh',
);

const FIXED_TS = '2026-05-28T12:00:00Z';
const NEW_TS = '2026-05-28T13:00:00Z';
const FIXED_SHA = 'abc1234';

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'delta-write-from-state-test-'));
  sandboxes.push(d);
  return d;
}

function bootstrapDelta(deltaPath: string): void {
  // Bootstrap a valid delta via update-delta.sh (sibling helper owns fresh-template).
  const r = spawnSync('bash', [BOOTSTRAP_HELPER, 'bootstrap', 'init'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MO_DELTA_FILE: deltaPath,
      MO_TIMESTAMP: FIXED_TS,
      MO_GIT_HEAD: FIXED_SHA,
    },
  });
  expect(r.status).toBe(0);
}

function runHelper(
  deltaPath: string,
  args: string[],
  envOverrides: Record<string, string> = {},
): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bash', [HELPER, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      MO_DELTA_FILE: deltaPath,
      MO_TIMESTAMP: NEW_TS,
      ...envOverrides,
    },
  });
  return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

describe('delta-write-from-state.sh — arrays-only writer (paired-negative contract)', () => {
  it('SYMLINK-AWARE: delta symlinked into CANON survives array rewrite — share preserved (would FAIL on plain mv)', (ctx) => {
    const sandbox = makeSandbox();
    const canonDir = join(sandbox, 'canon');
    const wtDir = join(sandbox, 'wt');
    mkdirSync(canonDir, { recursive: true });
    mkdirSync(wtDir, { recursive: true });
    const canonDelta = join(canonDir, '_master-backlog-delta.json');
    bootstrapDelta(canonDelta); // valid delta into canon
    const wtDelta = join(wtDir, '_master-backlog-delta.json');
    // file target: junctions cannot express it → named win32 skip (POSIX unchanged)
    symlinkOrJunctionOrSkip(ctx, canonDelta, wtDelta);

    const r = runHelper(wtDelta, [
      'umbrella-x',
      JSON.stringify(['a', 'b']),
      JSON.stringify(['c']),
    ]);
    expect(r.status).toBe(0);
    expect(lstatSync(wtDelta).isSymbolicLink()).toBe(true); // symlink preserved
    const obj = JSON.parse(readFileSync(canonDelta, 'utf8'));
    expect(obj.untracked_seen.map((x: { id: string }) => x.id)).toEqual(['a', 'b']); // written through
  });

  it('HAPPY-PATH: existing delta + valid args → arrays rewritten with id/first_seen|closed_at, metadata preserved', () => {
    // Targets helper jq rewrite branch (delta-write-from-state.sh §jq block):
    // `.untracked_seen = ($current | map({id: ., first_seen: $now}))` etc.
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    bootstrapDelta(deltaPath);

    const r = runHelper(deltaPath, [
      'test-umbrella',
      JSON.stringify(['PR#100', 'PR#101']),
      JSON.stringify(['PR#42']),
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/arrays updated.*current=2.*resolved=1/);

    const parsed = JSON.parse(readFileSync(deltaPath, 'utf8')) as {
      last_check_ts: string;
      last_check_git_head: string;
      untracked_seen: Array<{ id: string; first_seen: string }>;
      closed_since_last: Array<{ id: string; closed_at: string }>;
    };

    // Arrays wrapped with correct shape + timestamp seam.
    expect(parsed.untracked_seen).toEqual([
      { id: 'PR#100', first_seen: NEW_TS },
      { id: 'PR#101', first_seen: NEW_TS },
    ]);
    expect(parsed.closed_since_last).toEqual([{ id: 'PR#42', closed_at: NEW_TS }]);

    // Metadata preserved verbatim from bootstrap (sibling-helper scope contract).
    expect(parsed.last_check_ts).toBe(FIXED_TS);
    expect(parsed.last_check_git_head).toBe(FIXED_SHA);
  });

  it('IDEMPOTENT: second invocation with same args reproduces identical file content', () => {
    // Targets idempotency of the jq rewrite (atomic write via mktemp + mv).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    bootstrapDelta(deltaPath);

    const args = ['u', JSON.stringify(['A', 'B']), JSON.stringify(['C'])];
    const r1 = runHelper(deltaPath, args);
    expect(r1.status).toBe(0);
    const after1 = readFileSync(deltaPath, 'utf8');

    const r2 = runHelper(deltaPath, args);
    expect(r2.status).toBe(0);
    const after2 = readFileSync(deltaPath, 'utf8');

    expect(after2).toBe(after1);
  });

  it('MISSING-DELTA: delta file missing → exit 1 + stderr diagnostic', () => {
    // Targets helper missing-file branch (delta-write-from-state.sh:
    // `if [ ! -f "${DELTA_FILE}" ]; then ... exit 1`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    expect(existsSync(deltaPath)).toBe(false);

    const r = runHelper(deltaPath, ['u', '[]', '[]']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/delta file missing/);
    expect(r.stderr).toMatch(/run update-delta\.sh first/);
  });

  it('CORRUPT-DELTA: existing delta is invalid JSON → exit 1 + .broken rename + stderr diagnostic', () => {
    // Targets helper malformed-delta branch (delta-write-from-state.sh:
    // `if ! jq empty "${DELTA_FILE}" 2>/dev/null; then ... rename + exit 1`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    writeFileSync(deltaPath, '{ this is not json }', 'utf8');

    const r = runHelper(deltaPath, ['u', '[]', '[]']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/delta corrupt — invalid JSON/);
    expect(r.stderr).toMatch(/renamed to .*\.broken\.[0-9T\-]+Z?\.json/);
    expect(existsSync(deltaPath)).toBe(false);

    const brokenFiles = readdirSync(sandbox).filter((f) =>
      /^d\.broken\..*\.json$/.test(f),
    );
    expect(brokenFiles).toHaveLength(1);
  });

  it('INVALID-CURRENT-JSON: current_ids arg is not a JSON array → exit 1 + stderr diagnostic, delta untouched', () => {
    // Targets helper input-validation branch (delta-write-from-state.sh:
    // `if ! echo "${CURRENT_JSON}" | jq -e 'type == "array"' ...; then exit 1`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    bootstrapDelta(deltaPath);
    const before = readFileSync(deltaPath, 'utf8');

    const r = runHelper(deltaPath, ['u', 'not-json', '[]']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/<current_ids_json_array> is not a valid JSON array/);

    // Delta untouched — fail-fast before mutation.
    expect(readFileSync(deltaPath, 'utf8')).toBe(before);
  });

  it('INVALID-RESOLVED-JSON: resolved_ids arg is not a JSON array → exit 1 + stderr diagnostic, delta untouched', () => {
    // Targets helper input-validation second branch (delta-write-from-state.sh:
    // `if ! echo "${RESOLVED_JSON}" | jq -e 'type == "array"' ...; then exit 1`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    bootstrapDelta(deltaPath);
    const before = readFileSync(deltaPath, 'utf8');

    const r = runHelper(deltaPath, ['u', '[]', '{"not":"array"}']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/<resolved_ids_json_array> is not a valid JSON array/);

    // Delta untouched — fail-fast before mutation.
    expect(readFileSync(deltaPath, 'utf8')).toBe(before);
  });

  it('BOUNDARY: wrong arg count → exit 2 + usage diagnostic, no file mutated', () => {
    // Targets helper arg-count check (delta-write-from-state.sh:
    // `if [ "$#" -ne 3 ]; then ... exit 2`).
    const sandbox = makeSandbox();
    const deltaPath = join(sandbox, 'd.json');
    bootstrapDelta(deltaPath);
    const before = readFileSync(deltaPath, 'utf8');

    const r = runHelper(deltaPath, ['only-one-arg']);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/);
    expect(readFileSync(deltaPath, 'utf8')).toBe(before);
  });
});
