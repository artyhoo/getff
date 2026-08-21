# Queue Mode Bootstrap — META-KICKOFF for new Opus orchestrator session

> **transient artifact** — oversized orchestration design doc; exempt from the 600-line markdown gate (cross-session-kickoff-portability, SSOT #116).

> **Status:** ARMED 2026-05-16. Created in parent session by Opus orchestrator who just completed the 4-kickoff autonomous research run.
> **Type:** META-ORCHESTRATOR session — Queue mode applied to bootstrap Queue mode itself. Recursive but flat (depth-2 hierarchy preserved).
> **Mode:** Queue mode autonomous, Opus everywhere, burn-mode authorized by maintainer.
> **Estimated effort:** 2-4 hours wall-clock single session.
> **Parent session:** orchestrator-prompts/autonomous-research-orchestrator (state.md available in same dir as this kickoff's parent).
> **Output shape:** 1 user-scope skill update + 2 project-scope kickoffs (gitignored). No source code, no commits, no pushes.

---

## §0 How to use this kickoff (read FIRST, before §1)

You are a **fresh Opus session** that just received this kickoff as the first message. You are the **Orchestrator** for this run. Your job is to dispatch Workers + Reviewers per Queue mode discipline (described in §6 below) to produce 3 artefacts (described in §4-§5).

**Read order:**
1. This file fully, end-to-end, before any action
2. §2 Step-0 mandatory reads
3. §3 Parent session context — what was done, what was decided, what was learned
4. §4 Queue + §5 Per-artefact specs
5. §6 Discipline / workflow
6. §7 Subagent dispatch templates
7. §8 T-AO + domain-specific traps
8. §10 Pre-flight checklist — RUN it before §11 begins
9. §11 Dispatch sequence

Then begin.

---

## §1 Purpose

Produce 3 artefacts that codify the discipline successfully demonstrated by the parent session, and queue up the follow-up work that parent session identified but didn't do:

- **Artefact A** — extend `~/.claude/skills/orchestrator/` user-scope skill with Queue mode (autonomous research multi-kickoff workflow), new naming convention (Orchestrator / Worker / Reviewer), `claude-code-guide` verification mandate, state.md journal format, and T-AO trap catalogue. References/ subdirectory created with detailed templates.

- **Artefact B** — kickoff file for "re-verify 4 GO results (3 research-patches + 1 SSOT-corrections commit) with `claude-code-guide` channel". Parent session GO'd these 4 outputs using only DeepWiki + context7 for verification. Claude-Code-related claims (especially in patch #4 think-time-s17-gate which is entirely about Claude Code hook events) need second-channel verification via the official Claude Code documentation channel that parent session missed.

- **Artefact C** — kickoff file for "skills+agents audit + Mode A refactor in orchestrator skill". Audit all existing `.claude/skills/*` (project + user scope) and `agents/*` for drift, dead skills, broken refs, missing triggers. Plus refactor of the existing Mode A in orchestrator skill given Queue mode + headless dispatch now exist as backbones.

These 3 artefacts are **drafts on disk** — maintainer reviews and accepts. You DO NOT execute B or C in this session. You only WRITE them. Next session executes them via Queue mode (now described in Artefact A).

---

## §2 Step-0 mandatory reads (do not skip; cite invariants inline in subagent prompts later)

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order:

1. **[README.md](../../../README.md#why-this-exists)** — project goal (authoritative). Goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation. Three invariants: (1) build-vs-reuse SSOT consult before capability commit; (2) recursive self-application green; (3) search-coverage 6-item checklist on negative-existence claims.

2. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — operational restatement. Reviewer drift-prevention flowchart.

3. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract (CRITICAL: defines what you can/cannot edit). Especially Note: `~/.claude/skills/` is user-scope, **outside** project Artifact Ownership Contract — you may write directly. Project-scope artefacts (`.claude/skills/`, `.claude/rules/`, README, etc.) you may NOT edit; kickoffs go to gitignored `.claude/orchestrator-prompts/*` which IS writable.

4. **Memory files** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`:
   - `feedback_delegation_model.md` — Opus quota не дефицит; choose path по scope/context; Sonnet as subagent of Opus is meaningless in burn mode
   - `feedback_worktrees_for_parallel_subwaves.md` — worktree mandatory for parallel; sequential is fallback. For Queue mode default sequential.
   - `feedback_no_drive_by_prs.md` — atomic-umbrella discipline; do NOT spawn separate PRs for systemic improvements noticed mid-flow
   - `project_session_ordering_2026_05_13.md` — kickoff queue ordering + Claude Code v2.1.98 (downgrade from buggy v2.1.114)
   - `project_claude_p_headless_window.md` — `claude -p` headless dispatch usable until ~2026-06-16 in subscription; after that paid-API only and unavailable per no-paid-LLM-in-CI policy

5. **Discipline rules:**
   - [.claude/rules/parallel-subwave-isolation.md](../../rules/parallel-subwave-isolation.md) — worktree discipline
   - [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) — T1-T16 + how kickoff authors must enumerate active traps
   - [.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md) — §1 6-item checklist; §4 anti-patterns
   - [.claude/rules/no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md) — load-bearing for any tool selection
   - [.claude/rules/doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md) — Authoritative-for / NOT authoritative-for header format

6. **Parent session output** — read all 3 research-patches + 1 SSOT-corrections commit (4 GO results total) PLUS parent state.md:
   - `docs/meta-factory/research-patches/2026-05-16-research-tooling-evaluation.md`
   - `docs/meta-factory/research-patches/2026-05-16-§13.33-hook-architecture-research.md`
   - `docs/meta-factory/research-patches/2026-05-16-§17-think-time-gate.md`
   - `.claude/orchestrator-prompts/aif-ssot-corrections/pr-body-draft.md` (PR body for #5)
   - **`.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`** — FULL audit trail of parent session, including 4 reviewer verdicts and 1 REVISE→GO cycle for #4
   - **`.claude/orchestrator-prompts/autonomous-research-orchestrator/kickoff.md`** — the original Queue mode kickoff that parent session executed (~470 lines, contains workflow + traps)
   - All 4 review verdict files: `review-{1,3,4,5}-iter-*.md` in same dir

7. **Existing orchestrator skill** (target of Artefact A):
   - `~/.claude/skills/orchestrator/SKILL.md` — 680 lines, describes Mode A (inline Opus agent) / Mode B (file-prompt Sonnet) / Mode B' (file-prompt Opus burn) for **umbrella PR work**

8. **AI-agnostic subagent prompts** (referenced by Artefact A for templates):
   - `agents/review-sidecar.md` — diff review pattern
   - `agents/compliance-verifier.md` — substantive verification pattern
   - `agents/docs-auditor.md`, `agents/best-practices-sidecar.md`

---

## §3 Parent session context — what was done, decided, learned

This kickoff was authored by an Opus orchestrator session that just completed a 4-kickoff autonomous research queue. **You inherit its findings and discipline.** Below is the load-bearing context.

### §3.1 Parent session outputs (all GO)

| # | Kickoff | Verdict | Iter | Output |
|---|---------|---------|------|--------|
| 1 | research-tooling-evaluation | GO | 0 | 42KB, 386 lines, SSOT #42 DeepWiki ADOPT-CONDITIONAL, 7-row decision matrix, Q2 verdict-relevant gap on SSOT #38 |
| 2 | swarm-tools-research (1B) | DEFERRED | n/a | Hard-blocked on 1A maintainer dialogue (NOT in autonomous queue) |
| 3 | wave-10-hook-architecture | GO | 0 | 64KB, 785 lines, D6=option(a) own-build TS hook runner, D7=Wave 11 Danger deferred, SSOT #47-#48 proposed |
| 4 | think-time-s17-gate | GO | 1 | 56KB, 470 lines, H1+H10+W1 bundle recommended, **iter 0 had 1 HARD-FIX caught by reviewer** (Elicitation hook mischaracterization) — meta-recursive cycle worked |
| 5 | aif-ssot-corrections | GO | 0 | Branch `docs/aif-ssot-corrections` @ commit `828e31c` (NOT pushed). 4 corrections #27-#30 + 5 new entries #42-#46. PR body draft 6KB |

### §3.2 What this session must NOT touch

- Untracked research-patches from parent (4 .md files in `docs/meta-factory/research-patches/`) — maintainer commits them in own time per Artifact Ownership Contract
- Branch `docs/aif-ssot-corrections` and commit `828e31c` — maintainer pushes / merges in own time
- Parent state.md and review verdicts — **read-only historical record**

### §3.3 Decisions made in parent-session dialogue (load-bearing)

Maintainer + orchestrator dialogue after parent run produced these decisions (you inherit them, don't re-litigate):

**D-decision-1: Name the new mode "Queue mode"**, NOT "Mode C". Reason: Mode A/B/B' are variants of how to delegate **one task**; Queue mode is qualitatively different (multi-kickoff queue with research+review cycles). Different semantics → different name space.

**D-decision-2: Naming convention — 3 English words: Orchestrator / Worker / Reviewer**. Was: диспетчер / orchestrator / прораб / executor / research subagent / контролёр / reviewer subagent (8 words on 3 roles). Now: 3 words, English, glossary at top of skill.

**D-decision-3: `claude-code-guide` subagent is MANDATORY first channel for Claude-Code-internals verification**. Parent session missed this — reviewer #4 iter 0 verified Elicitation hook via DeepWiki only (single-channel). Worked by luck. New rule: for Claude Code claims (hooks, MCP, settings, harness, slash commands, SDK), the FIRST verification channel is `subagent_type: claude-code-guide`. Second channel: DeepWiki/context7 for cross-check.

**D-decision-4: Hierarchy depth = 2, period.** Orchestrator → (Worker + Reviewer). Workers may NOT spawn their own queues. Workers may use tools (MCP, WebSearch, `claude-code-guide`) but NOT delegate via Task tool. If a kickoff is too large for one Worker session — Orchestrator splits the kickoff into per-section blocks and dispatches Worker per block (per-section pattern from parent kickoff §4.2). Reviewer reviews accumulated output at end.

**D-decision-5: Mode A in existing orchestrator skill becomes redundant given Queue mode + headless dispatch**, but **defer the refactor** to Artefact C kickoff. Don't touch Mode A in Artefact A; just add Queue mode alongside.

**D-decision-6: Headless `claude -p` is currently in subscription-bundled window** (until ~2026-06-16). Use it for arbitrary-depth execution via Bash. After window expires — fall back to Task subagent only. Document the time-windowed nature in Artefact A.

**D-decision-7: Skill structure** — extend existing `~/.claude/skills/orchestrator/SKILL.md` (do not create new top-level skill). Add `references/` subdirectory for detailed templates. SKILL.md gains ~70-line Queue mode section + decision matrix row; references/ holds depth.

### §3.4 Lessons learned (must be encoded into Artefact A discipline)

- **L1 (state.md write-as-you-go):** Worker subagent must write each section to file IMMEDIATELY upon completion, not gather in head and dump at end. Resumable on crash.
- **L2 (file-system precedence over state.md):** If state.md says "RESEARCH-COMPLETE" but the file doesn't exist or is too small — file-system wins. Orchestrator verifies `ls`/`wc -l`/`grep -c` before dispatching reviewer.
- **L3 (anti-collusion spot-check):** After Reviewer returns GO, Orchestrator picks one random section of the output and spot-checks substance independently. Catches collusion between two Opus models that may share bias toward "good-enough" outputs.
- **L4 (T-AO trap catalogue):** Parent session crystallized T-AO-A through T-AO-J (collusion, infinite loop, file-write delay, scope creep via observations, verdict-grade-inflation, orchestrator-as-decider, 1A leakage, state.md as theatre, model not actually used, headless-fallback-as-default). Encode in Artefact A `references/ai-laziness-traps-orchestrator.md`.
- **L5 (no maintainer-decisions):** Orchestrator NEVER decides D-questions / Q-questions. Surfaces as RECOMMENDATIONS in research-patch §N. Maintainer decides post-orchestration.
- **L6 (Opus everywhere in burn mode):** Per memory `feedback_delegation_model`, Sonnet-as-subagent-of-Opus is meaningless in burn — quota spent equally. All subagents in Queue mode: Opus.
- **L7 (claude-code-guide mandate):** New lesson from parent #4 iter 0 incident. First channel for Claude Code claims.

---

## §4 Active queue (3 artefacts)

| # | Artefact | Type | Owner-class | Output path |
|---|----------|------|-------------|-------------|
| A | Queue mode skill | Skill update | maintainer (but user-scope so writable) | `~/.claude/skills/orchestrator/SKILL.md` + `~/.claude/skills/orchestrator/references/*.md` |
| B | Kickoff: re-verify 4 GO results (3 patches + 1 SSOT commit) with claude-code-guide | Kickoff file | gitignored | `.claude/orchestrator-prompts/re-verify-with-claude-code-guide/kickoff.md` |
| C | Kickoff: skills+agents audit + Mode A refactor | Kickoff file | gitignored | `.claude/orchestrator-prompts/skills-agents-audit/kickoff.md` |

**Dispatch order:** C → B → A (sequential, NOT parallel — A depends on lessons surfaced while writing B + C).

**Rationale for order:**
- C first: most self-contained; surfaces audit methodology that informs A's design
- B second: shorter; uses same vocabulary as A; informs Artefact A on what re-verify pattern looks like
- A last: integrates lessons from writing B + C into final skill structure

---

## §5 Per-artefact specifications

### §5.A — Queue mode skill extension

**Path:** `~/.claude/skills/orchestrator/SKILL.md` (extend in place, do NOT rewrite) + new `~/.claude/skills/orchestrator/references/` directory with files below.

**SKILL.md changes (~70 new lines):**
- **Top of file (after existing front-matter):** add 5-line **Glossary** introducing Orchestrator / Worker / Reviewer with one-sentence definitions each, plus pointer to references/ for details
- **In existing "## Три способа выполнить работу" section (line 112) `Decision matrix`:** add new row for Queue mode trigger condition: «≥2 kickoffs ready in queue + maintainer wants autonomy → Queue mode → references/queue-mode.md»
- **New section** between existing «Phase 5» and «Что сделано» (or wherever it fits per existing structure): `## Queue mode — autonomous research multi-kickoff (новый режим, 2026-05-16)` — ~50 lines summarizing what it is, when to use, mandatory glossary, pre-flight checklist pointer, references/ pointer

**Recommended writing order (manage context budget):** Worker should write in this sequence — smallest files first, SKILL.md edits LAST (after all references/ files exist, so cross-reference paths are concrete):
1. `glossary.md` (~30 lines, smallest, no dependencies)
2. `ai-laziness-traps-orchestrator.md` (~120 lines, mostly transcription from this kickoff §8 + parent state.md)
3. `worker-template.md` (~150 lines, derived from §7.1 of this kickoff — verify consistency)
4. `reviewer-template.md` (~150 lines, derived from §7.2)
5. `queue-mode.md` (~250-350 lines, largest, references all other files — write LAST among references/)
6. **SKILL.md additive edits** — 3 insertion points only, see acceptance criteria below

**Per-section dispatch (if needed):** If Worker reports context-budget pressure mid-Artefact-A, Orchestrator MAY split into 2 dispatches: Worker-1 writes references/ files 1-4 above; Worker-2 reads them + writes queue-mode.md + SKILL.md edits. Reviewer runs once on completed output. Per-section dispatch is permitted for A specifically (large output); NOT default for B/C (smaller).

**References/ files (new, 5 files):**

1. **`references/glossary.md`** (~30 lines) — 3 roles defined formally:
   - Orchestrator: main session, owns queue + state.md + dispatches + anti-collusion spot-check
   - Worker: subagent that executes one kickoff (or one per-section block of a large kickoff)
   - Reviewer: subagent that verifies Worker output cold (no shared memory with Worker)
   - **What's NOT a role:** Tools (MCP, WebSearch), built-in subagent types (claude-code-guide) — these are utility helpers used by roles, not roles themselves.
   - Hierarchy depth: 2 (Orchestrator → Worker/Reviewer), period. Workers do NOT spawn Workers.

2. **`references/queue-mode.md`** (~250-350 lines) — main Queue mode reference:
   - §1 When to use Queue mode (triggers, anti-triggers)
   - §2 Pre-flight checklist (Claude Code version, MCP availability, git status, `claude -p` probe, claude-code-guide subagent_type availability)
   - §3 Workflow diagram + per-kickoff protocol (dispatch → verify → reviewer → loop)
   - §4 state.md format (with concrete example)
   - §5 File-system precedence rule
   - §6 Anti-collusion spot-check protocol
   - §7 Iteration limits (MAX_ITERATIONS=5) + escalation triggers (max-iter, blocked-by-prerequisite, tool-unavailable, scope-conflict, maintainer-dialogue-required, infinite-loop, budget-cap)
   - §8 Memory updates from Orchestrator only (race-prevention)
   - §9 Headless dispatch as time-windowed channel (note ~2026-06-16 expiry; document fallback when window closes)
   - §10 Worker may use claude-code-guide for Claude Code claims (delegation as tool, NOT as subagent-spawning-another-subagent — claude-code-guide is built-in Anthropic helper)
- §11 claude-code-guide continuity pattern: Anthropic's agent docstring instructs callers to «check if there is already a running or recently completed claude-code-guide agent that you can continue via SendMessage» — Worker should reuse same agent instance for multiple CC questions in one task instead of spawning fresh, saves context

3. **`references/worker-template.md`** (~150 lines) — boilerplate prompt for Worker dispatch, with placeholders. Includes:
   - Step 0 invariants inline (cited, not relying on Worker's re-read)
   - Kickoff path reference + read-fully mandate
   - Output requirements (path + acceptance criteria)
   - Write-as-you-go discipline + state.md append per section
   - T-trap list (citing kickoff's §AI-traps + this template's T-AO additions)
   - Anti-scope (what Worker must NOT do — edit maintainer-owned files, decide D-questions, etc.)
   - Tool usage: context7, deepwiki, WebSearch, WebFetch — plus claude-code-guide for Claude Code claims with example invocation
   - When-done signal format

4. **`references/reviewer-template.md`** (~150 lines) — boilerplate for Reviewer dispatch. Includes:
   - Cold-read mandate ("you did not write this output")
   - Per-section substance check method (presence + substance + T-trap counter applied + hard-constraint check)
   - Specific evidence-grade checks pattern (verify per claim, not paraphrase)
   - For Claude Code claims — MUST dispatch claude-code-guide subagent for first-channel verification, DeepWiki/context7 as second channel
   - Verdict format (GO / REVISE with HARD-FIX + SOFT items)
   - Anti-collusion rules ("if hard constraint violated, REVISE regardless of how 'close' output looks")
   - When-done signal format

5. **`references/ai-laziness-traps-orchestrator.md`** (~140 lines) — T-AO trap catalogue (12 traps total: T-AO-A..L):
   - T-AO-A collusion between Worker + Reviewer (both Opus → bias toward "looks good")
   - T-AO-B infinite-iteration loop (iter N similar to iter N-1)
   - T-AO-C file-write delay (Worker gathers in head, dumps at end, then context exhaustion)
   - T-AO-D scope creep via observations (Worker surfaces "we should also do Y", tempted to expand queue)
   - T-AO-E verdict-grade-inflation (Reviewer drifts toward GO under "good enough" pressure)
   - T-AO-F orchestrator-as-decider (Orchestrator decides maintainer-owned questions)
   - T-AO-G 1A leakage (Orchestrator tries to execute dialogue-shaped kickoff as research)
   - T-AO-H state.md as theatre (updates without filesystem evidence)
   - T-AO-I Opus model not actually used (Task tool default may not be Opus)
   - T-AO-J headless-fallback-as-default (Orchestrator drifts to `claude -p` instead of Task subagent FIRST)
   - **T-AO-K (NEW, surfaced 2026-05-16):** single-channel verification on Claude-Code-specific claims (Parent session #4 iter 0 incident — DeepWiki verified Elicitation hook ALONE; if DeepWiki had lied, single-source verification wouldn't catch). Counter: **mandate dual-channel for Claude Code claims**: claude-code-guide subagent FIRST + DeepWiki second.
   - **T-AO-L (NEW, surfaced 2026-05-16 push incident):** project-specific principle test unknown to Worker. Parent session Workers for #1/#3 produced research-patches missing `<!-- scope:<slug> -->` annotation required by `packages/core/principles/10-research-patch-annotation.test.ts`; pre-push hook blocked push 24h later. Counter: **Worker prompt enumerates project-local principle tests for output type** + Worker write-as-you-go MUST run `npm run test:principles` (or equivalent) before reporting RESEARCH-COMPLETE. Reviewer verifies last principle-test run was green.

**Acceptance criteria for Artefact A:**
- All 5 references/ files created with substantive content (not stubs)
- **SKILL.md additive-only constraint (load-bearing):** Worker MAY ONLY:
  - (i) **Insert** a new Glossary section (3-role definitions) at one specific position in the file (top, after frontmatter if any, or as new §0 — Worker decides based on existing structure but MUST cite line number where inserted)
  - (ii) **Add** ONE new row to the existing decision matrix table (do not modify existing rows)
  - (iii) **Insert** ONE new top-level section `## Queue mode — autonomous research multi-kickoff` at one specific position (between existing top-level sections)
  - **All other existing content must remain byte-identical.** Worker uses Edit tool with specific old_string/new_string pairs, NEVER Write tool on SKILL.md. After edits, Worker reports `git diff` of SKILL.md showing ONLY additions (no deletions/modifications outside the 3 insertion points).
- All cross-references in new content resolve to existing or co-created files
- T-AO-K trap entry in `ai-laziness-traps-orchestrator.md` MUST cite parent state.md as empirical evidence (specifically the REVIEW-COMPLETE #4 iter 0 entry which records the Elicitation hook HARD-FIX)
- T-AO-L trap entry in `ai-laziness-traps-orchestrator.md` MUST cite 2026-05-16 push incident as empirical evidence (pre-push hook block on `docs/aif-ssot-corrections` branch due to missing `<!-- scope:<slug> -->` annotation in 2 of 3 untracked patches — annotations added manually before re-push)
- **No edits to project-scope files** (`.claude/skills/` inside this repo, `README.md`, `CLAUDE.md`, `.claude/rules/`, `packages/core/principles/`)
- **No execution of B or C** — they remain drafts

**T-traps active for Worker producing Artefact A:**
- T1 sampling floor: Worker reads existing SKILL.md ENTIRELY (680 lines, not "skimmed")
- T3 every claim cites source (e.g. "L4 catalogue derived from parent state.md lines X-Y")
- T11 build-vs-reuse before proposing new patterns — check if similar skill structure exists in `.claude/skills/rules-as-tests/references/` or `.claude/skills/self-reflection/references/` for the references/ pattern (it does — adapt)
- T15 self-application: does this skill, when applied to its own writing process, work? Note in Artefact A self-application section.
- T16 problem-class match — Queue mode upstream class (autonomous research orchestration) vs new use cases (skills audit, re-verify) — verify match before claiming "Queue mode handles X"
- T-AO-D scope creep: do NOT refactor Mode A here; that's Artefact C territory

### §5.B — Kickoff: re-verify 4 GO results (3 patches + 1 SSOT commit) with claude-code-guide

**Path:** `.claude/orchestrator-prompts/re-verify-with-claude-code-guide/kickoff.md` (create dir + file)

**Purpose:** Parent session GO'd 4 outputs (3 research-patches #1/#3/#4 + 1 SSOT-corrections commit #5) but did NOT use `claude-code-guide` subagent for Claude-Code-specific claims. Especially patch #4 (think-time-s17-gate) is entirely about Claude Code hook events, and iter 0 had 1 HARD-FIX caught only because reviewer ran DeepWiki query — single-channel. Second-channel verification via `claude-code-guide` is the new discipline (L7 in §3.4); apply it retroactively to parent outputs.

**Structure (~300-400 lines, standard kickoff layout):**

- §1 Problem this session solves — single-channel-verification gap in parent session
- §2 Goal — for each of 4 patches, identify Claude-Code-specific claims and re-verify via claude-code-guide. **Especially native Claude Code features that could replace AI-agnostic solutions** (project is AI-agnostic, but if Claude Code is the active runtime — why not use its strengths where it's better? Surface findings; do NOT decide for maintainer)
- §3 Hard constraints — read-only on parent patches; output is NEW research-patch with findings; no overwrite of original patches; flag for maintainer decisions; T16 problem-class check for each "native Claude Code feature could replace X" claim
- §4 Methodology:
  - §4.1 Patch-by-patch claim inventory (which claims in each patch are Claude-Code-specific?). Expected weight:
    - #1 research-tooling-evaluation — LIGHT (mostly DeepWiki vs context7 comparison; few CC claims)
    - #3 wave-10-hook-architecture — HEAVY (Husky, Stryker-in-CI, hook event references)
    - #4 think-time-s17-gate — CRITICAL (entire patch about hook events; Stop hook, UserPromptSubmit, Elicitation already iter-1-fixed but worth re-verifying)
    - #5 aif-ssot-corrections (commit 828e31c) — LIGHT (SSOT register, not CC internals)
  - §4.2 For each claim: dispatch claude-code-guide subagent with specific question. Capture official docs citation (URL from docs.claude.com via WebFetch within claude-code-guide).
  - §4.3 Cross-check with DeepWiki for each claim (second channel).
  - §4.4 If divergence between channels → flag, propose maintainer-decision item.
  - §4.5 Native Claude Code feature scan: for each native CC capability surfaced in §4.2-§4.3 — does it overlap with what parent patches proposed? E.g. parent #4 proposed H10 (verdict-as-tool-call MCP) — does Claude Code have a built-in verdict gate primitive that maps to H10? Surface findings.
- §5 Output requirements — single research-patch `docs/meta-factory/research-patches/2026-MM-DD-claude-code-guide-cross-verification.md`. Sections §1-§N analogous to parent patches.
- §6 AI laziness traps — T1, T3, T7 (adversarial: what Claude Code feature did I miss?), T11 (build-vs-reuse before claiming native CC = wrong tool), T13 (Claude Code own features are ADOPTED by definition — verify problem-class match), T15 (self-application), T16, T-AO-K (NEW — dual-channel for CC claims; reflexively applies HERE)
- §7 Open decisions (Dn) for maintainer — e.g. D1: if parent patch X's claim Y was wrong per CC docs, do we issue a revision-patch or just note in findings?
- §8 Self-application — does this session itself use both channels? Mandate explicit per-claim citation.
- §9 See also — parent patches, parent state.md, ai-laziness-traps L7

**Acceptance criteria for Artefact B:**
- Kickoff file exists at specified path with ALL standard kickoff sections (§1-§9)
- §4.1 patch-by-patch claim weight table present (LIGHT/HEAVY/CRITICAL classification)
- §4.5 native CC features scan included as mandatory step
- T-AO-K (or whatever number you assign) referenced in §6 with reflexive application
- File is plain markdown, 300-400 lines, no inline tool invocations (this is a kickoff for the NEXT session to execute)
- **Does NOT execute the re-verification** — just describes how it will be done

### §5.C — Kickoff: skills+agents audit + Mode A refactor

**Path:** `.claude/orchestrator-prompts/skills-agents-audit/kickoff.md` (create dir + file)

**CRITICAL role clarification:** Worker for Artefact C writes a **KICKOFF FILE** (an instruction document for a future session). Worker does **NOT** actually perform the audit, does NOT enumerate skills, does NOT propose Mode A refactor here. Worker only describes the methodology + acceptance criteria for a future session that will execute this kickoff via Queue mode (which by then will exist as Artefact A). Output of THIS Worker = a markdown file describing future work. Output of future session executing C = the actual audit report.

**Purpose:** Audit all skills and agents in the project + user-scope; refactor Mode A in orchestrator skill given Queue mode + headless dispatch now exist as primary patterns. Combined because Mode A refactor depends on knowing what other skills+agents exist (build-vs-reuse).

**Structure (~400-500 lines):**

- §1 Problem — accumulated skills + agents have grown without systematic audit; some may be stale, duplicate, broken-refs, or now-redundant given Queue mode existence. Mode A specifically is suspected redundant.
- §2 Goal:
  - §2.1 Complete inventory of `.claude/skills/*` (project) and `~/.claude/skills/*` (user-scope)
  - §2.2 Complete inventory of `agents/*.md`
  - §2.3 For each skill + agent: drift check (does description match actual content? are triggers accurate? are cross-references live?)
  - §2.4 Cross-skill overlap detection (two skills with overlapping triggers)
  - §2.5 Mode A refactor proposal for orchestrator SKILL.md given Queue mode + headless dispatch
- §3 Hard constraints:
  - Read-only on all skills+agents in this kickoff — outputs are recommendations, NOT cleanup
  - Project Artifact Ownership Contract applies for project-scope artefacts; user-scope is more permissive
  - Build-vs-reuse before recommending merge or deletion: each pattern claim verified against actual content
- §4 Methodology:
  - §4.1 Phase 1 — enumerate (find all skill + agent files; build inventory table)
  - §4.2 Phase 2 — per-artefact analysis (one row per skill/agent: name, scope, description match?, triggers valid?, broken refs?, drift?)
  - §4.3 Phase 3 — overlap detection (cross-reference triggers; matrix of overlaps)
  - §4.4 Phase 4 — Mode A refactor proposal (given Queue mode handles autonomous research, Mode B handles umbrella PR — what role for Mode A?)
  - §4.5 Phase 5 — recommendations (cleanup list, refactor proposals, no-action items)
- §5 Output requirements — single research-patch `docs/meta-factory/research-patches/2026-MM-DD-skills-agents-audit.md`. Plus optional `audit-report.md` companion if scale warrants.
- §6 AI laziness traps — T1 (floor: every skill + agent enumerated, not sampled), T3, T4 (don't close phase early), T7 (adversarial: skills hidden in subdirectories?), T11 (don't propose Mode A removal without checking if it serves a use case Queue mode doesn't cover), T15 (self-application: does this audit itself use the Queue mode pattern?), T16
- §7 Open decisions for maintainer — cleanup approvals; Mode A fate (keep / remove / re-scope); skill merge decisions
- §8 Self-application — apply Queue mode (just written in Artefact A) to itself: does its execution match Queue mode discipline?
- §9 See also — Artefact A skill, parent session state.md, CLAUDE.md Artifact Ownership Contract

**Acceptance criteria for Artefact C:**
- Kickoff file exists at specified path with all standard sections (§1-§9)
- Methodology has 5 explicit phases (enumerate → analyze → overlap → Mode A refactor → recommendations)
- §4.4 Mode A refactor proposal includes specific decision matrix (Queue mode handles X, Mode B handles Y, Mode A's residual role is Z OR none)
- T-AO-D scope creep specifically called out (audit may discover bigger issues; document, don't fix)
- File is plain markdown, 400-500 lines
- **Does NOT execute the audit** — just describes how it will be done

---

## §6 Discipline / workflow

You operate Queue mode (which is what you're documenting in Artefact A — recursive but the rules below apply NOW to you).

### §6.1 Per-artefact protocol

For each artefact K in [C, B, A]:

1. **Pre-dispatch checklist:**
   - Predecessor artefacts have GO (C precedes B precedes A; first iteration C has no predecessor)
   - state.md updated: "dispatching K at <timestamp>"
   - Iteration counter for K = 0

2. **Worker dispatch (Task tool, `subagent_type: general-purpose`, `model: opus`):**
   - Prompt structured per §7.1 template
   - Wait for completion

3. **File-system verify** (per L2 discipline):
   - `ls -la <output-path>`
   - `wc -l <output-path>`
   - `grep -c '^## §' <output-path>` (or equivalent section counter)
   - If state.md says "RESEARCH-COMPLETE" but file too small / missing sections → file-system wins, re-dispatch

4. **Reviewer dispatch:**
   - Prompt per §7.2 template
   - For Artefact A specifically: reviewer MUST
     - (a) read existing SKILL.md and confirm `git diff` shows ONLY additions (no deletions/modifications outside the 3 insertion points)
     - (b) verify Glossary + decision matrix row + Queue mode section don't break Mode A/B/B' descriptions
     - (c) **template consistency check (T-meta-B counter):** verify §7.1 Worker template + §7.2 Reviewer template in THIS meta-kickoff are semantically equivalent to `references/worker-template.md` + `references/reviewer-template.md` produced in Artefact A. If templates diverge — REVISE (Artefact A's templates are the canonical version going forward; meta-kickoff is one-shot, but templates must agree at handoff)
     - (d) verify T-AO-K entry in `references/ai-laziness-traps-orchestrator.md` cites parent state.md (specifically REVIEW-COMPLETE #4 iter 0 entry — load-bearing empirical citation per acceptance criteria)
   - For Artefact B / C: reviewer checks kickoff structure (§1-§9 present), acceptance criteria coherent, T-traps enumerated per ai-laziness-traps rule, Worker-role clarification present (especially C — confirm Worker understood «write kickoff, don't perform audit»)

5. **Iteration:**
   - GO → mark K done in state.md → next artefact
   - REVISE with iter ≤ 5 → re-dispatch worker with REVISE-fixes prompt
   - iter > 5 → escalate per §6.3

6. **Anti-collusion spot-check** (after GO, before marking complete):
   - Orchestrator counts substantive sections of K's output: `grep -c '^## §\|^### §' <output-path>` (or equivalent for non-§-numbered output). Call this N.
   - Pick index `i = ((artefact_letter_ord + iter_count) * 7 + N) mod N`, where artefact_letter_ord = C→3, B→2, A→1 (multiplier 7 = prime to spread indices across full range, not collapse on early §1-§3; deterministic but varies per artefact + iter, prevents Orchestrator picking "convenient" section)
   - If section i is metadata/header-only (e.g. §0 or `## See also`), increment i by 1 modulo N
   - Read that section independently. Cross-check at least one factual claim against original source (file:line if cited; URL via WebFetch if claimed; tool query if applicable)
   - If substance check passes → accept GO; log spot-check details to state.md History
   - If substance fails → reject GO, re-dispatch reviewer with note "spot-check found <specific issue>"

7. **Memory updates** (per L8 race-prevention): only Orchestrator writes to memory. Worker may DRAFT memory-entry content in patch §appendix; Orchestrator extracts + writes post-GO.

### §6.2 state.md format

Append-only journal in `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md` (create at session start).

Sections:
- **Queue** — table of artefacts with status, iterations, notes
- **Statuses legend** — PENDING / DISPATCHED-WORKER / WORKER-COMPLETE / DISPATCHED-REVIEWER / REVISE-iter-N / GO / ESCALATED
- **Active** — current artefact + step
- **History** — append-only event log with ISO timestamps

Example entries:
```
- 2026-MM-DDTHH:MM+TZ — orchestrator session started
- 2026-MM-DDTHH:MM+TZ — DISPATCHED Worker for C (iter 0)
- 2026-MM-DDTHH:MM+TZ — C §1 complete: <one-line summary>
...
- 2026-MM-DDTHH:MM+TZ — RESEARCH-COMPLETE C (iter 0)
- 2026-MM-DDTHH:MM+TZ — Orchestrator file-system verification passed (Nb bytes, M lines, K sections)
- 2026-MM-DDTHH:MM+TZ — DISPATCHED Reviewer for C (iter 0)
- 2026-MM-DDTHH:MM+TZ — REVIEW-COMPLETE C iter 0 verdict: GO
- 2026-MM-DDTHH:MM+TZ — Anti-collusion spot-check passed
- 2026-MM-DDTHH:MM+TZ — C marked GO ✓
- 2026-MM-DDTHH:MM+TZ — DISPATCHED Worker for B (iter 0)
...
```

### §6.3 Escalation triggers

STOP and write maintainer summary on ANY of:

1. `ESCALATE:K:max-iterations` — K hit iter 5 without GO
2. `ESCALATE:K:tool-unavailable` — claude-code-guide subagent_type NOT available in this session (would invalidate the L7 mandate) OR DeepWiki/context7 unreachable >30 min
3. `ESCALATE:K:scope-conflict` — task would require editing maintainer-owned project file
4. `ESCALATE:K:maintainer-dialogue-required` — open decision has no autonomous-decidable default
5. `ESCALATE:K:infinite-loop` — reviewer flip-flops GO ↔ REVISE on same content
6. `ESCALATE:budget-cap` — token budget approach (currently no hard cap; per burn mode discretion)

Escalation message in state.md + final orchestrator response. STOP — do NOT proceed to next K.

---

## §7 Subagent dispatch templates

### §7.1 Worker dispatch prompt template

```
You are a Worker subagent dispatched by an Orchestrator. Today is 2026-MM-DD. Burn-mode authorized — Opus everywhere.

## Your task

Execute Artefact <K> as specified in the kickoff at <PATH-TO-QUEUE-MODE-BOOTSTRAP-KICKOFF>. Read §5.<K> fully. Follow ALL acceptance criteria.

## Output

Write to: <SPECIFIC-PATH-FOR-K>

(For A: includes ~/.claude/skills/orchestrator/SKILL.md edits + references/ files)
(For B: .claude/orchestrator-prompts/re-verify-with-claude-code-guide/kickoff.md)
(For C: .claude/orchestrator-prompts/skills-agents-audit/kickoff.md)

## Discipline (Step 0 invariants inline)

Goal: AI agents can't silently bypass undocumented conventions — every codified rule fails CI on violation.

Three invariants:
1. Build-vs-reuse SSOT consult before capability commit
2. Recursive self-application
3. Search-coverage 6-item checklist for negative-existence claims

No paid LLM in CI policy applies.

## T-traps active

<list from §5.<K> AI-traps active>

## Tools

- context7 MCP for library docs
- deepwiki MCP for architectural understanding
- WebSearch / WebFetch
- **claude-code-guide subagent (subagent_type: claude-code-guide) for Claude Code internals questions** — use when verifying claims about hooks, settings, MCP server contracts, slash commands, SDK behavior. **Continuity:** reuse the same claude-code-guide agent instance via `SendMessage` for multiple CC questions in the same task — don't spawn fresh each time (per Anthropic's agent docstring guidance: "check if there is already a running or recently completed claude-code-guide agent that you can continue via SendMessage")

## Incremental write discipline

- Write each section to file as completed
- Update state.md at <STATE-PATH> with one-line entry per section
- DO NOT batch in head

## Project-local principle tests (T-AO-L counter, MANDATORY)

If your output is a research-patch (`docs/meta-factory/research-patches/*.md`), it must satisfy `packages/core/principles/*.test.ts` — including but not limited to:
- `principles/10-research-patch-annotation.test.ts` — first line of every patch must be `<!-- scope:<slug> -->` where slug matches `[a-zA-Z0-9.§-]+` (e.g. `<!-- scope:research-tooling-evaluation -->`)
- Other principles relevant to your output type — read `packages/core/principles/` to enumerate.

**Final step before reporting RESEARCH-COMPLETE:** run `cd /Users/art/code/rules-as-tests-aif && npm run test:principles` (or `make test:principles` if Makefile target exists) via Bash. If ANY test fails, fix the violation in your output and re-run. Do NOT report RESEARCH-COMPLETE until principles tests pass. Log the green run in state.md: `- <ISO timestamp> — #<K> principles tests green (N tests passed)`.

## Anti-scope

- DO NOT edit project-scope: README.md, CLAUDE.md, .claude/rules/*, .claude/skills/* (PROJECT scope), packages/core/principles/*
- DO NOT edit docs/meta-factory/prior-art-evaluations.md directly
- DO NOT push commits or open PRs
- DO NOT execute downstream kickoffs (B and C are DRAFTS only)
- DO NOT decide maintainer-owned questions
- DO NOT escalate to user mid-task — write BLOCKED:<reason> to state.md

User-scope ~/.claude/skills/ IS writable for Artefact A.

## When done

Append to state.md History: `- <ISO-timestamp> — RESEARCH-COMPLETE <K> (iter <N>)`. Return summary: file path, line count, sections completed, recommendations.
```

### §7.2 Reviewer dispatch prompt template

```
You are a REVIEWER subagent. You did NOT write this output. Be skeptical. DO NOT collude.

## Your task

Review Artefact <K> at <OUTPUT-PATH> against the kickoff at <PATH-TO-QUEUE-MODE-BOOTSTRAP-KICKOFF> §5.<K> acceptance criteria. Return VERDICT: GO | REVISE.

## Method

1. Read §5.<K> acceptance criteria
2. Read the output file
3. For each criterion: substance check (not presence-only)
4. For Claude-Code-specific claims (especially in Artefact B): dispatch claude-code-guide subagent for FIRST-channel verification; cross-check DeepWiki for second channel
5. T-trap audit per §5.<K> active traps
6. Hard-constraint audit per §5.<K>
7. **Principle tests verification (T-AO-L counter):** check state.md for the Worker's «principles tests green» log entry. If missing — REVISE (Worker skipped final validation step). If present but stale (run before final section completion) — REVISE. Optionally re-run `npm run test:principles` yourself to confirm — if your run fails, REVISE.

## Output

Write verdict to: `.claude/orchestrator-prompts/queue-mode-bootstrap/review-<K>-iter-<N>.md`

Per-criterion findings; HARD-FIX list (only blocking items); SOFT items; Confidence with explicit predicates.

## Rules

- Do NOT collude — hard-constraint violation = REVISE regardless of how "close" output looks
- Do NOT fix; report only
- Substance > syntax
- HARD-FIX = 0 AND no hard-constraint violated AND T-counters applied → GO

When done append to state.md: `- <ISO-timestamp> — REVIEW-COMPLETE <K> iter <N> verdict: <GO|REVISE>`.
```

### §7.3 Headless `claude -p` fallback (window valid until ~2026-06-16)

If Task subagent reports context-budget exhaustion for a per-section block:
1. Prepare per-section prompt file at `.claude/orchestrator-prompts/queue-mode-bootstrap/headless-prompts/<K>-<block>.md`
2. `claude -p "$(cat <prompt-file>)" 2>&1` via Bash with `timeout: 300000`
3. Capture text output → Orchestrator writes to artefact via Edit/Write
4. Log to state.md: `K=<X> block=<Y> dispatched-via=headless reason=<context-exhausted>`

Pre-flight: `claude --version` must return v2.1.98 (or compatible non-buggy version). If pre-flight fails or date > ~2026-06-16 → fallback DISABLED, escalate per §6.3.

---

## §8 T-AO + domain-specific traps active

Per `.claude/rules/ai-laziness-traps.md` obligations on kickoff authors — enumerated active traps + domain-specific additions:

**Canonical traps:**
- T2 (methodology not running) — Orchestrator must ACTUALLY dispatch, not "design and stop"
- T4 (premature closure) — do NOT mark K done without Reviewer GO
- T5 (implementation into research) — Orchestrator does NOT edit artefact files directly; Workers do
- T7 (literal prompt following) — read each artefact spec specifically; do not apply identical method to all 3
- T8 (asking maintainer to avoid work) — escalate per §6.3 ONLY, not mid-flow for clarifications
- T15 (self-application) — Orchestrator session itself applies Queue mode discipline (which is what Artefact A documents)

**T-AO additions (parent-session catalogue, must be encoded in Artefact A references/ai-laziness-traps-orchestrator.md):**
- T-AO-A collusion between Worker + Reviewer
- T-AO-B infinite iteration
- T-AO-C file-write delay
- T-AO-D scope creep via observations
- T-AO-E verdict-grade-inflation
- T-AO-F orchestrator-as-decider
- T-AO-G 1A leakage
- T-AO-H state.md as theatre
- T-AO-I Opus model not actually used
- T-AO-J headless-fallback-as-default

**NEW T-AO-K (this session's main contribution):**
- T-AO-K single-channel verification on Claude-Code-specific claims. Counter: claude-code-guide subagent FIRST + DeepWiki second for ANY Claude Code internals claim.

**NEW T-AO-L (surfaced post-meta-kickoff, 2026-05-16 push incident):**
- T-AO-L project-specific principle test unknown to Worker. Worker subagent does not know about project-local principle tests (e.g. `packages/core/principles/10-research-patch-annotation.test.ts` requiring `<!-- scope:<slug> -->` on first line of any research-patch). Parent session Workers for #1 and #3 produced patches missing this annotation; pre-push hook blocked push 24 hours later. Empirical evidence: 2026-05-16 push attempt for `docs/aif-ssot-corrections` branch failed with «2026-05-16-research-tooling-evaluation.md: missing or malformed <!-- scope:... --> annotation on first line» — manual annotation fix required before re-push. **Counter:** Worker prompt MUST enumerate relevant project-local principle tests for the output type (e.g. for research-patch output: list `packages/core/principles/*.test.ts` paths the Worker must satisfy), AND Worker write-as-you-go discipline MUST include final step «run `npm run test:principles` (or project-specific equivalent) before reporting RESEARCH-COMPLETE; if any test fails, fix and re-run, do not report complete». Reviewer subagent must verify last principle-test run was green via state.md log entry.

**Domain-specific (this meta-session):**
- T-meta-A — recursive trap. You are writing Queue mode skill USING Queue mode discipline. If you skip discipline while writing the skill, the skill becomes documentation that lies about itself. Apply Queue mode visibly: state.md, file-system verify, anti-collusion spot-check, T-trap audit per artefact. Mandatory.
- T-meta-B — Artefact A writes templates for B + C dispatch. If templates are wrong, B + C executions fail in next session. Verify template consistency: §7.1 + §7.2 templates in THIS kickoff match the templates inside `references/worker-template.md` + `references/reviewer-template.md` you write in Artefact A.

---

## §9 Maintainer handoff

**Pre-launch (maintainer prepares):**
- Verify Claude Code v2.1.98 (`claude --version`)
- Verify DeepWiki + context7 MCP available (`claude mcp list`)
- **Verify claude-code-guide subagent_type available** (this is NEW — check the system reminder at session start listing available subagent types. If missing → escalate immediately, do not proceed)
- On `main` branch with clean working tree — BUT note: parent session left untracked patches in `docs/meta-factory/research-patches/` and a feature branch `docs/aif-ssot-corrections`. These are EXPECTED state; do not clean up.
- Paste this kickoff as first message in new Opus session.

**During execution (maintainer observes):**
- Watch state.md for progress (in `.claude/orchestrator-prompts/queue-mode-bootstrap/state.md`)
- DO NOT edit artefacts being executed
- Send "pause" if needed

**On escalation:**
- Read state.md ESCALATION section
- Address blocker
- Resume by sending "continue" or re-launching with state.md context

**On final completion:**
- Review all 3 artefact outputs (A: ~/.claude/skills/orchestrator/SKILL.md + references/; B: re-verify kickoff; C: skills+agents audit kickoff)
- Decide what to commit (project-scope kickoffs in gitignored dir — no commit needed; user-scope skill edits — backup if desired but not version-controlled by this repo)
- Decide when to execute Artefact B and C (next session, possibly back-to-back via Queue mode now described in Artefact A)

---

## §10 Pre-flight checklist (RUN before §11)

Execute these checks AT SESSION START via Bash and report results in state.md History:

1. `claude --version` — expect `2.1.98` (or other non-buggy version). If wrong → escalate.
2. `claude mcp list` — expect deepwiki + context7 connected.
3. `git status` — note untracked patches + feature branch from parent (expected); should NOT be in middle of pending operations.
4. `git branch --show-current` — note current branch (may be `docs/aif-ssot-corrections` from parent — that's OK; checkout main if you prefer for cleanliness, but no edits to repo regardless).
5. `claude -p "echo PROBE-OK"` — expect "PROBE-OK" single line. If date past ~2026-06-16 → headless fallback disabled, document in state.md.
6. **claude-code-guide subagent availability** — check the available agent types in the system reminder at session start. Confirm `claude-code-guide` is listed with tools Bash + Read + WebFetch + WebSearch. If MISSING → escalate (this is L7 mandate; without it the dual-channel discipline can't apply).

State.md initial section template:

```markdown
# Queue Mode Bootstrap State

> Session start: <ISO timestamp>
> Orchestrator model: claude-opus-4-7
> Mode: Queue mode (autonomous, sequential C→B→A)
> Operator subscription: Claude Code v<VERSION>
> Parent session: autonomous-research-orchestrator (4 GO + 1 deferred, completed 2026-05-16)

## Pre-flight check results
[fill in from §10 above]

## Queue
| # | Artefact | Status | Iterations | Notes |
| C | skills+agents audit kickoff | PENDING | 0 | First dispatch |
| B | re-verify kickoff | PENDING | 0 | After C |
| A | Queue mode skill | PENDING | 0 | After B (integrates lessons) |

## Statuses legend
[per §6.2]

## Active
- Current artefact: (none — about to dispatch C)

## History
- <timestamp> — orchestrator session started
[etc.]
```

---

## §11 Dispatch sequence (after pre-flight passes)

1. Initialize state.md per §10 template
2. Dispatch Worker for **C** (skills+agents audit kickoff) per §7.1 template
3. File-system verify
4. Dispatch Reviewer for **C** per §7.2 template
5. Loop until GO or escalation
6. Spot-check (random section, T-AO-A counter)
7. Mark C done; dispatch Worker for **B**
8. (repeat 3-7 for B)
9. (repeat 3-7 for A)
10. Final orchestrator summary per §11.1 below

### §11.1 Final orchestrator message (success path)

Must include:
- Per-artefact status (GO state, iterations, files written)
- Token spend estimate (if observable)
- **T15 self-application audit**: did this orchestrator session itself follow Queue mode discipline? Cite state.md entries as evidence.
- Recommendations for maintainer:
  - Review C kickoff; if approved, schedule execution
  - Review B kickoff; if approved, schedule execution (consider running both back-to-back in a single Queue mode session)
  - Review A skill update; if approved, leave in user-scope (no commit needed)
- Honesty note: any spot-checks that surfaced issues? Any T-AO traps you noticed yourself falling into and corrected mid-flight?

### §11.2 Final orchestrator message (escalation path)

Trigger fired, artefact blocked. State.md location. Specific maintainer action needed.

---

## §12 Stop conditions

STOP when ONE of:

1. All 3 artefacts GO — successful completion → write §11.1 summary
2. Escalation trigger fires — write §11.2 message
3. Maintainer interrupt (e.g. "pause") — acknowledge cleanly
4. Tool unavailability persistent (DeepWiki / context7 / claude-code-guide down >30 min) — escalate per §6.3
5. Self-detected infinite loop per T-AO-B — escalate

---

## §13 See also

- Parent kickoff: `.claude/orchestrator-prompts/autonomous-research-orchestrator/kickoff.md`
- Parent state.md: `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` (READ this — contains 4 reviewer verdicts + 1 REVISE→GO cycle = invaluable empirical record)
- Parent research-patches (READ-ONLY): `docs/meta-factory/research-patches/2026-05-16-*.md` (3 files)
- Parent commit (READ-ONLY): branch `docs/aif-ssot-corrections` commit `828e31c`
- Existing orchestrator skill: `~/.claude/skills/orchestrator/SKILL.md` (target of Artefact A extension)
- Discipline rules: `.claude/rules/{ai-laziness-traps,phase-research-coverage,parallel-subwave-isolation,no-paid-llm-in-ci,doc-authority-hierarchy,reviewer-discipline}.md`
- AI-agnostic subagent templates: `agents/{review-sidecar,compliance-verifier,docs-auditor,best-practices-sidecar}.md`
- Memory entries (read for context):
  - `feedback_delegation_model.md` — Opus-everywhere in burn mode
  - `feedback_worktrees_for_parallel_subwaves.md` — sequential default, worktree if parallel
  - `feedback_no_drive_by_prs.md` — atomic-umbrella discipline
  - `project_claude_p_headless_window.md` — headless dispatch time-windowed (~2026-06-16)
  - `project_session_ordering_2026_05_13.md` — kickoff ordering + CC v2.1.98 mandate

---

## §14 Final note to the AI orchestrator running this kickoff

You inherited a session that just demonstrated Queue mode works. Your job is to **codify that discipline** so future sessions can apply it without re-discovering. The discipline includes the **main lesson from parent's own failure**: parent didn't use `claude-code-guide` for verification of Claude Code claims, and got lucky that single-source DeepWiki was correct.

Three artefacts:
- **A** is the rulebook (Queue mode skill)
- **B** is retroactive correction (re-verify parent's 4 patches with the new rule)
- **C** is housekeeping (audit accumulated skills + agents; refactor Mode A given Queue mode's existence)

You operate **as** an Orchestrator while **writing** Artefact A which **describes** how to be an Orchestrator. Pure recursive self-application. If you skip discipline while writing the skill, the skill becomes documentation that lies about itself — exactly the failure mode the project's whole thesis exists to prevent.

You do NOT:
- Edit project-scope files (READMME / CLAUDE.md / `.claude/rules/` / `.claude/skills/` PROJECT-scope / `packages/core/principles/*`)
- Execute B or C (they remain DRAFTS for the next session)
- Decide maintainer questions (D / Q items surfaced as RECOMMENDATIONS)
- Spawn nested Queue modes (depth-2 hierarchy: you → Worker/Reviewer, period)
- Burn through artefacts; budget expectation: 0-1 iter per B/C (smaller, more constrained), 1-2 iter per A (meta-recursive, template-consistency check likely catches at least 1 issue). Total iter likely 1-3 across all 3 artefacts. If you find iter approaching cap of 5 on any artefact — escalate, do NOT push through.
- Skip the spot-check after each GO (T-AO-A counter)
- Skip the file-system verify (L2)
- Drift to `claude -p` headless as default (T-AO-J)

Your closing message must include self-application audit: did YOU apply Queue mode discipline to YOUR own session? Cite state.md entries.

Be thorough. Cite everything. Escalate cleanly when blocked. Done.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
