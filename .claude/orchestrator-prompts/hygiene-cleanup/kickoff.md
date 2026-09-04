# KICKOFF — hygiene-cleanup

> **Type:** I-phase (cleanup/closure) — scoped by `/meta-orchestrator` no-arg run 2026-06-01 (HEAD 056cbf6).
> **Origin:** V3 overview surfaced large stale-state drift: plan §0 reconciled 2026-05-29 but ~77 PRs (#282–#358) merged since (all untracked); ~15 completed umbrellas lack `done.md` → completion-filter under-reports DONE → every future `/meta-orchestrator` ranking is degraded.
> **Deliverable:** restore completion-detection accuracy + close stale-state drift. **$0, reversible (markdown-only), no code.**
> **Base branch:** staging.

---

## §0 Scope (3 parallel-safe sub-waves — disjoint surfaces)

| SW | Surface | Type | Vol | Parallel-with |
|---|---|---|---|---|
| A | `docs/meta-factory/wave-sequencing-plan.md §0` | doc-reconcile | M | B, C |
| B | `.claude/orchestrator-prompts/*/done.md` | closure-markers | S | A, C |
| C | `.claude/rules/` + `CLAUDE.md` + memory pointers | memory-codify | S | A, B |

Disjoint file scopes → run in separate worktrees per `parallel-subwave-isolation.md §1`, OR sequential A→B→C (all small). No stage gates between them (independent).

---

## §1 Sub-wave A — wave-plan §0 refresh

Reconcile `wave-sequencing-plan.md §0` against live merged PRs #282–#358. The dominant untracked block is the **runtime-bridge / aif autonomous-dispatch** track (per memory `project_aif_*`, `project_runtime_bridge_*`, `project_qloop_*`): dispatch fix #313, park primitive #332/#334/#337, question-loop battle-test #348, qloop-tail #349–#352, harvest #343/#352, bridge-health #358; plus SubagentStop-WARN #339/#340, companion-adoption #330/#331/#333, cross-worktree-symlink #346, satellite-harvest #328.

- **Owner constraint:** `wave-sequencing-plan.md` is maintainer + planning-session owned (Artifact Ownership Contract). A planning session MAY edit §0. Add a new §0 row (or umbrella block) for the runtime-bridge track marked DONE with PR evidence; update "What actually remains" to drop closed items.
- **DO NOT** touch §2–§6 (durable ordering layer) — §0 snapshot only.

## §2 Sub-wave B — done.md sweep (VERIFY-then-write, NOT blind)

For each candidate below, **verify completion before writing `done.md`** (guards against jaccard false-positives — see Active trap T-HYG-A). A candidate is DONE only if a real merged PR delivered its scope (check `gh pr view` / branch / deliverable), NOT merely jaccard≥basis.

Confirmed-missing `done.md` (from no-arg run): `aif-question-loop` (#348/#315), `companion-capability-survey-meta-launch` (#320/#321), `cross-worktree-symlink-iphase` (#346), `dispatch-worktree-automation` (#271/#285), `meta-orch-f3-iphase` (#263), `meta-orch-no-arg-laziness` (#261), `runtime-bridge-mcp-dispatch-fix` (#312/#313), `satellite-feature-harvest` (#328), `universal-satellite-integration-matrix` (#295), `worktree-cleanup-migration` (#346), `subagentstop-report-warn` (#339/#340), `meta-orchestrator-skill-memory` (#236), `m4-bash-hook-tests` (#195–#200), `principle-15-skill-paired-negative` (#112), `meta-orchestrator-iphase` (#186).

- **⚠ `one-click-installer` — DO NOT close.** Tagged DONE via jaccard #311, but #311 is `consumer-setup-autowrite`; memory `project_one_click_installer_umbrella_ready` says it is "READY, dispatch next" — verify, expect NOT-done. This is the falsifier proving the verify step earns its keep.
- Each `done.md` per CLAUDE.md «Umbrella closure convention» schema: `# <umbrella> — DONE` / `- Final PR: #<num>` / `- Closed: <YYYY-MM-DD>` / `- Summary: <one-line>`.

## §3 Sub-wave C — memory-codify (4 followups)

Per `memory-codification.md §3` write-time discipline, codify durable conventions stranded in memory (priority-score synthetic candidates): `feedback_harness_merge_block_and_500line_gate`, `feedback_meta_orch_self_reviews_own_kickoff`, `feedback_ai_doc_research_priority_pool`, `feedback_phase_minus_1_probe_exempt_allowlists`. For each: confirm it is a durable convention (§2 test), codify in natural repo home (CLAUDE.md / a `.claude/rules/*.md`), reduce memory entry to a pointer. Skip any that are ephemeral/identity/reference (§2 left column).

---

## §5 AI-traps active (per `.claude/rules/ai-laziness-traps.md §2`)

Active canonical traps: **T3** (no prose-only "done" claims — file:line/PR evidence per closure), **T10** (enumerate population before sweeping — list ALL umbrella dirs, not just memory-recalled ones), **T14** (clean ≠ verified — "no done.md" ≠ "umbrella done"; verify each), **T15** (self-application — this hygiene umbrella itself gets a `done.md` at close).

**Domain-specific:**
- **T-HYG-A — «jaccard-DONE ⇒ blind close»:** AI tempted to write `done.md` for every `status=DONE`-tagged umbrella from priority-score. Jaccard 100% is a *similarity* signal, not proof (e.g. `one-click-installer`↔#311 false-match). Counter: §2 VERIFY-then-write — confirm a real merged PR delivered the scope before any `done.md`.

> Blanket «see ai-laziness-traps.md» without the enumeration above = T7 violation.

## §6 Recursive self-application

This umbrella writes its own `.claude/orchestrator-prompts/hygiene-cleanup/done.md` on completion (T15). The sweep that fixes completion-detection must itself be completion-detectable.

## §8 Stop conditions

- Any `done.md` candidate fails verification (no merged PR found) → do NOT write its marker; record as "OPEN, not closed" and continue.
- `one-click-installer` resolves to NOT-done → leave open, surface to maintainer.
- §0 edit would touch §2–§6 → halt (out of scope).

## §9 Anti-scope

- No code edits (markdown/closure only). No npm deps.
- No Worker dispatch / PR from the meta-orchestrator session — dispatch awaits maintainer GO.
- Do NOT rewrite §2–§6 of wave-plan; §0 snapshot only.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
