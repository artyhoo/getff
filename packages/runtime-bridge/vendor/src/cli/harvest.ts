/**
 * CLI harvest entrypoint — the deterministic egress leg of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> \
 *     [--base <branch>] [--body-file <path>] [--no-auto-merge] [--container <name>] \
 *     [--repo-path <path>] [--work-dir <path>] [--host-repo <path>] \
 *     [--confirm-rework] [--confirm-unreported-files] [--confirm-dirty-residue]
 *
 * aif-handoff ends a task at "committed on a local feature branch" — it has no
 * push and no PR-creation in its autonomous path (verified 2026-06-01). This
 * command closes that gap: read the task's persisted `branchName` from aif's REST
 * API, push that already-made commit out of aif's container to origin, open a PR
 * against the trunk, and arm GitHub native auto-merge (which merges it on green CI).
 *
 * Rework exception (disambiguated): aif only commits on its approve_done &&
 * commitOnApprove path; the request_changes→implementing→done rework path leaves the
 * work uncommitted (dirty tree, branch == base HEAD). Harvest commits a dirty tree
 * deterministically (git add -A + a templated message, ZERO LLM) ONLY when the branch
 * is 0 commits ahead of base (the true-rework signature). When the branch already
 * carries commits, a dirty tree is stale base-state residue — harvest pushes the
 * existing commit(s) and leaves the tree behind (warns), never `add -A`'ing
 * out-of-scope files into the PR (the #370/#457 regression class).
 *
 * ZERO LLM by construction — plain git + gh. (aif's own commit flow spends a paid
 * `claude -p` query to run git; harvest does not.) Complies with no-paid-llm-in-ci.md.
 *
 * Egress mechanism — Channel A (host-pull + host push), per egress-no-api-bypass.md §1.
 * aif's commit lives only inside its container's checkout, and the container **cannot
 * push**: no route to `github.com:443` (a network block, not auth — re-measured on
 * `aif-handoff-agent-1` 2026-08-07: `curl https://github.com` → CONNECT FAILED in 0.21s)
 * and no pre-push toolchain, so a container-side push would both fail and, if it ever
 * "worked", bypass `.husky/pre-push` — the earliest reachable gate for this work. Harvest
 * therefore brings the commit to the HOST and pushes from there, in four deterministic
 * steps (no LLM, no Git-Data-API):
 *
 *   1. `docker exec <container> git -C <task-worktree> bundle create /tmp/<n>.bundle
 *      <baseRef>..<branch>` — a few KB for a normal task; falls back to a full-history
 *      bundle (no prerequisites) if the host lacks the range's base commit.
 *   2. `docker cp <container>:/tmp/<n>.bundle <host tmp>`.
 *   3. `git -C <hostRepo> fetch <bundle> refs/heads/<branch>` — lands in FETCH_HEAD ONLY.
 *      No local branch is created or moved, so no worktree can be desynced and no
 *      `update-ref` is needed. The fetched sha is then verified === the container's tip.
 *   4. `git -C <hostRepo> push origin <sha>:refs/heads/<branch>` — the real push, which
 *      runs `.husky/pre-push` for real. Pushing a ref the host checkout is NOT on is
 *      supported by design: the hook derives its range from git's push stdin (`local_sha`),
 *      not from HEAD (`packages/core/hooks/pre-push.ts:133-139`, the 2026-06-17
 *      cross-checkout fix). Host repo from --host-repo / RUNTIME_BRIDGE_HOST_REPO, else
 *      the cwd's `git rev-parse --show-toplevel`.
 *
 * The one Channel-A step harvest does NOT automate is the optional rebase onto live
 * `origin/<base>` (/harvest §1 step 4): a rebase needs a working tree and can conflict —
 * i.e. it is a judgment call, not a deterministic leg — so it stays operator-side and is
 * printed in the fallback. The PR is opened from the host where `gh` is authenticated. If
 * any step fails (docker down, container gone, pre-push RED, no host transport), harvest
 * prints the exact Channel-A manual commands and exits non-zero rather than guessing —
 * graceful degradation, no silent half-egress, and never a pointer at the dead channel.
 *
 * False-done guard (2026-06-23): aif can mark a task `done` while its agent internally
 * PARKED subtasks and left the work uncommitted (the Finding-F gap, `park.ts:139`). That
 * lands as the SAME shape as a legit rework leg — dirty tree + 0 commits ahead of base.
 * Harvest no longer auto-commits that shape silently: it HOLDS (exit 2), surfaces the
 * ambiguity + any park markers from the task log, and ships only when the operator re-runs
 * with `--confirm-rework` (confirming it is a genuine COMPLETE rework). The ≥1-commit and
 * clean paths are unchanged — full autopilot.
 *
 * Affected-files divergence guard (2026-07-17): aif's review/security gates self-report
 * which files they scoped their review to (`affected_files` in `reviewComments`). A file the
 * task touched but did NOT self-report was never reviewed by aif's gate — the 2026-07-17
 * DH-S1 incident's exact signature (a destructive Edit on an unreported 4th file closed
 * `done` because the gate only reviewed the 3 self-reported files). Harvest cross-checks the
 * self-report against the mechanical file-list (union of the branch's committed delta
 * `git diff --name-only <base>...HEAD` and the uncommitted `git diff --name-only HEAD`) and HOLDs
 * (exit 2) on any touched-but-unreported file, surfacing only when the operator re-runs with
 * `--confirm-unreported-files`. A null/unparseable self-report skips the guard (warn-only,
 * never guesses a format); the milder `self-report ∖ mechanical` direction never HOLDs.
 * See docs/meta-factory/research-patches/2026-07-17-aif-review-gate-affected-files-gap.md §7.
 *
 * Per-task checkout resolution (2026-08-07 defect fix): aif runs each task in its OWN
 * worktree (`<repoRoot>-<branch-slug>-<taskId>`), so every git read above must target THAT
 * directory. This CLI previously wired them all to a hard-coded base-clone constant, where
 * HEAD is `staging` (0 commits ahead of base) and `?? .claude/worktrees/` is permanent
 * untracked residue — i.e. the exact `dirty + 0-ahead` shape the false-done guard HOLDs on,
 * so every parallel task got a bogus HOLD and stranded uncollected. The checkout is now
 * resolved per task (`resolveWorkDir`: --work-dir → git's worktree list → aif's persisted
 * `worktreePath` → repo root) and PROVEN by a HEAD==branch preflight that fails loudly
 * rather than measuring the wrong tree. `--repo-path` / RUNTIME_BRIDGE_AIF_REPO_PATH move
 * the base clone itself for a differently-mounted aif.
 *
 * Exit codes: 0 = branch pushed + PR opened; 1 = guard failed / push or PR error (the
 * operator runs the printed fallback commands); 2 = HELD — either the ambiguous
 * done+0-ahead+dirty shape (re-run with --confirm-rework) or the affected-files divergence
 * (re-run with --confirm-unreported-files); nothing pushed in either case.
 * A foreground operator command, so a real exit code is useful in scripts.
 *
 * @cc-only-rationale: pure TS over git/gh/docker CLIs — no CC-only primitive, no
 *   paid LLM. Operator-side internal tooling (talks to the operator's own aif), so
 *   the docker coupling is acceptable per dual-implementation-discipline.md §3
 *   (internal tooling → CC/env-specific OK); it degrades to printed manual commands.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMain, parseCliArgs, CliArgError } from './cliEntry.js';
import { getTask } from './aifHttp.js';
import type { AifTaskFull } from './aifHttp.js';
import {
  bundleFileName,
  channelAFallbackCommands,
  harvestTask,
  parseTrackedDirtyFiles,
  parseWorktreeList,
  resolveWorkDir,
} from '../harvest.js';
import type {
  ChannelAContext,
  HarvestDeps,
  WorkDirResolution,
} from '../harvest.js';

/** Base clone inside the container — the ROOT, not any task's checkout (see {@link resolveTaskWorkDir}).
 *  Overridable for a differently-mounted aif via `--repo-path` / RUNTIME_BRIDGE_AIF_REPO_PATH. */
const DEFAULT_AIF_REPO_PATH = '/home/www/rules-as-tests-aif';

interface ParsedArgs {
  taskId?: string;
  base: string;
  bodyFile?: string;
  autoMerge: boolean;
  container: string;
  repoPath: string;
  workDir?: string;
  hostRepo?: string;
  confirmRework: boolean;
  confirmUnreportedFiles: boolean;
  confirmDirtyResidue: boolean;
}

/**
 * Parse the harvest invocation: one positional <taskId> plus flags.
 *
 * Strict (cliEntry.parseCliArgs over node:util parseArgs). The hand-rolled version
 * took the FIRST non-`--` token as the taskId, so `--base staging f1010da4` harvested
 * task 'staging' (A6-4 / D-4), and its `--flag <value>` lookup accepted the next token
 * even when that token was another flag, with the truthiness guard its four sibling
 * copies had dropped along the way (A6-7 / R-6). Throws {@link CliArgError} on every
 * such shape; main() turns that into exit 1 with the message.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const { values, positionals } = parseCliArgs(argv, {
    options: {
      base: { type: 'string' },
      'body-file': { type: 'string' },
      'no-auto-merge': { type: 'boolean' },
      container: { type: 'string' },
      'repo-path': { type: 'string' },
      'work-dir': { type: 'string' },
      'host-repo': { type: 'string' },
      'confirm-rework': { type: 'boolean' },
      'confirm-unreported-files': { type: 'boolean' },
      'confirm-dirty-residue': { type: 'boolean' },
    },
    maxPositionals: 1,
  });
  const str = (name: string): string | undefined =>
    values[name] as string | undefined;
  return {
    taskId: positionals[0],
    base: str('base') ?? 'staging',
    bodyFile: str('body-file'),
    autoMerge: values['no-auto-merge'] !== true,
    container:
      str('container') ??
      process.env['RUNTIME_BRIDGE_AIF_CONTAINER'] ??
      'aif-handoff-agent-1',
    repoPath:
      str('repo-path') ??
      process.env['RUNTIME_BRIDGE_AIF_REPO_PATH'] ??
      DEFAULT_AIF_REPO_PATH,
    workDir: str('work-dir'),
    hostRepo: str('host-repo') ?? process.env['RUNTIME_BRIDGE_HOST_REPO'],
    confirmRework: values['confirm-rework'] === true,
    confirmUnreportedFiles: values['confirm-unreported-files'] === true,
    confirmDirtyResidue: values['confirm-dirty-residue'] === true,
  };
}

/**
 * Run a git command in a specific checkout inside the aif container; returns stdout with
 * trailing whitespace stripped (leading whitespace is significant — see below).
 *
 * `workDir` is per-task, NOT the base clone — aif runs each task in its own worktree, so
 * passing the wrong directory here silently measures `staging` (the 2026-08-07 defect).
 *
 * `-c safe.directory=<workDir>` is load-bearing: `docker exec` runs as root while aif's
 * worktrees are `node`-owned, so git otherwise aborts with "detected dubious ownership"
 * (verified on `aif-handoff-agent-1`, 2026-08-07 — the base clone is root-owned and hid
 * this). Scoped to the one directory we were pointed at by aif's own record / git's own
 * worktree list — never a blanket `safe.directory=*`.
 *
 * Only TRAILING whitespace is stripped: `git status --porcelain` encodes the index column as
 * a leading SPACE (`" M path"`), so a plain `.trim()` shifted the first line left by one and
 * `parseTrackedDirtyFiles`' 3-char slice then ate the path's first character (`.claude/…`
 * reported as `claude/…` — observed on the live container 2026-08-07). No other git output
 * used here carries leading whitespace, so this is strictly safer.
 */
function dockerGit(container: string, workDir: string, args: string[]): string {
  return execFileSync(
    'docker',
    [
      'exec',
      container,
      'git',
      '-c',
      `safe.directory=${workDir}`,
      '-C',
      workDir,
      ...args,
    ],
    {
      encoding: 'utf8',
    },
  ).replace(/\s+$/, '');
}

/**
 * Run git in the HOST clone — the side that actually owns the push (Channel A).
 *
 * `quiet` captures stderr instead of letting execFileSync forward it to ours: the
 * range-bundle `verify` attempt is EXPECTED to fail on a host that lacks the prerequisite
 * commit, and printing its "Repository lacks these prerequisite commits" would read as an
 * error when it is just the first of two planned attempts.
 */
function hostGit(hostRepo: string, args: string[], quiet = false): string {
  return execFileSync('git', ['-C', hostRepo, ...args], {
    encoding: 'utf8',
    ...(quiet ? { stdio: ['ignore', 'pipe', 'pipe'] as const } : {}),
  }).trim();
}

/**
 * The host clone Channel A pushes from: `--host-repo` / RUNTIME_BRIDGE_HOST_REPO, else the
 * top level of whatever checkout the operator invoked harvest in.
 *
 * A worktree is a perfectly good answer — `.husky/pre-push` lives in every checkout of this
 * repo and the object store is shared with the main clone, so the fetched commit is visible
 * to the push either way.
 */
function resolveHostRepo(explicit?: string): string {
  if (explicit) return explicit;
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `harvest: cannot resolve the host repo to push from (cwd is not a git checkout) — ${msg}. ` +
        `Pass --host-repo <path> (or set RUNTIME_BRIDGE_HOST_REPO).`,
    );
  }
}

/**
 * Resolve the checkout that carries the task's branch, and prove it before any guard runs.
 *
 * Two steps, both deterministic:
 *  1. {@link resolveWorkDir} over git's live worktree map (+ aif's persisted `worktreePath`
 *     as the fallback record) — see that function for the full preference order.
 *  2. HEAD==branch preflight. A mismatch means the resolution landed on a checkout that is
 *     NOT the task (pruned worktree, hand-moved branch, wrong `--repo-path`). THROW rather
 *     than measure: the dirty-tree/commits-ahead guards are only meaningful against the
 *     task's own checkout, and a wrong-checkout measurement is exactly the silent-wrong-
 *     verdict class this fix exists to close (a printed warning would be attention, not a
 *     mechanism — attention-is-not-a-mechanism.md §1). Throwing degrades to the CLI's
 *     printed manual-fallback path, so the operator is never stuck.
 */
function resolveTaskWorkDir(
  container: string,
  args: ParsedArgs,
  task: AifTaskFull,
  branch: string,
): WorkDirResolution {
  let worktrees = new Map<string, string>();
  if (!args.workDir) {
    // Ground truth for branch→checkout. Non-fatal if it fails (e.g. an ancient git): the
    // resolution simply falls through to aif's record, and the preflight below still gates.
    try {
      worktrees = parseWorktreeList(
        dockerGit(container, args.repoPath, [
          'worktree',
          'list',
          '--porcelain',
        ]),
      );
    } catch {
      // no worktree map available — fall through to the task record / repo root
    }
  }
  const resolved = resolveWorkDir({
    branch,
    repoRoot: args.repoPath,
    worktrees,
    taskWorktreePath: task.worktreePath,
    explicit: args.workDir,
  });

  let head: string;
  try {
    head = dockerGit(container, resolved.path, [
      'rev-parse',
      '--abbrev-ref',
      'HEAD',
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `harvest: cannot read git HEAD in '${resolved.path}' (resolved via ${resolved.source}) — ${msg}`,
    );
  }
  if (head !== branch) {
    throw new Error(
      `harvest: checkout '${resolved.path}' (resolved via ${resolved.source}) is on '${head}', not the task branch ` +
        `'${branch}' — refusing to run the dirty-tree/commits-ahead guards against the wrong checkout (aif runs each ` +
        `task in its own worktree; measuring the base clone reports 'staging' and yields a bogus HOLD). ` +
        `Pass --work-dir <path> if the branch lives elsewhere.`,
    );
  }
  return resolved;
}

/**
 * First resolvable base ref inside the container. The container is a full clone
 * with `origin`, so prefer the durable remote ref `origin/<base>`; fall back to a
 * local `<base>` ref. Throws (→ graceful degradation prints the fallback) if the
 * base cannot be resolved — only ever reached on a DIRTY tree, never the clean path.
 */
function resolveBaseRef(
  container: string,
  workDir: string,
  base: string,
): string {
  for (const ref of [`origin/${base}`, base]) {
    try {
      dockerGit(container, workDir, [
        'rev-parse',
        '--verify',
        '--quiet',
        `${ref}^{commit}`,
      ]);
      return ref;
    } catch {
      // ref not present in the container — try the next candidate
    }
  }
  throw new Error(
    `harvest: base ref '${base}' not found in container (tried origin/${base}, ${base})`,
  );
}

/**
 * Wire the real git/gh/docker side-effects against the TASK's checkout. Each throws on
 * non-zero exit.
 *
 * The checkout is {@link resolveTaskWorkDir}'d (aif's per-task worktree, proven to be on the
 * task's branch), never a fixed base-clone constant. Working-tree reads (`status`,
 * `diff HEAD`) are only meaningful there; the commit-graph reads additionally name the
 * BRANCH ref rather than `HEAD`, so they stay correct even if the checkout is detached.
 *
 * Resolution is LAZY + memoised (`dir()`), deliberately: `harvestTask` guards status and
 * branchName BEFORE touching any dep, so a mistakenly harvested `backlog` task must still
 * fail with "status is not terminal" rather than a confusing "no worktree for this branch"
 * from an eager resolve. `checkout()` exposes whatever was resolved (the root until then) so
 * the CLI's HOLD/fallback messages point the operator at the directory actually measured.
 */
function realDeps(
  container: string,
  args: ParsedArgs,
  task: AifTaskFull,
): { deps: HarvestDeps; checkout: () => string } {
  let resolved: WorkDirResolution | null = null;
  const dir = (branch: string): string => {
    resolved ??= resolveTaskWorkDir(container, args, task, branch);
    return resolved.path;
  };
  const deps: HarvestDeps = {
    hasUncommittedChanges: async (branch) => {
      // The task's worktree is the one aif left dirty on the rework path.
      // `git status --porcelain` is empty iff the tree is clean.
      return (
        dockerGit(container, dir(branch), ['status', '--porcelain']).length > 0
      );
    },
    trackedDirtyFiles: async (branch) => {
      // Tracked-file modifications only — untracked residue like `?? .claude/worktrees/` is
      // the routine container leftover, not the D12 uncommitted-deliverable shape. Parsing
      // lives in the pure core so it is unit-testable (see parseTrackedDirtyFiles).
      return parseTrackedDirtyFiles(
        dockerGit(container, dir(branch), ['status', '--porcelain']),
      );
    },
    commitsAhead: async (branch, base) => {
      // How many commits the BRANCH carries ahead of base (git rev-list --count base..branch).
      // 0 ⇒ true-rework leg (branch == base HEAD) → harvest commits the dirty tree;
      // ≥1 ⇒ aif already committed the deliverable → harvest must NOT add -A the dirty
      // tree (stale base-state residue). Only called when the tree is dirty.
      const baseRef = resolveBaseRef(container, dir(branch), base);
      const n = dockerGit(container, dir(branch), [
        'rev-list',
        '--count',
        `${baseRef}..${branch}`,
      ]);
      return Number.parseInt(n, 10) || 0;
    },
    commitAll: async (branch, message) => {
      // Safety: only commit when the checkout is actually on the task's branch —
      // never bake stray changes into the wrong branch. Redundant with the preflight in
      // {@link resolveTaskWorkDir} (belt-and-braces: this dep is also reachable from tests
      // and any future non-CLI wiring). Throw (→ graceful degradation prints the manual
      // fallback) on a mismatch.
      const head = dockerGit(container, dir(branch), [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]);
      if (head !== branch) {
        throw new Error(
          `harvest: checkout '${dir(branch)}' is on '${head}', not the task branch '${branch}' — refusing to commit`,
        );
      }
      dockerGit(container, dir(branch), ['add', '-A']);
      dockerGit(container, dir(branch), ['commit', '-m', message]);
    },
    pushBranch: async (branch) => {
      // CHANNEL A — host-pull + host push (egress-no-api-bypass.md §1; procedure in
      // /harvest §1 step 4). NOT a container-side `git push`: the container has no route to
      // github.com:443 (network block, not auth) and no pre-push toolchain, so that channel
      // fails AND would bypass `.husky/pre-push`. Full rationale in the module docstring.
      const workDir = dir(branch);
      const hostRepo = resolveHostRepo(args.hostRepo);
      // The tip we intend to land, read from the container BEFORE any transport — the
      // identity check below proves the host received exactly this commit.
      const containerSha = dockerGit(container, workDir, ['rev-parse', branch]);
      const bundleName = bundleFileName(branch, task.id);
      const containerBundle = `/tmp/${bundleName}`;
      const hostBundle = join(tmpdir(), bundleName);
      try {
        // Range bundle first (a few KB — measured 14 KB for a 2-commit task branch on the
        // live container). Its prerequisite is the container's base commit, which the host
        // normally has; when it does NOT (the container fetched the trunk more recently than
        // the host), `git bundle verify` fails and the full-history bundle — prerequisite-
        // free by construction, ~13 MB for this repo — always verifies. Two attempts, both
        // deterministic; never a silent half-transport.
        const baseRef = resolveBaseRef(container, workDir, args.base);
        let verified = false;
        //
        // Only a failed VERIFY escalates to attempt 2. A failed `bundle create` throws
        // straight out (nothing is pushed): its realistic cause is an EMPTY range — a branch
        // with no commits ahead of base — and "Refusing to create empty bundle" before any
        // push beats silently landing a contentless branch on origin and failing later at
        // `gh pr create`.
        for (const rev of [`${baseRef}..${branch}`, branch]) {
          dockerGit(container, workDir, [
            'bundle',
            'create',
            containerBundle,
            rev,
          ]);
          execFileSync(
            'docker',
            ['cp', `${container}:${containerBundle}`, hostBundle],
            { stdio: 'pipe' },
          );
          try {
            hostGit(hostRepo, ['bundle', 'verify', hostBundle], true);
            verified = true;
            break;
          } catch {
            // prerequisite commit missing on the host — retry with full history
          }
        }
        if (!verified) {
          throw new Error(
            `harvest: bundle of '${branch}' from '${workDir}' does not verify against host repo '${hostRepo}' ` +
              `(tried the ${args.base}-range and full-history forms)`,
          );
        }

        // Land the commit in the host's object store via FETCH_HEAD ONLY. No local branch is
        // created or moved: nothing to desync a worktree, no `update-ref`, nothing to clean
        // up afterwards.
        hostGit(hostRepo, ['fetch', hostBundle, `refs/heads/${branch}`]);
        const fetched = hostGit(hostRepo, ['rev-parse', 'FETCH_HEAD']);
        if (fetched !== containerSha) {
          throw new Error(
            `harvest: host received ${fetched} for '${branch}' but the container's tip is ${containerSha} — ` +
              `refusing to push a commit that is not the task's HEAD`,
          );
        }

        // The real push. `.husky/pre-push` runs here — the earliest reachable gate for this
        // work, and the whole reason Channel A is the default. stdout/stderr go to OUR
        // stderr so the operator watches the gate live while stdout stays clean for the
        // result JSON; a RED gate exits non-zero → nothing is PR'd, and the caller prints
        // the Channel-A fallback.
        execFileSync(
          'git',
          ['-C', hostRepo, 'push', 'origin', `${fetched}:refs/heads/${branch}`],
          {
            stdio: ['ignore', 2, 2],
          },
        );
      } finally {
        // Best-effort cleanup of both bundle copies — a leftover temp file must never fail
        // an otherwise-successful egress.
        try {
          execFileSync(
            'docker',
            ['exec', container, 'rm', '-f', containerBundle],
            { stdio: 'pipe' },
          );
        } catch {
          // container gone / already cleaned — nothing to do
        }
        try {
          rmSync(hostBundle, { force: true });
        } catch {
          // host temp already gone — nothing to do
        }
      }
    },
    createPr: async ({ branch, base, title, body }) => {
      const out = execFileSync(
        'gh',
        [
          'pr',
          'create',
          '--base',
          base,
          '--head',
          branch,
          '--title',
          title,
          '--body',
          body,
        ],
        { encoding: 'utf8' },
      );
      // `gh pr create` prints the PR URL on the last non-empty line.
      const url = out.trim().split('\n').filter(Boolean).pop() ?? '';
      if (!/\/pull\/\d+/.test(url))
        throw new Error(
          `harvest: could not parse PR URL from gh output: ${out}`,
        );
      return url;
    },
    enableAutoMerge: async (prUrl) => {
      execFileSync('gh', ['pr', 'merge', prUrl, '--auto', '--squash'], {
        stdio: 'pipe',
      });
    },
    changedFilesVsBase: async (branch, base) => {
      // What the task actually touched, in BOTH states aif can leave the worktree in:
      //   (a) `<base>...<branch>` (THREE-dot) — the branch's committed delta from its merge-base
      //       with <base>. Drift-immune: it EXCLUDES files that changed only on <base> since
      //       the fork-point. This matters because aif's containers are long-lived (measured:
      //       `aif-handoff-agent-1` up 2 days, its `origin/staging` ~a month ahead of a
      //       June-forked branch), so the two-arg `git diff <base>` form reports the entire
      //       base-side drift — 1046 files where the branch changed 1 — which would HOLD on
      //       every task. Verified on the live container 2026-07-21.
      //   (b) `HEAD` — uncommitted working-tree changes (the dirty / rework leg), which only
      //       exist in the task's OWN worktree — reading them from the base clone reported
      //       that clone's residue instead (the 2026-08-07 defect).
      // Their union is exactly the task's file-set. Both are read via docker exec (the aif
      // agent has no git for push/merge — harvest drives git from the host side).
      const baseRef = resolveBaseRef(container, dir(branch), base);
      const committed = dockerGit(container, dir(branch), [
        'diff',
        '--name-only',
        `${baseRef}...${branch}`,
      ]);
      const uncommitted = dockerGit(container, dir(branch), [
        'diff',
        '--name-only',
        'HEAD',
      ]);
      const files = new Set<string>();
      for (const out of [committed, uncommitted]) {
        for (const f of out.split('\n')) if (f.length > 0) files.add(f);
      }
      return [...files];
    },
  };
  return { deps, checkout: () => resolved?.path ?? args.repoPath };
}

/**
 * The copy-pasteable form of a container-side READ, byte-identical in shape to what
 * {@link dockerGit} actually runs — including `-c safe.directory=<workDir>`, without which
 * the pasted command aborts with "detected dubious ownership" on any node-owned worktree
 * (`docker exec` runs as root). Reads are the ONLY thing the container can still do for us:
 * it has no route to github.com, so nothing printed here is ever a push.
 */
function containerRead(
  container: string,
  workDir: string,
  gitArgs: string,
): string {
  return `docker exec ${container} git -c safe.directory=${workDir} -C ${workDir} ${gitArgs}`;
}

async function main(): Promise<void> {
  let args: ParsedArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof CliArgError ? err.message : String(err);
    process.stderr.write(`[harvest] ${msg}\n`);
    process.exit(1);
  }
  if (!args.taskId) {
    process.stderr.write(
      '[harvest] usage: harvest.ts <taskId> [--base staging] [--body-file P] [--no-auto-merge] [--host-repo P]\n' +
        "[harvest]   egress = Channel A: the container's commit is bundled to the HOST and pushed from there\n" +
        "[harvest]   (--host-repo / RUNTIME_BRIDGE_HOST_REPO, default: the cwd's checkout) so .husky/pre-push runs.\n",
    );
    process.exit(1);
  }

  const baseUrl =
    process.env['RUNTIME_BRIDGE_AIF_URL'] ?? 'http://localhost:3009';

  // A5-7: getTask and the --body-file read used to run BEFORE this try, so an
  // unreachable aif, an unknown taskId or a mistyped --body-file escaped as a raw
  // unhandled-rejection stack — no `[harvest] FAILED:` line, no Channel-A fallback.
  // Every failure mode now reaches the classifier below.
  let task: AifTaskFull | undefined;
  let checkout: (() => string) | undefined;
  try {
    task = await getTask(baseUrl, args.taskId);

    // Body: prefer an explicit --body-file (the §1.7-compliant text the orchestrator
    // prepared); else a minimal pointer body. Harvest does not invent §1.7 substance.
    const body = args.bodyFile
      ? readFileSync(args.bodyFile, 'utf8')
      : `Harvested by runtime-bridge from aif task \`${args.taskId}\` (branch \`${task.branchName ?? '?'}\`).\n\n` +
        `> ⚠ No --body-file supplied — if this PR touches a §4b-gated path, edit the body to add the §1.7 sections before CI.`;

    const real = realDeps(args.container, args, task);
    const deps = real.deps;
    checkout = real.checkout;
    const res = await harvestTask(
      task,
      {
        baseBranch: args.base,
        body,
        autoMerge: args.autoMerge,
        confirmRework: args.confirmRework,
        confirmUnreportedFiles: args.confirmUnreportedFiles,
        confirmDirtyResidue: args.confirmDirtyResidue,
      },
      deps,
    );
    if (res.needsFileConfirm) {
      // Affected-files divergence guard (2026-07-17 gap): the task touched file(s) aif's
      // review-gate never self-reported, so the gate never reviewed them. Held deliberately
      // — nothing pushed. The operator inspects and re-runs with --confirm-unreported-files
      // ONLY if shipping the unreviewed files is intentional.
      process.stderr.write(
        `[harvest] HOLD: task '${args.taskId}' touched ${res.unreportedFiles?.length ?? 0} file(s) not in ` +
          `aif's self-reported affected_files: ${(res.unreportedFiles ?? []).join(', ')}. These were never ` +
          `reviewed by aif's gate. Re-run with --confirm-unreported-files to proceed. ` +
          `(aif review-gate gap — see docs/meta-factory/research-patches/2026-07-17-aif-review-gate-affected-files-gap.md §7)\n` +
          `[harvest]   inspect:  ${containerRead(args.container, checkout(), `diff -- ${(res.unreportedFiles ?? []).join(' ')}`)}\n` +
          `[harvest]   ship anyway:  tsx packages/runtime-bridge/src/cli/harvest.ts ${args.taskId} --confirm-unreported-files\n`,
      );
      process.exit(2);
    }
    if (res.needsConfirm) {
      // Ambiguous done+0-ahead+dirty shape: a legit COMPLETE rework OR aif partial/parked
      // work (the Finding-F false-done). Held deliberately — nothing committed or pushed.
      // Surface it; the operator inspects and re-runs with --confirm-rework ONLY if it is a
      // genuine complete rework. (False-done guard, 2026-06-23.)
      process.stderr.write(
        `[harvest] HELD: task '${args.taskId}' is DONE but branch '${res.branch}' is 0 commits ahead of ` +
          `'${args.base}' with a DIRTY tree — ambiguous (a complete rework leg OR aif partial/parked work, ` +
          `the Finding-F false-done). Nothing committed or pushed.\n` +
          (res.parkSignals && res.parkSignals.length > 0
            ? `[harvest]   park signals in the task log: ${res.parkSignals.join(', ')} → likely INCOMPLETE; inspect before shipping.\n`
            : `[harvest]   no park markers in the log, but 0-ahead+dirty is still ambiguous — inspect the diff.\n`) +
          `[harvest]   inspect:  ${containerRead(args.container, checkout(), 'diff')}\n` +
          `[harvest]   ship only if it IS a complete rework:  tsx packages/runtime-bridge/src/cli/harvest.ts ${args.taskId} --confirm-rework\n`,
      );
      process.exit(2);
    }
    if (res.needsResidueConfirm) {
      // D12 guard (2×2026-07-25): the branch carries commits AND tracked files sit
      // modified-but-uncommitted on top of them — indistinguishable from an uncommitted
      // rework aif's review gate wrongly passed to `done`. Held deliberately — nothing
      // pushed. Preferred fix: a request_changes round telling the worker to commit;
      // --confirm-dirty-residue ships the commits and abandons the modifications.
      process.stderr.write(
        `[harvest] HELD: task '${args.taskId}' is DONE, branch '${res.branch}' carries commits ahead of ` +
          `'${args.base}', but ${res.trackedDirtyFiles?.length ?? 0} TRACKED file(s) are modified and ` +
          `uncommitted on top of them: ${(res.trackedDirtyFiles ?? []).join(', ')}. This is the ` +
          `done-with-dirty-tree shape (D12) — the modifications may BE the deliverable (uncommitted ` +
          `rework). Nothing pushed.\n` +
          `[harvest]   inspect:  ${containerRead(args.container, checkout(), 'diff')}\n` +
          `[harvest]   preferred: deliver a request_changes round so the worker commits its own work\n` +
          `[harvest]   ship WITHOUT them (discardable residue only):  tsx packages/runtime-bridge/src/cli/harvest.ts ${args.taskId} --confirm-dirty-residue\n`,
      );
      process.exit(2);
    }
    if (res.dirtyTreeLeftBehind) {
      // Surfaced, not silent: the branch already carried commits, so harvest pushed
      // those and deliberately left the dirty tree behind (it is stale base-state
      // residue, NOT add -A'd into the PR — the #370/#457 regression class). If those
      // changes were intended, commit them inside the container and re-run.
      process.stderr.write(
        `[harvest] WARNING: branch '${res.branch}' had a DIRTY working tree but already carries commits ` +
          `ahead of '${args.base}' — pushed the existing commit(s) and LEFT the dirty tree uncommitted ` +
          `(stale base-state residue not swept into the PR).\n`,
      );
    }
    if (res.unmatchedSelfReport && res.unmatchedSelfReport.length > 0) {
      // Milder direction (self_report ∖ mechanical) — aif claimed files as affected that
      // the task did not actually touch. Never HOLDs; informational only.
      process.stderr.write(
        `[harvest] NOTE: aif self-reported ${res.unmatchedSelfReport.length} file(s) as affected that the task ` +
          `did not actually touch: ${res.unmatchedSelfReport.join(', ')} (cosmetic self-report drift, not blocking).\n`,
      );
    }
    process.stdout.write(
      JSON.stringify({
        ok: true,
        prUrl: res.prUrl,
        branch: res.branch,
        autoMerge: res.autoMerge,
        committed: res.committed,
        dirtyTreeLeftBehind: res.dirtyTreeLeftBehind,
      }) + '\n',
    );
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[harvest] FAILED: ${msg}\n`);
    // Graceful degradation: print the exact CHANNEL-A manual egress so the operator is never
    // stuck — host-pull + host push, the same channel the automated leg takes. Never the
    // container-side `git push` this fallback used to print: that channel is dead (no
    // github.com egress from the container) and pointing at it sent the operator in circles.
    // Channel-A fallback needs the task record; when getTask itself is what failed
    // there is nothing to point at, so the FAILED line above stands alone.
    if (task?.branchName) {
      const bundleName = bundleFileName(
        task.branchName,
        args.taskId ?? task.id,
      );
      const ctx: ChannelAContext = {
        container: args.container,
        // Resolving the per-task checkout shells into docker; if that fails too, name
        // the flag that fixes it rather than throwing out of the error handler.
        workDir: (() => {
          try {
            return checkout ? checkout() : '<work-dir — pass --work-dir>';
          } catch {
            return '<work-dir — pass --work-dir>';
          }
        })(),
        branch: task.branchName,
        baseRef: `origin/${args.base}`,
        base: args.base,
        // Best-effort: if even this cannot resolve, name the flag that fixes it rather than
        // printing a broken path.
        hostRepo: (() => {
          try {
            return resolveHostRepo(args.hostRepo);
          } catch {
            return '<host-repo — pass --host-repo>';
          }
        })(),
        containerBundlePath: `/tmp/${bundleName}`,
        hostBundlePath: join(tmpdir(), bundleName),
        title: task.title,
        autoMerge: args.autoMerge,
      };
      process.stderr.write(
        `[harvest] manual fallback — Channel A (host-pull + host push, egress-no-api-bypass.md §1):\n` +
          channelAFallbackCommands(ctx)
            .map((c) => `  ${c}\n`)
            .join(''),
      );
    }
    process.exit(1);
  }
}

// Run only as a real entrypoint (shared realpath-both-sides guard, cliEntry.ts isMain).
// harvest.ts had a bare top-level `void main()`: importing it for parseArgs/realDeps
// fired a real getTask and exited the importing process (A6-1 class, R-6).
//
// A5-7: a rejection escaping main() (including one thrown by the handler inside) must
// still print the harvest-shaped diagnostic, never a bare unhandled-rejection stack.
if (isMain(import.meta.url)) {
  void main().catch((err) => {
    process.stderr.write(
      `[harvest] FAILED: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
