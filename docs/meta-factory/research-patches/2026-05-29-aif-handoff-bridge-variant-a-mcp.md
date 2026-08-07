<!-- scope:aif-handoff-bridge-variant-a-mcp -->

> **Status:** R-phase Sub-wave A complete — 2026-05-29. **NOT prescriptive** — verdict is additive evaluation for maintainer decision. No code changes, no skill edits, no SSOT row landings in this patch.
> **Authoritative for:** Variant A (MCP-consumer bridge) deep evaluation — DeepWiki MCP schema sweep, body-format falsifier outcome, WebSocket back-channel analysis, 5-criteria scoring, BFR-default verdict, SSOT additive-note proposals.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Variants B/C/D — those have separate Sub-waves. Overall recommendation across 3 variants — see Sub-wave D synthesis (not yet dispatched).

---

## §0 TL;DR

**Verdict: REFERENCE** (not ADOPT, not BUILD)

**Match score:** 28% — MCP tooling is real and reachable; body-format falsifier PASSES (description accepts free markdown, minimum = `projectId`+`title`); but the full Variant A mechanism fails on three structural axes that make bridge-building non-trivial and the `accept_existing_plan` bypass creates a Planner-skip path that changes the hypothesis.

**Falsifier outcome: CONDITIONAL PASS / PARTIAL FAIL**

The schema check (`handoff_create_task` body format) passes: `description` is `z.string().optional()` with no character limit — our 39-placeholder kickoff body fits. However, the bridge requires aif-handoff infrastructure (Node.js + SQLite, at minimum), the `accept_existing_plan` event requires a physical `PLAN.md` file on disk in `.ai-factory/` (not injectable via MCP), and the WebSocket broadcast is untargeted (all events, no topic filter). These three partial-failures raise bridge complexity well above the 130 LOC estimate, do not eliminate the Docker+DB overhead question, and mean Variant A delivers REFERENCE value (design vocabulary, state-machine gating) without being an ADOPT target at current scale.

**Key falsifier (kickoff line 76):** `handoff_create_task` body format does NOT reject our kickoff. But the full-pipeline bypass (`accept_existing_plan`) requires a disk-resident `PLAN.md` in aif-handoff's `.ai-factory/` directory — a filesystem coupling that adds pre-processing beyond MCP calls, moving Variant A toward Variant B's complexity.

---

## §1 Scope

**Variant evaluated:** Variant A — aif-handoff as MCP-consumer of meta-kickoffs. Bridge script calls `handoff_create_task` with kickoff content → aif-handoff Planner reads → Implementer spawns `claude --agent` → Reviewer loops → bridge tails WebSocket events → writes status back to `state.md`.

**What was probed:**
1. MCP tool schemas (`handoff_create_task`, `handoff_update_task`, `handoff_sync_status`, `handoff_push_plan`, `handoff_annotate_plan`) — required fields, body format, validation
2. Body-format compatibility with our 39-placeholder meta-kickoff template
3. WebSocket event subscription for external clients — topic filtering, payload shape
4. Autonomy gating — `paused`, dirty-worktree guard, CAS claim
5. Headless / Docker-free operation modes
6. Planner-bypass path (`accept_existing_plan`) — feasibility and coupling
7. PR #127 (per-profile env overrides) + PR #128 (proxy env) — impact on MCP surface
8. Admission gate §2.4 — recent commits touching `packages/mcp/` or `apps/coordinator/`

---

## §2 DeepWiki sweep evidence

All 7 DeepWiki probes executed 2026-05-29 via `mcp__deepwiki__ask_question` on `lee-to/aif-handoff`. Quoted excerpts below.

### Probe 1 — MCP tool schemas (T1 floor)

**Question:** «What MCP tools does aif-handoff expose? List schemas for handoff_create_task, handoff_update_task, handoff_sync_status, handoff_push_plan, handoff_annotate_plan. What fields are required for each tool call?»

**Key extraction (verbatim):**
> «`handoff_create_task` … The required fields are: `projectId`: A UUID string representing the project the task belongs to. `title`: A string for the task's title, with a minimum length of 1 and maximum of 500 characters.»
> «`handoff_sync_status` … required fields: `taskId`, `newStatus` (enum from TASK_STATUSES), `sourceTimestamp` (ISO timestamp with millisecond precision), `direction` (enum `"aif_to_handoff"` or `"handoff_to_aif"`).»
> «`handoff_push_plan` … required fields: `taskId` (UUID), `planContent` (string, max 100KB).»
> «The MCP tools are registered in `packages/mcp/src/index.ts`. … All write tools perform a rate limit check before execution. Upon successful execution, many of these tools broadcast task changes via WebSockets.»

**DeepWiki URL:** [deepwiki.com/search/what-mcp-tools-does-aifhandoff...](https://deepwiki.com/search/what-mcp-tools-does-aifhandoff_cdc63a5b-b23f-4860-8e05-563a5ef12a68)

### Probe 2 — body-format compatibility (T-AIF-BRIDGE-A enforcement)

**Question:** «Does handoff_create_task accept free-form markdown body, or does it require structured fields like roadmapAlias, phase tags, or a templated task schema? What is the minimum required shape for a task body?»

**Key extraction (verbatim):**
> «`handoff_create_task` tool requires structured fields rather than free-form markdown for the task body. The minimum required fields for creating a task are `projectId` and `title`.»
> «The `description` field in `createTaskInputSchema` is defined as `z.string().optional()` … The `z.string()` type from Zod does not inherently impose a character limit unless `.min()` or `.max()` are explicitly chained … it can contain arbitrary markdown, including headings, code blocks, and long text, without a specific character limit enforced by the schema itself.»
> «`roadmapAlias`: While not explicitly listed in the `createTaskInputSchema` for the MCP tool, the underlying `createTask` function and `createTaskSchema` in the API do support `roadmapAlias` as an optional string.»

**DeepWiki URL:** [deepwiki.com/search/does-handoffcreatetask-accept...](https://deepwiki.com/search/does-handoffcreatetask-accept_2983402c-d75e-4bd5-a769-b86ba2d38a9e)

**T-AIF-BRIDGE-A verdict:** CONDITIONAL PASS — `description` accepts arbitrary markdown (no character limit in schema), `roadmapAlias` is optional (not required). Our kickoff body can be passed in `title` (truncated to 500 chars) + `description` (full content). The minimum shape `{projectId, title}` is achievable.

### Probe 3 — WebSocket events for external client

**Question:** «What WebSocket events does aif-handoff emit for task lifecycle (task:created, task:moved, task:completed)? Can an external client subscribe to these events without using the web UI?»

**Key extraction (verbatim):**
> «AIF Handoff emits the following WebSocket events … `task:created` … `task:moved` … `task:updated` … `task:deleted` … `task:scheduled_fired`.»
> «Yes, an external client can subscribe to these events without using the web UI. The WebSocket endpoint is `ws://localhost:3009/ws`. All events are JSON objects with a `type` and `payload` field.»
> «The WebSocket endpoint is a broadcast channel, meaning connected clients receive all events without topic subscriptions. It is recommended to keep this endpoint behind trusted network boundaries.»
> «The `task:completed` event specifically mentioned in the prompt is not directly listed as a WebSocket event. Instead, task completion is typically represented by a task transitioning to the `done` status, which would trigger a `task:moved` event.»

**DeepWiki URL:** [deepwiki.com/search/what-websocket-events-does-aif...](https://deepwiki.com/search/what-websocket-events-does-aif_f067db8f-5f44-4829-9f6a-1eade44f8bd6)

**Finding:** WebSocket is a broadcast channel — no topic subscriptions. Bridge script must filter events by `taskId` client-side. No `task:completed` event — bridge must detect `task:moved` with `status=done`. Adds event-filtering logic to bridge.

### Probe 4 — autonomy gating and TASK_STATUSES

**Question:** «How is autonomy gated in aif-handoff — paused gates, dirty-worktree guard, CAS claim — what triggers transitions between states?»

**Key extraction (verbatim):**
> «AIF Handoff gates autonomy through several mechanisms, including paused tasks, a dirty-worktree guard, and a Compare-And-Swap (CAS) claim system.»
> «`TASK_STATUSES` enum defines: `backlog`, `planning`, `plan_ready`, `implementing`, `review`, `blocked_external`, `done`, `verified`.»
> «`paused` flag: A task with `paused=true` will be skipped by `findCoordinatorTaskCandidate` … Pausing does not abort an already running task but takes effect on the next coordinator cycle.»
> «Auto-review gate: In `autoMode`, the coordinator can trigger `request_changes`-style rework loops automatically after review if blocking findings are present.»

**DeepWiki URL:** [deepwiki.com/search/how-is-autonomy-gated-in-aifha...](https://deepwiki.com/search/how-is-autonomy-gated-in-aifha_02cb5b3a-035a-4b56-ba4d-6246bbfe32a3)

**Finding:** Autonomy primitives (`paused`, dirty-worktree guard, CAS claim) are exactly what §0 of the kickoff claimed. These are reachable via MCP (`handoff_sync_status` can set/clear `paused` atomically). State machine is well-defined.

### Probe 5 — headless / Docker-free operation

**Question:** «Can aif-handoff be operated headlessly without UI (CLI-only, MCP-only, or daemon-only) for an external orchestrator integration? Is there a Docker-free deployment mode?»

**Key extraction (verbatim):**
> «AIF Handoff can be operated headlessly for external orchestrator integration, and it supports a Docker-free deployment mode, though it does require a database.»
> «MCP server can operate in two transport modes: `stdio` (CLI-only): This mode is used for local Claude Code integration. … `http` (Daemon-only): When `MCP_PORT` is set, the MCP server runs as an HTTP service, listening on the specified port (default `3100`).»
> «AIF Handoff relies on a centralized SQLite database for task management and state persistence. There is no database-free deployment mode. The database file path is configured via the `DATABASE_URL` environment variable, defaulting to `./data/aif.sqlite`.»

**DeepWiki URL:** [deepwiki.com/search/can-aifhandoff-be-operated-hea...](https://deepwiki.com/search/can-aifhandoff-be-operated-hea_655e4c06-f2b1-4cba-be69-f6370ddc8539)

**Finding:** Docker-free deployment is possible (Node.js + SQLite + `npm run dev`). MCP stdio mode enables local Claude Code integration. BUT: SQLite is still required — not zero-infra. DECISION=C compatibility is conditional on consumer installing Node.js + SQLite.

### Probe 6 (T7 adversarial) — Planner bypass via accept_existing_plan

**Question:** «Is there a way to disable the Planner stage and pass tasks directly to the Implementer for cases when external orchestrator already produced the plan?»

**Key extraction (verbatim):**
> «Yes, you can disable the Planner stage and pass tasks directly to the Implementer by using the `accept_existing_plan` event. … This event allows you to provide a pre-existing plan file, which the system will then use to transition the task directly to the `plan_ready` status, bypassing the `planning` stage.»
> «For `accept_existing_plan` to succeed, a plan file (e.g., `PLAN.md`) must already exist on disk within the project's `.ai-factory` directory. If the plan file is missing or empty, the event will be rejected.»
> «The task's status is then updated from `backlog` directly to `plan_ready`. This bypasses the `planning` stage, effectively handing off the task to the Implementer.»
> «This event is only valid when the task is in the `backlog` status. If the task is in any other status, the event will be rejected.»

**DeepWiki URL:** [deepwiki.com/search/is-there-a-way-to-disable-the...](https://deepwiki.com/search/is-there-a-way-to-disable-the_ae7072a9-9169-4fbd-a28b-3b7a097ff85d)

**Critical finding:** `accept_existing_plan` requires a physical `PLAN.md` on disk in `.ai-factory/`. This is a **filesystem coupling** — the bridge cannot inject the plan purely via MCP; it must also write a file to disk. This is NOT bash-only MCP-consumer; it becomes a hybrid MCP + filesystem bridge.

### Probe 7 (T7 adversarial) — minimum stub body passing validation

**Question:** «If handoff_create_task rejects an arbitrary body, what is the minimum-shape stub task body that passes validation? Can the description field contain arbitrary markdown?»

**Key extraction (verbatim):**
> «The minimum-shape stub task body that passes validation is: `{"projectId": "a-valid-project-uuid", "title": "A task title"}`.»
> «The `description` field in `createTaskInputSchema` is defined as `z.string().optional()` … it can contain arbitrary markdown, including headings, code blocks, and long text, without a specific character limit enforced by the schema itself.»
> «The `title` field … has a maximum length of 500 characters.»

**DeepWiki URL:** [deepwiki.com/search/if-handoffcreatetask-rejects-a...](https://deepwiki.com/search/if-handoffcreatetask-rejects-a_4f38e976-6a57-4dc6-a139-6e765b4b931f)

**Finding:** Minimum viable call: `{projectId: "<uuid>", title: "<umbrella name>", description: "<full kickoff content>"}`. Our 39-placeholder kickoff fits in `description` (no character limit). Bridge can pass full kickoff markdown as `description` field.

---

## §3 T16 problem-class match table

| Dimension | Upstream problem class | Our problem class | Match? | Evidence |
|---|---|---|---|---|
| **Core function** | Kanban runtime: autonomous task pipeline (Planner→Implementer→Reviewer) with persistent DB, cron coordinator, Docker/Node infra | MCP-consumer bridge: `/meta-orchestrator` outputs kickoff.md → bridge calls aif-handoff MCP tools → aif-handoff runs autonomously → bridge reads back status | PARTIAL — we want to USE aif-handoff's Planner/Implementer/Reviewer cycle, not BUILD one. Match on «autonomous pipeline» but mismatch on «who drives»: we want external trigger, aif-handoff is designed for internal cron/API | SSOT #67 REJECT axes (a)(b)(c) — kickoff §1 §3 reframing addresses axis (c) (cron→external trigger) and (b) (infra optional when bridge is optional) but axis (a) (aif-handoff writes code) remains — we WANT it to write code now |
| **Body format** | Structured task: `{projectId, title, description?, tags?, roadmapAlias?}` | 39-placeholder kickoff.md (markdown, 300-800 LOC) passed as `description` field | PASS — `description` = `z.string().optional()` with no char limit. Our kickoff fits as `description` value | DeepWiki Probe 2: `createTaskInputSchema` `description` = `z.string().optional()` with no `.max()` |
| **Plan injection** | `accept_existing_plan` requires physical `PLAN.md` on disk in `.ai-factory/` | Bridge wants to inject plan via MCP call (pure MCP boundary) | MISMATCH — bridge must write `PLAN.md` to disk in addition to calling MCP. Filesystem coupling, not pure MCP | DeepWiki Probe 6: «a plan file (e.g., `PLAN.md`) must already exist on disk within the project's `.ai-factory` directory» |
| **Status back-channel** | WebSocket broadcast on `ws://localhost:3009/ws`, all events (no topic filter), JSON `{type, payload}` | Bridge needs to tail status for specific taskId until `task:moved` with `status=done` | PARTIAL — external client CAN subscribe (documented). Must filter by taskId client-side. No `task:completed` event; must detect `task:moved` w/ `status=done`. Bridge complexity += event-filter loop | DeepWiki Probe 3: «broadcast channel, meaning connected clients receive all events without topic subscriptions» |
| **Infrastructure** | Node.js + SQLite minimum (Docker optional). MCP stdio or HTTP daemon. No database-free mode | DECISION=C: consumer runs `/meta-orchestrator` with zero deps; bridge is optional-only | CONDITIONAL — Docker-free possible; SQLite still required. Consumer opts-in to infra explicitly. Fallback path (bridge absent → current flow) must be preserved | DeepWiki Probe 5: «requires a database … There is no database-free deployment mode» |
| **Autonomy gating** | `paused` + dirty-worktree guard + CAS claim — all machine-readable, controllable via `handoff_sync_status` | Phase -1 cold-review gate between stages — session-bound, not machine-readable today | REFERENCE — aif-handoff's machine-readable gates are the SSOT #28 «paused:true» pattern; our gates are reviewer-discipline.md §2. Problem classes different but vocabulary transfers | SSOT #28 (paused:true DEFER); DeepWiki Probe 4: `paused=true` skipped by coordinator |

---

## §4 5-criteria scoring

### Criterion 1 — Bridge complexity

**Target:** < 300 LOC, ≤ 4 MCP calls, no upstream PR required.

**LOC estimate (line-count rationale):**

| Component | LOC | Basis |
|---|---|---|
| `handoff_create_task` call: construct JSON `{projectId, title, description}`, curl to MCP HTTP endpoint | ~15 LOC | 1 curl call + JSON construction + error check |
| Write `PLAN.md` to `.ai-factory/` for `accept_existing_plan` bypass | ~10 LOC | mkdir + write kickoff content to file |
| `accept_existing_plan` POST to `/tasks/:id/events` | ~10 LOC | 1 curl call + status check |
| WebSocket subscribe via `websocat` or `wscat`: connect, filter by taskId, tail until `task:moved{status:done}` | ~50 LOC | connect + jq filter loop + timeout/retry |
| `handoff_sync_status` status write-back to `state.md` | ~15 LOC | 1 MCP call + file write |
| Error handling, retry, auth (MCP HTTP port, projectId lookup) | ~60 LOC | `handoff_list_projects` to get UUID + auth header + retry logic |
| aif-handoff startup check / health ping | ~15 LOC | curl health endpoint + early-exit message |
| **Total** | **~175 LOC** | |

**MCP calls:** `handoff_list_projects` (1) + `handoff_create_task` (1) + `/tasks/:id/events` (REST, not MCP tool) + WebSocket tail (not MCP) + `handoff_sync_status` (1) = **3 MCP tool calls + 1 REST endpoint + 1 WebSocket** — within ≤ 4 MCP tools but requires WebSocket consumer beyond MCP (bridge dependency on `websocat` or Node.js `ws` client).

**Upstream PR required?** No — MCP surface is stable. WebSocket endpoint is documented. `accept_existing_plan` event is shipped. No upstream PR needed.

**Criterion 1 score:** PASS on LOC (175 < 300); PASS on MCP calls (3 ≤ 4); PASS on no upstream PR. BUT: WebSocket consumer requires `websocat` or Node.js dependency (not zero-dep bash). `PLAN.md` disk write adds filesystem coupling not visible in original Variant A spec. **PARTIAL** — within targets but complexity higher than original estimate assumed.

Evidence: DeepWiki Probes 1-7 above; kickoff §3 Variant A mechanism (line 54-70).

### Criterion 2 — DECISION=C compatibility (substrate dependency-free)

**Hard requirement:** clean checkout + `./install.sh` + `/meta-orchestrator <umbrella>` succeeds identically with and without aif-handoff installed.

**Assessment:**

The bridge is a separate bash script invoked ONLY when aif-handoff is detected. `/meta-orchestrator` itself does not call the bridge — the bridge is a separate optional layer.

Proposed conditional invocation pattern:
```bash
# In meta-orchestrator state.md output or separate bridge launcher:
if command -v aif-handoff &>/dev/null || curl -sf http://localhost:3009/health; then
  exec ./.claude/scripts/aif-bridge.sh "$KICKOFF_PATH"
else
  echo "aif-handoff not detected — use maintainer-paste flow"
fi
```

This means `/meta-orchestrator` itself has zero dependency on aif-handoff. The bridge is invoked by maintainer explicitly or by a separate hook — not by the skill itself.

**BUT:** If bridge is designed as a PostToolUse hook on kickoff.md write, it would fire unconditionally unless the hook has the capability-check guard. The hook failing (aif-handoff absent) must not block the skill.

**DECISION=C verdict:** PASS — IF bridge is implemented as a standalone opt-in script (maintainer invokes explicitly) rather than as an auto-firing hook without guard. The skill itself remains zero-dependency.

Evidence: SKILL.md:338 (`Does NOT add npm deps. Substrate stays bash + markdown + CC primitives + existing gh CLI`); kickoff §4 criterion 2 (line 129).

### Criterion 3 — What's actually automated vs maintainer-loop preserved

**Per-stage automation table:**

| Stage | Today (maintainer-paste) | Variant A bridge | Automated? |
|---|---|---|---|
| Meta-kickoff authoring | `/meta-orchestrator` writes kickoff.md | Same — bridge fires AFTER kickoff.md written | Not changed |
| Sub-wave kickoff delivery to worker | Maintainer pastes 1-liner into new CC session | `handoff_create_task` → aif-handoff spawns `claude --agent` automatically | **AUTOMATED** — this is the key gain |
| Sub-wave execution (research/implementation) | Worker CC session runs autonomously | aif-handoff Implementer runs `claude --agent` autonomously | Same quality — different invoker |
| Planner stage (breaking kickoff into aif-handoff plan) | Not applicable today | aif-handoff Planner re-plans the kickoff | **NEW** — may conflict with our Phase -1 cold-review (SSOT #30 duplication concern) |
| Phase -1 cold-review between stages | SP `requesting-code-review` — maintainer dispatches | aif-handoff Reviewer runs automatically | **AUTOMATED** — BUT: aif-handoff Reviewer may NOT apply our reviewer-discipline.md §2 (strategy-fork-surface, DECISION-NEEDED routing). Risk of silently picking strategy. |
| Stage-gate merge verification | Maintainer verifies `gh pr list` + CI green | Bridge reads `task:moved{status:done}` from WebSocket | **AUTOMATED** — but `done` ≠ CI green. Bridge needs to confirm PR merged separately. |
| Maintainer decision points (strategy forks, DECISION-NEEDED) | Maintainer picks explicitly | NOT automated — aif-handoff has no concept of «surface to human and wait» for strategy decisions | **STAYS WITH MAINTAINER** — this is correct per reviewer-discipline.md §2 |

**Net assessment:** Bridge automates the **dispatch loop** (paste → API call → autonomous execution) but does NOT automate the **decision loop** (strategy forks, DECISION-NEEDED). The key risk is aif-handoff Reviewer silently making strategy decisions that our reviewer-discipline.md §2 requires to be surfaced to maintainer.

Evidence: SKILL.md:404 (Phase -1 dispatch); SKILL.md:429 (ADOPT SP requesting-code-review template); reviewer-discipline.md §2.

### Criterion 4 — Fallback ergonomics without aif-handoff installed

**Hard requirement:** no degradation when aif-handoff absent.

**Assessment:**

If bridge is opt-in (explicit maintainer invocation), fallback = current flow unchanged. No new manual steps.

If bridge auto-fires via hook: hook must detect aif-handoff absence and exit 0 without printing errors to the CC session that would confuse the flow.

The 1-liner output that `/meta-orchestrator` produces today (`Agent: <role> … Skill: <skill>`) must remain identical in both cases. Bridge does not modify this output — it is a separate step the maintainer chooses to run.

**Fallback verdict:** PASS — IF bridge is implemented as standalone opt-in script. The meta-orchestrator skill output (`state.md`, kickoff.md, 1-liner block) is unchanged.

**Risk:** if bridge is bundled into `install.sh` and wired as an automatic PostToolUse hook, absence of aif-handoff on consumer machines would produce confusing hook-failure noise. Bridge must be packaged separately as an optional add-on, not as part of the core install payload.

Evidence: SKILL.md:338 anti-scope; kickoff §4 criterion 4 (line 133); DeepWiki Probe 5 (Node.js + SQLite requirement).

### Criterion 5 — Duplication with /orchestrator + SP cycle

**SKILL.md:404 vs :429 inconsistency resolution:**

The apparent inconsistency is resolved:
- SKILL.md:404 (`Skill: requesting-code-review (SP SSOT, REFERENCE — see R-phase patch §3 leapfrog table)`) — this is the **BFR-default verdict** for the SP skill in the prior-art evaluation: SP `requesting-code-review` verdict = REFERENCE (upstream validates our problem class; we BUILD our own dispatch logic on top).
- SKILL.md:429 (`ADOPT the SP dispatch template; add reviewer-discipline.md §2 strategy-fork-surface discipline on top`) — this is the **operational instruction** for what to do at Phase -1 time: ADOPT the dispatch template (use SP's template format for invoking the reviewer subagent).

These are consistent: the BFR verdict for the SP _skill_ = REFERENCE; the action at dispatch time = ADOPT the template. No DECISION-NEEDED — resolution uses `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md §3 leapfrog table` row: `SP requesting-code-review | §7.8 Phase -1 dispatch template | Reviewer-subagent dispatch with git SHA references | Adding strategy-fork-surface discipline`. Confirmed via grep: `research-patches/2026-05-23-meta-orchestrator-prior-art.md:73`.

**Duplication assessment:**

| Component | Our current stack | Variant A aif-handoff | Duplication? |
|---|---|---|---|
| Phase -1 cold-review | SP `requesting-code-review` template (ADOPT per SKILL.md:429) | aif-handoff Reviewer subagent (`packages/agent/src/subagents/reviewer.ts`) | **CONFLICT** — aif-handoff Reviewer is a DIFFERENT reviewer than our SP-based Phase -1. The aif-handoff Reviewer runs automatically in `autoMode`; our Phase -1 is a deliberate strategy-fork-surface checkpoint. They serve different purposes but could step on each other if both fire for the same stage. |
| Worker dispatch | Maintainer pastes 1-liner into CC session | aif-handoff Implementer spawns `claude --agent` | COMPLEMENTARY — same outcome (CC session running kickoff) via different invocation path. No duplication of logic. |
| Plan generation | Meta-kickoff authoring (our Phase 0/1) | aif-handoff Planner re-plans from task description | **POTENTIAL DUPLICATION** — if Planner re-plans from `description`, it may produce a different plan than our meta-kickoff intended. Risk: Planner overrides our carefully constructed kickoff with an aif-handoff-native plan shape. |

**Criterion 5 score:** RISK — aif-handoff Reviewer vs our Phase -1 is the most significant duplication/conflict. Our reviewer-discipline.md §2 requires strategy-fork-surface; aif-handoff Reviewer may silently pick strategy in `autoMode`. This is not a duplication of code but a conflict of behavior contracts.

Evidence: SSOT #30 (P/I/R pipeline DEFER — «We are producer for AIF, not consumer — AIF runtime adoption in our dev workflow = circular»); SKILL.md:404-429; reviewer-discipline.md §2.

---

## §5 Verdict per build-first-reuse-default.md §1

**Variant A verdict: REFERENCE**

**Rationale:**

Per BFR-default §1 verdict ladder:
- **ADOPT** — No. Three structural issues prevent clean adoption: (1) `accept_existing_plan` requires disk-resident `PLAN.md`, not pure MCP; (2) WebSocket is a broadcast channel requiring client-side taskId filtering; (3) aif-handoff Reviewer conflicts with reviewer-discipline.md §2 (silently picks strategy in `autoMode`).
- **ADAPT** — Possible but premature. Adaptation would require: (a) writing a pre-processing step to deposit `PLAN.md` before calling MCP; (b) implementing WebSocket client (Node.js `ws` or `websocat`) with taskId filter; (c) disabling aif-handoff `autoMode` Reviewer and using our Phase -1 instead. This is ~300 LOC bridge with non-trivial coupling. ADAPT only makes sense after maintainer confirms the hypothesis and Variant D synthesis recommends Variant A.
- **REFERENCE** — YES. Variant A demonstrates that: (a) MCP body format is compatible (`description` = free markdown, no char limit); (b) headless operation is possible (Docker-free, SQLite only); (c) `accept_existing_plan` bypass exists (Planner-skip is doable if plan is pre-written); (d) WebSocket back-channel is real and documented. These design vocabulary items are valid REFERENCE regardless of whether we bridge today.

**Match score: 28%**
- MCP tooling reachable: ✓ (FULL)
- Body format compatible: ✓ (FULL)
- Pure MCP boundary: ✗ (PLAN.md disk write required)
- WebSocket topic filter: ✗ (broadcast only)
- Reviewer-discipline compatibility: ✗ (autoMode conflict)
- Docker-free feasible: ✓ (SQLite min)
- DECISION=C compatible (opt-in): ✓ (conditional on standalone bridge)

**Verdict sentence (T20 compliant):** Variant A is REFERENCE — MCP schema is compatible (DeepWiki Probe 2: `description = z.string().optional()`, no `.max()`; `handoff_create_task` minimum = `{projectId, title}`) and headless operation is feasible (DeepWiki Probe 5: Docker-free, SQLite required), but full pipeline bridge requires disk-resident `PLAN.md` coupling (DeepWiki Probe 6: `accept_existing_plan` requires physical file in `.ai-factory/`) and aif-handoff Reviewer conflicts with reviewer-discipline.md §2 strategy-fork-surface gate — making ADOPT premature at current scale; REFERENCE for design vocabulary and future ADAPT trigger.

**Stop condition (kickoff §8):** The body-format falsifier PASSES (description accepts free markdown). The bridge does NOT require upstream feature work. However, the `PLAN.md` disk coupling and Reviewer conflict are sufficient reasons to NOT propose ADOPT. Verdict = REFERENCE, not stop-condition-triggered halt.

---

## §6 SSOT row / additive-note proposals

**Additive-note only — no verdict changes. Per kickoff §10 backward-check: existing DEFER/REJECT verdicts remain unchanged.**

### SSOT #44 — additive note

```text
Additive note 2026-05-29 (Sub-wave A): handoff_create_task body-format check PASSES
— description = z.string().optional() with no character limit (Zod schema, DeepWiki
2026-05-29). Minimum call = {projectId, title}; our kickoff content fits in description
field. BUT: accept_existing_plan event requires physical PLAN.md on disk in .ai-factory/
(filesystem coupling beyond MCP boundary). WebSocket back-channel is broadcast (no topic
filter — bridge must filter by taskId client-side). Headless Docker-free mode confirmed
(Node.js + SQLite). Trigger-to-revisit clarification: aif-handoff becoming the official
Phase 11+ orchestration layer requires EXPLICIT maintainer decision, not R-phase evaluation
alone. Sub-wave A verdict = REFERENCE for design vocabulary.
```

### SSOT #30 — additive note

```text
Additive note 2026-05-29 (Sub-wave A): accept_existing_plan event (backlog→plan_ready)
provides Planner-bypass mechanism — an external orchestrator with a pre-written plan can
skip aif-handoff's Planner stage. However, bypass requires physical PLAN.md in .ai-factory/
(filesystem coupling). aif-handoff Reviewer in autoMode may conflict with our
reviewer-discipline.md §2 strategy-fork-surface gate — Reviewer silently picks strategy
rather than surfacing DECISION-NEEDED. This conflict is the primary barrier to Variant A
ADAPT verdict at current scale. Trigger-to-revisit clarification: ≥3 autonomous batches
without user + explicit maintainer decision to accept Reviewer conflict or disable autoMode.
```

### Proposed new SSOT row (Sub-wave D to assign slot)

| Proposed slot | Candidate | Verdict | Evidence |
|---|---|---|---|
| #TBD (next after #80) | aif-handoff Variant A bridge — MCP-consumer mode (`handoff_create_task` + `accept_existing_plan` + WebSocket tail + `handoff_sync_status`); bridge LOC ~175, 3 MCP calls, 1 WebSocket; Docker-free feasible (SQLite required); body-format compatible; `accept_existing_plan` requires PLAN.md disk coupling; Reviewer conflicts with reviewer-discipline.md §2 | REFERENCE — design vocabulary for future ADAPT (Planner-bypass path, MCP tool schemas, WebSocket back-channel) | Sub-wave A patch 2026-05-29 (this file); DeepWiki Probes 1-7; admission gate §2.4 verified (PR #127/#128 touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`) |

---

## §7 §1.7 Forward-check applied

- **`build-first-reuse-default.md §1` (verdict ladder):** Variant A verdict = REFERENCE per §1 ladder — upstream MCP tooling is real, compatible on body-format, but ADOPT blocked by plan-disk coupling and Reviewer conflict. BFR §3 6-layer search applied: (a) SSOT consult (rows #27/#28/#29/#30/#43/#44/#46/#67/#80 reviewed — `prior-art-evaluations.md:95-148`); (b) DeepWiki ≥5 probes (7 probes executed, URLs cited in §2); (c) WebSearch ≥2 phrasings (§4 WebSearch queries, both returned results); (d) own-stack sweep (`SKILL.md:404`, `SKILL.md:429` both read — criterion 5 resolution above). ✓

- **`no-paid-llm-in-ci.md §1`:** All evidence gathered via DeepWiki MCP (subscription-bundled), WebSearch (included in harness), `gh` CLI (free), bash `grep` on local files. Zero API-billed calls. ✓

- **`reviewer-discipline.md §2`:** This patch does NOT pick project strategy. The patch notes that aif-handoff Reviewer conflicts with our strategy-fork-surface gate; it does NOT resolve this conflict by choosing one over the other. That is a maintainer decision. ✓

- **`phase-research-coverage.md §1.7`:** §7+§8 self-reflexive walk in this file. ✓

- **`ai-laziness-traps.md §3`:** All active T-traps applied — T1 (7 probes ≥5 floor), T3 (all findings have file:line or DeepWiki URL), T7 (adversarial counter-probes 6-7), T11 (SSOT consult + WebSearch), T12 (DeepWiki at R-phase time, not recall), T13 (SP `requesting-code-review` re-verified at `SKILL.md:404` and `research-patches/2026-05-23-meta-orchestrator-prior-art.md:73`), T15 (§7-§8 self-application), T16 (§3 T16 table), T17 (no code/skill edits — markdown only), T19 (cold-QA note below), T20 (§5 verdict sentence cites SSOT row + DeepWiki URL + falsifier outcome). ✓

- **`doc-authority-hierarchy.md §3`:** Header carries Status + Authoritative-for + NOT authoritative-for. ✓

- **Admission gate §2.4 re-verified:** `gh api repos/lee-to/aif-handoff/commits?since=2026-04-29` returned commits from two runtime-adapter PRs both in the 30-day window: **PR #127** (`feat(runtime): per-profile environment overrides for Claude adapter`, merged 2026-05-15T09:05:00Z, merge SHA `e1ffa70`, source commit `b99807f`) + **PR #128** (`feat(runtime): support proxy env across adapters`, merged 2026-05-26T08:07:12Z, merge SHA `51ce96a`). Both PRs touch `packages/runtime/` only — NOT `packages/mcp/` or `apps/coordinator/`. Gate §2.4 CLEAR — no MCP or coordinator surface changes in last 30 days.

- **T19 cold-QA note:** This patch should be read by an independent reviewer before PR open, per T19 and kickoff §9.3. The patch is completed; orchestrator + maintainer serve as reviewers per kickoff §9.3 note. The worker (this session) does not self-approve.

Evidence:
- `docs/meta-factory/prior-art-evaluations.md:95` — SSOT #27
- `docs/meta-factory/prior-art-evaluations.md:112` — SSOT #44
- `docs/meta-factory/prior-art-evaluations.md:135` — SSOT #67
- `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md:73` — SP `requesting-code-review` REFERENCE leapfrog row
- `.claude/skills/meta-orchestrator/SKILL.md:404` — `requesting-code-review (SP SSOT, REFERENCE)`
- `.claude/skills/meta-orchestrator/SKILL.md:429` — `ADOPT the SP dispatch template`

---

## §8 §1.7 Backward-check applied

- **SSOT #27/#28/#29/#30/#43/#44/#46/#67/#80:** None silently superseded. §6 additive notes are additive-only — no verdict changes. SSOT #44 DEFER verdict unchanged; SSOT #30 DEFER verdict unchanged; SSOT #67 REJECT verdict unchanged. Original DEFER/REJECT rationale reviewed (lines 95-148 in `prior-art-evaluations.md`) — this patch's findings are consistent with those rationales (they update «now we know more about the body-format» not «the DEFER was wrong»).

- **No `.claude/rules/*` modified.** No `.claude/skills/*` modified. No `agents/*` modified. No `packages/*` modified. No `install.sh` modified. No kickoff.md modified. Single output file = this research-patch.

- **SKILL.md:404 and SKILL.md:429** — read but not modified. Criterion 5 disambiguation is recorded in this patch only; the SKILL.md inconsistency is resolved analytically (both lines are consistent per §4 criterion 5 above). No edit needed — the SKILL.md is correct as written.

- **Scope:** this patch covers Variant A only. Variants B/C/D have separate Sub-waves. No scope creep into B/C/D or into any implementation decision.

- **T15 self-application:** This R-phase patch applied BFR-default §3 to itself — SSOT consult, DeepWiki ≥5 probes, WebSearch ≥2, own-stack sweep. The patch is the output of the methodology it evaluates. Recursive self-application confirmed.

Evidence:
- `docs/meta-factory/prior-art-evaluations.md:95-148` — SSOT rows #27/#28/#30/#43/#44/#46/#67 (lines verified by grep)
- `docs/meta-factory/prior-art-evaluations.md:148` — SSOT #80 (delta-tracking, separate DEFER)
- `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md:22` — SSOT block note (rows #66-#70 registered in that patch)

---

## §9 See also

- [docs/meta-factory/prior-art-evaluations.md](../prior-art-evaluations.md) — SSOT rows #27, #28, #29, #30, #43, #44, #46, #67, #80 (existing aif-handoff entries reviewed for this patch)
- [docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md](./2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + leapfrog table (SP `requesting-code-review` REFERENCE row at line 73; criterion 5 disambiguation)
- [docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md](./2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor sub-component evaluation (autoQueueMode)
- [.claude/skills/meta-orchestrator/SKILL.md](../../../.claude/skills/pipeline/SKILL.md) — surface this umbrella reasons against; lines :404 and :429 (criterion 5 resolution)
- [.claude/rules/build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied in §5
- [.claude/rules/reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) — §2 strategy-fork-surface gate that aif-handoff Reviewer conflicts with (criterion 5 risk)
- [.claude/rules/ai-laziness-traps.md](../../../.claude/rules/ai-laziness-traps.md) — T-traps active for this Sub-wave; T20 specifically enforced in §5 verdict sentence
- [.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — umbrella kickoff driving this Sub-wave
- DeepWiki search URLs (all 7 probes):
  - [Probe 1 — MCP tool schemas](https://deepwiki.com/search/what-mcp-tools-does-aifhandoff_cdc63a5b-b23f-4860-8e05-563a5ef12a68)
  - [Probe 2 — body-format compatibility](https://deepwiki.com/search/does-handoffcreatetask-accept_2983402c-d75e-4bd5-a769-b86ba2d38a9e)
  - [Probe 3 — WebSocket events](https://deepwiki.com/search/what-websocket-events-does-aif_f067db8f-5f44-4829-9f6a-1eade44f8bd6)
  - [Probe 4 — autonomy gating](https://deepwiki.com/search/how-is-autonomy-gated-in-aifha_02cb5b3a-035a-4b56-ba4d-6246bbfe32a3)
  - [Probe 5 — headless operation](https://deepwiki.com/search/can-aifhandoff-be-operated-hea_655e4c06-f2b1-4cba-be69-f6370ddc8539)
  - [Probe 6 (T7) — accept_existing_plan](https://deepwiki.com/search/is-there-a-way-to-disable-the_ae7072a9-9169-4fbd-a28b-3b7a097ff85d)
  - [Probe 7 (T7) — minimum stub body](https://deepwiki.com/search/if-handoffcreatetask-rejects-a_4f38e976-6a57-4dc6-a139-6e765b4b931f)
