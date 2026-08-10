/**
 * Paired-negative meta-test for dup-detect.sh's MO_SKIP_CLOSED opt-in (Caller B).
 *
 * Context (pipeline no-arg overview timeout fix): the `/pipeline` §2.5 Step 2 fence runs
 * `dup-detect.sh` with an empty umbrella → the `--all` self-discovering glob path. With
 * 250+ umbrellas (177 already closed via done.md) that full-population scan overran the
 * 120s harness `!`-fence. MO_SKIP_CLOSED=1 lets Caller B drop the already-closed umbrellas
 * (done.md present) BEFORE the expensive per-umbrella scan, while keeping the DEFAULT
 * (flag unset) fully closure-agnostic — dup-detect does not decide what is "closed" unless
 * explicitly told to.
 *
 * Paired-negative contract:
 *   ✅ POS      : MO_SKIP_CLOSED=1 on the glob path → done.md umbrellas are SKIPPED
 *                 (absent from output); open umbrellas are still scanned.
 *   ❌ NEG      : flag unset → done.md umbrellas are STILL scanned (default unchanged —
 *                 mirrors dup-detect.test.ts Test 11 paired-negative). If this arm ever
 *                 goes green while POS is also green, the skip became unconditional (a
 *                 behaviour-change regression), so the pair is a genuine guard.
 *   ✅ ISOLATE : MO_SKIP_CLOSED=1 + MO_UMBRELLA_SUBSET including a done.md name → the
 *                 subset path is authoritative and IGNORES the flag (done.md name scanned).
 *   ✅ NAMED   : MO_SKIP_CLOSED=1 + a single closed umbrella name → still checked (the flag
 *                 only guards the mass glob, never single-name mode).
 *
 * gh is mocked to return `[]` (no merged PRs) and GIT_DIR is nulled, so every SCANNED
 * umbrella resolves to a single `OK: <name> ...` line and a SKIPPED umbrella is absent.
 *
 * Reference pattern: packages/core/skills/dup-detect.test.ts +
 * packages/core/hooks/dup-detect-empty-arg.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, '.claude/skills/pipeline/helpers/dup-detect.sh');

// Every test here spawns the real dup-detect.sh, which walks a sandbox umbrella
// tree and shells out per umbrella — multi-second runtimes are inherent, so the
// vitest 5s default is a mis-set gate rather than a signal. Run in isolation the
// cases measure 3.3-3.6s; under full-suite parallel load (`vitest run hooks/
// skills/`, measured 2026-08-10) they time out at 5000ms. 30_000 is the
// SLOW_SHELL_MS convention already used by the sibling shell-spawning suites
// (priority-score-synthetic, priority-score-skip-closed,
// done-md-completion-filter, pre-push.consumer-layout).
const SLOW_SHELL_MS = 30_000;

const sandboxes: string[] = [];
afterEach(() => {
  for (const d of sandboxes.splice(0)) rmSync(d, { recursive: true, force: true });
});

function makeSandbox(): string {
  const d = mkdtempSync(join(tmpdir(), 'dup-detect-skip-closed-test-'));
  sandboxes.push(d);
  return d;
}

/** Create umbrella dirs with kickoff.md; optionally drop a done.md to mark closure. */
function setupRepo(
  sandboxRoot: string,
  umbrellas: { name: string; closed?: boolean }[],
): string {
  const promptsDir = join(sandboxRoot, '.claude', 'orchestrator-prompts');
  for (const { name, closed } of umbrellas) {
    const dir = join(promptsDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'kickoff.md'),
      `# Umbrella ${name}\n\n## §0 Problem\n- placeholder bullet for tok_stdin\n`,
      'utf8',
    );
    if (closed) {
      writeFileSync(
        join(dir, 'done.md'),
        `# ${name} — DONE\n- Final PR: #42\n- Closed: 2026-07-03\n- Summary: done\n`,
        'utf8',
      );
    }
  }
  const fakeGh = join(sandboxRoot, 'fake-gh.sh');
  writeFileSync(fakeGh, '#!/usr/bin/env bash\necho "[]"\nexit 0\n', 'utf8');
  chmodSync(fakeGh, 0o755);
  return fakeGh;
}

function runHelper(
  sandboxRoot: string,
  fakeGh: string,
  args: string[],
  extraEnv: Record<string, string> = {},
): { status: number; stdout: string } {
  const r = spawnSync('bash', [HELPER, ...args], {
    encoding: 'utf8',
    env: { ...process.env, REPO_ROOT: sandboxRoot, MO_GH_BIN: fakeGh, GIT_DIR: '', ...extraEnv },
  });
  return { status: r.status ?? -1, stdout: r.stdout };
}

describe('dup-detect.sh — MO_SKIP_CLOSED opt-in (Caller B skip-closed, paired-negative)', { timeout: SLOW_SHELL_MS }, () => {
  it('POS: MO_SKIP_CLOSED=1 on the glob path skips done.md umbrellas, keeps open ones', () => {
    // Targets the glob-path guard: `[[ "${MO_SKIP_CLOSED:-}" == "1" && -f "${d}done.md" ]] && continue`
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, [
      { name: 'open-one' },
      { name: 'closed-one', closed: true },
      { name: 'open-two' },
    ]);

    const r = runHelper(sandbox, fakeGh, ['--all'], { MO_SKIP_CLOSED: '1' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: open-one/);
    expect(r.stdout).toMatch(/OK: open-two/);
    // The closed umbrella was skipped before check_umbrella → entirely absent.
    expect(r.stdout).not.toMatch(/closed-one/);
  });

  it('NEG (paired): flag unset → done.md umbrella is STILL scanned (closure-agnostic default)', () => {
    // Same fixtures, no MO_SKIP_CLOSED → the default plain --all scans every umbrella,
    // including the closed one. This is the paired negative: if the skip were made
    // unconditional, this assertion would fail.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, [
      { name: 'open-one' },
      { name: 'closed-one', closed: true },
      { name: 'open-two' },
    ]);

    const r = runHelper(sandbox, fakeGh, ['--all']); // no MO_SKIP_CLOSED
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: open-one/);
    expect(r.stdout).toMatch(/OK: open-two/);
    expect(r.stdout).toMatch(/OK: closed-one/); // STILL scanned — default unchanged
  });

  it('NEG (non-"1" value): MO_SKIP_CLOSED=0 does not trigger the skip', () => {
    // The guard matches the literal "1", not merely "set" — a stray "0"/"false" must not skip.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, [{ name: 'closed-one', closed: true }, { name: 'open-one' }]);

    const r = runHelper(sandbox, fakeGh, ['--all'], { MO_SKIP_CLOSED: '0' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: closed-one/);
    expect(r.stdout).toMatch(/OK: open-one/);
  });

  it('ISOLATE: MO_SKIP_CLOSED=1 is ignored on the MO_UMBRELLA_SUBSET path (subset is authoritative)', () => {
    // Caller A pre-filters and hands an explicit subset; the subset branch must scan exactly
    // those names even if one is closed — MO_SKIP_CLOSED must not double-filter it away.
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, [
      { name: 'closed-in-subset', closed: true },
      { name: 'open-in-subset' },
      { name: 'not-in-subset' },
    ]);

    const r = runHelper(sandbox, fakeGh, ['--all'], {
      MO_SKIP_CLOSED: '1',
      MO_UMBRELLA_SUBSET: 'closed-in-subset\nopen-in-subset',
    });
    expect(r.status).toBe(0);
    // Subset authoritative: both named are scanned (closed one NOT dropped by the flag)...
    expect(r.stdout).toMatch(/OK: closed-in-subset/);
    expect(r.stdout).toMatch(/OK: open-in-subset/);
    // ...and a name outside the subset is never scanned (subset semantics unchanged).
    expect(r.stdout).not.toMatch(/not-in-subset/);
  });

  it('NAMED: MO_SKIP_CLOSED=1 does not affect single-name mode (a closed umbrella is still checked)', () => {
    // The flag only guards the mass glob. A deliberate `dup-detect.sh <closed-name>` must
    // still report on that umbrella (the caller asked for it by name).
    const sandbox = makeSandbox();
    const fakeGh = setupRepo(sandbox, [{ name: 'closed-named', closed: true }]);

    const r = runHelper(sandbox, fakeGh, ['closed-named'], { MO_SKIP_CLOSED: '1' });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/OK: closed-named/);
  });
});
