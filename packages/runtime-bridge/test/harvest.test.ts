// packages/runtime-bridge/test/harvest.test.ts
import { describe, it, expect, vi } from 'vitest';
import { harvestTask, scanParkSignals, extractAffectedFiles } from '../src/harvest.js';
import type { HarvestDeps } from '../src/harvest.js';

/** A deps double that records call order; each fn resolves successfully by default.
 *  Default `hasUncommittedChanges` → false (the normal approve_done path, where
 *  aif already committed) so existing positive tests stay no-op on the rework leg. */
function makeDeps(over: Partial<HarvestDeps> = {}): { deps: HarvestDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: HarvestDeps = {
    hasUncommittedChanges: vi.fn(async (b: string) => {
      calls.push(`dirty?:${b}`);
      return false;
    }),
    // Default: no tracked-file modifications (untracked-only dirt) — the routine container
    // residue. Only consulted on the dirty + ≥1-ahead leg; tests exercising the D12 guard
    // override this to a non-empty list.
    trackedDirtyFiles: vi.fn(async (b: string) => {
      calls.push(`trackedDirty?:${b}`);
      return [];
    }),
    // Default: 0 commits ahead → the true-rework leg (branch == base HEAD). Only
    // consulted when the tree is dirty; tests that exercise the stale-residue leg
    // override this to ≥1.
    commitsAhead: vi.fn(async (_b: string, base: string) => {
      calls.push(`aheadOf:${base}`);
      return 0;
    }),
    commitAll: vi.fn(async (b: string, msg: string) => {
      calls.push(`commit:${b}:${msg}`);
    }),
    pushBranch: vi.fn(async (b: string) => {
      calls.push(`push:${b}`);
    }),
    createPr: vi.fn(async (o) => {
      calls.push(`pr:${o.branch}->${o.base}`);
      return 'https://github.com/x/y/pull/42';
    }),
    enableAutoMerge: vi.fn(async (url: string) => {
      calls.push(`automerge:${url}`);
    }),
    // Mechanical file-list (git diff --name-only <base>). Only consulted when the task
    // carries a structured self-reported affected_files list; default → [] so tasks
    // without reviewComments never trigger the divergence guard (existing behavior).
    changedFilesVsBase: vi.fn(async (b: string, base: string) => {
      calls.push(`changed?:${b}:${base}`);
      return [];
    }),
    ...over,
  };
  return { deps, calls };
}

const DONE_TASK = { id: 't1', title: 'feat: thing', status: 'done', branchName: 'feature/thing-abc' };

describe('harvestTask — positive', () => {
  it('pushes branch, opens PR vs base, enables auto-merge, returns PR url (in order)', async () => {
    const { deps, calls } = makeDeps();
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res).toEqual({ prUrl: 'https://github.com/x/y/pull/42', branch: 'feature/thing-abc', pushed: true, autoMerge: true, committed: false, dirtyTreeLeftBehind: false });
    // dirty-check BEFORE push BEFORE pr BEFORE automerge — ordering is load-bearing
    // (can't PR an unpushed branch; clean tree → no ahead-check, no commit).
    expect(calls).toEqual(['dirty?:feature/thing-abc', 'push:feature/thing-abc', 'pr:feature/thing-abc->staging', 'automerge:https://github.com/x/y/pull/42']);
  });

  it('verified status is also harvestable (terminal)', async () => {
    const { deps } = makeDeps();
    const res = await harvestTask({ ...DONE_TASK, status: 'verified' }, { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.pushed).toBe(true);
  });

  it('autoMerge:false skips enableAutoMerge', async () => {
    const { deps } = makeDeps();
    await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(deps.enableAutoMerge).not.toHaveBeenCalled();
  });
});

describe('harvestTask — rework-commit gap (dirty tree disambiguated by commits-ahead)', () => {
  // aif commits only on approve_done && commitOnApprove. A dirty tree is ambiguous:
  //   • 0 commits ahead of base → TRUE REWORK (request_changes→implementing→done left
  //     the work uncommitted, branch == base HEAD). Harvest commits it (ZERO LLM).
  //   • ≥1 commit ahead of base → STALE RESIDUE (aif already committed the deliverable;
  //     the dirty tree is out-of-scope base-state churn). Harvest must NOT `add -A` it.
  it('dirty tree + 0 commits ahead (true rework) + confirmRework → commits (templated, no LLM) BEFORE push; committed:true', async () => {
    const { deps, calls } = makeDeps({
      hasUncommittedChanges: vi.fn(async (b: string) => {
        calls.push(`dirty?:${b}`);
        return true; // rework left the tree dirty
      }),
      // default commitsAhead → 0 (branch == base HEAD)
    });
    // Design A (2026-06-23): the 0-ahead auto-commit path is now OPT-IN behind
    // confirmRework — without it the ambiguous shape is surfaced (needsConfirm), not
    // silently committed. This test exercises the confirmed (legit-rework) path.
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true, confirmRework: true }, deps);
    expect(res.committed).toBe(true);
    expect(res.dirtyTreeLeftBehind).toBe(false);
    // ahead-check disambiguates AFTER the dirty-check; commit lands BEFORE the push.
    expect(calls).toEqual([
      'dirty?:feature/thing-abc',
      'aheadOf:staging',
      'commit:feature/thing-abc:chore(harvest): commit reworked aif task t1 — feat: thing',
      'push:feature/thing-abc',
      'pr:feature/thing-abc->staging',
      'automerge:https://github.com/x/y/pull/42',
    ]);
  });

  it('dirty tree (untracked-only) + ≥1 commit ahead (stale residue) → does NOT commit; pushes the existing commit only; dirtyTreeLeftBehind:true', async () => {
    // The 2026-06-11 incident (aif task d037c54d, F2): aif committed the real work,
    // then left ~7 stale base-state files dirty. Old code `git add -A`'d them into the
    // PR. Now the branch's commits ARE the deliverable → push them; leave the tree.
    // Default trackedDirtyFiles → [] models untracked-only dirt (`?? .claude/worktrees/`).
    const { deps, calls } = makeDeps({
      hasUncommittedChanges: vi.fn(async (b: string) => {
        calls.push(`dirty?:${b}`);
        return true; // tree is dirty...
      }),
      commitsAhead: vi.fn(async (_b: string, base: string) => {
        calls.push(`aheadOf:${base}`);
        return 2; // ...but the branch already carries the real commits
      }),
    });
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res.committed).toBe(false);
    expect(res.dirtyTreeLeftBehind).toBe(true);
    expect(res.pushed).toBe(true);
    expect(deps.commitAll).not.toHaveBeenCalled(); // the stale files are NOT add -A'd in
    // existing commit still pushed + PR'd; the dirty tree is skipped, not swept.
    expect(calls).toEqual([
      'dirty?:feature/thing-abc',
      'aheadOf:staging',
      'trackedDirty?:feature/thing-abc',
      'push:feature/thing-abc',
      'pr:feature/thing-abc->staging',
      'automerge:https://github.com/x/y/pull/42',
    ]);
  });

  it('D12 guard: TRACKED files modified + ≥1 commit ahead → HOLDs (needsResidueConfirm), nothing pushed', async () => {
    // The 2026-07-25 incident class (tasks 06394a7f round-1 rework, dbe542d8 initial run):
    // aif's review gate passed the task to `done` while the (part of the) deliverable sat
    // modified-but-uncommitted on top of existing commits. Pushing the commits alone would
    // silently drop that work — HOLD instead of the old warn-and-proceed.
    const { deps } = makeDeps({
      hasUncommittedChanges: vi.fn(async () => true),
      commitsAhead: vi.fn(async () => 2),
      trackedDirtyFiles: vi.fn(async () => ['.claude/rules/zcode-parity-doctrine.md']),
    });
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res.needsResidueConfirm).toBe(true);
    expect(res.trackedDirtyFiles).toEqual(['.claude/rules/zcode-parity-doctrine.md']);
    expect(res.pushed).toBe(false);
    expect(deps.commitAll).not.toHaveBeenCalled();
    expect(deps.pushBranch).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it('D12 guard escape: confirmDirtyResidue ships the commits and leaves the tracked modifications behind', async () => {
    // Paired-negative for the guard: the explicit escape restores the old behavior —
    // push existing commits, dirtyTreeLeftBehind:true, tracked modifications abandoned.
    const { deps } = makeDeps({
      hasUncommittedChanges: vi.fn(async () => true),
      commitsAhead: vi.fn(async () => 2),
      trackedDirtyFiles: vi.fn(async () => ['.claude/rules/zcode-parity-doctrine.md']),
    });
    const res = await harvestTask(
      DONE_TASK,
      { baseBranch: 'staging', body: 'B', autoMerge: true, confirmDirtyResidue: true },
      deps,
    );
    expect(res.needsResidueConfirm).toBeUndefined();
    expect(res.dirtyTreeLeftBehind).toBe(true);
    expect(res.pushed).toBe(true);
    expect(deps.commitAll).not.toHaveBeenCalled(); // still never add -A'd
  });

  it('clean tree → no ahead-check, no commit (commitsAhead + commitAll never called)', async () => {
    const { deps } = makeDeps(); // default hasUncommittedChanges → false
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.committed).toBe(false);
    expect(res.dirtyTreeLeftBehind).toBe(false);
    expect(deps.commitsAhead).not.toHaveBeenCalled();
    expect(deps.commitAll).not.toHaveBeenCalled();
  });

  it('commit failure on true rework → does NOT push or PR (fail-fast, operator gets the fallback)', async () => {
    const { deps } = makeDeps({
      hasUncommittedChanges: vi.fn(async () => true),
      commitsAhead: vi.fn(async () => 0), // true rework → commit is attempted
      commitAll: vi.fn(async () => {
        throw new Error('git commit failed: nothing staged');
      }),
    });
    await expect(
      harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true, confirmRework: true }, deps),
    ).rejects.toThrow(/git commit failed/);
    expect(deps.pushBranch).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
  });
});

describe('harvestTask — paired-negative (must NOT push/PR on bad input)', () => {
  it('throws on non-terminal status and does NOT push (nothing to harvest yet)', async () => {
    const { deps } = makeDeps();
    await expect(
      harvestTask({ ...DONE_TASK, status: 'implementing' }, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps),
    ).rejects.toThrow(/not terminal/i);
    expect(deps.pushBranch).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it('throws on missing branchName AFTER status ok, and does NOT open a PR', async () => {
    const { deps } = makeDeps();
    await expect(
      harvestTask({ ...DONE_TASK, branchName: undefined }, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps),
    ).rejects.toThrow(/no branchName/i);
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it('does NOT enable auto-merge if PR creation throws (no half-merged state)', async () => {
    const { deps } = makeDeps({
      createPr: vi.fn(async () => {
        throw new Error('gh pr create failed');
      }),
    });
    await expect(harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps)).rejects.toThrow(
      /gh pr create failed/,
    );
    expect(deps.enableAutoMerge).not.toHaveBeenCalled();
  });
});

describe('harvestTask — false-done / internal-park guard (Design A, 2026-06-23)', () => {
  // The ambiguous shape: done + 0-commits-ahead + dirty tree. Mechanically identical to a
  // legit rework leg, but can equally be aif PARKED/PARTIAL work (live incident eb610df4:
  // the agent parked T2-T6, left T1 uncommitted, status still went to `done`). The
  // auto-commit path (#370/#457) is now OPT-IN behind confirmRework; the default surfaces.
  it('0 commits ahead + dirty + NO confirmRework → needsConfirm; does NOT commit/push/PR', async () => {
    const { deps } = makeDeps({ hasUncommittedChanges: vi.fn(async () => true) }); // default commitsAhead → 0
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res.needsConfirm).toBe(true);
    expect(res.pushed).toBe(false);
    expect(deps.commitAll).not.toHaveBeenCalled();
    expect(deps.pushBranch).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
    expect(deps.enableAutoMerge).not.toHaveBeenCalled();
  });

  it('0 commits ahead + dirty + confirmRework:true → commits + pushes (the #370/#457 path, now opt-in)', async () => {
    const { deps } = makeDeps({ hasUncommittedChanges: vi.fn(async () => true) });
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: true, confirmRework: true }, deps);
    expect(res.committed).toBe(true);
    expect(res.needsConfirm).toBeFalsy();
    expect(deps.commitAll).toHaveBeenCalledOnce();
    expect(deps.pushBranch).toHaveBeenCalledOnce();
  });

  it('needsConfirm surface carries park signals from the task log (informational, not load-bearing)', async () => {
    const { deps } = makeDeps({ hasUncommittedChanges: vi.fn(async () => true) });
    const parked = { ...DONE_TASK, implementationLog: 'Implemented T1. Parking T2-T6 on the documented schema fork.' };
    const res = await harvestTask(parked, { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res.needsConfirm).toBe(true);
    expect(res.parkSignals?.length).toBeGreaterThan(0);
  });

  it('clean tree is unaffected by the guard (no needsConfirm; pushes as today)', async () => {
    const { deps } = makeDeps(); // clean
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.needsConfirm).toBeFalsy();
    expect(res.pushed).toBe(true);
  });
});

// A reviewComments value in aif's live shape: markdown prose (## sections) with an
// embedded gate-result JSON block that carries the self-reported affected_files list.
const rcWithAffected = (files: string[]): string =>
  `## Code Review\n\n## Blocking Findings\n- none\n\n## Security Audit\n` +
  `{ "schema_version": 1, "gate": "security", "status": "pass", "blocking": false, ` +
  `"blockers": [], "affected_files": ${JSON.stringify(files)} }\n`;

describe('extractAffectedFiles — pure self-report extractor', () => {
  it('positive: pulls affected_files out of an embedded gate-result JSON block', () => {
    expect(extractAffectedFiles(rcWithAffected(['a.ts', 'b.ts']))).toEqual(['a.ts', 'b.ts']);
  });

  it('positive: unions affected_files across multiple gate blocks (security + review)', () => {
    const rc = rcWithAffected(['a.ts', 'b.ts']) + `\n## Review\n{ "gate": "review", "affected_files": ["b.ts", "c.ts"] }\n`;
    expect(extractAffectedFiles(rc)?.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('null: plain markdown with no affected_files block → not extractable (warn-only, not HOLD)', () => {
    expect(extractAffectedFiles('## Auto Review Metadata\n- strategy: single\n')).toBeNull();
  });

  it('null: empty/absent input → null', () => {
    expect(extractAffectedFiles('')).toBeNull();
    expect(extractAffectedFiles(null)).toBeNull();
    expect(extractAffectedFiles(undefined)).toBeNull();
  });

  it('empty-array block → [] (explicit empty self-report, distinct from null)', () => {
    expect(extractAffectedFiles(rcWithAffected([]))).toEqual([]);
  });

  it('malformed block → null (graceful, no throw)', () => {
    expect(extractAffectedFiles('noise "affected_files": [unquoted, junk more noise')).toBeNull();
  });
});

describe('harvestTask — affected-files divergence guard (aif review-gate self-report gap, 2026-07-17)', () => {
  // The 2026-07-17 DH-S1 incident (research-patch §2/§7): aif's review-gate scoped itself
  // to a SELF-REPORTED affected_files list; the agent's Edit destructively touched a 4th
  // file it did not self-report, so the gate never reviewed it and closed `done`. Harvest
  // cross-checks the self-report against the mechanical git-diff file-list and HOLDs on any
  // touched-but-unreported file unless the operator confirms.
  const taskRC = (files: string[]) => ({ ...DONE_TASK, reviewComments: rcWithAffected(files) });

  it('touched-but-unreported (mechanical ∖ self-report ≠ ∅) + no confirm → needsFileConfirm; does NOT push', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'b.ts', 'prior-art.md']), // C = the unreported destructive edit
    });
    const res = await harvestTask(taskRC(['a.ts', 'b.ts']), { baseBranch: 'staging', body: 'B', autoMerge: true }, deps);
    expect(res.needsFileConfirm).toBe(true);
    expect(res.unreportedFiles).toEqual(['prior-art.md']);
    expect(res.pushed).toBe(false);
    expect(deps.pushBranch).not.toHaveBeenCalled();
    expect(deps.createPr).not.toHaveBeenCalled();
  });

  it('touched-but-unreported + confirmUnreportedFiles → pushes (override works)', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'b.ts', 'prior-art.md']),
    });
    const res = await harvestTask(
      taskRC(['a.ts', 'b.ts']),
      { baseBranch: 'staging', body: 'B', autoMerge: true, confirmUnreportedFiles: true },
      deps,
    );
    expect(res.needsFileConfirm).toBeFalsy();
    expect(res.pushed).toBe(true);
    expect(deps.pushBranch).toHaveBeenCalledOnce();
  });

  it('paired-positive: mechanical ⊆ self-report → no HOLD, pushes normally', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'b.ts']), // subset of self-report
    });
    const res = await harvestTask(taskRC(['a.ts', 'b.ts', 'c.ts']), { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.needsFileConfirm).toBeFalsy();
    expect(res.pushed).toBe(true);
  });

  it('no structured self-report (null) → guard skipped, changedFilesVsBase NOT called, pushes (existing behavior)', async () => {
    const { deps } = makeDeps();
    const res = await harvestTask(DONE_TASK, { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.pushed).toBe(true);
    expect(deps.changedFilesVsBase).not.toHaveBeenCalled();
  });

  it('claimed-but-untouched (self-report ∖ mechanical) → milder: no HOLD, pushes, surfaces unmatchedSelfReport', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'b.ts']), // 'x.ts' claimed but not touched
    });
    const res = await harvestTask(taskRC(['a.ts', 'b.ts', 'x.ts']), { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.needsFileConfirm).toBeFalsy();
    expect(res.pushed).toBe(true);
    expect(res.unmatchedSelfReport).toEqual(['x.ts']);
  });

  it('path normalization: leading ./ and trailing / in self-report do NOT cause a false divergence', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'dir/b.ts']), // clean repo-relative
    });
    // aif self-reported the same files but with ./ prefix + trailing-slash noise
    const res = await harvestTask(taskRC(['./a.ts', 'dir/b.ts/']), { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.needsFileConfirm).toBeFalsy();
    expect(res.pushed).toBe(true);
  });

  it('HOLD result still surfaces unmatchedSelfReport (full diagnostic, both directions)', async () => {
    const { deps } = makeDeps({
      changedFilesVsBase: vi.fn(async () => ['a.ts', 'unreported.ts']),
    });
    // self claims x.ts (untouched) AND omits unreported.ts (touched) — HOLD on the omission,
    // but the claimed-untouched direction must still be reported for the operator.
    const res = await harvestTask(taskRC(['a.ts', 'x.ts']), { baseBranch: 'staging', body: 'B', autoMerge: false }, deps);
    expect(res.needsFileConfirm).toBe(true);
    expect(res.unreportedFiles).toEqual(['unreported.ts']);
    expect(res.unmatchedSelfReport).toEqual(['x.ts']);
  });
});

describe('scanParkSignals — pure park-marker detector (informational only)', () => {
  it('positive: implementationLog narrating a park → returns ≥1 marker', () => {
    expect(scanParkSignals({ implementationLog: 'T1 done. Parking T2-T6 (park-candidate 3).' }).length).toBeGreaterThan(0);
  });

  it('positive: an OPEN QUESTION anchor in the plan → returns ≥1 marker', () => {
    expect(scanParkSignals({ plan: 'tasks...\n\n## ⏸ OPEN QUESTION (awaiting operator)\n\nA vs B?' }).length).toBeGreaterThan(0);
  });

  it('positive: a manualReviewRequired / blocked_external mention → returns ≥1 marker', () => {
    expect(scanParkSignals({ reviewComments: 'set manualReviewRequired; blocked_external pending answer' }).length).toBeGreaterThan(0);
  });

  it('paired-negative: a clean log with no park language → empty array', () => {
    expect(scanParkSignals({ implementationLog: 'Implemented all tasks; full suite passes; ready to ship.' })).toEqual([]);
  });

  it('paired-negative: all-empty input → empty array', () => {
    expect(scanParkSignals({})).toEqual([]);
  });
});
