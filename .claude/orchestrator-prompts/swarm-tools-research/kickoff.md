# Step 1B — Swarm + Tools Research — KICKOFF

> **Status:** COMPLETED 2026-05-21 — research-patch + AGENT.md.template shipped (patch committed `e5f9c0b`). **SCOPE CORRECTED 2026-05-21** (see banner below). Originally ARMED 2026-05-13. Step 1B of the split «strategic-clarity» work (1A meta-philosophy dialogue → 1B swarm/tools research).
> **Type:** RESEARCH session (NOT dialogue, NOT а implementation). Deep DeepWiki + Context7 + WebSearch + Claude Docs work.
> **Estimated effort:** 3-4 hours single sitting.
> **Output shape:** ONE research-patch with swarm/agent И**tools deep-dive** + **AGENT.MD template** + **anti-SLOP docstring discipline** + triggers update. NO PR. NO code edits. NO SSOT edits beyond marking ARMED states.
> **Primary user:** maintainer (single operator), this is HIS research session — AI runs queries, surfaces findings, proposes recommendations, maintainer decides whether to follow them.
> **Predecessor (mandatory):** [goal-clarity-dialogue](../goal-clarity-dialogue/kickoff.md) — Step 1A. Must complete 1A first; 1A's research-patch + drafts are 1B's foundation.

---

> ## ⚠ SCOPE CORRECTION — 2026-05-21 (read before anything else)
>
> **This kickoff was originally mis-scoped.** Its first version made «concrete execution approach for the 19-task `semantic-dedup-contracts` spec» the headline question 1, and the research faithfully produced a full spec-execution recommendation (custom-swarm vs aif-handoff vs hybrid, approach ranking, spec-defect analysis, spec-format amendments). **That was the wrong task.** It was caught at review of the resulting research-patch on 2026-05-21.
>
> **Where the error entered:** the maintainer's own verbatim research prompt (preserved in §3 below, now marked SUPERSEDED) said «учитывая нашу спеку… насколько наша спека готова к автономному выполнению роем». «Учитывая нашу спеку» was _intended_ as «use the spec as a documentation/reference example», but read as «build an execution plan for these 19 tasks». A document-vs-document review can't catch a corrupted source — only confirming intent with the maintainer surfaced it (a live «documents lie; tests don't» instance).
>
> **The CORRECTED task (maintainer-confirmed 2026-05-21):**
>
> 1. **Swarm/agent tools deep-dive** — what are Prometheus (planner) and Atlas (executor) really; where do they sit relative to AIF Handoff; what ecosystem/Anthropic-infra tooling (superpowers, Agent SDK credit, subagent model selection, skills-for-subagents, community collections) is available to ADOPT/REFERENCE rather than build.
> 2. **AI-SLOP + AGENT.MD docstring discipline** — what AI SLOP in docstrings is and how to prevent it; an evidence-based, anti-laziness AGENT.MD template.
> 3. **Trigger conditions** — when a full Phase 10 foundations audit or full Swarm-readiness session should launch beyond 1A+1B.
>
> **The `semantic-dedup-contracts` spec is INPUT ONLY as a documentation EXAMPLE** — a sample to illustrate good-vs-bad docstrings and to ground the AGENT.MD template against a real-shaped artifact. It is **NOT** an object to plan, decompose, defect-analyse, or choose an executor for. There is **no «which runtime executes the spec» question** in this session.
>
> **DROPPED from the original scope** (do not produce): spec-execution approach comparison, spec defect/dependency analysis, executor recommendation + ranking, spec-format amendments, `spec-amended.md`. If the spec ever needs executing, that is a separate, properly-scoped session.
>
> Sections below have been rewritten to this corrected scope. The original §3 verbatim prompt is kept verbatim for historical record, marked SUPERSEDED.

---

## §1 Purpose

Single-sitting research session to answer 3 concrete questions (corrected scope):

1. **Swarm/agent tools deep-dive** — what are Prometheus (planner) and Atlas (executor) really? Where do they fit (in/alongside AIF Handoff)? What ecosystem + Anthropic-native infrastructure (superpowers, Agent SDK credit, subagent model selection, skills-for-subagents, community subagent/skill collections) is available to **reuse** under build-first-reuse-default?
2. **AI-SLOP + AGENT.MD discipline** — what is AI SLOP in docstrings + how to prevent it? What is an effective, evidence-based AGENT.MD template that resists AI laziness?
3. **Trigger conditions** — under what conditions should a full Phase 10 foundations audit or a full Swarm-readiness research session launch (beyond what 1A+1B cover)?

End-state: maintainer leaves session with:

- Tools (Prometheus/Atlas + ecosystem) understood with citations OR analogs identified, each with a build-first-reuse-default verdict candidate (ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT)
- AGENT.MD template ready-to-use (anti-SLOP, evidence-grounded, with maintainer-decision placeholders)
- AI-SLOP-vs-normal-docstring criteria with side-by-side examples + the mechanical-detection boundary (what a linter can/can't catch)
- Phase 10 / Swarm-readiness explicit trigger conditions recorded for future re-arming

**Out of 1B scope (handled elsewhere):**

- Project meta-decisions (goal framing, positioning, philosophy codification) — 1A's job, done before 1B
- **Any execution plan / approach / runtime choice for the `semantic-dedup-contracts` spec** — NOT a question this session answers (see scope-correction banner)
- Implementing or editing the spec — it is a read-only documentation example
- Editing AGENT.MD in any target project — output is a template, maintainer applies
- Creating SSOT entries — research-tooling R-phase owns that (this session may _flag_ a candidate gap)

---

## §2 Read-first (Step 0 mandatory)

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order, then session-specific:

1. **[README.md#why-this-exists](../../../README.md)** — current goal statement (authoritative).
2. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — operational restatement
3. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract + build-vs-reuse invariant

4. **1A research-patch** at `docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md` — **MANDATORY**. Goal-framing + positioning verdicts; build-first-reuse-default principle; 5 build-vs-reuse decisions; Wave 10 CORE.
5. **1A drafts** at `.claude/orchestrator-prompts/goal-clarity-dialogue/drafts/` — especially `build-first-reuse-default-rule.md` and `README-why-this-exists-revised.md`.
6. **Memory entries** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`: `project_scope_philosophy_companion_to_aif.md`, `project_goal_framing_narrow_vs_broad.md`, `project_session_ordering_2026_05_13.md`.
7. **[research-tooling-evaluation/kickoff.md §10.1-§10.3](../research-tooling-evaluation/kickoff.md)** — empirical evidence pool (4 DeepWiki tests + SSOT attribution + aif-handoff structure).
8. **[docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md)** — SSOT.
9. **[.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md)** — §1.7 + 6-item checklist on negative-existence claims.
10. **[.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md)** — active traps listed in §7.
11. **[.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md)** — the verdict typology (ADOPT / ADOPT VOCABULARY / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT) every tool finding must carry.

**Input — documentation EXAMPLE only:**

- **[`inputs/spec-semantic-dedup-contracts.md`](inputs/spec-semantic-dedup-contracts.md)** — a sanitized sample spec from a different project. **Use ONLY as a real-shaped document to illustrate docstring quality and ground the AGENT.MD template.** Do NOT analyse its task graph, dependencies, or execution readiness; do NOT recommend an executor for it. Extract docstring/structural illustration only. Confidentiality rules in §5 still apply.

---

## §3 Background — what happened 2026-05-13

The maintainer's prior session (next-session-prioritization) covered:

- **D8 closure** — 5 wishful triggers resolved (commit `1feb479`)
- **DeepWiki MCP adopted** — user-scope; tested empirically against AIF repos
- **Empirical findings** (research-tooling-evaluation kickoff §10): `ai-factory` 0/7 enforcement patterns; `aif-handoff` 3/7 on its own monorepo; aif-handoff is a 7-package TS monorepo (`@aif/agent`, `@aif/runtime`, `@aif/mcp`, `@aif/web`); SSOT #27-#30 attribution errors.

**Maintainer's vision (per 1A):** companion to aif-factory + aif-handoff focused on Living Documentation; «build-first-reuse-default» (codified in 1A); Wave 10 (AST hooks) = CORE.

**Maintainer's research prompt (verbatim — `SUPERSEDED 2026-05-21`, kept for historical record):**

> ⚠ **SUPERSEDED.** The phrase «учитывая нашу спеку… насколько наша спека готова к автономному выполнению роем» below is exactly what drove the original mis-scope. It read as «plan the spec's execution»; the intent was «spec as a documentation example». Do NOT execute against this prompt — follow the corrected §1 instead. Preserved verbatim because rewriting a historical quote would falsify the record (per [doc-authority-hierarchy.md §4 `#frozen-doc-still-edited`](../../rules/doc-authority-hierarchy.md)).

```
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

**Corrected intent (governs this session):** the «оба подхода к роям / AIF репозитории» part = tools deep-dive (§4.1.1-§4.1.3 — _understand_ Prometheus/Atlas/aif-handoff, do not pick a runtime for the spec). The «спеку» part = a docstring/AGENT.MD example, not an execution target. «Никакого общего advice» still holds: tool findings and the AGENT.MD template must be concrete and citation-backed, not generic.

---

## §4 Research topics (in order)

### §4.1 Tools deep-dive

> **Why:** understand the swarm/agent tooling landscape so the maintainer knows what exists to **reuse** (build-first-reuse-default) and so the AGENT.MD template is grounded in production practice. This is _understanding + reuse-verdicts_, NOT selecting a runtime to execute any spec.

**Research toolset (all 5 are first-class — use the right one per question shape):**

1. **Claude Docs (PRIMARY for Claude Code / Anthropic ecosystem)** — `https://docs.claude.com/en/docs/claude-code/`, `https://docs.anthropic.com/`. Authoritative for Claude Code capabilities, skills, subagents, hooks, MCPs, settings, Agent SDK, pricing, model behaviors. Access via **WebFetch**. Official docs OUTRANK community/tipster info.
2. **DeepWiki MCP** (`mcp__deepwiki__*`) — for **named GitHub repos**: architecture, internals, tradeoffs (e.g. `lee-to/aif-handoff`, `code-yeongyu/oh-my-openagent`).
3. **Context7 MCP** (`mcp__context7__*`) — for **named npm packages / framework docs**: API, current usage patterns.
4. **WebSearch** — for **general patterns, community knowledge, comparisons** not bound to a specific repo/library.
5. **WebFetch** — for **specific known URLs**: official docs, style guides, GitHub issues, blog articles.

**When to use what:** Claude-Code-feature question → Claude Docs first; specific-repo question → DeepWiki ask_question; library API → Context7 query-docs; general pattern → WebSearch; known URL → WebFetch.

**No presumptions about names — verify empirically.** Vague WebSearch results = a finding, NOT a license to fabricate.

#### §4.1.1 Prometheus (planner role)

Research questions (verify each with citation):

- What is Prometheus in agentic-systems context? (verify name resolves to a specific tool, OR identify what the maintainer's «Prometheus» refers to)
- How does it generate a plan: input/output shape, plan structure, fields, format
- Plan-polishing flow (critic + advisors); conditions for «ready-to-execute» state *(i.e. the planner tool's own plan-completion criterion — NOT the input spec's execution-readiness, which is explicitly out of scope per the banner)*

**Approach:** WebSearch first («Prometheus agentic systems planner», «Prometheus swarm orchestration», «Prometheus Momus critic»); if a specific repo surfaces → DeepWiki/Context7 on it; if concept-not-tool → WebFetch relevant docs.
**If it doesn't resolve to a named tool:** find analogs (LangGraph planner nodes, AutoGen planner) and say so. Do not fabricate.

#### §4.1.2 Atlas (executor role)

Research questions: what Atlas is + how it works; how it reads/interprets a Prometheus plan; wave-based parallel agent management; error handling (detect→fix→continue); autonomy/stop conditions.
**Approach:** same as §4.1.1. If unresolved → analogs (aif-handoff `@aif/agent` Coordinator, AutoGen executor) and say so.

#### §4.1.3 Prometheus + Atlas relative to AIF Handoff

Research on `lee-to/aif-handoff`: at what pipeline stage (backlog → planning → implementing → review → done) would a Prometheus-style planner / Atlas-style executor sit? Do they replace AIF's built-in agents or complement them? Are there extension points (plan ingestion, runtime adapter, subagent insertion)?
**Use DeepWiki ask_question** (≥5 phrasings for any negative-existence claim, T1): «how extensible is the @aif/agent pipeline? can a custom planner/executor plug in via subagent extension points or runtime adapter?»

> Scope note: this is _understanding the landscape_ (do these complement or compete), NOT «pick one to run the spec». No spec execution choice is in scope.

#### §4.1.4 AI SLOP in docstrings — what it is + how to avoid

> **Note:** maintainer raised this for **research + dialogue**, not as predetermined requirements. Produce DRAFT observations to present for confirmation/rejection/modification.

Research starting points (verify each empirically):

- **What «AI SLOP» means in code documentation** — WebSearch real examples («AI generated docstring quality», «llm code documentation problems»), WebFetch notable articles. Candidate signals to verify (not decided): generic summaries on non-trivial functions; `Args:` restating type hints; missing edge cases in `Returns:`; trivial/empty `Examples:`.
- **Normal docstring examples** from real production codebases (Anthropic SDK, LangChain, Django, FastAPI) — DeepWiki ask_question on the repos; WebFetch specific files via raw URLs.
- **Mandatory vs recommended fields** per Google Style Guide — WebFetch the style-guide pages directly. Don't presume Python-style covers all languages.
- **Mechanical-detection boundary** — WebSearch + Context7 on linters (`/astral-sh/ruff` D/DOC rules, eslint-plugin-jsdoc). Establish explicitly **what a linter can enforce (structure) vs cannot (semantic slop)** — load-bearing for the enforcement-layer choice and for `no-paid-llm-in-ci`.
- **Use the input spec as an illustration source** — pull a representative function signature from `inputs/spec-...md` (sanitized) to show a bad-vs-good docstring pair. This is the spec's ONLY role.

**Output:** findings with citations; 2-3 alternative strictness scopes (strict/moderate/minimal); side-by-side bad-vs-good. Present as DRAFT for dialogue.

#### §4.1.5 AGENT.MD quality rules

> **Note:** research + candidate phrasings TO BRING to maintainer dialogue, NOT pre-decided. Final template content decided in dialogue.

Research questions: what AGENT.MD/AGENTS.md is + how agents (Claude Code, AIF workers) read it; which rules in production AGENT.MDs actually impact code quality vs decorative; how production templates phrase docstring enforcement, reference style guides (single URL vs per-language), and word anti-SLOP rules; what other rules (commits, testing, review) appear. Cite production examples (search «AGENTS.md examples 2026», «AGENTS.md spec Linux Foundation»; WebFetch real raw files; DeepWiki on complex repos).

**Maintainer discussion topics (bring to dialogue, don't decide unilaterally):**

1. **Docstring strictness** — strict (every function, blocks commit) vs moderate (public API required, helpers optional) vs minimal. Present production patterns + alternatives.
2. **Google Style Guide URL scope** — root (multi-language portability) vs language-specific (concrete enforcement). Present both; maintainer decides.
3. **Anti-SLOP phrasing** — whether maintainer's candidate «полное покрытие детализированное без AI SLOP» actually constrains behavior; whether a _negated_ «no slop» framing risks priming the failure mode; alternative positive-framed phrasings with citations.
4. **Anti-SLOP signals — embed or separate file?** Inline bullets vs `anti-slop-checklist.md` vs lint rules vs sample bad-vs-good per language.
5. **Self-verification language** — «re-read your docstring before commit» instruction vs hook-enforced lint (ruff D / eslint jsdoc). Which is more reliable empirically.

**Output:** findings per topic with citations; 2-3 candidate phrasings where applicable; honest tradeoffs; DRAFT template skeleton with PLACEHOLDERS where maintainer decides:

```
## Docstring rules
Strictness: [STRICT | MODERATE | MINIMAL] — maintainer chooses
Style guide reference: [ROOT URL | LANG-SPECIFIC | BOTH] — maintainer chooses
Anti-SLOP enforcement: [INSTRUCTION-ONLY | INSTRUCTION+HOOK | HOOK-ONLY] — maintainer chooses
```

Final template generated AFTER maintainer's choices, grounded in production prior-art (T11 — search what production projects use before writing your own; ≥3 phrasings per channel).

Reference our existing precedents (inspiration, not predetermined adoption): root `AGENTS.md` (SSOT #7 ADOPT-VOCABULARY), `CLAUDE.md` (Artifact Ownership Contract), R1-R20 enforcement (especially R4 «real assertions only» — same «real, not decorative» shape).

**Citation requirement:** every claim about a tool/pattern cites a source URL. NO «from training data» claims (T12).

#### §4.1.6 Community resources + Anthropic infrastructure

> **Why:** «не переизобретать велосипед» (build-first-reuse-default). Community resources + Anthropic-native infra may close gaps without us building. Verify each tipster claim through official sources (T3/T11/T12).

Research each (WebSearch + WebFetch + DeepWiki if a specific repo), output to research-patch §3.10:

- **§4.1.6.1 «superpowers» repo** — find it (`obra/superpowers`?), license, maturity, what skills/subagents/orchestrator patterns it ships, problem-class match, cross-editor reach.
- **§4.1.6.2 Anthropic Agent SDK + separate monthly credit (TIME-SENSITIVE)** — verify via Claude Docs / Anthropic billing pages whether `claude -p` / Agent SDK / GitHub Actions draw a separate subscription credit. **Hard constraint:** [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md) still applies — GitHub Actions `@claude` on metered `ANTHROPIC_API_KEY` ≠ subscription credit. Verify scope precisely; verify CURRENT state at session time.
- **§4.1.6.3 Subagent model selection (Opus vs Sonnet «economy»)** — documented behaviors per official docs. If «economy mode» isn't a named feature → that's a finding.
- **§4.1.6.4 Skills for subagents** — can subagents use skills; how auto-trigger differs inside subagent vs main session; preload via `skills:` frontmatter.
- **§4.1.6.5 Community subagent/skill collections** — catalog viable ADOPT/ADAPT candidates with license + problem-class match.
- **§4.1.6.6 Claude Code capability discovery** — canonical capability-index path (`llms.txt`?) for future kickoffs.
- **§4.1.6.7 Maximizing orchestrator autonomy within subscription** — concrete patterns; confirm none break no-paid-LLM-in-CI.

**Output format per item:** WHAT found (citations); VERIFIED / PARTIAL / UNVERIFIED / CONTRADICTED per claim; maturity / license / problem-class match; build-first-reuse-default verdict candidate; tradeoffs for dialogue.

**Hard constraint — external info verification:** external info (from maintainer or anyone) = a starting point, not fact. Verification status recorded explicitly. T3 + T11 mandatory.

### §4.2 _(REMOVED — scope correction 2026-05-21)_

> The original §4.2 «Concrete spec execution — recommendation» (approach comparison, spec readiness/defect analysis, executor choice, step-by-step process for the spec) is **deleted**. The spec is a documentation example only (see banner + §1). No execution-approach output is produced. If the spec needs executing, that is a separate, properly-scoped session.

### §4.3 Trigger conditions for full Phase 10 / full Swarm-readiness

> **Origin:** maintainer 2026-05-13 asked «когда проводить» Swarm-readiness и Phase 10. Resolution: each gets an explicit trigger predicate recorded at end of 1B.

#### §4.3.1 Swarm-readiness research (full session, ARMED conditional)

- **Trigger:** a concrete spec arrives requiring autonomous swarm execution AND 1B's tooling findings don't generalize to it; OR the maintainer attempts swarm execution and logs 3+ friction incidents.
- **Until trigger fires:** 1B tooling findings are sufficient; no separate Swarm-readiness session.
- **Decision for 1B:** record trigger predicates for future re-arming (no execution decision is made here).

#### §4.3.2 Phase 10 foundations audit (full 4-6-week R-phase, ARMED conditional)

- **Trigger:** strategic-clarity (1A+1B) leaves a load-bearing foundations gap NOT addressable by lightweight dialogue (e.g. maintainer adopts a swarm runtime as a standing dependency, pulling A1/A3/A5 into scope).
- **Sub-streams NOT covered by 1A+1B** (any one firing → targeted mini-audit, not the full R-phase): A2 per-rule R1-R20 mechanism re-eval; A5 whole-stack external tooling re-eval; A6 full documentation-artefact audit; A1 architectural foundations beyond goal/positioning; A3 deeper AI-agnostic boundary analysis.
- **Until trigger fires:** Phase 10 stays ARMED in `docs/meta-factory/open-questions.md §13.32`.
- **Decision for 1B:** record «Phase 10 still ARMED with trigger conditions [enumerated]».

---

## §5 Hard constraints (anti-deliverables)

- **CONFIDENTIALITY (read first):** input spec at `inputs/spec-semantic-dedup-contracts.md` is sanitized (paths/IPs/project/collection names → placeholders). **Research-patch output MUST NOT copy spec content verbatim** — paraphrase as «a sample spec»; do NOT cite placeholders, business glossary, or task specifics into git-tracked `docs/meta-factory/research-patches/*`. Use it ONLY to extract a docstring illustration. Every spec reference passes «would this leak meaning if shared publicly?».
- **NO spec-execution output** — no approach comparison, no defect/dependency analysis, no executor choice, no spec-format amendments, no `spec-amended.md`. (Scope correction 2026-05-21.)
- **NO project meta-decisions** — 1A scope. If raised mid-1B → record as «1A revision needed» observation; do not re-decide.
- **NO implementing or editing the spec** — it is a read-only documentation example.
- **NO file edits beyond** the research-patch (`docs/meta-factory/research-patches/2026-05-21-swarm-tools-research.md`) + the AGENT.MD template + optional outputs in this kickoff's `outputs/` subdir.
- **NO PR. NO commit** beyond the research-patch (and that only on explicit maintainer approval).
- **NO editing** README / CLAUDE.md / session-bootstrap.md / `.claude/rules/*` / `packages/core/principles/*` — maintainer-owned.
- **NO editing `prior-art-evaluations.md`** — research-tooling R-phase scope (this session may _flag_ a candidate SSOT gap, not write it).
- **NO editing existing kickoffs.** **NO Phase 10 / Swarm-readiness launch** (recommend with scope only).
- **NO fabrication** of tools/patterns that don't resolve through the research toolset — T3 + T11 mandatory; explicit NOT-FOUND is valid + valuable.

---

## §6 Output requirements

### §6.1 Research-patch (mandatory)

`docs/meta-factory/research-patches/2026-05-21-swarm-tools-research.md` — required sections (corrected scope):

- **§1 Session purpose + maintainer-stated questions recap**
- **§2 Background** — pointer to 1A research-patch + drafts; no re-narrate
- **§3 Prior-art sweep results** — tools + AGENT.MD findings, each with citation:
  - **§3.5 Prometheus** — what it is + how it works (or «no specific tool found; analogs are [X,Y,Z]»)
  - **§3.6 Atlas** — same shape
  - **§3.7 Prometheus + Atlas relative to AIF Handoff** — complement or compete (landscape understanding, NOT a spec-runtime pick)
  - **§3.8 AI SLOP vs normal docstring** — side-by-side bad-good + mechanical-detection boundary
  - **§3.9 Ready-to-use AGENT.MD template** (full text + `outputs/AGENT.md.template`)
  - **§3.10 Community resources + Anthropic infrastructure** — each tagged VERIFIED/PARTIAL/UNVERIFIED + build-first-reuse verdict candidate
- **§8 Trigger conditions recorded** — full Swarm-readiness + Phase 10 ARMED states per §4.3
- **§9 Self-application** — did this research itself apply «build-first-reuse-default» (esp. did the AGENT.MD template ADOPT/ADAPT production prior-art before building)?
- **§10 §1.7 forward+backward check** with file:line citations
- **§11 Maintainer Q-and-A summary** — verdicts surfaced for dialogue

> Note: there are intentionally **no §4-§7 in the research-patch** (spec analysis / approach comparison / recommendation / spec-format changes) under the corrected scope. The patch's section numbering jumps §3 → §8 deliberately. (This refers to the *patch's* sections — the kickoff itself retains §4.1/§4.2-tombstone/§4.3 as kickoff structure.)

### §6.2 AGENT.MD template (mandatory)

Path: `.claude/orchestrator-prompts/swarm-tools-research/outputs/AGENT.md.template`. Ready-to-use, evidence-grounded: docstring rules (anti-SLOP per §4.1.4), commit rules, testing rules, code-review rules, instruction-level quality enforcement. Markdown, maintainer-decision placeholders per §4.1.5.

### §6.3 Memory updates (mandatory)

After session closes, update `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:

- `project_session_ordering_2026_05_13.md` — mark 1B completed; note tooling + AGENT.MD outcome
- New entry if a tooling reuse-decision worth persisting is reached (NOT a spec-execution decision)

---

## §7 AI laziness traps active for this session

Per [.claude/rules/ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md):

**Active canonical traps:**

- **T1** (sampling floor=5) — any «aif-handoff doesn't support X» claim → ≥5 ask_question phrasings or an explicit docs page confirming absence.
- **T2** («my methodology would catch it») — actually run the queries; designing ≠ executing.
- **T3** (plausible findings without verification) — EVERY tool/pattern claim cites a URL. Especially Prometheus/Atlas: high fabrication risk; explicit NOT-FOUND is valid.
- **T4** (closing prematurely) — output requires ALL §6.1 sections + AGENT.MD template. Don't punt with «pending more research».
- **T7** (following the prompt literally) — and given THIS kickoff's history, reason against the prompt: the original framing was wrong once already. If something reads like «plan the spec's execution» — STOP, that's the superseded scope.
- **T8** (asking maintainer to avoid work) — surface concrete findings + recommendations first; don't dump options back.
- **T11** (designing without prior art) — for the AGENT.MD template, search production templates first (≥3 context7 + ≥3 DeepWiki/WebSearch phrasings).
- **T12** (skipping literature sweep because «I already know») — re-verify aif-handoff / superpowers / Agent-SDK claims with current queries.
- **T13** (treating ADOPTED items as zero-work) — verify upstream evidence for adopted patterns at the problem-class boundary.
- **T14** (clean = no theatre) — «no Prometheus tool found» is a finding, recorded with «searched X phrasings; analogs are…».
- **T15** (self-application MANDATORY) — research-patch §9: did this research follow build-first-reuse-default for the AGENT.MD template?
- **T16** (pattern-matching-on-name) — for any ADOPTED/ADAPTED tool, write «upstream problem class X / our problem class Y / match? evidence:».

**Domain-specific traps:**

> Note: T-ST-B (dependency/parallelism defect analysis) and T-ST-C (manufactured-confidence single-recommendation) existed in the original mis-scoped kickoff — they only made sense for the dropped spec-execution scope and were retired together with §4.2. Their absence here is intentional, not an omission.

- **T-ST-A «Prometheus/Atlas fabrication risk»** — mythological-sounding names; don't hallucinate. NOT-FOUND → report + pivot to analogs.
- **T-ST-D «AGENT.MD generic template trap»** — template must contain SPECIFIC anti-SLOP phrasing + actionable rules, not «be careful, write good docstrings». Generic ≠ useful.
- **T-ST-E «1A-revision leak»** — if mid-1B you want to revisit 1A meta-decisions → record as observation, propose 1A re-run, don't decide.
- **T-ST-F «trigger-condition theatre»** — §4.3 needs specific concrete predicates («3+ friction incidents in 6 months tagged X»), not vague signals.
- **T-ST-G «confidentiality leak via research-patch»** — spec content (even sanitized) MUST be paraphrased, never copy-pasted.
- **T-ST-H «external-info-as-fact»** — every §4.1.6 external claim tagged VERIFIED/PARTIAL/UNVERIFIED/CONTRADICTED. Especially time-sensitive billing claims.
- **T-ST-SCOPE «spec-as-execution-target relapse» (added 2026-05-21)** — the original kickoff mis-scoped the spec as an execution target and the research followed it. If you find yourself analysing the spec's task graph, dependencies, wave parallelism, or «which runtime should run it» — STOP. The spec is a docstring example only. This trap is the literal incident that motivated the scope correction.

---

## §8 What this session does NOT do

- Does NOT edit README.md, CLAUDE.md, session-bootstrap.md, `.claude/rules/*`, `packages/core/principles/*`, `prior-art-evaluations.md`
- Does NOT open a PR; does NOT auto-commit except optionally the research-patch (explicit approval)
- Does NOT launch Phase 10 / Swarm-readiness / Wave 10 (recommends with scope if a gap surfaces)
- Does NOT create new SSOT entries (may flag a candidate gap)
- Does NOT change existing kickoffs; does NOT install MCP servers
- **Does NOT re-decide 1A meta-decisions**
- **Does NOT plan, decompose, defect-analyse, or choose an executor for the spec** — it is a documentation example only
- **Does NOT implement or edit the spec**

---

## §9 Project context for fresh AI / cold-start

You are starting a session in `/Users/art/code/rules-as-tests-aif`. Single-maintainer (Art), single-domain. Project ships «rules-as-tests-aif» — an AIF companion focused on Living Documentation + multi-layer enforcement + research methodology.

**MANDATORY (pre-execution gate — already cleared, this kickoff is COMPLETED):** 1A (`goal-clarity-dialogue/kickoff.md`) must be DONE before 1B. Check for the 1A research-patch; if absent → ABORT, prompt maintainer to run 1A first. *(Historical note: 1A was complete before 1B ran; this gate is preserved for record / hypothetical re-run, not an active instruction.)*

**Environmental facts:**

- DeepWiki MCP (`mcp__deepwiki__*`) + Context7 MCP (`mcp__context7__*`) installed user-scope.
- Verify Claude Code version via `claude --version`; if ≥2.1.100, note GitHub issue #46917 (token-inflation) in the research-patch for awareness.
- Read the scope-correction banner at the top before doing anything.

---

## §10 Final note to the AI running this

This is a **RESEARCH session, NOT dialogue, NOT implementation**. Your role:

1. **Research** — tools deep-dive (§4.1) + AGENT.MD/anti-SLOP discipline; cite every claim.
2. **Synthesize** — findings into research-patch §3 + §3.5-§3.10.
3. **Recommend** — concrete build-first-reuse verdicts for each tool + an evidence-based AGENT.MD template (with rationale, not a list of options).
4. **Ask** — for maintainer confirmation on AGENT.MD decisions (strictness, style-guide scope, enforcement layer); don't auto-decide.
5. **Document** — research-patch + AGENT.MD template.
6. **Update memory** — session-ordering + any tooling reuse-decision.

You do NOT: decide for the maintainer; edit owned artifacts; re-do 1A; ship beyond research-patch + template; launch follow-ups; fabricate; **or treat the spec as anything other than a documentation example.**

Closing message: §4.1 tool findings (found / not-found / analogs + verdicts); AGENT.MD template location + the docstring-discipline recommendation; trigger conditions for §4.3; memory updates. If «no specific Prometheus/Atlas tool» — report analogs, don't fabricate. If maintainer wants to reflect mid-session — pause cleanly, write a «partial findings» research-patch, save the template draft, exit.

---

## §11 See also

- **[goal-clarity-dialogue/kickoff.md](../goal-clarity-dialogue/kickoff.md)** — 1A predecessor (MUST be done first)
- [research-tooling-evaluation/kickoff.md](../research-tooling-evaluation/kickoff.md) — §10 empirical evidence pool
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT
- [.claude/rules/build-first-reuse-default.md](../../rules/build-first-reuse-default.md) — verdict typology
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) — trap catalogue
- **[inputs/spec-semantic-dedup-contracts.md](inputs/spec-semantic-dedup-contracts.md)** — documentation EXAMPLE only (NOT an execution target)
- Memory: `project_swarm_research_scope_correction.md` (this revision's origin), `project_session_ordering_2026_05_13.md`

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
