<!-- scope:anti-laziness-earliest-channel -->

# Anti-laziness earliest-channel gap — BFR-reinvention + scope-from-memory (2026-07-02)

> **Scope:** self-reflection research-patch, one gap. Folder authority: [research-patches/](./) is scope-bound by gap per [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md) — no per-file Authoritative-for header required. **This patch is research + proposal only; it edits no rule and builds no mechanism** (per the session brief). The §1.7 self-review sits at the foot of this file.

## Problem

Two AI-laziness failures recurred in one `/orchestrator` session (2026-07-02). Both are a **recursive-self-application gap turned on the project's own operating rules**: the disciplines that should have caught each one *exist as project rules* but are delivered on channels that rank below "deterministic action-scoped" ([rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md)), so neither fired at the moment of the action. The **human operator was the de-facto gate, twice** — the precise failure this project exists to prevent («every rule fails at the earliest reachable channel — CI is last resort», [README.md#why-this-exists](../../../README.md)).

### Incident 1 — BFR-reinvention (`#parallel-evolution-creep`)

PR #858 shipped `.claude/skills/night-mode/SKILL.md` re-describing the executor + dual-reviewer + planner loop **already owned by Superpowers `subagent-driven-development` (SSOT #64, ADOPT)**. The operator caught it; PR #859 slimmed it to a thin adapter.

```text
$ git show 35c0b4104:.claude/skills/night-mode/SKILL.md | wc -l
87                                    # the reinvention (brief estimated ~160; observed 87 — T6 calibration)
$ wc -l .claude/skills/night-mode/SKILL.md
44 .claude/skills/night-mode/SKILL.md # the post-#859 thin adapter
$ git log --oneline -2 -- .claude/skills/night-mode/SKILL.md
8ba007237 refactor(skill): slim night-mode to a thin layer over subagent-driven-development (#859)
35c0b4104 feat(skill): night-mode — reusable autonomous-overnight orchestration protocol (#858)
```

The 87-line body did not merely omit a citation — it **re-described SDD's roster as its own authoritative content**:

```text
$ git show 35c0b4104:.claude/skills/night-mode/SKILL.md | sed -n '6,7p;24p'
> **Authoritative for:** the autonomous-overnight orchestration protocol — the role roster + model tiers,
  the execute → dual-review → converge → planner loop, ...
> **NOT authoritative for:** ... General delegation / Mode A-B / Queue mode — that is the global `orchestrator`
  skill (this is its unattended-overnight specialization, REFERENCE it). ...
## Roles + model tiers            # ← a full re-description of Executor + 2 reviewers + Planner
```

The `NOT authoritative` line pointed at `orchestrator` (REFERENCE) — **not at SDD**, the actual owner of the loop the body re-described. Contrast the post-#859 thin version, which correctly subordinates:

```text
$ sed -n '7p' .claude/skills/night-mode/SKILL.md
> **NOT authoritative for:** the executor + dual-reviewer dispatch loop itself — that is
  `superpowers:subagent-driven-development` (SSOT #64, ADOPT), which this skill layers over, never re-describes.
```

### Incident 2 — scope-from-memory (`#claim-from-memory-not-source`)

The agent scoped an autonomous launch prompt to "implement D1" from its own recollection, when the spec defines the chain as **D1 → B, B dispatched immediately after D1 merges**. The operator caught it; the agent then re-read the spec and corrected to D1→B.

```text
$ sed -n '242,246p' docs/superpowers/specs/2026-07-02-diagnostics-core-design.md
## §9 Stage B (scheduled) — research pipeline as gates

**Maintainer decision 2026-07-02: B is a scheduled stage, dispatched immediately after D1 merges**
— not trigger-gated. Scope is the research pipeline ONLY ...
```

## Root Cause

### One failure family, two surfaces

Surface-different — reuse-overlap (SSOT) vs. scope-source (spec) — but they share **one mechanism-level shape**:

> **The agent committed to an artifact's shape from its internal state (a training-data mental model, or session recollection) at an authoring/scoping moment that has no action-scoped gate — when the authoritative external source was one cheap probe away and would have changed the artifact.**

Incident 1: one `grep subagent-driven docs/meta-factory/prior-art-evaluations.md` (SSOT #64) before writing the body would have driven a thin-adapter shape. Incident 2: one `sed -n '242,268p' <spec>` before scoping would have surfaced D1→B. In both, the external source was authoritative, cheap, and unread-at-the-decisive-moment.

**Mapping to existing traps / anti-patterns** (both incidents are already *named* — nothing here is an unnamed failure mode):

| Incident | Existing trap / anti-pattern | Rule |
|---|---|---|
| 1 | T11 «designing without prior-art check» · T16 «pattern-matching-on-name» | [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md) |
| 1 | `#parallel-evolution-creep` · `#own-stack-blind-spot` | [build-first-reuse-default.md §4](../../../.claude/rules/build-first-reuse-default.md) |
| 2 | `#claim-from-memory-not-source` (§1.11) | [phase-research-coverage.md §4](../../../.claude/rules/phase-research-coverage.md) |

### Why the existing disciplines under-fired (the sharp finding)

Both disciplines exist. Both are delivered on channels that [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md) ranks **below** "deterministic action-scoped matcher":

- **BFR (`build-first-reuse-default.md`)** carries **no `paths:` frontmatter and no `<!-- globs: -->` marker** → it is delivered only as the CC session-start always-on load of every `.claude/rules/*.md`. Always-on ≠ action-moment salience: the rule is *in context* but nothing surfaces it **at the `Write` of a new `SKILL.md`**. Per §1 «semantic/always-on ranks BELOW deterministic; a deterministic matcher strictly dominates when narrower than every-turn».
- **§1.11 (`phase-research-coverage.md`)** *is* path-scoped — but its `paths:` are `docs/meta-factory/phase-*-research.md`, `prior-art-evaluations.md`, `research-patches/**`. The violating action (authoring a launch prompt under `.claude/orchestrator-prompts/**`) is **entirely outside §1.11's injection scope** — the rule cannot fire on a surface it does not cover.

**The only mechanical catch was principle 11 F1 — and it checks trailer PRESENCE, not reuse SUBSTANCE.** PR #858's introducing commit carried a *correct-sounding* trailer, and it passed F1/F3:

```text
$ git show --format=%B -s 35c0b4104 | grep -i 'Prior-art:'
Prior-art: prior-art-evaluations.md#64 (Superpowers subagent-driven-development, ADOPT — night-mode
ADAPTs the coordinator + implementer + dual-reviewer subagent loop for unattended overnight execution;
own-stack specialization of the orchestrator Queue mode, zero new dependency).
```

The trailer **said the right thing** («ADAPTs the loop», «zero new dependency») while the body **did the wrong thing** (re-described the loop as its own authoritative content). F1 verifies a trailer exists with a ≥20-char non-placeholder rationale ([11-build-first-reuse-default.test.ts:201-211, 268-284](../../../packages/core/principles/11-build-first-reuse-default.test.ts)); it **cannot compare the trailer's ADAPT/layer-over claim to what the body actually does**. This is `#discipline-theatre` ([phase-research-coverage.md §4](../../../.claude/rules/phase-research-coverage.md)) applied to the BFR trailer itself: form satisfied (citation + verdict + rationale present), substance violated (body reinvents). The BFR consult happened — but as a **post-hoc recording (trailer)**, not as an **authoring input (let reuse drive the body)**. The recording layer is checked (F1); the searching/shaping layer is not.

## Channel analysis + recommended mechanism

Per the [rule-enforcement-channel-selection.md §1](../../../.claude/rules/rule-enforcement-channel-selection.md) detectability axis:

| Question | Verdict |
|---|---|
| Is «reinvented an existing capability» mechanically detectable? | **No — judgment.** Semantic overlap between a new markdown capability doc and an existing skill/SSOT entry is not a regex/AST fact. |
| Is «scoped a dispatch from memory, not the spec» detectable? | **No — judgment.** «Did the author read the source before scoping?» leaves no mechanical trace. |
| Is any *narrow* slice detectable? | **Trailer↔body verdict consistency** is *partially* detectable but FP-prone (the night-mode body *did* reference `orchestrator`, just not SDD). Not worth a gate — see below. |

Both incidents are **judgment → injection only** (a gate on a judgment rule is `#gate-where-judgment-needed`, [§5](../../../.claude/rules/rule-enforcement-channel-selection.md); it is the same reason the recommendation-laziness narrow-B verdict-scan was dropped at FP 84%, [recommendation-laziness-discipline.md §4](../../../.claude/rules/recommendation-laziness-discipline.md)). Any *semantic* overlap check, if ever built, is judgment that needs an LLM → **must be an AI-agnostic sub-agent read by an active session, never a CI gate** ([no-paid-llm-in-ci.md §1:20](../../../.claude/rules/no-paid-llm-in-ci.md)).

### BFR-consult on the mechanism itself (6-item search — T15, not asserted from memory)

Run 2026-07-02. «Does an upstream tool gate capability-reuse / prior-art-overlap at creation time?»

- **Own-stack (SSOT sweep):** no entry for a reuse-overlap gate. **DeepWiki `obra/superpowers` (2026-07-02):** *«Superpowers does not have an automated mechanism, hook, or skill that detects overlapping skills before creation; `writing-skills` checks structure + description quality; prior-art is a manual human step.»* → even the ADOPTed source treats reuse-before-build as **authoring-time human discipline, not a gate**.
- **Code-clone tools** (SonarQube, jscpd, PMD-CPD, IntelliJ inline, `platisd/duplicate-code-detection-tool`) → **REJECT** for this problem class: line/token-level clone of *code*; would not fire on a semantically-overlapping *markdown* skill doc (T16 problem-class miss). `CodeAnt AI` («spots when someone rewrites a utility instead of reusing it») is the closest but is paid PR-review AI → **REJECT-as-gate** ([no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md)), code-only.
- **Agent-skill research** (CyberEvolver arxiv 2605.26195; AlignEvoSkill 2506.23149; W&B/Reco guardrail guides) → **ADOPT VOCABULARY**: «dedup-first — audit the skill set before creating; Merge > Improve > Create > Delete; two skills sharing a bottleneck nucleus MUST merge». The state-of-art solution is a **prompt/protocol (injection)**, not a mechanical gate — converging with the detectability verdict above.

**Verdict:** no drop-in gate exists or *should* exist (judgment problem). The mechanism, if the follow-up builds it, is a **minimal-BUILD reuse of the existing injection channel** — no new engine.

### RECOMMENDED earliest-reachable mechanism (injection, not gate)

An **edit-time PostToolUse injection** via the already-wired [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) ([settings.json:114](../../../.claude/settings.json)) — no new engine. Add a `<!-- globs: -->` + `<!-- inject: -->` marker (the hook's glob subset is `prefix/**` | `*.ext` | exact, [inject-matching-rule.sh:44-51](../../../.claude/hooks/inject-matching-rule.sh)) on:

- `.claude/skills/**`, `agents/**`, `packages/core/**` → surface **BEFORE authoring a new capability**: *«New capability? Run the BFR consult NOW as an input, not a trailer: grep SSOT + existing skills/agents for overlap on this capability-area; if an own/upstream analog exists → thin-adapt or write an explicit BUILD justification; your Prior-art verdict (ADAPT/layer-over) must match what the body does, not just cite it.»*
- `.claude/orchestrator-prompts/**` → surface **BEFORE scoping a dispatch**: *«Scoping a dispatch/launch? Re-read the spec/source-of-truth for the scope chain (§1.11) — do not scope from recollection.»* (rides the same glob family already used by [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md)).

**Why it beats principle 11 F1:** F1 fires at **push time** and checks trailer *presence*; the reinvention is already written by then. The injection fires at **edit time** — the earliest reachable channel, one step before the reinvention exists — and surfaces the *substance* prompt at the moment the agent can still choose to reuse. It does **not** verify reuse mechanically (it cannot — judgment); it is a mitigation that moves the surfacing earlier and makes the consult an *input*.

**False-positive profile (honest):** the hook cannot distinguish file *creation* from *edit*, and `packages/core/**` over-fires on every core edit. Injection FP-cost is low and bounded — `inject-matching-rule.sh` fires **once per session per rule** (session-cache keyed on `session_id`). Accepted: for an injection, a once-per-session reminder on an editing-adjacent path is cheap; for a gate it would be intolerable — which is exactly why this is injection, not gate.

## Prevention — the PRIORITY-CHECK rule (load-bearing)

> **PRIORITY-CHECK «source-before-shape»:** before an authoring or scoping action that *commits to an artifact's shape* — creating a new capability file (`SKILL.md`, `agents/*.md`, a new `packages/core/<dir>/`), or scoping a dispatch/launch/kickoff — the authoritative external source MUST be read **first and as an input to the shape**, not consulted post-hoc as a trailer or correction:
> - **Reuse surface:** `grep` the SSOT + existing `skills/`+`agents/` for overlap on the capability-area. If an own-stack or upstream analog exists, the body is a **thin adapter that subordinates to it** (`NOT authoritative for: <the loop> — that is <owner>, which this layers over, never re-describes`), OR the commit carries an explicit BUILD justification whose verdict **matches what the body does**. A correct-sounding ADAPT trailer over a re-describing body is `#discipline-theatre`, not compliance.
> - **Scope surface:** re-read the spec's scope/chain section (`sed`/`Read` the actual lines) before scoping any dispatch. A scope stated from recollection is provisional until the source is quoted.

Not «be more careful»: the load-bearing verb is **read the source as an input to the shape**, delivered at edit-time so it fires before the artifact exists.

## Promotion check (RQ4) + incident counter

- **No new trap this session.** Both incidents map cleanly onto *existing* traps (T11, T16, `#parallel-evolution-creep`, `#claim-from-memory-not-source`). [ai-laziness-traps.md §5](../../../.claude/rules/ai-laziness-traps.md)'s promotion criterion abstracts **2+ wave-specific T-additions of the same shape** into §2 — these are not T-additions, so it does **not** fire. The closer analog (the T20 pattern: «3+ documented incidents in `.claude/rules/`/`research-patches/`, each with file:line») is at **1 session / 2 events**, below threshold. **Do not edit `ai-laziness-traps.md` this session** (per brief).
- **Incident counter (record) — PROMOTION FIRED:** *family «existing BFR/§1.11 discipline under-fires at an ungated authoring/scoping moment» = 2 events / 1 session (2026-07-02, PR #858 + the D1-scope prompt). Threshold to promote = a recurrence in a **separate** session, or a 3rd event.* The operator confirmed the recurrence («это уже не первый раз», 2026-07-02) — the threshold fired and the §Prevention rule was **shipped the same session** as a wired mechanism (see Resolution below), not deferred.
- **Candidate §2 T-entry (surfaced, NOT applied)** — for the maintainer to accept if/when the counter hits threshold. It names the distinct shape the existing traps do **not** cover: *the prior-art consult happened but as a post-hoc trailer, not an authoring input*:

  > **T-cand — «consult-as-trailer, not consult-as-input».** Trigger: authoring a new capability (skill/agent/module) whose problem-class plausibly overlaps an own-stack or upstream tool. Tempted output: write the body from the internal mental model, then satisfy BFR by *appending a correct-sounding `Prior-art:` trailer* — the consult recorded but too late to shape the artifact (body reinvents while the trailer says «ADAPT»). This passes principle 11 F1 (presence check) — `#discipline-theatre` on the trailer. Counter: run the SSOT/existing-skill overlap `grep` **before** writing the body and let its result drive the shape (thin-adapter that subordinates, or an explicit BUILD justification the body honours); the trailer's verdict must match what the body does. Sibling of T11 (T11 = *no* consult; this = consult *mis-timed*).

## Resolution — mechanism shipped (2026-07-02, same session)

Operator confirmed the cross-session recurrence and authorized the build. Shipped:

- **[`.claude/rules/source-before-shape.md`](../../../.claude/rules/source-before-shape.md)** (Class B) — the edit-time delivery layer for the §Prevention PRIORITY-CHECK, subordinate to BFR §4 + §1.11 (mechanism-layer pattern, mirrors [`recommendation-laziness-discipline.md`](../../../.claude/rules/recommendation-laziness-discipline.md)). Carries `<!-- globs: .claude/skills/**, agents/**, .claude/orchestrator-prompts/** -->` + `<!-- inject: … -->` → the source-before-shape reminder now fires at edit-time via [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) (dogfood-verified live: the injection fired on this session's own Write of the rule + the agent). `packages/core/**` deliberately excluded (once-per-session delivery would be spent on the first frequent core edit) — documented, not silently dropped.
- **[`agents/capability-reuse-auditor.md`](../../../agents/capability-reuse-auditor.md)** (Layer B) — the AI-agnostic semantic overlap + trailer↔body verdict-consistency auditor (no-paid-llm §1), doing the substance pass principle 11 F1 structurally cannot.
- **[SSOT #196](../../../docs/meta-factory/prior-art-evaluations.md)** — ADAPT verdict recording the 6-item BFR-consult (REUSE inject-channel + ADAPT dedup-first; REJECT code-clone tools; REFERENCE Superpowers manual prior-art).
- **principle 09 registration** — both new files added to `REQUIRED_HEADER_DOCS`.

**On the candidate T-entry (`#consult-as-trailer-not-input`):** surfaced-not-applied to `ai-laziness-traps.md` (a T-addition's §5 promotion criterion — «2+ wave-specific T-additions of the same shape» — does not fire; and the discipline now has a dedicated rule home rather than a catalogue line, avoiding `#trap-list-grew-without-pruning`). The anti-pattern lives in [`source-before-shape.md §4`](../../../.claude/rules/source-before-shape.md); `ai-laziness-traps.md` is left unedited (Artifact Ownership Contract).

## §1.7 Forward-check applied

The recommended mechanism (edit-time injection) and this patch comply with each active layer:

- **no-paid-llm-in-ci** — the mechanism is deterministic bash on the existing hook; any future *semantic* overlap pass must be an AI-agnostic sub-agent per [no-paid-llm-in-ci.md §1:20](../../../.claude/rules/no-paid-llm-in-ci.md) («Any semantic LLM check ships as an AI-agnostic sub-agent … consumed by an active AI session»), never a CI gate.
- **build-first-reuse-default** — the mechanism **REUSEs** [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) (no new engine); the 6-item BFR-consult above ran DeepWiki + WebSearch ≥3 phrasings and produced the REJECT/ADOPT-VOCABULARY/REFERENCE verdicts rather than asserting «nothing exists» from memory ([build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md)).
- **rule-enforcement-channel-selection** — the detectability verdict (judgment → injection, not gate) applies [§1](../../../.claude/rules/rule-enforcement-channel-selection.md) directly; the glob subset used is the hook's real capability at [inject-matching-rule.sh:44-51](../../../.claude/hooks/inject-matching-rule.sh).
- **doc-authority-hierarchy** — this file needs no per-file header (folder-scoped, [doc-authority-hierarchy.md §5](../../../.claude/rules/doc-authority-hierarchy.md)); it edits no authority-bearing doc.
- **recommendation-laziness (H1)** — every verdict here carries a command+output or file:line; the «no gate should exist» claim is falsifiable (see Backward-check).

## §1.7 Backward-check applied

Sweep of the surfaces the §Prevention rule would scope, confirming it neither contradicts nor duplicates an existing mechanism:

- **`packages/core/principles/11-build-first-reuse-default.test.ts`** — F1 is presence-only ([:201-211](../../../packages/core/principles/11-build-first-reuse-default.test.ts) `isValidTrailerRationale` checks length + placeholder words, [:268-284](../../../packages/core/principles/11-build-first-reuse-default.test.ts) `assertF1` checks trailer-or-SSOT existence). The §Prevention rule is **complementary, not duplicative**: it targets the substance F1 structurally cannot reach, at an earlier channel.
- **`.claude/rules/phase-research-coverage.md`** — §1.11 already states «verify against source, not memory» but its `paths:` ([:3-8](../../../.claude/rules/phase-research-coverage.md)) do not cover `.claude/orchestrator-prompts/**`; the recommended injection *extends delivery* to that surface, it does not restate the rule.
- **`.claude/hooks/inject-matching-rule.sh`** — glob subset ([:44-51](../../../.claude/hooks/inject-matching-rule.sh)) can express `.claude/skills/**` / `agents/**` / `packages/core/**` / `.claude/orchestrator-prompts/**` (all `prefix/**`), so the mechanism is buildable on the shipped channel with zero new code — verified, not assumed.
- **Falsifier:** this patch is **wrong** if a 3rd occurrence exposes a *structural* pattern a deterministic gate *would* catch (e.g. every reinvention shares a detectable trailer↔body divergence) — then the §Prevention promotion target flips from injection to a narrow gate, and the T20-style recall caveat no longer applies.

## Tags

`#parallel-evolution-creep` · `#own-stack-blind-spot` · `#claim-from-memory-not-source` · `#discipline-theatre` · `#recursive-self-application-gap` · `#gate-where-judgment-needed` · `#consult-as-trailer-not-input` (candidate)
