# Strategic Clarity Dialogue — KICKOFF

> **transient artifact** — oversized orchestration design doc; exempt from the 600-line markdown gate (cross-session-kickoff-portability, SSOT #116).

> **Status:** ARMED 2026-05-13.
> **Type:** Dialogue session, NOT implementation. NOT Phase 10 audit. NOT autonomous decision-making.
> **Estimated effort:** 2-4 hours single sitting.
> **Output shape:** ONE research-patch + optional draft files in this kickoff's directory for maintainer review. NO PR. NO autonomous SSOT/code/README edits.
> **Primary user:** maintainer (single operator), this is HIS strategic clarity session — AI surfaces options/evidence/tradeoffs, maintainer decides.

---

## §1 Purpose

Single-sitting dialogue with maintainer to validate/finalize:

1. **Project goal framing** — is current README «every codified rule fails CI on violation» misleadingly narrow? Multi-channel shift-left reality?
2. **Project's place in AIF ecosystem** — companion to aif-factory + aif-handoff focused on Living Documentation, OR standalone framework, OR hybrid?
3. **Operating philosophy codification** — «не переизобретать велосипед, максимально переиспользовать; что недостаёт — допиливаем сами» — formal rule + principle test + README mention?
4. **Build-vs-reuse decisions** for 5 specific operational-overlap items
5. **Wave 10 (AST hooks) confirmation** as CORE under revised framing
6. **README + CLAUDE.md + session-bootstrap.md goal-statement revision** draft for maintainer review

End-state: maintainer leaves session with clarity on each topic + atomic-commit roadmap for codification work.

---

## §2 Read-first (Step 0 mandatory)

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order, then session-specific:

1. **[README.md#why-this-exists](../../../README.md)** — current goal statement (authoritative)
2. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — operational restatement of goal + invariants
3. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract + build-vs-reuse invariant
4. **Two memory entries** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
   - `project_scope_philosophy_companion_to_aif.md` — vision under reflection
   - `project_goal_framing_narrow_vs_broad.md` — narrow «fails CI» framing flag
5. **[.claude/orchestrator-prompts/research-tooling-evaluation/kickoff.md §10.1-§10.3](../research-tooling-evaluation/kickoff.md)** — empirical evidence pool (4 DeepWiki tests + SSOT attribution errors + aif-handoff full structure)
6. **[docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md)** — current AIF integration framing (last verified 2026-05-08 via context7)
7. **[docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)** — SSOT especially entries #8, #27-#32 (AIF family — note attribution errors per memory)
8. **[.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)** — §4 anti-patterns, especially `#operational-doc-redefines-goal`
9. **[.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md)** — active traps for this session listed below in §7
10. **[.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md)** — §1.7 + 6-item checklist on negative-existence claims

**Read overviews (do NOT deep-read every line — high-level scan):**
- The 5 ready kickoffs in `.claude/orchestrator-prompts/` (Wave 10, Think-time, Research-tooling, AIF SSOT corrections, original next-session-prioritization)
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
| 3 | Planned swarm-readiness research session | `@aif/agent` Coordinator + Watchdogs + Recovery | **DEFER + ADOPT-WHEN-NEEDED** | Don't pre-build. When swarm need actually fires — adopt `@aif/agent` Coordinator pattern. Until then armed §13.x entry, no parallel implementation |
| 4 | `agents/*.md` AI-agnostic sub-agent prompts | `@aif/runtime` RuntimeAdapter (Claude SDK/CLI/API + Codex + OpenRouter + OpenCode) | **KEEP NARROW + REFERENCE** | Our scope narrower (markdown prompt files read by active session). Their RuntimeAdapter = full runtime abstraction. Reference as parallel mature evolution if we ever need to broaden |
| 5 | Wave/Phase orchestration prompts (`.claude/orchestrator-prompts/`) | aif-handoff kanban + state machine | **KEEP MANUAL** | Single-maintainer scale; kanban overkill; manual prompt orchestration is honestly enough |

**Question to surface:** are all 5 verdicts acceptable to maintainer? Any to flip?

**Subordinate decision:** if verdict 3 (DEFER swarm-readiness) approved → CANCEL the unbuild swarm-readiness research kickoff from priority queue. Save the slot.

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
- **next-session-prioritization** — historical; closed by D8 commit

**No edits to existing kickoffs needed** unless §4.4 verdict 3 = cancel swarm-readiness (which is currently NOT in priority queue as kickoff anyway).

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

### §4.9 Concrete production spec analysis (folded swarm-readiness research)

> **Origin:** maintainer 2026-05-13 asked to add concrete spec evaluation to dialogue. Previously swarm-readiness was «DEFER + ADOPT-when-needed». Now there IS concrete spec → trigger fires → analysis in scope of this dialogue.

**Input spec:** `.claude/orchestrator-prompts/strategic-clarity-dialogue/inputs/spec-semantic-dedup-contracts.md` (gitignored).

**About the spec (out-of-band note):**
- For DIFFERENT project — `creation_contra_servise` (Python/FastAPI/LangGraph at `/home/legion/Документы/RSHB_DEV/`), NOT rules-as-tests-aif
- Production feature: «semantic deduplication for contract generation»
- 19 tasks + 4 final review tasks; 4 execution waves; explicit parallel/sequential dependencies
- Each task has: agent profile (quick/deep/unspecified-high/oracle), files-to-modify, QA scenarios, evidence paths, commit message
- Spec ALREADY in swarm-friendly format (aif-handoff-style) — maintainer's question = «is this approach right, and what should execute it»

**Maintainer's full analysis prompt (verbatim, embedded for dialogue session to use):**

```text
Используй Devin Wiki MCP и Context7 для исследования. Изучи всё — спеку,
оба подхода к роям, AIF репозитории, кодовую базу.

Ответь на главный вопрос:
> Что лучше всего подходит для нашего проекта — рой без AIF, AIF Handoff,
> или их комбинация? Что и как именно использовать, учитывая нашу спеку,
> стек и то что уже реализовано?

При анализе обязательно оцени:
- Насколько наша текущая спека готова к автономному выполнению роем
- Что в ней нужно изменить или добавить
- Где рой без AIF выигрывает, где AIF выигрывает
- Конкретный рекомендуемый процесс для этого проекта шаг за шагом

Никакого общего advice. Только конкретно под наш стек и наш проект.
```

**Three approaches to compare:**

1. **Custom swarm (without AIF)** — one model plans (waves/agents/parallelism/states/deps), critic+advisors polish plan, executor agent runs autonomously with strict quality rules in AGENT.MD (Google Style Guide docstrings, real coverage, no AI fluff). Parallel agents work independently per plan tasks.

2. **AIF Handoff** — autonomous kanban backlog→planning→implementing→review→done with specialized coordinator+subagent pattern (`@aif/agent` Planner/Implementer/Reviewer + sidecars), worktrees, self-healing, two modes (Subagents quality vs Skills speed). Built on AI Factory.

3. **Combination** — e.g. custom-spec format + AIF Handoff execution; OR AIF Handoff planning + custom executor.

**Analysis dimensions:**

a) **Spec readiness for autonomous swarm execution** — does the current 19-task spec format have everything an autonomous executor needs? Gaps?
b) **What spec format changes might be needed** for AIF Handoff consumption (annotations, frontmatter, dependency syntax)
c) **Where each approach wins:**
- Custom: bespoke planning depth, no infra cost, full control
- AIF Handoff: production-tested pipeline, watchdogs/recovery, multi-runtime adapter, kanban UI for observability
d) **Concrete recommended process** for this specific spec + stack (Python/FastAPI/LangGraph + 4-wave execution) — step-by-step

**Methodology (mandatory):**

- **DeepWiki ask_question** on `lee-to/aif-handoff` for: «how would I submit this 19-task spec to AIF Handoff? does it support waved parallel execution with explicit task dependencies? does AGENTS.md-style quality rules ride along?»
- **DeepWiki ask_question** on `lee-to/ai-factory` for: «`/ai-factory.feature --parallel` execution path for multi-task feature; does it accept pre-decomposed plan or does its own decomposition?»
- **Context7 query-docs** `/lee-to/aif-handoff` for spec ingestion patterns + plan format + worker dispatch
- **Cross-check** with our SSOT entries #27-#32 (note attribution errors per [research-tooling-evaluation/kickoff.md §10.2](../research-tooling-evaluation/kickoff.md))
- **Examine spec file** at `.claude/orchestrator-prompts/strategic-clarity-dialogue/inputs/spec-semantic-dedup-contracts.md` — full read, understand task graph

**Out-of-scope for this dialogue:**
- Implementing the spec (that's for the other project's session, not here)
- Editing the spec (it's input, not artifact)
- Deciding on AGENTS.MD content for that other project (separate concern)
- Building bridge tooling between our project and `creation_contra_servise`

**In-scope:**
- Answering the maintainer's main question with concrete-not-general rationale
- Producing recommendation: which approach + step-by-step for THIS spec + stack
- Identifying spec-format changes needed (if any) for chosen approach
- Build-vs-reuse verdict for swarm execution layer (which absorbs earlier strategic-clarity §4.4 verdict 3 «swarm-readiness DEFER»)

**Estimated added effort:** +1-2 hours to dialogue session (now 4-6 hours total vs 2-4 hours original). If maintainer prefers — option to SEPARATE into own session `spec-execution-evaluation/kickoff.md`; surface this choice early in dialogue.

### §4.10 Tools & Concepts Deep Dive (research mission 2)

> **Origin:** maintainer 2026-05-13 added research mission covering specific tools (Prometheus, Atlas) + concepts (AI SLOP in docstrings, AGENT.MD quality rules) that inform the swarm-execution decision in §4.9. Tools/concepts understanding precedes approach decision; mission verifies actual tools, finds analogs if names don't resolve.

**Methodology:** DeepWiki MCP + Context7 MCP search. No presumptions about names — verify empirically.

#### §4.10.1 Prometheus (planner role)

Research questions (verify each with citation):
- What is Prometheus in agentic-systems context? (verify name resolves to specific tool, OR identify what maintainer's «Prometheus» pattern refers to — could be custom name or known framework)
- How does Prometheus generate plan for swarm: input shape, output shape, format
- Plan structure: fields, format
- Plan polishing flow: critic (Momus) + advisors — how this works
- What makes plan «good» per Prometheus criteria — conditions for «ready-to-execute» state

**If «Prometheus» doesn't resolve to specific named tool:** find analog patterns (e.g. LangGraph planner nodes, AutoGen group chat planner, OpenAI Assistants planning) and explain what was found. Don't fabricate Prometheus tool that doesn't exist.

#### §4.10.2 Atlas (executor role)

Research questions:
- What is Atlas, how does it work
- How Atlas reads + interprets Prometheus plan
- How it manages parallel agents by waves
- Error handling: detect → fix → continue cycle
- What it needs from plan to work autonomously for 3+ hours without human
- Stop conditions vs continue conditions

**Same disclaimer:** if «Atlas» doesn't resolve to a specific named tool — find analogs (e.g. AIF Handoff `@aif/agent` Coordinator, AutoGen executor agents, smol-developer-style autonomous executor) and explain.

#### §4.10.3 Prometheus + Atlas inside AIF Handoff

Research questions on `lee-to/aif-handoff`:
- At what stage of pipeline (backlog → planning → implementing → review → done) Prometheus would operate? At what stage Atlas?
- Do they REPLACE AIF Handoff's built-in agents or work alongside?
- Can Prometheus plug in as `plan-coordinator` polisher in AIF?
- Can Atlas be used as worker inside AIF Handoff (e.g. as Implementer subagent)?
- Or do they compete with AIF and decision is one-or-other?

**Use DeepWiki ask_question** specifically: «How extensible is the @aif/agent pipeline? Can custom planner/executor be inserted via subagent extension points or runtime adapter?»

#### §4.10.4 AI SLOP in docstrings — what it is + how to avoid

Research on Google Style Guide (<https://google.github.io/styleguide/pyguide.html>) + real examples.

Specific to explain:
- What «AI SLOP» means in code documentation — what a garbage docstring written by default agent looks like (concrete example, not abstract)
- What a normal docstring looks like — real example for Python function
- Mandatory fields: args, returns, raises, examples — template
- How to verify docstring isn't SLOP: concrete criteria (length isn't enough; what specifics signal real vs theatre)

Output: side-by-side bad-vs-good docstring + bullet list of «SLOP signals».

#### §4.10.5 AGENT.MD quality rules

Research questions:
- What is AGENT.MD, how do agents (Claude Code, AIF workers) read it
- Which rules actually impact code quality (vs decorative)
- Concrete docstring rules: phrasing that agent CAN'T ignore or fake (anti-SLOP enforcement at instruction level, not just review level)
- Other rules: commits, testing, code review
- Ready-to-use AGENT.MD template with these rules

Reference our existing precedents:
- `AGENTS.md` in this project's root (per SSOT #7 ADOPT-VOCABULARY)
- `CLAUDE.md` (Artifact Ownership Contract section, build-vs-reuse invariant)
- Our R1-R20 enforcement layer

#### §4.10.6 Output requirements

This research mission contributes to research-patch sections:
- §3.5 «Prometheus: what it is + how it works»
- §3.6 «Atlas: what it is + how it works»
- §3.7 «Prometheus + Atlas inside AIF Handoff: where + how (or compete)»
- §3.8 «AI SLOP vs normal docstring: examples + criteria»
- §3.9 «Ready-to-use AGENT.MD template»

**Inputs to §4.9 spec-analysis verdict:** §4.10 findings inform §4.9 «which approach» — if Prometheus/Atlas resolve to real tools that fit our stack, they become candidates alongside «custom swarm» and «AIF Handoff»; if they don't resolve, §4.9 stays 3-way comparison.

**Citation requirement:** every claim about a tool/pattern must cite source URL (DeepWiki wiki page, Context7 source URL, official docs). NO claims «from training data» without verification per T12 (skipping literature sweep because «I already know»).

#### §4.10.7 Effort estimate

Additional +1-2 hours to strategic-clarity dialogue (now 5-7 hours total vs 4-6 hours after §4.9 added). If maintainer prefers — option to SEPARATE §4.10 into own kickoff `tools-concepts-research/kickoff.md`; surface this choice early in dialogue alongside §4.9 split option.

### §4.11 Trigger conditions for Swarm-readiness + Phase 10 (full sessions, if needed)

> **Origin:** maintainer 2026-05-13 asked «когда проводить» Swarm-readiness и Phase 10 foundations. Resolution: each has explicit trigger after this dialogue closes.

**Swarm-readiness research (full session, ARMED conditional):**
- **Trigger:** §4.9 dialogue concludes with verdict that requires deeper research beyond what this dialogue covers (e.g. «pick AIF Handoff as runtime BUT need integration spike to verify problem-class match for our stack»)
- **OR Trigger:** second concrete spec arrives at maintainer's hand requiring swarm execution, and §4.9 outcome doesn't generalize
- **OR Trigger:** maintainer attempts swarm execution per §4.9 recommendation and surfaces 3+ friction incidents
- **Until trigger fires:** §4.9 dialogue output is sufficient; no separate session

**Phase 10 foundations audit (full 4-6-week R-phase, ARMED conditional):**
- **Trigger:** strategic-clarity dialogue (§4.1-§4.9) leaves a load-bearing foundations gap NOT addressable by lightweight dialogue
- **Specific surfaces NOT covered by this dialogue** (would trigger Phase 10 sub-stream):
  - A2 mechanism choices for individual R1-R20 rules (this dialogue covers macro positioning, not per-rule re-evaluation)
  - A5 external tooling evaluation across whole stack (this dialogue covers AIF-family only, not Stryker/ESLint/Vitest re-eval)
  - A6 documentation artefacts deep audit (this dialogue produces drafts for 3 docs; A6 would audit all docs)
- **Until trigger fires:** strategic-clarity output is sufficient; Phase 10 stays ARMED in `docs/meta-factory/open-questions.md §13.32`

**Dialogue session's job re: §4.11:** at close, EXPLICITLY record «Phase 10 still ARMED with trigger conditions [X]; Swarm-readiness ABSORBED into §4.9 verdict; OR re-armed with trigger [Y]». Future sessions read this state to know whether to launch.

---

## §5 Hard constraints (anti-deliverables)

- **NO autonomous decisions.** Every option finalized by maintainer's explicit confirmation. AI surfaces + proposes + asks.
- **NO file edits beyond:** (a) research-patch in `docs/meta-factory/research-patches/2026-MM-DD-strategic-clarity-dialogue.md`; (b) draft files in this kickoff's `drafts/` subdirectory (gitignored).
- **NO PR** — output is research-patch + drafts for maintainer review. Atomic commits happen LATER, in separate sessions or by maintainer.
- **NO scope expansion** beyond §4.1-§4.8 topics. If new tension surfaces — flag as observation in research-patch, do NOT pursue.
- **NO Phase 10 launch.** This is light-touch dialogue, NOT 4-6-week foundations audit.
- **NO commit beyond research-patch.** And that only if maintainer explicitly approves.
- **NO editing of README/CLAUDE.md/session-bootstrap.md/`.claude/rules/*`/`packages/core/principles/*`/`prior-art-evaluations.md`** during dialogue — these are maintainer-owned per Artifact Ownership Contract.
- **NO editing of existing kickoffs.** No retrofit of §4.1-§4.6 verdicts into Wave 10/Think-time/Research-tooling kickoffs — they're standing artifacts.
- **NO swarm-readiness kickoff creation** — even if verdict #3 changes. Defer.

---

## §6 Drafts to produce in this session (gitignored)

All drafts go to `.claude/orchestrator-prompts/strategic-clarity-dialogue/drafts/` directory:

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
4. **Commit 4:** AIF SSOT corrections per `aif-ssot-corrections/kickoff.md` (separate paper-work session as already kicked-off)
5. **(Future)** Wave 10 R-phase launch as core continuation

Each commit needs §1.7 sections in PR body per discipline-self-check.yml gate.

---

## §7 AI laziness traps active for this session

Per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md) — kickoff author obligations satisfied via this enumeration:

**Active canonical traps:**

- **T1** (sampling floor=5) — N/A for dialogue session
- **T2** («my methodology would catch theatre, so I don't need to run it») — designing the dialogue ≠ having it. Actually run §4.1-§4.7 conversation; don't propose «here's the framework, maintainer fill in».
- **T3** (plausible-looking findings without verification) — every claim in research-patch needs file:line citation OR `INCONCLUSIVE-needs-human` marker
- **T4** (closing R-phase prematurely) — dialogue closure requires §4.1-§4.7 all reached + research-patch + drafts. Don't close mid-topic.
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

- **T-SC-A «strategic clarity = decisions»** — tempting to declare verdicts as «clarity achieved». Counter: clarity = options articulated + tradeoffs surfaced + maintainer-informed; decisions = explicit maintainer confirmation per topic. Research-patch records both states distinctly.
- **T-SC-B «codification urgency»** — narrow framing identified in 3 docs simultaneously feels urgent-to-fix. Counter: revision is structural change; deserves careful drafting and review window; AI does NOT auto-commit revisions in this session.
- **T-SC-C «framework-vs-companion as binary»** — false dichotomy «narrow companion vs broad framework». Reality is hybrid scope with specific component-level verdicts (per §4.4). Don't collapse to single Option A/B/C.
- **T-SC-D «vision-drift inheritance»** — maintainer's evolving vision in dialogue is NOT yet README. Future sessions may treat this kickoff or memory entries as authoritative. Counter: research-patch must explicitly state «maintainer-stated intent under reflection; README authoritative until revised».
- **T-SC-E «session-bootstrap-hook self-reinforcement»** — auto-injected narrow phrasing reinforces narrow framing in this very session. Counter: explicitly note this in research-patch §findings.

---

## §8 Output requirements

### §8.1 Research-patch (mandatory)

`docs/meta-factory/research-patches/2026-MM-DD-strategic-clarity-dialogue.md` — required sections:

- **§1 Session purpose + maintainer-stated framing recap**
- **§2 Background** — pointer to prior session artifacts (prioritization, research-tooling §10, etc.); no re-narrate
- **§3 Goal-framing analysis** — narrow vs broad evidence; multi-channel enforcement table (per §4.1); maintainer's verdict
- **§4 Ecosystem positioning** — companion-vs-standalone analysis; maintainer's verdict
- **§5 Operating philosophy codification** — build-first-reuse-default rule draft; principle test design status; maintainer's verdict
- **§6 5-item build-vs-reuse decisions** — per-item verdict + rationale; maintainer-confirmed
- **§7 Wave 10 confirmation** — CORE status verdict
- **§8 Drafts produced** — list of `drafts/*` files
- **§9 Atomic commit roadmap** — sequencing per §6.6
- **§10 Self-application** — did this dialogue itself apply the build-first-reuse-default principle? What about the goal-framing revision?
- **§11 §1.7 forward+backward check** with file:line citations

### §8.2 Drafts (mandatory if §4 verdicts approve revisions)

In `.claude/orchestrator-prompts/strategic-clarity-dialogue/drafts/`:
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

---

## §9 What this session does NOT do

- Does NOT edit README.md, CLAUDE.md, session-bootstrap.md, `.claude/rules/*`, `packages/core/principles/*`, `prior-art-evaluations.md` — even draft text lives in this kickoff's `drafts/` directory, NOT in target files
- Does NOT open PR
- Does NOT auto-commit anything except optionally the research-patch (if maintainer explicitly approves)
- Does NOT launch Phase 10 audit
- Does NOT start Wave 10 R-phase (separate kickoff)
- Does NOT execute AIF SSOT corrections (separate kickoff)
- Does NOT create new SSOT entries
- Does NOT change any existing kickoffs (Wave 10, Think-time, Research-tooling, AIF SSOT corrections)
- Does NOT trigger DeepWiki indexing of new repos beyond what's already done
- Does NOT install any MCP servers
- Does NOT do swarm-readiness research (verdict 3 cancels that kickoff anyway)

---

## §10 Project context for fresh AI / cold-start

You are starting a session in `/Users/art/code/rules-as-tests-aif` working directory. Project is single-maintainer (Art, email <yhooi2011@gmail.com>), single-domain. Project ships «rules-as-tests-aif» framework — AIF extension/companion focused on Living Documentation + multi-layer enforcement + research methodology.

Today's date: 2026-05-14 or later (kickoff written 2026-05-13).

**Important environmental facts:**
- DeepWiki MCP installed user-scope; available in this session as `mcp__deepwiki__*` tools
- Context7 MCP available as `mcp__context7__*`
- Claude Code currently on v2.1.114 (token-inflation-bug version) — maintainer may have downgraded to v2.1.98 before launching this session; if `claude --version` shows 2.1.100+ — flag in research-patch
- Working directory has clean main branch after 2026-05-13 commits

**Sessions ready to launch (do NOT launch them; this is the strategic clarity session):**
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

1. **Surface** — empirical evidence, options, tradeoffs per topic in §4
2. **Propose** — concrete verdicts with rationale (not open-ended questions)
3. **Ask** — for maintainer confirmation per topic; don't auto-decide
4. **Document** — research-patch + drafts in `drafts/` directory

You do NOT:
- Decide goal, scope, operating philosophy on behalf of maintainer
- Edit README, CLAUDE.md, session-bootstrap.md, rules, principles, SSOT
- Ship anything beyond research-patch + drafts
- Launch follow-up sessions

Your closing message should be:
- Summary of maintainer-confirmed verdicts per §4 topic
- List of draft files produced
- Atomic commit sequencing per §6.6
- Memory entry update status

After this dialogue closes, maintainer reviews drafts at their pace and decides when to ship atomic commits. AI sessions don't auto-execute codification.

**Most important constraint:** dialogue MAY conclude with «defer / no revision». That's a valid outcome. If maintainer reaches «I want to think more» mid-dialogue — pause cleanly, write research-patch with «pending maintainer reflection» status, save drafts in incomplete state, exit. Don't push toward forced closure.

---

## §12 See also

- [.claude/orchestrator-prompts/next-session-prioritization/kickoff.md](../next-session-prioritization/kickoff.md) — prior session that produced D8 closure + this kickoff via dialogue
- [.claude/orchestrator-prompts/research-tooling-evaluation/kickoff.md](../research-tooling-evaluation/kickoff.md) — §10.1-§10.3 empirical evidence pool
- [.claude/orchestrator-prompts/aif-ssot-corrections/kickoff.md](../aif-ssot-corrections/kickoff.md) — paper-work session for SSOT attribution fixes (separate)
- [.claude/orchestrator-prompts/wave-10-hook-architecture/kickoff.md](../wave-10-hook-architecture/kickoff.md) — Wave 10 = CORE per §4.5
- [docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md) — 2026-05-08 AIF integration framing; may need update post-dialogue
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT (attribution errors per AIF SSOT corrections kickoff)
- Memory entries at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
  - `project_scope_philosophy_companion_to_aif.md`
  - `project_goal_framing_narrow_vs_broad.md`
  - `MEMORY.md` (index)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
