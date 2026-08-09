# Queue Mode — Autonomous Research Multi-Kickoff Reference

> **Authoritative for:** Queue mode workflow — when to use, pre-flight checklist, dispatch protocol, state.md format, iteration limits, anti-collusion, memory discipline, headless dispatch, claude-code-guide integration. Added 2026-05-16.
> **NOT authoritative for:** project goal (see README.md#why-this-exists); Mode A / Mode B / Mode B' for umbrella PR work (see main SKILL.md); role definitions (see [[glossary.md]]).
>
> **Origin:** Parent autonomous-research-orchestrator session (2026-05-16). Four-kickoff sequential autonomous research run demonstrated the pattern empirically. Lessons L1-L7 from parent state.md encoded here. See parent state.md: `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`.

---

## §1 When to use Queue mode

### Triggers (use Queue mode)

- **≥2 kickoffs ready in queue** and maintainer has granted autonomous execution authority («работай без остановок», «burn mode», «do all kickoffs autonomously»)
- Kickoffs are primarily **research / audit / planning** (not execution that touches a live codebase with merge-conflict risk)
- Each kickoff is **independently verifiable** — has acceptance criteria that Reviewer can check without maintainer input
- Queue is **sequential** (each kickoff depends on conclusions from prior ones, OR they are independent but maintainer prefers sequential for simplicity)

### Anti-triggers (do NOT use Queue mode)

- **Single kickoff** → use Mode A (inline Agent) or Mode B (file-prompt) from main SKILL.md
- Kickoffs are **execution** tasks that modify production code in parallel → use Mode B × N worktrees with worktree isolation (`.claude/rules/parallel-subwave-isolation.md`)
- Any kickoff has **open D-question that requires maintainer dialogue before execution** (T-AO-G) → mark that kickoff DEFERRED, do not dispatch
- Maintainer is actively present and prefers interactive mode → Mode A or direct Edit is more efficient
- **T-AO-J warning:** do not choose Queue mode just because headless `claude -p` is convenient; Task subagent is primary

---

## §2 Pre-flight checklist

Run these BEFORE dispatching any Worker. Log results in state.md History.

```bash
# 1. Claude Code version — expect v2.1.98 (or verified non-buggy version)
claude --version

# 2. MCP servers — expect deepwiki + context7
claude mcp list

# 3. Git status — note any untracked files / feature branches from parent sessions (expected state)
git status
git branch --show-current

# 4. Headless probe — expect single-line output containing probe string
# (Time-windowed: valid only until ~2026-06-16 per memory `project_claude_p_headless_window`)
claude -p "echo PROBE-OK"

# 5. claude-code-guide availability — check system reminder at session start for available subagent_types
# Confirm `claude-code-guide` is listed with tools: Bash + Read + WebFetch + WebSearch
# If MISSING → ESCALATE immediately (L7 mandate cannot be satisfied without it)
```

**Pre-flight failures → escalation triggers:**

| Check | Failure | Escalation |
|---|---|---|
| `claude --version` wrong | Unexpected model version | `ESCALATE:setup:wrong-claude-version` |
| MCP unavailable >30 min | DeepWiki or context7 down | `ESCALATE:K:tool-unavailable` |
| `claude -p` fails AND date > ~2026-06-16 | Headless window expired | Document in state.md; fallback = Task subagent only; no escalation if Task works |
| `claude-code-guide` missing | L7 mandate unsatisfiable | `ESCALATE:setup:claude-code-guide-unavailable` |

---

## §3 Workflow diagram

```text
Orchestrator initializes state.md
        │
        ▼
For each kickoff K in queue (sequential):
        │
        ├─► Pre-dispatch check (predecessor GO? open D-questions? T-AO-G check?)
        │
        ├─► DISPATCH Worker (Task subagent, Opus, per [[worker-template.md]])
        │         │
        │         └─► Worker executes kickoff, writes output, appends state.md per section
        │                   │
        │                   └─► RESEARCH-COMPLETE (or BLOCKED)
        │
        ├─► File-system verify (L2 discipline):
        │         ls -la <output-path>
        │         wc -l <output-path>
        │         grep -c '^## §' <output-path>  (section count)
        │         If file missing or too small → re-dispatch Worker (not Reviewer)
        │
        ├─► DISPATCH Reviewer (Task subagent, Opus, per [[reviewer-template.md]])
        │         │
        │         └─► REVIEW-COMPLETE: GO or REVISE
        │
        ├─► REVISE path (iter ≤ 5):
        │         Re-dispatch Worker with REVISE-fixes prompt
        │         Worker addresses HARD-FIX items only
        │         Loop back to File-system verify
        │
        ├─► GO path:
        │         Anti-collusion spot-check (Orchestrator independent section check)
        │         If spot-check fails → reject GO, re-dispatch Reviewer
        │         If spot-check passes → mark K done in state.md
        │
        └─► Next K (or escalation)

Orchestrator writes final summary (T15 self-application audit)
```

### Per-kickoff dispatch sequence

1. Update state.md: `«DISPATCHED Worker for K (iter N)»`
2. Dispatch Worker via Task tool (`subagent_type: general-purpose`, `model: opus`) using [[worker-template.md]] filled for K
3. Wait for Worker RESEARCH-COMPLETE signal
4. File-system verify: `ls`, `wc -l`, section count
5. If file invalid → log `«file-system verify FAILED for K; re-dispatching Worker»`; go to step 1
6. Update state.md: `«DISPATCHED Reviewer for K (iter N)»`
7. Dispatch Reviewer via Task tool using [[reviewer-template.md]] filled for K
8. Wait for Reviewer REVIEW-COMPLETE signal
9. If REVISE:
   - iter < MAX_ITERATIONS → dispatch Worker with REVISE prompt; go to step 3
   - iter ≥ MAX_ITERATIONS → escalate
10. If GO: run anti-collusion spot-check (§6)
11. Log K done; proceed to next K

---

## §4 state.md format

Append-only journal. Create at session start. Never delete entries (append-only per project doc-authority pattern).

```markdown
# <Queue Name> State

> Session start: <ISO timestamp>
> Orchestrator model: claude-opus-4-7 (or current)
> Mode: Queue mode (sequential <order>)
> Operator subscription: Claude Code v<VERSION>
> Parent session: <parent-session-name> (if applicable)

## Pre-flight check results
[one bullet per check; ✓ or ✗]

## Queue

| # | Artefact | Status | Iterations | Notes |
|---|----------|--------|------------|-------|
| A | <name> | PENDING | 0 | <notes> |
| B | <name> | PENDING | 0 | After A |
| C | <name> | PENDING | 0 | After B |

## Statuses legend

- PENDING — not yet dispatched
- DISPATCHED-WORKER — Worker subagent running (iter N)
- WORKER-COMPLETE — Worker reported done; file-system verified
- DISPATCHED-REVIEWER — Reviewer subagent running
- REVISE-iter-N — Reviewer returned REVISE; loop continues
- GO — Reviewer GO + anti-collusion spot-check passed; final state
- ESCALATED — §7 trigger fired; stopped
- DEFERRED — not in active queue (blocked on maintainer dialogue)

## Active

- Current artefact: <K or «QUEUE COMPLETE»>
- Iteration: N

## History

- <ISO timestamp> — orchestrator session started
- <ISO timestamp> — pre-flight checks complete, all green
- <ISO timestamp> — state.md initialized
- <ISO timestamp> — DISPATCHED Worker for A (iter 0)
- <ISO timestamp> — A §1 complete: <one-line summary>
- <ISO timestamp> — A §2 complete: <summary>
  [... one entry per section ...]
- <ISO timestamp> — RESEARCH-COMPLETE A (iter 0)
- <ISO timestamp> — Orchestrator file-system verification passed (Nbytes, M lines, K sections)
- <ISO timestamp> — DISPATCHED Reviewer for A (iter 0)
- <ISO timestamp> — REVIEW-COMPLETE A iter 0 verdict: GO
- <ISO timestamp> — Anti-collusion spot-check passed (section §<i>, claim verified: <specifics>)
- <ISO timestamp> — A marked GO ✓
- <ISO timestamp> — DISPATCHED Worker for B (iter 0)
  [etc.]
```

---

## §5 File-system precedence rule (L2 lesson)

**Rule:** If state.md says «RESEARCH-COMPLETE» but the file on disk is missing, too small, or has fewer sections than expected — **the file-system wins.** Treat as Worker context-exhaustion. Re-dispatch Worker, not Reviewer.

**Checks to run before Reviewer dispatch:**

```bash
# Size sanity
ls -la <output-path>
wc -l <output-path>

# Section count (adjust grep pattern for your doc's structure)
grep -c '^## §' <output-path>

# Expected ranges from kickoff spec: compare actual vs expected
# If actual < expected_min → re-dispatch Worker
```

Do not trust Worker's RESEARCH-COMPLETE claim without file verification. This prevents T-AO-H (state.md as theatre) from propagating to Reviewer.

---

## §6 Anti-collusion spot-check protocol

After every Reviewer GO — before marking K done — Orchestrator independently checks one section.

**Formula for selecting section index:**

```text
i = ((artefact_letter_ord + iter_count) * 7 + N) mod N
```

Where:
- `artefact_letter_ord` — position of artefact letter in queue (first=1, second=2, third=3, …). Example: if queue is [C, B, A], then C→1, B→2, A→3
- `iter_count` — final iteration number when GO was reached (0 for first-pass GO)
- `7` — prime multiplier to spread indices across full range (prevents collapse on §1-§3)
- `N` — count of substantive sections in output: `grep -c '^## §\|^### §' <output-path>`
- `mod N` — ensures index is within range [0, N-1]

**If section i is metadata/header-only** (e.g. §0 frontmatter, `## See also`): increment i by 1 modulo N.

**Spot-check procedure:**

1. Read section i in full
2. Pick one factual claim in that section
3. Verify the claim independently:
   - File:line citation → open file, check line
   - URL citation → WebFetch the URL, confirm claim is supported
   - Tool query → run the tool yourself, compare output
4. If claim verified → log: `«Anti-collusion spot-check passed (section §i, claim verified: <specifics>)»`
5. If claim fails → log failure; reject GO; re-dispatch Reviewer with note `«spot-check found: <specific issue>»`

**Anti-collusion rationale:** Both Worker and Reviewer are Opus. They share model-level biases toward polished-looking output (T-AO-A). The spot-check introduces an independent Orchestrator verification that cannot be fooled by shared bias — Orchestrator directly checks source.

---

## §7 Iteration limits and escalation triggers

**MAX_ITERATIONS = 5** per artefact. On iter 5 REVISE → escalate immediately; do NOT dispatch iter 6.

**Escalation triggers:**

| Code | Trigger | Escalation action |
|---|---|---|
| `ESCALATE:K:max-iterations` | Artefact K hit iter 5 without GO | Stop K; write escalation summary; pause queue |
| `ESCALATE:K:blocked-by-prerequisite` | K requires answer to D-question from prior kickoff that was DEFERRED | Mark K DEFERRED; if K was blocking next artefacts, escalate entire queue |
| `ESCALATE:K:tool-unavailable` | claude-code-guide OR DeepWiki/context7 unreachable >30 min | Stop; note which tool; wait for recovery or escalate |
| `ESCALATE:K:scope-conflict` | Executing K would require editing maintainer-owned project file | Stop; document which file and why; surface for maintainer |
| `ESCALATE:K:maintainer-dialogue-required` | Open D-question in K has no autonomous-decidable default | Stop K; surface D-question with both options' downstream consequences |
| `ESCALATE:K:infinite-loop` | Reviewer flip-flops GO ↔ REVISE on same content across 2+ iterations | Stop; document the conflicting criteria; maintainer decides |
| `ESCALATE:budget-cap` | Token budget approaching limit (burn mode: discretionary; hard 429) | Stop cleanly; log current state; await reset |

**Escalation message format** (write to state.md + return as Orchestrator response):

```text
## ESCALATION

- Artefact: K
- Trigger code: <code>
- Trigger detail: <one paragraph>
- Current K state: iter N, last verdict: <GO/REVISE>
- Remaining queue: [list of artefacts not yet GO]
- Maintainer action needed: <specific: answer D-question X / check tool Y / decide between A and B>
- Resume signal: <what to send to continue: "resume K" or "skip K, proceed to next" or "answer: <format>">
```

---

## §8 Memory updates — Orchestrator only

**Rule:** Only the Orchestrator writes to project memory (`.claude/projects/*/memory/*.md`). Workers do NOT write to memory.

**Why:** Worker and Reviewer are sub-sessions without persistent memory. If they wrote to shared memory files, content could be stale (Worker's session-specific context) or racing (two parallel Workers writing same file). Race-prevention requires single-writer discipline.

**Pattern:** Worker may DRAFT memory-entry content in artefact §appendix or REPORT «ATTN: consider adding to memory: <draft content>». Orchestrator extracts and writes post-GO — after Reviewer confirmed the content is correct.

**Memory update timing:** Only AFTER GO + anti-collusion spot-check passed. Not during REVISE cycles (content may change).

---

## §9 Headless dispatch — time-windowed channel

`claude -p` (headless dispatch via Bash) is a time-windowed option for per-section blocks when Task subagent hits context-budget pressure.

**Window:** Available under Claude Code subscription until approximately **2026-06-16**. After that date, `claude -p` requires paid API key (Anthropic policy change). Under the project's no-paid-LLM-in-CI policy (`.claude/rules/no-paid-llm-in-ci.md`), this means headless dispatch becomes **unavailable** post-window.

**Primary dispatch mechanism:** Task subagent (Tool: Task). Always try Task first.

**Headless as fallback ONLY when:**
- Task subagent reports context-budget exhaustion for a per-section block
- Full kickoff is too large for one Task dispatch and must be split into per-section blocks

**Headless dispatch procedure:**

```bash
# 1. Prepare per-section prompt file
# Path: .claude/orchestrator-prompts/<queue-dir>/headless-prompts/<K>-<section>.md

# 2. Dispatch with explicit model and timeout
claude -p "$(cat <prompt-file>)" --model claude-opus-4-7 2>&1
# (timeout: 300000ms = 5 min max per section; adjust per context)

# 3. Capture output → Orchestrator writes to artefact via Edit/Write tool

# 4. Log in state.md:
# «K=<X> section=<Y> dispatched-via=headless reason=context-exhausted»
```

**Fallback when headless unavailable (post-2026-06-16 or window expired):**
- Split kickoff into smaller per-section Task dispatches
- Each Task handles one §N, writes to file, Orchestrator integrates
- If Task still exhausts context on single section → escalate `ESCALATE:K:tool-unavailable` (the task is effectively too large for autonomous execution in current harness)

**T-AO-J warning:** Do NOT drift to headless-as-default. Task subagent is primary. Log dispatch mechanism per artefact.

---

## §10 Dual-channel verification for Claude Code claims

**Empirical correction (2026-05-16, Queue Mode Execution B+C session):** the `claude-code-guide` built-in subagent type is **NOT inherited by spawned Worker subagents**. It is available only in the top-level Orchestrator session that lists it in its system reminder. Workers dispatched via the Task tool do not receive `claude-code-guide` in their subagent-type roster.

Earlier versions of this skill mandated «claude-code-guide as MANDATORY FIRST channel for Workers». That guidance was wrong — Workers cannot invoke it. Pattern below reflects what actually works.

### §10.1 Role-specific channels

| Role | First channel for Claude Code claims | Second channel (cross-check) |
|---|---|---|
| **Orchestrator** (Opus main session) | `claude-code-guide` subagent (if listed in system reminder) | DeepWiki MCP via `mcp__deepwiki__ask_question` on `anthropics/claude-code` |
| **Worker** (spawned via Task) | `WebFetch` of `https://docs.claude.com/en/docs/claude-code/...` | DeepWiki MCP on `anthropics/claude-code` |
| **Reviewer** (spawned via Task) | Same as Worker — plus **independent re-verification** of ≥1 high-stakes claim that Worker flagged |

### §10.2 Graduated rigor by claim class (revised 2026-05-16 per D3)

| Claim class | Primary channel | Secondary | Tertiary | Notes |
|---|---|---|---|---|
| **SDK-shaped** — hook payload fields (e.g. `StopHookInput.last_assistant_message?`), MCP tool contracts, settings.json schema field types, harness event interfaces | TypeScript SDK types (`agent-sdk/typescript.md` or `.d.ts`) | One prose channel (WebFetch official docs OR DeepWiki) | — | Type-system authoritative per [phase-research-coverage.md §1.10](../../../../code/rules-as-tests-aif/.claude/rules/phase-research-coverage.md) |
| **Prose CC docs (non-lifecycle)** — feature behavior descriptions, configuration narratives, slash command flows, setting semantics | WebFetch `docs.claude.com` | DeepWiki `anthropics/claude-code` | — | Dual-channel default |
| **High-stakes CC harness lifecycle** — when Stop fires, when SubagentStop fires, event firing order, compaction triggers | WebFetch `docs.claude.com` | DeepWiki `anthropics/claude-code` | Orchestrator-only `claude-code-guide` w/ TypeScript SDK access | Empirical 2026-05-16: 2 prose channels can converge on same misreading; types resolve |
| **External libs (npm/GitHub)** | context7 OR DeepWiki single-channel | — | — | As before |
| **General programming concepts** | No external verification | — | — | As before |

**Why three channels for harness lifecycle specifically:** the 2026-05-16 Stop-hook incident showed Worker and Reviewer WebFetches converged on the same prose misreading. Type-system evidence was the discriminating channel. Other claim classes can rely on dual-channel because their failure modes don't typically converge — prose-only claims and external libs don't have a third type-system option, and the dual-channel default catches divergences in those classes well.

### §10.3 Worker invocation pattern (active path)

```text
1. WebFetch official docs:
   WebFetch(url="https://docs.claude.com/en/docs/claude-code/hooks#stop", 
            prompt="When does the Stop hook fire? Quote exact lifecycle.")
   
2. DeepWiki cross-check:
   mcp__deepwiki__ask_question(
     repoUrl="https://github.com/anthropics/claude-code",
     question="When does the Stop hook fire in the session lifecycle?"
   )
   
3. Compare answers:
   - If both agree → AFFIRM, cite both URLs
   - If divergent → FLAG as INCONCLUSIVE, surface as D-item, do NOT accept either
   - If only one channel returns evidence → single-channel finding, mark confidence accordingly
```

### §10.4 Orchestrator invocation pattern (if claude-code-guide available)

```text
Use the claude-code-guide subagent to answer:
"[Specific question about Claude Code feature]"

Cross-check via DeepWiki:
mcp__deepwiki__ask_question(repoUrl="https://github.com/anthropics/claude-code", 
                            question="[same question]")
```

### §10.5 Reviewer invocation pattern (independent re-fetch mandate)

Empirical finding from Queue Mode Execution B+C, 2026-05-16: when Worker flagged 3 claims as FLAG, Reviewer's independent WebFetch caught 2 of 3 as Worker over-flag (Worker mis-interpreted the doc surface). Lesson: **Reviewer's second-pass WebFetch on ≥1 high-stakes FLAG is mandatory**, not optional. It is the actual cross-channel — Worker's «dual channel» is still one model session.

```text
For each FLAG that Worker raised:
  1. Pick the highest-stakes FLAG (one that would change parent verdict if true)
  2. Independently WebFetch the same URL Worker fetched
  3. Form independent judgment
  4. If Worker over-flagged → REVERSE-FLAG, downgrade to AFFIRM
  5. If Worker under-flagged or missed nuance → ELEVATE-FLAG, add HARD-FIX
```

---

## §11 claude-code-guide continuity pattern — Orchestrator-only, experimental-flag-gated

**Empirical correction (2026-05-16, Queue Mode Execution B+C):** the `SendMessage`-based continuity pattern described in earlier versions of this section is gated behind an experimental Claude Code env var AND is structurally available only to the Orchestrator (main session). Workers cannot use it for two independent reasons.

### §11.1 Why SendMessage is not a Worker tool

Per `https://code.claude.com/docs/en/tools-reference.md` (verified via Orchestrator-mediated `claude-code-guide` invocation, 2026-05-16):

> `SendMessage` — Sends a message to an agent team teammate, or resumes a subagent by its agent ID. Stopped subagents auto-resume in the background. **Only available when `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set.**

And per `https://code.claude.com/docs/en/sub-agents.md`:

> «When a subagent completes, Claude receives its agent ID. Claude uses the SendMessage tool with the agent's ID as the to field to resume it. The SendMessage tool is **only available when agent teams are enabled** via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.»

Independently of the env var: per the same `sub-agents.md` page, «subagents cannot spawn other subagents». A Worker therefore cannot dispatch claude-code-guide in the first place — there is nothing to address via SendMessage.

### §11.2 Where continuity DOES work

In a standard v2.1.98 session **without** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, every `Agent` (Task tool) dispatch is a fresh instance with no persistent reference. Continuity within an Orchestrator session is achieved by:

- Putting all related CC questions in **one** claude-code-guide dispatch (single Agent call with multiple Q1/Q2/Q3 in the prompt), OR
- Spawning a fresh claude-code-guide for each question and accepting initialization overhead.

In an Orchestrator session **with** the experimental flag set, the `SendMessage` tool becomes available and reuse-by-agent-id works as described in the older guidance — but this is opt-in experimental, not default behaviour.

### §11.3 Recommended pattern for Queue mode

For Queue mode autonomous research without the experimental flag:

1. Orchestrator batches multi-question CC verifications into one claude-code-guide dispatch with Q1/Q2/Q3/... in the prompt body. Pay one initialization cost; get all answers in one return.
2. If a Worker surfaces a follow-up CC question post-RESEARCH-COMPLETE, the Orchestrator dispatches a fresh claude-code-guide instance and feeds the verified answer down to the next Worker iter if needed.
3. Do NOT instruct Workers to use SendMessage — it is unavailable to them regardless of env var.
4. Each claude-code-guide instance closes with the Orchestrator session naturally; no explicit cleanup needed.

---

## §12 Self-application note

Queue mode, when applied to producing Queue mode skill documentation, is recursive by definition (T-meta-A from meta-kickoff §8). The process of writing this reference file used the same discipline it documents: write-as-you-go (each §N written immediately), state.md appended per section, backup before SKILL.md edits, diff verification.

This is consistent with the project's core thesis: «documents lie; tests don't.» The Queue mode reference becomes more credible by being produced via Queue mode discipline, not despite it. The T15 (self-application) check is satisfied structurally: the Orchestrator session that produced this artefact ran file-system verify, anti-collusion spot-check, and state.md History entries before accepting GO — the exact pattern §3 describes.

---

## See also

- [[glossary.md]] — Orchestrator / Worker / Reviewer role definitions
- [[worker-template.md]] — boilerplate Worker prompt (fill + dispatch)
- [[reviewer-template.md]] — boilerplate Reviewer prompt (fill + dispatch)
- [[ai-laziness-traps-orchestrator.md]] — T-AO-A through T-AO-L trap catalogue
- `.claude/rules/ai-laziness-traps.md` — T1-T16 (project-wide; Workers + Reviewers)
- `.claude/rules/parallel-subwave-isolation.md` — worktree discipline for parallel Mode B work
- `.claude/rules/no-paid-llm-in-ci.md` — policy governing headless dispatch economics
- Parent empirical record: `.claude/orchestrator-prompts/autonomous-research-orchestrator/state.md`
