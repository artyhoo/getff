# Kickoff — M1 gate: shipped-agent `tools:`-name allow-list (Stage 2, Phase 1 of shipped-artifact-liveness-gap)

> **Type:** I-phase (execution-build). Single buildable task. Base: `staging`.
> **Context:** R-phase research-patch merged via #566 (`docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md`). Verdict = **Option C, phased**; this is **Phase 1 = M1 gate**, scope **(i)** (decided by maintainer 2026-06-16).
> **Root cause it closes (#551):** 6 shipped agents declare non-canonical CC tool names → on CC dispatch they get zero tools and fabricate. `npm run validate` was green while the agents were dead.

## Goal

A deterministic gate that fails when any shipped `agents/*.md` `tools:` (or shipped skill `allowed-tools`) entry is not a real Claude Code tool name. Catches #551 at the earliest reachable channel (pre-push / principle test), no LLM, no paid-CI.

## Scope decision (i) — DECIDED, do not re-open

The `tools:` frontmatter is a **Claude-Code-only runtime contract** (only CC's Agent tool reads it). It MUST use CC-canonical names. The agents' **agnosticism lives in their prose body** (which names Cursor/Aider/Codex) — **do NOT touch the prose**, only the `tools:` line. Do NOT build a name-mapping table (that was option (ii), rejected). Do NOT add a dispatch-guard (option (iii), rejected — these agents are CC-dispatchable by design; #551 proves they get dispatched).

## Deliverable (exactly three parts)

### Part A — fix the 6 agents' `tools:` lines (CC-canonical mapping)

Mapping (authoritative): `read_file → Read`, `list_files → Glob`, `run_command → Bash`. Edit ONLY the `tools:` line in each; leave the prose body untouched:

| File | current `tools:` | → new `tools:` |
|---|---|---|
| `agents/living-docs-auditor.md` | `read_file, list_files, run_command` | `Read, Glob, Bash` |
| `agents/compliance-verifier.md` | `read_file, list_files` | `Read, Glob` |
| `agents/manual-rule-liveness-prober.md` | `read_file, list_files` | `Read, Glob` |
| `agents/memory-codification-auditor.md` | `read_file, list_files` | `Read, Glob` |
| `agents/review-sidecar.md` | `read_file, list_files` | `Read, Glob` |
| `agents/orchestrator-worker-discipline.md` | `read_file` | `Read` |

### Part B — the principle test (the gate)

Create `packages/core/principles/<N>-shipped-agent-tools-valid.test.ts` where `<N>` = lowest free slot (list `packages/core/principles/` — currently 01–19 are used, so almost certainly **20**; verify, do not assume). Follow the existing principle-test pattern (vitest; the runner auto-discovers `principles/*.test.ts` — no separate wiring needed unless the peer tests have explicit pre-push entries, in which case mirror them).

The test:
1. Parses every `agents/*.md` `tools:` frontmatter line AND every shipped skill `allowed-tools` (under `.claude/skills/**/SKILL.md` and any `packages/**/templates/**` shipped skills).
2. Asserts each entry ∈ the CC-canonical allow-list (below) ∪ the pattern `^mcp__[^_]+__`.
3. **Paired-negative arm (mandatory, per principle-02 discipline):** a fixture/temp agent with a bogus tool name (e.g. `read_file`) → the check MUST go RED; valid names → GREEN. The test must prove it actually fails on a bad input, not just pass vacuously.

**CC-canonical tool allow-list (authoritative — from research-patch §0, verified against `code.claude.com/docs/en/tools-reference` 2026-06-16; use THIS list, do NOT invent from memory):**
`Agent, AskUserQuestion, Bash, CronCreate, CronDelete, CronList, Edit, EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree, Glob, Grep, ListMcpResourcesTool, LSP, Monitor, NotebookEdit, PowerShell, PushNotification, Read, ReadMcpResourceTool, RemoteTrigger, ScheduleWakeup, SendMessage, ShareOnboardingGuide, Skill, TaskCreate, TaskGet, TaskList, TaskOutput, TaskStop, TaskUpdate, TeamCreate, TeamDelete, TodoWrite, ToolSearch, WaitForMcpServers, WebFetch, WebSearch, Workflow, Write` plus the `mcp__<server>__<tool>` pattern.

### Part C — verify it catches #551

After Part A, run the test → it must be **GREEN** (the 6 agents now use canonical names). Temporarily revert one agent to `read_file` (or use the paired-negative fixture) → **RED**. Record both in the task notes. This is the recursive-self-application proof (T15): the gate that would have caught #551.

## NOT in scope (defer / do not build)

- M2 probe (behavioural dispatch smoke) — that is Phase 2, deferred behind a trigger. Do NOT build it.
- A new `.claude/rules/*.md` rule — the research-patch is the doc; do not add a rule file in this task.
- Editing agent prose bodies, README/CLAUDE.md, or any file not in Parts A/B.

## Capability-commit obligations (this IS a capability commit — new ≥50 LOC test under `packages/`)

- Add an SSOT entry **#121** to `docs/meta-factory/prior-art-evaluations.md` (verdict BUILD; «Shipped-agent liveness — `tools:`-name allow-list gate (deterministic, CC-scoped)»; cites #53/#114/#115; problem-class = framework's own delivery artefacts). If #121 is already taken when you check, use the next free number and note it.
- The `Prior-art:` commit trailer + the §1.7 Forward/Backward **PR-body** sections are handled by the ORCHESTRATOR at harvest time — you (aif) focus on Parts A/B/C + the SSOT entry. Do NOT block on PR-body formatting.

## §AI-traps active (per [.claude/rules/ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

Active: **T2** (build the test, don't just describe it), **T3** (every claim = command output, e.g. paste the RED and GREEN test runs), **T5** (stay in scope — Parts A/B/C only, no drive-by edits), **T15** (Part C self-application proof is mandatory), **T16** (the gate is a FORM-check, not a behaviour-check — name it as such in a comment; do not claim it proves agents *use* their tools).
Domain-specific: **T-M1GATE-A** — «editing the agnostic PROSE body to match CC names». The prose stays harness-neutral; ONLY the `tools:` frontmatter line changes. Touching prose = scope (i) violation.

## Autonomous-dispatch park contract (aif-handoff executor — read this)

You are dispatched autonomously to build Parts A/B/C. Non-negotiable:

**Park-don't-guess:** on ANY genuine fork or ambiguity, do NOT pick — **park it as a question** (set the task to `manualReviewRequired` / `blocked_external`, state it «Option A → consequence X / Option B → consequence Y») and stop; proceed only on the unambiguous parts. Likely-park triggers: (a) a shipped skill's `allowed-tools` uses a name that is neither canonical nor obviously mappable; (b) the principle-test runner needs wiring you're unsure about; (c) an agent's `tools:` contains a name NOT in {read_file, list_files, run_command}. Scope (i) and the read_file/list_files/run_command→Read/Glob/Bash mapping are DECIDED — those are not forks.

**Capability-park:** if you cannot run the test suite (`npm --prefix packages/core run test:principles`) in your environment, park rather than claim GREEN/RED unverified — an unverified gate is `#discipline-theatre`, the exact failure this umbrella exists to kill.

Deliverable = the code changes (Parts A/B/C) + SSOT #121 entry, committed on your task branch. Egress (push/PR with the §1.7 body + Prior-art trailer) is the orchestrator's job via harvest — not yours.

## See also
- `docs/meta-factory/research-patches/2026-06-16-shipped-artifact-liveness.md` §4 (M1 spec) / §5.1 (verdict) / §5.2 (promotion criteria) — the binding research.
- `agents/manual-rule-liveness-prober.md` — the existing prober (Phase 2 will ADAPT it; NOT this task).

```bash host-verify
# Retro-marked 2026-08-21: Part B, the principle test that must catch #551 (shipped as principle 21)
npx vitest run --root packages/core principles/21-shipped-agent-tools-valid.test.ts
```
