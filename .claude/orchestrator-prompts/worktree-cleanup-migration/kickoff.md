# Worktree cleanup + stranded-kickoff migration (self-contained)

> **Launch:** `/orchestrator /Users/art/code/rules-as-tests-aif/.claude/orchestrator-prompts/worktree-cleanup-migration/kickoff.md`
> This kickoff is **self-contained** — assume zero prior conversation. Read it fully before acting.

## Background (what just shipped)
PR **#346** (merged to `staging`, commit `d7bd3a0`, 2026-06-01) added **`scripts/link-coordination.sh`** — cross-worktree symlink-to-canonical coordination sync (SSOT #110). It replaced the old J5 rsync block in `.claude/hooks/worktree-setup.sh` + `scripts/create-worktree.sh`. Mechanism: gitignored `orchestrator-prompts/<umbrella>/` files (kickoff.md, state.md, drafts/…) become **per-file symlinks** into a canonical store; tracked `README.md` + `*/done.md` stay real per-worktree. The helper **auto-seeds `$CANON` from a primary checkout when `$CANON` is empty** and is **conflict-safe** (never clobbers; exits 1 on a real-file-vs-canonical conflict).

- Canonical store: `${CLAUDE_COORDINATION_DIR:-$HOME/.claude-coordination/rules-as-tests-aif}` (call it `$CANON`).
- Primary checkout (freshest umbrella source, 124 umbrellas): `/Users/art/code/rules-as-tests-aif`.
- New worktrees auto-link going forward. **Existing worktrees + their stranded kickoffs were deliberately NOT migrated yet — that is this session's job.**

## Goal
Two outcomes, in this order (ordering is load-bearing — **preserve before delete**, T17):
1. **Nothing lost:** every gitignored kickoff/state/scratch file that exists in *any* worktree but not in `$CANON`/primary is preserved into `$CANON` first.
2. **Tidy:** prune branches + worktrees whose work is already merged into `origin/staging`; surface (do NOT delete) anything unmerged or locked.

Current scale (verify yourself, may have drifted): ~45 worktrees, ~72 branches merged into staging, ~87 not merged.

## HARD CONSTRAINTS (read twice)
- **Preserve-before-destroy (T17).** Before removing ANY worktree, run `link-coordination.sh` in it (adopt-then-link) OR manually copy its unique gitignored `orchestrator-prompts` content into `$CANON` with `--ignore-existing`. Verify the content is in `$CANON` (`ls`/diff) BEFORE `git worktree remove`. A worktree-born kickoff that only exists there is future-value content — losing it is the exact failure this whole umbrella was built to prevent.
- **Never delete unmerged work.** Only remove a worktree/branch when its branch is an ancestor of `origin/staging` (`git branch --merged origin/staging`, or `git merge-base --is-ancestor <branch> origin/staging`). Anything `--no-merged` → **surface in the report, do NOT delete.** Some may be live in-flight work.
- **Skip locked/active worktrees.** `git worktree list --porcelain` marks active ones `locked`. Do NOT touch a locked worktree's files or remove it (another session may be running there). List them as "skipped — locked" in the report.
- **No `git reset --hard`** — the `git-safety` hook blocks it (use `git switch`/`git restore`/`git branch -f` alternatives). **Compound `gh pr merge` chained with `&&` is blocked** — run gh commands singly.
- **Don't disrupt the two reference checkouts:** the primary `/Users/art/code/rules-as-tests-aif` and any Superset worktree under `/Users/art/.superset/worktrees/…` you're running in. Never remove the worktree you're operating from.
- This is **internal host tooling** — no PR needed for the cleanup itself. If you improve `link-coordination.sh`, that's a separate PR to staging.

## Procedure
**Phase 0 — sync + canonical bootstrap.**
1. `cd /Users/art/code/rules-as-tests-aif && git fetch origin && git switch staging` then fast-forward to `origin/staging` (via `git merge --ff-only origin/staging`, NOT reset). Confirm `scripts/link-coordination.sh` exists.
2. Seed `$CANON` from primary: `bash scripts/link-coordination.sh /Users/art/code/rules-as-tests-aif /Users/art/code/rules-as-tests-aif` (auto-seeds on empty, links primary). Verify `$CANON` now holds the umbrellas (`ls "$HOME/.claude-coordination/rules-as-tests-aif" | wc -l`).

**Phase 1 — enumerate + classify (read-only first).**
3. Build the worktree table: for each `git worktree list --porcelain` entry record {path, branch, locked?, merged-into-staging?}. Skip the primary + your own worktree.
4. For each NON-locked worktree, diff its `orchestrator-prompts` gitignored content against `$CANON` — flag any umbrella/file present there but absent in `$CANON` ("stranded").

**Phase 2 — preserve (per non-locked worktree).**
5. Run `bash scripts/link-coordination.sh <worktree-path> /Users/art/code/rules-as-tests-aif` — adopts stranded files into `$CANON` + symlinks. If it exits 1 (CONFLICT: a real file differs from canonical), **do not force** — record the conflict path in the report for human resolution; leave that worktree's files intact.
6. Verify adopted content is in `$CANON` before considering the worktree safe to remove.

**Phase 3 — prune (only merged + non-locked + preserved).**
7. `git worktree remove <path>` for worktrees whose branch is merged into `origin/staging` AND whose content is confirmed in `$CANON` AND not locked. Use `--force` only if the sole diff is the expected symlink conversion (no unmerged commits, no uncommitted tracked changes).
8. Delete the corresponding merged local branches: `git branch -d <branch>` (use `-d`, NOT `-D` — `-d` refuses unmerged, a built-in safety net). Optionally prune merged remote branches only if you confirm they're merged + you have authority.
9. `git worktree prune` to clear stale admin entries.

**Phase 3.5 — closure marker (fold in, since you're committing anyway).**
8a. Write `.claude/orchestrator-prompts/cross-worktree-symlink-iphase/done.md` (tracked file) per CLAUDE.md «Umbrella closure convention»:
```text
# cross-worktree-symlink-iphase — DONE
- Final PR: #346
- Closed: 2026-06-01
- Summary: symlink-to-canonical cross-worktree coordination sync (SSOT #110) shipped.
```
Also write this kickoff's own `worktree-cleanup-migration/done.md` at the end. Both done.md files are tracked → they ride out on a small PR to staging (a direct push to protected `staging` is rejected; bundle them with any other tracked change you make, or open a one-line chore PR). priority-score.sh Layer C3 reads done.md, so this is load-bearing, not cosmetic.

**Phase 4 — report.**
10. Plain-language summary: worktrees removed (N), branches deleted (N), stranded kickoffs preserved into `$CANON` (list umbrellas), CONFLICTS left for human (list), and SURFACED items — unmerged worktrees/branches kept + locked worktrees skipped (with why). End with the `$CANON` umbrella count so the maintainer can sanity-check nothing shrank.

## Anti-patterns (don't)
- ❌ `git worktree remove --force` on a worktree before its unique kickoffs are in `$CANON`.
- ❌ `git branch -D` (force) on unmerged branches "to clean up".
- ❌ Touching a `locked` worktree.
- ❌ Treating `--no-merged` branches as garbage — they may be live work; surface them.
- ❌ Re-researching the symlink design — it's settled (SSOT #110, research-patch 2026-05-17 §5); this is cleanup only.

## VERIFY (attach evidence in report)
1. `$CANON` umbrella count ≥ primary's (124) and ≥ any pre-cleanup count (nothing shrank).
2. For each removed worktree: a line proving its content was in `$CANON` before removal.
3. `git worktree list` after — only intended worktrees remain; no locked ones removed.
4. List of branches deleted (all `git branch -d` succeeded = all were merged).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
