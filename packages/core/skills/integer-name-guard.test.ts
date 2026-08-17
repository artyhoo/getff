/**
 * Paired-negative tests for integer-name-guard.sh — SKILL.md §0 pre-invocation
 * guard. Scans an orchestrator-prompts dir and HALTS (exit 2 + stderr ERROR) iff
 * an umbrella directory is named as a bare integer (^[0-9]+$), which would make
 * `/pipeline 1` ambiguous between named dispatch and V4 top-N routing.
 *
 * Principle 02 contract (both arms required):
 *   ✅ Positive: an integer-named umbrella dir → exit 2 + ERROR on stderr
 *   ❌ Paired-negative: no integer-named dir (or empty/absent dir) → exit 0, silent
 *
 * Regression intent: this guard was extracted from an inline §0 compound
 * (`ls … && { echo …; exit 2; }`) whose `exit` subcommand forced the auto-mode
 * safety classifier and broke /pipeline whenever the classifier was
 * unavailable. The test MUST FAIL if the guard stops detecting integer names.
 *
 * Seam:
 *   arg1 — scan dir, or the sentinel `--auto` (passed by the §0 caller so the
 *          invocation carries a trailing arg for the allowlist glob WITHOUT
 *          overriding the resolver; these tests pass a tmp fixture dir instead).
 *
 * `--auto` regression intent (getff#1245): §0 used to pass the framework literal
 * `.claude/orchestrator-prompts`, which in a consumer install names a directory that
 * cannot exist — `[ -d "$dir" ] || exit 0` then short-circuited and the guard was a
 * silent no-op there. The sentinel must therefore reach resolve_orch_home() / the
 * MO_ORCH_PROMPTS_DIR seam, never be treated as a literal path.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const SCRIPT = resolve(
  REPO_ROOT,
  '.claude/skills/pipeline/helpers/integer-name-guard.sh',
);

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length)
    rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

/** Build a tmp orchestrator-prompts fixture with the given subdirs (+ optional files). */
function fixture(subdirs: string[], files: string[] = []): string {
  const tmp = mkdtempSync(join(tmpdir(), 'ing-'));
  tmpDirs.push(tmp);
  for (const d of subdirs) mkdirSync(join(tmp, d), { recursive: true });
  for (const f of files) writeFileSync(join(tmp, f), '', 'utf8');
  return tmp;
}

/** Run the guard against a dir; capture status + streams without throwing. */
function run(
  dir: string,
  env: NodeJS.ProcessEnv = {},
): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('bash', [SCRIPT, dir], {
      encoding: 'utf8',
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    const e = err as {
      status?: number;
      stdout?: string | Buffer;
      stderr?: string | Buffer;
    };
    return {
      status: e.status ?? -1,
      stdout: e.stdout?.toString() ?? '',
      stderr: e.stderr?.toString() ?? '',
    };
  }
}

describe('integer-name-guard.sh — SKILL.md §0 pre-invocation guard', () => {
  it('positive: an integer-named umbrella dir → exit 2 + ERROR naming it', () => {
    const dir = fixture(['1', 'real-umbrella']);
    const { status, stderr } = run(dir);
    expect(status, 'integer-named umbrella must halt with exit 2').toBe(2);
    expect(stderr).toMatch(/umbrella named as integer \('1'\)/);
  });

  it('positive: multi-digit integer name (e.g. "42") is also caught', () => {
    const dir = fixture(['42']);
    const { status, stderr } = run(dir);
    expect(status).toBe(2);
    expect(stderr).toMatch(/umbrella named as integer \('42'\)/);
  });

  it('paired-negative: only non-integer umbrella names → exit 0, silent', () => {
    const dir = fixture([
      'wave-10',
      'meta-orch-no-arg-overview',
      'runtime-bridge',
    ]);
    const { status, stderr } = run(dir);
    expect(status, 'non-integer names must NOT halt').toBe(0);
    expect(stderr).toBe('');
  });

  it('paired-negative: empty orchestrator-prompts dir → exit 0', () => {
    const dir = fixture([]);
    expect(run(dir).status).toBe(0);
  });

  it('paired-negative: absent dir → exit 0 (nothing to guard)', () => {
    const { status } = run(resolve(tmpdir(), 'ing-does-not-exist-xyz'));
    expect(status).toBe(0);
  });

  it('--auto sentinel: resolves the home instead of scanning a dir literally named "--auto"', () => {
    // Positive direction — the sentinel must reach the resolver seam and still catch the
    // integer name. A `--auto` treated as a path would hit `[ -d "$dir" ] || exit 0` and
    // pass vacuously, which is exactly the getff#1245 consumer-install failure.
    const dir = fixture(['3', 'real-umbrella']);
    const { status, stderr } = run('--auto', { MO_ORCH_PROMPTS_DIR: dir });
    expect(
      status,
      '--auto must scan the RESOLVED home, not a literal "--auto" path',
    ).toBe(2);
    expect(stderr).toMatch(/umbrella named as integer \('3'\)/);
  });

  it('--auto sentinel: paired-negative — resolved home with no integer name → exit 0, silent', () => {
    const dir = fixture(['wave-11', 'runtime-bridge']);
    const { status, stderr } = run('--auto', { MO_ORCH_PROMPTS_DIR: dir });
    expect(status).toBe(0);
    expect(stderr).toBe('');
  });

  it('--auto sentinel: an explicit dir still wins over the resolver seam (precedence unchanged)', () => {
    const explicitClean = fixture(['wave-12']);
    const seamDirty = fixture(['9']);
    const { status } = run(explicitClean, { MO_ORCH_PROMPTS_DIR: seamDirty });
    expect(
      status,
      'arg1 as a real path must take precedence over MO_ORCH_PROMPTS_DIR',
    ).toBe(0);
  });

  it('directory-only: a FILE named as an integer does NOT trigger (umbrellas are dirs)', () => {
    // The extracted guard intentionally scans directories only; a stray file
    // named "7" is not an umbrella and must not produce a false halt.
    const dir = fixture(['real-umbrella'], ['7']);
    const { status, stderr } = run(dir);
    expect(status, 'a file named as integer is not an umbrella → no halt').toBe(
      0,
    );
    expect(stderr).toBe('');
  });
});
