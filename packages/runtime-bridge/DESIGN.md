# runtime-bridge — Design sketch + §1.7 self-reflexive check

> **Authoritative for:** SW-B implementation design rationale; §1.7 forward+backward walk.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists).

## Architecture

```text
PostToolUse (CC hook)
  └─ runtime-bridge-dispatch.sh — opt-IN gate: fires ONLY on `<!-- bridge: auto -->` first line (kickoff §7, 2026-05-31)
       └─ cli/dispatch.ts
            ├─ buildKickoffSpec()   — reads kickoff.md; opt-in default (requireAutoMarker: true);
            │                         dispatch.ts opts out for the manual path; bridge:skip always blocks
            ├─ checkDedup()         — SHA-256 content hash, 24h TTL JSONL log
            ├─ resolveBackend()     — RUNTIME_BRIDGE_MODE env + available() probes
            │    ├─ AifHandoffBackend  (3-step planner-skip via MCP)
            │    └─ ManualBackend      (always-tail; /tmp paste flow)
            └─ dispatch() + recordDispatch()
```

## NC-1 MCP Schema Discovery Result

- **Tool**: `handoff_create_task` — source: `packages/mcp/src/tools/createTask.ts`
- **`accept_existing_plan` does NOT exist** — kickoff assumption was incorrect
- **Planner-skip pattern** (3-step): create(paused:true) → push_plan → sync_status(plan_ready)
- **`handoff_push_plan`** — source: `packages/mcp/src/tools/pushPlan.ts` — injects plan content
- **`handoff_sync_status`** — source: `packages/mcp/src/tools/syncStatus.ts` — transitions status
- Feasibility: **YES** — pattern is fully available in shipped MCP API

## §N §1.7 self-reflexive check

### Forward (does SW-B comply with existing disciplines?)

- **`build-first-reuse-default.md`:** Pre-A (PR #286) confirmed no upstream covers cross-session dispatch. BUILD verdict from Pre-A + SW-A. AifHandoffBackend ADAPTs aif-handoff's MCP API; ManualBackend is plain TS. ✓
- **`no-paid-llm-in-ci.md`:** zero API-billed LLM calls — all dispatch paths are deterministic TS/bash. ManualBackend writes /tmp files; AifHandoffBackend calls aif-handoff via HTTP (subscription-bundled per SW-A, not API-metered). ✓
- **`dual-implementation-discipline.md §3`:** hook is internal-only tooling (not shipped to consumer projects via install.sh in SW-B); CC-native only is the correct default per §3 «Internal tooling». `@cc-only-rationale` marker present in the hook file. ✓
- **`reviewer-discipline.md §2`:** adapter does NOT pick project strategy. ManualBackend always available; strategy pick (which backend) is via env var set by maintainer. ✓
- **`phase-research-coverage.md §1.7`:** this section is the self-reflexive walk. ✓
- **`doc-authority-hierarchy.md §3`:** DESIGN.md has Authoritative-for + NOT authoritative-for header. ✓
- **`CLAUDE.md Build-vs-reuse + Prior-art trailer`:** commit will carry `Prior-art:` trailer citing SSOT #27/#28/#30/#44/#67/#84 + Pre-A + SW-A patches. ✓
- **DECISION=C invariant:** `packages/core` imports NOTHING from `packages/runtime-bridge`. Adapter is opt-in. ✓

### Backward (what existing artefacts does SW-B affect?)

- **`.claude/settings.json`**: NOT modified (NC-3 — agent-self-protected; snippet in PR body for maintainer-apply). ✓
- **`packages/core/`**: NO changes. DECISION=C substrate-independence preserved. ✓
- **`.claude/rules/*.md`**: NO changes. ✓
- **Predecessor research patches**: NOT modified; cited in Prior-art trailer. ✓
- **NEW artefacts** (acknowledged per kickoff §10 backward bullet):
  - `packages/runtime-bridge/` — new workspace package
  - `.claude/hooks/runtime-bridge-dispatch.sh` — new PostToolUse hook
  - PR body «Maintainer apply manually» section — settings.json PostToolUse entry snippet

## NC-3 scope history (2026-05-31)

**Original (round-6):** NC-3 = "print, don't auto-write settings.json" — the setup
script only printed the PostToolUse JSON snippet for the consumer to paste by hand,
because `settings.json` was described as "agent-self-protected".

**Scoped 2026-05-31:** NC-3 applies only to the *AI agent's tool calls*. The
`"Edit(.claude/settings.json)"` / `"Write(.claude/settings.json)"` entries in
`.claude/settings.json` are Claude Code *tool-permission* deny-list entries — they
block the agent's Edit/Write tool invocations, not filesystem writes made by a
human-run shell script. Therefore:

- **Agent deny-list stays intact** — the agent must never write `settings.json` via
  its Edit/Write tools.
- **Human-run consumer setup script** (`packages/runtime-bridge/scripts/
  setup-runtime-bridge.sh`) **may** write `settings.json` with:
  - explicit user consent (Y/n sub-prompt, or `--no-write-settings` to skip),
  - idempotency check (skip if runtime-bridge entry already present),
  - backup to `settings.json.bak` before writing,
  - JSON validation before atomic swap,
  - when declined, `--no-write-settings` passed, python3 absent or the write failed: a
    «NOT written» fact with the reason, never a snippet to paste (Q4.7, 2026-09-28).

**Tracked here because** the original NC-3 decision lived in
`.claude/orchestrator-prompts/` (gitignored); this DESIGN.md is the repo-tracked
rationale home for the scoping.

### Self-reflexive (T15)

- T1: negative-existence claim («no `accept_existing_plan`») verified by reading createTask.ts + pushPlan.ts + syncStatus.ts + updateTask.ts + index.ts — 5 files, ≥5 samples. ✓
- T3: MCP schema findings cited with `gh api URL + file:line` in AifHandoffBackend.ts. ✓
- T7: adversarial counter-prompt applied — «could accept_existing_plan be in a different tool?» — checked all 11 tool files (annotatePlan, createTask, getTask, listProjects, listTasks, pushPlan, runtimeTaskMetadata, searchTasks, syncStatus, updateTask, index). Not found. ✓
- T16: upstream problem class = «aif-handoff MCP task management API»; our problem class = «planner-skip dispatch via 3-step MCP sequence». Match: partial — requires 3-step instead of 1-step but feasible. ✓
- T15: this section is the self-application. ✓
- T20: no inline verdict without tool evidence — MCP schema findings backed by `gh api` reads. ✓
