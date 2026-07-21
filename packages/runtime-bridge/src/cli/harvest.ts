/**
 * CLI harvest entrypoint — the deterministic egress leg of the bridge.
 *
 * Usage:
 *   tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> \
 *     [--base <branch>] [--body-file <path>] [--no-auto-merge] [--container <name>] \
 *     [--confirm-rework] [--confirm-unreported-files]
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
import { harvestTask } from '../harvest.js';
import type { HarvestDeps } from '../harvest.js';

const AIF_REPO_PATH = '/home/www/rules-as-tests-aif';

interface ParsedArgs {
  taskId?: string;
  base: string;
  bodyFile?: string;
  autoMerge: boolean;
  container: string;
  confirmRework: boolean;
  confirmUnreportedFiles: boolean;
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
    confirmRework: argv.includes('--confirm-rework'),
    confirmUnreportedFiles: argv.includes('--confirm-unreported-files'),
  };
}

/** Run a git command inside the aif container's checkout; returns trimmed stdout. */
function dockerGit(container: string, args: string[]): string {
  return execFileSync('docker', ['exec', container, 'git', '-C', AIF_REPO_PATH, ...args], {
    encoding: 'utf8',
  }).trim();
}

/**
 * First resolvable base ref inside the container. The container is a full clone
 * with `origin`, so prefer the durable remote ref `origin/<base>`; fall back to a
 * local `<base>` ref. Throws (→ graceful degradation prints the fallback) if the
 * base cannot be resolved — only ever reached on a DIRTY tree, never the clean path.
 */
function resolveBaseRef(container: string, base: string): string {
  for (const ref of [`origin/${base}`, base]) {
    try {
      dockerGit(container, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
      return ref;
    } catch {
      // ref not present in the container — try the next candidate
    }
  }
  throw new Error(`harvest: base ref '${base}' not found in container (tried origin/${base}, ${base})`);
}

/** Wire the real git/gh/docker side-effects. Each throws on non-zero exit. */
function realDeps(container: string): HarvestDeps {
  return {
    hasUncommittedChanges: async (_branch) => {
      // The container's checkout is the one aif left dirty on the rework path.
      // `git status --porcelain` is empty iff the tree is clean.
      return dockerGit(container, ['status', '--porcelain']).length > 0;
    },
    commitsAhead: async (_branch, base) => {
      // How many commits HEAD carries ahead of base (git rev-list --count base..HEAD).
      // 0 ⇒ true-rework leg (branch == base HEAD) → harvest commits the dirty tree;
      // ≥1 ⇒ aif already committed the deliverable → harvest must NOT add -A the dirty
      // tree (stale base-state residue). Only called when the tree is dirty.
      const baseRef = resolveBaseRef(container, base);
      const n = dockerGit(container, ['rev-list', '--count', `${baseRef}..HEAD`]);
      return Number.parseInt(n, 10) || 0;
    },
    commitAll: async (branch, message) => {
      // Safety: only commit when the checkout is actually on the task's branch —
      // never bake stray changes into the wrong branch. Throw (→ graceful
      // degradation prints the manual fallback) on a mismatch.
      const head = dockerGit(container, ['rev-parse', '--abbrev-ref', 'HEAD']);
      if (head !== branch) {
        throw new Error(`harvest: container checkout is on '${head}', not the task branch '${branch}' — refusing to commit`);
      }
      dockerGit(container, ['add', '-A']);
      dockerGit(container, ['commit', '-m', message]);
    },
    pushBranch: async (branch) => {
      // Push from INSIDE the container (it holds the commit + working push creds).
      execFileSync('docker', ['exec', container, 'git', '-C', AIF_REPO_PATH, 'push', 'origin', branch], {
        stdio: 'pipe',
      });
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
    changedFilesVsBase: async (_branch, base) => {
      // What the task actually touched, in BOTH states aif can leave the container in:
      //   (a) `<base>...HEAD` (THREE-dot) — the branch's committed delta from its merge-base
      //       with <base>. Drift-immune: it EXCLUDES files that changed only on <base> since
      //       the fork-point. This matters because aif's containers are long-lived (measured:
      //       `aif-handoff-agent-1` up 2 days, its `origin/staging` ~a month ahead of a
      //       June-forked branch), so the two-arg `git diff <base>` form reports the entire
      //       base-side drift — 1046 files where the branch changed 1 — which would HOLD on
      //       every task. Verified on the live container 2026-07-21.
      //   (b) `HEAD` — uncommitted working-tree changes (the dirty / rework leg).
      // Their union is exactly the task's file-set. Both are read via docker exec (the aif
      // agent has no git for push/merge — harvest drives git from the host side).
      const baseRef = resolveBaseRef(container, base);
      const committed = dockerGit(container, ['diff', '--name-only', `${baseRef}...HEAD`]);
      const uncommitted = dockerGit(container, ['diff', '--name-only', 'HEAD']);
      const files = new Set<string>();
      for (const out of [committed, uncommitted]) {
        for (const f of out.split('\n')) if (f.length > 0) files.add(f);
      }
      return [...files];
    },
  };
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

  try {
    const res = await harvestTask(
      task,
      {
        baseBranch: args.base,
        body,
        autoMerge: args.autoMerge,
        confirmRework: args.confirmRework,
        confirmUnreportedFiles: args.confirmUnreportedFiles,
      },
      realDeps(args.container),
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
          `[harvest]   inspect:  docker exec ${args.container} git -C ${AIF_REPO_PATH} diff -- ${(res.unreportedFiles ?? []).join(' ')}\n` +
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
          `[harvest]   inspect:  docker exec ${args.container} git -C ${AIF_REPO_PATH} diff\n` +
          `[harvest]   ship only if it IS a complete rework:  tsx packages/runtime-bridge/src/cli/harvest.ts ${args.taskId} --confirm-rework\n`,
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
          `  docker exec ${args.container} git -C ${AIF_REPO_PATH} push origin ${task.branchName}\n` +
          `  gh pr create --base ${args.base} --head ${task.branchName} --title "${task.title}" --body "..."\n` +
          (args.autoMerge ? `  gh pr merge <pr-url> --auto --squash\n` : ''),
      );
    }
    process.exit(1);
  }
}

void main();
