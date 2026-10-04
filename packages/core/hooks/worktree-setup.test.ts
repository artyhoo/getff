/**
 * Functional meta-tests for the WorktreeCreate hook
 * (.claude/hooks/worktree-setup.sh) — the Class-B compensating mechanism
 * for the D2 candidate in `dispatch-worktree-automation` R-phase.
 *
 * Asserts the CC WorktreeCreate command-hook contract verified 2026-05-29 via
 * live `--settings` schema probe + code.claude.com/docs/en/hooks:
 *   - stdin  : JSON {session_id, transcript_path, cwd, hook_event_name, name}
 *   - stdout : the worktree absolute path (ONLY thing on stdout)
 *   - exit 0 = success ; non-zero = CC reports creation failure (CAN BLOCK)
 *
 * Tests run against a per-test temporary git repo (mktemp + git init) so they
 * neither touch the real repo nor depend on origin/HEAD. Paired-negative
 * scenarios assert the failure modes the hook is paid to detect (missing
 * `.name`, unresolvable project root) — the principle-02 discipline applied to
 * a bash hook artefact.
 *
 * Skips gracefully when `jq` is unavailable (the hook itself exits 1 when jq
 * is absent — exercising only the jq-missing path would yield no signal).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { spawnBashOrSkip, type Skippable } from './spawn-bash-or-skip.ts';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HOOK = resolve(REPO_ROOT, '.claude/hooks/worktree-setup.sh');

function hasJq(): boolean {
  try {
    execSync('command -v jq', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const JQ = hasJq();

// This suite spawns the real worktree-setup.sh hook, which does real git +
// filesystem work (worktree add, node_modules wiring, and — in the SELF-HEAL case —
// an `npm ci --prefix packages/core`). Multi-second runtimes are inherent, so the
// vitest 5s default is a mis-set gate rather than a signal: run in isolation the
// SELF-HEAL case measures 3.8s, but under full-suite parallel load
// (`vitest run hooks/ skills/`, measured 2026-08-10) it times out at 5000ms.
// 30_000 is the SLOW_SHELL_MS convention already used by the sibling shell-spawning
// suites (priority-score-synthetic, priority-score-skip-closed,
// done-md-completion-filter, pre-push.consumer-layout).
const SLOW_SHELL_MS = 30_000;

interface Result {
  stdout: string;
  stderr: string;
  status: number;
}

function runHook(
  ctx: Skippable,
  input: Record<string, unknown>,
  env: Record<string, string> = {},
): Result {
  // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
  const r = spawnBashOrSkip(ctx, 'bash', [HOOK], {
    input: JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  return {
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? '').trim(),
    status: r.status ?? 1,
  };
}

function setupTempRepo(): string {
  const dir = mkdtempSync(resolve(tmpdir(), 'wtc-test-'));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), 'test repo\n');
  // Track packages/core/ so the worktree checkout creates the directory —
  // matches production layout where the dir always exists in HEAD.
  mkdirSync(resolve(dir, 'packages/core'), { recursive: true });
  writeFileSync(resolve(dir, 'packages/core/.keep'), '');
  execSync('git add . && git commit -q -m init', { cwd: dir });
  // Primary node_modules — symlink target.
  mkdirSync(resolve(dir, 'node_modules'), { recursive: true });
  writeFileSync(resolve(dir, 'node_modules/.keep'), '');
  // The hook delegates provisioning to scripts/worktree-node-modules.sh (single source of
  // truth shared with scripts/create-worktree.sh). The fixture must ship that dependency or
  // the hook silently no-ops on its `|| true` and every symlink assertion below fails.
  mkdirSync(resolve(dir, 'scripts'), { recursive: true });
  copyFileSync(
    resolve(REPO_ROOT, 'scripts/worktree-node-modules.sh'),
    resolve(dir, 'scripts/worktree-node-modules.sh'),
  );
  return dir;
}

/**
 * Build a working repo whose local `origin/HEAD` symbolic-ref is STALE — it
 * points at `main` while the remote's actual default branch is `staging`. This
 * reproduces Bug 1 (2026-05-30): the WorktreeCreate hook based new worktrees on
 * the stale `origin/HEAD` (→ main) instead of the live default (→ staging).
 *
 * `main` and `staging` carry distinct marker files so a worktree's content
 * reveals which ref it was actually based on.
 *
 * Returns the working-repo path. A sibling bare remote dir lives next to it and
 * is removed by teardown() walking worktrees + rmSync on the parent tmp dir.
 */
function setupRepoWithStaleOriginHead(): string {
  const parent = mkdtempSync(resolve(tmpdir(), 'wtc-stale-'));
  const bare = resolve(parent, 'remote.git');
  const work = resolve(parent, 'work');

  execSync(`git init -q --bare -b staging "${bare}"`);

  execSync(`git init -q -b main "${work}"`);
  execSync('git config user.email test@example.com', { cwd: work });
  execSync('git config user.name test', { cwd: work });
  mkdirSync(resolve(work, 'packages/core'), { recursive: true });
  writeFileSync(resolve(work, 'packages/core/.keep'), '');
  writeFileSync(resolve(work, 'WHICH.txt'), 'main\n');
  execSync('git add . && git commit -q -m main-base', { cwd: work });

  // staging diverges with a distinct marker.
  execSync('git checkout -q -b staging', { cwd: work });
  writeFileSync(resolve(work, 'WHICH.txt'), 'staging\n');
  execSync('git commit -aq -m staging-base', { cwd: work });
  execSync('git checkout -q main', { cwd: work });

  execSync(`git remote add origin "${bare}"`, { cwd: work });
  execSync('git push -q origin main staging', { cwd: work });
  // Remote's real default is staging (bare repo was init'd -b staging).
  execSync('git fetch -q origin', { cwd: work });
  // Force the LOCAL origin/HEAD symbolic-ref stale → main (the bug condition).
  execSync('git remote set-head origin main', { cwd: work });

  // Primary node_modules — symlink target.
  mkdirSync(resolve(work, 'node_modules'), { recursive: true });
  writeFileSync(resolve(work, 'node_modules/.keep'), '');
  return work;
}

function teardown(dir: string): void {
  // Remove any sub-worktree before rmSync (git tracks them in .git/worktrees/).
  try {
    const list = execSync(`git -C "${dir}" worktree list --porcelain`, { encoding: 'utf8' });
    for (const line of list.split('\n')) {
      const m = line.match(/^worktree (.+)$/);
      if (m && m[1] !== dir) {
        try {
          execSync(`git -C "${dir}" worktree remove "${m[1]}" --force`, { stdio: 'ignore' });
        } catch {
          /* best-effort */
        }
      }
    }
  } catch {
    /* repo may already be torn down */
  }
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* OS will collect /tmp */
  }
}

function payload(name: string, cwd: string, session = 'sess-1'): Record<string, unknown> {
  return {
    session_id: session,
    transcript_path: '/tmp/no-transcript.jsonl',
    cwd,
    hook_event_name: 'WorktreeCreate',
    name,
  };
}

// win32: the SUT (worktree-setup.sh) links node_modules with `ln -s`, which MSYS copies
// by default (nativestrict needs admin/Dev-Mode) — the link-shape assertions cannot hold (#1799).
// SELF-HEAL cold-primary stays live: it only asserts the NOT-a-symlink shape.
const WIN_SUT_LINK = process.platform === 'win32';

describe.skipIf(!JQ)('worktree-setup.sh — WorktreeCreate hook', { timeout: SLOW_SHELL_MS }, () => {
  let repo: string;

  beforeEach(() => {
    repo = setupTempRepo();
  });
  afterEach(() => {
    teardown(repo);
  });

  it('valid stdin → creates worktree, prints absolute path on stdout, exit 0', (ctx) => {
    const r = runHook(ctx, payload('my-wt', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).toBe(0);
    const expected = `${repo}/.claude/worktrees/my-wt`;
    expect(r.stdout).toBe(expected);
    expect(existsSync(expected)).toBe(true);
  });

  // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
  it.skipIf(WIN_SUT_LINK)('symlinks node_modules from primary checkout (project D2 customisation)', (ctx) => {
    const r = runHook(ctx, payload('sym-root', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-root`;
    expect(readlinkSync(`${wt}/node_modules`)).toBe(`${repo}/node_modules`);
  });

  // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
  it.skipIf(WIN_SUT_LINK)('symlinks packages/core/node_modules to the primary REAL nested dir when it exists (shadowing fix, 2026-07-02)', (ctx) => {
    // Primary carries a real nested layer (root lock plans diverging dep
    // versions there) — the worktree link must target IT, not ../../node_modules,
    // or esbuild bundles root versions and synth-bundle --check false-drifts.
    mkdirSync(resolve(repo, 'packages/core/node_modules'), { recursive: true });
    writeFileSync(resolve(repo, 'packages/core/node_modules/.keep'), '');
    const r = runHook(ctx, payload('sym-core-nested', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-core-nested`;
    expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe(
      `${repo}/packages/core/node_modules`,
    );
  });

  // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
  it.skipIf(WIN_SUT_LINK)('falls back to ../../node_modules when primary has no nested packages/core/node_modules', (ctx) => {
    const r = runHook(ctx, payload('sym-core', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).toBe(0);
    const wt = `${repo}/.claude/worktrees/sym-core`;
    expect(readlinkSync(`${wt}/packages/core/node_modules`)).toBe('../../node_modules');
  });

  // ── Self-heal: tsx toolchain reachability (incident 2026-07-21) ──

  it('SELF-HEAL: cold primary (tsx unreachable at both probe paths) → installs packages/core so tsx becomes reachable', (ctx) => {
    // Reproduce a worktree created while the primary was still cold: no tsx in
    // either probe path, so symlink delivery cannot surface it. Stub `npm` on
    // PATH so the self-heal `npm ci --prefix` is deterministic + offline — it
    // just materialises the tsx bin a real install would produce.
    const fakeBin = mkdtempSync(resolve(tmpdir(), 'wtc-fakenpm-'));
    writeFileSync(
      resolve(fakeBin, 'npm'),
      [
        '#!/usr/bin/env bash',
        'prefix=""',
        'while [ $# -gt 0 ]; do case "$1" in --prefix) prefix="$2"; shift 2;; *) shift;; esac; done',
        '[ -n "$prefix" ] || exit 1',
        'mkdir -p "$prefix/node_modules/.bin"',
        'printf "#!/bin/sh\\necho tsx\\n" > "$prefix/node_modules/.bin/tsx"',
        'chmod +x "$prefix/node_modules/.bin/tsx"',
      ].join('\n') + '\n',
      { mode: 0o755 },
    );
    // packages/core must carry a COMMITTED lockfile for the self-heal `npm ci`
    // to run (production tracks it, so every worktree checkout has it; the guard
    // skips self-heal without it). Commit it so the worktree checkout includes it.
    writeFileSync(resolve(repo, 'packages/core/package-lock.json'), '{}\n');
    execSync('git add packages/core/package-lock.json && git commit -q -m lock', { cwd: repo });
    try {
      const r = runHook(ctx, payload('self-heal', repo), {
        CLAUDE_PROJECT_DIR: repo,
        PATH: `${fakeBin}:${process.env.PATH}`,
      });
      expect(r.status).toBe(0);
      const wt = `${repo}/.claude/worktrees/self-heal`;
      // tsx now reachable at the first probe path, in a REAL dir (the tsx-less
      // delivery symlink was dropped before the local install).
      expect(existsSync(`${wt}/packages/core/node_modules/.bin/tsx`)).toBe(true);
      expect(lstatSync(`${wt}/packages/core/node_modules`).isSymbolicLink()).toBe(false);
    } finally {
      rmSync(fakeBin, { recursive: true, force: true });
    }
  });

  // win32: the SUT links with `ln -s` (MSYS copies) — see WIN_SUT_LINK.
  it.skipIf(WIN_SUT_LINK)('SELF-HEAL NO-OP: tsx already reachable via root-node_modules symlink → no reinstall, delivery symlink preserved', (ctx) => {
    // Warm primary in workspace-hoist layout: tsx in ROOT node_modules. The
    // worktree's root symlink surfaces it via the 2nd probe path, so self-heal
    // must NOT fire (must not clobber the packages/core delivery symlink). Stub
    // `npm` to fail loudly so an erroneous reinstall would break the assertions.
    mkdirSync(resolve(repo, 'node_modules/.bin'), { recursive: true });
    writeFileSync(resolve(repo, 'node_modules/.bin/tsx'), '#!/bin/sh\necho tsx\n', { mode: 0o755 });
    const fakeBin = mkdtempSync(resolve(tmpdir(), 'wtc-fakenpm-noop-'));
    writeFileSync(resolve(fakeBin, 'npm'), '#!/usr/bin/env bash\nexit 7\n', { mode: 0o755 });
    try {
      const r = runHook(ctx, payload('noop', repo), {
        CLAUDE_PROJECT_DIR: repo,
        PATH: `${fakeBin}:${process.env.PATH}`,
      });
      expect(r.status).toBe(0);
      const wt = `${repo}/.claude/worktrees/noop`;
      // Delivery symlink intact (self-heal did not clobber it).
      expect(lstatSync(`${wt}/packages/core/node_modules`).isSymbolicLink()).toBe(true);
      // tsx reachable via the root-node_modules symlink (2nd probe path).
      expect(existsSync(`${wt}/node_modules/.bin/tsx`)).toBe(true);
    } finally {
      rmSync(fakeBin, { recursive: true, force: true });
    }
  });

  it('branch name follows CC default convention: worktree-<name>', (ctx) => {
    runHook(ctx, payload('branch-conv', repo), { CLAUDE_PROJECT_DIR: repo });
    const wtList = execSync(`git -C "${repo}" worktree list --porcelain`, {
      encoding: 'utf8',
    });
    expect(wtList).toContain('branch refs/heads/worktree-branch-conv');
  });

  it('idempotent: re-invoke with same name → reuse (same stdout path, exit 0)', (ctx) => {
    const a = runHook(ctx, payload('idem', repo), { CLAUDE_PROJECT_DIR: repo });
    const b = runHook(ctx, payload('idem', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    expect(b.stdout).toBe(a.stdout);
  });

  it('stdout is a single line (path-only contract — multi-line breaks CC)', (ctx) => {
    const r = runHook(ctx, payload('one-line', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).toBe(0);
    expect(r.stdout.split('\n').length).toBe(1);
    expect(r.stdout.startsWith('/')).toBe(true);
  });

  it('CLAUDE_PROJECT_DIR env takes precedence over stdin .cwd', (ctx) => {
    const r = runHook(ctx, payload('env-precedes', '/nonexistent/bogus-cwd'), {
      CLAUDE_PROJECT_DIR: repo,
    });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(`${repo}/.claude/worktrees/env-precedes`);
  });

  // ── Coordination-link helper: loud on miss, silent-run on hit ─────────────
  // Regression (handoff item 2, 2026-07-25): a missing scripts/link-coordination.sh
  // was swallowed by `|| true` — the worktree stayed silently unlinked from the
  // canonical store. Now the miss is announced on stderr (stdout stays path-only).

  it('LOUD-WARN: missing link-coordination.sh → stderr notice, stdout still path-only, exit 0', (ctx) => {
    // The fixture repo ships no scripts/link-coordination.sh — the miss path.
    // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
    const r = spawnBashOrSkip(ctx, 'bash', [HOOK], {
      input: JSON.stringify(payload('loud-warn', repo)),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
    expect(r.status).toBe(0);
    expect((r.stderr ?? '')).toContain('link-coordination.sh not found');
    const out = (r.stdout ?? '').trim();
    expect(out.split('\n').length, 'warning must NOT leak onto stdout').toBe(1);
    expect(out.startsWith('/')).toBe(true);
  });

  it('helper present → invoked with (worktree, project) args, no missing-helper warning', (ctx) => {
    const stub = resolve(repo, 'scripts/link-coordination.sh');
    const marker = resolve(repo, 'link-ran.txt');
    writeFileSync(stub, `#!/usr/bin/env bash\nprintf '%s %s\\n' "$1" "$2" > "${marker}"\n`, { mode: 0o755 });
    // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
    const r = spawnBashOrSkip(ctx, 'bash', [HOOK], {
      input: JSON.stringify(payload('helper-hit', repo)),
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
    });
    rmSync(stub, { force: true }); // keep the shared fixture helper-less for other tests
    expect(r.status).toBe(0);
    expect((r.stderr ?? '')).not.toContain('link-coordination.sh not found');
    expect(existsSync(marker), 'helper must have run').toBe(true);
    expect(readFileSync(marker, 'utf8')).toBe(`${repo}/.claude/worktrees/helper-hit ${repo}\n`);
  });

  // ── Paired-negative scenarios: failure modes the hook is paid to detect ──

  it('PAIRED-NEGATIVE: missing .name → exit non-zero, no stdout (creation MUST fail)', (ctx) => {
    const r = runHook(
      ctx,
      { session_id: 's', cwd: repo, hook_event_name: 'WorktreeCreate' },
      { CLAUDE_PROJECT_DIR: repo },
    );
    expect(r.status).not.toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/missing \.name/);
  });

  it('PAIRED-NEGATIVE: empty .name → exit non-zero (same path as missing)', (ctx) => {
    const r = runHook(ctx, payload('', repo), { CLAUDE_PROJECT_DIR: repo });
    expect(r.status).not.toBe(0);
    expect(r.stdout).toBe('');
  });

  // ── Bug 1 regression (2026-05-30): stale origin/HEAD must not stale-base ──

  it('BUG-1: refreshes origin/HEAD → worktree bases on the live default (staging, not stale main)', (ctx) => {
    const work = setupRepoWithStaleOriginHead();
    const parent = dirname(work);
    try {
      // Sanity: the LOCAL origin/HEAD is stale (→ main) before the hook runs.
      const staleHead = execSync('git -C "' + work + '" symbolic-ref refs/remotes/origin/HEAD', {
        encoding: 'utf8',
      }).trim();
      expect(staleHead).toBe('refs/remotes/origin/main');

      const r = runHook(ctx, payload('bug1', work), { CLAUDE_PROJECT_DIR: work });
      expect(r.status).toBe(0);

      // The worktree must reflect staging's marker — proving the hook refreshed
      // origin/HEAD and based the worktree on the live default, not stale main.
      const which = execSync(
        `cat "${work}/.claude/worktrees/bug1/WHICH.txt"`,
        { encoding: 'utf8' },
      ).trim();
      expect(which).toBe('staging');
    } finally {
      teardown(work);
      try {
        rmSync(parent, { recursive: true, force: true });
      } catch {
        /* OS will collect /tmp */
      }
    }
  });

  it('PAIRED-NEGATIVE: unresolvable project root → exit non-zero', (ctx) => {
    // No CLAUDE_PROJECT_DIR env, stdin .cwd points nowhere, and we invoke from
    // a directory with no git context.
    const tmp = mkdtempSync(resolve(tmpdir(), 'wtc-norepo-'));
    try {
      // POSIX: byte-identical spawnSync pass-through; win32: Git Bash or named skip (#1799).
      const res = spawnBashOrSkip(ctx, 'bash', [HOOK], {
        input: JSON.stringify(payload('orphan', '/nonexistent')),
        encoding: 'utf8',
        cwd: tmp,
        env: { ...process.env, CLAUDE_PROJECT_DIR: '' },
      });
      const r = {
        stdout: (res.stdout ?? '').trim(),
        stderr: (res.stderr ?? '').trim(),
        status: res.status ?? 1,
      };
      expect(r.status).not.toBe(0);
      expect(r.stdout).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
