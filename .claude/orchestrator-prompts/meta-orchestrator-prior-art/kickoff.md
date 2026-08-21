# KICKOFF — R-phase: prior-art survey for `/meta-orchestrator` skill capability

> **Type:** R-phase (research only — no skill code in this wave). Output = research-patch with build-vs-reuse verdict per BFR-default.
> **Origin:** 2026-05-23 maintainer dialogue. Maintainer needs a single-invocation skill (`/meta-orchestrator [<umbrella>]`) that does plan-preflight + priority + launch-table + meta-kickoff authoring + stage-gate-aware dispatch. Before BUILDing — check companions to avoid `#parallel-evolution-creep` ([build-first-reuse-default.md §4](../../../.claude/rules/build-first-reuse-default.md)).
> **Admission:** proposed candidate. Maintainer launches this kickoff in a fresh session.
> **Deliverable:** `docs/meta-factory/research-patches/2026-05-2X-meta-orchestrator-prior-art.md` (date = day the patch lands).

---

## §0 Why this wave

Our existing [`orchestrator` skill](/Users/art/.claude/skills/orchestrator/SKILL.md) covers ≈70% of meta-orchestration via Queue mode ([:8](/Users/art/.claude/skills/orchestrator/SKILL.md#L8)) but has **named gaps** (see §7 below). Maintainer wants those gaps closed by one invocation. The wave decides: **ADOPT** an upstream tool / **ADAPT** an upstream pattern / **BUILD** narrow wrapper / **REJECT**. Decision lives in the research-patch; the *build* (if applicable) is a separate I-phase wave authored after this one lands.

## §1 Core question
Does an existing companion / open-source tool implement the §7 functional spec (or ≥80% of it) — well enough to ADOPT verbatim, ADAPT with a thin wrapper, or REFERENCE as design source? If yes — which one and with what verdict + integration sketch. If no — proceed to author the BUILD I-phase kickoff with §7 as the spec.

**Beyond «found / not-found» — the leapfrog arm:** if a candidate is found *partially* (covers, say, 40–80% of §7), do NOT stop at «we'll just add the missing pieces». Run a **gap-analysis**: where does upstream fall short relative to §7, and how can our version **exceed** it — not merely fill gaps. The output should articulate both «leverage their work» and «improve where they're weak». This sharpens N5 give-back later (we'd contribute a *demonstrated improvement*, not a parallel reimplementation).

## §2 Surfaces to survey (MANDATORY — Tier 1 companion-first per [phase-research-coverage.md §1.13](../../../.claude/rules/phase-research-coverage.md))

| # | Source | Probe |
|---|---|---|
| 1 | **Superpowers** `obra/superpowers` (installed v5.1.0 at `/Users/art/.claude/plugins/marketplaces/superpowers-dev/skills/`) | Re-survey beyond what's already in [SSOT #64/#65](../../../docs/meta-factory/prior-art-evaluations.md). **Full v5.1.0 installed list:** `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills`. Probe each consciously (dismiss with rationale or include) — especially `executing-plans`, `writing-plans`, `dispatching-parallel-agents`, `subagent-driven-development`, `verification-before-completion`, `finishing-a-development-branch` (which map to §7.7/§7.8 stage-gate + reviewer handoff). Look for: plan-preflight, stage-gate handling, slash-command pattern, multi-umbrella priority resolution. |
| 2 | **AI Factory** (`aif.cutcode.dev` / `aif-factory`) | Already known to have `/aif-evolve` skill-context patches + planner/implementer/reviewer prompt patterns. Probe for: meta-orchestrator-shaped command, plan-preflight discipline, autonomous wave launcher. DeepWiki + project landing page + any public skill repo. |
| 3 | **aif-handoff** (companion #3 named in README:8) | Probe `HANDOFF_MODE`, `RuntimeAdapter`, planner/implementer/reviewer cycle. Specifically: does any handoff mode equate to «one trigger → reads plan → dispatches»? DeepWiki, then raw repo files if found. |
| 4 | **OhMyOpencode (`code-yeongyu/oh-my-openagent`)** — canonical repo per [SSOT #61](../../../docs/meta-factory/prior-art-evaluations.md) (ADAPT verdict 2026-05-22, `rulesInjector` precedent for channel-selection injection). This wave's question is whether `oh-my-openagent` or any successor carries a **meta-launcher / wave-dispatcher / multi-umbrella priority** pattern that goes *beyond* the `rulesInjector` channel-selection use case already in SSOT #61 (not a re-survey of the rules-injection capability — that's settled). If `ohmyopenagent.com` (maintainer-named domain) resolves to a different repo than `code-yeongyu/oh-my-openagent`, survey both. | Probe `rulesInjector` for orchestrator-shaped extensions, tool-restrictions-as-permissions, any meta-launcher/wave-dispatcher pattern. DeepWiki on `code-yeongyu/oh-my-openagent` + WebFetch landing page. |
| 5 | **Claude Code native primitives** | Plugins/skills/agent-templates that ship meta-launcher shapes (`claude-code-guide` for harness internals + WebFetch `docs.claude.com`). Slash-command pattern, hooks for plan-preflight, native priority resolution. |
| 6 | **General state-of-art** (WebSearch ≥3 phrasings — search-coverage 6-item checklist) | «AI agent meta-orchestrator slash command», «autonomous wave dispatcher plan reader», «multi-phase implementation plan executor with stage gates». Anti-`#own-stack-blind-spot` sweep. |

**Each surface MUST produce one verdict cell:** ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT, with file:line / URL / DeepWiki-quote evidence + falsifier («wrong if …»).

## §3 Method (MANDATORY)

1. **BFR §3 mechanism** — [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md): SSOT consult + DeepWiki + WebSearch ≥3 phrasings on the negative-existence claim. **No BUILD verdict** without it. Provisional BUILD is allowed only with the residual flag («WebSearch incomplete»).
2. **T16 problem-class check per candidate** — for every potential ADOPT, write «Upstream problem class: X. Our problem class: Y. Match? Evidence: …». Same-name ≠ same-function ([ai-laziness-traps.md §2 T16](../../../.claude/rules/ai-laziness-traps.md)).
3. **No-paid-LLM-in-CI constraint** — any proposed mechanism must run in active sessions (CC subscription) only, never in `.github/workflows`. Skills run in sessions — fine. If a candidate requires an API-billed call from CI → REJECT regardless of fit ([no-paid-llm-in-ci.md §1](../../../.claude/rules/no-paid-llm-in-ci.md)).
4. **One-button installability (N6b coupling)** — proposed solution MUST be templatable for N6b `npx` scaffold, which means: project-scope `.claude/skills/`, no companion runtime deps, no global-only paths. If a candidate is irreducibly global-only → REJECT.
5. **Substrate-purity invariant** — verdict cannot add an npm dep to `package.json` (C-guard per [niche-roadmap §N7 line 90](../../../docs/meta-factory/research-patches/2026-05-21-niche-strategy-and-growth-roadmap.md)). Process-layer dogfood OK; substrate stays clean.
6. **Channel-selection check** ([rule-enforcement-channel-selection.md §3](../../../.claude/rules/rule-enforcement-channel-selection.md)) — slash-command (deterministic) was already chosen by the maintainer over semantic triggers. Confirm the candidate respects this.

## §4 Deliverable

A research-patch at `docs/meta-factory/research-patches/2026-05-2X-meta-orchestrator-prior-art.md` containing:

1. **Per-surface verdict table** (one row per §2 candidate, fields above). **New SSOT rows start at #66+** ([wave-sequencing-plan §0 collision note](../../../docs/meta-factory/wave-sequencing-plan.md): #64/#65 already taken by N7; N8 A-phase rows also pending at #66+ — coordinate ID with any concurrent A-phase work or claim a consecutive block).
2. **Composite verdict:** ADOPT / ADAPT / BUILD with rationale.
3. **Gap-analysis for the chosen candidate** (if ADAPT or partial-ADOPT): per §7 sub-section (7.1–7.14), classify upstream as MATCH / PARTIAL / MISSING / WEAK. For every PARTIAL/MISSING/WEAK cell, propose **how our version exceeds upstream** (not just «adds»). The «leapfrog» framing from §1: where we leverage, where we improve. (Skip if pure ADOPT — nothing to improve. Skip if pure BUILD — no upstream to gap-analyze.)
4. **Integration sketch** (if ADOPT or ADAPT): how the candidate maps onto §7 spec; what's left for us.
5. **§7 spec preservation** — copy this kickoff's §7 verbatim into the patch as an appendix (the spec is the contract; whatever path is chosen must deliver it).
6. **Next-wave kickoff name** — if BUILD wins, propose the I-phase kickoff name and skeleton.
7. **§1.7 forward+backward note** — discipline-bearing patch.
8. **Tags** — `#meta-orchestrator`, `#companion-survey`, `#build-vs-reuse`.

No code changes in this wave. No skill files written. Only the patch.

---

## §5 AI-laziness traps (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — cite + enumerate + extend)

Active: **T1** (sampling floor — survey ALL 6 surfaces, not first 3), **T3** (file:line / DeepWiki-quote / URL per claim), **T4** (no premature closure — hit all surfaces before declaring «no ADOPT exists»), **T7** (run adversarial counter-prompt — «if a meta-orchestrator skill existed somewhere, where would it live?»), **T11** (prior-art BEFORE proposing BUILD — the whole point of this wave), **T12** (don't skip sweep on «I already surveyed Superpowers» — re-survey with the new functional spec in §7), **T13** (ADOPTED Superpowers ≠ zero-work — verify our §7 problem class matches what their skill is designed for), **T14** (clean audit ≠ no upstream — distinguish «no ADOPT exists» from «I didn't look hard enough»), **T15** (self-application — does the surveyor itself follow the discipline it surveys? cite own evidence chains), **T16** (CENTRAL — same-name ≠ same-function; «orchestrator» / «launcher» / «dispatcher» across candidates may all mean different things; problem-class check mandatory per §3 step 2). **Explicit dismissals:** T8 (clarifying-question-as-stall) — N/A, scope fully specified by §7. T10 (look-vs-exist) — §2 enumerates the 6 known surface-types as population; if survey discovers an additional surface-type (a meta-orchestrator skill in a repo not listed in §2), the surveyor must call it out before closing §2, not silently subsume.

Domain-specific:
- **T-MO-A:** «Superpowers has `executing-plans` → it's our meta-orchestrator». FALSE — `executing-plans` is for ONE plan, no stage-gates, no priority across umbrellas, no plan-preflight ([SKILL.md:3](/Users/art/.claude/plugins/marketplaces/superpowers-dev/skills/executing-plans/SKILL.md#L3): «Use when you have a written implementation plan to execute in a separate session with review checkpoints» — singular plan, no cross-umbrella scope). Counter: compare against §7 spec line-by-line; partial match ≠ ADOPT.
- **T-MO-B:** «Found a tool with similar name → ADOPT». Counter: §3 step 2 problem-class check. Especially for OhMyOpencode «rules» vs our discipline rules — already documented as T16 trap ([rule-enforcement-channel-selection.md §5](../../../.claude/rules/rule-enforcement-channel-selection.md)).
- **T-MO-C:** «Companion is private/inaccessible → mark UNKNOWN and move on». Counter: dual-channel — if DeepWiki fails, try raw repo / landing page / project docs / WebFetch. Three attempts before UNKNOWN. ([phase-research-coverage.md §1.4](../../../.claude/rules/phase-research-coverage.md) adversarial counter-prompt.)

## §6 Phase -1 (before dispatch in next session)

Cold-review THIS kickoff (1× Opus): stale refs, ambiguity, missing constraints, §5 substance, §7 completeness (does §7 capture everything the maintainer asked for? — the spec is the contract).

---

## §7 Functional spec of `/meta-orchestrator` — the contract the chosen path must deliver

> **THIS SECTION IS LOAD-BEARING.** Whatever verdict §4 reaches (ADOPT / ADAPT / BUILD), the resulting tool MUST deliver every clause below. The maintainer's words; do not paraphrase away constraints.

### §7.1 Trigger
- **Form:** slash-command `/meta-orchestrator [<umbrella-name>]`.
- **Argument:** optional. With name → operates on that umbrella. Without name → scans all candidate-status waves in [wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md) and proposes priority.
- **Symmetry:** sits next to `/orchestrator` and `/reviewer` as a role-trigger. Deterministic (not semantic phrase) per [rule-enforcement-channel-selection.md](../../../.claude/rules/rule-enforcement-channel-selection.md).

### §7.2 Plan-preflight
On invocation, the skill verifies plan currency BEFORE doing anything else:
1. `git status` + current branch + ahead/behind vs `staging`/`main`.
2. Parse [wave-sequencing-plan.md §0](../../../docs/meta-factory/wave-sequencing-plan.md) — list of waves.
3. For every referenced kickoff path (`.claude/orchestrator-prompts/<dir>/kickoff.md`) — `ls -f` to confirm file exists. Stale ref → flag.
4. For every «✅ merged» / «🟡 partial» / «🔲 not started» claim — verify against GitHub: `gh pr list --search` (open) + `gh pr list --state merged` (closed). Drift → flag.
5. For every linked research-patch — confirm file exists under `docs/meta-factory/research-patches/`.

**Output of §7.2:** «План актуален» OR list of stale items with concrete corrections proposed. If plan is **missing entirely** (no `wave-sequencing-plan.md`) → skill writes a stub from `README.md` + `EXECUTION-PLAN.md` + existing kickoffs, presents to maintainer for OK before continuing.

### §7.3 Priority resolution (no-argument mode)
When `/meta-orchestrator` is called without `<umbrella>`:
1. Enumerate all candidate / startable-now waves.
2. Score by: blocks-other-waves (highest weight), give-back potential (N5 feed), size (smaller first when equal), explicit maintainer-prefs in plan.
3. Present ranked list with one-line rationale per item.
4. **If clear winner:** commit to it, say «Recommend X, proceeding» per [§1.12](../../../.claude/rules/phase-research-coverage.md).
5. **If genuine tie / true strategy fork:** ask maintainer ([reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md)).

### §7.4 Launch-table generation
For the selected umbrella, produce a per-sub-wave row containing:

| Column | Value source / decision rule |
|---|---|
| Sub-wave id | from research-patch §3 table |
| Type | R-phase / execution-build / wiring (from kickoff §0 or `Type:` header) |
| Mode | **Mode A** (inline Opus) default · **Mode B × N worktrees** if execution-parallel ≥2 sub-waves per stage ([queue-mode.md §1 Anti-triggers](/Users/art/.claude/skills/orchestrator/references/queue-mode.md): «execution tasks that modify production code in parallel → use Mode B × N worktrees with worktree isolation») · **Queue mode (sequential)** for R-phase-only sequential ([queue-mode.md §1 Triggers](/Users/art/.claude/skills/orchestrator/references/queue-mode.md): «Queue is sequential — each kickoff depends on conclusions from prior ones, OR they are independent but maintainer prefers sequential…») |
| SDD? | **Yes** if execution-build with ≥3 independent tasks (project rationale, not a cited source: at 1-2 tasks the SDD two-stage-review overhead roughly matches its catch-rate; at 3+ it pays back clearly. SDD *mechanism* per [SSOT #64](../../../docs/meta-factory/prior-art-evaluations.md); Mode A/B/SDD *activation* per [orchestrator SKILL.md Decision matrix](/Users/art/.claude/skills/orchestrator/SKILL.md)); No for wiring / single-task R-phase / borderline (overhead > value) |
| Stage | 1 / 2 / 3 (from research-patch §3) |
| Parallel sibling | which sub-wave runs concurrently |
| Volume | small / medium / large (NOT time/calendar — explicit maintainer requirement) |

### §7.5 Meta-kickoff authoring
Skill generates `.claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md` with:
1. List of all sub-kickoffs with paths.
2. Stage-gate rules expressed as **real git checks** (NOT in-memory state — Queue mode's sequential FIFO doesn't suffice). Example: «Stage 2 dispatch waits for `gh pr list --search 'is:merged head:guard-liveness-v0-audit'` non-empty.»
3. Per-sub-wave mode-decision from §7.4.
4. **§5 AI-traps section per [principle 12](../../../packages/core/principles/12-ai-laziness-traps.test.ts)** (spec: [`.claude/rules/ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md)) — every authored kickoff carries this, no exception.
5. Recursive-self-application note.
6. Stop conditions per Stage (when to pause for Phase -1 cold-review).

### §7.6 Dispatch routing per sub-wave type

> **Bridge to §7.4 Mode column:** the rows below are **mutually exclusive scenarios, not a priority order**. The dispatcher picks the one row that matches the sub-wave's nature (single-vs-parallel × R-phase-vs-execution-vs-wiring); §7.4 Mode column collapses these into a launch-table cell.

- **R-phase (single)** → Queue mode sequential (compatible with `references/queue-mode.md`).
- **R-phase (multiple parallel)** → Mode A × N inline Agents in one message (single-session multi-dispatch).
- **Execution-build, single** → Mode A inline.
- **Execution-build, parallel ≥2 in stage** → Mode B × N worktrees per [parallel-subwave-isolation.md §1](../../../.claude/rules/parallel-subwave-isolation.md). NOT Queue mode (excluded by `queue-mode.md:22`).
- **Wiring (thin orchestrator, e.g. CI workflow)** → Mode A inline.
- **Manual liveness probing (SP-companion type)** → session-bound, never CI.

### §7.7 Stage-gate semantics
- Between stages: real `git merge`/PR-merged check. NOT in-memory «next in queue».
- Within stage: parallel siblings dispatch simultaneously OR sequentially per kickoff dependency declaration.
- After every stage: invoke **Phase -1 cold-review** before next stage. No auto-continue without GO.

### §7.8 Reviewer hand-off
- Phase -1 reviewer fires between stages — not optional.
- Reviewer's verdict GO / REVISE / STOP gates next stage admission.
- Skill respects [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) — reviewer surfaces strategy forks, skill asks maintainer.

### §7.9 Anti-scope (what the skill must NOT do)
- **Не пишет код подволны** — Worker's job, not the meta-orchestrator's.
- **Не финализирует стратегию проекта** — predicts priorities, maintainer confirms genuine forks.
- **Не модифицирует `~/.claude/skills/orchestrator/`** — that's the global orchestrator, agent-uncommittable (same self-protected-deny-list reasoning that applies to `.claude/settings.json` — see [CLAUDE.md `Artifact Ownership Contract`](../../../CLAUDE.md): global skill outside the repo is outside the agent's write-authority); meta-orchestrator wraps, doesn't fork.
- **Не нарушает no-paid-LLM-in-CI** — all dispatch is session-bound (CC subscription Mode A/B).
- **Не нарушает substrate-purity** — zero companion-deps in `package.json`.

### §7.10 One-button-install (N6b) coupling — LOAD-BEARING
Maintainer's explicit constraint: *«все эти скилы часть моего проекта! должны потом будут ставиться и развертываться одной кнопкой на любой проект! и оркестратор и все остальные наши скилы»*.

Therefore:
- Skill lives at `.claude/skills/meta-orchestrator/` (project-scope, committed, NOT `~/.claude/skills/`).
- Must be **templatable** for N6b `npx` scaffold (the `install.sh` payload).
- Must work in ANY downstream project after install — paths inside the skill use repo-relative refs, not absolute.
- All cross-references to plan / research-patches / kickoffs use template-aware paths so install.sh can rewrite for the consumer's repo layout.

### §7.11 Recursive self-application
- The skill's own kickoff (this file) passes [principle 12](../../../packages/core/principles/12-ai-laziness-traps.test.ts).
- The skill's own design fits «every rule = executable artifact at earliest reachable channel» ([README.md#why-this-exists](../../../README.md)) — slash-command is the deterministic trigger; the skill itself is the artifact.
- Once the skill is invoked on this very umbrella, it should produce a valid launch-table for itself (dogfood test on first use).

### §7.12 Output artifacts per invocation
For one `/meta-orchestrator <umbrella>` invocation, the skill produces:
1. `.claude/orchestrator-prompts/<umbrella>-meta-launch/state.md` — preflight + launch-table + dispatch log.
2. `.claude/orchestrator-prompts/<umbrella>-meta-launch/kickoff.md` — the meta-kickoff with §5 AI-traps.
3. Inline report to maintainer with proposed next action + approval gate.

### §7.13 Failure-mode handling
- Plan stale / missing → skill writes/updates, doesn't proceed without OK.
- Ambiguous priority → asks maintainer (true strategy fork).
- Sub-wave fail mid-stage → pauses, reports; doesn't auto-continue.
- Tool unavailable (`gh` API rate-limited, etc.) → escalates to maintainer with diagnostic.

### §7.14 Existing-gap reference (the 4 things `orchestrator` already does NOT do)

For benefit of the prior-art surveyor — these are the named gaps the skill MUST close:
1. Plan-actuality verification.
2. Cross-umbrella priority resolution.
3. Auto-generated launch-table + meta-kickoff for a given umbrella.
4. Stage-gate vs flat-queue distinction (real git checks, not Queue mode FIFO).

---

## §8 Out of scope (this wave)
- Writing the skill itself — that's the I-phase kickoff after this wave's verdict.
- Building any tool — research only.
- Modifying `~/.claude/skills/orchestrator/` global skill — meta-orchestrator wraps, doesn't fork.
- Designing N6b install templating in detail — only flag the coupling constraint in the verdict.

## §9 Surfacing constraint check before closing
Before writing the deliverable patch, confirm the verdict respects:
- [ ] BFR §3 mechanism executed (≥3 WebSearch phrasings, DeepWiki on each candidate, SSOT consult).
- [ ] T16 problem-class check per candidate (Upstream X vs Our Y, evidence cited).
- [ ] No-paid-LLM-in-CI honored.
- [ ] Substrate-purity confirmed (no proposed npm dep).
- [ ] One-button-installability respected (project-scope, templatable).
- [ ] §7 spec preserved verbatim in patch appendix.
- [ ] §1.7 forward+backward note written.
- [ ] Verdict explicit (ADOPT / ADAPT / BUILD / REJECT), with falsifier («wrong if …»).

If any item unchecked → verdict provisional, not load-bearing.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
