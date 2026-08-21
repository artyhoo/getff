# Docs Audit Bootstrap — META-KICKOFF (writes 3 doc-audit kickoffs)

> **Status:** ARMED 2026-05-16. **PREFERRED timing: AFTER Session 3 (B + C execution) completes.** Rationale below in §3.3 — B+C produce findings that materially improve D1/D2/D3 kickoff scope: B flags suspect claims (input for D1), C audits skills+agents (frees D1 from duplication, informs D3 shipped-artefacts methodology), B+C themselves produce new research-patches (must be in D2 enumeration scope). **Fallback minimum: after Session 2** (Queue mode skill written) — kickoff still works but D1/D2/D3 scope is approximate, not refined by B+C empirical findings. **Ad-hoc fallback: before Session 2** — meta-kickoff is self-contained but inline-discipline-heavy; not recommended unless urgency overrides quality.
> **Type:** META-ORCHESTRATOR session. Authors **3 doc-audit kickoff files** through Queue mode discipline (research+review cycles per kickoff). Does NOT execute the audits.
> **Mode:** Queue mode autonomous, Opus everywhere, burn-mode authorized.
> **Estimated effort:** 2-3 hours wall-clock single session.
> **Output shape:** 3 kickoff `.md` files under gitignored `.claude/orchestrator-prompts/docs-audit-*/kickoff.md`. No source code, no commits, no pushes.

---

## §0 How to use this kickoff

You are a fresh Opus session. You are the Orchestrator. Your job: dispatch Workers + Reviewers per Queue mode discipline (described below in §6) to produce 3 doc-audit kickoff drafts.

**Read order:**
1. This file fully
2. §2 Step-0 mandatory reads
3. §3 Parent session context — what already happened, what gap this fills
4. §4 Queue + §5 Per-artefact specs (D1, D2, D3)
5. §6 Discipline / workflow
6. §10 Pre-flight checklist — RUN before §11
7. §11 Dispatch sequence

Then begin.

---

## §1 Purpose

Project has accumulated significant doc tech debt across **7+ AI-session waves**:
- 30+ research-patches under `docs/meta-factory/research-patches/` — no systematic retirement
- 30+ §13.x entries in `open-questions.md` — armed years ago, may have fired or need retirement
- Cross-doc consistency (README / CLAUDE.md / session-bootstrap / EXECUTION-PLAN) — last systematic check was Wave 1 headers (2026-05-09), 3+ waves ago
- Authoritative-for headers per `doc-authority-hierarchy.md` — Wave 1+2 added on canonical list, but Wave 8.8+ created new docs; principle 09 only checks canonical list
- Shipped artefacts (`packages/core/templates/*`) — drift between templates and consumer expectations not audited since Wave 7
- `audit-ai-docs.sh` covers D1-D5 narrow probes; holistic code-vs-docs check absent
- `PROPOSAL.md` FROZEN — may have accidental edits never caught
- INSTALL.md / INSTALL-FOR-AI.md — consumer-facing accuracy not re-verified after Wave 10 prep

This meta-kickoff produces **3 doc-audit kickoff drafts** so future Queue mode session can execute them when timing is right (after B+C from `queue-mode-bootstrap`, before Wave 10 implementation — see §3 timing rationale).

These are **drafts only**. Maintainer reviews + decides when to schedule execution.

---

## §2 Step-0 mandatory reads

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order:

1. **[README.md](../../../README.md#why-this-exists)** — project goal (authoritative). Goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.
2. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract (CRITICAL — defines what you can/cannot edit; output of this session goes to gitignored `.claude/orchestrator-prompts/*` only)
3. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — operational restatement
4. **Discipline rules:**
   - `.claude/rules/doc-authority-hierarchy.md` — Authoritative-for header format + 4 anti-patterns; load-bearing for D1 audit scope definition
   - `.claude/rules/phase-research-coverage.md` — §1 6-item checklist; §4 anti-patterns including `#trigger-sweep` (load-bearing for D2)
   - `.claude/rules/ai-laziness-traps.md` — T-trap catalogue
   - `.claude/rules/no-paid-llm-in-ci.md` — audit methodology constraints
5. **Parent meta-kickoff** — `.claude/orchestrator-prompts/queue-mode-bootstrap/kickoff.md` (read it; you inherit Queue mode discipline, especially **T-AO-K dual-channel for Claude Code claims** and **T-AO-L project-local principle tests mandate** — both apply to your kickoff authoring too)
6. **Parent session state** — `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` (audit trail of 4 GO + 1 deferred run; reference for empirical evidence of discipline working)
7. **Queue mode skill (if exists at session start)** — `~/.claude/skills/orchestrator/SKILL.md` + `references/*` — if Session 2 has been run, this is the canonical Queue mode reference; use it. If not exists yet, this meta-kickoff is self-contained.
8. **Memory entries** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
   - `feedback_delegation_model.md` — Opus everywhere in burn mode
   - `project_claude_p_headless_window.md` — `claude -p` time-windowed (~2026-06-16)
   - `feedback_no_drive_by_prs.md` — atomic-umbrella discipline (each D1/D2/D3 kickoff is its own future PR scope)

---

## §3 Parent session context — what already happened, why this matters

### §3.1 What `queue-mode-bootstrap` produced (or is producing)

Parent meta-kickoff `queue-mode-bootstrap` writes:
- **Artefact A** — Queue mode skill extension to `~/.claude/skills/orchestrator/`
- **Artefact B** — kickoff to re-verify 4 GO results from `autonomous-research-orchestrator` parent session with `claude-code-guide` channel
- **Artefact C** — kickoff for skills+agents audit + Mode A refactor

### §3.2 Why doc audit is its own work (NOT covered by B or C)

- **B** = re-verify specific past claims with new channel; narrow scope
- **C** = `.claude/skills/*` + `agents/*` audit; narrow scope (skill/agent surface only)
- **Doc audit** = **everything else**: canonical docs, accumulated research-patches/retros, §13.x triggers, shipped templates, INSTALL guides — three streams, much larger surface

### §3.3 Timing rationale (when to RUN this meta-kickoff — primary recommendation)

**Run AFTER Session 3 (B + C execution) completes.** Reasons:

1. **B output = «suspect claims» map.** B re-verifies parent's 4 GO results via claude-code-guide and flags any claim that was on misleading info. D1 (internal docs audit) kickoff can explicitly include «special attention to claims flagged by B as suspect» in scope. Without B done → D1 doesn't know where to look harder.

2. **C output = skills+agents inventory.** C audits `.claude/skills/*` and `agents/*` for drift, dead skills, broken refs, Mode A refactor proposal. D1 then knows what's covered by C vs what's residual for D1 to handle (avoid duplication). D3 (shipped-artefacts) gets C's Mode A refactor recommendation as input for shipped-`agents/*` treatment.

3. **Accumulation completeness.** B + C themselves produce 2 new research-patches. If this meta-kickoff runs BEFORE B + C — D2 (accumulation cleanup) enumerates accumulation as it was; new patches arrive after planning and become «out of scope by accident». After Session 3 → enumeration is current.

4. **Recursive self-test of Queue mode.** Session 3 is the first real use of Queue mode skill on production-shape work (re-verify + audit). Any Queue mode skill issues surface in Session 3 → this meta-kickoff (Session 4) inherits fixes. Running this BEFORE Session 3 misses that calibration.

**Wall-clock cost of waiting for Session 3:** ~3-5 hours additional (Session 3 duration). Worth it: D1+D2+D3 execution itself is 7-10 hours; a precise kickoff is force-multiplier for that 7-10h budget.

### §3.3.1 Schedule (when to EXECUTE D1/D2/D3 outputs — for maintainer reference)

```
PR #54 (SSOT corrections) ──→ Session 2 (queue-mode-bootstrap) ──→ Session 3 (B + C execution)
                                                                          │
                                                                          └─→ ★ Session 4: THIS meta-kickoff (writes D1/D2/D3 kickoffs) ★
                                                                                              │
                                                                                              └─→ Session 5: D1 + D2 + D3 execution
                                                                                                              │
                                                                                                              └─→ Wave 10 implementation (on clean base)
```

**Why this slot for execution of D1/D2/D3:**
- B re-verifies past claims → doc audit gets «verified» vs «suspect» classification as input
- C audits skills+agents → frees doc audit to focus on `docs/`, README, INSTALL, templates
- Implementation waves will mutate documentation → audit base BEFORE changes, not after

**This meta-kickoff DOES NOT execute D1/D2/D3.** It only authors the kickoff files. Execution scheduling is maintainer decision (Session 5 slot).

### §3.4 Lessons from `queue-mode-bootstrap` to inherit

- L1-L7 (state.md write-as-you-go, file-system precedence, anti-collusion spot-check, T-AO trap catalogue, no-maintainer-decisions, Opus everywhere, claude-code-guide mandate)
- **T-AO-K** (dual-channel for Claude Code claims) — if any D1/D2/D3 kickoff makes Claude-Code-specific claims, dual-channel verification mandate applies
- **T-AO-L** (project-local principle tests) — if Worker output is a research-patch type, MUST run `npm run test:principles` before reporting RESEARCH-COMPLETE. Output here = kickoff files (not patches), but discipline-completeness check still applies — run principles tests on `.claude/orchestrator-prompts/docs-audit-*/kickoff.md` paths if they're enrolled in any principle test

---

## §4 Active queue (3 doc-audit kickoff drafts)

| # | Artefact | Output path | Estimated future-execution time |
|---|----------|-------------|---------------------------------|
| D1 | Kickoff: internal canonical docs audit | `.claude/orchestrator-prompts/docs-audit-internal/kickoff.md` | ~3-4h via Queue mode |
| D2 | Kickoff: accumulation cleanup audit | `.claude/orchestrator-prompts/docs-audit-accumulation/kickoff.md` | ~2-3h via Queue mode |
| D3 | Kickoff: shipped artefacts + consumer-facing audit | `.claude/orchestrator-prompts/docs-audit-shipped/kickoff.md` | ~2-3h via Queue mode |

**Dispatch order:** D1 → D2 → D3 (sequential).

**Rationale for order:**
- D1 first: establishes canonical baseline (what's authoritative for what); D2/D3 reference D1's findings
- D2 second: cleanup of accumulation; depends on D1 to know what's «load-bearing» vs «historical»
- D3 last: shipped-artefacts compliance depends on D1 baseline + D2 cleanup status (if accumulation suggests pattern changes, shipped templates may need updates)

---

## §5 Per-artefact specifications

### §5.D1 — Kickoff: internal canonical docs audit

**Path:** `.claude/orchestrator-prompts/docs-audit-internal/kickoff.md` (create dir + file)

**CRITICAL role clarification:** Worker for D1 writes a **KICKOFF FILE** describing future audit work. Worker does NOT actually perform the audit, does NOT enumerate docs, does NOT propose specific edits to canonical docs. Output of THIS Worker = a markdown file describing future work. Output of future session executing D1 = the actual audit report.

**Purpose:** Audit cross-doc consistency, authoritative-for header coverage, frozen-doc integrity, code-vs-docs drift across all canonical project-internal docs. Surface drift, broken refs, conflicting authority claims. Recommend (not decide) cleanup actions.

**Structure (~400-500 lines, standard kickoff layout):**

- §1 Problem — accumulated drift across canonical docs (README / CLAUDE.md / session-bootstrap / EXECUTION-PLAN / PROPOSAL / closed-questions / open-questions / aif-comparison / architecture)
- §2 Goal:
  - §2.1 Complete inventory of canonical project-internal docs (project-scope only, not user-scope skills)
  - §2.2 Per-doc analysis: authoritative-for header present and accurate? cross-references live? content matches code reality?
  - §2.3 Cross-doc consistency matrix (e.g. README says X, EXECUTION-PLAN says X — same? CLAUDE.md says Y, session-bootstrap says Y — same?)
  - §2.4 Frozen-doc integrity (PROPOSAL.md byte-diff vs last «frozen» state if discoverable via git)
  - §2.5 Authoritative-for header compliance — every doc in canonical list per `doc-authority-hierarchy.md` REQUIRED_HEADER_DOCS has compliant header? Conflicting authority claims surfaced?
- §3 Hard constraints:
  - Read-only audit — output is RECOMMENDATIONS, not edits
  - Project Artefact Ownership Contract applies to all canonical docs
  - Build-vs-reuse before recommending pattern changes
  - No-paid-LLM-in-CI policy for audit methodology
- §4 Methodology (5 phases):
  - §4.1 Enumerate (find all canonical docs; build inventory table)
  - §4.2 Per-doc analysis (authority header / refs / drift)
  - §4.3 Cross-doc consistency matrix
  - §4.4 Frozen-doc integrity check
  - §4.5 Recommendations (cleanup list, refactor proposals, no-action items)
- §5 Output requirements — single research-patch `docs/meta-factory/research-patches/2026-MM-DD-docs-audit-internal.md`. Plus optional `audit-report.md` companion if scale warrants.
- §6 AI laziness traps — T1 floor (every canonical doc enumerated, not sampled), T3 (file:line citations), T4 (don't close phase early — all 5 phases), T7 (adversarial: which canonical doc did I miss?), T11 (build-vs-reuse before pattern claims), T15 (self-application: does this audit itself comply with doc-authority-hierarchy?), T16, T-AO-K (claude-code-guide for any CC claims in canonical docs), T-AO-L (run principles tests on output)
- §7 Open decisions for maintainer — cleanup approvals; authority claim resolutions if conflicts found
- §8 Self-application — apply Queue mode (from Session 2 skill) to D1 execution; does THIS audit comply with its own discipline?
- §9 See also — Artefact A skill, doc-authority-hierarchy.md rule, principle 09 test

**Acceptance criteria for D1 kickoff draft:**
- All standard kickoff sections §1-§9 present
- §4 has 5 explicit phases
- §6 enumerates T-traps with rationale per kickoff-authors obligations in `ai-laziness-traps.md`
- T-AO-K + T-AO-L referenced with reflexive application notes
- Worker role clarification present (audit-describer, not auditor)
- File is plain markdown, 400-500 lines

### §5.D2 — Kickoff: accumulation cleanup audit

**Path:** `.claude/orchestrator-prompts/docs-audit-accumulation/kickoff.md`

**CRITICAL role clarification:** Worker for D2 writes a kickoff describing future cleanup work. Worker does NOT cleanup retros, does NOT retire §13.x entries, does NOT delete research-patches. Output = markdown file describing future methodology.

**Purpose:** Audit accumulated documents (research-patches + retros + §13.x triggers in open-questions.md). Surface candidates for: (a) retirement / archival, (b) trigger fired but not surfaced, (c) trigger still armed but no longer relevant. Recommend actions; maintainer decides.

**Structure (~400-500 lines):**

- §1 Problem — accumulation without cleanup: 30+ research-patches, 30+ retros (estimate verify in audit), 30+ §13.x entries; trigger sweep last done 2026-05-08
- §2 Goal:
  - §2.1 Inventory: research-patches (count + age + status)
  - §2.2 Inventory: retros (count + age + scope-bound classification)
  - §2.3 §13.x trigger sweep — per `phase-research-coverage.md §1.6` discipline (each non-cascade entry: decompose trigger → verify → classify FIRED / STILL-ARMED / CASCADE-DEPENDENT)
  - §2.4 Retirement candidates classification per entry
- §3 Hard constraints:
  - Append-only register for research-patches per `prior-art-evaluations.md §3` precedent
  - Folder-level authority for retros + research-patches per `doc-authority-hierarchy.md §5`
  - Frozen docs untouched
- §4 Methodology (5 phases):
  - §4.1 Enumerate research-patches with age + tag analysis
  - §4.2 Enumerate retros with phase ID + closure status
  - §4.3 §13.x trigger sweep (per phase-research-coverage §1.6)
  - §4.4 Retirement-candidate scoring (criteria explicit)
  - §4.5 Recommendations grouped by action type (archive / retire / cascade-dependent / no-action)
- §5 Output requirements — single research-patch `docs/meta-factory/research-patches/2026-MM-DD-docs-audit-accumulation.md`
- §6 AI laziness traps — T1, T4, T7 (which §13.x did I miss?), T11, T13 (treating armed §13.x as «still relevant» without verification), T14 (`#trigger-sweep` anti-pattern in own work — empty trigger sweep = potentially silent miss), T15, T16, T-AO-L
- §7 Open decisions — retirement approvals (each retirement is maintainer decision)
- §8 Self-application — does this audit itself perform §1.6 trigger sweep on the day it runs? Mandatory.
- §9 See also

**Acceptance criteria for D2 kickoff draft:**
- Same standard sections + acceptance shape as D1
- §4.3 explicitly cites `phase-research-coverage.md §1.6` 6-item trigger sweep methodology
- §6 includes `#trigger-sweep` anti-pattern with reflexive application
- 400-500 lines plain markdown

### §5.D3 — Kickoff: shipped artefacts + consumer-facing audit

**Path:** `.claude/orchestrator-prompts/docs-audit-shipped/kickoff.md`

**CRITICAL role clarification:** Worker for D3 writes a kickoff describing future audit of consumer-facing shipped artefacts. Worker does NOT perform the audit, does NOT modify templates, does NOT update INSTALL guides. Output = markdown describing future methodology.

**Purpose:** Audit consumer-facing surfaces (`packages/core/templates/*` shipped via `install.sh`, `INSTALL.md`, `INSTALL-FOR-AI.md`, `packages/preset-next-15-canonical/*`, `agents/*` consumer-installable agents) for: (a) drift from project-internal canonical docs, (b) `audit-ai-docs.sh` D1-D5 probe coverage on shipped surfaces, (c) consumer-installation accuracy post-Wave 10 prep, (d) `doc-authority-hierarchy.md` compliance per principle 09 REQUIRED_HEADER_DOCS canonical list.

**Structure (~400-500 lines):**

- §1 Problem — consumer-facing surfaces accumulate drift relative to project-internal docs; consumer install path (Wave 10 will add TS hooks affecting `install.sh` flow); INSTALL guides may be stale
- §2 Goal:
  - §2.1 Inventory of consumer-facing surfaces (templates + INSTALL + preset + agents)
  - §2.2 Per-surface check: authoritative-for header present (principle 09 REQUIRED_HEADER_DOCS list)? consumer install workflow accurate?
  - §2.3 `audit-ai-docs.sh` D1-D5 probe coverage on shipped surfaces (does each probe fire on shipped artefact violations?)
  - §2.4 T16 problem-class match check — does shipped artefact's claimed scope match real consumer use cases?
  - §2.5 Cross-check with current project-internal canonical docs (find divergence)
- §3 Hard constraints:
  - **Three-layer authority model** per `INSTALL-FOR-AI.md` — respect override hierarchy; consumer customisation via `.override.md` is by design
  - Read-only audit
  - Generated-doc compliance trigger per `closed-questions.md §13.21` — runtime-generated consumer docs (e.g. AI-generated `RULES.md`) are NOT in scope (deferred to L3 Phase 11+); static-copied artefacts ARE in scope
- §4 Methodology (5 phases):
  - §4.1 Enumerate shipped artefacts
  - §4.2 Per-artefact header + drift check
  - §4.3 D1-D5 probe coverage matrix
  - §4.4 T16 problem-class match per shipped artefact
  - §4.5 Recommendations
- §5 Output requirements — single research-patch `docs/meta-factory/research-patches/2026-MM-DD-docs-audit-shipped.md`
- §6 AI laziness traps — T1, T3, T4, T7 (which shipped surface did I miss?), T11, T13 (`#pattern-matching-on-name` — shipped templates with familiar names may not match consumer problem class), T15, T16 specifically (load-bearing for shipped artefacts), T-AO-K (Claude Code claims about consumer-side Claude Code usage), T-AO-L
- §7 Open decisions — template update approvals; INSTALL guide revisions
- §8 Self-application
- §9 See also — INSTALL-FOR-AI.md, doc-authority-hierarchy.md, principle 09 test, closed-questions.md §13.21

**Acceptance criteria for D3 kickoff draft:**
- Same shape as D1/D2
- §2.5 cross-check with project-internal docs explicit
- §3 three-layer authority model honored
- §6 includes T16 problem-class match with reflexive application
- 400-500 lines plain markdown

---

## §6 Discipline / workflow

You operate Queue mode. If Session 2 has produced Queue mode skill at `~/.claude/skills/orchestrator/` — load it via the standard skill auto-trigger pattern + follow `references/queue-mode.md`. If Session 2 not yet run — apply Queue mode discipline ad-hoc (per parent session pattern in `autonomous-research-orchestrator/`).

### §6.1 Per-artefact protocol (abbreviated — full version in queue-mode-bootstrap §6)

For each artefact K in [D1, D2, D3]:
1. Pre-dispatch checklist (predecessor done; state.md updated; iter counter = 0)
2. Worker dispatch (Task tool, `subagent_type: general-purpose`, `model: opus`, prompt per §7.1 template)
3. File-system verify (`ls`/`wc -l`/`grep -c '^## §'`)
4. Reviewer dispatch (per §7.2 template)
5. Iteration loop (GO → next; REVISE → re-dispatch with fixes; iter > 5 → escalate)
6. Anti-collusion spot-check (formula from queue-mode-bootstrap §6.1 step 6, or simplified random-section read)
7. Mark K done; next artefact

### §6.2 state.md

Create `.claude/orchestrator-prompts/docs-audit-bootstrap/state.md` at session start. Standard format (Queue / Statuses legend / Active / History) per Queue mode discipline.

### §6.3 Escalation triggers

Same as queue-mode-bootstrap §6.3 — max iter (5), tool-unavailable, scope-conflict, maintainer-dialogue-required, infinite-loop, budget-cap.

---

## §7 Subagent dispatch templates

If Queue mode skill (`references/worker-template.md` + `references/reviewer-template.md`) exists at session start — **use those templates directly**. They're canonical going forward.

If skill not yet exists, apply these abbreviated templates (consistent with queue-mode-bootstrap §7.1/§7.2):

### §7.1 Worker template (abbreviated)

```
You are a Worker subagent dispatched by an Orchestrator. Today is YYYY-MM-DD. Burn-mode authorized — Opus everywhere.

## Your task

Execute Artefact <K> as specified in this kickoff §5.<K>. Read fully. Follow ALL acceptance criteria.

## Output

Write to: <specific path for K>

## Discipline (Step 0 invariants inline)

Goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.
Invariants: (1) build-vs-reuse SSOT consult; (2) recursive self-application; (3) search-coverage 6-item checklist.
No paid LLM in CI policy applies.

## T-traps active

<list from §5.<K>>

## Tools

- context7 MCP / deepwiki MCP / WebSearch / WebFetch
- **claude-code-guide subagent for Claude Code internals questions** — reuse same instance via SendMessage for multiple CC questions (continuity)

## Incremental write discipline

- Write each section to file as completed; update state.md per section; do not batch in head

## Project-local principle tests (T-AO-L counter, MANDATORY)

If output is a research-patch — must satisfy `packages/core/principles/10-research-patch-annotation.test.ts` (first line: `<!-- scope:<slug> -->`). Output here = kickoff file (not patch) — verify principle test scope: principles checking research-patches only? Confirm via reading principle 10 test. If kickoff files NOT covered by principles tests — skip; if covered — run before RESEARCH-COMPLETE.

## Anti-scope

- DO NOT edit project-scope: README.md, CLAUDE.md, .claude/rules/*, .claude/skills/* (PROJECT scope), packages/core/principles/*, docs/meta-factory/prior-art-evaluations.md
- DO NOT push commits or open PRs
- DO NOT execute downstream kickoffs (D1/D2/D3 are DRAFTS only — for future Queue mode session)
- DO NOT decide maintainer-owned questions
- DO NOT escalate to user mid-task — write BLOCKED:<reason> to state.md

## When done

Append to state.md: `- <ISO timestamp> — RESEARCH-COMPLETE <K> (iter <N>)`. Return summary.
```

### §7.2 Reviewer template (abbreviated)

```
You are a REVIEWER subagent. You did NOT write this. Be skeptical. DO NOT collude.

## Method

1. Read §5.<K> acceptance criteria
2. Read output file
3. Per-criterion substance check
4. For Claude-Code-specific claims — dispatch claude-code-guide first; cross-check DeepWiki
5. T-trap audit per §5.<K>
6. Hard-constraint audit
7. **Principle tests verification (T-AO-L counter):** check state.md for principles-tests-green log entry if applicable

## Output

Write verdict to: `.claude/orchestrator-prompts/docs-audit-bootstrap/review-<K>-iter-<N>.md`

Per-criterion findings; HARD-FIX list; SOFT items; Confidence with explicit predicates.

## Rules

- No collude — hard-constraint violation = REVISE regardless of «closeness»
- No fix — report only
- HARD-FIX = 0 AND no hard-constraint violated AND T-counters applied → GO
```

---

## §8 T-AO + domain-specific traps active

Inherit from queue-mode-bootstrap §8 — all T-AO-A through T-AO-L, plus T-meta-A (recursive self-application of Queue mode while writing kickoffs about audits) and T-meta-B (template consistency between this meta-kickoff and Queue mode skill if it exists).

**Domain-specific:**

- **T-docs-A — «sample 3 docs and declare audit done»** — Worker writing D1 may be tempted to enumerate «typical» docs (README, CLAUDE.md, EXECUTION-PLAN) and call it complete. Counter: D1 kickoff MUST require complete enumeration via `find` / `git ls-files docs/` / similar, not curated sample.
- **T-docs-B — «§13.x trigger sweep theatre»** — D2 Worker may write «trigger sweep included» without specifying actual mechanical methodology. Counter: D2 kickoff §4.3 must cite `phase-research-coverage.md §1.6` 6-item methodology by exact reference.
- **T-docs-C — «shipped artefacts as inert»** — D3 Worker may treat `packages/core/templates/*` as «just templates, not really docs». Counter: principle 09 REQUIRED_HEADER_DOCS list canonically includes shipped artefacts — D3 kickoff must cite this list as scope source.

---

## §9 Maintainer handoff

**Pre-launch (maintainer prepares):**
- Verify Claude Code v2.1.98 (or current non-buggy)
- Verify DeepWiki + context7 MCP available
- Verify `claude-code-guide` subagent_type available
- (Optional) Verify Session 2 completed — `~/.claude/skills/orchestrator/references/queue-mode.md` exists. If so, Worker prompts can cite Queue mode skill instead of inlining discipline. If not, this meta-kickoff is self-contained but heavier on inline discipline restatement.
- Paste this kickoff as first message in new Opus session.

**During execution:**
- Watch `.claude/orchestrator-prompts/docs-audit-bootstrap/state.md` for progress
- Do NOT edit D1/D2/D3 outputs while sessions in progress
- Pause if needed via «pause» message

**On final completion:**
- Review 3 kickoff drafts (D1/D2/D3)
- Decide when to schedule their execution (recommended slot: after B+C, before Wave 10 implementation — see §3.3)
- 3 kickoffs themselves are gitignored; no commit needed

---

## §10 Pre-flight checklist

Execute via Bash at session start; log to state.md History:

1. `claude --version` — expect non-buggy (e.g. 2.1.98)
2. `claude mcp list` — DeepWiki + context7 connected
3. `git status` — note any untracked / pending state from parent or sibling sessions
4. `git branch --show-current` — note (informational; no edits to repo)
5. `claude -p "echo PROBE-OK"` — expect single «PROBE-OK». If date past ~2026-06-16 → headless fallback disabled, log
6. **`claude-code-guide` subagent_type availability** — confirm listed in system reminder at session start with tools Bash + Read + WebFetch + WebSearch. If MISSING → escalate (L7 mandate inherited from queue-mode-bootstrap)

state.md initial section template:

```markdown
# Docs Audit Bootstrap State

> Session start: <ISO timestamp>
> Orchestrator model: claude-opus-4-7
> Mode: Queue mode autonomous, sequential D1→D2→D3
> Parent meta-kickoff: queue-mode-bootstrap (status: <executed | not-yet>)

## Pre-flight check results
[fill per §10]

## Queue
| # | Artefact | Status | Iterations | Notes |
| D1 | internal docs audit kickoff | PENDING | 0 | First dispatch |
| D2 | accumulation cleanup kickoff | PENDING | 0 | After D1 |
| D3 | shipped artefacts kickoff | PENDING | 0 | After D2 |

## Active
- Current artefact: (none — about to dispatch D1)

## History
- <timestamp> — orchestrator session started
[etc.]
```

---

## §11 Dispatch sequence

After pre-flight passes:

1. Initialize state.md per §10 template
2. Dispatch Worker for D1 per §7.1 template
3. File-system verify
4. Dispatch Reviewer for D1 per §7.2 template
5. Iterate until GO or escalation
6. Spot-check (random section)
7. Mark D1 done; dispatch Worker for D2
8. (repeat 3-7 for D2)
9. (repeat 3-7 for D3)
10. Final orchestrator summary per §11.1

### §11.1 Final orchestrator message (success path)

Must include:
- Per-artefact status (GO state, iterations, files written)
- Token spend estimate (if observable)
- T15 self-application audit: did orchestrator follow Queue mode discipline? Cite state.md
- Recommendations for maintainer:
  - Review 3 kickoff drafts
  - Schedule execution slot (after B+C, before Wave 10 implementation)
  - Possibly bundle D1+D2+D3 execution in one future Opus session via Queue mode (now equipped)
- Honesty note: spot-checks that surfaced issues? Self-noticed traps corrected mid-flight?

### §11.2 Final orchestrator message (escalation path)

Trigger fired. State.md location. Specific maintainer action needed.

---

## §12 Stop conditions

STOP when ONE of:
1. All 3 artefacts GO — success → §11.1 summary
2. Escalation trigger fires — §11.2 message
3. Maintainer interrupt
4. Tool unavailability persistent (>30 min)
5. Self-detected infinite loop (T-AO-B)

---

## §13 See also

- Parent meta-kickoff: `.claude/orchestrator-prompts/queue-mode-bootstrap/kickoff.md` (Queue mode discipline source)
- Parent session: `.claude/orchestrator-prompts/autonomous-research-orchestrator/` (state.md + 4 GO outputs)
- Discipline rules: `.claude/rules/{doc-authority-hierarchy,phase-research-coverage,ai-laziness-traps,no-paid-llm-in-ci}.md`
- Principle 09 test: `packages/core/principles/09-doc-authority-hierarchy.test.ts` — canonical REQUIRED_HEADER_DOCS list
- Principle 10 test: `packages/core/principles/10-research-patch-annotation.test.ts` — scope annotation requirement
- Wave 1 + Wave 2 headers additions (historical context): `docs/meta-factory/research-patches/2026-05-09-*headers*.md` (verify path on session start)
- AI Memory: `feedback_delegation_model.md`, `project_claude_p_headless_window.md`, `feedback_no_drive_by_prs.md`

---

## §14 Final note to the AI orchestrator running this kickoff

You are dispatching Workers to write **3 kickoff files** for future doc audit. You are NOT performing audits. Each Worker writes one kickoff describing future methodology for one audit stream.

**Recursive self-application reminder:** the project's whole thesis is «every rule fails CI on violation». Doc audit is the natural next surface to apply this thesis to. But **applying discipline to documentation is exactly where parent sessions slipped** (T-AO-L incident — Workers didn't know about principle 10). Be visibly disciplined: state.md updates per section, file-system verify, spot-checks, principle tests run if applicable, dual-channel for any CC claims.

You do NOT:
- Edit project-scope files (READMME / CLAUDE.md / `.claude/rules/` / `.claude/skills/` PROJECT scope / `packages/core/principles/*`)
- Execute D1/D2/D3 (they remain DRAFTS)
- Decide maintainer questions
- Spawn nested Queue modes
- Skip the spot-check, file-system verify, T-AO-K dual-channel (if CC claims surface), T-AO-L principle test run (if applicable)

Your closing message must include self-application audit: did YOU apply Queue mode discipline to YOUR own session? Cite state.md entries.

Three doc-audit kickoff drafts. That's it.

Burn Opus. Be thorough. Cite everything. Escalate cleanly when blocked. Done.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
