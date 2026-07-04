# AI laziness traps — discipline rule

> **Class:** A — companion principle test shipped at [packages/core/principles/12-ai-laziness-traps.test.ts](../../packages/core/principles/12-ai-laziness-traps.test.ts) (#74, 2026-05-17).
> **Fires:** any R-phase, audit, sample-based investigation, or open-ended AI task.
> **Authoritative for:** ai-laziness-traps discipline rule — §1 problem this solves, §2 canonical trap catalogue, §3 kickoff-author obligations (cite + extend, no blanket reference), §4 anti-patterns, §5 promotion / retirement triggers.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists). Companion to research-discipline rule — see [phase-research-coverage.md](phase-research-coverage.md).

> **Origin:** 2026-05-12. Wave 9 kickoff (`§13.31`) §6 enumerated 11 «AI laziness traps» specific to that R-phase. During Phase 10 (`§13.32`) scoping the maintainer surfaced that the trap catalogue is **structurally project-wide** — any R-phase, audit, or open-ended investigation by an AI session faces the same failure modes (sampling shallow, declaring victory at floor depth, pattern-matching the prompt instead of reasoning against it). Drift-waiting-to-happen if each kickoff re-invents its own list. Hoisted to project rule with self-defending mechanism: kickoffs must cite + extend, not blanket-reference.

This rule formalises **AI-laziness countermeasures** as a project invariant, parallel to:
- code-level discipline (R1-R20 lint rules)
- decision-level discipline (Prior-art trailers + SSOT)
- research-level discipline ([phase-research-coverage.md](phase-research-coverage.md))
- doc-authority-level discipline ([doc-authority-hierarchy.md](doc-authority-hierarchy.md))

The rule applies to **any AI session running an R-phase, audit, sample-based investigation, decision-register exercise, doc-creation / doc-revision of a discipline-bearing artefact (`README.md`, `CLAUDE.md`, `INSTALL-FOR-AI.md`, `.claude/rules/*.md`, `.claude/skills/*/SKILL.md`, `agents/*.md`, kickoff or research-patch authoring), or other open-ended task whose output is bounded only by «when do I stop».** It does NOT apply to mechanical edits with explicit done-criteria (e.g. «replace X with Y in file Z»).

**Especially load-bearing for doc-creation:** documentation has no executable tests on prose substance, only structural checks (principle 09 = header presence). All traps apply with extra weight — particularly T11 (designing without prior-art check on doc patterns like ADR/MADR), T12 (skipping literature sweep because «I know docs-as-code»), T15 (the doc itself never self-applies its own framing), T16 (adopting external doc-architecture pattern by name without verifying problem-class match — e.g. claiming ADR style without doing the ADR discipline).

## §1 Problem this solves

AI agents under time pressure (their own session quota, perceived user impatience, or absence of an external done-check) reliably converge to **path of least resistance**: producing the shape of the expected output without performing the underlying work. The failure mode is well-documented in the project — `#discipline-theatre` antipattern (`§13.29`, Wave 8) — and applies recursively to audits of `#discipline-theatre` itself (Wave 9).

The general rule: **any AI task whose stopping criterion is «when I'm done» rather than «when an external check passes» will under-shoot the actual stopping point.** Confidence: very high, validated across 4 documented incidents in Waves 5-8 plus the entire `#discipline-theatre` taxonomy.

The fix is **operationalising the laziness traps and forcing kickoff authors to instantiate them**, not just reference them generically.

## §2 Canonical trap catalogue

These are the traps observed in this project plus structurally similar ones from external research (AI-agent specification gaming, AI code-review compliance drift). Each trap has: trigger pattern, what an AI will be tempted to do, concrete countermeasure.

### T1 — «Looked at 3 examples, all clean, category done»

Trigger: sampling-based audit with no explicit depth floor.
Tempted output: «sampled 3 surfaces, all substantive, category clean».
Counter: sampling **floor = 5**; recommended depth ≥20. If first 3 look clean, that is a **sampling artifact**, not a finding. Continue to depth.

### T2 — «My methodology would catch theatre, so I don't need to run it»

Trigger: open-ended audit where designing the method is satisfying.
Tempted output: «my proposed methodology covers X, Y, Z — sufficient».
Counter: designing ≠ auditing. Auditing requires running the methodology against actual surfaces and reporting findings. If you find yourself writing «would detect» in §findings, replace with concrete invocation + concrete output.

### T3 — «Plausible-looking finding without verification»

Trigger: time pressure + reasoning-from-context-summaries.
Tempted output: «PR #N's Forward-check cites `foo.ts:42` which I assume evidences principle 02» — without opening the file.
Counter: every finding must have ONE of: (a) command + output, (b) file:line citation + the line's actual content, (c) explicit `INCONCLUSIVE-needs-LLM` or `INCONCLUSIVE-needs-human` if you cannot verify mechanically. **No prose-only findings.**

### T4 — Closing R-phase prematurely

Trigger: progress feels sufficient; output looks comprehensive.
Tempted output: «N categories enumerated, M surfaces sampled per category — handing off».
Counter: R-phase output must hit ALL declared sections. **Adversarial counter-prompt at the CATEGORY level** («what category did I miss?») is the discipline-applying-to-itself check; skipping it means having already failed.

### T5 — Bundling implementation findings into research phase

Trigger: «I notice an obvious fix while auditing, let me just apply it».
Tempted output: edits to source files during R-phase.
Counter: R-phase output is a Markdown doc. If you open `Edit` on a source file during R-phase, stop. Add finding to research output, propose mechanism in §closure-proposals, leave the fix to I-phase.

### T6 — Self-reporting «high confidence»

Trigger: REPORT format expects a Confidence field.
Tempted output: «Confidence: high» as a syntactic-presence check.
Counter: Replace «high» with explicit predicates: «Confidence: 7/20 surfaces verified mechanically; 13/20 require LLM-judge follow-up. Coverage = 35%. Calibration: NONE — first run of this methodology, expect false-positive rate ≥20% until 2nd run.»

### T7 — Following the prompt literally instead of reasoning adversarially

Trigger: prompts have structure that AI can pattern-match to and tick boxes.
Tempted output: «adversarial check applied — no missed categories» (without actually running the adversarial check).
Counter: when reaching adversarial counter-prompt sections, **write the actual counter-prompt and run it**. If it surfaces nothing, that is itself suspicious — rephrase and run again.

### T8 — Asking the maintainer to avoid doing the work

Trigger: easy escape via «should I include X or is that out of scope?»
Tempted output: clarifying questions whose answers are already in the kickoff.
Counter: if the question's answer is in the kickoff, don't ask. If the answer requires real judgment from the maintainer, ask **once at review-phase, batched** with other decisions.

### T9 — Sampling the EASY surfaces

Trigger: convenience-recent stratification.
Tempted output: sample 20 most-recent items where the discipline is already active.
Counter: explicit stratification — document sampling strategy. Sample across the historical window where the discipline was NOT yet active (that is where theatre concentrates). Random-uniform from full population beats convenience-recent.

### T10 — Reporting completeness based on what you LOOKED at, not what EXISTS

Trigger: no upfront population enumeration.
Tempted output: «sampled 20 in C5, found 4 theatre cases» — without knowing population size.
Counter: §population-enumeration BEFORE §sampling. Order matters. Without enumeration, sampling claims are meaningless.

### T11 — Designing custom solution without checking external prior art

Trigger: writing «I propose mechanism X» without prior-art check.
Tempted output: detailed proposal for a custom script/probe/gate that duplicates an existing production-grade tool.
Counter: §5.1 §6 of any audit kickoff requires **build-vs-reuse SSOT consult + context7 ≥3 phrasings + WebSearch on the problem-domain term** before any «I propose…». If you find yourself proposing a mechanism without external search, stop and search first.

### T12 — Skipping the literature sweep because «I already know the area»

Trigger: AI confident from training data.
Tempted output: «I'm familiar with mutation testing; Stryker is what we want — no need to web-search».
Counter: training-data knowledge has a cutoff date and is **systematically biased toward well-documented tools**. Active research areas (specification gaming, AI compliance drift) update fast and have non-obvious entries. WebSearch at the moment of proposing, not from memory.

### T13 — Treating ADOPTED items as zero-work

Trigger: «we adopted this from AIF, so it's externally validated, no audit needed».
Tempted output: skipping audit of ADOPTED-MECHANISM items entirely.
Counter: the **upstream source itself may be context7-only validated**. For each ADOPTED item, audit must confirm: (a) upstream had external evidence for the pattern, OR (b) escalate item to OWN-BUILD-class audit depth.

### T14 — Conflating «no findings» with «no theatre»

Trigger: audit returns clean results.
Tempted output: «category clean → no follow-up needed».
Counter: clean audit AND high coverage → category is plausibly clean. Clean audit AND low coverage → finding is «coverage insufficient to conclude», not «category clean». Distinguish in the output.

### T15 — Self-application skipped

Trigger: «this rule/audit/methodology is about X, not about itself».
Tempted output: applying the discipline to user code only, never to the audit's own artefacts.
Counter: project invariant #2 («recursive self-application green»). Every audit must include §self-application — «did this audit run on itself? what would auditing this audit look like?» — and produce a finding.

### T16 — Pattern-matching-on-name (adopted-tool-wrong-problem)

Trigger: ADOPTED or ADAPTED item with a familiar-sounding name; AI assumes the upstream pattern solves the same problem class we have.
Tempted output: «we adopted Stryker → mutation testing covered», «we adopted AIF Step 0 → session anchoring covered» — without verifying that **our problem class matches what upstream was designed for**.
Concrete shape: driving nails with a screwdriver / screwing screws with a hammer — the tool is real and well-built, but it's the wrong tool for our actual problem because someone matched names instead of functions.
Counter: for every ADOPTED-MECHANISM or ADAPTED item, write explicitly: **«Upstream problem class: X. Our problem class: Y. Match? evidence: …»**. If X and Y differ, the upstream validation does NOT transfer — escalate to OWN-BUILD-class audit. This is the `#pattern-matching-on-name` antipattern in operational form (see [phase-research-coverage.md §4](phase-research-coverage.md) candidates; documented in [`prior-art-evaluations.md` AIF Handoff overlap analysis](../../docs/meta-factory/prior-art-evaluations.md) entries #27/#28).

### T17 — Destructive delegation without preserving future-value content first

Trigger: about to write a destructive prompt (REMOVE / DELETE / revert) for a junior, or run a destructive op, on content that may have future value.
Tempted output: dispatch the delete/revert immediately — the junior follows scope strictly and the content is gone with no undo.
Counter: **BEFORE** writing the destructive prompt, the orchestrator saves deletable content with future value (extract to a preservation note / research-patch / skill-context). Preservation is the *orchestrator's* job — the junior is instructed to follow scope strictly and will not save it for you. *(codifies memory `preserve_before_destructive_delegation`; incident counter 1/3 → promote to a principle test at 3)*

### T18 — Deleting a redundant artifact instead of preserving its unique residue

Trigger: an ours-vs-adopted-upstream collision / redundancy surfaces across docs or agents.
Tempted output: «it's redundant with the upstream we adopted → delete it».
Counter: verify the redundancy **empirically** first; keep the file (deletion is the irreversible branch, keeping is reversible); preserve genuinely-unique residue via the upstream-native mechanism (e.g. a skill-context override) — never just delete. *(codifies memory `preserve_unique_residue_via_skill_context`)*

### T19 — Handoff without own cold-QA (CI ≠ design review)

Trigger: a load-bearing / discipline-bearing PR is ready and CI is green.
Tempted output: «CI green → hand to the maintainer to review and merge».
Counter: run your **own** adversarial cold-review of the diff (a fresh reviewer over the actual change) BEFORE handoff. CI checks form/structure (lint, trailers, schema), not design substance — the 2026-05-22 DN-4 round-1 (§1.11) and round-2 (§1.12) cold-reviews each caught real MAJOR findings a green CI missed. «Merge» is the maintainer's decision; «QA» is yours. *(codifies memory `own_qa_before_handoff`)*

### T20 — Inline-verdict-without-evidence

Trigger: AI issues a recommendation, verdict, or design call (`ADOPT/BUILD/REJECT/DEFER`, «use X», «pick Y over Z», «we should A») in inline dialogue **without having run at least one evidence-bearing tool call** (`Bash | Read | Grep | Glob | WebFetch | WebSearch`) in the same turn — the recommendation is fabricated from training-data or session-recall, not grounded in present-moment verification.

Tempted output: «Recommend Option A» / «BUILD verdict for X» / «use jq here» — without preceding grep, file read, or fetch establishing the evidence base; under the false confidence that the H1 always-on reminder substitutes for the verification act it names.

Counter: Before issuing any recommendation/verdict in dialogue, run **at least ONE** evidence-bearing tool call in the same turn and **quote its output** (file:line, command result, fetched excerpt). The recommendation is then **backed**, per parent rule [`phase-research-coverage.md §1.12`](phase-research-coverage.md). This is the operational form of the named anti-pattern [`#recommendation-skips-own-discipline`](phase-research-coverage.md) (§4).

### T21 — Backward-check restates the PR instead of sweeping its siblings

Trigger: authoring a `### §1.7 Backward-check applied` section (or any «backward sweep» / recursive-self-application step) deep in a **long, context-loaded session**, where the PR's own narrative is fresh in working context and the syntactic CI gate ([discipline-self-check.yml](../../.github/workflows/discipline-self-check.yml) — ≥40 non-whitespace chars + ≥1 `file.ext:line`) will pass either way.

Tempted output: **restate what the PR did** — «item 4 coded, items 1-3 documented; §5 structure preserved, supersedes nothing» — naming only artefacts the diff already touches (optionally citing one unrelated non-diff file as cover). The backward-check acquires the *shape* of a sweep («swept», «all artefacts compliant») while doing none of the outward enumeration of *sibling surfaces where the same change-class must also hold*.

Why a stretched/loaded context produces exactly this: it is `#discipline-theatre` ([phase-research-coverage.md §4](phase-research-coverage.md)) specialised onto the backward-check, and it is **worst under context fatigue**. The long context is saturated with the *inward* PR story, so «backward-check» pattern-matches to «recap what I changed» — but the check's value is entirely *outward* (surfaces NOT in front of you), so the check is worst exactly where it is most needed. It composes three earlier traps: **T2** (designing/claiming ≠ running — «re-adjudicates the risk-acceptances» asserted without the enumeration invocation), **T14** (clean-result on *low* coverage misreported as «clean» rather than «coverage insufficient»), **T15** (the recursive-self-application the backward-check exists to force is skipped). The fakeable gate reinforces it: a restatement satisfies ≥40 chars + ≥1 file:line trivially, so the path of least resistance passes CI — the same evidence-skipping shape as **T20** / [`recommendation-laziness-discipline.md`](recommendation-laziness-discipline.md), a verdict («no sibling left inconsistent») asserted without the grep/read that would back it.

Counter (**structural, not a stronger reminder** — a prose exhortation rots identically, because fatigue defeats reminders):
1. **Delegate the sweep to a cold sub-agent** — [`agents/backward-sweep-auditor.md`](../../agents/backward-sweep-auditor.md). Hand it ONLY the change's *class* (never the diff or PR narrative); it enumerates every parallel surface and reports GAP/CLEAN per surface. It is immune to restatement **by construction — it never saw the PR, so it cannot recap it**. AI-agnostic, no paid LLM (the T19 cold-QA + AI-agnostic-auditor pattern, per [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md)).
2. **Author the backward-check in the enumeration format** ([phase-research-coverage.md §1.7](phase-research-coverage.md)): `Class of this change = <X>. Surfaces where class-X occurs: [enumerate ALL, with grep evidence]. Per surface: SWEPT-CLEAN(evidence file:line) | GAP-FOUND(action).` A backward-check whose surface list is exactly the diff's own files is non-conformant by format — the omission becomes visible at review.

The discriminating tell **and its limit**: a real backward-check *enumerates the change's class-surfaces and verdicts each* — typically naming ≥1 surface the diff did **not** touch, *as a swept surface*; a restatement lists the PR's own changes and cites files only as evidence-for-those-changes. **Do not reduce this to «cites ≥1 non-diff file».** The motivating incident's restatement DID cite a non-diff file (`packages/core/principles/30-research-source-trust.test.ts:139`, item-C evidence) — a naive «non-diff citation present» detector *false-negatives* on it (verified: that path is absent from the commit's own `git diff --name-only`). Completeness of the class-enumeration is a **semantic** judgment, not a syntactic one; per no-paid-llm-in-ci it cannot be a CI gate → the cold-agent + review-time judgment carry it.

Incident: PR #857 — commit `ec643bac7` shipped a restatement backward-check («re-adjudicates the S2 §5 risk-acceptances; item 4 promoted documented→coded; items 1-3 kept documented»); the parallel single-label-host gap on the **Tier-1** host-derivation surface (`tier1For`'s `candidateFields`, sibling to the **Tier-2** `loadAckFile` surface the PR fixed) reached the PR and was caught only by operator challenge → fixed in commit `bf1b8b5f3`. *(incident counter 1/3 → promote to a semantic principle test at 3 per §5, with MANUAL classification per the narrow-b lesson — no automated catch-rate claim.)*

## §3 Obligations on kickoff authors

A kickoff document (R-phase brief, audit prompt, multi-session umbrella doc) that delegates work to an AI session MUST:

1. **Cite this rule explicitly** in its §6 (or equivalent «AI traps» section): `See [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md)`.
2. **Enumerate which T-numbers apply** to its specific R-phase by listing them: `Active traps for this R-phase: T1, T3, T4, T7, T11, T13, T15, T20`. Justification one-liner per trap is encouraged but not mandatory.
3. **Add ≥1 domain-specific trap** that is NOT in the canonical catalogue but is structurally possible in this R-phase's context. Domain-specific traps should be labelled with the wave/phase identifier: `T-Wave9-A — «when auditing trailer truthfulness, AI tempted to grep for citation-syntax presence rather than verify cited line evidences claim»`.

Blanket reference («see ai-laziness-traps.md» without enumeration or domain extension) is **insufficient and itself a form of T7 (pattern-matching the prompt instead of reasoning against it)**. Linters can be added later if violation rate justifies; for now this is a prose-discipline check at review time.

## §4 Anti-patterns

- **`#trap-catalogue-blanket-reference`** — kickoff cites this rule but does not enumerate T-numbers or add domain-specific traps. Treats the catalogue as decoration, not discipline. Counter: review-phase rejection.
- **`#trap-list-grew-without-pruning`** — every wave adds 3-5 new traps; catalogue grows to 50+ items; future sessions ignore the bloat. Counter: §5 retirement policy.
- **`#self-protection-omitted`** — kickoff includes T1-T14 but not T15 (self-application). The audit never audits itself. Counter: T15 is **mandatory** for any R-phase using this rule; not opt-in.
- **`#trap-stated-but-not-enforced`** — kickoff cites traps in §AI-traps section but the methodology in §rest-of-document does not embed countermeasures (e.g. mentions T10 «enumerate population first» but methodology section skips population enumeration). Counter: review-phase cross-check.
- **`#reading-traps-doesnt-mean-applying-them`** — AI reads §2 trap list, recognises it as «pattern-match advice», then proceeds to fall into the listed traps anyway. The rule itself is subject to its own T7. Counter: methodology requires concrete instantiation of countermeasures (e.g. «§4 finding format requires file:line citation per T3») rather than narrative «be careful about T3».
- **`#backward-check-restates-not-sweeps`** — a §1.7 Backward-check (T21) emits the *shape* of a sweep («swept», «all artefacts compliant») while naming only artefacts the PR already touches, never enumerating the sibling surfaces where the same change-class must also apply. `#discipline-theatre` specialised onto the backward-check; worst under context fatigue (the loaded PR-narrative is the path of least resistance). Counter: cold-agent delegation ([`agents/backward-sweep-auditor.md`](../../agents/backward-sweep-auditor.md)) + the §1.7 enumeration format — both structural, because a prose reminder rots under the exact fatigue that causes the trap. Falsifier: the surface list in the backward-check equals the diff's own file list (with «cites a non-diff file» explicitly rejected as the tell — see T21).

## §5 Promotion / retirement triggers

- **New trap promotion to canonical catalogue (§2):** when 2+ wave-specific T-additions describe structurally the same failure mode, abstract and add to §2. Wave-specific T-XXX deprecates.
- **Trap retirement:** if a T-N has not been cited as active in any kickoff for 4+ consecutive waves AND no incident has fired matching it, demote to «archived» section (preserve for history, do not require enumeration).
- **Catalogue split:** if §2 exceeds 25 entries, split by domain (e.g. audit-specific vs. implementation-specific). Avoid bloat-by-accretion.
- **Companion principle test — SHIPPED:** [`packages/core/principles/12-ai-laziness-traps.test.ts`](../../packages/core/principles/12-ai-laziness-traps.test.ts) (#74, 2026-05-17) — mechanical check on kickoff files under `.claude/orchestrator-prompts/*/kickoff.md` for the required §3 citation + T-enumeration syntax. Promoted ahead of the «≥3 incidents in 6 months» violation-rate threshold via the 1A roadmap (slot 12, not the originally-sketched slot 11 — that slot went to build-first-reuse-default).
- **T20 → Class A principle test** when 3+ documented incidents in `.claude/rules/` or `research-patches/` each with file:line evidence; principle test would do post-hoc semantic grep over chat-transcript exports for verdict-words without preceding evidence-tool, with MANUAL classification (per [`narrow-b-benchmark.md §1.5`](../../docs/meta-factory/research-patches/2026-05-25-narrow-b-benchmark.md) — automated FP-rate = 84%, gate-class enforcement infeasible without semantic enrichment; recall caveat per same patch §1.3 + §T19 prevents any catch-rate claim without manual classification sample).
- **T21 → Class A principle test** when 3+ documented `#backward-check-restates-not-sweeps` incidents (each: a backward-check whose surface list equalled the diff, and a sibling gap that reached the PR) are recorded with commit-SHA evidence. Any such test **MUST** be semantic (a curated corpus of restatement-vs-sweep backward-checks + MANUAL classification), never a syntactic proxy: the motivating incident proves «cites a non-diff file» false-negatives (T21), and completeness-of-enumeration is not mechanically checkable without a paid LLM (excluded by [no-paid-llm-in-ci.md](no-paid-llm-in-ci.md)). Until then, the cold-agent + enumeration format + review-time judgment are the reachable mechanism (Class B-equivalent — a shipped `agents/*.md` + authoring format, not a gate). Incident counter: 1/3 (PR #857, 2026-07-03).

## See also

- [.claude/orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md §6](../orchestrator-prompts/wave-9-discipline-theatre-audit/kickoff.md) — origin instance; the in-flight kickoff inlines T1-T11. Future kickoffs reference this rule instead.
- [phase-research-coverage.md](phase-research-coverage.md) — companion rule on research-discipline scope (overlapping concerns: R-phase output requirements, search-coverage 6-item checklist).
- [doc-authority-hierarchy.md](doc-authority-hierarchy.md) — parallel discipline rule pattern (authority + scope statements per doc).
- [open-questions.md §13.31](../../docs/meta-factory/open-questions.md) — Wave 9 umbrella driving §2 catalogue origin.
- [open-questions.md §13.32](../../docs/meta-factory/open-questions.md) — Phase 10 umbrella; classification discipline `OWN-BUILD` / `ADAPTED` / `ADOPTED-MECHANISM` / `ADOPTED-VOCABULARY` / `REJECTED` interacts with T11 (don't sweep what's externally validated) + T13 (don't trust ADOPTED without confirming upstream evidence).
