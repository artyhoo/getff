# KICKOFF — coordination-persistence-fix

> **Type:** brainstorm → I-phase (run in a DEDICATED new session — NOT in the planning session that scoped this).
> **Origin:** `/meta-orchestrator` no-arg run 2026-06-01 surfaced that gitignored coordination state does NOT persist across worktrees in this (Superset) worktree. This kickoff PLANS the work; the design brainstorm happens in the new session.
> **Base branch:** staging.
> **⚠ Self-referential:** this kickoff is itself gitignored — it was manually rescued to `$CANON` (`~/.claude-coordination/rules-as-tests-aif/coordination-persistence-fix/`) on author, because the very bug it describes would otherwise lose it.

---

## §0 Verified findings (evidence, 2026-06-01, HEAD 056cbf6)

Two-part persistence gap + a migration hazard:

- **(A) Superset worktrees never run the linker.** `find .claude/orchestrator-prompts -type l` → **0 symlinks of 325 files** in this worktree. The auto-call to `scripts/link-coordination.sh` is wired only into `.claude/hooks/worktree-setup.sh:123` (CC WorktreeCreate hook) and `scripts/create-worktree.sh:97`. Superset (`/Users/art/.superset/worktrees/<id>/`) creates worktrees via its own mechanism that bypasses both → linker never fires → kickoffs/state written here are local-only gitignored files lost on worktree cleanup.
- **(B) Root-level meta-orchestrator memory is structurally out of scope.** `_plan-cache.md` and `_master-backlog-delta.json` live at the ROOT of `.claude/orchestrator-prompts/`. `link-coordination.sh` iterates only `"$WT_PROMPTS"/*/` (umbrella dirs, lines 94/132) — root files are NEVER matched. So even running the linker would not share them.
- **(C) Migration hazard for already-diverged worktrees.** This worktree was COPY-hydrated (J5 #310) → almost every file is real in BOTH worktree and `$CANON` → `link-coordination.sh` adopt-then-link would hit mass CONFLICT (exit 1, never clobbers).
- **What persists fine:** `done.md` (+ root `README.md`) — git-tracked exceptions (`!.claude/orchestrator-prompts/*/done.md`), committed to repo, no `$CANON` needed.

Refs: `scripts/link-coordination.sh` (#346, SSOT #110, verdict ADAPT); J5 COPY-hydrate #310; memory `project_cross_worktree_symlink_iphase_queued`, `project_superset_migration_and_j5_resolved`.

## §1 Decisions LOCKED by maintainer (this planning session, 2026-06-01)

1. **Trigger = ALL THREE channels** (B SessionStart + A skill-§0 self-heal + C Superset-native hook). Rationale: native hook fits «own-stack/native-primitive» philosophy AND defence-in-depth; but **do NOT hard-couple to Superset**. Maintainer flagged: «хорошо об этом решении подумать» → **the *how* of combining 3 channels without over-coupling is the core brainstorm topic** (idempotency contract so 3 channels never conflict; native-where-present, portable-fallback-always). **Maintainer EXPLICITLY likes the Superset-native channel C** («мне нравится») — give it first-class treatment (native parity with the CC WorktreeCreate path), with the explicit caveat that C alone «чинит только новые» worktrees and is Superset-coupled, so B+A remain mandatory as the portable, retroactive, universal floor (T-CPF-A).
2. **Part 2 (root-memory share) = option (i)** — share BOTH `_plan-cache.md` and `_master-backlog-delta.json` via the linker, AND make their update helpers write atomically (write-temp-then-`mv`) so a shared symlink never corrupts under parallel sessions. (Cache is already declared «NOT load-bearing» in its own header; mechanical state wins regardless.)

## §2 OPEN design questions for the brainstorm session

- **Q1 (the meaty one):** how to weave 3 trigger channels idempotently so they compose, not conflict — e.g. SessionStart + skill-§0 + native all calling the same idempotent `link-coordination.sh`; native = «where present», portable = «always», skill = "last-resort self-heal". Avoid `#vendor-lock-by-convenience` (don't hard-depend on Superset internals) per `build-first-reuse-default.md §4`.
- **Q2:** migration of already-diverged worktrees — add `--on-conflict=canon|worktree|skip` (default `skip`)? Or one-time manual reconciliation script? Scope: existing worktrees only; fresh ones avoid conflict if linked from session-start before any copy.
- **Q3:** atomic-write — do `update-cache.sh` / `update-delta.sh` / `delta-write-from-state.sh` already write atomically? Verify; add `mv`-atomicity where missing (paired-negative test).
- **Q4:** dual-pair / SSOT — this extends `link-coordination.sh` (SSOT #110, `@dual-pair: cross-worktree-coordination-doc-sync`); decide whether root-memory share is same anchor or a new one.

## §3 Tentative sub-waves (refine in brainstorm)

| SW | Surface | Type |
|---|---|---|
| A | extend `link-coordination.sh` (root-file loop + `--on-conflict`) + tests | I-phase-small |
| B | atomic-write in cache/delta update helpers + paired-negative tests | I-phase-small |
| C | 3-channel trigger wiring (SessionStart in settings.json [maintainer-apply] + skill §0 self-heal + Superset-native hook in `.superset/hooks/`) | wiring |

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

**T16** (pattern-matching-on-name — verify Superset hook actually fires where assumed, don't infer), **T3** (file:line/command evidence for every «it links now» claim), **T19** (own cold-QA the diff before handoff — CI ≠ design review), **T15** (self-application — the fix's own kickoff/spec must persist via the mechanism it builds).

**Domain-specific — T-CPF-A «portable-fallback-omitted»:** tempted to wire only the Superset-native hook because «we're on Superset anyway» → hard-couples, breaks on CC/Cursor/plain-CLI. Counter: native is additive; the portable SessionStart + skill self-heal MUST stand alone (`dual-implementation-discipline.md §3`).

## §6 Recursive self-application
The fix must make ITS OWN spec + kickoff persist cross-worktree. Verify by writing the spec, then confirming it appears in `$CANON` from a second worktree.

## §8 Stop conditions / §9 Anti-scope
- This is a PLAN. The brainstorm + implementation run in a NEW session. Do NOT implement here.
- `settings.json` / `.claude/hooks/` edits = maintainer-applied (agent-self-protected).
- No npm deps; markdown + bash + CC/Superset hook primitives only.

## Launch (new session)
```
/meta-orchestrator coordination-persistence-fix
```
…or open a fresh session and invoke `superpowers:brainstorming` directly on §2 Q1-Q4 (decisions §1 are already locked — don't re-litigate).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
