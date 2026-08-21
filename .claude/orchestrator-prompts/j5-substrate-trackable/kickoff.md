# Umbrella: J5 substrate-trackable (R-phase first)

> **Status:** STUB drafted 2026-05-27 by orchestrator session at M-A umbrella closure.
> **Authoritative for:** scope statement + R-phase brief for fixing the J5 architectural DECISION-NEEDED ('.claude/orchestrator-prompts/* gitignored → substrate broken in fresh worktrees') by adopting the Superpowers precedent (`docs/superpowers/plans/` tracked + `.worktrees/` ignored).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists).

## §0 Origin & vision

**Maintainer 2026-05-27** (post-M-A closure): «J5 fix — план есть, не реализован. Под новый скил уже реализовывать».

**Problem statement (from `MEMORY.md` `project_meta_orch_mode_triage_done.md`):**

> **J5 architectural DECISION-NEEDED** — `.claude/orchestrator-prompts/*` gitignored → substrate broken in fresh worktrees. Fresh worktree does not see umbrella kickoffs (they live in gitignored path). `/meta-orchestrator` cannot scan/prioritize across umbrellas when invoked from a worktree.

**Recommended fix (from same memory entry):**

> orchestrator recommends **Option C hybrid** per Superpowers precedent — `docs/superpowers/plans/` tracked + `.worktrees/` ignored, **separate R-phase for sub-design**.

I.e., invert current `.claude/orchestrator-prompts/*` gitignore-all into a SPLIT:
- **Tracked:** umbrella kickoffs, stage prompts, decision documents, state.md — anything that needs cross-session persistence
- **Ignored:** ephemeral worker output, scratch logs, /tmp-class artifacts

## §1 Scope (R-phase)

This is the **R-phase only**. I-phase split into separate umbrella after R-phase verdict lands.

R-phase deliverable: `docs/meta-factory/research-patches/YYYY-MM-DD-j5-substrate-trackable.md` containing:

- **§0 TL;DR** — 3-5 bullets on proposed split + migration plan
- **§1 Method** — what was read; Superpowers precedent verified; current `.gitignore` inventory
- **§2 Inventory of `.claude/orchestrator-prompts/*`** — every existing file classified into: KEEP-TRACKED / IGNORE / SCRATCH-class (must be moved)
- **§3 Superpowers precedent T16 walk** — «Upstream problem class: ... / Our problem class: ... / Match? evidence»
- **§4 Proposed `.gitignore` diff** — exact lines to add/remove
- **§5 Migration plan** — for existing 30+ kickoff files: which `git mv` or `git rm --cached` ops needed
- **§6 Substrate consequences** — what happens to existing references in skills/docs that assume gitignored substrate (e.g., embedded-kickoff workaround in M-A Stage 2-6 worker prompts becomes unnecessary)
- **§7 §1.7 self-reflexive block** (mandatory H3 headers per principle 13)
- **§8 ATTN — DECISION-NEEDED items maintainer must resolve before I-phase**

## §2 Hard constraints

- NO substrate edits in R-phase — research-only patch
- No drive-by per CLAUDE.md PR strategy — single PR scoped to this design
- No paid LLM in CI; no `claude` CLI invocations in any new recipe
- Universal-satellite vision non-negotiable
- 6-item search-coverage on every «no Superpowers equivalent» claim
- T16 walk mandatory per «adopt X from Superpowers» recommendation
- **Verify Superpowers actual implementation** — DeepWiki probe + raw GitHub fetch of `obra/superpowers` `.gitignore` to confirm the «plans tracked + worktrees ignored» pattern is the ACTUAL precedent, not a memory misquote

## §3 Active T-traps

T1 (sampling floor — audit ALL existing 30+ orchestrator-prompt files, not 5), T3 (file:line per finding), T7 (adversarial — does Superpowers ACTUALLY have plans tracked?), T11/T12 (search-coverage on alternative splits), T13 (don't trust «memory says it's Superpowers precedent» — verify), T15 (recursive — does this R-phase apply its own discipline to itself?), T16 (problem-class match Superpowers↔ours), T19 (own cold-QA before PR), T20 (no inline verdict without evidence), T-CR-A (within-project disambiguation — Superpowers has multiple gitignore patterns; pick the one matching our problem class).

**Domain-specific:** **T-J5-A «git-rename-loses-history»** — if migration plan involves `git mv kickoff.md tracked-path/kickoff.md`, ensure git's rename detection preserves history. If renames are bulk, consider `git filter-branch` alternatives. Counter: §5 migration plan documents each move with rename-detection threshold check.

## §4 Dispatch protocol

- Single Worker, Mode A inline Opus + `isolation:"worktree"`
- Phase -1 cold-review (1× Opus default — research-only, not prod-blast)
- Autonomous to PR-open
- Anti-collusion spot-check by orchestrator on one load-bearing claim (likely: Superpowers `.gitignore` actually has this pattern)

## §5 Out of scope (separate umbrellas)

- **I-phase implementation** — split into separate umbrella `j5-substrate-trackable-implement` after R-phase verdict + maintainer review
- **`meta-orch-channel-discipline`** — promote SKILL.md:347 Class C→A (orthogonal; mentioned in same MEMORY entry as J5 but separate concern)
- Migration of OTHER gitignored project paths (not in `.claude/orchestrator-prompts/`)
- Renaming of `.claude/orchestrator-prompts/` itself to e.g. `.claude/umbrellas/` — that's a separate naming-convention decision

## §6 See also

- `MEMORY.md` `project_meta_orch_mode_triage_done.md` — J5 source entry
- `.claude/skills/meta-orchestrator/SKILL.md` — affected substrate
- Superpowers `obra/superpowers` `.gitignore` + `docs/superpowers/plans/` — precedent to verify
- `.gitignore:7` — current `.claude/orchestrator-prompts/*` blanket exclusion
- `docs/meta-factory/research-patches/2026-05-22-storm-readiness-as-positioning.md` — related «niche-work as storm-prep» framing
- `.claude/rules/build-first-reuse-default.md §3` — verdict ladder (ADOPT vs ADAPT for Superpowers pattern)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
