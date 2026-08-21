# Step 1A — Goal Clarity Dialogue — KICKOFF

> **Status:** ARMED 2026-05-13. Step 1A of the split «strategic-clarity» work (1A meta-philosophy dialogue → 1B swarm/tools research).
> **Type:** Dialogue session, NOT implementation. NOT Phase 10 audit. NOT autonomous decision-making.
> **Estimated effort:** 2-3 hours single sitting.
> **Output shape:** ONE research-patch + draft files in this kickoff's `drafts/` subdir for maintainer review. NO PR. NO autonomous SSOT/code/README edits.
> **Primary user:** maintainer (single operator), this is HIS goal-clarity session — AI surfaces options/evidence/tradeoffs, maintainer decides.
> **Predecessor:** [next-session-prioritization](../next-session-prioritization/kickoff.md) — D8 closure session 2026-05-13 (commit `1feb479`).
> **Successor (sequential):** [swarm-tools-research](../swarm-tools-research/kickoff.md) — Step 1B, runs AFTER 1A; uses 1A verdicts + drafts as foundational input.
> **Split rationale:** original strategic-clarity-dialogue (484 lines, 11 topics, 5-7 hours) was too large for single focused session — meta-philosophy + deep research cognitive switching is costly. Split into 1A (meta) + 1B (research) per maintainer 2026-05-13 confirmation.

---

## §1 Purpose

Single-sitting dialogue with maintainer to validate/finalize **project meta-decisions**:

1. **Project goal framing** — is current README «every codified rule fails CI on violation» misleadingly narrow? Multi-channel shift-left reality?
2. **Project's place in AIF ecosystem** — companion to aif-factory + aif-handoff focused on Living Documentation, OR standalone framework, OR hybrid?
3. **Operating philosophy codification** — «не переизобретать велосипед, максимально переиспользовать; что недостаёт — допиливаем сами» — formal rule + principle test + README mention?
4. **Build-vs-reuse decisions** for 5 specific operational-overlap items (project-level only; concrete swarm use-case goes to 1B)
5. **Wave 10 (AST hooks) confirmation** as CORE under revised framing
6. **README + CLAUDE.md + session-bootstrap.md goal-statement revision** draft for maintainer review

End-state: maintainer leaves session with clarity on each topic + atomic-commit roadmap for codification work + foundation for 1B (swarm-tools-research) to build on.

**Out of 1A scope (handed to 1B):**
- Concrete production spec analysis (semantic-dedup-contracts; lives in 1B `inputs/`)
- Tools deep-dive (Prometheus, Atlas, AI SLOP, AGENT.MD)
- Trigger conditions for full Phase 10 / Swarm-readiness (decided in 1B after concrete swarm research)

---

## §2 Read-first (Step 0 mandatory)

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order, then session-specific:

1. **[README.md#why-this-exists](../../../README.md)** — current goal statement (authoritative)
2. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — operational restatement of goal + invariants
3. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract + build-vs-reuse invariant
4. **Three memory entries** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
   - `project_scope_philosophy_companion_to_aif.md` — vision under reflection
   - `project_goal_framing_narrow_vs_broad.md` — narrow «fails CI» framing flag
   - `project_session_ordering_2026_05_13.md` — 4-session roadmap (note: now 5 sessions after split into 1A+1B)
5. **[.claude/orchestrator-prompts/research-tooling-evaluation/kickoff.md §10.1-§10.3](../research-tooling-evaluation/kickoff.md)** — empirical evidence pool (4 DeepWiki tests + SSOT attribution errors + aif-handoff full structure). **Load-bearing for §4.2-§4.5.**
6. **[docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md)** — current AIF integration framing (last verified 2026-05-08 via context7)
7. **[docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)** — SSOT especially entries #8, #27-#32 (AIF family — note attribution errors per memory)
8. **[.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)** — §4 anti-patterns, especially `#operational-doc-redefines-goal`
9. **[.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md)** — active traps for this session listed below in §7
10. **[.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md)** — §1.7 + 6-item checklist on negative-existence claims

**Read overviews (do NOT deep-read every line — high-level scan):**
- The 5 ready kickoffs in `.claude/orchestrator-prompts/` (Wave 10, Think-time, Research-tooling, AIF SSOT corrections, swarm-tools-research = your successor 1B)
- The «What's enforced» + «5-layer framework» sections of README

---

## §3 Background — what happened in 2026-05-13 prioritisation session

The maintainer's prior session (next-session-prioritization) covered:

- **D8 closure** — 5 wishful triggers resolved via commit `1feb479` (§13.1 closed empirically; §13.2 archived; §13.4/5/9 formalized with explicit `**Trigger:**` lines).
- **Priority survey Q1-Q5** — Phase 10 deferred; Wave 10 unblock recommended; Think-time §1.7 standalone; Danger JS variant C → swarm-readiness research; Memory long-tail as-you-go.
- **DeepWiki MCP adopted** — user-scope via `claude mcp add --scope user`. Tested empirically against `lee-to/ai-factory` + `lee-to/aif-handoff`.
- **Empirical findings** (research-tooling-evaluation kickoff §10):
  - `ai-factory`: 0/7 enforcement-discipline patterns (no principle tests, no AST hooks, no Stryker, no audit-ai-docs equivalent, no 5-layer, no §1.7, no Prior-art SSOT)
  - `aif-handoff`: 3/7 patterns (principle tests for own monorepo conventions; Stryker for own packages; branch-drift detection) — parallel-evolved but on DIFFERENT application surface (their monorepo vs our consumer enforcement)
  - `aif-handoff` is full TypeScript monorepo with 7 packages (`@aif/agent` Coordinator with Planner/Implementer/Reviewer subagents + Git Isolation + Watchdogs/Recovery; `@aif/runtime` RuntimeAdapter for Claude/Codex/OpenRouter/OpenCode; `@aif/mcp` MCP server for Task/Plan management; etc.)
  - SSOT entries #27-#30 have wrong-repo attribution (cite `ai-factory` paths that don't exist; actual artifacts live in `aif-handoff`)
- **Maintainer clarified vision** (load-bearing for THIS dialogue session):
  - Primary user = maintainer (single operator); one-button install of pre-configured opinionated discipline
  - Unique value-add = Living Documentation (audit-ai-docs.sh + paired-negative + 5-layer framework + recursive principle tests + AST hooks)
  - Operating principle: «не переизобретать велосипед — максимально переиспользовать готовые решения; что недостаёт — допиливаем сами»
  - Acceptable that project grew into addon/framework — but PRIMARY use-case remains one-button deploy для maintainer'а
  - **CI is the EXTREME UPPER CASE / LAST RESORT** — everything possible should be caught BEFORE CI, «maximally hot» (as early as possible in dev cycle). Current narrow «fails CI» framing inverts this priority.

---

## §4 Topics to discuss (in order)

### §4.1 Goal framing: narrow «fails CI» vs broad multi-channel shift-left

**Current README §Why-this-exists exit sentence:** «AI cannot silently bypass what fails CI.» Repeated identically in CLAUDE.md goal pointer + session-bootstrap.md (auto-injected at every prompt submit via `.claude/hooks/inject-session-bootstrap.sh`).

**The actual mechanism (per project's 5-layer framework + extensions):**

| Channel | Trigger | Catches | Hot/Cold |
|---|---|---|---|
| **ESLint flat config (Layer 1)** | Edit-time in IDE | R1-R20 violations on save | HOT (immediate) |
| **lint-staged pre-commit** | `git commit` | Staged ESLint + Prettier | HOT |
| **`.husky/pre-push`** | `git push` | TypeScript compile + vitest related + arch (dep-cruiser) + audit-ai-docs + Prior-art trailer + §1.7 substance | WARM |
| **GitHub Actions CI** | PR / push to main | Full lint + typecheck + arch + tests + Stryker mutation + discipline-self-check (§1.7) + audit-self | COLD (last resort) |
| **audit-ai-docs.sh** | Pre-push + CI | Drift between AI docs and code | WARM-to-COLD |
| **Stryker mutation testing** | CI on PR + nightly | Test-NOT-tautological proof | COLD |
| **Principle tests** | `npm test` anywhere | Recursive self-validation of framework conventions | HOT (locally) / COLD (CI) |

**Maintainer's stated priority (2026-05-13):** CI is upper-bound / extreme last resort. Goal = catch BEFORE CI maximally. Shift-left as operating principle.

**Questions to surface for maintainer decision:**

a) Is current narrow framing «fails CI» actively misleading? Or just incomplete?

b) Proposed revision (draft, NOT final — maintainer reviews):
> Goal: AI agents can't silently bypass undocumented conventions. Every rule that governs your codebase is an **executable artifact** — ESLint rule, pre-push check, principle test, mutation gate, drift probe, or Living Documentation assertion — that **fails when violated, at the earliest possible channel** (edit-time → pre-commit → pre-push → CI → production audit). **CI is the last-resort gate**, not the primary one. AI cannot silently bypass what fails at any of these channels.

c) If revision approved, three files must stay in sync:
- README.md §Why-this-exists
- CLAUDE.md goal pointer (mirror)
- .claude/session-bootstrap.md goal section (mirror, auto-injected by hook)
- All three must ship as ONE atomic «goal-framing alignment» commit per [doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) discipline.

d) Acknowledge `#operational-doc-redefines-goal` anti-pattern in self-inflicted form: README's own narrow operational summary occupies goal-position; session-bootstrap hook auto-injects narrow phrasing every prompt → self-reinforcing drift.

### §4.2 Project's place in AIF ecosystem

**Maintainer's stated intent:** companion to aif-factory + aif-handoff focused on Living Documentation. One-button deploy for maintainer's opinionated discipline.

**Empirical evidence supporting this:**
- aif-factory: 0/7 enforcement-discipline patterns. Doesn't compete; can complement.
- aif-handoff: 3/7 patterns BUT applied to their own monorepo, not consumer surface. Different application class. Doesn't compete; can complement.
- Our 5-layer framework + R1-R20 + Living Documentation + AST hooks (Wave 10) + methodology discipline = UNIQUE in ecosystem.

**Questions:**

a) README currently says (§«What this package gives you»): «Three sub-agents that AIF runs on /aif-verify» + «AI Factory templates» + «Forward compatibility note on AIF extensions». **Already framed as AIF extension** but bottom-of-page. Should this elevate to top-of-section positioning?

b) Proposed addition (draft):
> ### What this project is and isn't
> **Is:** companion to aif-factory + aif-handoff focused on Living Documentation enforcement (R1-R20 rules-as-tests, audit-ai-docs.sh drift detection, mutation testing, principle tests, 5-layer framework, methodology discipline). One-button install of pre-configured discipline.
> **Isn't:** workflow framework (use aif-factory); task orchestration (use aif-handoff); standalone CI tool.
> **Reuse stance:** see `.claude/rules/build-first-reuse-default.md`. Default = adopt upstream. Build ourselves only what's structurally missing (currently: Living Documentation + 5-layer + methodology + AST hooks).

c) Does this positioning preserve the project's goal while clarifying its scope?

### §4.3 Operating philosophy codification («build-first, reuse-default»)

**Maintainer's exact words (2026-05-13):** «не переизобретать велосипед — максимально переиспользовать готовые решения! если есть то что уже работает лучше меня берем это — если там чего то не хватает — дописываем сами!»

**Already partially in CLAUDE.md** as build-vs-reuse invariant — but applied PER-COMMIT, not as project-wide operating philosophy.

**Proposed codification (drafts to be produced THIS session for maintainer review):**

a) **New rule file:** `.claude/rules/build-first-reuse-default.md` (draft below in §6.1)

b) **New principle test:** `packages/core/principles/10-build-first-reuse-default.test.ts` (design sketch below in §6.2; real implementation requires careful think-through; may DEFER to its own atomic commit)

c) **README mention** integrated into §4.2 proposed «What this project is and isn't» block.

**Questions:**
- Rule body content acceptable? (See draft §6.1)
- Principle test scope — what concretely is mechanically detectable? (See sketch §6.2)
- Should rule promote to executable principle test now, or stay prose-only with promotion threshold (e.g. «promotion to principle test when 3 violations in 6 months»)?

### §4.4 Build-vs-reuse decisions for 5 operational-overlap items

For each item — produce ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-AS-IS / BUILD-OURSELVES verdict with rationale. Maintainer confirms each.

| # | Our component | aif-handoff equivalent | Proposed verdict (for maintainer review) | Rationale |
|---|---|---|---|---|
| 1 | `.claude/skills/orchestrator/` Mode A/B | aif-handoff Subagents-mode vs Skills-mode dichotomy | **ADOPT VOCABULARY** | Convergent design; vocab alignment reduces cross-project drift; mechanism stays ours thin-wrapper |
| 2 | `.claude/rules/parallel-subwave-isolation.md` | `@aif/agent` Git Isolation (section 5.3) | **REFERENCE** | Rule body adds «реализация по @aif/agent Git Isolation pattern». Rule = meta-discipline (ours); production implementation references upstream |
| 3 | Planned swarm-readiness research session | `@aif/agent` Coordinator + Watchdogs + Recovery | **DEFER + DELEGATE-TO-1B** | Concrete swarm decision happens in 1B (swarm-tools-research) with concrete spec input. 1A only confirms project-level principle: «adopt upstream by default for hypothetical swarm work». |
| 4 | `agents/*.md` AI-agnostic sub-agent prompts | `@aif/runtime` RuntimeAdapter (Claude SDK/CLI/API + Codex + OpenRouter + OpenCode) | **KEEP NARROW + REFERENCE** | Our scope narrower (markdown prompt files read by active session). Their RuntimeAdapter = full runtime abstraction. Reference as parallel mature evolution if we ever need to broaden |
| 5 | Wave/Phase orchestration prompts (`.claude/orchestrator-prompts/`) | aif-handoff kanban + state machine | **KEEP MANUAL** | Single-maintainer scale; kanban overkill; manual prompt orchestration is honestly enough |

**Question to surface:** are all 5 verdicts acceptable to maintainer? Any to flip?

**Item #3 split note:** project-level «DEFER» means don't pre-build swarm infra. **Concrete swarm decision for production spec** happens in 1B — that's where empirical research per maintainer's prompt occurs. 1A only confirms the principle; 1B applies it concretely.

### §4.5 Wave 10 (AST hooks) confirmation as CORE

**Context:** Wave 10 = migrate `.husky/pre-push` (449 lines bash) + `audit-ai-docs.sh` (311 lines bash) → TypeScript with AST parsing + Stryker mutation coverage.

**Evidence Wave 10 is CORE under revised framing:**
- aif-handoff uses bash/husky + lint-staged (per DeepWiki query 2026-05-13) — does NOT have AST-based hooks
- ai-factory has bash-based security scanner (per DeepWiki) — does NOT have AST hooks either
- This is uniquely OURS — direct «build-ourselves what's missing» case per §4.3 principle
- Wave 10 directly supports «shift-left» discipline — pre-push catches violations BEFORE CI, mutation-tested predicates eliminate false-positives

**Question:** confirm Wave 10 stays as planned, full speed, NO scope creep into «should aif-handoff replace this». Output of this dialogue should explicitly say «Wave 10 = CORE, proceed».

### §4.6 README + CLAUDE.md + session-bootstrap.md revision

Three files share narrow «fails CI» phrasing (verified). All three must update atomically.

**Drafts to produce THIS session (in this kickoff's drafts/ subdirectory):**

a) `drafts/README-why-this-exists-revised.md` — revised §Why-this-exists + added §«What this project is and isn't»
b) `drafts/CLAUDE-md-goal-pointer-revised.md` — revised goal pointer (mirror of README)
c) `drafts/session-bootstrap-md-goal-section-revised.md` — revised goal section
d) `drafts/atomic-commit-message.md` — single commit message covering all three

**Maintainer reviews drafts, decides if/when to ship as atomic commit.** AI does NOT auto-commit these.

### §4.7 Apply revised framing to existing kickoffs

After §4.1-§4.6 verdicts:
- **Research-tooling-evaluation kickoff §10.1-§10.3** — note that AIF SSOT corrections discussion in §10.2 still valid; no edit needed
- **AIF SSOT corrections kickoff** — still valid; pure paper work, no scope change
- **Wave 10 kickoff** — note §4.5 verdict «CORE» confirmation; no scope change
- **Think-time §1.7 kickoff** — no scope change; runs independently
- **swarm-tools-research kickoff (your 1B successor)** — confirm 1A verdicts will be its inputs; no body edits needed (it already references them)
- **next-session-prioritization** — historical; closed by D8 commit

**No edits to existing kickoffs needed** unless §4.4 verdict 3 = cancel swarm-readiness (which now becomes 1B itself with concrete spec — so 1A keeps DEFER stance, 1B applies it).

### §4.8 Memory entries finalization

Three memory entries written 2026-05-13 in «under-consideration» status:
- `project_scope_philosophy_companion_to_aif.md`
- `project_goal_framing_narrow_vs_broad.md`
- `project_session_ordering_2026_05_13.md`

After this dialogue:
- If revisions APPROVED → update memory entries to «finalized / awaiting codification commit» status
- If revisions REJECTED / DIFFERENT → rewrite memory entries to reflect actual maintainer-confirmed framing
- If DEFER → leave as-is, note dialogue outcome in entry body

**This is maintainer-owned decision class** per [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md) — but memory is operator-level not project-level, so AI can update with maintainer's verbal confirmation.

---

## §5 Hard constraints (anti-deliverables)

- **NO autonomous decisions.** Every option finalized by maintainer's explicit confirmation. AI surfaces + proposes + asks.
- **NO file edits beyond:** (a) research-patch in `docs/meta-factory/research-patches/2026-MM-DD-goal-clarity-dialogue.md`; (b) draft files in this kickoff's `drafts/` subdirectory (gitignored).
- **NO PR** — output is research-patch + drafts for maintainer review. Atomic commits happen LATER, in separate sessions or by maintainer.
- **NO scope expansion** beyond §4.1-§4.8 topics. If new tension surfaces — flag as observation in research-patch, do NOT pursue.
- **NO Phase 10 launch.** This is light-touch dialogue, NOT 4-6-week foundations audit.
- **NO commit beyond research-patch.** And that only if maintainer explicitly approves.
- **NO editing of README/CLAUDE.md/session-bootstrap.md/`.claude/rules/*`/`packages/core/principles/*`/`prior-art-evaluations.md`** during dialogue — these are maintainer-owned per Artifact Ownership Contract.
- **NO editing of existing kickoffs.** No retrofit of §4.1-§4.6 verdicts into Wave 10/Think-time/Research-tooling kickoffs — they're standing artifacts.
- **NO swarm-readiness kickoff creation** — swarm-tools-research is your 1B successor, already exists.
- **NO concrete spec analysis** — that's 1B scope. If maintainer raises spec-specific question mid-1A → record as «for 1B», don't research here.
- **NO tools deep-dive** (Prometheus, Atlas, AI SLOP, AGENT.MD) — also 1B scope.
- **NO triggers research** for full Phase 10 / Swarm-readiness — 1B closes that.

---

## §6 Drafts to produce in this session (gitignored)

All drafts go to `.claude/orchestrator-prompts/goal-clarity-dialogue/drafts/` directory:

### §6.1 `drafts/build-first-reuse-default-rule.md`

Skeleton structure for the new `.claude/rules/build-first-reuse-default.md`:

```markdown
# Build-first, reuse-default — operating philosophy

> Authoritative for: project's macro-level scope discipline; relationship to upstream tools/frameworks.
> NOT authoritative for: per-commit build-vs-reuse — see CLAUDE.md «Build-vs-reuse invariant» (Phase 8.8).

## §1 The principle

Every capability proposed for this project = ONE of:
- **ADOPT** — use upstream tool/pattern verbatim
- **ADOPT VOCABULARY** — use upstream naming; thin-wrapper implementation
- **ADAPT** — upstream pattern + modifications for our problem class
- **REFERENCE** — rule body cites upstream as implementation precedent; ours stays meta-discipline
- **KEEP NARROW** — our scope narrower than upstream's; upstream noted as parallel evolution
- **BUILD** — write ourselves (= no upstream / fundamentally misfit / load-bearing problem-class gap)
- **REJECT** — upstream candidate surfaced + explicitly unsuitable

Default = ADOPT or REFERENCE. BUILD only when documented problem-class mismatch or load-bearing gap.

## §2 Why

Primary user = single maintainer; single-domain project. Maintenance budget = single person.
Each BUILT-ourselves capability = perpetual maintenance cost. ADOPT/REFERENCE = upstream maintained by others.

## §3 Mechanism (already partially in place)

[1] Prior-art SSOT trailer required on capability commits (`.husky/pre-push` enforces)
[2] phase-research-coverage.md §1 6-item checklist on negative-existence claims
[3] context7 ≥3 phrasings before any «I propose to build X»
[4] DeepWiki `ask_question` for architectural understanding (added 2026-05-13)
[5] SSOT consult for prior verdicts (prior-art-evaluations.md)
[6] This rule (NEW) — macro-level operating philosophy across scope decisions

## §4 Anti-patterns

- `#parallel-evolution-creep` — building parallel to existing production tool because per-commit decisions never composed at scope level
- `#own-stack-blind-spot` — companion to ai-laziness-traps.md T-rule; macro form
- `#adoption-shame` — refusing to adopt because «we can do it our way» (vanity ≠ technical reason)
- `#integration-overhead-overestimate` — assuming adoption costs more than build, without measuring

## §5 Retirement / promotion

Promotion to executable test: when 3+ commits in 6 months violate. Retirement: never — foundational.

## See also
[full cross-references]
```

### §6.2 `drafts/principle-10-build-first-reuse-default-sketch.md`

Design sketch (NOT implementation) for `packages/core/principles/10-build-first-reuse-default.test.ts`:

```typescript
// SKETCH — real implementation requires careful design + research
//
// Validates: every shipped capability has SSOT entry OR escape-hatch rationale
//
// Mechanism candidate (need design pass):
// 1. Define «capability» mechanically:
//    - new file under packages/core/<dir>/ with ≥50 LOC
//    - new file in .claude/rules/* or .claude/skills/*/SKILL.md
//    - new file in agents/*.md
// 2. For each capability, require:
//    - SSOT entry referencing it (ADOPT/ADAPT/BUILD verdict)
//    - OR: escape-hatch rationale in commit Prior-art trailer
// 3. Scan: find all qualifying files; for each — check prior-art-evaluations.md has matching entry by name+verdict
// 4. Fail if: capability exists w/o SSOT entry AND w/o documented prior-art trailer
//
// Open design questions for separate session:
// - How does test handle pre-existing capabilities created before this principle?
// - What's the «match» criterion between file and SSOT entry?
// - Does it run on every test, or only on new file detection?
```

**NOTE:** §6.2 is sketch only. Real implementation = separate atomic commit after careful design. This dialogue session produces sketch for maintainer's review of whether principle-test approach is viable.

### §6.3 `drafts/README-why-this-exists-revised.md`

Revised text for README.md §Why-this-exists. Use proposed framing from §4.1.b + §4.2.b. Three subsections:
- Goal (broadened multi-channel)
- Methodology (recursive self-application elevated from «quality signal» to «implemented core»)
- What must not break (invariants — unchanged)
- What this project is and isn't (NEW subsection)

### §6.4 `drafts/CLAUDE-md-goal-pointer-revised.md`

Mirror revision for CLAUDE.md «Project goal pointer» section. Same broadening as §6.3.

### §6.5 `drafts/session-bootstrap-md-goal-section-revised.md`

Mirror revision for `.claude/session-bootstrap.md` Goal section. Same broadening + note that hook auto-injection will use this phrasing.

### §6.6 `drafts/atomic-commit-plan.md`

Sequencing plan for codification work after dialogue:

1. **Commit 1:** README + CLAUDE.md + session-bootstrap.md goal-framing alignment (atomic, three files)
2. **Commit 2:** New `.claude/rules/build-first-reuse-default.md` rule file
3. **Commit 3:** New `packages/core/principles/10-build-first-reuse-default.test.ts` IF maintainer approves principle-test path (otherwise DEFER as separate research session)
4. **Commit 4:** AIF SSOT corrections per `aif-ssot-corrections/kickoff.md` (separate paper-work session as already kicked-off; possibly absorbed by research-tooling R-phase)
5. **(Future)** Wave 10 R-phase launch as core continuation

Each commit needs §1.7 sections in PR body per discipline-self-check.yml gate.

---

## §7 AI laziness traps active for this session

Per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) — kickoff author obligations satisfied via this enumeration:

**Active canonical traps:**

- **T1** (sampling floor=5) — N/A for dialogue session
- **T2** («my methodology would catch theatre, so I don't need to run it») — designing the dialogue ≠ having it. Actually run §4.1-§4.8 conversation; don't propose «here's the framework, maintainer fill in».
- **T3** (plausible-looking findings without verification) — every claim in research-patch needs file:line citation OR `INCONCLUSIVE-needs-human` marker
- **T4** (closing R-phase prematurely) — dialogue closure requires §4.1-§4.8 all reached + research-patch + drafts. Don't close mid-topic.
- **T5** (implementation findings into research phase) — NO source-file edits during dialogue. All edits = research-patch + drafts in this kickoff's directory only.
- **T7** (following prompt literally instead of reasoning adversarially) — for each §4.x topic, ask «what's MISSING from maintainer's framing?» before generating «here's my proposal».
- **T8** (asking maintainer to avoid doing work) — surface proposed verdicts with rationale FIRST; ask for confirmation; don't dump open questions back at maintainer.
- **T11** (designing without prior art) — for §4.3 build-first-reuse-default codification, check what existing projects do for «macro-level scope discipline». ≥3 context7 + ≥3 DeepWiki phrasings.
- **T12** (skipping literature sweep because «I already know») — confirmed bias-zone: «I know aif-factory/aif-handoff from prior session». Re-verify any specific claim with current MCP queries.
- **T13** (treating ADOPTED items as zero-work) — aif-factory + aif-handoff verdicts from prior-art-evaluations.md still need verification at problem-class boundary (T16).
- **T14** (clean audit = no theatre) — if §4.x dialogue produces «we're already doing the right thing» — that's fine IF verified, BUT distinguish from «I didn't probe deep enough».
- **T15** (self-application MANDATORY) — this session is itself a build-vs-reuse exercise (deciding scope of the build-first-reuse-default rule). Apply own discipline to own discipline-design. Surface in research-patch §self-application.
- **T16** (pattern-matching-on-name) — for §4.4 each of 5 items, verify problem-class match before applying verdict.

**Domain-specific traps for this session:**

- **T-GC-A «strategic clarity = decisions»** — tempting to declare verdicts as «clarity achieved». Counter: clarity = options articulated + tradeoffs surfaced + maintainer-informed; decisions = explicit maintainer confirmation per topic. Research-patch records both states distinctly.
- **T-GC-B «codification urgency»** — narrow framing identified in 3 docs simultaneously feels urgent-to-fix. Counter: revision is structural change; deserves careful drafting and review window; AI does NOT auto-commit revisions in this session.
- **T-GC-C «framework-vs-companion as binary»** — false dichotomy «narrow companion vs broad framework». Reality is hybrid scope with specific component-level verdicts (per §4.4). Don't collapse to single Option A/B/C.
- **T-GC-D «vision-drift inheritance»** — maintainer's evolving vision in dialogue is NOT yet README. Future sessions may treat this kickoff or memory entries as authoritative. Counter: research-patch must explicitly state «maintainer-stated intent under reflection; README authoritative until revised».
- **T-GC-E «session-bootstrap-hook self-reinforcement»** — auto-injected narrow phrasing reinforces narrow framing in this very session. Counter: explicitly note this in research-patch §findings.
- **T-GC-F «1B-scope leak»** — tempting to pull concrete spec analysis / tools deep-dive / triggers into 1A («we're already here»). Counter: those are 1B scope explicitly. If raised mid-1A → record as «for 1B», don't research here. Drive-by scope expansion violates split discipline.

---

## §8 Output requirements

### §8.1 Research-patch (mandatory)

`docs/meta-factory/research-patches/2026-MM-DD-goal-clarity-dialogue.md` — required sections:

- **§1 Session purpose + maintainer-stated framing recap**
- **§2 Background** — pointer to prior session artifacts (prioritization, research-tooling §10, etc.); no re-narrate
- **§3 Goal-framing analysis** — narrow vs broad evidence; multi-channel enforcement table (per §4.1); maintainer's verdict
- **§4 Ecosystem positioning** — companion-vs-standalone analysis; maintainer's verdict
- **§5 Operating philosophy codification** — build-first-reuse-default rule draft; principle test design status; maintainer's verdict
- **§6 5-item build-vs-reuse decisions** — per-item verdict + rationale; maintainer-confirmed; **note item 3 deferred to 1B with concrete spec**
- **§7 Wave 10 confirmation** — CORE status verdict
- **§8 Drafts produced** — list of `drafts/*` files
- **§9 Atomic commit roadmap** — sequencing per §6.6
- **§10 Self-application** — did this dialogue itself apply the build-first-reuse-default principle? What about the goal-framing revision?
- **§11 1B handoff** — what 1A produces that 1B needs as input (verdicts, drafts, principles)
- **§12 §1.7 forward+backward check** with file:line citations

### §8.2 Drafts (mandatory if §4 verdicts approve revisions)

In `.claude/orchestrator-prompts/goal-clarity-dialogue/drafts/`:
- `build-first-reuse-default-rule.md` (per §6.1)
- `principle-10-build-first-reuse-default-sketch.md` (per §6.2)
- `README-why-this-exists-revised.md` (per §6.3)
- `CLAUDE-md-goal-pointer-revised.md` (per §6.4)
- `session-bootstrap-md-goal-section-revised.md` (per §6.5)
- `atomic-commit-plan.md` (per §6.6)

### §8.3 Memory updates (mandatory)

After dialogue closes, update `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
- `project_scope_philosophy_companion_to_aif.md` — status: «finalized / awaiting codification» if approved; rewrite if different verdict; mark «closed (rejected)» if rejected
- `project_goal_framing_narrow_vs_broad.md` — same status update
- `project_session_ordering_2026_05_13.md` — note 1A completion; 1B is next session in queue

---

## §9 What this session does NOT do

- Does NOT edit README.md, CLAUDE.md, session-bootstrap.md, `.claude/rules/*`, `packages/core/principles/*`, `prior-art-evaluations.md` — even draft text lives in this kickoff's `drafts/` directory, NOT in target files
- Does NOT open PR
- Does NOT auto-commit anything except optionally the research-patch (if maintainer explicitly approves)
- Does NOT launch Phase 10 audit
- Does NOT start Wave 10 R-phase (separate kickoff)
- Does NOT execute AIF SSOT corrections (separate kickoff)
- Does NOT create new SSOT entries
- Does NOT change any existing kickoffs (Wave 10, Think-time, Research-tooling, AIF SSOT corrections, swarm-tools-research)
- Does NOT trigger DeepWiki indexing of new repos beyond what's already done
- Does NOT install any MCP servers
- **Does NOT analyze concrete production spec** (semantic-dedup-contracts — that's 1B in `../swarm-tools-research/inputs/spec-semantic-dedup-contracts.md`)
- **Does NOT do tools deep-dive** (Prometheus, Atlas, AI SLOP, AGENT.MD — all 1B scope)
- **Does NOT decide triggers** for full Phase 10 / Swarm-readiness (1B closes those)

---

## §10 Project context for fresh AI / cold-start

You are starting a session in `/Users/art/code/rules-as-tests-aif` working directory. Project is single-maintainer (Art, email yhooi2011@gmail.com), single-domain. Project ships «rules-as-tests-aif» framework — AIF extension/companion focused on Living Documentation + multi-layer enforcement + research methodology.

Today's date: 2026-05-14 or later (kickoff written 2026-05-13).

**Important environmental facts:**
- DeepWiki MCP installed user-scope; available in this session as `mcp__deepwiki__*` tools
- Context7 MCP available as `mcp__context7__*`
- Claude Code currently on v2.1.98 (downgraded from v2.1.114 2026-05-13 due to token-inflation bug per GitHub issue #46917). Verify via `claude --version`; if shows 2.1.100+ — flag in research-patch
- Working directory has clean main branch after 2026-05-13 commits

**Sessions ready to launch (do NOT launch them; this is 1A):**
- 1B: `swarm-tools-research/kickoff.md` — your successor (depends on 1A output)
- Wave 10 hook architecture R-phase
- Think-time §1.7 research
- Research-tooling evaluation R-phase
- AIF SSOT corrections

**Recent commits (per git log main):**
- `1feb479` docs(open-questions): D8 resolution
- Earlier Wave 9 closure commits

---

## §11 Final note to the AI running this

This is a **DIALOGUE session, NOT implementation**. Your role:

1. **Surface** — empirical evidence, options, tradeoffs per topic in §4.1-§4.8
2. **Propose** — concrete verdicts with rationale (not open-ended questions)
3. **Ask** — for maintainer confirmation per topic; don't auto-decide
4. **Document** — research-patch + drafts in `drafts/` directory
5. **Handoff** — research-patch §11 must explicitly enumerate what 1B (swarm-tools-research) needs as input

You do NOT:
- Decide goal, scope, operating philosophy on behalf of maintainer
- Edit README, CLAUDE.md, session-bootstrap.md, rules, principles, SSOT
- Ship anything beyond research-patch + drafts
- Launch follow-up sessions (including 1B — maintainer triggers)
- Analyze concrete production spec / tools deep-dive / triggers — all 1B scope

Your closing message should be:
- Summary of maintainer-confirmed verdicts per §4 topic
- List of draft files produced
- Atomic commit sequencing per §6.6
- Memory entry update status
- 1B handoff state: «1B can launch when maintainer wants; here's what 1A produces that 1B uses»

After this dialogue closes, maintainer reviews drafts at their pace and decides when to ship atomic commits AND when to launch 1B. AI sessions don't auto-execute codification.

**Most important constraint:** dialogue MAY conclude with «defer / no revision». That's a valid outcome. If maintainer reaches «I want to think more» mid-dialogue — pause cleanly, write research-patch with «pending maintainer reflection» status, save drafts in incomplete state, exit. Don't push toward forced closure.

---

## §12 See also

- [.claude/orchestrator-prompts/next-session-prioritization/kickoff.md](../next-session-prioritization/kickoff.md) — prior session that produced D8 closure + this 1A kickoff via dialogue
- **[.claude/orchestrator-prompts/swarm-tools-research/kickoff.md](../swarm-tools-research/kickoff.md)** — **1B successor session** — depends on 1A output
- [.claude/orchestrator-prompts/research-tooling-evaluation/kickoff.md](../research-tooling-evaluation/kickoff.md) — §10.1-§10.3 empirical evidence pool
- [.claude/orchestrator-prompts/aif-ssot-corrections/kickoff.md](../aif-ssot-corrections/kickoff.md) — paper-work session for SSOT attribution fixes (separate)
- [.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md) — Wave 10 = CORE per §4.5
- [docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md) — 2026-05-08 AIF integration framing; may need update post-dialogue
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT (attribution errors per AIF SSOT corrections kickoff)
- Memory entries at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
  - `project_scope_philosophy_companion_to_aif.md`
  - `project_goal_framing_narrow_vs_broad.md`
  - `project_session_ordering_2026_05_13.md`
  - `MEMORY.md` (index)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
