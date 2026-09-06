// packages/runtime-bridge/src/harvest.ts
/**
 * Harvest — the deterministic egress leg of the bridge.
 *
 * aif-handoff, by design, ends a task at "committed on a local feature branch +
 * auto-reviewed". It has NO push and NO PR-creation in its autonomous (HANDOFF)
 * path (verified 2026-06-01 against the running containers: `git push` lives only
 * in the LLM-driven `/aif-commit` flow, no `gh pr create` anywhere). So the
 * committed work strands inside aif's checkout, never reaching a reviewable PR on
 * the trunk.
 *
 * This is the missing return leg: take whatever aif committed (by its persisted
 * `task.branchName`), push that branch to origin, open a PR against the trunk, and
 * arm GitHub native auto-merge. It depends on NOTHING inside aif's commit state
 * machine — it ships the existing commit as-is.
 *
 * Deliberately ZERO LLM: aif's own commit flow spends a paid `claude -p` query just
 * to run `git add/commit/push` (a deterministic op). Harvest is plain git + gh, so
 * it costs nothing and complies with no-paid-llm-in-ci.md by construction.
 *
 * This module is the PURE core (dependency-injected) so it is unit-testable without
 * shelling out. The CLI wrapper (cli/harvest.ts) wires the real git/gh/docker
 * implementations.
 *
 * @cc-only-rationale: pure TS over injected deps — no CC-only primitive, no paid LLM.
 */

/** Terminal aif statuses whose work is committed and safe to harvest. */
const TERMINAL_STATUSES = new Set(['done', 'verified']);

/**
 * Park markers an aif agent leaves in its task record when it internally PARKS a subtask
 * but the task still reaches `done` — the "Finding-F" false-done gap (`park.ts:139` refuses
 * a review-stage park, so the park narration never reaches the task status). INFORMATIONAL
 * ONLY: the {@link harvestTask} guard surfaces on the 0-commits-ahead shape regardless, so a
 * missed/oddly-phrased marker never causes a silent ship — these signals only make the
 * surfaced message actionable ("the log shows a park → likely incomplete").
 */
const PARK_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
  ['park', /\bpark(ed|ing|-candidate)?\b/i],
  ['manualReviewRequired', /manualReviewRequired/i],
  ['blocked_external', /blocked[_-]external/i],
  ['not-mine-to-override', /not mine to override/i],
  ['open-question-anchor', /##\s*⏸\s*OPEN QUESTION/i],
];

/** The free-text fields of an aif task that {@link scanParkSignals} inspects. */
export interface ParkScanInput {
  implementationLog?: string | null;
  reviewComments?: string | null;
  blockedReason?: string | null;
  plan?: string | null;
}

/**
 * Return the names of any park markers present in the task's free-text fields. Pure,
 * deterministic, ZERO LLM. An empty result is NOT a guarantee of completeness — it only
 * means no known marker was found (the guard does not rely on this; see {@link PARK_MARKERS}).
 */
export function scanParkSignals(task: ParkScanInput): string[] {
  const haystack = [task.implementationLog, task.reviewComments, task.blockedReason, task.plan]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join('\n');
  if (!haystack) return [];
  return PARK_MARKERS.filter(([, re]) => re.test(haystack)).map(([name]) => name);
}

/**
 * Extract aif's SELF-REPORTED affected_files list from a task's `reviewComments`.
 *
 * `reviewComments` is markdown prose (## sections) with one or more embedded gate-result
 * JSON blocks, each of which may carry an `"affected_files": [...]` array (aif's review /
 * security gates self-report the files they scoped their review to — see
 * `.claude/skills/aif-review/SKILL.md`). This is NOT a JSON document, so it cannot be
 * `JSON.parse`d whole; the affected_files arrays are located by pattern and parsed
 * individually, then unioned across gate blocks.
 *
 * Returns:
 *   • `string[]` — the union of every parseable `affected_files` array (possibly empty
 *     `[]` when a gate explicitly self-reported no files).
 *   • `null`     — no parseable affected_files block present (aif did not emit a structured
 *     self-report for this task). The divergence guard treats null as "nothing to
 *     cross-check" and proceeds (warn-only), never HOLDing on an unknown/absent format.
 *
 * Pure, deterministic, ZERO LLM.
 */
export function extractAffectedFiles(reviewComments: string | null | undefined): string[] | null {
  if (!reviewComments) return null;
  // Locate each `"affected_files": [ ... ]` array (paths never contain `]`, so the
  // greedy-to-first-`]` capture is safe) and JSON.parse it individually; skip any
  // malformed block. `found` distinguishes an explicit empty self-report ([]) from an
  // absent one (null).
  const re = /"affected_files"\s*:\s*(\[[^\]]*\])/g;
  const files = new Set<string>();
  let found = false;
  for (let m = re.exec(reviewComments); m !== null; m = re.exec(reviewComments)) {
    try {
      const arr: unknown = JSON.parse(m[1]);
      if (Array.isArray(arr)) {
        found = true;
        for (const f of arr) if (typeof f === 'string') files.add(f);
      }
    } catch {
      // malformed affected_files block — not extractable, skip it
    }
  }
  return found ? [...files] : null;
}

/**
 * Parse `git worktree list --porcelain` into a `branch → checkout path` map.
 *
 * aif runs every task in its OWN worktree (a sibling directory
 * `<repoRoot>-<branch-slug>-<taskId>`), NOT in the base clone. So "where is this branch
 * checked out" is the question EVERY working-tree guard below must answer before it
 * measures anything — a guard run against the base clone measures `staging`, not the task
 * (see {@link resolveWorkDir}). Git's own worktree list is the ground truth for that map.
 *
 * Porcelain format: `worktree <path>` / `HEAD <sha>` / (`branch refs/heads/<name>` OR
 * `detached`), records separated by a blank line. Detached worktrees carry no branch line
 * and are simply absent from the map — they are not addressable by branch name anyway.
 *
 * Pure, deterministic, ZERO LLM.
 */
export function parseWorktreeList(porcelain: string): Map<string, string> {
  const map = new Map<string, string>();
  let current: string | null = null;
  for (const raw of porcelain.split('\n')) {
    const line = raw.trim();
    if (line.length === 0) {
      current = null;
    } else if (line.startsWith('worktree ')) {
      current = line.slice('worktree '.length);
    } else if (line.startsWith('branch ') && current !== null) {
      const ref = line.slice('branch '.length);
      map.set(ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref, current);
    }
  }
  return map;
}

/**
 * Extract TRACKED-file modifications from `git status --porcelain` output — the D12 guard's
 * input ({@link HarvestDeps.trackedDirtyFiles}).
 *
 * Porcelain v1 lines are `XY<space>PATH`, where X (index) and Y (worktree) are each a status
 * letter OR A SPACE: an unstaged modification is `" M path"`, i.e. the leading column is a
 * significant space. Untracked lines (`?? path`) are excluded — that is the routine container
 * residue (`?? .claude/worktrees/`), not an uncommitted deliverable.
 *
 * The 3-char slice is only correct while that leading column survives, which is why the
 * caller must NOT left-trim the raw output (doing so ate the first path's first character —
 * `.claude/hooks/x.sh` reported as `claude/hooks/x.sh`, observed 2026-08-07).
 *
 * Pure, deterministic, ZERO LLM.
 */
export function parseTrackedDirtyFiles(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .filter((l) => l.length > 3 && !l.startsWith('??'))
    .map((l) => l.slice(3));
}

/**
 * A filesystem-safe basename for the transport bundle Channel A carries from the container
 * to the host (see {@link channelAFallbackCommands} for the channel itself).
 *
 * Branch names contain `/` (`feature/thing-abc`), so naming a bundle after one directly
 * either fails (`/tmp/feature/thing-abc.bundle` — no such directory) or, with a hostile
 * branch name, escapes the temp directory the caller picked. Everything outside
 * `[A-Za-z0-9._-]` collapses to `-` and every `..` run collapses to a single `.`, so the
 * result is always exactly ONE path segment that cannot traverse upward — the caller may
 * `join()` it onto any directory without re-checking. Both components are length-capped so
 * the name stays under every filesystem's basename limit.
 *
 * Pure, deterministic, ZERO LLM.
 */
export function bundleFileName(branch: string, taskId: string): string {
  const seg = (s: string, max: number): string =>
    s
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/\.{2,}/g, '.')
      .slice(0, max)
      .replace(/^[-.]+|[-.]+$/g, '');
  return `aif-harvest-${seg(branch, 60) || 'branch'}-${seg(taskId, 40) || 'task'}.bundle`;
}

/** Everything {@link channelAFallbackCommands} needs to print a runnable manual egress. */
export interface ChannelAContext {
  /** aif container holding the task's checkout. */
  container: string;
  /** The task's OWN checkout inside the container (its per-task worktree, not the base clone). */
  workDir: string;
  /** Branch carrying the committed work. */
  branch: string;
  /** Container-side ref to bundle FROM (e.g. `origin/staging`) — the bundle's prerequisite. */
  baseRef: string;
  /** PR base branch (e.g. `staging`). */
  base: string;
  /** Host clone that owns the push — where `.husky/pre-push` actually runs. */
  hostRepo: string;
  /** Where the bundle is written inside the container. */
  containerBundlePath: string;
  /** Where the bundle lands on the host. */
  hostBundlePath: string;
  /** PR title (the task title). */
  title: string;
  /** Whether the operator asked for GitHub native auto-merge. */
  autoMerge: boolean;
}

/**
 * POSIX-shell-quote one argument of a printed copy-paste command.
 *
 * The fallback lines ARE the operator's recovery path, so every interpolated value has to
 * survive a paste, and every one of them is free text somebody else controls: the PR title
 * comes from the aif board (`cli/harvest.ts` feeds `task.title`), the branch from aif's
 * planner, the checkout/host paths from operator flags. Raw interpolation put the title
 * inside a double-quoted `--title "…"` and left the paths bare, so a title carrying `"`,
 * `$(` or a backtick either broke the line or EXECUTED its contents when pasted, and a path
 * with a space silently split into two arguments (#1597 review ledger A5-6).
 *
 * Values built only of shell-safe characters come back verbatim: quoting a clean path would
 * make the printed procedure harder to read for the ordinary case and buys no safety, and
 * the fallback's readability is the whole reason it is printed rather than executed.
 */
export function shellQuote(value: string): string {
  if (value.length > 0 && /^[A-Za-z0-9@%_+=:,./-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * The manual egress commands harvest prints when its automated leg fails — Channel A
 * verbatim ([.claude/rules/egress-no-api-bypass.md §1](../../../.claude/rules/egress-no-api-bypass.md),
 * procedure in [/harvest §1 step 4](../../../.claude/skills/harvest/SKILL.md)).
 *
 * This is pure data on purpose. The printed fallback IS the operator's recovery path, so it
 * must not be able to drift from the channel the code takes: the CLI prints exactly these
 * lines, and the unit test asserts the one property that matters — **no container-side
 * `git push` ever appears here**. That command was the 2026-08-07 defect: the container has
 * no route to `github.com:443` (measured on `aif-handoff-agent-1`: `curl https://github.com`
 * → CONNECT FAILED in 0.21s), so both the automated leg and the printed fallback pointed the
 * operator at a channel that cannot work.
 *
 * Every entry is a copy-pasteable shell line (trailing `#` comments and the standalone
 * comment line are inert when pasted).
 *
 * Pure, deterministic, ZERO LLM.
 */
export function channelAFallbackCommands(ctx: ChannelAContext): string[] {
  const q = shellQuote;
  const cGit = `docker exec ${q(ctx.container)} git -c ${q(`safe.directory=${ctx.workDir}`)} -C ${q(ctx.workDir)}`;
  const hGit = `git -C ${q(ctx.hostRepo)}`;
  return [
    `${cGit} bundle create ${q(ctx.containerBundlePath)} ${q(`${ctx.baseRef}..${ctx.branch}`)}  # bundle the commit OUT (the container has no github.com egress)`,
    `docker cp ${q(`${ctx.container}:${ctx.containerBundlePath}`)} ${q(ctx.hostBundlePath)}`,
    `${hGit} fetch ${q(ctx.hostBundlePath)} ${q(`refs/heads/${ctx.branch}`)}  # lands in FETCH_HEAD only — no local branch is created or moved`,
    `# optional (/harvest §1 step 4): rebase onto live origin/${ctx.base} in a scratch worktree before pushing, if the branch forked long ago`,
    `${hGit} push origin ${q(`FETCH_HEAD:refs/heads/${ctx.branch}`)}  # host push — runs .husky/pre-push, the gate the container cannot run`,
    `gh pr create --base ${q(ctx.base)} --head ${q(ctx.branch)} --title ${q(ctx.title)} --body "..."`,
    ...(ctx.autoMerge ? [`gh pr merge <pr-url> --auto --squash`] : []),
  ];
}

/** Which source {@link resolveWorkDir} took the checkout path from (surfaced in errors). */
export type WorkDirSource = 'explicit' | 'worktree-list' | 'task-record' | 'repo-root';

export interface WorkDirResolution {
  /** Absolute path of the checkout the guards must measure. */
  path: string;
  source: WorkDirSource;
}

/**
 * Resolve WHICH checkout carries the task's branch — the fix for the 2026-08-07 defect.
 *
 * Before this, the CLI wired every git call to a hard-coded base-clone constant while aif
 * ran the task in a separate worktree. The guards therefore measured the base clone: HEAD =
 * `staging` (0 commits ahead of base) plus the base clone's routine untracked residue
 * (`?? .claude/worktrees/`) = the exact `dirty + 0-ahead` shape the false-done guard HOLDs
 * on. Every parallel task harvested that way got a bogus `needsConfirm` HOLD and stranded.
 *
 * Preference order, strongest evidence first:
 *  1. `explicit`      — operator override (`--work-dir`); escape hatch, trusted as given.
 *  2. `worktree-list` — git's live branch→path map ({@link parseWorktreeList}); ground truth
 *                       for the CURRENT state, and it covers the base clone itself when the
 *                       branch happens to be checked out there (aif's non-parallel path).
 *  3. `task-record`   — aif's persisted `worktreePath`. A record, so it can go stale (pruned
 *                       worktree); consulted only when git's own map has no entry.
 *  4. `repo-root`     — historic default. Reached only when nothing knows the branch; the
 *                       CLI's HEAD==branch preflight then FAILS LOUDLY instead of silently
 *                       measuring the wrong checkout (that silence WAS the defect).
 *
 * Pure, deterministic, ZERO LLM.
 */
export function resolveWorkDir(opts: {
  branch: string;
  repoRoot: string;
  worktrees: ReadonlyMap<string, string>;
  taskWorktreePath?: string | null;
  explicit?: string | null;
}): WorkDirResolution {
  if (opts.explicit) return { path: opts.explicit, source: 'explicit' };
  const fromGit = opts.worktrees.get(opts.branch);
  if (fromGit) return { path: fromGit, source: 'worktree-list' };
  if (opts.taskWorktreePath) return { path: opts.taskWorktreePath, source: 'task-record' };
  return { path: opts.repoRoot, source: 'repo-root' };
}

/** The injected side-effects harvest performs, in order. */
export interface HarvestDeps {
  /**
   * Whether the branch's checkout has uncommitted changes. A dirty tree is
   * AMBIGUOUS on its own — it is the rework leg ONLY when paired with zero commits
   * ahead of base (see {@link commitsAhead}). aif's container also routinely leaves
   * a dirty tree AFTER committing the real work (stale base-state residue: reverted
   * CLAUDE.md/rules, resurrected deleted skill dirs), so "dirty" alone must NOT
   * trigger an `add -A` commit.
   */
  hasUncommittedChanges: (branchName: string) => Promise<boolean>;
  /**
   * TRACKED-file modifications in the checkout (`git status --porcelain` lines NOT
   * starting with `??`), as repo-relative paths. Discriminates the two dirty shapes
   * on the ≥1-commits-ahead leg: untracked-only dirt is the routine container residue
   * (`?? .claude/worktrees/`) and stays a warn-and-proceed; a MODIFIED tracked file on
   * top of existing commits is the D12 shape — aif's review gate passed the task to
   * `done` with the (part of the) deliverable uncommitted, observed twice on
   * 2026-07-25 (tasks 06394a7f round-1 rework, dbe542d8 initial run). Pushing the
   * commits alone would silently drop that work, so harvest HOLDs instead
   * ({@link HarvestResult.needsResidueConfirm}).
   */
  trackedDirtyFiles: (branchName: string) => Promise<string[]>;
  /**
   * How many commits the branch carries ahead of `base`
   * (`git rev-list --count <base>..HEAD`). This is the disambiguator the dirty-tree
   * check needs:
   *   • 0  → TRUE REWORK: aif's request_changes→implementing→done path left the work
   *          uncommitted (dirty tree, branch == base HEAD). Harvest must commit it.
   *   • ≥1 → STALE RESIDUE: aif already committed the deliverable; the dirty tree is
   *          out-of-scope base-state churn. `git add -A` would sweep those files into
   *          the PR (the #370/#457 regression class). Harvest must push the existing
   *          commit(s) only and leave the dirty tree behind.
   */
  commitsAhead: (branchName: string, base: string) => Promise<number>;
  /**
   * Deterministically commit all changes on the branch (git add -A && git commit
   * -m <message>). ZERO LLM — the message is templated from the task, never
   * generated — so the rework leg stays within no-paid-llm-in-ci.md.
   */
  commitAll: (branchName: string, message: string) => Promise<void>;
  /**
   * Land the (already-committed) feature branch on origin. The CLI wires this to **Channel
   * A** — bring the container's commit to the HOST and push from there
   * ([egress-no-api-bypass.md §1](../../../.claude/rules/egress-no-api-bypass.md)) — never a
   * container-side `git push`: the container has no route to `github.com:443` (a network
   * block, not auth) and lacks the pre-push toolchain, so that channel both fails and would
   * bypass `.husky/pre-push`, the earliest reachable gate for this work.
   */
  pushBranch: (branchName: string) => Promise<void>;
  /** Open a PR for the pushed branch against `base`; returns the PR URL. */
  createPr: (opts: { branch: string; base: string; title: string; body: string }) => Promise<string>;
  /** Arm GitHub native auto-merge on the PR (merges itself on green CI). */
  enableAutoMerge: (prUrl: string) => Promise<void>;
  /**
   * The mechanical file-list of what the task actually changed vs `base` — the union of the
   * branch's committed delta from its merge-base (`git diff --name-only <base>...HEAD`,
   * three-dot, drift-immune) and the uncommitted working-tree changes (`git diff --name-only
   * HEAD`), so it covers BOTH the committed and the dirty-tree states aif can leave. This is
   * the ground truth the affected-files divergence guard cross-checks against aif's
   * self-report. Only consulted when the task carries a structured self-report (see
   * {@link extractAffectedFiles}).
   */
  changedFilesVsBase: (branchName: string, base: string) => Promise<string[]>;
}

export interface HarvestOpts {
  /** Trunk the PR targets (e.g. "staging"). */
  baseBranch: string;
  /** PR body (the §1.7-compliant text the orchestrator/aif prepared). */
  body: string;
  /** Arm GitHub auto-merge after opening the PR. */
  autoMerge: boolean;
  /** Explicit operator confirmation that a dirty + 0-commits-ahead tree is a genuine
   *  COMPLETE rework leg to commit-and-ship — NOT aif partial/parked work. Without it that
   *  ambiguous shape is surfaced ({@link HarvestResult.needsConfirm}) instead of silently
   *  auto-committed (false-done guard, 2026-06-23). The ≥1-commit and clean paths ignore it. */
  confirmRework?: boolean;
  /** Explicit operator confirmation to ship despite files touched-but-not-self-reported by
   *  aif (the affected-files divergence guard, 2026-07-17). Without it, a non-empty
   *  `mechanical ∖ self-report` set surfaces ({@link HarvestResult.needsFileConfirm}) instead
   *  of pushing — those files were never reviewed by aif's gate. */
  confirmUnreportedFiles?: boolean;
  /** Explicit operator confirmation that tracked-file modifications left uncommitted on
   *  top of ≥1 commits are genuinely discardable residue — NOT an uncommitted rework
   *  (the D12 done-with-dirty-tree shape, 2×2026-07-25). Without it that shape surfaces
   *  ({@link HarvestResult.needsResidueConfirm}) instead of pushing the commits and
   *  silently leaving the modifications behind. Untracked-only dirt never needs it. */
  confirmDirtyResidue?: boolean;
}

export interface HarvestResult {
  prUrl: string;
  branch: string;
  pushed: boolean;
  autoMerge: boolean;
  /** True when harvest had to commit a dirty tree (true-rework leg: dirty tree +
   *  0 commits ahead of base); false on the normal path where aif already committed. */
  committed: boolean;
  /** True when the tree was dirty but harvest deliberately LEFT it uncommitted
   *  because the branch already carried commits ahead of base — the committed work
   *  is the deliverable and the dirty tree is stale base-state residue that must not
   *  be `add -A`'d into the PR. Operator-visible so the CLI can warn. */
  dirtyTreeLeftBehind: boolean;
  /** True when harvest STOPPED on the ambiguous `done + 0-commits-ahead + dirty` shape
   *  (a legit rework OR aif partial/parked work — mechanically indistinguishable) and did
   *  NOT commit/push/PR. The operator inspects, then re-runs with `confirmRework` to ship a
   *  genuine rework. Mutually exclusive with `pushed`. Absent on every non-ambiguous path. */
  needsConfirm?: boolean;
  /** Informational park markers found in the task log when `needsConfirm` (see
   *  {@link scanParkSignals}). Surfaced to make the operator's call actionable; an empty
   *  list does NOT mean "definitely complete". */
  parkSignals?: string[];
  /** True when harvest STOPPED because aif touched file(s) it did not self-report in
   *  `affected_files` — the review-gate never reviewed them (2026-07-17 gap). Did NOT
   *  push/PR. Operator inspects, then re-runs with `confirmUnreportedFiles`. Mutually
   *  exclusive with `pushed`. Absent on every non-diverging path. */
  needsFileConfirm?: boolean;
  /** The `mechanical ∖ self-report` set: files the task changed but aif did not report as
   *  affected — present with `needsFileConfirm` (the incident's exact signature). */
  unreportedFiles?: string[];
  /** The `self-report ∖ mechanical` set: files aif claimed as affected but the task did NOT
   *  touch. Milder (warn-only, never HOLDs) — surfaced so the CLI can warn. */
  unmatchedSelfReport?: string[];
  /** True when harvest STOPPED on the D12 shape: branch carries ≥1 commit ahead of base AND
   *  tracked files are modified-but-uncommitted on top of them. Mechanically indistinguishable
   *  from discardable residue vs an uncommitted rework the review gate wrongly passed to
   *  `done` (observed 2×2026-07-25) — so nothing is pushed. The operator inspects the diff:
   *  either drive a `request_changes` round so the worker commits, or re-run with
   *  `confirmDirtyResidue` to push the commits and leave the modifications behind.
   *  Mutually exclusive with `pushed`. Absent on every clean or untracked-only path. */
  needsResidueConfirm?: boolean;
  /** The tracked-modified file list — present with `needsResidueConfirm`. */
  trackedDirtyFiles?: string[];
}

/** The subset of an aif task harvest reads. */
export interface HarvestableTask {
  id: string;
  title: string;
  status: string;
  branchName?: string | null;
  /** Free-text task fields the false-done guard scans for park signals (informational).
   *  Optional — the CLI passes them from the fetched task; unit tests may omit them. */
  implementationLog?: string | null;
  reviewComments?: string | null;
  blockedReason?: string | null;
  plan?: string | null;
}

/**
 * Harvest a completed aif task into a reviewable PR on the trunk.
 *
 * Order is load-bearing and fail-fast:
 *  1. guard status is terminal (work is committed) — else throw BEFORE any push.
 *  2. guard branchName present — else throw BEFORE opening a PR.
 *  3. dirty-tree disambiguation: a dirty tree is committed ONLY on the true-rework
 *     leg (0 commits ahead of base, i.e. branch == base HEAD). When the branch
 *     already carries commits: untracked-only dirt is stale base-state residue —
 *     push the existing commit(s), leave the tree behind (dirtyTreeLeftBehind),
 *     never `add -A`; MODIFIED tracked files on top of commits are the D12 shape
 *     (uncommitted rework passed to `done`, 2×2026-07-25) — HOLD
 *     (needsResidueConfirm) unless confirmDirtyResidue. If the rework commit
 *     throws, nothing is pushed (operator gets the printed fallback).
 *  4. push → createPr → (optional) enableAutoMerge. If createPr throws, auto-merge
 *     is never armed (no half-merged state).
 */
export async function harvestTask(
  task: HarvestableTask,
  opts: HarvestOpts,
  deps: HarvestDeps,
): Promise<HarvestResult> {
  if (!TERMINAL_STATUSES.has(task.status)) {
    throw new Error(
      `harvest: task ${task.id} status=${task.status} is not terminal (done/verified) — nothing to harvest yet`,
    );
  }
  const branch = task.branchName;
  if (!branch) {
    throw new Error(`harvest: task ${task.id} has no branchName — aif did not create/persist a feature branch`);
  }

  // Dirty-tree disambiguation. A dirty tree is NOT sufficient to trigger an
  // `add -A` commit — aif's container routinely leaves a dirty tree AFTER committing
  // the real work (stale base-state residue: reverted CLAUDE.md/rules, resurrected
  // deleted skill dirs). The commits-ahead count disambiguates the two cases:
  //   • 0 ahead  → TRUE REWORK: the request_changes→implementing→done path stranded
  //     the work uncommitted (dirty tree, branch == base HEAD). Commit it
  //     deterministically (templated message, ZERO LLM) so there is a real commit to push.
  //   • ≥1 ahead → STALE RESIDUE: the committed work IS the deliverable. `git add -A`
  //     here would sweep out-of-scope stale files into the PR (the #370/#457 regression
  //     class). Push the existing commit(s) only; leave the dirty tree behind and
  //     surface it via dirtyTreeLeftBehind so the operator is warned.
  let committed = false;
  let dirtyTreeLeftBehind = false;
  if (await deps.hasUncommittedChanges(branch)) {
    if ((await deps.commitsAhead(branch, opts.baseBranch)) === 0) {
      // Ambiguous shape: dirty + 0 ahead = a legit COMPLETE rework leg OR aif partial/parked
      // work that still reached `done` (the Finding-F false-done; live incident eb610df4 left
      // T1 uncommitted after parking T2-T6). Do NOT silently `add -A` + push — surface for the
      // operator unless they explicitly confirmed this is a rework (false-done guard, Design A).
      if (!opts.confirmRework) {
        return {
          prUrl: '',
          branch,
          pushed: false,
          autoMerge: false,
          committed: false,
          dirtyTreeLeftBehind: false,
          needsConfirm: true,
          parkSignals: scanParkSignals(task),
        };
      }
      await deps.commitAll(branch, `chore(harvest): commit reworked aif task ${task.id} — ${task.title}`);
      committed = true;
    } else {
      // ≥1 ahead + dirty. Untracked-only dirt is the routine container residue → warn and
      // proceed (historic behavior). MODIFIED tracked files on top of commits are the D12
      // shape (uncommitted rework passed to `done` — 2×2026-07-25): pushing the commits
      // alone silently drops that work, and a stderr warning is attention, not a mechanism
      // (attention-is-not-a-mechanism.md §1 corollary) — so HOLD unless explicitly confirmed.
      const tracked = await deps.trackedDirtyFiles(branch);
      if (tracked.length > 0 && !opts.confirmDirtyResidue) {
        return {
          prUrl: '',
          branch,
          pushed: false,
          autoMerge: false,
          committed: false,
          dirtyTreeLeftBehind: false,
          needsResidueConfirm: true,
          trackedDirtyFiles: tracked,
        };
      }
      dirtyTreeLeftBehind = true;
    }
  }

  // Affected-files divergence guard (2026-07-17 aif review-gate gap — research-patch
  // docs/meta-factory/research-patches/2026-07-17-aif-review-gate-affected-files-gap.md §7).
  // aif's review/security gates self-report which files they scoped their review to. When
  // the agent touches a file it does NOT self-report (the incident's exact signature — a
  // destructive Edit on an unreported file), that gate never reviewed it, yet the task can
  // still close `done`. Cross-check the self-report against the mechanical file-list and
  // HOLD on any unreported-but-touched file. A null self-report (no structured block found)
  // means "nothing to cross-check" — skip the guard entirely rather than guess a format.
  let unreportedFiles: string[] = [];
  let unmatchedSelfReport: string[] = [];
  const selfReport = extractAffectedFiles(task.reviewComments);
  if (selfReport !== null) {
    const mechanical = await deps.changedFilesVsBase(branch, opts.baseBranch);
    // Normalise both sides before the set-difference: aif's self-report and git's
    // --name-only output can differ cosmetically for the SAME path (a leading `./`, a
    // trailing `/`), which would otherwise read as a false divergence and a noisy HOLD.
    const norm = (p: string): string => p.trim().replace(/^\.\//, '').replace(/\/+$/, '');
    const selfReportNorm = selfReport.map(norm);
    const mechanicalNorm = mechanical.map(norm);
    const selfReportSet = new Set(selfReportNorm);
    const mechanicalSet = new Set(mechanicalNorm);
    unreportedFiles = mechanicalNorm.filter((f) => !selfReportSet.has(f));
    unmatchedSelfReport = selfReportNorm.filter((f) => !mechanicalSet.has(f));
    if (unreportedFiles.length > 0 && !opts.confirmUnreportedFiles) {
      return {
        prUrl: '',
        branch,
        pushed: false,
        autoMerge: false,
        committed,
        dirtyTreeLeftBehind,
        needsFileConfirm: true,
        unreportedFiles,
        ...(unmatchedSelfReport.length > 0 ? { unmatchedSelfReport } : {}),
      };
    }
  }

  await deps.pushBranch(branch);
  const prUrl = await deps.createPr({ branch, base: opts.baseBranch, title: task.title, body: opts.body });

  let autoMerge = false;
  if (opts.autoMerge) {
    await deps.enableAutoMerge(prUrl);
    autoMerge = true;
  }

  return {
    prUrl,
    branch,
    pushed: true,
    autoMerge,
    committed,
    dirtyTreeLeftBehind,
    ...(unmatchedSelfReport.length > 0 ? { unmatchedSelfReport } : {}),
  };
}
