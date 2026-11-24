# dispatcher — harvest

> **Authoritative for:** the selected dispatcher procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

## §4 Harvest details and ATTN conditions

**Rework-commit gap:** a dirty container tree at harvest time is auto-committed ONLY when the branch is **0 commits ahead** of base — the true-rework signature (`request_changes→implementing→done` with nothing committed, branch == base HEAD). Even that leg first HOLDs as ambiguous (`needsConfirm`, false-done guard); re-running with `--confirm-rework` produces the templated `git add -A` commit (ZERO LLM, `committed: true` in the harvest JSON). When the branch is **≥1 commit ahead**, harvest treats the dirty tree as stale base-state residue and never `add -A`s it: modified tracked files HOLD (`needsResidueConfirm`; `--confirm-dirty-residue` to proceed), while untracked-only residue is warned and left behind (`dirtyTreeLeftBehind: true`) — uncommitted work on such a branch is NOT shipped. **Operator rule: before harvesting a branch that already carries commits, commit any in-container work you want shipped.** (Decision logic: `packages/runtime-bridge/src/harvest.ts` `harvestTask` dirty-tree branch; near-loss incident 2026-08-08, getff-freshness-widening S1.)

**ATTN: container on wrong branch.** `harvest.ts` throws (does NOT self-heal) when the aif container's git state is on a different branch than the task's `branchName`. When this occurs, `/dispatcher` surfaces `ATTN: harvest threw — container may be on wrong branch. Manual check required: docker exec aif-handoff-agent-1 git branch` and does NOT silently retry. The operator must resolve the container state before re-running harvest.

**Harvest idempotency:** `gh pr create` fails if the PR already exists; re-run with `--no-auto-merge` to skip the merge step and recover gracefully.

**ATTN: environment-level failure (not a loop bug).** When dispatch/monitor/harvest misbehaves for a reason outside this loop's logic — task crash-loops in `planning` with `tokenTotal:0` (broken claude runtime), new task stuck `backlog` (capacity cap saturated), in-container `npm`/network failures (proxy block) — that is an aif _environment_ fault. **Hand off to [`/aif-doctor`](../../aif-doctor/SKILL.md)** for read-only triage + the mapped fix (Tier-1 reversible fixes auto-apply with evidence/undo; Tier-2 mutations require operator GO or existing exact authorization). `/dispatcher` owns the loop; `/aif-doctor` owns the environment the loop runs in.

---
