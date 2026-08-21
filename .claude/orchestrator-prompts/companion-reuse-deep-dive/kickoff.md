# Umbrella: companion-reuse deep-dive (second-round BFR-default sweep)

> **Status:** DRAFT planned 2026-05-26. **NOT yet dispatched.** Awaits Stage 5 dogfood settle + maintainer prioritisation vs concurrent `meta-orch-channel-discipline` umbrella + J5 verdict.
> **Authoritative for:** umbrella scope + 4-sub-wave R-phase breakdown + admission gates for re-evaluating Tier-1 companion patterns under-credited during initial meta-orchestrator R-phase, plus Devin dynamic re-plan inspiration probe.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Specific substrate refactor decisions (any Sub-wave's verdict that says BUILD spawns its own implementation umbrella; this one is research-only). [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) verdict ladder — that lives in the rule.

> **Origin:** This Claude Code session 2026-05-26 surfaced via maintainer pushback that the initial BFR-default §3 sweep (R-phase patches 2026-05-23 + 2026-05-25-planner-completeness-prior-art + 2026-05-26-meta-orchestrator-mode-triage-prior-art) used **muddied scope** in DeepWiki probes («across multiple umbrella/projects» one-slash framing), causing under-crediting of within-project-multi-initiative capabilities:
> - **aif-handoff** `autoQueueMode` — real within-project autonomous task advancement (SSOT #67 REJECT due to Docker+DB infra; capability-match score `~22%` likely under-credited, real `~35%`).
> - **oh-my-openagent** `start-work` hook — multi-plan selection with 5-level priority logic (recency fallback + boulder.json resume + explicit-name match); SSOT #68 REFERENCE `~30%` likely `~35-40%`.
> - **Superpowers brainstorming v5.0** scope-assessment — «multi-subsystem requests are flagged early and decomposed into sub-projects, each with its own spec → plan → implementation cycle» — pattern not registered in SSOT separately.
> - **Devin** dynamic re-plan + DAG-within-task pattern (singularitymoments + Medium «How Devin AI Actually Thinks» 2026-04) — pattern for substrate v2 dispatch loop; my initial verdict DEFER may have under-weighted applicability.
>
> Plus today's three sharpened DeepWiki probes recorded in session conversation (links in §6 below). The under-credit is a **T16 «pattern-matching-on-name» trap** specifically the «my framing equals upstream framing» variant — companion answers are correct for the asked question; the asked question was wrong-scope.

---

## §1 Admission gates — DO NOT dispatch Sub-wave A until ALL hold

1. **Stage 5 dogfood umbrella merged** (PR #245 — DONE) AND the seven follow-ups (J1-J5 + N1-N2) have at least been prioritised by maintainer. **Current state (verified 2026-05-26 ~22Z):** J1 fixed in PR #246 (merged 16:33Z); J2/J3/J4/J5 + N1/N2 still pending prioritisation. Bundle Stage 3 in flight via PR #247 — UNRELATED, not blocker for this umbrella.

2. **J5 verdict — PRIORITISED, NOT RESOLVED (relaxed 2026-05-26 by orchestrator).** R-phase findings of THIS umbrella are about EXTERNAL companion patterns — their architecture doesn't depend on our gitignore policy. Original strict gate («J5 resolved») was over-strict; relaxed to: **J5 must be on maintainer's queue, but Sub-wave findings explicitly evaluate adoption-candidates under BOTH Option A (gitignored status quo) AND Option C (hybrid track) assumptions, NOT commit on one J5 outcome**. Each Sub-wave verdict carries dual-assumption check. Sub-wave A specifically: `roadmapAlias` tag schema viability differs sharply between A (tags live in gitignored state files only) vs C (tags live in tracked kickoff frontmatter); verdict cites both paths.

  **J5 Option A/B/C definitions** (inlined to remove pointer-rot risk per reviewer M4 finding) — full context at `docs/meta-factory/research-patches/2026-05-26-meta-orchestrator-stage-5-dogfood.md` §5 J5 row:
- **Option A:** keep `.claude/orchestrator-prompts/*` fully gitignored as today. Substrate broken in fresh worktrees by design; manual `cp -r` workaround per session.
- **Option B:** track ALL files under `.claude/orchestrator-prompts/`. Repo history bloat + PII risk if state files contain workspace-specific paths.
- **Option C (hybrid, orchestrator-recommended):** track only `kickoff.md` files (decision-bearing artefacts, Superpowers-aligned per `docs/superpowers/plans/` precedent); gitignore `state.md` / `_plan-cache.md` / `_master-backlog-delta.json` / meta-launch directories (ephemeral session state, Superpowers `.worktrees/` precedent).
3. **Concurrent umbrella ordering** with `meta-orch-channel-discipline` (sibling kickoff at `.claude/orchestrator-prompts/meta-orch-channel-discipline/kickoff.md`). Either:
   - Run channel-discipline R-phase first (yields enforcement mechanism), then this umbrella (deep-dive uses channel-discipline insight to test adoption candidates against the enforcement layer); OR
   - Run this umbrella first (deep-dive yields ADOPT candidates), then channel-discipline takes them as starting prior-art.
   Maintainer call. Sub-wave A of either can run; not both in parallel without explicit decision (parallel R-phases on overlapping companion space = duplicate DeepWiki traffic).
4. **Phase -1 cold-review of THIS kickoff complete** (1× Opus reviewer default per orchestrator skill Phase -1 protocol).

If any gate fails → this kickoff stays parked.

---

## §2 Sub-wave breakdown (all R-phase, all Mode A inline Opus single-session)

### Sub-wave A — aif-handoff `autoQueueMode` deep-dive

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-companion-reuse-aif-handoff-autoqueue.md`.

**SCOPE CLARIFICATION (post-reviewer B2 finding):** SSOT row #67 evaluated the **full Kanban runtime** (`pollAndProcess` cron + Docker+DB infra) and rejected on infra mismatch. The `autoQueueMode` LOGIC is a **sub-component** that was **not separately evaluated** in row #67. Sub-wave A therefore **proposes a NEW SSOT row** (next-available slot at PR merge time — do NOT hardcode #82; first-to-dispatch claims first slot per Sub-wave C/D collision-avoidance rule) for autoQueueMode-specifically; does **NOT amend** #67 (which keeps its REJECT verdict for the full Kanban runtime, correct as-is). If Sub-wave A's evaluation reveals row #67's REJECT-narrative omitted a meaningful sub-component, propose an *additive note* on #67's «Trigger to revisit» field — not a verdict change.

**Must cover:**

1. **Full DeepWiki sweep of `lee-to/aif-handoff` autoQueueMode internals** (≥3 phrasings, **all with explicit «within-one-project, multi-initiative» disambiguation** per T-CR-A trap):
   - How does `processAutoQueueAdvance` decide pool slot allocation across initiatives within one project?
   - How is `roadmapAlias` + `tags` (`roadmap`, `rm:<alias>`, `phase:<N>`, `phase:<name>`, `seq:<NN>`) actually used — UI-only confirmed, OR is there hidden hook into ordering anywhere?
   - `scheduledAt` semantics: how does it interact with `position` ordering?
   - `parallelEnabled` + `COORDINATOR_MAX_CONCURRENT_TASKS` parameter: tuning surface for our parallel Mode B substrate?
2. **T16 problem-class match for `autoQueueMode` standalone:** is the LOGIC (separately from Docker+DB infra) ADAPT-viable as a pure-bash priority-ordering helper? Dual-assumption per J5 gate: evaluate under both Option A (tags in gitignored state) and Option C (tags in tracked kickoff frontmatter).
3. **Verdict per `build-first-reuse-default.md §1`** for the NEW row:
   - ADOPT (full): unlikely — Docker+DB hard-block carries even for sub-component
   - **ADOPT VOCABULARY: most-likely** — `roadmapAlias` / `phase:<N>` tag schema as vocabulary precedent for our umbrella tagging
   - ADAPT: maybe — bash-port pool-allocation logic for our parallel sub-waves
   - REFERENCE: minimum — confirm autoQueueMode as production-grade within-project advancement
   - REJECT: only if extraction proves infeasible
4. **SSOT new-row proposal:** draft new row content (Trigger / Our-use / Verdict / Match-score / Falsifier) with next-available-slot placeholder (resolution at PR merge time).

### Sub-wave B — oh-my-openagent multi-plan selection + categories system deep-dive

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-companion-reuse-omo-deep-dive.md`.

**PRE-SWEEP DISAMBIGUATION (post-reviewer M3 finding):** SSOT contains two GitHub owners for «oh-my-openagent»:
- `code-yeongyu/oh-my-openagent` (cited by SSOT #68 — main reference for OhMyOpencode 3-layer orchestration)
- `Doriandarko/oh-my-openagent` (cited by SSOT #81 — for alias routing pattern)

**First action of Sub-wave B before any deepwiki ask_question:** verify which is canonical (active) and which is a fork/rename via `git remote` HEAD inspection on each + cross-check Devin DeepWiki indexing freshness via `read_wiki_structure`. Document the canonical identity + flag SSOT inconsistency. If two are forks of the same project — note divergence point. If different products entirely — clarify which row evaluates which.

1. **Full DeepWiki sweep of the canonical `<owner>/oh-my-openagent`** (≥3 phrasings, **all with explicit «within-one-project, multi-plan» disambiguation** per T-CR-A trap):
   - Multi-plan selection in `src/hooks/start-work/context-info-builder.ts` — full 5-level logic (explicit-name / boulder.json / session-history-recency / single-incomplete / multi-prompt). Recency-fallback algorithm — could we adopt it for our session-aware umbrella selection?
   - Categories System (DeepWiki wiki page #4.2): what is it, does it group plans by domain/priority?
   - 11-agent architecture — Atlas (executor) + Prometheus (planner) + Sisyphus (main) + Hephaestus (deep work) + Metis + Momus + Oracle + 4 more — role split vs our Worker/Reviewer/Orchestrator. SSOT #68 ADOPT VOCABULARY scope only — should it expand?
   - Parallel-Execution-Waves section format in `.omo/plans/*.md` — already adopted as our launch-table inspiration per SSOT #68; verify our adaptation faithful or drifted.
2. **T16 problem-class match recalibration:** SSOT #68 REFERENCE 30% — update post-corrected-framing.
3. **Verdict per BFR-default ladder.**
4. **SSOT amendment proposal if match-score moves materially.**

### Sub-wave C — Devin dynamic re-plan + DAG-within-task viability check

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-companion-reuse-devin-replan.md`.

**SPAWN-substrate-v2-umbrella clarification (post-reviewer M5 finding):** if Sub-wave C verdict = BUILD, Worker **does NOT autonomously create a new umbrella kickoff file** (would be drive-by per `CLAUDE.md:87`). Worker SURFACES the BUILD finding in the research patch §5 «Recommendation» section explicitly framing: «Sub-wave C verdict BUILD. Suggested follow-up umbrella: `substrate-v2-dynamic-replan` — orchestrator/maintainer creates the new umbrella kickoff in a separate session after this R-phase merges». Worker does NOT create files outside the research-patch deliverable. Orchestrator/maintainer decides whether/when/how to spawn.

**Must cover:**

1. **Architecture sources (closed-source, public docs only):**
   - Medium «How Devin AI Actually Thinks: Autonomous Planning, DAG Execution, and Dynamic Re-Planning Explained» (Nitinmatani, 2026-04)
   - Cognition annual review 2025
   - Devin AI Guide 2026 (Singularity Moments)
   - WebSearch ≥3 phrasings on internals
2. **Pattern extraction — what's actually adoptable without paid LLM:**
   - Plan → execute → observe → re-plan loop: **architecture-level pattern, not implementation**
   - Re-plan triggers: «findings divergence», «external state changed», «scope revision needed» — can we encode as deterministic bash predicates?
   - DAG-within-task: our launch-table is already DAG-shaped; what does Devin's intra-task DAG add that we lack at intra-Stage level?
   - Persistent working memory across re-plans: already covered by our state.md + plan-cache
   - Fork/rollback session state: covered by worktree+`git worktree remove`
3. **Substrate v2 design sketch (if pattern transfers):** propose minimum-viable «between-Stage-N-merge-and-Stage-N+1-dispatch» re-plan hook:
   - Trigger: Stage N PR merged → orchestrator re-runs autonomous-discovery + delta-diff vs original launch-table
   - Divergence detection: compare original launch-table TOP_UMBRELLA + sibling-set vs current backlog state
   - Action: surface divergence as DECISION-NEEDED («launch-table stale; original Stage 2 expected scope X, current backlog suggests Y; re-plan?»)
   - **Critical falsifier:** this triggers for EVERY Stage N → Stage N+1 transition; over-firing risk (UI noise) very high. Need filter: only surface if divergence above threshold T (TBD).
4. **Verdict per BFR-default ladder:**
   - DEFER (most likely): pattern useful but premature; manual `/meta-orchestrator` re-run works for current single-maintainer cadence; trigger if ≥2 documented cases of «manual re-plan would have saved a wrong Stage».
   - ADAPT: if Sub-wave C R-phase finds clean low-noise re-plan-trigger predicate
   - REJECT: if architectural mismatch too severe
   - SPAWN-substrate-v2-umbrella: if verdict = BUILD — separate I-phase umbrella generated, NOT in this kickoff.
5. **No new SSOT row without net-new contribution.** Per my decision 2026-05-26 in this session: Devin's patterns are 100% covered by existing 12 SSOT rows; new row only if Sub-wave C R-phase finds an architecture-specific contribution that 12 rows miss. **Row-number assignment (post-reviewer M2 finding):** if new row needed, use **«next-available slot at PR merge time»** (do NOT hardcode #82 — Sub-wave A also reserves new row, collision risk). Sub-wave dispatched FIRST claims first-available slot; subsequent sub-waves increment from there.

### Sub-wave D — Superpowers `brainstorming` scope-assessment deep-dive

**Output:** `docs/meta-factory/research-patches/2026-MM-DD-companion-reuse-superpowers-scope.md`.

**Must cover:**

1. **DeepWiki sweep of `obra/superpowers` v5.0+ brainstorming + writing-plans:**
   - Scope assessment trigger: when does Brainstorming flag a request «too large for one spec»?
   - Sub-project decomposition mechanism: how is «multi-subsystem decomposition» actually mediated — judgment, heuristic, prompt structure?
   - Sub-project lifecycle: do sub-projects get independent spec → plan → implementation cycles, or is there a sub-project graph?
2. **T16 problem-class match:** does sub-project decomposition map to our umbrella-stage decomposition? Or is it within-feature-scope splitting (closer to our intra-stage)?
3. **Verdict + SSOT amendment** (potentially new row at next-available slot if pattern is net-new — do NOT hardcode #82 per Sub-wave A/C collision risk; most likely outcome: ADOPT VOCABULARY for «sub-project boundary» as decision moment).

---

## §3 Out of scope (anti-drive-by)

- **No autonomous I-phase work.** This umbrella is R-phase × 4 sub-waves; verdicts produce SSOT amendments + research patches. Any verdict that says «BUILD» spawns a NEW umbrella for implementation, NOT modifies substrate here.
- **No substrate edits.** Helpers stay untouched; SKILL.md stays untouched.
- **No new principle tests.** That's `meta-orch-channel-discipline` umbrella's territory.
- **No re-litigating R-phase verdicts that already shipped to staging.** SSOT rows added by previous R-phase patches stay; only AMENDMENTS with corrected match-scores are proposed.
- **No expanding scope to commercial-only companions** (Cursor's BugBot, Sweep AI, Bot Anya, Magic.dev's CTO-mode etc.) without explicit maintainer go — they require paid-subscription verification that conflicts with no-paid-llm-in-ci.md §1.

---

## §4 §1.7 Forward-check applied (planning-level)

- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — full 6-layer search per sub-wave; explicit ≥3 phrasings on DeepWiki + WebSearch.
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item search-coverage checklist binding on negative-existence claims; Sub-wave C verdict «pattern X doesn't transfer» must pass the check.
- [`phase-research-coverage.md §1.7`](../../../.claude/rules/phase-research-coverage.md) self-reflexive — each sub-wave's research patch carries its own §1.7.
- [`ai-laziness-traps.md §2 T16`](../../../.claude/rules/ai-laziness-traps.md) — **load-bearing**: this very umbrella exists because T16 (corrected-but-late) was caught in initial R-phase sweep. Each Sub-wave must explicitly walk through problem-class-match check with corrected scope phrasing.
- [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) — **Active T-traps for this R-phase** (canonical enumeration per §3 obligation, not blanket-reference per T7 anti-pattern):
  - **T1** — sampling artefact: each Sub-wave's «no upstream candidate exists» finding must hit ≥5 DeepWiki phrasings before negative-existence claim.
  - **T3** — plausible-finding-without-verification: every verdict cite DeepWiki output OR file:line.
  - **T7** — pattern-matching-the-prompt: walk corrected-scope disambiguation literally per Sub-wave, do NOT skip.
  - **T11** — designing-without-prior-art-check: each Sub-wave does BFR-default §3 6-layer before proposing any verdict.
  - **T12** — skipping-literature-sweep: DeepWiki at moment of verdict, not from training-data memory.
  - **T13** — treating-ADOPTED-as-zero-work: even if prior SSOT row says ADOPT, re-verify upstream evidence per sub-wave.
  - **T14** — clean-audit-conflated-with-no-theatre: if Sub-wave returns «no new pattern» — distinguish «sweep covered + nothing found» vs «sweep insufficient».
  - **T15** — self-application skipped: §1.7 self-reflexive walk per Sub-wave patch.
  - **T16** — pattern-matching-on-name: **load-bearing for this umbrella** (the very trap that motivated it).
  - **T19** — own-cold-QA-before-handoff: each Sub-wave patch passes own cold-review before PR.
  - **T20** — inline-verdict-without-evidence: every Sub-wave verdict cites DeepWiki + SSOT row + falsifier in same turn.
  - **Domain-specific** — **T-CR-A «muddied-scope-on-DeepWiki-probes»**: always disambiguate «multi-project across repos» vs «multi-initiative within-one-repo» explicitly in DeepWiki question text. Counter: re-read each DeepWiki probe before submitting; reject one-slash framings.
- [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — each Sub-wave verdict surfaces strategy forks as DECISION-NEEDED.
- [`recommendation-laziness-discipline.md §3`](../../../.claude/rules/recommendation-laziness-discipline.md) — every verdict cites SSOT-row + DeepWiki output + falsifier in same turn.
- [`CLAUDE.md` PR strategy](../../../CLAUDE.md) — no drive-by adoption PRs; verdicts SURFACE patches, do NOT autonomously ship.
- [`no-paid-llm-in-ci.md §1`](../../../.claude/rules/no-paid-llm-in-ci.md) — paid-LLM patterns (TaskMaster `analyze-complexity` rejected per SSOT #73 precedent) explicitly out-of-scope unless ADOPT-VOCABULARY-only.

## §5 §1.7 Backward-check applied (planning-level)

- Predecessors:
  - Initial R-phase patch `2026-05-23-meta-orchestrator-prior-art.md` (SSOT rows #66-#68)
  - Planner-completeness R-phase patch `2026-05-25-planner-completeness-prior-art.md` (SSOT rows #72-#74)
  - Stage 1 R-phase patch `2026-05-26-meta-orchestrator-mode-triage-prior-art.md` (SSOT rows #78-#81)
- Predecessor incident: T16 trap in muddied-scope DeepWiki probe (this session 2026-05-26).
- No conflict with concurrent planned umbrellas: `meta-orch-channel-discipline` (mechanism enforcement for SKILL.md §5) is orthogonal; J5 verdict resolves gitignore boundary which constrains adoption candidates this umbrella surfaces.
- SSOT rows #66/#67/#68 amendments may surface as deliverable of this umbrella — that IS the point (correction, not drive-by).
- `.claude/rules/*.md` — none modified.
- `packages/core/principles/*.test.ts` — none modified.

---

## §6 See also

- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — the SSOT this umbrella may amend (rows #66/#67/#68 specifically).
- Sibling kickoff stubs:
  - `.claude/orchestrator-prompts/meta-orch-channel-discipline/kickoff.md` — channel-discipline mechanism for SKILL.md §5
  - `.claude/orchestrator-prompts/meta-orchestrator-mode-triage-and-planner/stage-5-dogfood-kickoff.md` — Stage 5 dogfood (DONE; this umbrella's findings inherit it)
- Today's sharpened DeepWiki probes (**provenance only** — these are session-specific search-result URLs that may not resolve in a fresh session; Worker should re-run queries from scratch, NOT rely on these URLs as starting points):
  - [Superpowers within-one-project multi-initiative (DeepWiki 2026-05-26)](https://deepwiki.com/search/scope-clarification-within-one_6b4aa2f3-18bb-465f-9939-aae94c7a0519)
  - [aif-handoff autoQueueMode initiative/epic grouping (DeepWiki 2026-05-26)](https://deepwiki.com/search/scope-clarification-within-one_7e27e866-c4bc-482b-b3e9-673efc967e1e)
  - [oh-my-openagent multi-plan selection logic (DeepWiki 2026-05-26)](https://deepwiki.com/search/scope-clarification-single-pla_1150444f-94f3-426d-ac99-571d60f34c25)
  - [Devin dynamic re-plan architecture (Medium 2026-04)](https://medium.com/@nitinmatani22/how-devin-ai-actually-thinks-autonomous-planning-dag-execution-and-dynamic-re-planning-explained-997be175a475)
- [`.claude/rules/ai-laziness-traps.md §2 T16`](../../../.claude/rules/ai-laziness-traps.md) — the trap class this umbrella corrects against.
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied per Sub-wave.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
