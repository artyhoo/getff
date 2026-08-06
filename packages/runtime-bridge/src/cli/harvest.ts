/**
 * CLI harvest entrypoint — the deterministic egress leg of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> \
 *     [--base <branch>] [--body-file <path>] [--no-auto-merge] [--container <name>] \
 *     [--repo-path <path>] [--work-dir <path>] \
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
 * Egress mechanism: aif's commit lives only inside its container's checkout, which
 * already carries working push creds (GH_TOKEN credential helper). Harvest pushes
 * via `docker exec <container> git -C <repo> push` (container name from
 * --container / RUNTIME_BRIDGE_AIF_CONTAINER, default 'aif-handoff-agent-1'); the
 * PR is opened from the host where `gh` is authenticated. If docker / the container
 * is unavailable, harvest prints the exact manual git+gh commands and exits non-zero
 * rather than guessing — graceful degradation, no silent half-egress.
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
import { readFileSync } from 'node:fs';
import { getTask } from './aifHttp.js';
import type { AifTaskFull } from './aifHttp.js';
import { harvestTask, parseTrackedDirtyFiles, parseWorktreeList, resolveWorkDir } from '../harvest.js';
import type { HarvestDeps, WorkDirResolution } from '../harvest.js';

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
  confirmRework: boolean;
  confirmUnreportedFiles: boolean;
  confirmDirtyResidue: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional = argv.find((a) => !a.startsWith('--'));
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  return {
    taskId: positional,
    base: flag('--base') ?? 'staging',
    bodyFile: flag('--body-file'),
    autoMerge: !argv.includes('--no-auto-merge'),
    container: flag('--container') ?? process.env['RUNTIME_BRIDGE_AIF_CONTAINER'] ?? 'aif-handoff-agent-1',
    repoPath: flag('--repo-path') ?? process.env['RUNTIME_BRIDGE_AIF_REPO_PATH'] ?? DEFAULT_AIF_REPO_PATH,
    workDir: flag('--work-dir'),
    confirmRework: argv.includes('--confirm-rework'),
    confirmUnreportedFiles: argv.includes('--confirm-unreported-files'),
    confirmDirtyResidue: argv.includes('--confirm-dirty-residue'),
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
  return execFileSync('docker', ['exec', container, 'git', '-c', `safe.directory=${workDir}`, '-C', workDir, ...args], {
    encoding: 'utf8',
  }).replace(/\s+$/, '');
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
function resolveTaskWorkDir(container: string, args: ParsedArgs, task: AifTaskFull, branch: string): WorkDirResolution {
  let worktrees = new Map<string, string>();
  if (!args.workDir) {
    // Ground truth for branch→checkout. Non-fatal if it fails (e.g. an ancient git): the
    // resolution simply falls through to aif's record, and the preflight below still gates.
    try {
      worktrees = parseWorktreeList(dockerGit(container, args.repoPath, ['worktree', 'list', '--porcelain']));
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
    head = dockerGit(container, resolved.path, ['rev-parse', '--abbrev-ref', 'HEAD']);
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
function resolveBaseRef(container: string, workDir: string, base: string): string {
  for (const ref of [`origin/${base}`, base]) {
    try {
      dockerGit(container, workDir, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
      return ref;
    } catch {
      // ref not present in the container — try the next candidate
    }
  }
  throw new Error(`harvest: base ref '${base}' not found in container (tried origin/${base}, ${base})`);
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
      return dockerGit(container, dir(branch), ['status', '--porcelain']).length > 0;
    },
    trackedDirtyFiles: async (branch) => {
      // Tracked-file modifications only — untracked residue like `?? .claude/worktrees/` is
      // the routine container leftover, not the D12 uncommitted-deliverable shape. Parsing
      // lives in the pure core so it is unit-testable (see parseTrackedDirtyFiles).
      return parseTrackedDirtyFiles(dockerGit(container, dir(branch), ['status', '--porcelain']));
    },
    commitsAhead: async (branch, base) => {
      // How many commits the BRANCH carries ahead of base (git rev-list --count base..branch).
      // 0 ⇒ true-rework leg (branch == base HEAD) → harvest commits the dirty tree;
      // ≥1 ⇒ aif already committed the deliverable → harvest must NOT add -A the dirty
      // tree (stale base-state residue). Only called when the tree is dirty.
      const baseRef = resolveBaseRef(container, dir(branch), base);
      const n = dockerGit(container, dir(branch), ['rev-list', '--count', `${baseRef}..${branch}`]);
      return Number.parseInt(n, 10) || 0;
    },
    commitAll: async (branch, message) => {
      // Safety: only commit when the checkout is actually on the task's branch —
      // never bake stray changes into the wrong branch. Redundant with the preflight in
      // {@link resolveTaskWorkDir} (belt-and-braces: this dep is also reachable from tests
      // and any future non-CLI wiring). Throw (→ graceful degradation prints the manual
      // fallback) on a mismatch.
      const head = dockerGit(container, dir(branch), ['rev-parse', '--abbrev-ref', 'HEAD']);
      if (head !== branch) {
        throw new Error(`harvest: checkout '${dir(branch)}' is on '${head}', not the task branch '${branch}' — refusing to commit`);
      }
      dockerGit(container, dir(branch), ['add', '-A']);
      dockerGit(container, dir(branch), ['commit', '-m', message]);
    },
    pushBranch: async (branch) => {
      // Push from INSIDE the container (it holds the commit + working push creds).
      dockerGit(container, dir(branch), ['push', 'origin', branch]);
    },
    createPr: async ({ branch, base, title, body }) => {
      const out = execFileSync(
        'gh',
        ['pr', 'create', '--base', base, '--head', branch, '--title', title, '--body', body],
        { encoding: 'utf8' },
      );
      // `gh pr create` prints the PR URL on the last non-empty line.
      const url = out.trim().split('\n').filter(Boolean).pop() ?? '';
      if (!/\/pull\/\d+/.test(url)) throw new Error(`harvest: could not parse PR URL from gh output: ${out}`);
      return url;
    },
    enableAutoMerge: async (prUrl) => {
      execFileSync('gh', ['pr', 'merge', prUrl, '--auto', '--squash'], { stdio: 'pipe' });
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
      const committed = dockerGit(container, dir(branch), ['diff', '--name-only', `${baseRef}...${branch}`]);
      const uncommitted = dockerGit(container, dir(branch), ['diff', '--name-only', 'HEAD']);
      const files = new Set<string>();
      for (const out of [committed, uncommitted]) {
        for (const f of out.split('\n')) if (f.length > 0) files.add(f);
      }
      return [...files];
    },
  };
  return { deps, checkout: () => resolved?.path ?? args.repoPath };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.taskId) {
    process.stderr.write('[harvest] usage: harvest.ts <taskId> [--base staging] [--body-file P] [--no-auto-merge]\n');
    process.exit(1);
  }

  const baseUrl = process.env['RUNTIME_BRIDGE_AIF_URL'] ?? 'http://localhost:3009';
  const task = await getTask(baseUrl, args.taskId);

  // Body: prefer an explicit --body-file (the §1.7-compliant text the orchestrator
  // prepared); else a minimal pointer body. Harvest does not invent §1.7 substance.
  const body = args.bodyFile
    ? readFileSync(args.bodyFile, 'utf8')
    : `Harvested by runtime-bridge from aif task \`${args.taskId}\` (branch \`${task.branchName ?? '?'}\`).\n\n` +
      `> ⚠ No --body-file supplied — if this PR touches a §4b-gated path, edit the body to add the §1.7 sections before CI.`;

  const { deps, checkout } = realDeps(args.container, args, task);
  try {
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
          `[harvest]   inspect:  docker exec ${args.container} git -C ${checkout()} diff -- ${(res.unreportedFiles ?? []).join(' ')}\n` +
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
          `[harvest]   inspect:  docker exec ${args.container} git -C ${checkout()} diff\n` +
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
          `[harvest]   inspect:  docker exec ${args.container} git -C ${checkout()} diff\n` +
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
    // Graceful degradation: print the exact manual egress so the operator is never stuck.
    if (task.branchName) {
      process.stderr.write(
        `[harvest] manual fallback:\n` +
          `  docker exec ${args.container} git -C ${checkout()} push origin ${task.branchName}\n` +
          `  gh pr create --base ${args.base} --head ${task.branchName} --title "${task.title}" --body "..."\n` +
          (args.autoMerge ? `  gh pr merge <pr-url> --auto --squash\n` : ''),
      );
    }
    process.exit(1);
  }
}

void main();
