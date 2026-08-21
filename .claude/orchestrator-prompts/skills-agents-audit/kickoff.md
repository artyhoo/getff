# Skills + Agents Audit + Mode A Refactor — KICKOFF

> **Status:** ARMED 2026-05-16. Created by Queue mode bootstrap orchestrator as Artefact C.
> **Type:** KICKOFF FILE — instruction document for a FUTURE session to execute. This file does NOT perform the audit. The future session that reads this file performs the audit.
> **Mode:** Queue mode (Worker + Reviewer), Opus everywhere, burn-mode authorized.
> **Estimated effort:** 3-5 hours wall-clock single session; up to 2 subagent iterations likely.
> **Output shape:** 1 research-patch at `docs/meta-factory/research-patches/2026-MM-DD-skills-agents-audit.md` + optional `audit-report.md` companion if scale warrants.
> **Parent context:** `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` — see History for dispatch record.

> **Authoritative for:** skills+agents audit methodology, Mode A refactor analysis scope, acceptance criteria for the skills-agents-audit research-patch.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). NOT authoritative for Queue mode workflow — see Artefact A skill at `~/.claude/skills/orchestrator/references/queue-mode.md` once created.

---

## §0 How to use this kickoff (read FIRST)

You are a **Worker subagent** dispatched by a Queue mode Orchestrator. Read this file fully before any action. Then execute phases §4.1 through §4.5 in order, writing each section of the research-patch incrementally before moving to the next phase.

**What you are NOT doing:** you are NOT cleaning up skills, NOT deleting agents, NOT editing the orchestrator SKILL.md, NOT committing anything. You are producing a **research-patch** with findings and recommendations. Cleanup actions require maintainer approval and explicit follow-up sessions.

**Read order:**
1. This file end-to-end
2. §3 Hard constraints (mandatory before any file access)
3. §2 Step-0 mandatory reads
4. Begin §4.1 Phase 1 (enumerate)

---

## §1 Problem

The project has accumulated skills and agents over multiple waves without a systematic audit pass.
Specifically:

- **Project-scope skills** under `.claude/skills/` grew incrementally (self-reflection, template-audit, tool-bootstrapping) with no cross-skill consistency review.
- **User-scope skills** under `~/.claude/skills/` include the orchestrator skill (`orchestrator/SKILL.md`, 680 lines) and several others (`ai-docs/`, `git-user-info-ui-design.md`, and likely others from unrelated projects) — no inventory exists.
- **Agents** under `agents/` (review-sidecar, compliance-verifier, docs-auditor, best-practices-sidecar) were created at different waves and may have trigger/scope drift relative to current project state.
- **Mode A** in the orchestrator SKILL.md (`~/.claude/skills/orchestrator/SKILL.md`) was designed before Queue mode and headless dispatch (`claude -p`) existed as primary dispatch patterns. Its residual role — if any — has not been formally analyzed.

**Symptoms of un-audited growth:**
- Skills may reference phase numbers, rule names, or file paths that have since changed.
- Two skills may have overlapping trigger conditions, causing ambiguous auto-trigger in Claude Code.
- Agents may describe a pattern that is now superseded by a newer agent or a project rule.
- Mode A (inline Opus sub-agent spawning from a parent orchestrator session) may be fully subsumed by Queue mode's Worker dispatch pattern, creating documentation that implies it is an active pattern when it is not.

**Why now:** Queue mode (Artefact A) has just been codified. This creates an opportunity to audit the full skill/agent surface against the new operational baseline — and decide what Mode A means in a world where Queue mode exists.

---

## §2 Goal

### §2.1 Complete inventory of `.claude/skills/*` (project-scope)

Find and enumerate every file under `.claude/skills/` in the project repo (`/Users/art/code/rules-as-tests-aif/.claude/skills/`). Build a table: skill name, primary file (SKILL.md or equivalent), line count, any `references/` subdirectory.

### §2.2 Complete inventory of `~/.claude/skills/*` (user-scope)

Find and enumerate every skill under `~/.claude/skills/`. Include all subdirectories and their files. Note: user-scope skills may include skills from other projects (e.g. playwright, vitest, claude-api) — enumerate all, but flag non-rules-as-tests-aif skills as "external project" for lower audit priority.

### §2.3 Complete inventory of `agents/*.md`

Find and enumerate every file under `agents/` in the project root. Build a table: agent name, line count, described trigger pattern (if any), primary purpose.

### §2.4 Per-artefact drift analysis

For each skill and each agent: one structured row covering:
- **Description-content match**: does the SKILL.md description field (or front-matter) accurately summarize what the skill's body says? Any stale claims?
- **Trigger accuracy**: are the trigger keywords / conditions still relevant to how Claude Code auto-triggers skills? Any trigger overlap with another skill?
- **Cross-reference liveness**: do internal links (`[.claude/rules/foo.md](...)`, `[packages/core/...]`, etc.) resolve to existing files? Any broken refs?
- **Phase/wave references**: does the skill/agent reference a specific phase or wave number that has since completed or changed character?
- **Self-application**: does the skill apply its own discipline? (e.g. ai-laziness-traps rule requires kickoffs to enumerate T-numbers — does the skill itself enumerate T-numbers when describing how to use it?)

### §2.5 Cross-skill overlap detection

Build a cross-reference matrix: for each pair of skills with non-empty trigger conditions, check overlap. Overlap means: the same user utterance could plausibly trigger both skills. Flag overlaps as HIGH (same keyword), MEDIUM (semantically adjacent trigger), or LOW (edge case).

### §2.6 Mode A refactor proposal

Analyze the current Mode A pattern in `~/.claude/skills/orchestrator/SKILL.md` (inline Opus sub-agent spawned from parent session using Task tool for a single sub-task). Given that:
- Queue mode (Artefact A) handles autonomous multi-kickoff research workflows
- Mode B / Mode B' handle umbrella PR batches with file-prompt dispatch
- Headless `claude -p` dispatch exists as a time-windowed fallback

What is Mode A's residual role? Is there a use case it serves that neither Queue mode nor Mode B covers? Produce a specific decision matrix (see §4.4 below) and a concrete recommendation: keep / re-scope / retire.

---

## §3 Hard constraints

1. **Read-only on all skills and agents in this kickoff.** Worker produces RECOMMENDATIONS only. No edits to `.claude/skills/`, `~/.claude/skills/`, or `agents/*.md` files during this session. Any cleanup is a follow-on task.

2. **Artifact Ownership Contract applies.** Per [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md):
   - `.claude/rules/*.md` — maintainer-owned, do NOT edit
   - `.claude/skills/` (project-scope) — maintainer-owned; Worker may read, not edit
   - `~/.claude/skills/` (user-scope) — more permissive; but in this kickoff Worker is read-only because the goal is audit, not immediate cleanup. Cleanup actions are for a separate follow-on session with explicit maintainer authorization.
   - `packages/core/principles/*.test.ts` — not writable by Worker
   - `docs/meta-factory/prior-art-evaluations.md` — not directly editable; SSOT entries proposed in research-patch §appendix only

3. **Build-vs-reuse before recommending merge or deletion.** Each recommendation to merge, deprecate, or delete a skill/agent MUST be grounded in actual content read (not title-matching). Per T16: verify that the overlap is functional (same problem class), not just nominal (same name or similar-sounding keyword).

4. **No execution of recommendations.** The research-patch describes what should change, not what has changed.

5. **No paid LLM in CI.** Per [.claude/rules/no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md): any methodology for ongoing automated skill auditing must be deterministic or subscription-bundled (not API-billed CI). Recommendations that propose automated skill drift detection must respect this constraint.

6. **Output annotation required.** First line of the research-patch MUST be `<!-- scope:skills-agents-audit -->` per `packages/core/principles/10-research-patch-annotation.test.ts`. Worker must run `npm run test:principles` before reporting RESEARCH-COMPLETE.

7. **Depth constraint on user-scope skills from other projects.** Skills in `~/.claude/skills/` that clearly belong to other projects (e.g. playwright, vitest, claude-api for non-rules-as-tests sessions) should be enumerated but NOT deeply audited — note "external-project scope, low priority for this audit."

---

## §4 Methodology

### §4.1 Phase 1 — Enumerate

**Goal:** complete population census before any sampling. Per T10: enumeration BEFORE sampling.

**Steps:**

1. **Project-scope skills:**
   ```bash
   find /Users/art/code/rules-as-tests-aif/.claude/skills -type f | sort
   ```
   Build table: skill name, primary file path, line count (`wc -l`), has references/ subdir.

2. **User-scope skills:**
   ```bash
   find /Users/art/.claude/skills -type f | sort
   ```
   Same table. Flag any skill that is clearly from a non-rules-as-tests-aif project.

3. **Agents:**
   ```bash
   find /Users/art/code/rules-as-tests-aif/agents -type f -name "*.md" | sort
   ```
   Table: agent name, line count, first-line description.

4. **Population summary:** Before Phase 2, write a summary section in the research-patch: total N_skills_project, N_skills_user, N_agents. This is the population. Every item in the population will be analyzed in Phase 2 — not sampled.

**Write-as-you-go:** Write the inventory table to the research-patch §2 (Inventory) section immediately upon completing Phase 1, before proceeding to Phase 2.

### §4.2 Phase 2 — Per-artefact analysis

**Goal:** one structured row per skill and per agent covering the 5 dimensions from §2.4.

**Method per artefact:**

1. Read the primary file fully (no skimming — per T1, floor = read entire file, not first 30 lines).
2. If a `references/` subdirectory exists, list all files and read any that are referenced from the primary SKILL.md.
3. Fill in the analysis row:

| Artefact | Scope | Description matches content? | Triggers accurate? | Broken refs? | Phase/wave stale? | Self-applies discipline? | Notes |
|---|---|---|---|---|---|---|---|
| (name) | project / user / agent | YES / NO / PARTIAL | YES / NO / PARTIAL | YES (list) / NO | YES (which) / NO | YES / NO / N/A | (free) |

4. For broken refs: use `ls` to verify each cross-reference path exists. Do NOT assume a path is live because it looks plausible.

5. For trigger accuracy: compare trigger keywords with the skill's actual body. If the trigger says «when user mentions X» but the skill body never addresses X — that is a trigger accuracy failure.

6. For self-application: check whether the skill applies its own stated discipline. E.g. if a skill describes the ai-laziness-traps rule — does it enumerate T-numbers in its own methodology? If not, note.

**Write-as-you-go:** Write Phase 2 analysis table rows to research-patch §3 (Per-artefact analysis) incrementally — write each row as you complete its skill/agent analysis, not all at end.

### §4.3 Phase 3 — Cross-skill overlap detection

**Goal:** identify any pair of skills whose trigger conditions could fire on the same user utterance.

**Method:**

1. Collect all trigger keyword lists from Phase 2 rows.
2. Build a cross-reference matrix. For each pair (S_i, S_j) where both have non-empty triggers: list common or semantically adjacent keywords.
3. Classify overlap:
   - **HIGH**: same keyword verbatim in both trigger lists
   - **MEDIUM**: semantically adjacent (e.g. «orchestrator» and «оркестратор», or «review» and «проверь»)
   - **LOW**: edge case (different context but imaginable co-trigger)
4. For HIGH and MEDIUM overlaps: describe the co-trigger scenario and its downstream risk (wrong skill fires, conflicting guidance to user).

**Write-as-you-go:** Write Phase 3 matrix to research-patch §4 (Overlap detection) upon completion.

### §4.4 Phase 4 — Mode A refactor proposal

**Goal:** produce a specific decision matrix for Mode A's fate given the current dispatch landscape.

**Context to read before this phase:**
- `~/.claude/skills/orchestrator/SKILL.md` §Mode A section (specifically: what does Mode A say it does, when, and what are its acceptance criteria?)
- Artefact A skill file once it exists: `~/.claude/skills/orchestrator/references/queue-mode.md` — describes Queue mode triggers and scope
- The meta-kickoff §3.3 D-decision-5: «Mode A in existing orchestrator skill becomes redundant given Queue mode + headless dispatch, but defer the refactor to Artefact C kickoff»

**Decision matrix to produce:**

| Use case | Queue mode covers? | Mode B covers? | Headless covers? | Mode A residual role? |
|---|---|---|---|---|
| Multi-kickoff autonomous research queue | YES | NO | PARTIAL (single call) | NONE |
| Single-task inline sub-agent (1 small task, parent needs result back) | NO (overkill) | NO (file-prompt is for batches) | MAYBE | POSSIBLE — see analysis |
| Umbrella PR with N atomic sub-tasks | NO (research not PR work) | YES | NO | NONE |
| Quick verification sub-task during an active session | NO | NO | POSSIBLE | POSSIBLE — see analysis |
| (add rows as Phase 1+2 surfaces additional use cases) | | | | |

**Residual-role analysis for Mode A:**

The Worker must reason through: is there a use case where Mode A is the BEST option (not merely possible)? Specifically:
- Is there a class of tasks where spinning up a full Queue mode Orchestrator is overkill, Mode B file-prompt doesn't fit, and headless `claude -p` is insufficient?
- If yes: what is the minimal definition of that use case? Rewrite Mode A's trigger condition and scope to match only that residual use case.
- If no: recommend retirement. But per T11 and T16: retirement recommendation MUST cite evidence that no use case remains — not just «Queue mode exists therefore Mode A is redundant» (that is name-matching, not function-matching).

**Specific recommendation format:**

```text
Mode A fate recommendation: KEEP (re-scoped to: <new trigger condition>) | RETIRE (rationale: <evidence-based>)

If KEEP:
  Proposed new trigger: <specific condition, not «when X mentions orchestrator»>
  Proposed new scope: <what Mode A covers exclusively>
  Conflicts with Queue mode: <none | minor | major — describe>

If RETIRE:
  Evidence Mode A use cases are covered: <Queue mode covers X because Y; Mode B covers Z because W>
  Migration path for current Mode A users: <how to achieve same result via Queue mode or Mode B>
  Removal plan: mark deprecated in SKILL.md; remove in Wave N+1
```

**Write-as-you-go:** Write Phase 4 analysis to research-patch §5 (Mode A refactor proposal) upon completion.

### §4.5 Phase 5 — Recommendations

**Goal:** synthesize Phases 1-4 into actionable recommendations grouped by priority.

**Structure:**

1. **Cleanup list** (HIGH priority — broken refs, stale triggers that actively mislead):
   - Each item: artefact name, issue type (broken-ref / stale-trigger / stale-phase-ref / description-drift), specific fix needed, file:line citation.

2. **Refactor proposals** (MEDIUM priority — overlap resolution, Mode A fate, trigger rewrites):
   - Each item: what changes, which artefacts affected, what the new state should look like.

3. **No-action items** (artefacts that checked out clean — explicitly list, do NOT omit):
   - Each item: artefact name, reason for no-action, confidence level (how thoroughly was it checked?).

4. **Open decisions for maintainer** (items the Worker cannot decide autonomously — see §7 below).

**Format constraint:** Every recommendation row must cite at least one file:line reference from Phase 2/3 analysis. No prose-only recommendations (per T3).

**Write-as-you-go:** Write Phase 5 to research-patch §6 (Recommendations) upon completion.

---

## §5 Output requirements

### §5.1 Primary output

Single research-patch file at:
```text
docs/meta-factory/research-patches/2026-MM-DD-skills-agents-audit.md
```
(Worker substitutes today's date for MM-DD.)

**First line MUST be:**
```text
<!-- scope:skills-agents-audit -->
```

This is required by `packages/core/principles/10-research-patch-annotation.test.ts`. Missing or malformed annotation = principles test failure = RESEARCH-COMPLETE blocked.

**Required sections in the research-patch:**

| Section | Content |
|---|---|
| §1 Problem | Brief restatement (1-2 paragraphs) of what this audit addresses |
| §2 Inventory | Population census table from Phase 1 |
| §3 Per-artefact analysis | Full analysis table from Phase 2 |
| §4 Overlap detection | Cross-skill overlap matrix from Phase 3 |
| §5 Mode A refactor proposal | Decision matrix + recommendation from Phase 4 |
| §6 Recommendations | Cleanup list + refactor proposals + no-action items from Phase 5 |
| §7 Open decisions | Items requiring maintainer input (see §7 of this kickoff for pre-enumerated items) |
| §8 Self-application | Per §8 of this kickoff |
| §9 See also | Cross-references |

### §5.2 Optional companion output

If the Phase 2 analysis table grows to >100 rows (unlikely given current surface size, but possible if user-scope skills are extensive), Worker may create a companion file:
```text
.claude/orchestrator-prompts/skills-agents-audit/audit-report.md
```
containing the raw per-artefact rows, with the research-patch §3 summarizing highlights only. This is permitted but not required.

### §5.3 Principles test gate (mandatory before RESEARCH-COMPLETE)

Before reporting RESEARCH-COMPLETE, Worker MUST run:
```bash
cd /Users/art/code/rules-as-tests-aif && npm run test:principles
```
If any test fails (especially `10-research-patch-annotation.test.ts`), fix the violation and re-run. Do NOT report RESEARCH-COMPLETE until all principles tests pass. Log the green run in state.md:
```text
- <ISO timestamp> — skills-agents-audit principles tests green (N tests passed)
```

Reviewer will verify this log entry exists and is not stale (was run after the final section was written).

---

## §6 AI laziness traps active for this session

Per [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) §3 obligations on kickoff authors — enumerated active traps:

**T1 — Sampling floor.** Counter for this audit: every skill and agent in the population (Phase 1 census) MUST be analyzed in Phase 2. Population-level coverage, not sampling. If there are 25 skills/agents total, all 25 get a Phase 2 row. «Sampled 5, all looked clean, done» = T1 failure.

**T3 — Every claim cites source.** Counter: every finding in Phase 2 rows and Phase 5 recommendations must cite file:line. «The orchestrator skill has stale triggers» is insufficient — «`~/.claude/skills/orchestrator/SKILL.md:42` trigger includes «старшая/младшая модель» but skill body never addresses this pair» is sufficient.

**T4 — No premature closure.** Counter: all 5 phases must complete before reporting RESEARCH-COMPLETE. If Phase 3 (overlap detection) feels «quick» — that likely means it was done shallowly. Run the adversarial counter-prompt: «what trigger overlap did I miss?» If the answer is «none» — rephrase and try again.

**T7 — Adversarial counter-prompt, not literal-prompt following.** Counter: at the end of Phase 2, before proceeding to Phase 3, run this counter-prompt explicitly: «Which skill or agent did I NOT read the full body of, only the front-matter?» For any found — go back and read. At end of Phase 5, run: «Which no-action item should actually be a cleanup item and I classified it as no-action because it seemed fine from the title?»

**T10 — Population first, then sampling.** Counter: Phase 1 MUST complete before Phase 2 begins. Do not start analyzing skills you've already found in the course of enumerating. Complete enumeration, write inventory table, THEN start analysis.

**T11 — Build-vs-reuse before proposing new patterns.** Counter: if Phase 5 recommendations include «add automated skill drift detection» — first check whether existing project infrastructure (principles tests, pre-push hooks) could cover this. Per [prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) SSOT and context7, do not propose custom tooling without checking what exists.

**T15 — Self-application (MANDATORY).** Counter: research-patch §8 must address: does this audit itself follow the methodology it describes? Specifically:
- Did Phase 1 complete before Phase 2? (population-first discipline per T10)
- Did every skill get a full read (not skimmed)? (T1 floor per this kickoff)
- Did every recommendation cite file:line? (T3 per this kickoff)
- Are there any T-traps that this audit itself fell into? Be honest.

**T16 — Pattern-matching-on-name (adopted-tool-wrong-problem).** Counter: for every overlap detected in Phase 3, verify it is functional overlap (same problem class when both trigger), not nominal overlap (same word in trigger lists but different operational context). For the Mode A refactor: «Queue mode exists, therefore Mode A is redundant» is name-matching. The correct form: «Queue mode covers use-case X because [specific mechanism]; Mode A's trigger condition for use-case X was [cite SKILL.md:line]; those are the same function class; therefore overlap is genuine.»

**T-AO-D — Scope creep via observations.** This is the most likely trap in an audit session. Counter: if Worker discovers a larger systemic issue (e.g. «all skills need a complete rewrite», «the entire agents/ pattern is superseded by Queue mode Reviewers»), the Worker MUST document the finding in research-patch §7 as a maintainer-decision item and STOP — do not expand scope to also fix it in the same session. The audit's scope is ANALYSIS + RECOMMENDATIONS, not cleanup execution.

**T-Wave-SkillsAudit-A — Shallow front-matter reading masking broken body.** Skills have YAML front-matter with `description:` and `triggers:` fields that are readable without parsing the body. An AI session is tempted to read front-matter only (syntactically clean, fast) and declare the skill's description and trigger accurate without verifying against the body. Counter: for EVERY skill, explicitly verify that at least 3 claims in the front-matter description are substantiated by specific content in the body (file:line). If the front-matter says «covers template-render» — find where the body addresses template rendering, cite the line. If not found → description-content mismatch.

**T-Wave-SkillsAudit-B — Mode A declared redundant without use-case residual check.** D-decision-5 in the parent session (§3.3 of meta-kickoff) says Mode A is «suspected redundant». There is a risk that Worker pattern-matches on this language and concludes «redundant» without actually checking residual use cases. Counter: Phase 4 decision matrix MUST include at least one row per mode (Queue mode, Mode B, headless) that explicitly maps Mode A's stated use case against that mode's capabilities. If no row surfaces a Mode A residual role, that is a valid finding — but only if the matrix was actually filled out, not just declared empty.

---

## §7 Open decisions for maintainer

Worker surfaces these as RECOMMENDATIONS in research-patch §7 — Worker does NOT decide them.

**D-AuditC-1: Cleanup authorization.** Which cleanup actions from Phase 5 recommendations does the maintainer want to execute? Options: (a) execute all HIGH-priority cleanup items in a follow-on session; (b) execute only broken-ref fixes (smallest, safest); (c) defer all cleanup pending Wave N target.

**D-AuditC-2: Mode A fate.** Based on Phase 4 analysis — keep / re-scope / retire? If retire: when (immediate / Wave N+1 / after Queue mode has been used in 3+ sessions)? If keep + re-scope: Worker provides the proposed new trigger in research-patch §5; maintainer accepts or modifies before implementation.

**D-AuditC-3: User-scope skill audit depth.** Some skills in `~/.claude/skills/` may belong to other projects (external-project scope, low audit priority per §3 constraint 7). Does maintainer want a full audit of external-project skills in a separate session, or is the inventory (§2 of research-patch) sufficient for now?

**D-AuditC-4: Overlap resolution strategy.** For any HIGH or MEDIUM overlaps found in Phase 3: merge skills, narrow trigger conditions, or add exclusion conditions? This requires understanding intended usage scenarios that only maintainer can confirm.

**D-AuditC-5: Automated drift detection.** Should an ongoing skill-drift check be added to the principles test suite (deterministic, no LLM in CI per policy)? If yes — what would a deterministic check look like (broken-ref detection is feasible; trigger-accuracy is hard to test mechanically)? Worker may propose a design in research-patch §7.5; decision rests with maintainer.

---

## §8 Self-application

This section applies Queue mode discipline to the execution of THIS audit kickoff.

**Question:** does the execution of this kickoff itself match Queue mode discipline as codified in Artefact A (`~/.claude/skills/orchestrator/references/queue-mode.md`)?

**Expected self-application checks (Worker must fill these in research-patch §8):**

1. **Orchestrator → Worker → Reviewer hierarchy maintained?** Was this kickoff dispatched by a Queue mode Orchestrator (not directly by maintainer)? Check state.md at `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` — does it show a DISPATCHED-WORKER entry for this kickoff?

2. **Write-as-you-go discipline followed?** Did Worker write each Phase output section to the research-patch incrementally (per L1 lesson), or did it batch in head and dump at end? Worker should be honest about this.

3. **Principles test gate applied?** Did Worker run `npm run test:principles` before reporting RESEARCH-COMPLETE? Log entry in state.md?

4. **T-AO-D enforced?** If Worker discovered scope-expanding issues during the audit — did it document them as open decisions (§7 items) rather than expanding the session's scope?

5. **Population census before sampling?** Was Phase 1 completed and its output written before Phase 2 began?

6. **Hierarchy depth respected?** Worker is depth-2 (subagent of Orchestrator). Did Worker at any point attempt to spawn its own sub-tasks or sub-agents? (Should be NO — if YES, that is a D4 violation from the meta-kickoff.)

If any self-application check fails — Worker must note this honestly in research-patch §8. The failure is data, not a reason to hide the finding.

---

## §9 See also

- **Artefact A skill** (Queue mode reference, once created): `~/.claude/skills/orchestrator/references/queue-mode.md` — describes Queue mode triggers, Worker/Reviewer roles, and hierarchy depth constraint.
- **Parent session state.md**: `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` — empirical record of the parent 4-kickoff Queue mode run (4 GO + 1 deferred); includes reviewer verdicts and iteration records.
- **Meta-kickoff (parent context)**: `.claude/orchestrator-prompts/queue-mode-bootstrap/kickoff.md` — §3.3 D-decision-5 (Mode A redundancy suspicion), §4 artefact queue, §8 T-AO-D trap (scope creep via observations).
- **Queue mode bootstrap state**: `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` — dispatch log for this kickoff; Reviewer verifies RESEARCH-COMPLETE entry exists before returning verdict.
- **CLAUDE.md Artifact Ownership Contract**: `/Users/art/code/rules-as-tests-aif/CLAUDE.md` — defines what Worker may and may not edit; especially the read-only constraint on `.claude/rules/*`, `.claude/skills/` (project), `packages/core/principles/*`.
- **Doc-authority-hierarchy rule**: `.claude/rules/doc-authority-hierarchy.md` — if any skill/agent is found to be missing its Authoritative-for header (where required by §2 of this rule), that is a drift finding.
- **AI-laziness-traps rule**: `.claude/rules/ai-laziness-traps.md` — canonical T-trap catalogue referenced in §6 above; Worker reads this before Phase 1.
- **Phase-research-coverage rule**: `.claude/rules/phase-research-coverage.md` — §1 6-item checklist for negative-existence claims (applies when Worker concludes «no overlap found» or «no broken refs» — those are negative-existence claims requiring the 6-item checklist).
- **Prior-art-evaluations SSOT**: `docs/meta-factory/prior-art-evaluations.md` — if Phase 5 recommendations include any new pattern or tooling, check here first for existing prior-art evaluation.
- **Principles test for annotations**: `packages/core/principles/10-research-patch-annotation.test.ts` — the specific test Worker must pass before RESEARCH-COMPLETE.
- **AI-agnostic subagent patterns** (reference for agents/ audit): `agents/{review-sidecar,compliance-verifier,docs-auditor,best-practices-sidecar}.md`.

---

## Acceptance criteria (Reviewer checks these)

- [ ] Research-patch file exists at `docs/meta-factory/research-patches/2026-MM-DD-skills-agents-audit.md`
- [ ] First line of research-patch is `<!-- scope:skills-agents-audit -->`
- [ ] All 9 sections (§1-§9) present in research-patch with substantive content (not stubs)
- [ ] Inventory table (§2) covers 100% of enumerated skills/agents — population count stated explicitly
- [ ] Phase 2 analysis table (§3) has one row per skill/agent — no sampling
- [ ] Every analysis row cites at least one file:line reference
- [ ] Overlap matrix (§4) covers all skill pairs with non-empty triggers
- [ ] Mode A decision matrix (§5) includes at least 4 use-case rows with Queue/B/headless coverage columns
- [ ] Mode A recommendation is explicit (KEEP re-scoped / RETIRE) with evidence-based rationale
- [ ] Every recommendation in §6 cites at least one file:line from Phase 2/3
- [ ] §7 open decisions listed (at minimum D-AuditC-1 through D-AuditC-5)
- [ ] §8 self-application section present with honest answers to all 6 self-checks
- [ ] T-AO-D specifically called out in §6 or §7 (scope creep pattern addressed)
- [ ] `npm run test:principles` log entry in state.md showing green run after final section written
- [ ] Kickoff does NOT execute the audit — this file describes methodology only; audit is performed by the future Worker session

---

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
