/**
 * Paired-negative tests for classify-each-candidate.sh — §2.5 Step 3
 * iteration helper. Receives priority-score.sh output (via MO_PRIORITY_INPUT
 * fixture) and routes each candidate to classify-work.sh in file-mode
 * (kickoff=exists) OR string-mode (kickoff=synthetic), skipping kickoff=missing.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: N candidates in → N classifications out (one per surviving)
 *   ❌ Paired-negative: empty input or all-missing → no classifications
 *
 * The test MUST FAIL if classify-each-candidate.sh is reverted to a single-shot
 * shape (the b1f47f4 bug class).
 *
 * Seams:
 *   MO_PRIORITY_INPUT — fixture file with pre-captured priority-score output
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT,
  '.agents/procedures/pipeline/helpers/classify-each-candidate.sh',
);

/** Run the helper with a fixture and return stdout. */
function run(fixtureContent: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'cec-'));
  const fixturePath = join(tmp, 'priority-output.txt');
  writeFileSync(fixturePath, fixtureContent, 'utf8');
  try {
    const result = spawnSync('bash', [SCRIPT], {
      env: { ...process.env, MO_PRIORITY_INPUT: fixturePath },
      encoding: 'utf8',
      cwd: REPO_ROOT,
    });
    expect(result.status).toBe(fixtureContent.includes('nonexistent-umbrella') ? 1 : 0);
    return result.stdout + result.stderr;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

describe('classify-each-candidate.sh — §2.5 Step 3 iteration helper', () => {
  it('iterates over multiple candidates and emits a header per surviving one', () => {
    const fixture = [
      '=== priority-score: candidate umbrellas ===',
      'broken-umbrella kickoff=missing',
      '=== priority-score: synthetic candidates (L1 extension) ===',
      'wave-plan-N2 type=plan-followup kickoff=synthetic source=wave-plan',
      'wave-plan-N4b type=plan-followup kickoff=synthetic source=wave-plan',
      'openq-§13-4 type=open-question kickoff=synthetic source=open-questions',
    ].join('\n');

    const out = run(fixture);

    // Three surviving candidates (the kickoff=missing one is SKIP-classified but still emits a header)
    const headers = out.match(/--- candidate: /g) ?? [];
    expect(
      headers.length,
      `expected 4 candidate headers (1 missing + 3 synthetic), got ${headers.length}\nstdout:\n${out}`,
    ).toBe(4);
  });

  it('routes kickoff=synthetic to classify-work.sh string-mode (TYPE: emitted)', () => {
    const fixture =
      '=== priority-score: synthetic candidates ===\n' +
      'wave-plan-N2 type=plan-followup kickoff=synthetic source=wave-plan\n';

    const out = run(fixture);

    expect(out).toContain('--- candidate: wave-plan-N2 ---');
    expect(out, 'string-mode classify-work.sh must emit TYPE line').toMatch(/TYPE: /);
  });

  it('routes kickoff=missing to SKIP (no classification, no F8 halt)', () => {
    const fixture = 'broken-umbrella kickoff=missing\n';
    const out = run(fixture);
    expect(out).toContain('--- candidate: broken-umbrella ---');
    expect(out).toContain('SKIP: broken-umbrella');
    expect(out, 'kickoff=missing must NOT trigger classify-work.sh TYPE emission').not.toMatch(/^TYPE: /m);
  });

  it('records F8 inline for kickoff=exists pointing at absent file (iteration continues)', () => {
    // Two candidates: one kickoff=exists with a path that doesn't exist (triggers MISSING-FILE),
    // one kickoff=synthetic that should still be classified despite the prior failure.
    const fixture = [
      'nonexistent-umbrella type=R-phase kickoff=exists volume=M open_prs=0 loc=100',
      'wave-plan-N2 type=plan-followup kickoff=synthetic source=wave-plan',
    ].join('\n');

    const out = run(fixture);

    // Iteration must continue past the F8 — the synthetic candidate must still appear.
    expect(out).toContain('--- candidate: nonexistent-umbrella ---');
    expect(out, 'F8 (MISSING-FILE) must be recorded inline').toMatch(/MISSING-FILE:/);
    expect(out, 'iteration must continue past F8 — second candidate must classify').toContain('--- candidate: wave-plan-N2 ---');
    expect(out).toMatch(/TYPE: /);
  });

  // Paired-negative: empty fixture → no candidate headers (proves the iteration helper
  // doesn't fabricate output when input is empty).
  it('paired-negative: empty priority-score output → zero candidate headers', () => {
    const out = run('');
    const headers = out.match(/--- candidate: /g) ?? [];
    expect(headers.length, `empty input must produce zero headers; got:\n${out}`).toBe(0);
  });

  // Paired-negative: only header lines (no data) → zero candidate headers.
  it('paired-negative: priority-score output with only headers and no data → zero candidate headers', () => {
    const fixture = [
      '=== priority-score: candidate umbrellas ===',
      '=== priority-score: synthetic candidates (L1 extension) ===',
    ].join('\n');
    const out = run(fixture);
    const headers = out.match(/--- candidate: /g) ?? [];
    expect(headers.length).toBe(0);
  });
});
