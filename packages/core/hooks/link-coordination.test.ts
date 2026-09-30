/**
 * Tests for scripts/link-coordination.sh — cross-worktree symlink-to-canonical
 * coordination doc sync (SSOT #110).
 *
 * Decision origin: research-patch 2026-05-17-cross-worktree-coord-doc-sync.md §5
 * Granularity: OPTION (i) — per-file symlinks only. Umbrella dirs stay real;
 *   symlinks only created for gitignored per-file content (not done.md/README.md).
 *
 * Tests:
 *   (a) SYMLINK: kickoff.md is a symlink into $CANON after helper runs
 *   (b) GIT-CLEAN: tracked README.md and done.md stay real — no phantom deletes
 *   (c) CONFLICT: pre-existing real file in both worktree and CANON → exit 1, no clobber
 *   (d) WRITE-BACK: edit through symlink is visible in CANON and a second linked worktree
 *   (e) PAIRED-NEGATIVE: stripped helper (LINK step removed) leaves kickoff NOT a symlink
 *   (f) SEED: seed-source seeds $CANON when empty
 *   (g) SEED rsync variant · (h) --on-conflict policies · (i) exact-name root files
 *   (j) git-tracked one-off exception skip (real git worktree) + neutered-guard negative
 *   (k) shared root FAMILIES (2026-09-14): `_handoff-*.md` / `_residue-*.md` /
 *       `_morning-report-*.md` adopt + cross-link (k1/k5), conflict-safety (k2),
 *       tracked-skip (k3), CANON-glob paired-negative (k4)
 *   (l) REPO-IDENTITY GUARD (2026-09-30): a session cwd inside a FOREIGN git repo
 *       gets no links (l1), the repo's own worktree still does (l2), an explicit
 *       foreign / non-git target is refused (l3/l4), so is a non-git dir nested
 *       inside the checkout (l5); neutered-guard negative (l-neg)
 *   (m) GIT-SPAWN BUDGET (2026-10-01): git process count stays flat as $CANON grows;
 *       per-file is_tracked() negative (m-neg)
 *
 * ALL tests set CLAUDE_COORDINATION_DIR to a temp dir — never touches real $HOME.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, execSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');
const HELPER = resolve(REPO_ROOT, 'scripts/link-coordination.sh');

// ── Availability checks ──────────────────────────────────────────────────────

function hasRsync(): boolean {
  try {
    execSync('command -v rsync', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
const RSYNC = hasRsync();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

/**
 * Install a copy of the helper at `<repo>/scripts/<name>`. The helper acts only on
 * checkouts of the repository it lives in (REPO-IDENTITY GUARD), so every fixture
 * runs it from inside the fixture repo — the production shape, where the script is
 * `$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh`.
 */
function installHelper(
  repo: string,
  src: string = readFileSync(HELPER, 'utf8'),
  name = 'link-coordination.sh',
): string {
  mkdirSync(resolve(repo, 'scripts'), { recursive: true });
  const p = resolve(repo, 'scripts', name);
  writeFileSync(p, src, { mode: 0o755 });
  return p;
}

function runHelper(
  helper: string,
  args: string[],
  env: Record<string, string> = {},
  cwd?: string,
): RunResult {
  try {
    const stdout = execFileSync('bash', [helper, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      cwd,
    });
    return { stdout: stdout.toString().trim(), stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; status?: number };
    return {
      stdout: (err.stdout?.toString() ?? '').trim(),
      stderr: (err.stderr?.toString() ?? '').trim(),
      status: err.status ?? 1,
    };
  }
}

/**
 * Create a minimal git repo with:
 *   - tracked README.md (root)
 *   - .gitignore mirroring production:
 *       .claude/orchestrator-prompts/* ignored
 *       README.md and done.md tracked per umbrella
 *   - umbrella subdir with tracked done.md and gitignored kickoff.md
 */
function setupRepo(name: string): string {
  const dir = mkdtempSync(resolve(tmpdir(), `link-coord-${name}-`));
  execSync('git init -q -b main', { cwd: dir });
  execSync('git config user.email test@example.com', { cwd: dir });
  execSync('git config user.name test', { cwd: dir });
  writeFileSync(resolve(dir, 'README.md'), 'test\n');

  mkdirSync(resolve(dir, 'packages/core'), { recursive: true });
  writeFileSync(resolve(dir, 'packages/core/.keep'), '');

  const gitignore = [
    'node_modules',
    '.claude/orchestrator-prompts/*',
    '!.claude/orchestrator-prompts/README.md',
    '!.claude/orchestrator-prompts/*/',
    '.claude/orchestrator-prompts/*/*',
    '!.claude/orchestrator-prompts/*/done.md',
  ].join('\n');
  writeFileSync(resolve(dir, '.gitignore'), gitignore + '\n');

  mkdirSync(resolve(dir, '.claude/orchestrator-prompts/my-umbrella'), { recursive: true });
  writeFileSync(resolve(dir, '.claude/orchestrator-prompts/README.md'), '# OPs\n');
  writeFileSync(
    resolve(dir, '.claude/orchestrator-prompts/my-umbrella/done.md'),
    'done-from-primary\n',
  );

  execSync('git add . && git commit -q -m init', { cwd: dir });

  // Add gitignored kickoff (not committed)
  writeFileSync(
    resolve(dir, '.claude/orchestrator-prompts/my-umbrella/kickoff.md'),
    '# my-umbrella kickoff\nOriginal content.\n',
  );

  return dir;
}

/**
 * Create a REAL linked git worktree of `primaryRepo`. It must be a checkout root: the
 * helper refuses any target that is not the toplevel of a checkout of its own repo
 * (REPO-IDENTITY GUARD), so a plain subdir of the primary no longer passes.
 */
function setupWorktreeDir(primaryRepo: string, name: string): string {
  const wt = resolve(primaryRepo, `.claude/worktrees/${name}`);
  execSync(`git worktree add -q "${wt}" HEAD`, { cwd: primaryRepo });
  mkdirSync(resolve(wt, '.claude/orchestrator-prompts/my-umbrella'), { recursive: true });
  // Write tracked done.md (real file, not symlink)
  writeFileSync(
    resolve(wt, '.claude/orchestrator-prompts/my-umbrella/done.md'),
    'done-from-worktree\n',
  );
  // Write tracked README.md (real file)
  writeFileSync(resolve(wt, '.claude/orchestrator-prompts/README.md'), '# OPs\n');
  return wt;
}

function teardown(...dirs: string[]): void {
  for (const d of dirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('link-coordination.sh', () => {
  let canon: string;
  let primaryRepo: string;
  let helper: string;

  beforeEach(() => {
    canon = mkdtempSync(resolve(tmpdir(), 'link-coord-canon-'));
    primaryRepo = setupRepo('primary');
    helper = installHelper(primaryRepo);
  });

  afterEach(() => {
    teardown(canon, primaryRepo);
  });

  // ── (a) SYMLINK ────────────────────────────────────────────────────────────

  it('(a) SYMLINK: state.md is a symlink pointing into $CANON after helper runs', () => {
    // SSOT #116: kickoff.md became a tracked durable doc (helper skips */kickoff.md);
    // state.md is the per-umbrella gitignored regenerable runtime the helper manages.
    // Pre-populate $CANON with the umbrella + state
    mkdirSync(resolve(canon, 'my-umbrella'), { recursive: true });
    writeFileSync(
      resolve(canon, 'my-umbrella/state.md'),
      '# my-umbrella state\nCanonical content.\n',
    );

    const wt = setupWorktreeDir(primaryRepo, 'lnk-a');

    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);

    const statePath = resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md');
    expect(existsSync(statePath), 'state.md must exist').toBe(true);

    const stat = lstatSync(statePath);
    expect(stat.isSymbolicLink(), 'state.md must be a symlink').toBe(true);

    const content = readFileSync(statePath, 'utf8');
    expect(content).toContain('Canonical content');
  });

  // ── (b) GIT-CLEAN ─────────────────────────────────────────────────────────

  it('(b) GIT-CLEAN: tracked README.md and done.md stay as real files after linking', () => {
    // Pre-populate $CANON
    mkdirSync(resolve(canon, 'my-umbrella'), { recursive: true });
    writeFileSync(
      resolve(canon, 'my-umbrella/kickoff.md'),
      '# kickoff\n',
    );

    const wt = setupWorktreeDir(primaryRepo, 'lnk-b');

    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);

    const readmePath = resolve(wt, '.claude/orchestrator-prompts/README.md');
    const donePath = resolve(wt, '.claude/orchestrator-prompts/my-umbrella/done.md');

    // Both must exist as REAL files (not symlinks)
    expect(existsSync(readmePath), 'README.md must exist').toBe(true);
    expect(lstatSync(readmePath).isSymbolicLink(), 'README.md must NOT be a symlink').toBe(false);

    expect(existsSync(donePath), 'done.md must exist').toBe(true);
    expect(lstatSync(donePath).isSymbolicLink(), 'done.md must NOT be a symlink').toBe(false);

    // Content of done.md stays as worktree version
    const doneContent = readFileSync(donePath, 'utf8');
    expect(doneContent).toBe('done-from-worktree\n');
  });

  // ── (c) CONFLICT ──────────────────────────────────────────────────────────

  it('(c) CONFLICT: real file in both worktree and CANON → exit 1, content unchanged', () => {
    // Managed-file fixture is state.md (SSOT #116: kickoff.md is tracked, skipped).
    // Pre-populate $CANON with its version
    mkdirSync(resolve(canon, 'my-umbrella'), { recursive: true });
    writeFileSync(
      resolve(canon, 'my-umbrella/state.md'),
      '# canon version\n',
    );

    const wt = setupWorktreeDir(primaryRepo, 'lnk-c');
    // Also plant a REAL state.md in the worktree (not a symlink)
    writeFileSync(
      resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md'),
      '# worktree version\n',
    );

    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, 'helper must exit 1 on conflict').toBe(1);
    expect(r.stderr).toContain('CONFLICT');

    // Neither file changed
    const canonContent = readFileSync(resolve(canon, 'my-umbrella/state.md'), 'utf8');
    expect(canonContent).toBe('# canon version\n');

    const wtContent = readFileSync(
      resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md'),
      'utf8',
    );
    expect(wtContent).toBe('# worktree version\n');
  });

  // ── (d) WRITE-BACK ────────────────────────────────────────────────────────

  it('(d) WRITE-BACK: edit via symlink is visible in $CANON and a second linked worktree', () => {
    // Managed-file fixture is state.md (SSOT #116: kickoff.md is tracked, skipped).
    // Pre-populate $CANON
    mkdirSync(resolve(canon, 'my-umbrella'), { recursive: true });
    writeFileSync(
      resolve(canon, 'my-umbrella/state.md'),
      '# original\n',
    );

    const wt1 = setupWorktreeDir(primaryRepo, 'lnk-d1');
    const wt2 = setupWorktreeDir(primaryRepo, 'lnk-d2');

    const r1 = runHelper(helper, [wt1], { CLAUDE_COORDINATION_DIR: canon });
    expect(r1.status, `wt1 stderr: ${r1.stderr}`).toBe(0);

    const r2 = runHelper(helper, [wt2], { CLAUDE_COORDINATION_DIR: canon });
    expect(r2.status, `wt2 stderr: ${r2.stderr}`).toBe(0);

    // Write new content through wt1's symlink
    const stateViaWt1 = resolve(wt1, '.claude/orchestrator-prompts/my-umbrella/state.md');
    writeFileSync(stateViaWt1, '# updated content\n');

    // Visible in $CANON
    const canonContent = readFileSync(resolve(canon, 'my-umbrella/state.md'), 'utf8');
    expect(canonContent).toBe('# updated content\n');

    // Visible in wt2 (same inode via symlink)
    const stateViaWt2 = resolve(wt2, '.claude/orchestrator-prompts/my-umbrella/state.md');
    const wt2Content = readFileSync(stateViaWt2, 'utf8');
    expect(wt2Content).toBe('# updated content\n');

    teardown(wt1, wt2);
  });

  // ── (e) PAIRED-NEGATIVE ──────────────────────────────────────────────────

  it('(e) PAIRED-NEGATIVE: stripped helper (LINK step removed) leaves state NOT a symlink', () => {
    // Managed-file fixture is state.md (SSOT #116: kickoff.md is tracked, skipped).
    // Pre-populate $CANON
    mkdirSync(resolve(canon, 'my-umbrella'), { recursive: true });
    writeFileSync(
      resolve(canon, 'my-umbrella/state.md'),
      '# canonical\n',
    );

    const wt = setupWorktreeDir(primaryRepo, 'lnk-e');

    // Strip the LINK step (the "for each file in CANON" loop that creates symlinks)
    const src = readFileSync(HELPER, 'utf8');
    // Remove the block between "# ── LINK" comment and the final exit lines
    const stripped = src.replace(
      /# ── LINK[\s\S]*?# ── EXIT/,
      '# ── EXIT',
    );

    const tmpHelper = installHelper(primaryRepo, stripped, 'link-coordination-stripped.sh');

    try {
      execFileSync('bash', [tmpHelper, wt], {
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_COORDINATION_DIR: canon },
      });
    } catch {
      // May fail or succeed — we only care about the symlink state
    }

    const statePath = resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md');
    // Either absent or a real file — NOT a symlink
    if (existsSync(statePath)) {
      expect(
        lstatSync(statePath).isSymbolicLink(),
        'stripped helper must NOT create a symlink',
      ).toBe(false);
    }
    // (If absent, the test passes trivially — stripped helper didn't link anything)

    try { rmSync(tmpHelper); } catch { /* ignore */ }
    teardown(wt);
  });

  // ── (f) ADOPT-THEN-LINK: orphan real file in worktree gets moved to $CANON ──

  it('(f) ADOPT: real gitignored file in worktree with no CANON equivalent is adopted (mv to CANON, then linked)', () => {
    // Managed-file fixture is state.md (SSOT #116: kickoff.md is tracked, skipped).
    // $CANON has NO my-umbrella yet
    const wt = setupWorktreeDir(primaryRepo, 'lnk-f');
    // Place a real state.md in the worktree (not a symlink, not in CANON)
    writeFileSync(
      resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md'),
      '# adopt-me\n',
    );

    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);

    // After adoption: worktree path is now a symlink
    const statePath = resolve(wt, '.claude/orchestrator-prompts/my-umbrella/state.md');
    expect(existsSync(statePath)).toBe(true);
    expect(lstatSync(statePath).isSymbolicLink(), 'state must be symlink after adoption').toBe(true);

    // Content is in $CANON
    const canonContent = readFileSync(resolve(canon, 'my-umbrella/state.md'), 'utf8');
    expect(canonContent).toBe('# adopt-me\n');

    teardown(wt);
  });

  // ── (g) SEED ─────────────────────────────────────────────────────────────

  describe.skipIf(!RSYNC)('(g) SEED (requires rsync)', () => {
    it('SEED: when $CANON is empty and seed-source provided, seeds from primary checkout', () => {
      // $CANON is empty (already created in beforeEach)
      // primaryRepo has my-umbrella/kickoff.md as a real file

      const wt = setupWorktreeDir(primaryRepo, 'lnk-g');

      // Run helper with seed-source = primaryRepo
      const r = runHelper(helper, [wt, primaryRepo], { CLAUDE_COORDINATION_DIR: canon });
      expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);

      // $CANON should now have the seeded kickoff
      const canonKickoff = resolve(canon, 'my-umbrella/kickoff.md');
      expect(existsSync(canonKickoff), '$CANON/my-umbrella/kickoff.md seeded').toBe(true);

      // done.md should NOT be seeded (it's tracked — excluded via --exclude='done.md')
      const canonDone = resolve(canon, 'my-umbrella/done.md');
      expect(existsSync(canonDone), 'done.md must NOT be seeded into $CANON').toBe(false);

      teardown(wt);
    });
  });

  // ── (h) ON-CONFLICT flag (Task A1) ─────────────────────────────────────────

  it('on-conflict=canon: canonical wins, worktree file relinked', () => {
    mkdirSync(resolve(canon, 'u1'), { recursive: true });
    writeFileSync(resolve(canon, 'u1/state.md'), 'CANON');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-oc-canon');
    mkdirSync(resolve(wt, '.claude/orchestrator-prompts/u1'), { recursive: true });
    writeFileSync(resolve(wt, '.claude/orchestrator-prompts/u1/state.md'), 'WORKTREE');
    const r = runHelper(helper, [wt, '', '--on-conflict=canon'], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const p = resolve(wt, '.claude/orchestrator-prompts/u1/state.md');
    expect(lstatSync(p).isSymbolicLink()).toBe(true);
    expect(readFileSync(p, 'utf8')).toBe('CANON');
    teardown(wt);
  });

  it('on-conflict=worktree: worktree wins, adopted into CANON', () => {
    mkdirSync(resolve(canon, 'u1'), { recursive: true });
    writeFileSync(resolve(canon, 'u1/state.md'), 'CANON');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-oc-worktree');
    mkdirSync(resolve(wt, '.claude/orchestrator-prompts/u1'), { recursive: true });
    writeFileSync(resolve(wt, '.claude/orchestrator-prompts/u1/state.md'), 'WORKTREE');
    const r = runHelper(helper, [wt, '', '--on-conflict=worktree'], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const p = resolve(wt, '.claude/orchestrator-prompts/u1/state.md');
    expect(lstatSync(p).isSymbolicLink()).toBe(true);
    expect(readFileSync(resolve(canon, 'u1/state.md'), 'utf8')).toBe('WORKTREE');
    teardown(wt);
  });

  it('on-conflict=skip (default): exits 1, leaves both files intact', () => {
    mkdirSync(resolve(canon, 'u1'), { recursive: true });
    writeFileSync(resolve(canon, 'u1/state.md'), 'CANON');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-oc-skip');
    mkdirSync(resolve(wt, '.claude/orchestrator-prompts/u1'), { recursive: true });
    writeFileSync(resolve(wt, '.claude/orchestrator-prompts/u1/state.md'), 'WORKTREE');
    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status).toBe(1);
    expect(
      readFileSync(resolve(wt, '.claude/orchestrator-prompts/u1/state.md'), 'utf8'),
    ).toBe('WORKTREE');
    expect(readFileSync(resolve(canon, 'u1/state.md'), 'utf8')).toBe('CANON');
    teardown(wt);
  });

  it('on-conflict=bogus: exits 2 (validation)', () => {
    const wt = setupWorktreeDir(primaryRepo, 'lnk-oc-bogus');
    const r = runHelper(helper, [wt, '', '--on-conflict=bogus'], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status).toBe(2);
    teardown(wt);
  });

  // ── (i) ROOT-FILE loop (Task A2) ───────────────────────────────────────────

  it('root-file loop: _plan-cache.md adopted into CANON root and symlinked back', () => {
    const wt = setupWorktreeDir(primaryRepo, 'lnk-root-cache');
    const wtPrompts = resolve(wt, '.claude/orchestrator-prompts');
    writeFileSync(resolve(wtPrompts, '_plan-cache.md'), 'CACHE-v1');
    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const p = resolve(wtPrompts, '_plan-cache.md');
    expect(lstatSync(p).isSymbolicLink()).toBe(true);
    expect(readFileSync(resolve(canon, '_plan-cache.md'), 'utf8')).toBe('CACHE-v1');
    teardown(wt);
  });

  it('root-file loop: _master-backlog-delta.json linked from CANON into a fresh worktree', () => {
    writeFileSync(resolve(canon, '_master-backlog-delta.json'), '{"untracked_seen":[]}');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-root-delta');
    const wtPrompts = resolve(wt, '.claude/orchestrator-prompts');
    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    expect(
      lstatSync(resolve(wtPrompts, '_master-backlog-delta.json')).isSymbolicLink(),
    ).toBe(true);
    teardown(wt);
  });

  it('root-file loop: root README.md stays a real file (tracked-skip)', () => {
    const wt = setupWorktreeDir(primaryRepo, 'lnk-root-readme');
    const wtPrompts = resolve(wt, '.claude/orchestrator-prompts');
    writeFileSync(resolve(wtPrompts, 'README.md'), 'TRACKED');
    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    expect(lstatSync(resolve(wtPrompts, 'README.md')).isSymbolicLink()).toBe(false);
    teardown(wt);
  });

  // ── (k) HANDOFF family (2026-09-14) ────────────────────────────────────────
  // `_handoff-*.md` sits at the ROOT of orchestrator-prompts; before this family
  // joined the shared root files, a handoff authored in one worktree was invisible
  // in every other checkout (incident 2026-09-14, getff-ai-site — the CC worktree
  // session's handoff 404'd for the main-clone ZCode seat).

  it('(k1) ADOPT+SHARE: worktree _handoff-*.md adopted into CANON root, then linked into a SECOND worktree that never had it', () => {
    const wt1 = setupWorktreeDir(primaryRepo, 'lnk-ho-1');
    const wt1Prompts = resolve(wt1, '.claude/orchestrator-prompts');
    writeFileSync(resolve(wt1Prompts, '_handoff-sess_abc123.md'), 'HANDOFF-v1\n');

    const r1 = runHelper(helper, [wt1], { CLAUDE_COORDINATION_DIR: canon });
    expect(r1.status, `wt1 stderr: ${r1.stderr}`).toBe(0);
    // Adopted: worktree path is now a symlink; content lives in $CANON root
    const ho1 = resolve(wt1Prompts, '_handoff-sess_abc123.md');
    expect(lstatSync(ho1).isSymbolicLink(), 'handoff must be a symlink after adoption').toBe(true);
    expect(readFileSync(resolve(canon, '_handoff-sess_abc123.md'), 'utf8')).toBe('HANDOFF-v1\n');

    // A SECOND worktree that never had the file gets it from the CANON-side glob
    // (the LINK loop superset — the exact arm the pre-fix script lacked).
    const wt2 = setupWorktreeDir(primaryRepo, 'lnk-ho-2');
    const r2 = runHelper(helper, [wt2], { CLAUDE_COORDINATION_DIR: canon });
    expect(r2.status, `wt2 stderr: ${r2.stderr}`).toBe(0);
    const ho2 = resolve(wt2, '.claude/orchestrator-prompts/_handoff-sess_abc123.md');
    expect(existsSync(ho2), 'handoff must appear in the second worktree').toBe(true);
    expect(lstatSync(ho2).isSymbolicLink()).toBe(true);
    expect(readFileSync(ho2, 'utf8')).toBe('HANDOFF-v1\n');

    teardown(wt1, wt2);
  });

  it('(k2) PAIRED-NEGATIVE CONFLICT: _handoff-*.md real in BOTH worktree and CANON → exit 1, neither clobbered', () => {
    writeFileSync(resolve(canon, '_handoff-dupe.md'), 'CANON-version\n');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-ho-conf');
    writeFileSync(
      resolve(wt, '.claude/orchestrator-prompts/_handoff-dupe.md'),
      'WORKTREE-version\n',
    );
    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, 'default on-conflict=skip must exit 1').toBe(1);
    expect(r.stderr).toContain('CONFLICT');
    expect(readFileSync(resolve(canon, '_handoff-dupe.md'), 'utf8')).toBe('CANON-version\n');
    expect(
      readFileSync(resolve(wt, '.claude/orchestrator-prompts/_handoff-dupe.md'), 'utf8'),
    ).toBe('WORKTREE-version\n');
    teardown(wt);
  });

  it('(k3) TRACKED handoff (one-off .gitignore exception) stays a REAL file — never symlinked', () => {
    // The #canon-symlink-swallows-commit class (kickoff-staging-placement.md §5.2):
    // a handoff tracked via a one-off exception must not be adopted. Uses a REAL
    // git worktree so the is_tracked() guard resolves against a real index.
    const repo = mkdtempSync(resolve(tmpdir(), 'link-coord-ho-tracked-'));
    execSync('git init -q -b main', { cwd: repo });
    execSync('git config user.email test@example.com', { cwd: repo });
    execSync('git config user.name test', { cwd: repo });
    const gitignore = [
      'node_modules',
      '.claude/orchestrator-prompts/*',
      '!.claude/orchestrator-prompts/*/',
      '!.claude/orchestrator-prompts/README.md',
      '!.claude/orchestrator-prompts/_handoff-tracked.md',
    ].join('\n');
    writeFileSync(resolve(repo, '.gitignore'), gitignore + '\n');
    writeFileSync(resolve(repo, 'README.md'), 'root\n');
    mkdirSync(resolve(repo, '.claude/orchestrator-prompts'), { recursive: true });
    writeFileSync(
      resolve(repo, '.claude/orchestrator-prompts/_handoff-tracked.md'),
      'tracked handoff\n',
    );
    writeFileSync(resolve(repo, '.claude/orchestrator-prompts/README.md'), '# OPs\n');
    execSync('git add -A && git commit -q -m init', { cwd: repo });

    const wt = resolve(repo, 'wt-ho');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: repo });
    const helper = installHelper(repo);
    // CANON carries a same-named file — the adoption temptation the guard must refuse
    writeFileSync(resolve(canon, '_handoff-tracked.md'), 'CANON-decoy\n');

    const r = runHelper(helper, [wt], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const p = resolve(wt, '.claude/orchestrator-prompts/_handoff-tracked.md');
    expect(existsSync(p)).toBe(true);
    expect(lstatSync(p).isSymbolicLink(), 'tracked handoff must NOT be a symlink').toBe(false);
    expect(readFileSync(p, 'utf8')).toBe('tracked handoff\n');

    try { execSync(`git worktree remove --force "${wt}"`, { cwd: repo }); } catch { /* ignore */ }
    teardown(repo);
  });

  it('(k4) PAIRED-NEGATIVE: with the CANON-side family glob stripped, a second worktree does NOT receive the handoff', () => {
    // Prove the CANON-glob superset is load-bearing (the exact arm the pre-fix
    // script lacked): neuter the ROOT-FILE LINK glob build by regex; wt2 then
    // never sees a handoff that exists only in $CANON. Same neutering convention
    // as (e) stripped-LINK and (j-neg) neutered is_tracked.
    writeFileSync(resolve(canon, '_handoff-sess_k4.md'), 'K4\n');
    const src = readFileSync(HELPER, 'utf8');
    // Strip the whole CANON-glob build block; `\n  done\n` (2-space indent) is the
    // OUTER loop's closer — the inner one is 4-space-indented, so the lazy match
    // cannot stop early and leave a syntactically broken script behind.
    const stripped = src.replace(
      /(  ROOT_LINK_FILES="\$ROOT_ADOPT_FILES"\n)  for pattern[\s\S]*?\n  done\n/,
      '$1',
    );
    expect(stripped, 'the CANON-glob build block must be present to strip').not.toBe(src);
    const tmpHelper = installHelper(primaryRepo, stripped, 'link-coordination-k4-stripped.sh');

    const wt = setupWorktreeDir(primaryRepo, 'lnk-ho-k4');
    try {
      execFileSync('bash', [tmpHelper, wt], {
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_COORDINATION_DIR: canon },
      });
    } catch { /* exit code irrelevant — we assert the visibility state */ }

    const ho = resolve(wt, '.claude/orchestrator-prompts/_handoff-sess_k4.md');
    expect(
      existsSync(ho),
      'stripped CANON-glob must leave the second worktree WITHOUT the handoff (proves the arm is load-bearing)',
    ).toBe(false);

    try { rmSync(tmpHelper); } catch { /* ignore */ }
    teardown(wt);
  });

  it('(k5) FAMILIES: every ROOT_SHARED_FAMILIES glob (handoff, residue, morning-report) adopts and cross-links', () => {
    const families = [
      '_handoff-sess_k5.md',
      '_residue-k5.md',
      '_morning-report-k5.md',
    ];
    const wt1 = setupWorktreeDir(primaryRepo, 'lnk-fam-1');
    for (const f of families) {
      writeFileSync(resolve(wt1, '.claude/orchestrator-prompts', f), `${f}-v1\n`);
    }
    const r1 = runHelper(helper, [wt1], { CLAUDE_COORDINATION_DIR: canon });
    expect(r1.status, `wt1 stderr: ${r1.stderr}`).toBe(0);

    const wt2 = setupWorktreeDir(primaryRepo, 'lnk-fam-2');
    const r2 = runHelper(helper, [wt2], { CLAUDE_COORDINATION_DIR: canon });
    expect(r2.status, `wt2 stderr: ${r2.stderr}`).toBe(0);
    for (const f of families) {
      const p = resolve(wt2, '.claude/orchestrator-prompts', f);
      expect(existsSync(p), `${f} must appear in the second worktree`).toBe(true);
      expect(lstatSync(p).isSymbolicLink(), `${f} must be a symlink`).toBe(true);
      expect(readFileSync(p, 'utf8')).toBe(`${f}-v1\n`);
    }
    teardown(wt1, wt2);
  });

  // ── (m) GIT-SPAWN BUDGET ──────────────────────────────────────────────────
  // Incident 2026-10-01: is_tracked() spawned one git process per $CANON file. Against
  // the operator's 519-file store that was ~600 git processes and 18-28 s per run under
  // load, paid on every `git worktree add` (post-checkout), create-worktree.sh and
  // SessionStart — and it sized the timeout of any test that made a worktree of this
  // repo. The git process count must not grow with $CANON.

  /** Count git processes one helper run starts (GIT_TRACE2_EVENT, one "start" per process). */
  function gitStarts(helperPath: string, wt: string): number {
    const trace = resolve(canon, '..', `${canon.split('/').pop()}-trace2.json`);
    const r = runHelper(helperPath, [wt], { CLAUDE_COORDINATION_DIR: canon, GIT_TRACE2_EVENT: trace });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const n = readFileSync(trace, 'utf8').split('\n').filter((l) => l.includes('"event":"start"')).length;
    rmSync(trace, { force: true });
    return n;
  }
  const CANON_FILES = 60;
  function seedCanon(): void {
    for (let i = 0; i < CANON_FILES; i++) {
      mkdirSync(resolve(canon, `u${i}`), { recursive: true });
      writeFileSync(resolve(canon, `u${i}/state.md`), `state ${i}\n`);
    }
  }

  it('(m) GIT-SPAWN BUDGET: git process count stays flat as $CANON grows', () => {
    seedCanon();
    const wt = setupWorktreeDir(primaryRepo, 'lnk-m');
    const starts = gitStarts(helper, wt);
    expect(starts, `${starts} git processes for ${CANON_FILES} canon files`).toBeLessThan(15);
    expect(lstatSync(resolve(wt, '.claude/orchestrator-prompts/u0/state.md')).isSymbolicLink()).toBe(true);
    teardown(wt);
  });

  it('(m-neg) PAIRED-NEGATIVE: the per-file is_tracked() spawns git once per canon file', () => {
    seedCanon();
    const src = readFileSync(HELPER, 'utf8');
    const perFile = src.replace(
      /is_tracked\(\) \{[\s\S]*?\n\}/,
      'is_tracked() { git -C "$WT_DIR" ls-files --error-unmatch -- "$1" >/dev/null 2>&1; }',
    );
    expect(perFile, 'is_tracked() must be present to replace').not.toBe(src);
    const perFileHelper = installHelper(primaryRepo, perFile, 'link-coordination-per-file.sh');
    const wt = setupWorktreeDir(primaryRepo, 'lnk-m-neg');
    expect(gitStarts(perFileHelper, wt)).toBeGreaterThanOrEqual(CANON_FILES);
    teardown(wt);
  });
});

// ── (j) GIT-TRACKED one-off exception skip (real git worktree) ─────────────────
// Regression for the aif planner crash-loop (2026-06-27): a file tracked via a
// ONE-OFF `.gitignore` exception (not done.md/README.md/kickoff.md) was wrongly
// adopted into $CANON + symlinked. aif-handoff's cpSync of `.claude` then threw
// EEXIST when the symlink landed over the git-checked-out real file. The helper
// must skip ANY git-tracked file, derived from `git ls-files`, not a name-list.
describe('link-coordination.sh — git-tracked one-off exception (real worktree)', () => {
  let canon: string;
  let repo: string;
  let worktree: string;
  let helper: string;

  /**
   * Repo whose .gitignore ignores orchestrator-prompts/* but tracks a ONE-OFF
   * exception `stage-4.md` (the production shape that broke), alongside the usual
   * done.md exception. A gitignored `state.md` is the legitimately-symlinkable one.
   */
  function setupRepoOneOff(): string {
    const dir = mkdtempSync(resolve(tmpdir(), 'link-coord-oneoff-'));
    execSync('git init -q -b main', { cwd: dir });
    execSync('git config user.email test@example.com', { cwd: dir });
    execSync('git config user.name test', { cwd: dir });
    const gitignore = [
      'node_modules',
      '.claude/orchestrator-prompts/*',
      '!.claude/orchestrator-prompts/*/',
      '.claude/orchestrator-prompts/*/*',
      '!.claude/orchestrator-prompts/*/done.md',
      // ONE-OFF tracked exception — the exact shape the name-list cannot enumerate
      '!.claude/orchestrator-prompts/u1/stage-4.md',
    ].join('\n');
    writeFileSync(resolve(dir, '.gitignore'), gitignore + '\n');
    writeFileSync(resolve(dir, 'README.md'), 'root\n');
    mkdirSync(resolve(dir, '.claude/orchestrator-prompts/u1'), { recursive: true });
    writeFileSync(resolve(dir, '.claude/orchestrator-prompts/u1/done.md'), 'done\n');
    writeFileSync(resolve(dir, '.claude/orchestrator-prompts/u1/stage-4.md'), 'tracked stage-4 content\n');
    execSync('git add -A && git commit -q -m init', { cwd: dir });
    return dir;
  }

  beforeEach(() => {
    canon = mkdtempSync(resolve(tmpdir(), 'link-coord-canon-oneoff-'));
    repo = setupRepoOneOff();
    worktree = resolve(repo, 'wt-feature');
    // A REAL git worktree so `git ls-files` inside it sees the tracked stage-4.md.
    execSync(`git worktree add -q "${worktree}" HEAD`, { cwd: repo });
    helper = installHelper(repo);
    // CANON carries a gitignored state.md (the legitimately-linkable file).
    mkdirSync(resolve(canon, 'u1'), { recursive: true });
    writeFileSync(resolve(canon, 'u1/state.md'), 'canon state\n');
  });

  afterEach(() => {
    try { execSync(`git worktree remove --force "${worktree}"`, { cwd: repo }); } catch { /* ignore */ }
    teardown(canon, repo);
  });

  it('(j) PASS: one-off tracked stage-4.md stays a REAL file; gitignored state.md IS symlinked', () => {
    const stage4 = resolve(worktree, '.claude/orchestrator-prompts/u1/stage-4.md');
    const state = resolve(worktree, '.claude/orchestrator-prompts/u1/state.md');

    const r = runHelper(helper, [worktree], { CLAUDE_COORDINATION_DIR: canon });
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);

    // Tracked one-off exception: untouched real file (the fix)
    expect(existsSync(stage4)).toBe(true);
    expect(lstatSync(stage4).isSymbolicLink(), 'tracked stage-4.md must NOT be a symlink').toBe(false);
    expect(readFileSync(stage4, 'utf8')).toBe('tracked stage-4 content\n');

    // Gitignored content: correctly symlinked into CANON (helper still does its job)
    expect(lstatSync(state).isSymbolicLink(), 'gitignored state.md must be a symlink').toBe(true);
  });

  it('(j-neg) PAIRED-NEGATIVE: with is_tracked() neutered, stage-4.md IS wrongly symlinked', () => {
    // Prove the git-tracked guard is load-bearing: replace is_tracked with a stub
    // that always returns false (the pre-fix name-list-only behaviour). The
    // tracked stage-4.md then gets adopted → symlink (the bug). Must FAIL-safe:
    // the symlink assertion below is what the real helper PREVENTS.
    const src = readFileSync(HELPER, 'utf8');
    const neutered = src.replace(
      /is_tracked\(\) \{[\s\S]*?\n\}/,
      'is_tracked() { return 1; }',
    );
    expect(neutered, 'is_tracked() must be present to neuter').not.toBe(src);
    const tmpHelper = installHelper(repo, neutered, 'link-coordination-neutered.sh');

    const stage4 = resolve(worktree, '.claude/orchestrator-prompts/u1/stage-4.md');
    try {
      execFileSync('bash', [tmpHelper, worktree], {
        encoding: 'utf8',
        env: { ...process.env, CLAUDE_COORDINATION_DIR: canon },
      });
    } catch { /* adoption may still exit 0; we only assert the symlink state */ }

    // Without the guard, the tracked file is wrongly turned into a symlink.
    expect(
      lstatSync(stage4).isSymbolicLink(),
      'neutered helper SHOULD wrongly symlink the tracked file (proves guard is load-bearing)',
    ).toBe(true);

    try { rmSync(tmpHelper); } catch { /* ignore */ }
  });
});

// ── (l) REPO-IDENTITY GUARD ───────────────────────────────────────────────────
// Incident 2026-09-30 (P6 cold run 3): after a compaction the session cwd sat in a
// scratch consumer project (a separate git repo). The SessionStart hook ran
// `$CLAUDE_PROJECT_DIR/scripts/link-coordination.sh` with no argument, the helper
// defaulted <worktree-dir> to the toplevel of that FOREIGN cwd, and linked 472
// coordination entries into it — a later push from a copy then failed lychee with
// 210 broken links (a false red). The helper must act only on checkouts of the
// repository it lives in (same git common dir), whatever the cwd or argument.
describe('link-coordination.sh — repo-identity guard (foreign cwd / target)', () => {
  let canon: string;
  let home: string;
  let foreign: string;
  let helper: string;
  const extra: string[] = [];

  function initRepo(prefix: string): string {
    const dir = mkdtempSync(resolve(tmpdir(), prefix));
    execSync('git init -q -b main', { cwd: dir });
    execSync('git config user.email test@example.com', { cwd: dir });
    execSync('git config user.name test', { cwd: dir });
    writeFileSync(resolve(dir, 'README.md'), 'foreign\n');
    execSync('git add -A && git commit -q -m init', { cwd: dir });
    return dir;
  }

  const foreignPrompts = (): string => resolve(foreign, '.claude/orchestrator-prompts');

  beforeEach(() => {
    canon = mkdtempSync(resolve(tmpdir(), 'link-coord-canon-guard-'));
    home = setupRepo('guard-home');
    helper = installHelper(home);
    foreign = initRepo('link-coord-foreign-');
    // CANON carries both shapes the incident leaked: an umbrella file and a root family file.
    mkdirSync(resolve(canon, 'u1'), { recursive: true });
    writeFileSync(resolve(canon, 'u1/state.md'), 'canon state\n');
    writeFileSync(resolve(canon, '_handoff-guard.md'), 'canon handoff\n');
  });

  afterEach(() => {
    teardown(canon, home, foreign, ...extra.splice(0));
  });

  it('(l1) FOREIGN CWD, no argument: refused (exit 3), foreign repo gets NO links', () => {
    const r = runHelper(helper, [], { CLAUDE_COORDINATION_DIR: canon }, foreign);
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(3);
    expect(r.stderr).toContain('not a checkout of');
    expect(existsSync(foreignPrompts()), 'no orchestrator-prompts dir may be created').toBe(false);
    // CANON itself is untouched too (the guard runs before INIT).
    expect(readdirSync(canon).sort()).toEqual(['_handoff-guard.md', 'u1']);
  });

  it('(l2) OWN WORKTREE as cwd, no argument: still linked (the guard does not over-block)', () => {
    const wt = resolve(home, 'wt-own');
    execSync(`git worktree add -q "${wt}" HEAD`, { cwd: home });
    const r = runHelper(helper, [], { CLAUDE_COORDINATION_DIR: canon }, wt);
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(0);
    const state = resolve(wt, '.claude/orchestrator-prompts/u1/state.md');
    const ho = resolve(wt, '.claude/orchestrator-prompts/_handoff-guard.md');
    expect(lstatSync(state).isSymbolicLink(), 'own worktree umbrella file must be linked').toBe(true);
    expect(lstatSync(ho).isSymbolicLink(), 'own worktree root family file must be linked').toBe(true);
    try { execSync(`git worktree remove --force "${wt}"`, { cwd: home }); } catch { /* ignore */ }
  });

  it('(l3) EXPLICIT foreign target (the adopt hook shape): refused, no links, no adoption', () => {
    // adopt-orchestrator-prompts.sh passes the worktree derived from the WRITTEN path,
    // so a write under a foreign repo's orchestrator-prompts reaches the helper as an arg.
    mkdirSync(resolve(foreignPrompts(), 'u2'), { recursive: true });
    writeFileSync(resolve(foreignPrompts(), 'u2/foo.md'), 'foreign content\n');
    const r = runHelper(helper, [foreign], { CLAUDE_COORDINATION_DIR: canon }, home);
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(3);
    expect(lstatSync(resolve(foreignPrompts(), 'u2/foo.md')).isSymbolicLink(), 'foreign file must NOT be adopted').toBe(false);
    expect(existsSync(resolve(foreignPrompts(), 'u1')), 'CANON umbrella must NOT be linked in').toBe(false);
    expect(existsSync(resolve(canon, 'u2')), 'foreign file must NOT reach CANON').toBe(false);
  });

  it('(l4) NON-GIT target: refused — identity cannot be proven, so nothing is linked', () => {
    const plain = mkdtempSync(resolve(tmpdir(), 'link-coord-nogit-'));
    extra.push(plain);
    const r = runHelper(helper, [plain], { CLAUDE_COORDINATION_DIR: canon }, home);
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(3);
    expect(existsSync(resolve(plain, '.claude')), 'nothing may be created in a non-git dir').toBe(false);
  });

  it('(l5) NON-GIT dir NESTED inside the repo tree: refused — a subdir is not a checkout root', () => {
    // `git -C <nested>` resolves the ENCLOSING repo's common dir, so a common-dir-only
    // check would pass a scratch project (never `git init`-ed) that sits inside this
    // checkout — the incident class in a narrower placement (cold review, 2026-09-30).
    const nested = resolve(home, 'sub/scratch');
    mkdirSync(nested, { recursive: true });
    const r = runHelper(helper, [nested], { CLAUDE_COORDINATION_DIR: canon }, home);
    expect(r.status, `helper stderr: ${r.stderr}`).toBe(3);
    expect(existsSync(resolve(nested, '.claude')), 'nothing may be created in the nested dir').toBe(false);
  });

  it('(l-neg) PAIRED-NEGATIVE: with the guard stripped, the foreign cwd IS contaminated (the incident)', () => {
    const src = readFileSync(HELPER, 'utf8');
    const stripped = src.replace(
      /# ── REPO-IDENTITY GUARD[\s\S]*?# ── TRACKED-FILE DETECTION/,
      '# ── TRACKED-FILE DETECTION',
    );
    expect(stripped, 'the REPO-IDENTITY GUARD block must be present to strip').not.toBe(src);
    const tmpHelper = installHelper(home, stripped, 'link-coordination-noguard.sh');
    runHelper(tmpHelper, [], { CLAUDE_COORDINATION_DIR: canon }, foreign);
    expect(
      lstatSync(resolve(foreignPrompts(), 'u1/state.md')).isSymbolicLink(),
      'without the guard the foreign repo receives CANON links (proves the guard is load-bearing)',
    ).toBe(true);
  });
});
