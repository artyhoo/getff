# AIF SSOT corrections + new entries — KICKOFF

> **Status:** ARMED 2026-05-13.
> **Origin:** post-Wave-9 prioritisation session — empirical DeepWiki + context7 cross-checks on `lee-to/ai-factory` + `lee-to/aif-handoff` surfaced wrong-repo attribution on 4 existing SSOT entries (#27, #28, #29, #30) + identified 4 NEW high-value entries from `aif-handoff` monorepo structure that were missed by 2026-05-11 context7-only sweep.
> **Type:** standalone atomic SSOT-corrections session. NOT a research session — evidence already collected (research-tooling-evaluation/kickoff.md §10.1-§10.3). This kickoff turns that evidence into atomic SSOT commits.
> **Estimated effort:** 1-2 hours single sitting.
> **Owner-class:** «phase research sessions, capability-commit authors» per [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md).

---

## §1 Context (do NOT re-collect — already in research-tooling kickoff §10)

Read these sections of [research-tooling-evaluation/kickoff.md](../research-tooling-evaluation/kickoff.md) to get full evidence:
- **§10.1** — pre-session empirical findings (4 tests, drift signal Context7 2.x vs DeepWiki main)
- **§10.2** — SSOT attribution errors table + root cause (T16 historical incident)
- **§10.3** — `aif-handoff` full structure (7 TypeScript packages, primitives, NEW SSOT candidates)

This kickoff's job: turn that evidence into prior-art-evaluations.md edits.

---

## §2 Goal

ONE atomic commit on a feature branch:
- Title: `docs(ssot): correct AIF Handoff attribution + add aif-handoff monorepo entries (#27-#30 + #42-#45)`
- Body: §1.7 forward+backward checks with file:line citations to evidence in research-tooling-evaluation/kickoff.md §10.1-§10.3
- File edits: only `docs/meta-factory/prior-art-evaluations.md`
- PR description: §1.7 sections per [discipline-self-check.yml path filter](../../../.github/workflows/discipline-self-check.yml) requirement

---

## §3 Corrections to existing entries

### §3.1 SSOT #27 — `HANDOFF_MODE` env-var fork

**Currently cites:** `lee-to/ai-factory v2.x, skills/aif-implement/SKILL.md`

**Correction:** mixed citation needed.
- AI Factory 2.x had `HANDOFF_TASK_ID` env-var as bridge to aif-handoff (per context7 2026-05-13 query on `/lee-to/ai-factory`)
- AI Factory main/HEAD does NOT reference `HANDOFF_MODE`/`HANDOFF_TASK_ID` (per DeepWiki ask_question 2026-05-13)
- The `HANDOFF_MODE`-as-pattern fork likely lives in `lee-to/aif-handoff` runtime adapter layer

**Verify before edit:** context7 query `/lee-to/aif-handoff` for «HANDOFF_MODE env variable» or «runtime mode fork». If found there — re-attribute. If not — mark «pattern observed in v2.x bridge; current location unclear post-rename» + bump velocity-tag urgency.

**Severity:** Medium

### §3.2 SSOT #28 — `paused:true/false` semantic

**Currently cites:** `lee-to/ai-factory v2.x, handoff_sync_status`

**Correction:** wrong-repo. Should cite `lee-to/aif-handoff main, @aif/shared` + `@aif/data` (state machine — DeepWiki section 3.1 «Database Schema, Migrations & State Machine»). The `handoff_sync_status` tool is in `@aif/mcp` package (DeepWiki section 8.2 «MCP Sync: Conflict Resolution & Bidirectional Status»).

**Verify before edit:** DeepWiki `ask_question("lee-to/aif-handoff", "Where is the paused:true field defined? What states does the state machine support?")` → cite the file path returned.

**Severity:** High

### §3.3 SSOT #29 — `<!-- handoff:task:<id> -->` annotation

**Currently cites:** `lee-to/ai-factory v2.x, skills/aif-plan/SKILL.md`

**Correction:** PAIR-attribution. The annotation **convention** lives in `ai-factory` (`aif-plan/SKILL.md`). The annotation **consumer** lives in `aif-handoff` (`@aif/mcp` for parsing, `@aif/agent` for using task ID). Cite both: «`lee-to/ai-factory v2.x aif-plan/SKILL.md` (annotation convention) ↔ `lee-to/aif-handoff @aif/mcp + @aif/agent` (consumer)».

**Verify before edit:** DeepWiki + context7 for «handoff:task annotation» on both repos; confirm two-sided integration.

**Severity:** Medium

### §3.4 SSOT #30 — `implement-coordinator` subagent

**Currently cites:** `lee-to/ai-factory v2.x, subagents/implement-coordinator.md`

**CRITICAL CORRECTION:** cited file path **does not exist in cited repo**. DeepWiki on `ai-factory`: «no `subagents/` directory exists». The subagent lives in `lee-to/aif-handoff @aif/agent` section 5.2 «Subagents: Planner, Implementer & Reviewer» — three subagents (not one «implement-coordinator»).

**Re-attribution:** `lee-to/aif-handoff main, @aif/agent` Subagents (Planner, Implementer, Reviewer). Note: it's THREE subagents organized by pipeline stage, not one «implement-coordinator». Verdict (DEFER) may need reconsideration given the richer picture — or stay DEFER for same reason (we don't have autonomous batch use case).

**Verify before edit:** DeepWiki `ask_question("lee-to/aif-handoff", "Describe the Planner, Implementer, and Reviewer subagents — what does each do, when invoked, what produced")` → cite responses.

**Severity:** **CRITICAL — cited file path doesn't exist** (load-bearing reference to non-existent file).

---

## §4 NEW SSOT entries to add

### §4.1 #42 — DeepWiki MCP

Already proposed in [research-tooling-evaluation/kickoff.md §2 + §6](../research-tooling-evaluation/kickoff.md). If research-tooling R-phase has already run and shipped #42 — skip here. If not — this kickoff may pre-ship #42 (atomic with attribution corrections); coordinate with research-tooling R-phase timing.

### §4.2 #43 — `@aif/runtime` RuntimeAdapter pattern

**Source:** `lee-to/aif-handoff main, @aif/runtime` package — DeepWiki section 6 «Runtime Layer» (6.1-6.5).

**Pattern:** RuntimeAdapter interface + Registry + Capabilities + concrete adapters for Claude (SDK/CLI/API transports) + Codex + OpenRouter + OpenCode.

**Verdict candidate:** ADOPT VOCABULARY — direct production match to our AI-agnostic sub-agent boundary discussion ([agents/*.md](../../../agents/) pattern). Their abstraction is broader (full runtime, not just sub-agent prompt) — our pattern is the «AI-agnostic markdown prompt» subset.

**Rationale:** validates our AI-agnostic discipline empirically; gives us a maturity reference if/when we move from sub-agent prompts to a full runtime abstraction.

**Trigger to revisit:** when our `agents/*.md` pattern evolves beyond markdown prompts (e.g. needs runtime-level invocation, multi-transport support); OR Phase 11+ AIF integration formalises runtime layer.

### §4.3 #44 — `@aif/mcp` Task/Plan MCP server package

**Source:** `lee-to/aif-handoff main, @aif/mcp` — DeepWiki section 8 «MCP Integration» (8.1 MCP Tools: Task & Plan Management; 8.2 MCP Sync: Conflict Resolution & Bidirectional Status).

**Pattern:** MCP server that any Claude Code session can connect to; manages tasks via MCP tools; bidirectional state sync; conflict resolution.

**Verdict candidate:** **ADOPT or ADOPT-CONDITIONAL** — direct integration path for Phase 10 swarm coordination. Adopting means: `claude mcp add` `@aif/mcp` server; project's swarm sessions manage tasks through it.

**Rationale:** removes the need to build our own task-coordination layer for swarm work. Production-tested, MIT licensed.

**Trigger to revisit:** if Phase 10 swarm pattern adopts kanban-shape; OR if aif-handoff project becomes unmaintained.

### §4.4 #45 — `@aif/agent` Watchdogs + Error Classification + Recovery

**Source:** `lee-to/aif-handoff main, @aif/agent` — DeepWiki section 5.4 «Watchdogs, Error Classification & Recovery».

**Pattern:** self-healing for stuck stages; automatic error classification; automated rework loops when review-subagent catches issues.

**Verdict candidate:** ADAPT — our `parallel-subwave-isolation.md` rule currently mandates «STOP and report to orchestrator» on worktree-add failure. Their pattern: automatic recovery. We could ADAPT for orchestrator-side self-healing in long-running waves.

**Trigger to revisit:** when ≥3 wave incidents document «orchestrator stuck because Sonnet session hung» (currently 1: Wave 8.1/8.1b/8.2 contamination 2026-05-12).

### §4.5 #46 — aif-handoff «Subagents-mode vs Skills-mode» dichotomy

**Source:** `lee-to/aif-handoff` (per cutcode.dev `aif.cutcode.dev/#handoff` + DeepWiki structure overview).

**Pattern:** two productized execution modes:
- Subagents mode — iterative refinement, higher quality, more tokens
- Skills mode — fast single-pass

**Verdict candidate:** ADOPT VOCABULARY — direct productized analog of our Mode A/B orchestrator pattern in `.claude/skills/orchestrator/`. Vocabulary alignment helps cross-reference + reduces drift.

**Rationale:** validates our orchestrator skill's Mode A/B design pattern as convergent-with-production-practice.

**Trigger to revisit:** when orchestrator skill is rewritten or replaced with aif-handoff-based runtime (Phase 11+ scenario).

---

## §5 §1.7 forward+backward template for PR body

```markdown
### §1.7 Forward-check applied

This PR introduces ATTRIBUTION CORRECTIONS to SSOT entries #27-#30 + 4 NEW entries #43-#46 (and possibly #42 if not already shipped by research-tooling R-phase). Forward-checks per [phase-research-coverage.md §1.7](.claude/rules/phase-research-coverage.md):

- **Layer 1 (rule self-consistency):** prior-art-evaluations.md §3 entry-trigger criteria + §5 staleness policy unchanged by this commit. Schema unchanged. — see prior-art-evaluations.md:<L>-<L>
- **Layer 2 (cited-file existence):** each corrected/new entry's cited path verified via DeepWiki ask_question or context7 query in same sitting; outputs cited. — see research-tooling-evaluation/kickoff.md:<§10.1-§10.3 references>
- **Layer 3 (cross-doc consistency):** aif-comparison.md → check no contradicting attribution (may need follow-up; flag if found)
- **Layer 4 (consumer-facing impact):** no shipped artefact changes; project-internal only — no AGENTS.md / template changes
- **Layer 5 (trigger sweep):** §13.x entries §13.6, §13.18, §13.32 review for stale references to corrected SSOT entries; flag if found

### §1.7 Backward-check applied

- **Sweep target:** all docs/meta-factory/research-patches/* citing SSOT #27-#30 — list at:<L>-<L>
- **aif-comparison.md citations** to corrected entries — file:line at:<L>-<L>
- **Wave 8.x / 9.x retro documents** mentioning AIF Handoff family — file:line at:<L>-<L>
- **Verdict:** identified citations updated in same commit (if any); OR documented as «citation valid post-correction» per entry.
```

Each `<L>-<L>` placeholder must be filled with actual file:line citations before PR opens. Generic «Checked all» without file:line = §1.7 substance arm rejects (Wave 8.3 gate).

---

## §6 Verification steps before commit

1. **For each correction in §3:** run DeepWiki `ask_question` or context7 `query-docs` against the cited path; cite the actual response in the entry's rationale. T3 verify-before-stating.
2. **For each new entry in §4:** run same verification; confirm the package/section exists; cite file path returned.
3. **Cross-check `aif-comparison.md`** for contradicting attribution — if any AIF section there cites wrong-repo paths, update or flag.
4. **Grep all research-patches/** for references to old (wrong) paths from SSOT #27-#30; update citing patches OR mark «valid pre-correction» per patch.
5. **Verify PR body §1.7 sections** pass [discipline-self-check.yml](.github/workflows/discipline-self-check.yml) substance arm — each section ≥40 chars + ≥1 file:line citation.

---

## §7 Anti-deliverables (do NOT do)

- ❌ Change verdicts (DEFER, ADAPT, ADOPT) of existing entries beyond what attribution correction warrants. Verdict review = separate work.
- ❌ Edit `aif-comparison.md` body content. If contradicting attribution found there — flag as observation, propose follow-up commit.
- ❌ Add §13.x open-question entries. The «SSOT-creation gate proposing path-existence verification» idea ([research-tooling-evaluation/kickoff.md §10.2 implication](../research-tooling-evaluation/kickoff.md)) is research-tooling R-phase scope, not this session.
- ❌ Re-do prior-art evaluation methodology. Each correction is paths+citations, not «re-evaluate whether this is ADOPT/DEFER/REJECT».
- ❌ Bundle research-tooling kickoff §6 SSOT #42 DeepWiki entry into THIS session unless research-tooling R-phase has not yet shipped. If pre-shipping #42 here — research-tooling R-phase removes #42 from its scope + cross-references this commit.

---

## §8 Self-application (T15)

This kickoff is itself discipline-bearing. Its claims (file paths, package names, section numbers) are **unverified estimates** in §3-§4. Executing session MUST:

1. Re-run DeepWiki / context7 queries cited in §3/§4 to confirm package names + section numbers haven't shifted since 2026-05-13 capture.
2. If any verification disagrees with this kickoff's claim — fix in executing session's output, flag drift in commit body.
3. Apply §1.7 substance gate to OWN PR body — each Forward/Backward check section must cite file:line for evidence, not generic prose.

If executing session finds this kickoff's claims wrong — that's itself a finding worth recording (research-tooling-evaluation R-phase backfill input).

---

## §9 See also

- [research-tooling-evaluation/kickoff.md §10.1-§10.3](../research-tooling-evaluation/kickoff.md) — full empirical evidence pool
- [docs/meta-factory/prior-art-evaluations.md](../../../docs/meta-factory/prior-art-evaluations.md) — target file (single edit)
- [docs/meta-factory/aif-comparison.md](../../../docs/meta-factory/aif-comparison.md) — cross-check target
- [.github/workflows/discipline-self-check.yml](../../../.github/workflows/discipline-self-check.yml) — §1.7 PR-body substance gate
- [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md) — owner-class: «phase research sessions, capability-commit authors»

---

## §10 Final note to the AI / human executing this

This is **paper work**, not research. Evidence is already collected. Job = verify each path, write the edits, open atomic PR with §1.7 substance sections.

Resist temptation to:
- Re-evaluate verdicts (out of scope)
- Expand scope to «while we're here, let's also fix...» (drive-by risk per [feedback_no_drive_by_prs](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md))
- Skip verification because «kickoff already cites it» — kickoff is unverified estimate; verify per §6 + §8

The goal is **clean atomic SSOT-corrections commit** that downstream sessions can rely on for accurate AIF Handoff attribution. Three things: correct 4 entries, add 4 new entries, file:line citations throughout.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
