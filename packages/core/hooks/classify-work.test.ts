/**
 * Paired-negative contract tests for classify-work.sh — the L4 work-classification
 * heuristic for /pipeline routing (.claude/skills/pipeline/
 * helpers/classify-work.sh).
 *
 * Class C → Class B-via-companion-test (this file is the companion test).
 *
 * Scope: J1 fix from Stage 5 dogfood (research-patches/2026-05-26-meta-orchestrator-
 * stage-5-dogfood.md §5 J1) — non-existent path-shape inputs MUST exit non-zero
 * with MISSING-FILE on stderr, not silently fall through to string-mode.
 *
 *   ✅ EXISTING-FILE-PATH: real file on disk → exit 0, file-mode classification
 *   ✅ DESCRIPTION-STRING-NO-PATH: bare description, no '/' → exit 0, string-mode
 *   ✅ NON-EXISTENT-PATH-SHAPE-MD: 'nonexistent/foo.md' → exit 3, MISSING-FILE
 *   ✅ NON-EXISTENT-PATH-SHAPE-TS: 'src/missing.ts' → exit 3, MISSING-FILE
 *   ✅ NON-EXISTENT-PATH-SHAPE-SH: 'helpers/missing.sh' → exit 3, MISSING-FILE
 *   ✅ STRING-WITH-FILENAME-NO-SLASH: 'fix typo in README.md' → exit 0, string-mode
 *      (boundary preservation — string-mode legitimate when no '/' separator)
 *   ✅ PATH-WITH-NO-EXTENSION: 'src/missing' → exit 0, string-mode
 *      (boundary preservation — no recognised extension = not path-shape)
 *   ✅ EMPTY-ARG: no $1 → exit 2 (usage), distinct from exit 3 (missing-file)
 *   ✅ EXIT-3-VS-EXIT-2-DISTINCT: missing-file ≠ usage error
 *
 * Reference patterns:
 *   packages/core/hooks/parse-override-flags.test.ts (spawnSync shape)
 *   packages/core/hooks/delta-diff.test.ts (spawnSync shape)
 * T3 compliance: each assertion cites helper line/region targeted.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
const HELPER = join(
  REPO_ROOT,
  '.agents/procedures/pipeline/helpers/classify-work.sh',
);

function run(arg: string | null) {
  const args = arg === null ? [HELPER] : [HELPER, arg];
  return spawnSync('bash', args, { encoding: 'utf8' });
}

describe('classify-work.sh — J1 strict path-shape check (Stage 5 §5 J1 fix)', () => {
  it('EXISTING-FILE-PATH: real file on disk → exit 0, file-mode classification', () => {
    const dir = mkdtempSync(join(tmpdir(), 'classify-j1-'));
    const file = join(dir, 'kickoff.md');
    writeFileSync(file, '# fake kickoff\n\nsome content\n');
    try {
      const r = run(file);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^TYPE:\s+/m);
      expect(r.stdout).toMatch(/^LOC:\s+/m);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('DESCRIPTION-STRING-NO-PATH: bare description, no slash → exit 0, string-mode', () => {
    const r = run('fix typo in component');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^TYPE:\s+fix/m);
  });

  it('NON-EXISTENT-PATH-SHAPE-MD: nonexistent path with .md → exit 3 MISSING-FILE', () => {
    const r = run('nonexistent/foo.md');
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/^MISSING-FILE: nonexistent\/foo\.md$/m);
    expect(r.stdout).toBe('');
  });

  it('NON-EXISTENT-PATH-SHAPE-TS: nonexistent path with .ts → exit 3 MISSING-FILE', () => {
    const r = run('src/this-does-not-exist.ts');
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/MISSING-FILE: src\/this-does-not-exist\.ts/);
  });

  it('NON-EXISTENT-PATH-SHAPE-SH: nonexistent path with .sh → exit 3 MISSING-FILE', () => {
    const r = run('helpers/missing-helper.sh');
    expect(r.status).toBe(3);
    expect(r.stderr).toMatch(/MISSING-FILE: helpers\/missing-helper\.sh/);
  });

  it('STRING-WITH-FILENAME-NO-SLASH: filename-mention without separator → string-mode', () => {
    // Boundary case: contains code extension but no '/' separator.
    // Per fix scope, path-shape requires BOTH '/' AND extension; missing '/' → string-mode.
    const r = run('fix typo in README.md');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^TYPE:\s+/m);
  });

  it('PATH-WITH-NO-EXTENSION: slash but no code extension → string-mode', () => {
    // Boundary case: contains '/' but extension not in recognised list.
    // Per fix scope, path-shape requires BOTH; missing extension → string-mode.
    const r = run('src/missing-no-ext');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/^TYPE:\s+/m);
  });

  it('EMPTY-ARG: no $1 → exit 2 (usage), distinct from exit 3', () => {
    const r = run(null);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/usage:/);
  });

  it('EXIT-3-VS-EXIT-2-DISTINCT: missing-file path ≠ usage error', () => {
    // Mutation guard: if someone collapses exit 3 → exit 2, this assertion fails.
    // Distinct exit codes preserve diagnostic resolution: 2 = caller bug (no arg),
    // 3 = data bug (path-shape input, file absent).
    const missing = run('nonexistent/foo.md');
    const usage = run(null);
    expect(missing.status).not.toBe(usage.status);
    expect(missing.status).toBe(3);
    expect(usage.status).toBe(2);
  });

  it('PATH-SHAPE-WITH-EXISTING-FILE: file present → file-mode (not exit 3)', () => {
    // Inverse mutation guard: if someone removes the `[[ ! -f INPUT ]]` clause,
    // every path-shape input (even existing files) would exit 3. This guards
    // against that mutation by asserting an existing path-shape input goes to
    // file-mode classification.
    const dir = mkdtempSync(join(tmpdir(), 'classify-j1-existing-'));
    const file = join(dir, 'present.ts');
    writeFileSync(file, 'export const x = 1;\n');
    try {
      const r = run(file);
      expect(r.status).toBe(0);
      expect(r.stdout).toMatch(/^TYPE:\s+/m);
      expect(r.stderr).not.toMatch(/MISSING-FILE/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
