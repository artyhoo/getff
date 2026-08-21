# Companion-target comparison research — R-PHASE KICKOFF

> **Status:** ARMED 2026-05-16
> **Origin:** goal-clarity-dialogue 1A §4.2 v2 verdict — «COMPANION + two-horizon framing». 1A confirmed AI Factory + aif-handoff as TODAY's companions; future expansion (Superpowers / OhMyOpencode / Agent Teams / Cline / Cursor / Codex / Aider) requires comparative research before they ship as named companions.
> **Type:** standalone R-phase, NOT wave/phase, NOT dialogue. Single focused sitting, 3-4 hours.
> **Deliverable:** research-patch + per-target verdict (ADOPT / ADOPT-VOCABULARY / ADAPT / REFERENCE / KEEP-NARROW / BUILD / REJECT) per BFR-default rule §1 + recommendation for §4.4 5-item vocabulary mapping codification + draft content for Commit 7 (README subline widening).
> **NO PR. NO commits beyond research-patch. NO scope expansion beyond the 7 named candidates.**
> **Blocking dependency for:** Commit 7 (README subline + «is/isn't» widening) of [atomic-commit-plan.md](../goal-clarity-dialogue/drafts/atomic-commit-plan.md). Also unblocks §4.4 5-item codification (vocabulary mapping currently DEFERRED).

---

## §1 Problem this session solves

Goal-clarity-dialogue 1A landed «COMPANION + two-horizon framing» (§4.2 v2) but explicitly deferred per-candidate verdicts for the 7 alternative ecosystems. The decision tree is:

- **NOW (Commit 1, shipped):** subline names AI Factory + aif-handoff with explicit `(today)` temporal marker; «broader AI-runtime integration on roadmap» reserves future expansion
- **FUTURE (this R-phase):** alt-target comparison → per-candidate verdict → Commit 7 subline widening + §4.4 5-item vocabulary mapping

**The 5 vocabulary-overlap items deferred from §4.4** require this R-phase to land before they can be codified:

| # | Our component | Verdict pending alt-target research |
|---|---|---|
| 1 | `.claude/skills/orchestrator/` Mode A/B | ADOPT-VOCABULARY (1A provisional → confirm via cross-vendor survey) |
| 2 | `.claude/rules/parallel-subwave-isolation.md` | REFERENCE (1A provisional → confirm) |
| 3 | Planned swarm-readiness research session | DEFER-DELEGATE-TO-1B (still defers; this R-phase doesn't pre-empt 1B) |
| 4 | `agents/*.md` AI-agnostic sub-agent prompts | KEEP NARROW + REFERENCE (1A provisional → confirm) |
| 5 | Wave/Phase orchestration prompts | KEEP MANUAL (1A provisional → confirm) |

**Why this matters for project core:** without alt-target comparison, the project risks naming a single vendor (aif-handoff) as «companion» when the actual landscape has 6+ comparable ecosystems. `#vendor-lock-by-convenience` antipattern in [build-first-reuse-default.md §4](../../rules/build-first-reuse-default.md) directly targets this.

---

## §2 Out of scope

- **No new companion-targets** beyond the 7 named. If a new target surfaces during research, surface as observation in research-patch §10; do NOT add to scope.
- **No ship of Commit 7** in this session — R-phase only produces verdicts + draft Commit 7 content for maintainer review.
- **No §4.4 vocabulary codification commit** in this session — R-phase recommends; codification = separate commit at maintainer discretion.
- **No alt-target adoption** in current rules/agents/skills — purely informational survey.
- **No relaunch of 1A goal-framing scope** — verdicts about our project's positioning are locked at 1A; this R-phase informs Commit 7 wording, not Commit 1 re-litigation.

---

## §3 Hard constraints

- **§1.7 Forward-check ON THIS R-PHASE'S OUTPUT.** Self-review patch shipped with research-patch (T7 template per [`2026-05-09-self-review-audit.md`](../../../docs/meta-factory/research-patches/2026-05-09-self-review-audit.md)).
- **No paid LLM in CI.** Per [`no-paid-llm-in-ci.md`](../../rules/no-paid-llm-in-ci.md). DeepWiki + WebSearch are subscription-bundled.
- **BFR-default discipline applied to per-target verdicts.** For each candidate, classify per rule §1 typology (7 verdicts) with explicit problem-class match analysis (T16). No name-pattern shortcuts.
- **§3 mechanism per BFR rule.** For each of 7 candidates: ≥3 DeepWiki phrasings + ≥3 WebSearch phrasings on candidate name + capability area. SSOT consult mandatory.
- **No T11, T12, T13, T15, T16 traps.** Active traps listed in §7.
- **Two-AI-review pattern caveat.** Single-session verdicts on 7 candidates carry T13 risk («treating ADOPTED items as zero-work»); each candidate's evidence must include disconfirming probe attempt.

---

## §4 Methodology (per-candidate)

### §4.0 Candidate identification

Resolve canonical repository for each candidate via WebSearch (if not already in our memory or SSOT). Document URL.

**Pre-known canonicals (verified via DeepWiki probes in Track 2 / prior sessions):**

- ai-factory: `lee-to/ai-factory` (already-shipped companion, NOT in 7-list)
- aif-handoff: `lee-to/aif-handoff` (already-shipped companion, NOT in 7-list)
- OhMyOpencode: `code-yeongyu/oh-my-opencode` (verified Track 2)
- microsoft/agent-framework: `microsoft/agent-framework` (verified Track 2)
- continuedev/continue: `continuedev/continue` (verified Track 2)

**Pre-known unverified canonicals (require WebSearch first):**

- **Superpowers**: likely `obra/superpowers` per memory mention, but verify via WebSearch
- **Agent Teams**: ambiguous name; could be Microsoft Agent Teams, AutoGen, CrewAI, or some other agentic framework — disambiguate via WebSearch
- **Cline**: likely `cline/cline` (formerly Claude Dev) per knowledge; verify
- **Cursor**: closed-source product; verify if there's an OSS rules repo (e.g., `getcursor/cursor` for issues, but the editor itself is closed)
- **Codex**: ambiguous — OpenAI Codex (deprecated 2023) vs new OpenAI Codex CLI vs Codex by Sourcegraph; disambiguate
- **Aider**: `paul-gauthier/aider` per knowledge; verify

### §4.1 Per-candidate research (mandatory for all 7)

For each candidate:

**Step 1 — Project profile (DeepWiki `ask_question` ≥3 phrasings):**

1. «What problem class does <candidate> solve? What's its target user? Its scope?»
2. «Does <candidate> have Living Documentation enforcement (audit-AI-docs / drift detection / mutation testing on docs)?»
3. «Does <candidate> have rules-as-tests, principle tests, or framework-validates-itself discipline?»

**Step 2 — Capability-overlap analysis with our project:**

For each of the 5 §4.4 items (orchestrator Mode A/B; parallel-subwave-isolation; swarm-readiness; agents/*.md; orchestration prompts):

| Our item | Candidate's equivalent | Problem-class match? (T16) | Verdict |
|---|---|---|---|
| ... | ... | yes / partial / no with evidence | ADOPT / ADAPT / REFERENCE / KEEP-NARROW / REJECT |

**Step 3 — Complementarity vs duplication:**

- Does <candidate> SOLVE part of our problem we currently BUILD?  → ADOPT or ADAPT candidates
- Does <candidate> DUPLICATE what we already BUILD?  → REJECT or KEEP-NARROW
- Does <candidate> use DIFFERENT VOCABULARY for same shape?  → ADOPT-VOCABULARY
- Does <candidate> reference a pattern we should cite?  → REFERENCE
- Does <candidate>'s scope partially overlap with ours but differ in lifecycle?  → KEEP-NARROW (companion-positioning)

**Step 4 — Integration path (if ADOPT / ADAPT / REFERENCE):**

If verdict in {ADOPT, ADAPT, REFERENCE}, specify:
- What integration mechanism (config flag, install step, runtime adapter, named SSOT entry)?
- What's the maintenance burden on our side?
- Does adoption preserve our 5-layer framework + Living Documentation discipline?

### §4.2 Cross-candidate consolidation

After per-candidate research:

- **Companion-target shortlist:** which candidates should READ AS COMPANIONS in revised README subline? (Currently AIF + aif-handoff; widening criteria = ≥3 candidates pass companion test)
- **Vocabulary mapping decisions:** for §4.4 5-item codification, which candidate's vocabulary wins? Or do we keep ours?
- **Anti-recommendation list:** any candidate confirmed UNSUITABLE as companion (e.g., closed-source, opposite scope, dead project) — surface explicitly so Commit 7 doesn't accidentally name them

### §4.3 §1.7 Forward+Backward check on each verdict

**Forward-check (verdict complies with existing disciplines):**
- BFR-default rule §1 verdict typology applied?
- T16 problem-class match analysis explicit?
- SSOT consult done, candidate either already in SSOT or proposed for addition?
- Two-horizon framing preserved (TODAY vs ROADMAP companions)?

**Backward-check (verdict's implications swept across artefacts):**
- If ADOPT-VOCABULARY chosen for any §4.4 item, all our existing rules/agents/skills using OUR vocabulary need to update terminology (sweep scope: count usages, decide migration plan)
- If KEEP-NARROW chosen, existing rule needs «narrower than upstream X» annotation added
- README subline widening must not contradict «companion to AI Factory + aif-handoff (today)» — additive, not substitutive

### §4.4 Draft Commit 7 content (mandatory if ≥3 candidates pass companion test)

Draft revised README subline + «is/isn't» subsection updates in [drafts/commit-7-readme-revision.md](drafts/commit-7-readme-revision.md) — content per maintainer review.

---

## §5 Tools available

- DeepWiki MCP (`mcp__deepwiki__*`) — primary architectural research tool
- WebSearch — canonical-repo identification + state-of-art surveys
- Bash + grep + ripgrep — for SSOT consult + cross-checking against our artefacts
- ToolSearch — to load deferred tool schemas as needed

---

## §6 Deliverable structure

### §6.1 Research-patch — `docs/meta-factory/research-patches/2026-MM-DD-companion-target-comparison.md`

Mandatory sections:

- §1 Problem (recap from this kickoff §1)
- §2 Background (1A §4.2 v2 origin + Track 2 BFR upstream survey findings)
- §3 Per-candidate research (one §3.X per candidate, total 7 subsections)
  - §3.X.1 Canonical repo + project profile
  - §3.X.2 Capability-overlap analysis (5-item table)
  - §3.X.3 Complementarity vs duplication
  - §3.X.4 Integration path
  - §3.X.5 Per-candidate verdict + rationale
- §4 Cross-candidate consolidation
  - §4.1 Companion-target shortlist (with admission criteria)
  - §4.2 §4.4 5-item vocabulary mapping recommendation
  - §4.3 Anti-recommendation list
- §5 §1.7 Forward+Backward check on consolidation
- §6 Self-review patch (recursive — does this R-phase's output pass §1.7?)
- §7 DECISION-NEEDED surfaces (per [reviewer-discipline §2 pattern](../../rules/reviewer-discipline.md))
- §8 Drafts produced (Commit 7 content draft if criteria met)
- §9 §1.7 forward+backward check on THE RESEARCH-PATCH ITSELF
- §10 What this R-phase does NOT do
- §11 See also

### §6.2 Drafts in this kickoff's `drafts/` subdir (gitignored)

If consolidation supports Commit 7:

- `drafts/commit-7-readme-revision.md` — revised subline + «is/isn't» content

If §4.4 codification ready:

- `drafts/section-4.4-vocabulary-mapping-codification.md` — per-item verdict with cross-references

---

## §7 AI laziness traps active for this session

Per [`ai-laziness-traps.md §3`](../../rules/ai-laziness-traps.md) — kickoff author obligations satisfied via enumeration:

**Active canonical traps (HIGH relevance):**

- **T3** (plausible-looking finding without verification) — every per-candidate verdict requires evidence trail (DeepWiki output + WebSearch URL + grep against our artefacts)
- **T7** (following prompt literally) — for each candidate, ask «what does our maintainer NOT want me to assume about this?» before writing verdict
- **T11** (designing without prior art) — §3 mechanism per BFR rule mandatory for each candidate
- **T13** (treating ADOPTED items as zero-work) — for each candidate even at REFERENCE verdict, verify upstream had external evidence for the pattern (not just «exists»)
- **T15** (self-application MANDATORY) — §6.1 §6 self-review patch is mandatory
- **T16** (pattern-matching-on-name) — explicit «<candidate>'s problem class: X. Our problem class: Y. Match? evidence: …» for each candidate per §4.1 Step 3 table

**Domain-specific traps for this R-phase:**

- **T-CTC-A** «companion-bias» — tempting to confirm 7 candidates as companions because «more companions = stronger positioning». Counter: §4.3 anti-recommendation list MANDATORY. At least 1 candidate likely REJECTs as companion.
- **T-CTC-B** «vocabulary-vanity» — tempting to keep our vocabulary («KEEP NARROW» bias) without weighing ADOPT-VOCABULARY costs/benefits. Counter: for each §4.4 item, both vocabularies must be enumerated with cross-vendor drift cost analyzed.
- **T-CTC-C** «scope-leak to swarm-readiness» — item #3 of §4.4 is DEFER-DELEGATE-TO-1B by 1A verdict. Tempting to research it here. Counter: keep item #3 as DEFER; don't pre-empt 1B.
- **T-CTC-D** «closed-source candidate sleight-of-hand» — Cursor is closed-source; tempting to treat its rules surface (`.cursor/rules/`) as ADOPTABLE. Counter: explicit caveat «Cursor product is closed; rules-format is documented and adoptable independently».
- **T-CTC-E** «canonical-repo confusion» — Codex / Agent Teams ambiguous names; tempting to pick the first-Google-result. Counter: WebSearch ≥3 phrasings on each ambiguous name; document URL + verify the right project.

---

## §8 Output requirements

- Research-patch (required, per §6.1 schema)
- Drafts in `drafts/` (Commit 7 + §4.4 codification if criteria met)
- §1.7 self-review patch as §6 of research-patch (mandatory, T7 template)
- Memory entry update — `project_session_ordering_2026_05_13.md` to reflect R-phase completion

---

## §9 What this session does NOT do

- Does NOT ship Commit 7 (separate maintainer-approved atomic commit later)
- Does NOT ship §4.4 vocabulary codification (separate atomic commit at maintainer discretion)
- Does NOT edit `.claude/rules/*` or `.claude/skills/*` to apply ADOPT-VOCABULARY verdicts (those edits = separate commits)
- Does NOT install/integrate any upstream tool
- Does NOT relaunch 1A goal-clarity dialogue
- Does NOT launch 1B swarm-tools research (separate kickoff exists)
- Does NOT launch prose-rules audit R-phase (separate kickoff exists)
- Does NOT change CLAUDE.md / README.md / session-bootstrap.md (those = Commits 1 & 7 of atomic-plan)

---

## §10 Final note to the AI running this

**This R-phase exists because 1A explicitly deferred per-candidate verdicts** until comparative research lands. Maintainer 2026-05-16 stated «agnostic-future» framing — project must remain AI-runtime-agnostic, with 7 candidates surveyed before any new naming.

The hardest part of this R-phase is **per-candidate problem-class match analysis** (T16). For each candidate, BEFORE writing the verdict:

1. Read the candidate's docs (DeepWiki ≥3 phrasings)
2. Identify «what problem class does it solve?» — be specific, not «it's an AI tool»
3. Compare to OUR problem class for each of 5 items
4. ONLY THEN write verdict with explicit evidence

If you find yourself writing «<candidate> solves problem similar to ours» without naming the specific problem and citing the specific candidate doc — STOP. That is `#pattern-matching-on-name` antipattern. Re-probe with a specific problem-statement question.

---

## §11 See also

- [build-first-reuse-default.md §1](../../rules/build-first-reuse-default.md) — verdict typology
- [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) — research mechanism (DeepWiki + WebSearch)
- [ai-laziness-traps.md §2 T16](../../rules/ai-laziness-traps.md) — pattern-matching-on-name protocol
- [reviewer-discipline.md §2](../../rules/reviewer-discipline.md) — DECISION-NEEDED surface pattern
- [docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md §4.2 v2 + §4.4](../../../docs/meta-factory/research-patches/2026-05-16-goal-clarity-dialogue.md) — 1A origin
- [docs/meta-factory/research-patches/2026-05-16-bfr-default-upstream-verification.md](../../../docs/meta-factory/research-patches/2026-05-16-bfr-default-upstream-verification.md) — Track 2 BFR upstream survey (already covers 4 of the 7 candidates' partial profiles)
- [.claude/orchestrator-prompts/goal-clarity-dialogue/drafts/atomic-commit-plan.md Commit 7](../goal-clarity-dialogue/drafts/atomic-commit-plan.md) — Commit 7 dependency on this R-phase
- [.claude/orchestrator-prompts/post-1a-coordination/kickoff.md §3.4](../post-1a-coordination/kickoff.md) — pending-kickoff-creation tracker
- [.claude/orchestrator-prompts/prose-rules-audit-research/kickoff.md](../prose-rules-audit-research/kickoff.md) — methodology template (R-phase structure, T-XXX domain-specific trap pattern)

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
