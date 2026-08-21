# Kickoff — reconcile branch `chore/ssot-karpathy-skills-ref` vs `main`

> Открой новую Claude Code сессию на **Opus**. Это **audit + safe-landing** задача, НЕ broad research. Deliverable: per-commit вердикт (на main / не на main) + чистые single-file PR на реально отсутствующее + рекомендация по судьбе ветки. **Surface decision о судьбе ветки — не удаляй её сам.**

> **Status:** ARMED. Drafted 2026-05-21.
> **Origin:** during the 2026-05-21 plan re-verification session, `chore/ssot-karpathy-skills-ref` was found **8 commits ahead of `origin/main` with no open PR**, yet most of those commits' content had already reached `main` via separate squash/rebase PRs (different SHAs). This is the same branch-drift class that earlier orphaned the Wave 9 §13.31 R-phase (rescued as #87). Goal: establish, **by content (not SHA)**, what is genuinely unmerged and land it cleanly; then decide the branch's fate.

---

## §0 Step 0 — обязательное чтение

1. [README.md#why-this-exists](../../../README.md#why-this-exists) — цель.
2. [.claude/session-bootstrap.md](../../../.claude/session-bootstrap.md) — инварианты.
3. [CLAUDE.md](../../../CLAUDE.md) — Artifact Ownership Contract; PR strategy (no drive-by).
4. Memory: [[feedback-no-git-reset-hard]], [[feedback-preserve-before-destructive-delegation]], [[feedback-check-inflight-prs-before-building]].

## §1 Hard constraints (read first — this is git surgery)

- **NO `git reset --hard`** (project-banned) and **NO force-push** (`git-safety.sh` hook blocks both; it will tell you to ask the maintainer). If you think you need either — STOP and surface.
- **Preserve before delete:** the branch + its origin copy are the only home of anything not-yet-on-main. Do NOT delete the branch until every commit is classified and missing content is landed + verified on main.
- **Content, not SHA:** squash/rebase PRs land identical *content* under *new* SHAs. So `git cherry` / SHA-ancestry will mislead. Classify each file by **content diff against `origin/main`** (`git diff origin/main:<path> <branch>:<path>` or `git show origin/main:<path>` vs branch).
- This is the **currently-checked-out branch** of the maintainer's main worktree. Do your inspection from a **separate worktree** (`git worktree add /tmp/recon origin/main`) — do not disturb the working tree.

## §2 Starting inventory (verify, don't trust — coarse path-level check from 2026-05-21)

The 8 commits `origin/main..chore/ssot-karpathy-skills-ref`, with a **coarse** path-presence check (path exists on main ≠ content identical):

| commit | subject | coarse signal |
|---|---|---|
| `cf650d4` | feat(hooks): session-anchored dual-audience end-of-turn recap | both paths on main (hook .sh via #89, design md via #91) — likely fully landed |
| `c0ce764` | docs(research): coverage-gap «citation presence not content» | **1 path OFF main** — likely genuinely unmerged ⚠ |
| `243bd59` | docs(research): Round-2 align §10 backward-check wording | path on main — diff to confirm content |
| `1db3c46` | docs(research): fix 2 fabricated citations + handoff mischar in 1B patch | path on main — diff to confirm |
| `e5f9c0b` | docs(research): scope-correct 1B swarm-tools | path on main — diff to confirm |
| `7c661a5` | docs(history): add narrative project-history book (v1) | **1 path OFF main** — book v1 likely not on main ⚠ |
| `d695ac5` | fix(hooks): rework end-of-turn reminder | path on main (hook .sh) — diff to confirm |
| `c470873` | docs(ssot): add prior-art entry #49 — Karpathy | path on main (#49 confirmed present) — likely landed |

**Note:** there is also an **untracked** `docs/meta-factory/project-history-book-v2.md` in the main worktree (the rewritten book from the 2026-05-21 session) — relate it to the v1 question, but it is a separate untracked artefact, not part of this branch's commits.

## §3 Method (per file, deterministic)

For every file touched by the 8 commits:
1. `git show origin/main:<path>` exists? If no → **MISSING** (content not on main).
2. If yes → `git diff origin/main:<path> chore/ssot-karpathy-skills-ref:<path>`. Empty → **LANDED**. Non-empty → **DIVERGED** (branch has edits not on main; inspect whether they're newer-real or stale-legacy).
3. Classify each as **LANDED** / **MISSING** / **DIVERGED-branch-newer** / **DIVERGED-branch-stale**.

## §4 Actions by class

- **LANDED** → nothing to do; this commit's content is safe on main.
- **MISSING** → land via the **#87/#91 pattern**: fresh branch off `origin/main`, bring **only that file** (`git checkout <sha> -- <path>`), commit, PR with `### §1.7 Forward-check applied` / `### §1.7 Backward-check applied` (file:line in both — the CI gate is literal about these headers). One PR per coherent unit; no branch merge (avoids legacy).
- **DIVERGED-branch-newer** → surface to maintainer with the diff; likely land the newer version. Do NOT assume.
- **DIVERGED-branch-stale** → surface; likely discard (the main version is canonical). Do NOT delete unilaterally.

## §5 Branch fate (decision-needed — surface, don't act)

After all 8 are classified and MISSING content is landed + **verified on `origin/main`**:
- If everything is LANDED → the branch is fully redundant; recommend retiring it (delete local + origin) — but **maintainer confirms the delete**; offer it as a recommendation with the evidence table, do not delete yourself.
- If anything is DIVERGED-stale and intentionally dropped → record why in a one-line note so the next session doesn't "rescue" it again (the §13.31 lesson).

## §6 AI laziness traps (active)
- **T3** — classify by actual diff output, not by «looks merged». Paste the diff/command for each MISSING/DIVERGED finding.
- **T10** — enumerate ALL files touched by the 8 commits before classifying (population first).
- **`#branch-state-drift`** ([[feedback-orchestrator-branch-state-drift]]) — re-verify `origin/main` HEAD at start; other sessions may move it.
- Do not `git reset`/force/delete-branch on a hunch — §1 constraints are hard.

## §7 Deliverable
A short reconciliation report (can be a research-patch under `docs/meta-factory/research-patches/` if findings are substantive): the 8-row classification table with evidence, links to any landing PRs opened, and the branch-fate recommendation for maintainer sign-off.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
