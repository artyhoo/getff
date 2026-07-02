/**
 * Paired-negative test for the bash-mutation wrapper
 * (packages/core/audit-self/run-bash-mutation.sh) — Stage 2 B.2,
 * mutation-discipline-umbrella. Recursive self-application (umbrella §5 + T15):
 * the mutation tool itself carries a paired-negative test, and that test's
 * target (the wrapper .sh) is itself mutatable by bash.rules + analyze_mutants
 * (the recursive bootstrap demonstrated in the shipping research-patch).
 *
 * Delivery channel: SESSION-BOUND / LOCAL. universalmutator is a local pip tool,
 * NOT in CI (maintainer decision 2026-06-01; mirrors Stryker = devDep-only).
 * Therefore this suite `skipIf`s when `mutate`/`analyze_mutants` are absent —
 * it runs green-or-skipped in CI and exercises for real on a dev box that ran
 * `pipx install universalmutator`. Skipping in CI is the CORRECT behaviour for
 * Option B, not a gap.
 *
 * Load-bearing paired-negative contract (the discipline-theatre guard):
 *   ❌ a test command that kills NOTHING (`true`, always exit 0) → every mutant
 *      survives → kill rate 0% → the wrapper MUST exit 1 (FAIL). If the wrapper's
 *      threshold gate were broken (e.g. always `exit 0`), this case catches it —
 *      this is what makes the wrapper itself non-theatrical.
 *   ✅ a test command that kills EVERYTHING (`false`, always non-zero) → every
 *      mutant killed → 100% → exit 0 (PASS).
 *   boundary: no args → exit 2 (usage); operators that match nothing → exit 3.
 *
 * Asserts payload CONTENT (kill-rate line, survivor listing), not just exit code
 * (principle 02 / T-M4-B: exit-code-only would miss a broken survivor report).
 *
 * spec: packages/core/audit-self/bash.rules + run-bash-mutation.sh
 * @dual-pair: mutation-discipline-bash-b2
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
// Recursive bootstrap (shipping research-patch): when the wrapper is itself the
// mutation target, its mutants land in a shadow copy whose path arrives via
// BASHMUT_HOOK — spawn THAT copy so wrapper-mutants are actually exercised.
const WRAPPER = process.env.BASHMUT_HOOK ?? resolve(HERE, 'run-bash-mutation.sh');

function has(cmd: string): boolean {
  try {
    execSync(`command -v ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
// universalmutator is local-only (Option B) — skip the whole suite when absent.
const HAS_UM = has('mutate') && has('analyze_mutants');

const tmpDirs: string[] = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A tiny fixture hook with mutatable tokens (exit 0/1, if [[, ==, &&). */
function writeFixtureHook(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bashmut-fixture-'));
  tmpDirs.push(dir);
  const abs = join(dir, 'fixture-hook.sh');
  writeFileSync(
    abs,
    [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'x="${1:-0}"',
      'if [[ "$x" == "1" ]]; then',
      '  exit 0',
      'fi',
      '[ -n "$x" ] && exit 0',
      'exit 1',
      '',
    ].join('\n'),
    'utf8',
  );
  chmodSync(abs, 0o755);
  return abs;
}

/** Run the wrapper; testCmd runs (cd REPO_ROOT && testCmd) per mutant. */
function runWrapper(hook: string, testCmd: string, floor = '60') {
  return spawnSync('bash', [WRAPPER, hook, testCmd, floor], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
  });
}

describe.skipIf(!HAS_UM)('run-bash-mutation.sh — bash mutation wrapper (paired-negative)', () => {
  it('PAIRED-NEGATIVE: a no-op test (kills nothing) → 0% kill rate → exit 1 (FAIL)', () => {
    const hook = writeFixtureHook();
    // `true` always exits 0 → analyze_mutants sees every mutant as NOT KILLED.
    const r = runWrapper(hook, 'true');
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    expect(out).toMatch(/kill rate: 0%/);
    expect(out).toMatch(/SURVIVING mutants/);
    // at least one survivor line is actually rendered (not an empty section)
    expect(out).toMatch(/- fixture-hook\.mutant\.\d+\.sh:/);
    expect(out).toMatch(/FAIL/);
    expect(r.status).toBe(1);
  });

  it('POSITIVE: a test that kills everything → 100% kill rate → exit 0 (PASS)', () => {
    const hook = writeFixtureHook();
    // `false` always exits non-zero → analyze_mutants marks every mutant KILLED.
    const r = runWrapper(hook, 'false');
    const out = (r.stdout ?? '') + (r.stderr ?? '');
    expect(out).toMatch(/kill rate: 100%/);
    expect(out).toMatch(/PASS/);
    expect(r.status).toBe(0);
  });

  it('BOUNDARY: missing args → usage error → exit 2', () => {
    const r = spawnSync('bash', [WRAPPER], { encoding: 'utf8', cwd: REPO_ROOT });
    expect((r.stderr ?? '')).toMatch(/usage:/);
    expect(r.status).toBe(2);
  });

  it('BOUNDARY: a hook the operators cannot match → no mutants → exit 3', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bashmut-inert-'));
    tmpDirs.push(dir);
    const inert = join(dir, 'inert.sh');
    // no exit/if/&&/comparator/set -e tokens → zero mutants
    writeFileSync(inert, '#!/usr/bin/env bash\necho hello world\n', 'utf8');
    const r = runWrapper(inert, 'true');
    expect(r.status).toBe(3);
  });
});
