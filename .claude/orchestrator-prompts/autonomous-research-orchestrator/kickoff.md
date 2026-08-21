# Autonomous Research Orchestrator — KICKOFF (Opus, burn mode)

> **Status:** ARMED 2026-05-13.
> **Type:** ORCHESTRATOR session, Opus model, burn-quota mode. Autonomously dispatches research subagents + reviewer subagents in iterate-until-OK loops over multiple research kickoffs.
> **Execution model:** main orchestrator (you = Opus session) reads this kickoff, plans dispatch sequence, spawns subagents via Task tool, monitors output, dispatches reviewers, iterates per acceptance gates, escalates to maintainer on blockers, moves to next kickoff. All subagents = Opus per maintainer 2026-05-13 «жги» directive (Opus quota не дефицит per project memory `feedback_delegation_model`).
> **Estimated effort:** variable — 8-20 hours wall-clock across multiple subagent sessions + reviews. Token spend: high (Opus everywhere). Maintainer-triggered launch + maintainer-escalation-only interruption.
> **Output shape:** research-patches written to `docs/meta-factory/research-patches/*` + drafts in respective kickoff `drafts/` dirs + memory updates. Same artifacts each kickoff would produce individually — orchestrator just automates dispatch + review.
> **Predecessor:** none required. Reads its own queue from §3 below.
> **Companion concept:** project memory `feedback_delegation_model` (Mode B parallel — but applied iteratively to research kickoffs rather than parallel sub-waves).

---

## §1 Purpose

Autonomously execute the queue of research kickoffs (§3) with quality-gated subagent loops. Each kickoff:
1. Dispatch research subagent (Opus) — reads kickoff, executes per §4-§6 of kickoff, writes outputs to files
2. Dispatch reviewer subagent (Opus) — reads kickoff acceptance criteria + outputs, returns GO / REVISE
3. If REVISE → dispatch research subagent with revision instructions → loop until GO or iteration cap
4. If GO → move to next kickoff
5. If iteration cap reached without GO → escalate to maintainer with state dump

End-state: queue exhausted (all kickoffs have approved outputs) OR maintainer escalation occurred for blocked kickoff.

**Why orchestrator vs maintainer-runs-each:**
- Maintainer time cost minimized — only intervenes on escalations
- Iterative quality loop applied automatically (reviewer catches gaps without manual cycle)
- All subagents Opus → high quality (per «жги» directive, quota non-issue)
- File-based progress = resumable if orchestrator killed

**Why NOT autonomous fully — limits:**
- 1A (goal-clarity-dialogue) is DIALOGUE session, needs maintainer back-and-forth on meta-decisions. CANNOT be fully autonomous. Orchestrator handles RESEARCH parts of 1A (preparing options/evidence) but stops before final maintainer dialogue.
- Per Artifact Ownership Contract: orchestrator CANNOT autonomously edit README/CLAUDE.md/`.claude/rules/*`/`packages/core/principles/*`/`prior-art-evaluations.md`. Drafts only; maintainer ships codification commits.

---

## §2 Read-first (Step 0 mandatory)

Per [.claude/session-bootstrap.md](../../session-bootstrap.md) Step 0 reading order, then orchestrator-specific:

1. **[README.md#why-this-exists](../../../README.md)** — current goal
2. **[.claude/session-bootstrap.md](../../session-bootstrap.md)** — invariants
3. **[CLAUDE.md](../../../CLAUDE.md)** — Artifact Ownership Contract (CRITICAL — defines what orchestrator can/can't edit)
4. **Memory entries** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/MEMORY.md` + index. Especially:
   - `feedback_delegation_model.md` — Mode B + Opus subagent quota model
   - `feedback_worktrees_for_parallel_subwaves.md` — worktree discipline (CRITICAL for parallel dispatch)
   - `feedback_no_drive_by_prs.md` — within-scope discipline
   - `project_session_ordering_2026_05_13.md` — kickoff queue + dependencies
   - `project_scope_philosophy_companion_to_aif.md` + `project_goal_framing_narrow_vs_broad.md` — project state context
5. **[.claude/rules/parallel-subwave-isolation.md](../../rules/parallel-subwave-isolation.md)** — MANDATORY worktree rule for parallel subagents
6. **[.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md)** — T-traps active in §10
7. **[.claude/rules/phase-research-coverage.md](../../rules/phase-research-coverage.md)** — research-discipline base (§1 6-item checklist)
8. **All kickoffs in §3 queue** — read their full text BEFORE dispatch (orchestrator must know acceptance criteria + scope per kickoff)
9. **AI-agnostic subagent prompts** at [`agents/`](../../../agents/):
   - `review-sidecar.md` — reviewer pattern (use as base for review-subagent prompts)
   - `compliance-verifier.md` — substantive verification pattern
   - `docs-auditor.md`, `best-practices-sidecar.md` — additional precedents

---

## §3 Kickoff queue (in dispatch order)

> Queue is sequential — each kickoff completes (GO verdict from reviewer) before next dispatches. Orchestrator can RUN PARALLEL only if maintainer explicitly authorizes (currently DEFAULT sequential per `feedback_worktrees_for_parallel_subwaves` discipline).

| # | Kickoff | Type | Autonomous? | Dependencies | Stop conditions |
|---|---|---|---|---|---|
| 1 | [`research-tooling-evaluation/kickoff.md`](../research-tooling-evaluation/kickoff.md) | RESEARCH (R-phase) | YES | None | research-patch + SSOT entry §6 produced; reviewer GO |
| 2 | [`swarm-tools-research/kickoff.md`](../swarm-tools-research/kickoff.md) (1B) | RESEARCH (R-phase) | **DEFERRED — NOT in active queue** | Hard dependency on 1A research-patch (1A is maintainer-dialogue, NOT in autonomous queue). 1B §9 cold-start gate: «if 1A absent → ABORT». | n/a — skipped autonomously |
| 3 | [`wave-10-hook-architecture/kickoff.md`](../wave-10-hook-architecture/kickoff.md) | RESEARCH (R-phase) | YES | None | research-patch §1-§13 produced; D1-D7 decisions surfaced as RECOMMENDATIONS for maintainer (orchestrator does NOT decide D1-D7); reviewer GO |
| 4 | [`think-time-s17-gate/kickoff.md`](../think-time-s17-gate/kickoff.md) | RESEARCH (R-phase) | YES | None | research-patch §1-§8 produced; reviewer GO |
| 5 | [`aif-ssot-corrections/kickoff.md`](../aif-ssot-corrections/kickoff.md) | PAPER WORK (verify-and-write) | **CONDITIONAL** — runs only if #1 reviewer GO verdict does NOT include SSOT-corrections already absorbed. Pre-dispatch check: read #1's research-patch §6; if #42/#43/#44 entries already produced atomically there → SKIP #5 with rationale «absorbed by #1». | #1 GO; #1's SSOT scope assessed | Atomic SSOT-corrections commit DRAFTED in feature branch (not pushed); reviewer GO; maintainer review + push at own pace |

**1A goal-clarity-dialogue — NOT in autonomous queue.** Dialogue with maintainer; can't be fully orchestrated. Orchestrator may prepare 1A's research portion (multi-channel enforcement table, AIF comparison data) as PRE-DIALOGUE BRIEF, but stops at first maintainer-question point.

**1B (#2) — DEFERRED with rationale.** 1B's `§9 cold-start procedure` HARD-blocks on 1A research-patch existence. 1A is dialogue (not autonomous). Therefore orchestrator CANNOT autonomously satisfy 1B's preconditions. Sequence requires: maintainer runs 1A dialogue → produces 1A research-patch → then 1B autonomous becomes unblocked. Orchestrator does NOT attempt #2 unless maintainer explicitly authorizes («1A patch exists at <path>, proceed with #2»).

**Active autonomous queue: [#1, #3, #4, #5-conditional].** Sequential by default.

**Queue interpretation flexibility:** orchestrator MAY reorder if reviewer surfaces dependency conflict (e.g. SSOT corrections #5 dependency on #1 means #5 cannot start until #1 GO). Document any reordering rationale in `state.md` (per §7).

---

## §4 Per-kickoff execution protocol

For each kickoff K in queue:

### §4.1 Pre-dispatch checklist

Before spawning research subagent for K:

1. ✅ Kickoff K's predecessor kickoffs all have GO verdicts
2. ✅ K's `inputs/` files exist if K references them (general check; #2 is DEFERRED per §3, so this primarily applies to #1/#3/#4/#5 — verify each kickoff's declared inputs in its §3 or equivalent)
3. ✅ Worktree set up if running in parallel (default: single workspace, no worktree needed)
4. ✅ State file `state.md` updated: «dispatching K at <timestamp>»
5. ✅ Iteration counter for K = 0

### §4.2 Research subagent dispatch

**Context budget reality.** Task tool subagents have bounded context (~200k tokens). For LARGE kickoffs (e.g. Wave 10 requires full function inventory of 4 shell files + ≥5 prior-art findings + 13 sections), a single Task dispatch may run out of budget mid-output. Mitigation patterns:

- **Default: single dispatch per kickoff.** Works for kickoffs producing <5k LOC research-patch.
- **Per-section dispatch for large kickoffs.** Split kickoff's §8 (Output requirements) into 2-4 logical blocks; dispatch one Task subagent per block; reviewer subagent reviews accumulated output at end. State.md tracks block-level completion (e.g. `K=#3: block-1=COMPLETE, block-2=DISPATCHED`).
- **Decision rule:** if kickoff §8 lists >10 sections OR explicitly enumerates multi-file output, default to per-section dispatch. Otherwise single dispatch.

**Subagent Step 0 economy.** Each subagent dispatch incurs Step 0 read overhead (README + CLAUDE + bootstrap + memory ≈ 15-20k tokens before useful work begins). Orchestrator's own Step 0 context (already loaded) CANNOT be passed to subagent (Task spawns fresh). Mitigation: subagent prompt MUST cite specific Step 0 invariants inline (e.g. «invariant: build-vs-reuse SSOT consult before capability commit») rather than relying on subagent's own re-discovery. This is necessary discipline-restating, not duplication.

**Fallback dispatch — `claude -p` headless (window-bounded).** If a Task subagent dispatch hits context-budget exhaustion (subagent reports «truncated» / «context_limit_reached» / final research-patch <token-budget-floor from §7 fs-check), orchestrator MAY fall back to `claude -p` headless invocation for the specific section/block. Verified working on Claude Code v2.1.98 as of 2026-05-16. Window: until ~2026-06-16 per memory entry `project_claude_p_headless_window.md`. After window expiry, this fallback is unavailable — orchestrator escalates per §6 instead. See T-AO-J in §10 — fallback is NOT default; Task subagent FIRST.

Mechanism (when fallback fires):
1. Orchestrator ensures subdir exists: `mkdir -p .claude/orchestrator-prompts/autonomous-research-orchestrator/headless-prompts/` (idempotent — no-op if already present). Then writes the section-prompt to `<that-dir>/<K>-<block>.md` (gitignored — parent path matches `.gitignore` rule `.claude/orchestrator-prompts/*`). Prompt is self-contained section sub-brief, NOT the whole kickoff.
2. Orchestrator invokes via Bash: `claude -p "$(cat <prompt-file>)" 2>&1`. Subprocess uses operator's subscription (no separate billing — falls under no-paid-LLM-in-CI policy since this is interactive session-bound use, not CI-side automation).
3. Subprocess returns plain text → orchestrator captures, validates substance (cite-check, T-trap counter check), writes to research-patch via Edit/Write.
4. State.md logs: `K=<X> block=<Y> dispatched-via=headless reason=<context-exhausted-iter-N> window-valid-until=~2026-06-16`.

Hard constraints on `claude -p` fallback:
- ONLY after Task subagent reports exhaustion for THIS block. Default = Task subagent.
- Pre-flight: `claude --version` MUST return `2.1.98` (or later non-buggy ≠ 2.1.114). If version drift detected → escalate, do NOT proceed with stale fallback.
- Each `claude -p` call counts toward operator's subscription quota — no separate cost gate, but contributes to «жги» burn rate.
- No file-write tools inside headless subprocess — output is text only. Orchestrator does the file-write via Edit/Write in this session.
- Window check at session start: today's date vs ~2026-06-16. If past window → fallback path DISABLED, escalate to maintainer on context-exhaustion instead.
- **Timeout + retry policy:** invoke `claude -p` via Bash tool with explicit `timeout: 300000` (5 min — covers research-section work; Bash default 2 min may truncate). On non-zero exit OR empty stdout OR timeout → ONE retry with same prompt; on second failure → escalate per §6 (`ESCALATE:K:tool-unavailable`), do NOT fall back to «pretend Task subagent will work» — that hides the failure. State.md logs each attempt: `K=<X> block=<Y> headless-attempt=<N>/<MAX=2> result=<ok|timeout|empty|nonzero-exit>`.

Use Task tool with `subagent_type: general-purpose` (or `claude` default), `model: opus`, and prompt structured as:

```
You are a research subagent dispatched by an autonomous orchestrator.

Your task: execute the research kickoff at <path-to-kickoff-K> end-to-end.
Read it fully. Follow ALL methodology sections. Produce ALL required outputs:
- research-patch at <kickoff-K-output-path>
- drafts in <kickoff-K-drafts-dir/> if applicable
- memory updates if kickoff says so

Discipline:
- Read kickoff §2 (Read-first) before any other action
- Apply T-traps from kickoff §7 (or equivalent AI laziness section)
- Every claim cites source (file:line OR URL)
- NO fabrication — INCONCLUSIVE marker preferred over plausible-looking guess
- Write outputs INCREMENTALLY (don't gather all in head then dump at end — write as you go)
- After EACH section completion, update <state-md-path> with «section X done»

Anti-scope:
- Do NOT decide maintainer-owned items (verdicts, codification commits, README edits)
- Do NOT edit anything outside kickoff K's allowed file set (per kickoff's «Anti-deliverables»)
- Do NOT escalate to user mid-task — escalate ONLY via writing «BLOCKED:reason» to <state-md>

When all kickoff K's §8 (or equivalent) Output requirements met → write «RESEARCH-COMPLETE» to <state-md> + final message summary.

If you cannot proceed → write «BLOCKED: <reason>» to <state-md> + exit with explanation.
```

Wait for subagent completion (Task tool returns when subagent finishes or hits limit).

### §4.3 Reviewer subagent dispatch

After research subagent reports RESEARCH-COMPLETE, dispatch reviewer:

Use Task tool with `subagent_type: general-purpose`, `model: opus`, base prompt from `agents/review-sidecar.md` + augmentation:

```
You are a REVIEWER subagent dispatched by an autonomous orchestrator.

Your task: review the outputs produced by the research subagent for kickoff K at <kickoff-K-path>.

Method:
1. Read kickoff K's §8 (or equivalent) Output requirements fully
2. Read kickoff K's §5 (or equivalent) Hard constraints (anti-deliverables)
3. Read kickoff K's §7 (or equivalent) AI laziness traps
4. Read research-patch + drafts produced
5. For EACH required section in §8: check presence + substance:
   - Substance check: every claim has source citation (file:line OR URL)? No fabrication?
   - T-trap check: each active T-trap from §7 — has the output applied the counter?
   - Hard-constraint check: any output violates §5?
   - Self-application check: did the work apply its own discipline?

Output: structured verdict
- VERDICT: GO | REVISE
- If REVISE: enumerate REQUIRED-FIXES with file:line refs
  - HARD-FIX (verdict-blocking): must-fix-before-GO
  - SOFT-FIX (observation): note but doesn't block
- If GO: ZERO required fixes; observations OK
- Confidence: explicit predicates (NOT «high») — e.g. «verified 8/10 sections substance-OK with file:line; 2/10 partial — flagged in observations»

DO NOT fix yourself. DO NOT edit research-patch. DO NOT collude — even if rough is «close enough», if hard constraint violated → REVISE.

Write verdict to <review-md-path>.
```

Wait for reviewer completion. Parse verdict.

### §4.4 Iteration loop

- **VERDICT: GO** → mark K as done in state.md; move to next kickoff in queue.
- **VERDICT: REVISE** → increment iteration counter for K:
  - **iter ≤ MAX_ITERATIONS (default 5; see §6)** → re-dispatch research subagent with REVISE-fixes prompt:
    ```
    You are a research subagent continuing kickoff K.

    Previous research output was REVIEWED. Reviewer found REQUIRED-FIXES:
    <enumerate HARD-FIX items from review.md>

    Your task: address each HARD-FIX. Re-read original kickoff K if needed.
    Apply same discipline as initial dispatch (cite sources, no fabrication, etc.).
    After all HARD-FIX addressed → write «RESEARCH-REVISED-COMPLETE-iter-N» to state.md.
    ```
  - **iter > MAX_ITERATIONS** → write `ESCALATE:K:max-iterations` to state.md → STOP autonomous loop → maintainer escalation per §6

After RESEARCH-REVISED-COMPLETE → goto §4.3 (reviewer again).

### §4.5 Post-GO actions

When K verdict = GO:
1. Update state.md: «K = DONE at <timestamp>, iterations=N»
2. **Orchestrator (NOT subagent) updates memory** at `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/` per kickoff K's §8.3 (or equivalent Memory updates section). Rationale: memory is shared resource; multiple subagents writing concurrently risks race (especially under future parallel mode). Subagents may DRAFT memory-update CONTENT inside research-patch §appendix («proposed-memory-entry» block) — orchestrator extracts + writes after GO. Single writer = no race.
3. Move to next K in queue

---

## §5 Quality gates per kickoff (acceptance criteria summary)

Reviewer subagent uses each kickoff's §8 (Output requirements) as authoritative criteria. Key points per kickoff in queue:

### #1 research-tooling-evaluation

- research-patch sections §1-§10 + §11 §1.7 substance check
- SSOT #42 DeepWiki entry produced with Verdict / Rationale / Trigger
- 3-question experimental comparison table with side-by-side excerpts (NOT prose-only)
- Backfill check on 3 past patches — explicit YES-or-NO finding per
- Each tool/pattern claim has source URL or file:line citation

### #2 swarm-tools-research (1B) — DEFERRED (not in active queue; criteria preserved for maintainer-triggered manual run)

- research-patch §3.5-§3.10 + §11 1B-handoff state
- AGENT.MD template skeleton with maintainer-decides PLACEHOLDERS (per §4.1.5 maintainer dialogue points)
- All §4.1.6 external info tagged VERIFIED / PARTIAL / UNVERIFIED / CONTRADICTED
- **Confidentiality gate (1B §5):** reviewer MUST check 1B output does NOT copy spec content verbatim — paraphrase obligation. Grep for ≥3 randomly-sampled distinctive phrases from `inputs/spec.md`; if any match verbatim in output → REVISE.
- **Escalation point:** when §11 dialogue topics surface — escalate to maintainer (DO NOT decide §4.1.5 strict/moderate/minimal, URL scope, anti-SLOP signals embedding for them)

### #3 wave-10-hook-architecture

- research-patch §1-§13 per kickoff §5.1
- Function inventory all 4 shell files
- Migration classification per function
- Prior art findings ≥5 sources
- D1-D7 RECOMMENDATIONS (orchestrator does NOT decide; maintainer does)
- Self-review §13 per kickoff §9

### #4 think-time-s17-gate

- research-patch §1-§8 per kickoff
- ≥1 adversarially-enumerated mechanism beyond H1-H9/W1-W4
- §8 self-application explicitly addressed
- Mechanism candidates split HOT vs WARM/COLD per maintainer ask

### #5 aif-ssot-corrections

- Feature branch with atomic commit DRAFTED (not pushed)
- All §3 corrections + §4 new entries verified per §6 verification steps
- §1.7 PR body draft with file:line citations
- Self-application §8 addressed

---

## §6 Iteration limits + escalation triggers

**MAX_ITERATIONS = 5 per kickoff by default.**

Rationale: «жги» directive — Opus quota non-issue per `feedback_delegation_model`. Original cap of 3 was conservative; bumped to 5 to give convergence more room before maintainer escalation. If research+review can't converge in 5 cycles, escalate — likely root cause:
- Kickoff acceptance criteria are unclear (needs maintainer revision)
- Empirical reality doesn't match kickoff's expectations (needs maintainer judgment)
- Reviewer is hyper-strict on aesthetics not substance (needs maintainer calibration)

All of which warrant maintainer intervention, not 6th-cycle Opus burn.

Also see §4.4 `iter ≤ MAX_ITERATIONS` — that gate uses this number too.

**Escalation triggers (orchestrator STOPS, writes maintainer-summary):**

1. `ESCALATE:K:max-iterations` — kickoff K hit MAX_ITERATIONS without GO
2. `ESCALATE:K:blocked-by-prerequisite` — kickoff K depends on K' that hasn't GO'd; cycle resolved nowhere
3. `ESCALATE:K:tool-unavailable` — DeepWiki/Context7/MCP unreachable AND alternative path not available; OR `claude -p` headless fallback fails twice consecutively per §4.2 timeout+retry policy AND Task-subagent path also exhausted
4. `ESCALATE:K:scope-conflict` — kickoff K's required action conflicts with Artifact Ownership Contract (e.g. would need to edit README which is maintainer-owned)
5. `ESCALATE:K:maintainer-dialogue-required` — kickoff explicitly says «maintainer decides X» and X has no autonomous-decidable default (e.g. 1B §4.1.5 strict/moderate/minimal choice)
6. `ESCALATE:K:infinite-loop` — reviewer flips between «GO with observations» and «REVISE» on identical content (consistency failure)
7. `ESCALATE:budget-cap` — if any token-budget cap configured externally is approached (currently no cap; per «жги» directive Opus quota assumed non-issue per `feedback_delegation_model`)

**Escalation message format (write to `state.md` + final orchestrator message):**

```
ESCALATION: <trigger>
Kickoff: <K-name>
Iteration: <N>
Reason: <free-text>
Last-reviewer-verdict: <REVISE-with-fixes summary>
State files: <list>
Maintainer action needed: <specific>
```

After escalation → orchestrator STOPS. Does NOT proceed to next K. Maintainer triggers resume after addressing.

---

## §7 File-write discipline (write-as-you-go, not gather-and-dump)

**All subagents MUST:**
- Write research-patch sections INCREMENTALLY as completed (not gather in head + dump at end)
- Update `state.md` at section boundaries
- Use Edit/Write tools directly — NO «I will summarize at end» patterns
- Each output file edit committed to filesystem before subagent ends

**Orchestrator tracks via:**
- `state.md` at `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md` (this file's directory)
- Monitor file mtimes if needed (Bash `ls -la`)
- Parse state.md for `RESEARCH-COMPLETE` / `RESEARCH-REVISED-COMPLETE-iter-N` / `ESCALATE:` markers

**File-system precedence over state.md.** state.md can lie (subagent writes `RESEARCH-COMPLETE` but never actually wrote the research-patch file — T-AO-H). **Rule:** if state.md and file-system disagree, **file-system wins**. Before accepting a `RESEARCH-COMPLETE` marker, orchestrator MUST verify: (a) declared output files exist, (b) file size > token-budget-floor (typical research-patch ≥3 KB; INCONCLUSIVE-only stub ≥500 bytes), (c) file mtime recent (within subagent's dispatch window). Mismatch → orchestrator overrides state.md to actual file-system reality, optionally re-dispatches subagent. state.md is REPORTING, file-system is GROUND TRUTH.

**Why this matters:**
- Resumable: if orchestrator killed mid-flow, file state shows last completed section; resume from there
- Reviewer-readable: reviewer subagent reads files directly, doesn't need to wait for «full output»
- Token-economical: if section X already written and approved, reviewer doesn't re-eat tokens reading it again across iterations (since state.md tracks GO per section)

State.md format:

```markdown
# Autonomous Research Orchestrator State

## Queue
- [#] research-tooling-evaluation: <STATUS>
- [#] swarm-tools-research: <STATUS>
- ...

## Statuses legend
- PENDING, DISPATCHED-RESEARCH, RESEARCH-COMPLETE, DISPATCHED-REVIEW, REVISE-iter-N, GO, ESCALATED, BLOCKED

## Active
- Current kickoff: <K>
- Current step: <step>
- Iteration: <N>

## History
- <timestamp> dispatched K research subagent (iter 0)
- <timestamp> research-complete K
- <timestamp> dispatched K review subagent
- <timestamp> review verdict: REVISE — fixes: <count>
- <timestamp> dispatched K research subagent (iter 1)
- ...
```

---

## §8 Worktree management

**Default: SEQUENTIAL execution, single workspace.** No worktree needed.

**If maintainer authorizes PARALLEL** (multiple kickoffs concurrent):

Per `.claude/rules/parallel-subwave-isolation.md` MANDATORY discipline:

```bash
git worktree add ../rules-as-tests-aif-research-K1 main
git worktree add ../rules-as-tests-aif-research-K2 main
```

Dispatch each subagent in its own worktree directory. Each runs independently. Aggregate outputs at end.

**Risk under parallel:** higher coordination cost; cross-worktree state synchronization fragile. Sequential preferred unless wall-clock pressure justifies.

**For this orchestrator:** start SEQUENTIAL by default. Escalate to maintainer if parallel needed (e.g. estimated wall-clock > 12 hours sequential).

---

## §9 Anti-deliverables (orchestrator CANNOT do autonomously)

- **NO maintainer-owned edits** per [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md):
  - README.md (§Why this exists)
  - CLAUDE.md
  - `.claude/session-bootstrap.md`
  - `.claude/rules/*.md`
  - `packages/core/principles/*.test.ts`
  - `docs/meta-factory/prior-art-evaluations.md` (orchestrator may DRAFT SSOT entries in research-patch §6, NOT directly edit registry — that's separate atomic commit by maintainer)
- **NO PR creation** — drafts only; maintainer pushes
- **NO commit beyond research-patch + drafts** — and even those, only if respective kickoff explicitly allows (most kickoffs explicitly DO allow research-patch commit with maintainer approval)
- **NO answering maintainer-only decisions** — D-decisions in kickoffs surfaced as RECOMMENDATIONS, not commitments
- **NO dialogue-session execution** — 1A goal-clarity-dialogue is NOT in autonomous queue
- **NO scope expansion** beyond kickoffs in §3 queue — if subagent surfaces «we should also do X» → record as observation in state.md, do NOT add to queue
- **NO fabrication** — every claim cites source; INCONCLUSIVE marker preferred over plausible-looking guess
- **NO infinite loops** — MAX_ITERATIONS = 5, hard cap (per §6)
- **NO budget over-spend** — per `feedback_delegation_model` Opus quota not issue, BUT if any external token-cap surfaces, ESCALATE immediately
- **NO ignoring escalation conditions** — when any of §6 triggers fires, STOP and write maintainer summary
- **NO worktree-add failure proceeding in shared dir** — per `parallel-subwave-isolation.md` `#worktree-add-failure-ignored` anti-pattern. If parallel mode + worktree fails → fall back to sequential, NOT shared-dir

---

## §10 AI laziness traps active for this orchestrator session

Per [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md):

**Canonical traps (orchestrator-context):**

- **T1** (sampling floor) — N/A for orchestrator dispatch; applies inside subagents per their kickoff
- **T2** (methodology not running) — orchestrator must ACTUALLY dispatch subagents, not «design dispatch plan and stop»
- **T3** (verification) — every state.md update has timestamp + concrete artifact reference (NOT prose-only)
- **T4** (premature closure) — orchestrator does NOT mark kickoff GO without reviewer subagent GO verdict
- **T5** (implementation into research) — orchestrator does NOT directly edit kickoff outputs; subagents do
- **T7** (literal prompt following) — orchestrator reads each kickoff's specific scope; doesn't apply identical method to all
- **T8** (asking maintainer to avoid work) — orchestrator does NOT escalate to maintainer mid-flow for non-blocked questions; uses defaults from §6 escalation triggers only
- **T11** (designing without prior art) — N/A at orchestrator level; applies inside subagents
- **T13** (treating ADOPTED items as zero-work) — applies inside subagents (per their kickoff T-traps)
- **T14** (clean audit = no theatre) — if reviewer returns GO with «no required fixes» — orchestrator double-checks at least 1 section randomly before accepting (anti-collusion check)
- **T15** (self-application) — orchestrator's own session must apply discipline. State.md is recursive self-audit. Final orchestrator message must explicitly self-assess (did I follow my own protocol?)
- **T16** (pattern-matching-on-name) — N/A at orchestrator level

**Domain-specific traps for autonomous orchestration:**

- **T-AO-A «collusion-between-subagents»** — research subagent + reviewer subagent both Opus, same model bias toward producing plausible-looking outputs. Counter: reviewer prompt explicitly «DO NOT collude — if hard constraint violated → REVISE regardless of how close output looks». Plus orchestrator randomly spot-checks 1 section per GO verdict (T14 anti-collusion check).
- **T-AO-B «infinite-iteration loop»** — research-revise-review cycle without convergence; iter 2 outputs similar to iter 1. Counter: MAX_ITERATIONS=5 hard cap (per §6). Reviewer must compare iter N output to iter N-1 — if 80%+ identical → flag «non-convergence», escalate.
- **T-AO-C «file-write delay»** — subagent gathers all outputs in head, plans to dump at end, then hits context limit or interrupt → loses all work. Counter: research subagent prompt mandates INCREMENTAL write per section + state.md update at boundaries. Orchestrator polls state.md every N minutes (or after each Task completion) to verify progress.
- **T-AO-D «scope creep via observations»** — subagent surfaces «we should also do Y» mid-execution; orchestrator tempted to expand queue. Counter: observations recorded but queue locked; expansion = maintainer decision post-orchestration.
- **T-AO-E «verdict-grade-inflation»** — reviewer subagent might tend toward GO under «good-enough» pressure (token-budget pressure, time pressure). Counter: reviewer prompt explicitly «hard constraint violated → REVISE» + structured GO/REVISE format with REQUIRED-FIXES count visible.
- **T-AO-F «orchestrator-as-decider»** — orchestrator might be tempted to «just decide D1-D7 in Wave 10 kickoff» when reviewer returns REVISE on «D1-D7 not finalized». Counter: orchestrator NEVER decides maintainer-owned questions. D1-D7 status = RECOMMENDATIONS-PRESENT, not RECOMMENDATIONS-RESOLVED.
- **T-AO-G «1A leakage»** — orchestrator attempts to execute 1A as if research (it's dialogue). Counter: 1A explicitly NOT in queue (§3). If reviewer of 1B asks «1A's verdict on X» that doesn't exist → escalate, don't fake-decide-on-maintainer's-behalf.
- **T-AO-H «state.md as theatre»** — state.md updates without actual subagent dispatch (orchestrator marks RESEARCH-COMPLETE without subagent having run). Counter: each state.md update tied to file-system evidence (research-patch file mtime, subagent return message in orchestrator log).
- **T-AO-I «Opus model not actually used»** — Task tool dispatched with model unspecified, defaults to whatever Claude Code default is (might NOT be Opus). Counter: orchestrator explicitly passes `model: opus` per «жги» directive. Verify subagent confirms model in initial output.
- **T-AO-J «headless-fallback-as-default»** — orchestrator скатывается на `claude -p` headless для всех dispatches вместо Task subagents (path of least resistance во время window'а — кажется проще, нет context budget pressure). Counter: §4.2 mandates Task subagent FIRST; `claude -p` ONLY after Task reports context-exhaustion for THAT block. Each fallback invocation must log `K=<X> block=<Y> dispatched-via=headless reason=<context-exhausted-iter-N>` in state.md. If state.md shows ≥2 consecutive fallback dispatches without prior Task attempt → orchestrator self-detects T-AO-J and escalates. Why this matters: when window expires (~2026-06-16) and operator forgot to re-test Task path, orchestrator suddenly has no working dispatch mechanism. Default-discipline preserved = window-expiry is non-event.

---

## §11 Stop conditions

Orchestrator STOPS when ONE of:

1. **All ACTIVE queue kickoffs have GO verdict** (per §3 «Active autonomous queue: [#1, #3, #4, #5-conditional]»; DEFERRED #2 does NOT block completion) — successful completion. Write final summary message + memory update. If #5 was skipped due to absorption-by-#1 (§3 conditional), note rationale in summary; that counts as «done» for queue purposes.
2. **Escalation trigger fires** (§6) — write escalation message + state.md, exit.
3. **Maintainer interrupt** — if maintainer sends message mid-flow, pause cleanly + acknowledge.
4. **Tool unavailability** persistent (DeepWiki/Context7 down >30 min consecutive) — escalate per §6.4.
5. **Self-detected infinite loop** per T-AO-B → escalate per §6.6.

Final orchestrator message must include:
- Queue completion status (per kickoff)
- Iterations per kickoff (sum + average)
- Token-spend estimate (if observable)
- Files modified list (research-patches, drafts, memory entries)
- Self-application check: did orchestrator itself apply its discipline? (T15)
- Recommendations for maintainer next actions (review drafts, ship codification commits, etc.)

---

## §12 Maintainer handoff conditions

**Pre-launch (maintainer prepares):**
- Verify Claude Code v2.1.98 (not v2.1.100+ token-bug version) per `project_session_ordering_2026_05_13` memory
- Verify DeepWiki MCP available (`claude mcp list`)
- Verify on `main` branch with clean working tree
- **Verify `claude -p` headless fallback available** (Option C-hybrid per §4.2): run `claude -p "echo PROBE-OK"` in shell — expect single-line `PROBE-OK` response, no auth-prompt, no error. If fails OR today's date past ~2026-06-16 → orchestrator runs Task-subagent-only mode (fallback DISABLED), context-exhaustion escalates per §6 instead of fallback.
- Paste this kickoff into new Opus session

**During execution (maintainer observes / interrupts):**
- Watch state.md for progress
- DO NOT edit kickoffs being executed (cross-cutting concerns)
- Send «pause» if needed; orchestrator acknowledges

**On escalation (maintainer addresses):**
- Read state.md ESCALATION section
- Address blocker (clarify acceptance, revise kickoff, answer maintainer-only question)
- Resume by sending «continue» or re-launching orchestrator (it reads state.md and resumes)

**On final completion (maintainer reviews):**
- Read all research-patches + drafts
- Decide codification commits (README revisions, rules, SSOT corrections)
- Ship at own pace; orchestrator does NOT auto-codify

---

## §13 See also

- All kickoffs in §3 queue
- [.claude/rules/parallel-subwave-isolation.md](../../rules/parallel-subwave-isolation.md) — worktree discipline
- [.claude/rules/ai-laziness-traps.md](../../rules/ai-laziness-traps.md) — T-trap base
- [.claude/skills/orchestrator/SKILL.md](../../skills/orchestrator/SKILL.md) — existing Mode A/B orchestrator pattern (this kickoff is a Mode B-iterative extension)
- [.claude/skills/reviewer/SKILL.md](../../skills/reviewer/SKILL.md) — reviewer pattern reference
- [agents/review-sidecar.md](../../../agents/review-sidecar.md) — reviewer subagent base prompt
- [agents/compliance-verifier.md](../../../agents/compliance-verifier.md) — substantive compliance check pattern
- [CLAUDE.md Artifact Ownership Contract](../../../CLAUDE.md) — what orchestrator can / can't edit
- Memory entries:
  - `feedback_delegation_model.md` — Opus subagent quota model
  - `feedback_worktrees_for_parallel_subwaves.md` — worktree mandatory
  - `feedback_no_drive_by_prs.md` — within-scope discipline
  - `project_session_ordering_2026_05_13.md` — kickoff queue
  - `project_claude_p_headless_window.md` — `claude -p` fallback time-window (~2026-06-16); governs §4.2 Option C-hybrid + T-AO-J in §10

---

## §14 Final note to the AI orchestrator running this

You are Opus. You're in «жги» mode. Token spend is authorized. Your job:

1. Read this kickoff + Step 0 reads (§2) fully
2. Read all §3 queue kickoffs (need acceptance criteria upfront)
3. Set up state.md (this kickoff's directory)
4. Sequential dispatch per §4 protocol:
   - Research subagent (Opus) → reviewer subagent (Opus) → loop until GO or MAX_ITERATIONS
5. On GO → next kickoff
6. On escalation → STOP, maintainer summary
7. On all-GO → final completion message

You do NOT:
- Edit maintainer-owned files
- Decide maintainer-only questions
- Fabricate to converge faster
- Skip reviewer step
- Run 1A as if research session
- Expand queue mid-flow
- Use `claude -p` headless as DEFAULT dispatch (T-AO-J in §10). It's a fallback ONLY after Task subagent reports context-exhaustion for that block.
- Attempt #2 (1B) autonomously — DEFERRED per §3; requires maintainer-driven 1A dialogue first

Your closing message (success path):
- Summary per kickoff (iterations, GO state, files written)
- Self-application audit (T15) — did YOU follow protocol?
- Recommendations for maintainer (review priorities, codification next steps)

Your closing message (escalation path):
- Trigger fired, kickoff blocked
- State.md location
- Specific maintainer action needed

**Most important:** the value you bring is automation of dispatch + iterative quality loop. You do NOT replace maintainer judgment on what verdicts to set. You DISPATCH + GATE; maintainer DECIDES (eventually, post-orchestration).

Burn Opus. Be thorough. Cite everything. Escalate cleanly when blocked. Done.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
