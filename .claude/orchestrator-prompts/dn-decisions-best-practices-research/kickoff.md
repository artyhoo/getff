# Umbrella: `dn-decisions-best-practices-research` — R-phase для DN-1 и DN-4 best-practices + companion survey

> **Type:** R-phase only (no implementation; output = research-patch + discipline rule draft).
> **Authoritative for:** best-practices research для двух классов decisions — (a) permission-boundary calibration (DN-1 семейство — allow/deny shape для `allowed-tools`), (b) ship-vs-gate / hygiene-vs-functional + N6b portability (DN-4 семейство); companion-projects survey по обоим классам.
> **NOT authoritative for:** PR #261 R-phase verdict (landed 2026-05-28: F.3 primary + F.6 supplementary PROVISIONAL). I-phase implementation. DN-2 (B sibling helper — answered). DN-3 (A + verbatim-в-commit-body — answered).

**Origin:** 2026-05-27 — maintainer push на отдельный research kickoff после серии экспансий по DN-1/DN-4 в PR #261 follow-up dialogue. Maintainer principles surfaced inline:
- **DN-1:** «главное не мешать работе и не создавать неудобства и расходы лишних токенов»
- **DN-4:** «N6b нужно думать в том числе уже сейчас и учитывать»
Эти принципы заслуживают backed evidence через ресёрч, не inline reasoning. Maintainer 2026-05-27: «D1 тоже видимо надо заресерчить бест практики для таких случаев и как сделано у спутников» + «DN-4 — вместе это заресерчить и обсудить отдельно».

> **Quote provenance disclaimer (Phase -1 M4 amend):** All Russian-language verbatim maintainer quotes in §0/§7 originate from 2026-05-27 live session dialogue with maintainer Art (<yhooi2011@gmail.com>). They are NOT transcribed to a PR comment, commit message, or research-patch in the repo. Quote accuracy is from the orchestrator session memory at time of kickoff drafting — Worker cannot mechanically verify provenance. If a quote feels load-bearing for a verdict, surface as a `DECISION-NEEDED` for maintainer confirmation rather than treating as ground truth.

> **DN-4 framing reconciliation (Phase -1 B2 amend):** PR #261 R-phase verdict = «F.3 primary + F.6 supplementary PROVISIONAL» (landed 2026-05-28). Maintainer's subsequent 2026-05-27 dialogue surfaced an *alternative stance*: «defer F.6 entirely; revisit только если после F.3 проблема останется». This R-phase does NOT re-litigate PR #261. It RESEARCHES Class B (ship-vs-gate + N6b portability) to ARM either position with backed evidence — confirming the landed «F.6 PROVISIONAL ship» OR validating the maintainer's revised «defer F.6». Verdict in §5 will pick between **reaffirm-landed**, **revise-to-defer**, or **new-framing** based on companion + best-practices evidence. Worker is NOT expected to ship F.6 implementation either way — that's a future I-phase decision triggered by this R-phase output.

Depends on: PR 261 merged ([research-patch landed](https://github.com/Yhooi2/rules-as-tests-aif/pull/261)). PR 261 даёт baseline F.3/F.6 verdict + DN-1..DN-4 framing.

---

## §0 Problem statement

Two decision classes recurred multiple times in `meta-orch-no-arg-laziness` umbrella dialogue. Each one resolves to a recommendation made inline by orchestrator without backed evidence:

### Class A — Permission-boundary calibration (DN-1 family)

Когда у CC skill нужны bash invocations через helpers, `allowed-tools` поле определяет какие patterns auto-approve. Шире = больше friction-free, но больше attack surface. Уже = больше friction (permission prompts, possible token cost), меньше attack surface.

**Конкретный вопрос:** для skill'ов, чьи helpers живут в одной папке, как правильно настроить `allowed-tools` entry — broad `Bash(bash *)` или narrow glob `Bash(bash helpers/*.sh)`? Что делают companion projects (Superpowers, aif-handoff, oh-my-openagent, Cline) в аналогичных ситуациях? Поддерживает ли CC `allowed-tools` глобы вообще?

**Maintainer principle:** «главное не мешать работе и не создавать неудобства и расходы лишних токенов а только уберегало от опасных команд».

### Class B — Ship-vs-gate + hygiene-vs-functional + N6b portability (DN-4 family)

Когда есть «main fix» который чинит критическую функциональность + «hygiene/cosmetic fix» который opcionально полирует:
- Когда ship'ить hygiene with PROVISIONAL gap vs defer до полного знания?
- Как учитывать future portability cost (N6b "one-button install" для других AI harness'ов: Cursor, Aider, Codex)?
- Когда «glubzhe locks in CC» = blocker, а когда acceptable trade?

**Конкретный вопрос:** В PR #261 F.6 — это hygiene (косметика), которая глубже привязывает к CC harness через `$umbrella` named-arg substitution. F.3 — main fix через state-file helpers — гораздо более portable. Когда писать hygiene-fix вообще стоит? Что говорят best practices? Что делают companions?

**Maintainer principles:**
- «N6b нужно думать в том числе уже сейчас и учитывать»
- Defer F.6 entirely; revisit только если после F.3 проблема останется.

---

## §1 Required searches (phase-research-coverage.md §1 — 6-item checklist + companion survey)

Per [phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md), все 6 search items должны run with file:line evidence + verbatim excerpts перед любым verdict (T3 mandate).

### §1.1 SSOT consult — [`prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md)

Keyword sweep на entries:
- Class A: «permission», «allowed-tools», «deny-list», «sandbox», «execution boundary», «harness security»
- Class B: «portability», «harness abstraction», «cross-harness», «feature flag», «progressive enhancement», «MVP», «PROVISIONAL ship»

Cite by row ID + file:line. T16 problem-class match для каждого найденного.

### §1.2 DeepWiki `ask_question` (≥3 phrasings per companion)

**Class A queries (permission-boundary):**

- `obra/superpowers` — «how does Superpowers configure `allowed-tools` in `.claude/skills/*/SKILL.md` for skills that invoke helper bash scripts? Does it use broad `Bash(*)` patterns or narrow per-helper entries?»
- `cline/cline` — «how does Cline handle permission boundaries for tool execution — does it have allow/deny lists analogous to Claude Code `allowed-tools`? What's the granularity?»
- `code-yeongyu/oh-my-openagent` — «how does oh-my-openagent (OMO) configure execution permissions for its agents that invoke bash scripts? What's the deny-list strategy?»
- (если есть) `Yhooi2/aif-handoff` или `Yhooi2/aif-factory` — «how does AIF Handoff configure permission boundaries for its session-bound execution?»

**Class B queries (ship-vs-gate + portability):**

- `obra/superpowers` — «when does Superpowers ship a feature with documented PROVISIONAL gap vs defer until full verification? Examples? How does it handle harness-agnostic vs CC-specific feature decisions?»
- `cline/cline` — «how does Cline approach feature shipping with known unknowns — does it have a PROVISIONAL / experimental flag concept? Does it favor portable abstractions or harness-native primitives?»
- `code-yeongyu/oh-my-openagent` — «how does OMO handle cross-agent / cross-platform portability? When does it lock into one platform vs maintain abstraction?»

≥3 phrasings each — vary вокруг synonym axis, recency axis, scope-axis. T3 mandate: capture verbatim excerpts in research-patch.

### §1.3 WebSearch (≥3 phrasings per class)

**Class A — permission-boundary:**
- «agent execution sandbox allow-list deny-list best practice»
- «principle of least privilege CLI tool permission»
- «AI agent shell command security boundary»

**Class B — ship-vs-gate:**
- «software engineering ship with known gaps progressive enhancement»
- «feature flag PROVISIONAL incremental release best practice»
- «harness portability vs native primitive trade-off»

Per phrasing — URL + key paragraph in research-patch (T3 + T12 mandate).

### §1.4 BFR sweep (full SSOT enumeration + T16)

Sweep ALL `prior-art-evaluations.md` rows (current count = 84 per PR #261 finding). Для каждой row проверить — есть ли upstream pattern для одного из двух классов? T16 problem-class match: «upstream X = problem class Y; ours = (A) permission-boundary OR (B) ship-vs-gate/portability; match?»

### §1.5 CC primitive verification (focused on Class A)

> **Probe safety mandate (Phase -1 B1 amend) — load-bearing, MUST follow:**
>
> 1. **Worktree-only.** All §1.5 probes run inside the ephemeral worktree assigned to this Worker via `isolation: "worktree"`. Do NOT create probe files in the maintainer's primary workdir.
> 2. **Do NOT commit probe artifacts.** Specifically: NEVER `git add tmp-glob-probe/`, `tmp-arg-probe/`, or any synthetic `.claude/skills/tmp-*/` paths created for §1.5. The ONLY artifact that lands in a commit is `docs/meta-factory/research-patches/2026-MM-DD-dn-decisions-best-practices.md` (+ optional `.claude/rules/<name>.md` draft if §5 §rule-draft fires).
> 3. **Capture-then-cleanup sequencing.** For each probe: (a) create synthetic file(s), (b) invoke / observe, (c) capture verbatim classifier output + decision into research-patch notes, (d) `rm -rf` the probe directory **before writing the §1 search-results section to disk**. Worktree-isolated ephemeral cleanup ⇒ no chance of accidental land.
> 4. **Pre-commit guard.** Before any `git commit`, Worker runs `git status` + `git diff --stat --cached` and confirms staged files = research-patch + (optional) rule draft only. If any `tmp-*-probe/` paths appear → STOP, `git restore --staged`, `rm -rf` the probe paths, re-stage.
> 5. **REPORT line.** Worker REPORT must include `Probes cleaned: ✅ no tmp-*-probe paths in commit; verified via git status pre-commit`.

- **§1.5a — Allowed-tools glob support probe.** Создать synthetic skill `tmp-glob-probe/SKILL.md` с `allowed-tools: ["Bash(bash tmp-glob-probe/helpers/*.sh)"]`. Создать `tmp-glob-probe/helpers/ok.sh` (echo OK). Создать `tmp-glob-probe/helpers/non-helper-path.sh` outside the glob. Invoke skill, observe: которая bash invocation auto-approved, которая prompts. Output: VERIFIED glob-works / VERIFIED glob-doesn't-work + verbatim classifier behavior. **CRITICAL probe — determines Option C viability for DN-1 I-phase.** Cleanup per safety mandate above.
- **§1.5b — Default permission flow for `bash -c`.** Probe: в обычной сессии (не skill) написать `bash -c "echo hello"`. Что произойдёт — prompt? auto-allow? deny? Verbatim observation. Подтверждает или опровергает теорию что `bash -c` уже требует prompt по умолчанию. **Verdict-gate note:** §1.5b output feeds Class A verdict (§5) only via the «if `bash -c` auto-allowed by default, narrow allow-list options become more important» wiring; if Worker finds §1.5b output orthogonal to verdict, label it «context-only, does not gate verdict» in research-patch §1.5b subsection.
- **§1.5c — `$umbrella` empty-arg behavior — PROVISIONAL-gap verification** (DN-4 carry-over, partially verified в PR #261). Synthetic skill `tmp-arg-probe/SKILL.md` с `arguments: [umbrella]`. Invoke с arg + без arg. Observe: подставляется `""` или остаётся `$umbrella` raw? Capture verbatim. **Motivation (Phase -1 M2 amend):** verifies the PROVISIONAL empty-arg gap documented in PR #261's F.6 verdict — i.e., feeds Class B (§4 DN-4 verdict) by either confirming the gap requires F.6 hygiene (reaffirm-landed) or showing it's a non-issue (revise-to-defer). Cleanup per safety mandate above.

### §1.6 DeepWiki on this repo + PR-history

Sweep `Yhooi2/rules-as-tests-aif` (если индексирован) или `git log --grep="allowed-tools\|permission\|portability\|N6b"` для prior decisions / patches. Особо — есть ли установившаяся практика в проекте, которая отвечает на эти classes?

---

## §2 Output expected

`docs/meta-factory/research-patches/2026-MM-DD-dn-decisions-best-practices.md` (~600-800 LOC) с:

- **§0 Problem statement** — две decision classes + maintainer principles цитированные verbatim
- **§1 Search results** — все 6 items per §1 with file:line + verbatim excerpts (T3 mandate)
- **§2 Companion survey** — comparison table: Superpowers / Cline / OMO / (others) × Class A / Class B with verbatim citations
- **§3 Best-practices distillation** — for each class:
  - State-of-art recommendation
  - Industry exemplars (Google SRE, Lean Startup, SOLID, etc.) с citations
  - Trade-off matrix
- **§4 Verdicts:**
  - **DN-1 final answer** — based on §1.5a + §2 companion findings (Option A / C / new candidate?)
  - **DN-4 reaffirmation or revision** — does ship-vs-gate research support «defer F.6 entirely»? Or surface new framing?
- **§5 Discipline rule draft (optional Class B output)** — sketch новое правило `.claude/rules/<name>.md` если patterns достаточно reusable для project-wide дисциплины (Scope α от prior dialogue)
- **§6 §1.7 self-reflexive checks** — forward + backward
- **§7 Self-cold-QA (T19)** — pre-handoff review
- **§8 DECISION-NEEDED for maintainer** — что осталось пикать maintainer'у после ресёрча

---

## §3 Out of scope

- **NOT в этой R-phase:** any code change to SKILL.md / helpers / settings.json / kickoffs. Output = research-patch (markdown) + optional discipline-rule draft.
- **NOT в этой R-phase:** I-phase F.3 implementation. F.3 implementation = separate umbrella once DN-1 answered by this kickoff.
- **NOT в этой R-phase:** F.6 implementation. F.6 implementation is out of scope **regardless of this R-phase's DN-4 verdict** (reaffirm-landed / revise-to-defer / new-framing) — implementation decision triggers a separate future umbrella (Phase -1 NEW-MINOR re-review amend; supersedes prior «F.6 deferred per DN-4 final answer» wording which prejudged the verdict).
- **NOT в этой R-phase:** DN-2 (sibling helper) and DN-3 (verbatim-в-commit-body) — already answered by maintainer 2026-05-27 dialogue.

---

## §4 AI-traps active (per [ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

Canonical T-numbers (sourced from ai-laziness-traps.md §2):

- **T1** — sampling floor=5; не ограничиваться 1-2 companion'ами
- **T3** — file:line / verbatim excerpts / command output для каждого claim
- **T4** — все 6 search items + §1.5 probes RUN, не закрывать раньше
- **T7** — adversarial counter-prompts: «какой class C decisions я мог пропустить кроме A и B?», «какой companion НЕ в моём списке мог решать аналогичный вопрос?»
- **T11** — prior-art check ДО proposing любой новой mechanism / rule
- **T12** — WebSearch at proposing-moment, не from training data
- **T13** — ADOPTED-MECHANISM audit — не trust SSOT entries как terminal authority; verify upstream evidence depth
- **T15** — self-application: does THIS research patch itself follow its own emerging best-practices? Например если research recommends «ship MVP» — does this patch ship MVP или waits for perfect?
- **T16** — problem-class match verbatim для каждого companion (например: «Superpowers `allowed-tools` problem class = X; ours = permission-boundary calibration for skill helpers; match? evidence: …»)
- **T19** — own cold-QA pre-handoff
- **T20** — no inline verdicts without evidence-bearing tool call same turn

Domain-specific (this R-phase, NOT в canonical catalogue):

- **T-N5 — assuming inline maintainer recommendation = research-backed verdict.** AI tempted to take «I lean B because SOLID» from PR #261 dialogue as established research-backed truth. **Counter:** the entire purpose of this R-phase is to BACK those inline recommendations with evidence. Re-prove or refute from primary sources.
- **T-N6 — assuming companion = upstream authority without classification audit.** Companions (Superpowers, Cline, OMO) могут разделять problem-class частично или быть orthogonal. T16 demands verbatim problem-class match. Не trust analogy by name.
- **T-N7 — N6b portability bias.** AI tempted либо overweight portability concerns (нужно всё делать harness-agnostic prematurely) либо underweight (CC-native всё OK forever). N6b is real future surface but not yet activated. Counter: cite [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) Internal vs Consumer-facing distinctions; classify each decision with evidence of who consumes it.

---

## §5 Verdict criteria

R-phase verdict — one of:

- **Class A verdict (DN-1 resolution):** Option A (broad `Bash(bash *)`) / Option B (narrow per-helper abs-path entries, e.g. `Bash(bash helpers/foo.sh)` × N) / Option C (glob, e.g. `Bash(bash helpers/*.sh)`) / Option D (new — narrow allow + targeted deny) / DEFER (need additional probe / companion-evidence not yet found) / NEW-OPTION-E (emerged from §1). **Phase -1 M1 amend:** Option B was missing from prior version — it is the per-helper-entry baseline that PR #261 §403 frames; Worker must consider it explicitly, not as «redundant with A or C».
- **Class B verdict (DN-4 reaffirmation):** confirm «defer F.6 entirely» / revise to «ship hygiene with new mechanism X» / surface new framing
- **Optional rule draft:** if Class B research surfaces reusable pattern → draft discipline rule with class + authoritative-for + falsifier
- **Companion-survey output:** comparison matrix as standalone reference (could become its own document or stay inside research-patch)

Verdict body MUST include (per [`recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md)):
- Cited evidence (SSOT row IDs, file:line, command outputs, WebFetch excerpts)
- Falsifier («wrong if …»)
- BFR posture per [`build-first-reuse-default.md §1`](../../../.claude/rules/build-first-reuse-default.md)
- Classifier-compatibility & permission-friction score
- I-phase preview (next umbrella sketch if Class A landed)

---

## §6 §1.7 self-reflexive plan

This kickoff itself complies with:
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item checklist scaffold present
- [`ai-laziness-traps.md §3`](../../../.claude/rules/ai-laziness-traps.md) — T-numbers enumerated, domain-specific T-N5/T-N6/T-N7 added
- [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — surfaces DECISION-NEEDED, doesn't pick mid-research
- [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — research uses DeepWiki + WebSearch + WebFetch, no CI-side LLM
- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — 5 of 6 layers applied (DeepWiki + WebSearch + BFR sweep + SSOT consult + this rule macro-level). **Phase -1 M3 amend:** BFR §3 layer 1 (Prior-art commit trailer) is explicitly inapplicable — this is R-phase markdown output, NOT a capability commit per [CLAUDE.md «Build-vs-reuse invariant (Phase 8.8)»](../../../CLAUDE.md). Trailer requirement fires only at I-phase implementation commit time, not at R-phase research-patch land.

Backward check: this kickoff doesn't supersede any existing rule; extends DN-1/DN-4 inline analysis from PR #261 into research-backed form.

---

## §7 See also

- [PR #261 — `meta-orch-no-arg-laziness` R-phase](https://github.com/Yhooi2/rules-as-tests-aif/pull/261) — prerequisite + source of DN-1/DN-4 framing
- [`meta-orch-no-arg-laziness/kickoff.md`](../meta-orch-no-arg-laziness/kickoff.md) — original R-phase umbrella
- [`phase-research-coverage.md §1`](../../../.claude/rules/phase-research-coverage.md) — 6-item checklist binding
- [`build-first-reuse-default.md §3`](../../../.claude/rules/build-first-reuse-default.md) — 6-layer search mechanism (DeepWiki + WebSearch order)
- [`dual-implementation-discipline.md §3`](../../../.claude/rules/dual-implementation-discipline.md) — Internal vs Consumer-facing triage (DN-4 N6b angle)
- [`recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md) — discipline this kickoff fixes (inline recommendations → research-backed)
- [`ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) — T-trap catalogue

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
