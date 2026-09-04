# KICKOFF — meta-orchestrator bundle-autonomous (COMBINE direction)

> **Type:** R-phase first (prior-art survey, $0), then conditional I-phase (~100-150k Opus, gated by Stage 2 maintainer decision).
> **Base branch:** `staging` (NOT `main`).
> **Do NOT dispatch this umbrella before planner-completeness L4+L5 ships.** Bundle decisions consume L4 classifier outputs + L5 dispatch routes; without them = vapor.

| Stage | Scope (one line) | Depends on |
|---|---|---|
| bundle-autonomous | COMBINE direction: aggregate linear items into one autonomous batch umbrella (R-phase → gate → conditional I-phase) | `meta-orchestrator-planner-completeness/kickoff.md` Stage 5 (L4 classifier + L5 dispatch routing) |

## Maintainer's intent (verbatim, 2026-05-25)

> «мета оркестратор не только декомпозирует сложные и обьемные задачи но и наоборот собирает простые для автономной работы»

> «хочется чтобы мета оркестратор оценивал сложность реализации кикофов — и если это простые задачи которые оркестратор может без потери качества выполнить однолинейно без глубины 2 — то обьединял бы в амбрелы для более автономных задач»

**Symmetric capability framing:** meta-orchestrator already decomposes complex umbrellas → N sub-waves. This umbrella adds inverse direction: aggregate scattered linear items → ONE umbrella for autonomous batch dispatch. Same endpoint (batch processing of linear pieces), different source (aggregation, not decomposition).

**Pain pattern it solves:** maintainer accumulates micro-fix backlog (memory `TODO-codify:` markers, F.2 MINOR observations carried into research-patches as known-residuals, `cold-review-fixes.md` un-actioned items, stale `wave-sequencing-plan §0` 🟡 rows). Currently — N invocations or manual head-juggling. Goal: one invocation → preview → single GO/REMOVE/STOP touchpoint → autonomous batch run.

## Deliverables

1. **R-phase (Stage 1):** `docs/meta-factory/research-patches/2026-05-XX-bundle-autonomous-prior-art.md` — surveys upstream batch/bundle/aggregation patterns; ADOPT/ADAPT/BUILD/REJECT per design dimension (B1/B2/B3 below).
2. **Decision gate (Stage 2):** maintainer GO/DEFER/DROP per Stage 1 verdict.
3. **I-phase (Stage 3, conditional on GO):** SKILL.md new section + bundle-curate.sh helper + principle 19 test + mirror sync + 3-umbrella quality-parity smoke.

---

## §0 Cold-start verification (read FIRST)

Confirm these hold BEFORE reading §1:

1. **planner-completeness L4+L5 shipped on staging.**
   ```bash
   git fetch origin staging
   git log origin/staging --oneline --grep="planner-completeness" | head -5
   ```
   Expect ≥1 commit referencing L4 (decomposition heuristics) AND ≥1 commit referencing L5 (skill/agent assignment). If neither → STOP, this umbrella has no foundation.

2. **PR #205 (F.3) and #209 (helper fix) merged.**
   ```bash
   gh pr view 205 --json mergedAt,title 2>/dev/null
   gh pr view 209 --json mergedAt,title 2>/dev/null
   ```
   Both must return `mergedAt`. Confirms baseline includes F.3 + Item 10 keyword filter fix.

3. **F.3 follow-up substance audit verdict.** `docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-f3-substance-followup.md` exists and is CLEAN (no BLOCKER residual). If it has BLOCKER → fix that first, THIS umbrella later.

4. **Memory pulse-check** (not blocking, informational):
   - `project_meta_orchestrator_full_autonomous_umbrella` — G-rphase precedent.
   - `feedback_check_decided_status_before_recommending` — don't re-litigate full-Option-B (it's NOT in scope — see §8 anti-scope).

---

## §1 The mechanism — 3 sub-mechanisms

| Sub | What | Class | Stage |
|---|---|---|---|
| **B1 Bundle decision rule** | When meta-orchestrator decides «N classified items → ONE autonomous umbrella» vs «N separate dispatches». Eligibility filter: only L4-class `fix` (≤5 LOC, 1 file) + `I-phase-small` (≤80 LOC, 1 surface, Mode A). NEVER bundles `R-phase` / `I-phase-large` / items requiring depth-3 subagents. | R-phase first → rule design | 1+3 |
| **B2 Bundle approval UX** | Preview block format: list of items with classification + estimated cost + diff scope + dependencies (file overlap?). Maintainer single-touchpoint response: `GO` / `REMOVE-IDX 2,4` / `STOP`. NO auto-approval (T-BA-B). | R-phase first → UX design | 1+3 |
| **B3 Auto-dispatch loop** | Sequential Worker dispatch per L5 routing (Mode A inline default; Mode B worktree if L5 said so). Wait for green CI per item (poll `gh pr checks <N>` every 30s, timeout 5min). Auto-merge to staging per project policy. **Caps (proposal, R-phase confirms):** max bundle=5 items, max REVISE per item=3, blast-radius=halt after first CI red OR first DECISION-NEEDED. **Falsifier-rollback:** if >2 DEFER in one bundle OR staging breaks → revert to N+1 manual paste pattern, codify incident. | I-phase conditional | 3 |

**B1+B2+B3 = one cohesive flow:** B1 produces candidate list → B2 surfaces for approval → B3 executes approved subset autonomously.

---

## §2 Sub-wave decomposition (stage gates)

### Stage 1 — Prior-art survey for bundle/batch patterns (R-phase, $0, ~1-2h)

**Goal:** survey ≥3 production candidates per sub-mechanism (B1, B2, B3); verdict ADOPT/ADAPT/BUILD/REJECT each per BFR §3 + phase-research-coverage §1.

**Candidate pool (NOT exhaustive — T7 adversarial counter-prompt should extend):**

- **B1 bundle decision:**
  - Renovate `groupName: all-minor-patch` / `matchPackagePatterns:` — grouped dependency updates.
  - Dependabot `groups:` config — semantically related deps batched into one PR.
  - GitHub Actions `matrix:` job — parameterized parallel execution (related shape, different problem class — verify T16).
  - Bazel build batching / `--keep_going` semantics.
  - `just` recipe dependency groups.
  - **T16 verification mandatory:** does upstream «bundle» = «multiple UNRELATED atomic linear tasks» (our case) or only «related-domain updates» (Renovate/Dependabot case)?

- **B2 approval UX:**
  - Renovate PR preview comments + checkbox UI (web-based; we need chat-medium).
  - GitHub merge queue dialog.
  - `gh` interactive prompts pattern (`gh pr review --approve --comment`).
  - `argo submit --dry-run` preview output.
  - Cursor composer multi-step plan preview.
  - Cline `new_task` handoff with confirmation prompt.

- **B3 auto-dispatch loop:**
  - GHA workflow with `needs:` chain + `if: failure()` rollback handler.
  - Argo Workflows `onExit:` cleanup + retry policy + `Workflow.spec.parallelism`.
  - `just` recipe chains with `set -e` semantics.
  - LangGraph sequential agents with checkpoint + human-in-the-loop interrupt.
  - Anthropic «building effective agents» orchestrator-worker + evaluator-optimizer composition.
  - Superpowers `subagent-driven-development` (already SSOT #64, verify problem-class for batch case).

**Steps:**
1. For each candidate: DeepWiki + WebSearch (≥3 phrasings per phase-research-coverage §1.1-§1.5).
2. T16 problem-class verification **explicit per candidate** — «Upstream X: <problem class>. Our problem class: aggregation of unrelated linear items. Match? Evidence: …».
3. Write `docs/meta-factory/research-patches/2026-05-XX-bundle-autonomous-prior-art.md` (or `2026-05-XX-meta-orchestrator-bundle-prior-art.md`) with:
   - §1 — B1 candidates table (verdict + rationale + falsifier per candidate)
   - §2 — B2 candidates table
   - §3 — B3 candidates table
   - §4 — Cross-mechanism composition coherence (do B1+B2+B3 stack into one flow, or do they conflict?)
   - §5 — **Recommendation per sub-mechanism:** ADOPT / ADAPT / BUILD / REJECT / DEFER + SSOT row proposals per [prior-art-evaluations.md §3](../../../docs/meta-factory/prior-art-evaluations.md).
   - §6 — Stop-condition check: any sub-mechanism where ALL candidates surfaced are unsuitable (BUILD verdict) → escalate as «native build proposed; second-opinion needed before Stage 3 dispatch».

**Stage 1 → Stage 2 gate:**

```bash
ls docs/meta-factory/research-patches/2026-05-*-bundle-autonomous-prior-art.md \
  || ls docs/meta-factory/research-patches/2026-05-*-meta-orchestrator-bundle-prior-art.md
```

**Stop conditions Stage 1:**
- **F-S1-A** R-phase finds mature upstream covering 80%+ of B1+B2+B3 → re-scope to ADOPT/integration umbrella; drop BUILD path.
- **F-S1-B** R-phase finds ZERO candidates with verified problem-class match (T16 fails everywhere) → full native BUILD; escalate scope estimate before Stage 3.

### Stage 2 — Decision gate (no-build, maintainer touchpoint)

**Goal:** maintainer reviews Stage 1 R-phase verdict, decides GO / DEFER / DROP per sub-mechanism.

**GO criteria** (ALL required):
- B1+B2+B3 design coherent (Stage 1 §4 verdict positive).
- Implementation cost estimate ≤150k Opus.
- planner-completeness L4+L5 confirmed shipped (re-verify per §0 #1).
- No DECISION-NEEDED forks unresolved from R-phase.

**DEFER criteria** (any):
- R-phase surfaces upstream candidate but problem-class mismatch (T16 fails) — wait for re-evaluation of upstream evolution.
- Implementation cost >150k Opus — split into smaller umbrella.
- planner-completeness L4+L5 still in flight.

**DROP criteria** (any):
- All 3 sub-mechanisms find mature ADOPT'able upstream → convert to integration umbrella (separate scope, not BUILD).
- Maintainer determines N+1 manual paste pattern is fine — current cost ~5sec/paste, no real pain at current scale.

### Stage 3 — Implementation (conditional on Stage 2 GO, ~100-150k Opus)

**Pre-condition:** Stage 2 verdict = GO. Stage 3 does NOT start otherwise.

**Deliverables:**

1. **SKILL.md §X (new section, placed between §5 Dispatch tree and §6 Stage gates):** «Bundle direction». Binds:
   - B1 rule (eligibility filter + cost caps)
   - B2 UX (preview format + GO/REMOVE/STOP single-touchpoint)
   - B3 dispatch loop + falsifier-rollback
   - Caps as HARD limits: max bundle=5, max REVISE per item=3, halt-on-first-DECISION-NEEDED.
2. **`.claude/skills/meta-orchestrator/helpers/bundle-curate.sh`:** consumes L1 discovery (from planner-completeness) + L4 classification → applies B1 rule → emits B2 preview block. ~80-100 LOC bash, deterministic.
3. **`packages/core/principles/19-bundle-classification.test.ts`:** mechanical check that `bundle-curate.sh` classifies sample inputs correctly + paired-negative test (slot 19 assumed free at Stage 3 time — re-verify `ls packages/core/principles/`).
4. **Mirror sync** per round-2 MAJOR-1 lesson — every edit propagates to `skills/meta-orchestrator/` consumer mirror in the SAME commit.
5. **Quality-parity test umbrella (3 synthetic umbrellas, ~30k Opus each):** run B3 autonomous on 3 «obviously linear» backlogs, verify autonomous-run output ≡ baseline manual-paste output (same PR diffs, same test pass rate, same review feedback). Falsifier-gate before Stage 3 declares done.

**Stage 3 falsifier (binding):**
- If quality-parity test shows ≥1 of 3 autonomous runs produces qualitatively WORSE PR than manual-paste baseline → halt I-phase, surface to maintainer, codify lesson, DEFER.

---

## §3 AI-laziness traps active (per `.claude/rules/ai-laziness-traps.md §3`)

**Canonical traps active for this umbrella:**

- **T1** «sampled 3 clean, done» — R-phase MUST survey ≥3 candidates per sub-mechanism; first 2 clean ≠ done.
- **T3** «plausible without verification» — every B1/B2/B3 recommendation cites file:line OR command-output evidence, not generic prose.
- **T11** «build without prior-art» — B1 bundle-rule design is high-risk for premature-BUILD; R-phase mandatory before any rule sketch.
- **T12** «skip literature — I already know» — DeepWiki + WebSearch keywords «autonomous batch dispatch», «work queue grouping», «PR bundle approval UX», «multi-task agent orchestrator» — fetch fresh, NOT from training-data memory.
- **T13** «ADOPTED items zero-work» — if Renovate `groupName` adopted, verify upstream evidence for the pattern (open-source code or DeepWiki content, not just docs claim).
- **T15** «self-application skipped» — does `bundle-curate.sh` apply to ITSELF? If maintainer queues 5 «improve bundle-curate.sh» fix-class items, does meta-orchestrator handle that recursion correctly without infinite loop? Audit explicitly.
- **T16** «pattern-matching-on-name» — «Renovate has bundle therefore solves our problem» = trap. Renovate bundles same-class deps (semantic relationship); we bundle DIFFERENT-class atomic linear items (no semantic relationship). Different problem class even if name matches.
- **T19** «handoff without own cold-QA» — cold-review own diff before declaring done. CI ≠ design review.

**Domain-specific traps (T-BA family):**

- **T-BA-A** «bundle = more autonomous = more value». False. Quality may DROP on bundles >3 items (interleaved Worker failures cascade, debugging gets harder). Counter: B3 caps + falsifier-rollback are MANDATORY, not nice-to-have.
- **T-BA-B** «approval UX bypassable when items obviously linear». Tempted: auto-approve bundles where all items are clearly fix-class. Counter: B2 single-touchpoint is HARD requirement, not soft preference. Auto-approval = silent scope expansion + lost human-in-loop signal.
- **T-BA-C** «full Option B re-litigated through the back door». Tempted: design B3 such that it gradually subsumes non-linear umbrellas too. Counter: B1 eligibility filter is ENFORCED at code-level, not soft suggestion. `I-phase-large` and `R-phase` items NEVER bundle.

---

## §4 Recursive self-application

Bundle direction is itself a meta-orchestrator capability. Apply own discipline:

- Does meta-orchestrator's OWN backlog contain linear items this umbrella would bundle? YES — multiple `TODO-codify:` memory markers, F.2 MINOR observations carried as known-residuals, planner-completeness's own cold-review-fixes if any.
- **First autonomous run after Stage 3 ship MUST be on meta-orchestrator's own backlog** — eat your own dog food. Test umbrella #1 of Stage 3 #5.
- If first dog-food run produces >1 DEFER → falsifier-rollback fires, design has gap, DO NOT ship as default.
- Recursive-self-application gate per principle 12 — does this kickoff itself enumerate T-traps explicitly? Yes (§3).

---

## §5 §1.7 forward+backward checks (umbrella-level)

**Forward-check (compliance with existing disciplines):**

- **build-first-reuse-default.md §3** — R-phase Stage 1 MANDATORY before any B1/B2/B3 BUILD verdict. No BUILD without 6-item search check + ≥3 candidates per sub-mechanism.
- **no-paid-llm-in-ci.md §1** — B3 auto-dispatch invokes Worker subagents on operator's CC subscription, NOT API-billed. Zero paid-LLM cost.
- **reviewer-discipline.md §2** — Stage 2 decision-gate = MAINTAINER'S call (project strategy). Reviewer surfaces verdict, does NOT pick GO/DEFER/DROP.
- **ai-laziness-traps.md §3** — T-enumeration above (§3) is concrete with T-numbers, not blanket-reference.
- **doc-authority-hierarchy.md §2** — Stage 1 research-patch will carry Authoritative-for header.
- **dual-implementation-discipline.md §3** — new SKILL.md section in Stage 3 propagates to mirror at-commit-time (not afterthought).

**Backward-check (scope sweep — new rule applied to existing artefacts):**

- Bundle direction does NOT supersede DECOMPOSE direction (#205 + planner-completeness Stage 5). Both coexist as symmetric operations on work-granularity.
- Existing kickoffs do NOT need retroactive «is this bundle-able?» annotation — forward-going annotation only (per `dual-implementation-discipline.md §9` precedent).
- Quality-parity test umbrella (Stage 3 #5) IS the falsifier check — without it, this umbrella ships unsafe code. Mandatory gate.
- Existing `meta-orchestrator-linear-autonomous/kickoff.md` (stale, decision pending per planner-completeness §0 #4) — NOT superseded by this kickoff. Different scope: «linear-autonomous» was DECOMPOSE-within-one-umbrella (Option B narrow); this is COMBINE-across-backlog (new direction). Maintainer-owned decision whether to drop the stale file separately.

---

## §6 Stop conditions

- **§0 cold-start verification fails** (planner-completeness L4+L5 NOT shipped) → STOP, return «foundation not ready», queue this umbrella for later.
- **Stage 1 R-phase finds 80%+ ADOPT'able upstream** → re-scope to integration umbrella; drop BUILD path entirely.
- **Stage 2 maintainer DROP** → close umbrella, codify lesson «N+1 manual paste sufficient for current scale; bundle direction premature».
- **Stage 3 quality-parity test fails ≥1 of 3 umbrellas** → falsifier-rollback fires; do NOT ship as default; surface findings for redesign.
- **Any sub-wave spawns Worker with subagent recursion need** → STOP. This umbrella explicitly enforces depth=2 constraint via B1 eligibility filter; recursion is a design violation.

---

## §7 Done =

1. ✅ Stage 1 R-phase research-patch shipped: ≥3 candidates surveyed per B1/B2/B3, T16 verified per candidate, ADOPT/ADAPT/BUILD/REJECT verdict each.
2. ✅ Stage 2 maintainer decision logged (GO / DEFER / DROP) with rationale.
3. ✅ If GO: Stage 3 SKILL.md section + bundle-curate.sh + principle 19 test + mirror sync + 3-umbrella quality-parity test all green.
4. ✅ Memory codified: lesson on bundle-direction outcome (whatever it ends up being — DROP, DEFER, or shipped).
5. ✅ Stale `meta-orchestrator-linear-autonomous/kickoff.md` resolved separately (maintainer-owned) — NOT a blocker for this umbrella.

---

## §8 Anti-scope

- Does NOT re-litigate full Option B (auto-dispatch of NON-linear sub-waves with subagent recursion). That direction was rejected per F.3 kickoff line 297 «не вариант B». This umbrella is the NARROW «B only where task is linear» variant + COMBINE extension.
- Does NOT modify `~/.claude/skills/orchestrator/` (global skill, agent-uncommittable).
- Does NOT decompose this umbrella's stages autonomously into smaller bundles — sequential maintainer-driven Stage execution per current N+1 pattern.
- Does NOT extend B1 eligibility beyond L4 `fix` + `I-phase-small`. Any pressure to bundle `R-phase` or `I-phase-large` items = T-BA-C trap.

---

## §9 See also

- Parent F.3 kickoff: `.claude/orchestrator-prompts/meta-orchestrator-followup-audit/kickoff.md §1 lines 289-322` — autonomy deferred R-phase scope; this kickoff implements the narrow-linear half.
- Adjacent foundation: `.claude/orchestrator-prompts/meta-orchestrator-planner-completeness/kickoff.md` — provides L1 (discovery) + L4 (classifier) + L5 (dispatch routing); this kickoff CONSUMES its outputs.
- Stale neighbour: `.claude/orchestrator-prompts/meta-orchestrator-linear-autonomous/kickoff.md` — earlier draft, decision pending; NOT superseded by this kickoff (different scope direction).
- F.3 follow-up audit: `docs/meta-factory/research-patches/2026-05-25-meta-orchestrator-f3-substance-followup.md` — confirms #205 foundation clean for building on top.
- Memory: `feedback_no_human_verification_ai_self_verifies` (3-layer responsibility model), `feedback_git_fetch_staging_before_drafting` (Phase 0 sync discipline), `feedback_own_qa_before_handoff` (T19 cold-review own diff), `project_meta_orchestrator_full_autonomous_umbrella` (G-rphase precedent).
- Research-patches:
  - `2026-05-24-meta-orchestrator-ux-research.md` (F.1 — paste-format upstream survey)
  - `2026-05-24-meta-orchestrator-refactor-f3-scope.md` (G binding scope precedent — model for this kickoff's §1 table)
  - `2026-05-25-meta-orchestrator-f3-substance-followup.md` (most recent audit)
- Rules: `.claude/rules/build-first-reuse-default.md`, `.claude/rules/no-paid-llm-in-ci.md`, `.claude/rules/reviewer-discipline.md`, `.claude/rules/ai-laziness-traps.md`, `.claude/rules/doc-authority-hierarchy.md`, `.claude/rules/dual-implementation-discipline.md`, `.claude/rules/phase-research-coverage.md`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
