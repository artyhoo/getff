# Orchestrator Skill — Glossary

> **Authoritative for:** role definitions (Orchestrator / Worker / Reviewer) and dispatch channel definitions (Mode A / Mode B / Queue mode) as used in Queue mode and all orchestrator skill documentation. Cross-referenced by [[queue-mode.md]], [[worker-template.md]], [[reviewer-template.md]].

## Three roles

**Orchestrator** — the main session (Opus). Owns the queue, `state.md`, dispatch decisions, file-system verification, anti-collusion spot-checks, memory updates, and escalation. Does NOT write artefact content directly; plans, delegates, verifies, accepts.

**Worker** — a subagent (Opus in burn mode) dispatched by Orchestrator to execute exactly one kickoff (or one per-section block of a large kickoff). Writes output files, appends `state.md` progress entries, runs principle tests, and reports RESEARCH-COMPLETE. Does NOT spawn further sub-queues — depth-2 hierarchy is the hard limit.

**Reviewer** — a subagent (Opus) dispatched by Orchestrator AFTER Worker reports complete. Reviews output cold (no shared memory with Worker). Returns GO or REVISE with HARD-FIX list. Does NOT fix; reports only.

## Dispatch channels — Mode A / Mode B / Queue mode

These labels are load-bearing across orchestrator prompts, memory, and kickoffs. **Never coin compound labels** (e.g. «Mode B parallel batch via Agent tool») — each label maps to exactly one mechanism and one quota pool.

| Channel | Mechanism | Quota pool | Use for |
|---|---|---|---|
| **Mode A** | inline `Agent` tool call from Orchestrator session | **Opus** by default; model selectable via `model` param (`fable`/`opus`/`sonnet`) — see SKILL.md «Правило модели для Mode A» | **DEFAULT for everything** — execution (≥2 files / ≥10 lines, `isolation: "worktree"`), research, verification/audit; parallel = N Agent calls in one message (flip 2026-05-21) |
| **Mode B** | file-prompt written to `.claude/orchestrator-prompts/…/*.md`; user opens **separate Sonnet session** and pastes | **Sonnet** (real separation) | **Explicit option, NOT default** — N-window throughput, persistent audit-trail, Opus pool under load (Red zone), or explicit Sonnet-offload request (manual copy-paste cost) |
| **Mode B × N** | N file-prompts → N separate Sonnet windows in parallel | **Sonnet × N** | When live-window N-throughput beats N parallel inline Agent calls |
| **Queue mode** | Task subagent (Opus) via [[queue-mode.md]] Worker + Reviewer protocol | **Opus** | ≥2 sequential research kickoffs with anti-collusion verification |

**Anti-pattern — Frankenstein dispatch:** combining the label of one channel with the mechanism of another. The 2026-05-17 incident labeled 14 inline Agent calls «Mode B parallel batch dispatch» — billing Opus pool while believing Sonnet quota was saved. ~595k tokens billed to Opus, not Sonnet. The skill text was correct (lines 103-124 of SKILL.md); the orchestrator never loaded it.

**Sanity test before any dispatch:** can you complete this sentence without consulting SKILL.md «Дефолт — Mode A» section? → «Mode <X>: mechanism is <inline Agent / file-prompt / Task subagent>, quota bills <Opus / Sonnet> pool.» If not — re-read that section first. Never use Mode A/B labels from memory.

## What is NOT a role

- **Tools** (MCP servers: context7, DeepWiki, WebSearch, WebFetch) — utility helpers available to any role
- **Built-in subagent types** (`claude-code-guide`) — Anthropic-managed helper invoked as a tool-shaped call, not a peer in the hierarchy; used by Workers and Reviewers for Claude Code internals verification
- **Headless dispatch** (`claude -p`) — a dispatch mechanism, not a role; the resulting session acts as a Worker or Reviewer

## Hierarchy depth

**2 levels, period:** Orchestrator → (Worker | Reviewer). Workers do NOT spawn Workers. If a kickoff is too large for one Worker session, the Orchestrator splits it into per-section blocks and dispatches a separate Worker per block.

## See also

- [[queue-mode.md]] — full workflow, dispatch protocol, iteration limits
- [[worker-template.md]] — boilerplate prompt for Worker dispatch
- [[reviewer-template.md]] — boilerplate prompt for Reviewer dispatch
- [[ai-laziness-traps-orchestrator.md]] — T-AO-A through T-AO-L trap catalogue
