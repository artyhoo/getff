# Prose-rules audit research — R-PHASE KICKOFF

> **Status:** ARMED 2026-05-16
> **Origin:** goal-clarity-dialogue 1A (2026-05-16) follow-up. Initial Class A/B/C classification produced in 1A failed §1.7 Forward+Backward checks — recommendation-skips-own-discipline antipattern. This R-phase is the corrective dedicated session.
> **Type:** standalone R-phase, NOT wave/phase, NOT dialogue. Single focused sitting, 3-4 hours.
> **Deliverable:** research-patch + per-rule evidence-based classification + tooling decision matrix + sketch designs for principle tests where applicable + ready-to-apply patches for compensating mechanisms.
> **NO PR. NO commits beyond research-patch. NO ship of principle tests in this session — those ship as Commits 3/4/5 in atomic-commit-plan ONLY AFTER this R-phase produces evidence-based design.**
> **Blocking dependency for:** Commits 3 (reviewer-discipline compensating mechanism), 4 (principle 11 ai-laziness-traps), 5 (principle 12 phase-research-coverage §1.7) of atomic-commit-plan.

---

## §1 Problem this session solves

Goal-clarity-dialogue 1A produced a **provisional** prose-rules audit classifying 5 prose-only rules into Classes A (mechanically detectable, drift) / B (semantic only, compensating mechanism) / C (mechanical-but-deferred). Three action items emerged (Action A: ai-laziness-traps test; B: phase-research-coverage §1.7 test; C: reviewer-discipline compensating section). The classification was based on **intuition + plausibility check**, not evidence.

**Failures of the 1A classification (acknowledged 2026-05-16):**

1. **`#recommendation-skips-own-discipline`** — recommendation did not pass [`phase-research-coverage.md §1.7`](../../rules/phase-research-coverage.md) Forward-check (compliance with all currently-active layers) or Backward-check (complete sweep of artefacts under new rule's scope).
2. **`#discipline-theatre`** — classification claims «can be mechanically tested» without running a single grep / AST / parser probe to verify the claim. Pure syntactic recommendation; substantive verification absent.
3. **`#recursive-self-application-gap`** — discipline-of-recursive-self-application applied to existing rules, not to the act of producing this recommendation itself.

**This R-phase corrects all three failures via evidence-based methodology.**

**Why this matters for project core:** the project's central thesis is «documents lie; tests don't» applied to rules. If we classify rules as «testable» or «not testable» based on intuition rather than evidence, we replicate the very anti-pattern the project exists to prevent. This R-phase is **load-bearing for project invariants**.

---

## §2 Out of scope

- **No ship of principle tests in this session** — Actions A, B, C remain blocked. This R-phase only **designs** them with evidence.
- **No re-classification of doc-authority-hierarchy.md (principle 09)** — already has companion test, not in audit scope.
- **No re-classification of new build-first-reuse-default rule** — its companion principle test 10 has separate dedicated design path (`drafts/principle-10-build-first-reuse-default-design.md` + Commit 6).
- **No new rules** — this R-phase audits existing rules only.

---

## §3 Hard constraints

- **§1.7 Forward-check ON THIS R-PHASE'S OUTPUT.** The classification recommendation produced here must itself pass §1.7 forward + backward + self-reflexive trigger before close. Self-review patch shipped with research-patch (T7 template per [`2026-05-09-self-review-audit.md`](../../../docs/meta-factory/research-patches/2026-05-09-self-review-audit.md)).
- **No paid LLM in CI.** Per [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md). Compensating mechanisms designed in this R-phase must be subscription-bundled (AI-agnostic markdown prompts in `agents/*.md`), not API-billed CI gates.
- **Build-vs-reuse + BFR-default discipline.** Every tool-selection or mechanism choice runs §3 mechanism of drafts/build-first-reuse-default-rule.md (`../goal-clarity-dialogue/drafts/build-first-reuse-default-rule.md`): SSOT consult + DeepWiki ≥3 phrasings + WebSearch ≥3 phrasings + 6-item checklist.
- **Substantive over syntactic.** Every «this rule can be mechanically tested» claim requires a working probe run during this R-phase that demonstrates detection. No prose-only claims of testability.
- **No T11, no T12, no T13, no T15, no T16.** Active traps listed in §7.
- **§1.7 ON EACH ACTION.** Forward+backward check applied to each proposed Action A/B/C before approval.

---

## §4 Methodology (per-rule audit)

For each of the 5 prose-only rules, execute the full sequence:

### §4.0 Per-rule scope clarification

State explicitly:
- Rule name + file path
- Violation shape (what concretely constitutes a rule violation — must be specific enough to grep / parse / semantically judge)
- Existing promotion criterion (verbatim from rule's «Promotion / retirement» section)
- Class hypothesis from 1A dialogue (A / B / C — provisional)

### §4.1 Tooling prior-art sweep (mandatory)

For the violation shape, run:

**Context7 queries (≥3 phrasings)** — appropriate when violation is library-API-call shape; usually NOT applicable for prose rule violations. Note explicitly when context7 inapplicable.

**DeepWiki `ask_question` MCP (≥3 phrasings)** — primary tool. Query repos that ship similar rule infrastructure:
- `lee-to/ai-factory` — what enforcement do they have?
- `lee-to/aif-handoff` — principle tests for own conventions; pattern applicable?
- `code-yeongyu/oh-my-opencode` — tool-restrictions approach; would it apply?
- `obra/superpowers` (or whatever Superpowers' actual canonical repo is) — TBD via WebSearch first if needed
- `microsoft/agent-framework` or other Agent Teams reference

**WebSearch queries (≥3 phrasings)** — for general state-of-art:
- «mechanical validation of prose discipline rules»
- «AST-based rule enforcement vs LLM-judge accuracy»
- «principle tests for documentation discipline» / «documentation drift detection tools»
- «property-based testing for prose patterns»

**SSOT consult** — `docs/meta-factory/prior-art-evaluations.md`. Cite matching entries.

**Output:** §findings table per rule:

| Tool/Pattern | Source | Applicability to this rule | Verdict |
|---|---|---|---|
| ... | DeepWiki/WebSearch URL | Match / partial / N/A | ADOPT / ADAPT / REFERENCE / KEEP NARROW / BUILD / REJECT |

### §4.2 Mechanical detection probe (substantive verification)

For Class A hypotheses: **run an actual probe**. Not theoretical, actual.

Example for `ai-laziness-traps.md`:
- Hypothesis: «can grep kickoff files for T-number enumeration»
- **Probe:** run actual `grep -rE '\bT[0-9]+\b|T-[A-Za-z0-9-]+' .claude/orchestrator-prompts/*/kickoff.md`
- **Document output:**
  - True positives (kickoffs WITH enumeration that should pass)
  - False positives (mentions that aren't enumeration)
  - True negatives (kickoffs WITHOUT enumeration that should fail)
  - False negatives (missed enumerations due to formatting variation)
- **Verdict:**
  - <5% false-positive AND <5% false-negative → mechanical-test viable
  - 5-20% → tool needs refinement; consider AST-aware parsing
  - >20% → mechanical test produces too much noise; reclassify to Class B or C

For Class B hypotheses: **demonstrate compensating mechanism**. Show that the candidate prompt (e.g. `agents/compliance-verifier.md`) can semantically catch violations a real reviewer would catch. Run a small bench (≥3 fabricated violations + ≥3 clean cases) through the prompt and verify reasoning.

For Class C hypotheses: **demonstrate why mechanical detection is currently too expensive**. Show cost estimate (lines of code, false-positive rate at first draft, etc.).

### §4.3 §1.7 Forward+Backward check on the recommendation

Before recommending any Class A/B/C verdict for a rule:

**Forward-check (recommendation complies with existing disciplines):**
- principle 08 capability-commit gate — does the proposed principle test count as capability? (Likely yes → needs Prior-art trailer when committed.)
- build-vs-reuse SSOT — is the chosen tool registered? If not, add SSOT entry as part of Commits 3/4/5 commit body.
- doc-authority-hierarchy — does the recommendation produce new artefacts with compliant headers?
- phase-research-coverage 6-item checklist — applied?
- no-paid-llm-in-ci — does compensating mechanism use subscription-bundled prompts only?

**Backward-check (new rule applied to all existing artefacts):**
- For Action A (ai-laziness-traps test): scan ALL existing kickoffs in `.claude/orchestrator-prompts/*/kickoff.md` for compliance with the rule. Are there grandfathered cases? How handled?
- For Action B (phase-research-coverage test): scan ALL existing research-patches for §1.7 compliance. Pre-rule patches grandfathered?
- For Action C (reviewer-discipline compensating mechanism): verify `agents/compliance-verifier.md` exists and actually contains the semantic checks claimed in the recommendation.

### §4.4 Sketch design (markdown, not TypeScript)

For each approved Action:
- Class A → markdown design for principle test (mirror `principle-10-build-first-reuse-default-design.md` pattern)
- Class B → markdown design for compensating mechanism update
- Class C → markdown design for «what trigger condition fires reclassification» + watch-pattern in repo

---

## §5 Tools available for this R-phase

- DeepWiki MCP (`mcp__deepwiki__*`) — primary architectural research tool
- Context7 MCP (`mcp__context7__*`) — secondary, for library-docs sub-questions
- WebSearch — for general state-of-art surveys
- Bash + grep + ripgrep — for probing actual repo state mechanically
- TypeScript Compiler API (if needed for AST-based probes — likely needed for Class A rules)
- ToolSearch — to load deferred tool schemas as needed

---

## §6 Deliverable structure

### §6.1 Research-patch — `docs/meta-factory/research-patches/2026-MM-DD-prose-rules-audit-research.md`

Mandatory sections:
- §1 Problem (recap from this kickoff §1)
- §2 Background (1A dialogue origin + acknowledged antipattern)
- §3 Per-rule audit results (one §3.X per rule, total 5 subsections — ai-laziness-traps, phase-research-coverage, reviewer-discipline, no-paid-llm-in-ci, parallel-subwave-isolation)
- §4 Tooling decision matrix (consolidated across all 5 rules — which tool for which violation shape)
- §5 §1.7 Forward+Backward checks for each Action A/B/C
- §6 Self-review patch (recursive — does this R-phase's recommendation pass §1.7 against itself? mandatory per phase-research-coverage §1.7 self-reflexive trigger)
- §7 Decisions on Actions A, B, C: PROCEED / REVISE / DEFER / REJECT verdict per Action
- §8 Drafts produced (sketch designs for approved Actions)
- §9 §1.7 forward+backward check on THE RESEARCH-PATCH ITSELF
- §10 See also

### §6.2 Sketch designs in this kickoff's `drafts/` subdir (gitignored)

For each approved Action — sketch markdown:
- `drafts/principle-11-ai-laziness-traps-design.md` (if Action A approved)
- `drafts/principle-12-phase-research-coverage-design.md` (if Action B approved)
- `drafts/reviewer-discipline-compensating-mechanism-design.md` (if Action C approved — replacing or refining the 1A draft that was made without evidence)

These sketches inform the eventual implementation commits 3/4/5.

---

## §7 AI laziness traps active for this session

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) — kickoff author obligations satisfied via enumeration:

**Active canonical traps (HIGH relevance):**

- **T3** (plausible-looking finding without verification) — **HIGHEST priority for this R-phase**. The 1A failure was exactly T3. Every classification claim must have file+line probe output OR `INCONCLUSIVE-needs-LLM` marker.
- **T7** (following prompt literally instead of reasoning adversarially) — for each Class A hypothesis, ask «what would make this test produce false positives?» BEFORE proposing the test.
- **T11** (designing without prior art) — full §4.1 sweep mandatory per rule, not optional.
- **T13** (treating ADOPTED items as zero-work) — DeepWiki / WebSearch findings must include evidence the upstream pattern actually works for our problem class, not just «it exists».
- **T15** (self-application MANDATORY) — §6.1 §6 self-review patch is mandatory; this R-phase audits its own output.
- **T16** (pattern-matching-on-name) — when DeepWiki returns «aif-handoff has principle tests», explicit «their problem class: X. Ours: Y. Match? Evidence: …».

**Domain-specific traps for this R-phase:**

- **T-PRA-A** «easy verdict harvest» — tempting to confirm 1A Class A/B/C hypotheses with cherry-picked probe evidence. Counter: probe must be **adversarial** — explicitly run negative probes (kickoffs that should fail) and verify they fail. Not just positive probes.
- **T-PRA-B** «principle test theatre» — proposing principle test that grep-validates rule presence without validating rule **substance**. Counter: principle test must include negative test (introduces violation → test FAILS) per project's «documents lie; tests don't» applied to tests themselves.
- **T-PRA-C** «compensating mechanism existence vs effectiveness» — citing `agents/compliance-verifier.md` exists ≠ proving it effectively catches role-swap violations. Counter: bench-test ≥3 fabricated violations + verify prompt catches them.
- **T-PRA-D** «1A scope leak back to dialogue» — if R-phase findings invalidate 1A verdicts beyond §11.3 prose-rules audit (e.g. revise §4.1 BROAD framing, §4.3 v2 BFR-default design), surface as separate observation in §10 of research-patch; do NOT silently revise 1A verdicts.

---

## §8 Output requirements

- Research-patch (required, per §6.1 schema)
- Sketch designs in drafts/ (required for each approved Action — at least 1, possibly 3)
- §1.7 self-review patch as §6 of research-patch (mandatory, T7 template)
- Memory entry update — `project_session_ordering_2026_05_13.md` to reflect R-phase completion

---

## §9 What this session does NOT do

- Does NOT ship principle tests (Commits 4, 5)
- Does NOT edit existing rules (Commit 3 patch revised here but applied in separate atomic commit)
- Does NOT relaunch 1A goal-clarity dialogue scope
- Does NOT trigger alt-target comparison research (separate session)
- Does NOT launch Wave 10 R-phase (separate work)
- Does NOT install MCP servers / dependencies
- Does NOT change CLAUDE.md / README.md / session-bootstrap.md (those revisions remain Commit 1 of atomic-commit-plan)

---

## §10 Final note to the AI running this

**This R-phase exists because the maintainer caught an antipattern that the AI session 1A committed.** The same anti-pattern is documented in 3 prior research-patches and has its own named tag `#recommendation-skips-own-discipline`. Do NOT repeat it in this session. Concretely:

- Every classification claim requires a probe + output + verdict
- Every action recommendation requires §1.7 Forward+Backward check
- Every shipping of design sketch requires self-review patch
- Closing the R-phase requires explicit §1.7 on the R-phase's own output

If you find yourself writing «we can mechanically test this rule» without showing a working probe — STOP. That is the antipattern. Run the probe; show the output; THEN write the claim.

---

## §11 See also

- [phase-research-coverage.md §1.7](../../rules/phase-research-coverage.md) — Forward+Backward methodology that this R-phase must apply to itself
- [docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md](../../../docs/meta-factory/research-patches/2026-05-09-recommendation-skips-own-discipline.md) — origin patch for the antipattern this R-phase corrects
- [docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md](../../../docs/meta-factory/research-patches/2026-05-11-§13.29-substantive-compliance-research.md) — discipline-theatre origin; relevant for «can we mechanically test prose rules?» question
- [docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md §11.3](../../../docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md) — 1A prose-rules audit observation that triggers this R-phase
- .claude/orchestrator-prompts/goal-clarity-dialogue/drafts/atomic-commit-plan.md (`../goal-clarity-dialogue/drafts/atomic-commit-plan.md`) — Commits 3/4/5 blocked on this R-phase
- [.claude/orchestrator-prompts/research-tooling-evaluation/kickoff.md](../research-tooling-evaluation/kickoff.md) — methodology template (DeepWiki vs Context7 vs WebSearch tool selection)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
