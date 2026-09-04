# Phase 10 — project foundations audit & re-evaluation (umbrella kickoff)

> **Status:** DISPATCHED (full autopilot) — maintainer GO + «на автопилоте проведи все» 2026-06-27 via `/pipeline phase-10-foundations-audit`. All 6 streams A1-A6 launched in parallel (background research agents); umbrella summary (§7b) gated on all 6 completing. Soft A1→A2/A4 dependency handled per T-Phase10-F (surface reframes in summary, NOT silent re-scope). Maintainer authorised parallel pacing explicitly.
>
> **Trigger spec (per [open-questions.md §13.32](../../../docs/meta-factory/open-questions.md)):** Wave 9 closes AND maintainer commits to Phase 10 scope incl. possibility of foundational refactor.
>
> **Trigger state (as of 2026-06-27):** FIRED. Wave 9 closed [PR #51](https://github.com/Yhooi2/rules-as-tests-aif/pull/51) merged 2026-05-13T10:02:48Z (`gh pr list --search "wave-9" --state merged`, re-verified MERGED 2026-06-27). Maintainer commitment to Phase 10 scope — **CONFIRMED** 2026-06-27 (maintainer instruction «актуален → го»).
>
> **§11.3 dispatch-refresh (2026-06-27, supersedes 2026-05-17 scaffold-authoring snapshots below for dispatch):** principle slots **28** (30 `.test.ts` files incl. paired-negative variants) ⟵ was 11; `.claude/hooks/*.sh` **14** ⟵ was 4; `agents/*.md` **8** ⟵ was 4; `.claude/skills/*/` **9** ⟵ was 3; `.claude/rules/*.md` **15**. A2 §population enumeration commands below remain valid — re-run them at A2 dispatch; the inline "at scaffold authoring" counts in §3-A2 are historical, not current.

---

## Companion sessions / cross-context (parallel scope — do not duplicate)

- [`autonomous-self-audit-research/research-prompt.md`](../autonomous-self-audit-research/research-prompt.md) — §13.34 sibling, addresses orthogonal layer (autonomous-self-trigger-of-AI, not foundations-of-mechanisms). May surface findings relevant to A2 (mechanism choices) but **separate research-patch**.
- [`wave-9-discipline-theatre-audit/`](../wave-9-discipline-theatre-audit/) — Wave 9 R-phase + I-phases (closed PR #51). Phase 10 builds on Wave 9 findings — DO NOT redo Wave 9 surface scope.
- [`d2-dual-implementation-design/`](../d2-dual-implementation-design/) — PR #68 **MERGED 2026-05-17T05:09:24Z**. Includes new `.claude/rules/dual-implementation-discipline.md` in A2/A6 populations (+1 rule, +1 doc with Authoritative-for header to audit). At dispatch: re-verify rule landed on main via `git log --oneline --all -- .claude/rules/dual-implementation-discipline.md`.
- [`wave-10-hook-architecture/kickoff.md`](../wave-10-hook-architecture/kickoff.md) — §13.33 ARMED, A2 (mechanism choices for hooks: bash→TS-core migration) + A5 (Danger JS as runtime engine) overlap. Coordinate via maintainer if both active.
- §13.35/13.36/13.37 (Superpowers ADAPT candidates, ARMED 2026-05-16) — A2 skills stream may interact when these counters fire. See [open-questions.md §13.35-37](../../../docs/meta-factory/open-questions.md).

---

## §1 Context

Phase 10 audits **foundational adequacy** — whether chosen mechanisms reflect best current understanding of the problem domain. Distinct from Wave 8 (CI/hook substance) and Wave 9 (behavioral compliance). Every load-bearing decision (PROPOSAL theses, EXECUTION-PLAN, R1-R20, principles 01-10 + design-stage 11 + slot 14 merged + any further slots merged by dispatch time per §11.3, hook substance arms, CI gates, AI-agnostic sub-agents, SSOT format, doc artefacts incl. CLAUDE.md / INSTALL-FOR-AI three-layer model / `.claude/rules/*`) was made with **internal reasoning + context7 only** — external literature was never part of methodology. Project-wide gap from day one; the `#discipline-theatre` antipattern (`§13.29`) likely originates here.

**Origin** (maintainer 2026-05-12 during Wave 8.4): «возможно слишком узкий [ресёрч] … все правила и все их реализации прям ВЕСЬ проект». Wave 9 «research methodology adequacy» partially captures but scoped to R-phase docs only.

## §2 Goal of this umbrella — research, not implementation

Through six audit streams (A1-A6 below) + 5-class scope reduction + recursive self-application gate, determine:

- Which foundational decisions are **load-bearing AND validated externally** → keep
- Which are **load-bearing AND validated only internally** → escalate to OWN-BUILD-class audit depth (per AIF-chain mitigation in §4)
- Which are **load-bearing AND contradicted by recent external evidence** → surface as DECISION-NEEDED candidates for maintainer dialogue (NOT autonomous revision per Artifact Ownership Contract in [`CLAUDE.md`](../../../CLAUDE.md))
- Which are **not load-bearing** → mark for potential retirement (defer to maintainer)

**Out of scope** for this umbrella session: implementation of any change, modification of [`README.md`](../../../README.md) / [`docs/meta-factory/PROPOSAL.md`](../../../docs/meta-factory/PROPOSAL.md) / [`docs/meta-factory/EXECUTION-PLAN.md`](../../../docs/meta-factory/EXECUTION-PLAN.md) or other maintainer-owned artefacts, rule codification.

## §3 Six audit streams (A1-A6)

Each stream produces ONE research-patch under `docs/meta-factory/research-patches/2026-MM-DD-§13.32-A<N>-<slug>.md`. Streams are independent — may be sequenced or parallelised per maintainer pacing.

### A1 — Architectural foundations

**Scope:** PROPOSAL.md theses, EXECUTION-PLAN.md phase decomposition, repository topology (`packages/` split, `agents/` purpose, `skills/` boundary, `.claude/` vs `docs/meta-factory/` separation).

**Sample population:** PROPOSAL §1-§10 theses; EXECUTION-PLAN §1 goal + §5 phases; architecture.md §1-§6.

**Per-item audit:** (a) what external literature exists on this architectural pattern as of 2026? (b) was this pattern adopted in PROPOSAL with cited prior art or invented internally? (c) does the pattern still match the documented goal as of 2026-05-17?

### A2 — Mechanism choices

**Scope:** every named mechanism — R1-R20 lint rules, principles 01-10 + slot 11 (`11-build-first-reuse-default.design.md` — design-stage markdown, no `.test.ts`) + slot 14 (`14-skill-drift-detection.test.ts` — merged 2026-05-16 PR #65); re-verify slots 12, 13, 15+ status at dispatch per §11.3. `.husky/pre-push` substance arms, `.claude/hooks/*` (4 files at scaffold authoring; all registered in `.claude/settings.json` UserPromptSubmit array), GH Actions jobs, AI-agnostic sub-agents (`agents/*.md`), skills (`.claude/skills/*/SKILL.md` project-local + `packages/core/templates/.claude/skills/*` consumer-shipped — separate populations).

**Sample population:** enumerate via `grep -rn "^### R" docs/`, `ls packages/core/principles/*.test.ts` (11 files at scaffold authoring 2026-05-17: 01-10 + 14), `ls .claude/hooks/` (4 files at scaffold authoring: check-doc-authority.sh, deps-hash-check.sh, inject-session-bootstrap.sh, validate-prompt.sh — registration in settings.json verifiable via `grep "hooks/" .claude/settings.json`), `ls agents/` (4 files), `ls .claude/skills/` (3 project-local directories) + consumer-shipped skills under `packages/core/templates/` (verify path at dispatch). Expected count ~60-80 mechanisms (R1-R20 + 11-15 principles depending on slot merges + 3 GH + 4 registered hooks + 4 agents + 3 project-local skills + ~1-N consumer-shipped skills + per-rule arms in pre-push).

**Per-item audit:** (a) build-vs-reuse class (5-class table in §4); (b) for OWN-BUILD: what alternative tools/patterns exist externally? (c) for ADAPTED/ADOPTED: upstream problem-class match per T16; (d) what is the alternative if this mechanism were stripped tomorrow?

### A3 — AI-agnostic boundary

**Scope:** `agents/*.md` (compliance-verifier, docs-auditor, best-practices-sidecar, review-sidecar), [`INSTALL-FOR-AI.md`](../../../INSTALL-FOR-AI.md) three-layer authority model, [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) policy.

**Sample population:** 4 `agents/*.md` files + INSTALL-FOR-AI three-layer section + no-paid-LLM rule + every reference to «AI-agnostic» across repo (grep).

**Per-item audit:** (a) does the «AI-agnostic» framing hold under inspection — does the artefact actually work consumed by Cursor / Codex / Aider sessions, or is it Claude-Code-only by hidden assumption? (b) is the three-layer model (framework / preset / consumer) coherent with current install.sh logic? (c) what external prior art exists on AI-agnostic prompt portability as of 2026?

### A4 — AIF integration depth re-evaluation

**Scope:** every SSOT entry referencing AIF / aif-handoff / aif-runtime (#8, #27-#32, #42-#47 per latest count — re-verify highest entry ID at audit time via `grep -nE "^\| *[0-9]+ *\|" docs/meta-factory/prior-art-evaluations.md | tail -5`). Decisions to ADOPT / ADAPT / REFERENCE these. INSTALL-FOR-AI alignment with AIF install patterns.

**Sample population:** `grep -nE "AIF|aif-" docs/meta-factory/prior-art-evaluations.md`; `aif-comparison.md` if present.

**Note:** A5 stream (external tooling) audits non-AIF SSOT entries that are equally load-bearing — at scaffold authoring this includes #39 (StrykerJS ADOPT), #40 (Bats WATCHLIST), #41 (Danger JS ADOPT). Cross-reference A5 enumeration with this list to avoid double-counting.

**Per-item audit (AIF-chain risk):** AIF itself may be context7-only validated. For each ADOPTED-FROM-AIF item: confirm AIF had external evidence for the pattern, OR escalate to OWN-BUILD-class audit depth per T13 («ADOPTED items not zero-work»). This is the dominant risk in A4 — chained adoption without breaking the chain at the originating source.

### A5 — External tooling

**Scope:** every npm dep in `package.json` (`grep -E '^\s*"[^"]+":\s*"\^?[0-9]'`), context7 MCP, deepwiki MCP, Stryker mutation testing, Vitest, Husky, etc. Excludes transitive deps.

**Sample population:** `package.json` direct deps + `claude mcp list` output + any tool referenced as load-bearing in `prior-art-evaluations.md`.

**Per-item audit:** (a) is this tool still maintained as of 2026-05? (b) is the version pin reasonable (recent enough to receive security patches)? (c) does the project's *use* of the tool match the tool's documented best practices, or are we using it in an unsupported way?

### A6 — Documentation artefacts

**Scope:** [`README.md`](../../../README.md), [`CLAUDE.md`](../../../CLAUDE.md), [`INSTALL-FOR-AI.md`](../../../INSTALL-FOR-AI.md), [`CONTRIBUTING.md`](../../../CONTRIBUTING.md), [`docs/meta-factory/architecture.md`](../../../docs/meta-factory/architecture.md), every `.claude/rules/*.md`, every `.claude/skills/*/SKILL.md`, every `agents/*.md`. Verify Authoritative-for / NOT-authoritative-for headers per [`doc-authority-hierarchy.md §3`](../../../.claude/rules/doc-authority-hierarchy.md) match actual doc content.

**Sample population:** enumerate via `ls` + per [`packages/core/principles/09-doc-authority-hierarchy.test.ts`](../../../packages/core/principles/09-doc-authority-hierarchy.test.ts) `REQUIRED_HEADER_DOCS`.

**Per-item audit:** (a) is the Authoritative-for scope statement accurate against the doc's current content? (b) are there contradictory authority claims with sibling docs (per §4 anti-pattern `#contradicting-authority-claims`)? (c) for frozen docs (PROPOSAL.md): has any substantive content edit slipped in beyond the FROZEN charter?

## §4 Five-class scope reduction (AIF-chain mitigation built-in)

Apply this table BEFORE sweeping each stream — reduces ~120 items to ~70-80 effective points by per-class audit depth differentiation. Each item gets ONE class:

| Class | Definition | Sweep depth | AIF-chain risk handling |
|---|---|---|---|
| **OWN-BUILD** | Designed internally without external prior art | Full audit: external literature sweep + problem-class definition + alternative-tool enumeration | N/A — already own-build |
| **ADAPTED** | Took external pattern + modified for our problem-class | Sweep modifications + verify problem-class match (T16); upstream pattern OK out-of-scope | If upstream itself unvalidated → escalate to OWN-BUILD-class |
| **ADOPTED-MECHANISM** | Use external mechanism verbatim or with thin wrapper | 5-check integration audit: (1) upstream problem-class match (T16), (2) version current, (3) upstream still maintained, (4) our integration matches upstream best-practice, (5) drop-in alternative exists if needed | If upstream is itself context7-only validated → **promote to OWN-BUILD-class audit** per T13 |
| **ADOPTED-VOCABULARY** | Use external naming/vocabulary; implementation ours | Sanity-only: vocabulary consistent + no false-precedent claim («we adopted X» when implementation diverges) | Low risk; document divergence if material |
| **REJECTED** | External candidate surveyed + explicitly rejected | Rationale revalidation: is the rejection still valid in 2026 light? | N/A — already not adopted |

**Expected scope after reduction:** ~120 points → ~35-40% reduction → ~70-80 effective audit points across 6 streams. Estimate is **provisional** (T6); re-derive at each stream's §population enumeration.

**Tiebreaker for ADAPTED vs ADOPTED-MECHANISM** (per T-Phase10-D): if ANY runtime code from upstream is executed directly (npm dep, binary invocation, API call) → **ADOPTED-MECHANISM** (5-check integration audit including upstream maintenance). If only the *pattern or vocabulary* is used but implementation is entirely ours → **ADAPTED** (sweep modifications + T16 problem-class match) or **ADOPTED-VOCABULARY** (sanity-only). Distinguish ADAPTED from ADOPTED-VOCABULARY by: does our implementation reproduce the *behaviour* upstream achieved (ADAPTED) or only borrow naming (ADOPTED-VOCABULARY). When ambiguous after applying both heuristics → escalate to **ADOPTED-MECHANISM** (higher-effort class) per the «gravity-to-cheaper-class» anti-pattern in T-Phase10-D.

## §5 Methodology (applies across all 6 streams)

1. **Stream-level population enumeration BEFORE sampling.** Per T10. Each stream's first deliverable section = `§population` with explicit enumeration command + count. NO sampling claims without enumeration.
2. **5-class assignment per item.** Use table §4. Bulk assignment via spreadsheet-style table in stream's research-patch §2. When unsure between two classes — escalate to higher-effort class (anti-pattern: gravity-to-cheaper-class).
3. **Per-class sweep at the class's required depth.** Don't downgrade depth «to save time» — that's the original gap this umbrella addresses.
4. **Adversarial counter-prompt PER ITEM, not per stream.** Per T7. Cite the actual counter-prompt and its output in the research-patch.
5. **Search-coverage 10-item checklist invocation.** Per [`phase-research-coverage.md §1.1-§1.10`](../../../.claude/rules/phase-research-coverage.md). For every negative-existence claim in stream output («no external tool exists for X»), apply all 10 items. Mandatory: §1.1 (own-stack), §1.2 (category), §1.3 (semantic), §1.4 (adversarial), §1.5 (prompt-list floor not ceiling — closing at floor permitted only if §1.1-§1.4 hold), §1.6 (trigger sweep within the stream's scope), §1.7 (self-reflexive on any rule-introduction in stream), §1.8 (hook surface smoke-test — mandatory for any A2 finding touching `.claude/hooks/*` or `packages/core/hooks/*` or `.husky/pre-push`), §1.9 (SSOT citation existence-check — mandatory for any A2/A4/A5 finding citing a specific SSOT ID), §1.10 (type-system-over-prose — handled in step 6 below as it applies to a specific surface class, not generically across streams).
6. **§1.10 type-system-over-prose** when SDK-shaped claims surface (likely in A2 mechanism audit + A5 external tooling).
7. **Completion criteria per stream:** all items in stream's population have class assignment + per-class-depth audit applied + adversarial counter-prompt logged + negative-existence claims checklist-verified. NO partial close.

## §6 AI-laziness traps active (per [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md))

**Canonical T-list active:** T1, T2, T3, T4, T5, T6, T7, T9, T10, T11, T12, T13, T14, T15, T16. **T8 not active** — scaffold and per-stream prompts are self-contained; no maintainer clarification expected during execution beyond final DECISION-NEEDED dialogue.

- **T1 (depth floor):** sampling floor 5 per stream; recommended 20+.
- **T2 (design ≠ audit):** «would catch» language banned in stream findings — concrete invocation + concrete output required.
- **T3 (verification before claim):** every status claim about repo state (file existence, PR closure, count) requires command + output.
- **T4 (premature close):** stream completion criteria in §5.7 — NO partial close.
- **T5 (bundling implementation into R-phase):** restated separately in §8 — do NOT open Edit on source files (`.claude/rules/*`, `packages/core/*`, `.husky/*`) during any stream; findings → research-patch §recommendations only.
- **T6 (confidence calibration):** §4 «~120 → 70-80 items» scope estimate is **provisional**, must be re-derived at each stream's §population-enumeration time. Substitute explicit predicates («N/M items audited, coverage X%») for narrative «high confidence».
- **T7 (adversarial per item):** §5.4.
- **T9 (easy-surface sampling):** randomise within stream population, do NOT cherry-pick recent items where discipline is active.
- **T10 (enumerate before sample):** §5.1.
- **T11 (custom solution without prior-art):** all stream findings proposing rule/mechanism revision MUST search **DeepWiki `ask_question` ≥3 phrasings + WebSearch ≥3 phrasings + SSOT consult as primary channels**; context7 is **supplementary** for API-specific evidence only. Per [`build-first-reuse-default.md §3 tooling caveat`](../../../.claude/rules/build-first-reuse-default.md) — context7 alone is insufficient for existence-of-framework claims; substituting context7 for DeepWiki+WebSearch produces low-signal results.
- **T12 (skip lit sweep):** training-data knowledge insufficient — active search required for every recommendation.
- **T13 (ADOPTED zero-work):** A4 stream + class-table row both encode escalation rule for unvalidated upstream.
- **T14 (clean ≠ no theatre):** stream finding «clean» requires explicit coverage claim («N/M items audited, coverage X%»), not narrative «category looks fine».
- **T15 (self-application MANDATORY):** every stream research-patch §self-application section runs the stream's own methodology on the stream's own claims. Skip = `#self-protection-omitted` anti-pattern.
- **T16 (pattern-matching-on-name):** required wording in EVERY ADOPTED-MECHANISM entry: «Upstream problem class: X. Our problem class: Y. Match? evidence: …».

**Domain-specific traps (Phase 10):**

- **T-Phase10-A — «foundational-refactor temptation».** Audit surfaces that mechanism X is suboptimal; tempted to redesign X immediately within the audit. Counter: surface as observation in research-patch §recommendations; redesign = separate I-phase post-audit, requires explicit maintainer commit.
- **T-Phase10-B — «PROPOSAL revision drift».** A1 stream may surface claims contradicting [`PROPOSAL.md`](../../../docs/meta-factory/PROPOSAL.md). PROPOSAL is FROZEN per [`CLAUDE.md` Artifact Ownership Contract](../../../CLAUDE.md). Counter: surface contradictions in research-patch; do NOT edit PROPOSAL; raise as DECISION-NEEDED for maintainer.
- **T-Phase10-C — «stream abandonment after commitment».** Variant of T4 applied to multi-stream context: temptation to half-work on all 6 vs depth on 1-2. Counter: explicit per-stream completion criteria (§5.7) — once a stream is started, complete it to §5.7 criteria BEFORE beginning the next. Do not begin a stream you cannot finish at required depth.
- **T-Phase10-D — «5-class boundary blur».** ADAPTED vs OWN-BUILD vs ADOPTED-MECHANISM hard at boundary; AI tempted to classify as cheaper class (less audit). Counter: tiebreaker in §4 + escalate to higher-effort class when still ambiguous; document rationale.
- **T-Phase10-E — «recursive self-application of audit itself».** This umbrella IS a discipline-bearing artefact. Its scaffold (this file) and its eventual research-patches are subject to the audit's own methodology. Counter: each research-patch's §self-application explicitly runs methodology on the patch itself; the umbrella summary research-patch explicitly runs methodology on the umbrella scaffold (this file).
- **T-Phase10-F — «earlier-stream finding silently reframes later-stream population».** Distinct from T-Phase10-C: an executor completes streams 1-3 to §5.7 depth, then finds in stream 3 a result that *would have changed the population of streams 4-6 had it been known earlier* (e.g., A1 reveals that a PROPOSAL thesis is void → A2-A4 items derived from that thesis should logically be re-classified or removed). Temptation: silently re-scope subsequent streams using the new finding. Counter: prior streams' findings stand as-is at the depth they were audited; surface the reframing as a DECISION-NEEDED item in the umbrella summary (§7b); do NOT silently re-scope later streams mid-audit. Re-scoping requires explicit maintainer call and may justify a follow-up audit cycle.

## §7 Required deliverables

### 7a. Per-stream research-patch (× 6)

Path pattern: `docs/meta-factory/research-patches/2026-MM-DD-§13.32-A<N>-<slug>.md`.

Required structure per patch:

- **§1 Stream scope** — what A<N> covers, link back to this kickoff
- **§2 Population enumeration** — explicit command + count
- **§3 5-class assignment table** — every item × class
- **§4 Per-class audit findings** — depth differentiated per table §4
- **§5 Adversarial counter-prompts log** — per item where applicable
- **§6 Negative-existence claims + 10-item checklist verification** — per claim
- **§7 Self-application** — run methodology on this patch's own claims
- **§8 Recommendations to maintainer** — DECISION-NEEDED format, NOT autonomous actions
- **§9 Cross-refs**

Length budget: 200-400 LOC per stream patch (>100 LOC permitted per [research-patches README](../../../docs/meta-factory/research-patches/README.md) when audit body justifies; cite this kickoff §7a as rationale).

### 7b. Umbrella summary research-patch (× 1)

Path: `docs/meta-factory/research-patches/2026-MM-DD-§13.32-umbrella-summary.md`.

Synthesises across 6 streams: cross-stream patterns, prioritised DECISION-NEEDED list, recommended sequencing for any post-audit I-phase work. Includes §self-application of the umbrella itself (T-Phase10-E).

### 7c. Maintainer dialogue

After all 6 stream patches + umbrella summary land: surface aggregated DECISION-NEEDED items as explicit conversation. Maintainer decides scope + sequencing for any post-audit I-phase work. NO autonomous follow-up commit.

## §8 What NOT to do

- ❌ Modify [`README.md`](../../../README.md), [`PROPOSAL.md`](../../../docs/meta-factory/PROPOSAL.md), [`EXECUTION-PLAN.md`](../../../docs/meta-factory/EXECUTION-PLAN.md), [`CLAUDE.md`](../../../CLAUDE.md), or any maintainer-owned artefact per [Artifact Ownership Contract](../../../CLAUDE.md).
- ❌ Codify new rules in `.claude/rules/` during the audit (T5 — R-phase ≠ I-phase).
- ❌ Open implementation PRs (I-phase deferred until maintainer commits to specific recommendations).
- ❌ Propose paid-LLM mechanisms (per [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md)).
- ❌ Skip §self-application per stream (T15 mandatory).
- ❌ Bundle drive-by fixes into research-patches per [`CLAUDE.md PR strategy`](../../../CLAUDE.md) — surface observations, do not act.
- ❌ Use shared working directory for parallel stream sessions per [`parallel-subwave-isolation.md`](../../../.claude/rules/parallel-subwave-isolation.md) — worktrees mandatory if multiple streams active simultaneously.
- ❌ Trust that an ADOPTED-MECHANISM is «externally validated» without verifying upstream's own external evidence (T13).

## §9 Scope warnings (per §13.32 spec)

- **4-6 weeks meta-work.** Streams may be sequenced over multiple sessions; do not attempt single-session completion.
- **Moratorium consideration during R-phase.** Maintainer may want to pause non-critical merges during active Phase 10 streams to avoid moving-target effect (audit findings invalidated by mid-audit refactors). Maintainer decides.
- **May surface PROPOSAL/README revision proposals.** Surface as DECISION-NEEDED per T-Phase10-B; do NOT autonomously edit.
- **May surface that own mechanisms duplicate production-grade tools.** A2/A4/A5 streams especially. Surface as DECISION-NEEDED + cite specific alternative.
- **Itself may become theatre** — paired-negative methodology test: would this audit catch its own theatre? §self-application per stream addresses.

## §10 Trigger sweep (per §1.6)

At dispatch time (when maintainer commitment fires), run `grep -nE "^### 13\." docs/meta-factory/open-questions.md` and check for §13.x entries with triggers FIRED since this scaffold was authored (2026-05-17). Classify each as: WITHIN-PHASE-10-SCOPE / SEPARATE-UMBRELLA / DEFER. Surface FIRED entries in umbrella summary §cross-stream.

## §11 Pre-flight checklist (run at dispatch, not at scaffold authoring)

When maintainer commits to Phase 10 and this scaffold is about to be dispatched:

1. Re-verify Wave 9 closure status (`gh pr list --search "wave-9" --state merged`) — confirm PR #51 still merged (no revert).
2. Re-verify no in-flight conflicting session in `.claude/orchestrator-prompts/` that touches A1-A6 scope (especially d2-dual-implementation-design Phase 1-4 state).
3. Re-read this scaffold cold-start — if any line references stale state (e.g., principle count enumeration — `ls packages/core/principles/*.test.ts` returns N files; cross-check slots 11-15 merge status via `gh pr list --search "principle" --state merged`; amend kickoff §1, §3 A2, §11 inline counts to match current state before dispatch), amend before dispatch.
4. Confirm worktree setup per `parallel-subwave-isolation.md` if 2+ streams will run in parallel.
5. Run [`make self-audit`](../../../Makefile) to confirm recursive-self-application baseline green before any Phase 10 commit.

## §12 Trailers / git hygiene (for eventual commits)

Per-stream research-patch commit (when stream completes):

- Subject: `docs(research-patches): §13.32-A<N> <slug> foundations audit` — **MUST** start with literal `docs(research-patches):` to hit the pre-push §1.7 skip allowlist. Any deviation (e.g. `docs(§13.32-A2):` or `feat(research-patches):`) WILL trigger §1.7 substance check.
- Prior-art: `Prior-art: skipped — research patch only, no new capability; foundations audit per §13.32 A<N>`
- §1.7: NOT required when subject starts with `docs(research-patches):`. Verify allowlist match via: `grep -n "docs.research.patches" .husky/pre-push` — should surface allowlist entry. If you used a non-standard subject, §1.7 fires and you need Forward+Backward sections with file:line citations.
- Annotation: `<!-- scope:phase-10-foundations-audit -->` per principle 10 (verify spec at write time)

Umbrella summary patch: same pattern with subject `docs(research-patches): §13.32 umbrella foundations audit summary`.

## §13 Cross-references

- [open-questions.md §13.32](../../../docs/meta-factory/open-questions.md) — armed-item statement, trigger spec, scope warnings
- [open-questions.md §13.34](../../../docs/meta-factory/open-questions.md) — sibling autonomous-self-audit-triggering layer; orthogonal but related
- [README.md #why-this-exists](../../../README.md) — project goal, NOT to be edited by this audit
- [docs/meta-factory/PROPOSAL.md](../../../docs/meta-factory/PROPOSAL.md) — FROZEN per Artifact Ownership Contract; A1 stream audits against it, does NOT edit
- [docs/meta-factory/EXECUTION-PLAN.md](../../../docs/meta-factory/EXECUTION-PLAN.md) — maintainer + planning sessions owned per [CLAUDE.md](../../../CLAUDE.md)
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT register, central source for class assignment in §4 table
- [.claude/rules/ai-laziness-traps.md §3](../../../.claude/rules/ai-laziness-traps.md) — T-trap enumeration discipline
- [.claude/rules/phase-research-coverage.md §1](../../../.claude/rules/phase-research-coverage.md) — 10-item checklist for negative-existence claims
- [.claude/rules/doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md) — A6 stream audit basis
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — macro-level operating philosophy; informs A2/A4/A5 verdict classes
- [.claude/rules/no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md) — constraint on mechanism proposals in A2/A3
- [.claude/rules/parallel-subwave-isolation.md](../../../.claude/rules/parallel-subwave-isolation.md) — mandatory if parallelising streams
- [`packages/core/principles/`](../../../packages/core/principles/) — current principle test surface (slot count verify at dispatch per §11.3)
- [`autonomous-self-audit-research/research-prompt.md`](../autonomous-self-audit-research/research-prompt.md) — companion §13.34 sibling

## §14 Final note

This umbrella exists to break the closed-loop validation pattern that characterised the project's first 9 months (every decision validated by internal reasoning + context7 only). The audit's value comes from **external evidence at every claim**, not from finding fault.

Honest «cannot conclude — coverage insufficient» is a valid stream finding. Honest «mechanism X duplicates upstream Y, recommend ADOPT» is a valid stream finding. Dishonest «mechanism X is novel because we couldn't find Y in our usual sources» is theatre — exactly the failure mode the umbrella addresses.

If a stream session itself illustrates the failure mode it's auditing (e.g., A2 audit proposes mechanism revision without external search), that is **valid and load-bearing data** — surface honestly, do not paper over.

Recursion warning per T-Phase10-E: this scaffold itself is subject to Phase 10's own discipline. Pre-flight §11.3 mandates cold-start re-read; umbrella summary §self-application audits this scaffold against the methodology it specifies.

<!-- host-verify: none — research umbrella, not implementation (own §2): audit streams deliver findings and re-evaluations as docs; each implementation follow-up gets its own kickoff with a contract -->
