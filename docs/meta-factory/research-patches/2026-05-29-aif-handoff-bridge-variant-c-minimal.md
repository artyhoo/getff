<!-- scope:aif-handoff-bridge-variant-c-minimal -->

# Variant C — aif-handoff minimal bridge (Implementer-equivalent only) — R-phase patch

> **Status:** R-phase Sub-wave C complete — 2026-05-29. **NOT prescriptive** — verdict is additive evaluation for maintainer decision via Sub-wave D synthesis. No code changes, no skill edits, no SSOT row landings in this patch.
> **Authoritative for:** Variant C (minimal bridge, Implementer-equivalent only) value-add audit — DeepWiki sweep on `aif-handoff exec`-shape CLI + visibility-only tracker pattern, BEFORE/AFTER maintainer-action count table (T-AIF-BRIDGE-C MANDATORY), duplication analysis vs SP `requesting-code-review` under DN-1=B-constrained framing, 5-criteria scoring, BFR-default verdict, SSOT additive-note proposals.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Variants A/B/B'/D — those have separate Sub-waves (SW-A merged PR #268; SW-B merged PR #267; SW-B2 dispatch pending; SW-D synthesis pending). Overall cross-variant verdict — see Sub-wave D synthesis (not yet dispatched). DN-1 / DN-2 maintainer decisions on Variant A's ADAPT vs REFERENCE — those are upstream of this Sub-wave; this patch consumes DN-1=B-constrained as input per kickoff dispatch instruction.

---

## §0 TL;DR

**Verdict: REJECT** (Variant C value-add is insufficient against §8 STOP threshold; the kickoff-framed «Implementer-only mode» does not exist as a first-class capability in `lee-to/aif-handoff`).

**Match score:** ~22%. The pure-tracker pattern (`paused:true + autoMode:false + manual PUT /tasks/:id` metadata updates) IS shipped and an external script CAN drive the state machine via REST events (DeepWiki probes 1+4+5, 2026-05-29) — so the literal claim «aif-handoff can host a visibility-only task» passes. But the kickoff-framed Variant C («thin wrapper `aif-handoff exec --kickoff <path>` that spawns single `claude --agent` and tracks status only») requires assembling three pieces that aif-handoff does not ship as a unit: (a) no `aif-handoff exec` / `aif-handoff submit` / `aif-handoff cli` command exists for thin-wrapper submission — `aif-handoff` is `npm run dev` plus REST/MCP only (DeepWiki probe 1); (b) no «Implementer-only» fast-path exists — tasks must originate in `backlog` and traverse `planning` → `plan_ready` before reaching `implementing` (DeepWiki probe 1+5); (c) Planner-skip requires the same `accept_existing_plan` + on-disk `PLAN.md` filesystem coupling that SW-A's Variant A flagged as a blocker (cross-ref `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:115-121`).

**BEFORE/AFTER reduction:** ~12–25% depending on counting method (5–6 of 8 manual steps preserved in either interpretation; only «open new CC tab» + «paste 1-liner» collapse into one `aif-handoff exec`-shaped invocation). This is **below the kickoff §8 STOP 30% threshold**, triggering verdict «Variant C value-add insufficient».

**Falsifier (per T20):** if a future workflow measurement shows ≥30% maintainer-action reduction per umbrella stage AND a thin-wrapper LOC ≤100 against currently-shipped aif-handoff surface (without the `accept_existing_plan` PLAN.md coupling and without rewriting our meta-kickoff template) — re-evaluate as ADAPT. Current evidence (DeepWiki probes 1–5, 2026-05-29) does not support either condition: there is no first-class Implementer-only mode and the kickoff-framing's «no Planner+Reviewer cycle» path is only reachable via `paused:true` (= zero automation gain beyond UI tracking).

**Critical structural finding (T-AIF-BRIDGE-C, automation-theatre check):** the most truthful framing of Variant C — given the shipped surface — is «aif-handoff kanban card as a status-only mirror for an externally-spawned CC session». In that framing, `aif-handoff` does NOT spawn the worker, does NOT run the Planner/Reviewer cycle, and does NOT call back when work completes. It is a tracker ONLY. This crashes Variant C's stated «value-add = autonomous re-plan» (kickoff line 142) to zero, and the residual «pretty Kanban UI» does not clear the §8 30% threshold against Docker+SQLite infra cost.

---

## §1 Scope

**Variant evaluated:** Variant C — Minimal bridge: aif-handoff as Implementer-equivalent only. Per kickoff §3 Variant C mechanism (lines 124–145):

```text
/meta-orchestrator → produces 1-liner block (current behaviour, UNCHANGED)
            ↓
maintainer pastes 1-liner into either:
  (a) fresh CC session (current path — UNCHANGED), OR
  (b) aif-handoff CLI: `aif-handoff exec --kickoff <path>` (NEW thin wrapper)
            ↓
Variant C path (b) skips aif-handoff Planner+Reviewer entirely;
spawns single `claude --agent` with meta-kickoff and tracks status only.
            ↓
status visible in aif-handoff UI (just for tracking, no re-plan).
```

**What was probed:**

1. Existence of a thin-wrapper CLI shape (`aif-handoff exec`, `aif-handoff submit`, `aif-handoff cli run`) in `lee-to/aif-handoff`
2. Implementer-only mode availability — can a task skip Planner stage AND Reviewer stage as a single configuration?
3. Visibility-only tracker pattern feasibility under `paused:true + autoMode:false + manual events`
4. External state-machine transitions via `POST /tasks/:id/events` (start_ai / start_implementation / approve_done)
5. Adversarial counter-probe (T7): any documented pattern for «external orchestrator creates tracker-only task; external claude does work; aif-handoff updates status passively»?
6. Gate-4 admission re-sweep: PR #127 (per-profile env) + PR #128 (proxy env) — what (if anything) is the wrapper-design surface impact for Variant C specifically?
7. Per-step maintainer-action count BEFORE/AFTER comparison (T-AIF-BRIDGE-C MANDATORY)
8. Duplication analysis with `/meta-orchestrator` + SP `requesting-code-review` cycle under **DN-1=B-constrained** input (Variant A is ADAPT-candidate with «aif-handoff Reviewer one-clear-pick/escalate-on-doubt» constraint; how does that constraint propagate to Variant C which bypasses the Reviewer entirely?)

**Input context (from dispatch):**

- SW-A merged PR #268 verdict: Variant A = REFERENCE (match 28%, three structural ADOPT-blockers: PLAN.md disk coupling, WebSocket broadcast no topic filter, Reviewer-discipline conflict)
- SW-B merged PR #267 verdict: Variant B = REJECT (match ~5%, no upstream dir-watch capability; ~400-800 LOC upstream PR required; DECISION=C zero-infra violated)
- PR #269 follow-up: mechanical corrections to SW-A/B (B1 PR #128 merge timestamp, M1 Gate-4 records PR #127+#128 both touch `packages/runtime/` only, m1/m2/m3 minor edits); no verdict changes
- DN-1 maintainer resolution: «B-constrained» — Variant A is ADAPT-candidate with the Reviewer behavior constraint (this Sub-wave consumes that input, does not re-litigate it)

---

## §2 DeepWiki + WebSearch sweep evidence

### §2.1 Probe 1 — CLI / Implementer-only mode existence

**Question:** «Does aif-handoff expose a CLI command (or alternative invocation) that creates a single task and spawns one execution worker WITHOUT running the Planner subagent and Reviewer subagent — i.e. a minimal "Implementer-only" mode for an externally-prepared task body? Or are tasks always required to flow through Planner → Implementer → Reviewer?»

**Key extraction (verbatim):**

> «AIF Handoff does not expose a direct CLI command to create a task and run only the Implementer subagent without the Planner and Reviewer. Tasks are designed to flow through the full `Planner → Implementer → Reviewer` pipeline by default. However, you can configure a task to skip the Reviewer subagent.»

> «`skipReview` … When `skipReview` is set to `true`, the task will move directly to the `done` status after successful implementation, without invoking the `review-sidecar` and `security-sidecar`.»

> «A true "Implementer-only" mode, where a task starts directly at the implementation stage with an externally prepared task body and bypasses the Planner, is not directly supported by a CLI command or a simple configuration. The system is designed for tasks to originate in the `backlog` and then transition to `planning`.»

> «When `useSubagents` is `false`, the `runImplementer` function uses the `/aif-implement` slash command. … When `HANDOFF_MODE` is not set, and `HANDOFF_TASK_ID` is, skills can call MCP tools themselves to sync with Handoff. This suggests a more manual, skill-driven approach could be used, but it still involves the task being known to the Handoff system.»

**DeepWiki URL:** [deepwiki.com/search/does-aifhandoff-expose-a-cli-c...](https://deepwiki.com/search/does-aifhandoff-expose-a-cli-c_a2e1e206-eb0b-40e1-b2f2-9f240bc4c0ac)

**Finding:** No `aif-handoff exec` / `aif-handoff submit` CLI exists. The closest existing surface to Variant C's framing is the documented `HANDOFF_TASK_ID` env-var pattern (mode 2 in `docs/mcp-sync.md`, cross-ref SSOT #27) — but that requires the external CC session's *own* skills to call MCP tools (`handoff_sync_status`, `handoff_push_plan`) for status sync. Our meta-kickoff is opaque markdown; CC running it does not know to make those MCP calls unless either: (a) the meta-kickoff template is rewritten to include aif-handoff-aware instructions (fails kickoff §4 criterion 4 fallback ergonomics), OR (b) the wrapper manages status externally (= wrapper-side polling/event loop, raising LOC and coupling).

### §2.2 Probe 2 — infra requirement for single-user setup

**Question:** «What infrastructure is required to run aif-handoff for a single user — Docker? PostgreSQL or SQLite? Node.js? Coordinator daemon? Web UI server? Can it be installed via npm or does it require docker-compose?»

**Key extraction (verbatim):**

> «AIF Handoff … requires Node.js, a SQLite database, an API server, a Web UI server, and an Agent (coordinator daemon). It can be installed via `npm` for a non-Docker setup or `docker-compose` for a containerized environment.»

> «API Server: A Hono REST + WebSocket server running on port `3009`.»
> «Web UI Server: A React Kanban UI running on port `5180`.»
> «Agent (Coordinator Daemon): A background process that polls for tasks and dispatches subagents.»
> «Database: SQLite is used as the database … `./data/aif.sqlite`. PostgreSQL is not a default option.»
> «Without Docker … npm install … npm run init … npm run dev. This command uses `node ./scripts/dev.mjs` to start the API, Web UI, and Agent processes concurrently.»

**DeepWiki URL:** [deepwiki.com/search/what-infrastructure-is-require...](https://deepwiki.com/search/what-infrastructure-is-require_e474fbf8-407f-49c2-a7bb-73ece98e8ede)

**Finding:** Even the minimum-Variant-C setup requires Node.js 22+, SQLite, three concurrent server processes (API, UI, Agent coordinator), and ports 3009 + 5180 + optional 3100 (MCP HTTP). Same infra burden as Variant A. The «minimal bridge» framing in the kickoff name does NOT translate to «minimal infra» — the infra is per-aif-handoff-install, not per-bridge-feature.

### §2.3 Probe 3 — external observation of task status

**Question:** «How can an external system observe the status of a task in aif-handoff? Does it expose: (a) WebSocket events, (b) REST API for task list/status, (c) CLI command for status query? Can a task be created and tracked via the React Kanban UI for visibility-only without aif-handoff doing any AI work on it?»

**Key extraction (verbatim):**

> «AIF Handoff broadcasts real-time updates via a WebSocket endpoint at `ws://localhost:3009/ws`. Connected clients receive all events, as it's a broadcast channel without topic subscriptions.»
> «`task:created`, `task:updated`, `task:moved`, `task:deleted`, `task:scheduled_fired`, `sync:status_changed`, `task:commit_started`, `task:commit_done`, `task:commit_failed`.»
> «`GET /tasks`: Lists all tasks or filters them by `projectId`.»
> «`POST /tasks/:id/events`: Transitions a task through its state machine by applying a specific event.»
> «The provided documentation does not explicitly mention a CLI command for querying task status.»
> «Yes, a task can be created and tracked via the React Kanban UI for visibility-only without `aif-handoff` doing any AI work on it. … setting the `paused` flag to `true` … the agent coordinator skips it in all selection queries, meaning it won't be picked up for planning, implementation, or review by the AI agents.»

**DeepWiki URL:** [deepwiki.com/search/how-can-an-external-system-obs...](https://deepwiki.com/search/how-can-an-external-system-obs_1da61a08-7942-4571-ac91-8d4a495adbd9)

**Finding:** Visibility-only tracker pattern IS shipped via `paused:true` (per SSOT #28 ADAPT verdict and DeepWiki probe). This validates the «status visible in aif-handoff UI» half of Variant C, but at zero automation gain: the task sits paused, the kanban card displays the task name, and the external orchestrator must run the actual work outside aif-handoff entirely. The WebSocket broadcast is the same un-filtered shape SW-A's Variant A flagged (broadcast channel, no topic subscriptions — same external-client complexity for both variants).

### §2.4 Probe 4 — external REST state-machine transitions

**Question:** «Can an external script transition a task's status (backlog → implementing → done) via REST API without aif-handoff's coordinator running the Planner/Implementer/Reviewer subagents? Specifically: does POST /tasks/:id/events accept transitions like start_ai or approve_done from an external HTTP client, and can a task with paused:true + autoMode:false serve as a pure visibility-only tracker where the external orchestrator updates status manually as it spawns its own claude subprocess outside aif-handoff?»

**Key extraction (verbatim):**

> «Yes, an external script can transition a task's status via the REST API without the `aif-handoff` coordinator running the subagents. The `POST /tasks/:id/events` endpoint accepts transitions like `start_ai` and `approve_done` from an external HTTP client. A task with `paused:true` and `autoMode:false` can indeed serve as a visibility-only tracker where an external orchestrator manually updates its status.»

> «`start_ai`: This event is allowed only when the task is in the `backlog` status. It transitions the task to `planning`.»
> «`start_implementation`: This event is allowed from `plan_ready` status, but only if `autoMode` is `false`. If `autoMode` is `true`, the system rejects this event because implementation is handled automatically.»
> «`approve_done`: This event is allowed only when the task is in the `done` status. It transitions the task to `verified`.»

**DeepWiki URL:** [deepwiki.com/search/can-an-external-script-transit...](https://deepwiki.com/search/can-an-external-script-transit_df08efee-b829-42ab-a3ff-10014c4c6c78)

**Critical finding:** The state machine sequence `backlog → planning → plan_ready → implementing → done → verified` is **enforced even for paused tasks** if the external orchestrator wants the kanban card to reflect the work's lifecycle. There is no «skip-to-implementing» REST event. To bridge from `backlog` to `implementing` without running aif-handoff's Planner, the external script must either: (a) use `accept_existing_plan` event (which requires on-disk PLAN.md in `.ai-factory/` — the same coupling SW-A flagged for Variant A at `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:115-121`), OR (b) keep the task in `backlog` perpetually with manual metadata updates (kanban card never moves columns — fails the «pretty Kanban UI» value-add), OR (c) manually drive the state machine through every event (`start_ai`, `accept_existing_plan` with PLAN.md disk write, `start_implementation`, `approve_done`) — which is more steps than the maintainer-paste path it claims to replace.

### §2.5 Probe 5 — adversarial T7 counter-probe

**Question:** «Adversarial probe: if there were ANY way to bypass both the Planner subagent AND the Reviewer subagent for a task — keeping aif-handoff as a pure tracker/observer with status visible in the Kanban UI, while the actual code work happens in an external claude subprocess that aif-handoff doesn't spawn — what would that look like? Could it be: (a) `skipReview:true + manual state transitions via POST /tasks/:id/events`? (b) `paused:true + autoMode:false` with task perpetually in backlog and only metadata updates? (c) some `aif-handoff exec` or `aif-handoff submit` CLI command for thin-wrapper submission? Cite any source file or doc that suggests such a pattern is supported or contemplated.»

**Key extraction (verbatim):**

> «(a) `skipReview:true` and Manual State Transitions via `POST /tasks/:id/events` … `skipReview:true`: This flag, when set on a task, causes the coordinator to bypass the review stage entirely. After successful implementation, the task moves directly to `done` without involving the `review-sidecar` or `security-sidecar`. … you could create a task in `backlog`, then use `accept_existing_plan` to move it to `plan_ready`, and then `start_implementation` (if `autoMode` is `false`). After external work, you could transition it to `done` or `verified`.»

> «(b) `paused:true` and `autoMode:false` with Metadata Updates … Even with `paused:true` and `autoMode:false`, you can still update task metadata (e.g., `title`, `description`, `plan`, `implementationLog`, `reviewComments`) using the `PUT /tasks/:id` API endpoint. This allows the Kanban UI to reflect the progress of the externally performed work.»

> «(c) `aif-handoff exec` or `aif-handoff submit` CLI command for thin-wrapper submission … When a developer runs `/aif-plan` or `/aif-implement` directly in Claude Code, and `HANDOFF_TASK_ID` is set (but `HANDOFF_MODE` is not), the skills themselves call MCP (Model Context Protocol) tools to sync status updates with `aif-handoff`. … This effectively makes `aif-handoff` a tracker/observer while the external process drives the state changes.»

> «The most direct way to achieve the described bypass … would be a combination of `skipReview:true`, `paused:true`, `autoMode:false`, and leveraging the MCP tools (`handoff_sync_status`, `handoff_push_plan`) from the external Claude subprocess.»

**DeepWiki URL:** [deepwiki.com/search/adversarial-probe-if-there-wer...](https://deepwiki.com/search/adversarial-probe-if-there-wer_01ae10a0-82e9-427c-88b8-5517a137a07b)

**Finding (T7 enforced):** No `aif-handoff exec` or `aif-handoff submit` standalone CLI command exists. The «closest existing pattern» surfaced by adversarial probe is the SSOT #27 `HANDOFF_TASK_ID` + `HANDOFF_MODE` env-var fork — but that pattern assumes the *external CC session itself* is aif-handoff-aware (runs `/aif-plan` / `/aif-implement` skills that call MCP tools). Our meta-kickoff template is not aif-handoff-aware (and rewriting it to be aif-handoff-aware would fail kickoff §4 criterion 4 fallback ergonomics: consumers without aif-handoff installed would receive MCP-call instructions that resolve to errors).

### §2.6 Gate-4 admission re-sweep result

Per dispatch instruction: «Gate-4: address proxy-runtime PR #128 + per-profile env PR #127 surface impact on Variant C wrapper design.»

Inheriting SW-A's verified Gate-4 evidence (`2026-05-29-aif-handoff-bridge-variant-a-mcp.md:343`, post-PR #269 correction):

- **PR #127** (`feat(runtime): per-profile environment overrides for Claude adapter`, merged 2026-05-15T09:05:00Z, SHA `e1ffa70`) — touches `packages/runtime/src/adapters/claude/options.ts`, `cli.ts`, 3 new tests, `docs/providers.md`. **Wrapper-design impact for Variant C:** if the wrapper were to spawn `claude` as a subprocess via aif-handoff's runtime adapter (which Variant C explicitly does NOT — kickoff line 134-138 says the wrapper «spawns single `claude --agent` with meta-kickoff» as a direct subprocess, not through aif-handoff's runtime), per-profile env injection would have been the clean wiring point for `HANDOFF_TASK_ID`. But Variant C's «outside aif-handoff's runtime» framing makes PR #127 irrelevant to the wrapper-design surface for Variant C specifically. **Net impact: nil for the kickoff-framed Variant C; would be a small WIN if Variant C is reframed to use aif-handoff's runtime adapter (which would collapse Variant C toward Variant A's MCP-consumer model).**

- **PR #128** (`feat(runtime): support proxy env across adapters`, merged 2026-05-26T08:07:12Z, SHA `51ce96a`) — touches `packages/runtime/src/proxyEnv.ts`, multiple adapter files, Docker configs. **Wrapper-design impact for Variant C:** none. Proxy env handling concerns aif-handoff's outbound HTTP from its own subagents; Variant C does not invoke aif-handoff subagents, so proxy env is orthogonal.

- **Both PRs touch `packages/runtime/` only** — NOT `packages/mcp/`, NOT `apps/coordinator/`. Admission gate §2.4 CLEAR for Variant C — no MCP or coordinator surface changes that would force re-evaluation of probes 1–5. The Gate-4 update confirms the «no relevant surface drift in the 30-day window» finding from SW-A and SW-B.

### §2.7 WebSearch — external precedents (T12 counter)

Per BFR §3 6-layer step 4 (≥2 phrasings on the problem-domain term).

**Search 1:** «thin wrapper CLI orchestrator dispatch claude code session kanban tracker visibility 2026»

Results surface a real and competitive ecosystem of «kanban-for-claude-code» orchestration tools, including [vibe-kanban](https://vibekanban.com/), [langwatch/kanban-code](https://github.com/langwatch/kanban-code), [untra/operator](https://github.com/untra/operator), [GreenSheep01201/Claw-Kanban](https://github.com/GreenSheep01201/Claw-Kanban), [nikiforovall claude-code-kanban](https://nikiforovall.blog/ai/productivity/2026/02/07/claude-code-kanban.html), [9 Open-Source Agent Orchestrators for AI Coding (2026) | Augment Code](https://www.augmentcode.com/tools/open-source-agent-orchestrators), [Best Multi-Agent Coding Tools for Claude Code and Codex Users (2026) | Nimbalyst](https://nimbalyst.com/blog/best-multi-agent-coding-tools-2026/), [Claude Code Kanban: Best Session Boards (2026) | Nimbalyst](https://nimbalyst.com/blog/claude-code-session-kanban-organize-ai-agents/), [Vibe Kanban vs Paperclip vs Dispatch: Three Philosophies | MindStudio](https://www.mindstudio.ai/blog/vibe-kanban-vs-paperclip-vs-claude-code-dispatch-comparison). The pattern «one kanban card == one Claude session, with status reflecting session lifecycle» is well-established as of 2026.

**WebSearch finding 1:** the «tracker-only kanban» value proposition is real and validated by 7+ live competitors. The «Vibe Kanban vs Paperclip vs Dispatch» piece classifies tools into four orchestration shapes (tiled IDEs / visual dashboards-kanban / terminal-tmux / autonomous pipelines). aif-handoff falls into «autonomous pipelines» — using it as a tracker-only would mis-shape the tool. The dedicated kanban-only competitors (Vibe Kanban, Claw-Kanban, Kanban Code) are purpose-built for the tracker-only shape and don't require Docker+SQLite for the kanban half.

**Search 2:** «paused task tracker external orchestrator REST API kanban visibility-only manual status transitions 2026»

Results surface [Hermes Kanban](https://magnus919.com/2026/05/the-hermes-kanban-a-complete-guide-to-multi-agent-task-orchestration/) (orchestrator-driven auto-decomposition + artifact delivery), [SC Kanban](https://mcpmarket.com/tools/skills/sc-kanban-orchestrator) (CC skill for workflow management), [Vibe Kanban](https://vibekanban.com/), [operator REST API](https://github.com/untra/operator), [Kanban Tool API](https://kanbantool.com/developer/api-v1), [Salesforce Orchestration Statuses and Milestones](https://help.salesforce.com/s/articleView?id=sf.orchestrator_manage_orchestration_statuses.htm), [Azure Durable Functions Manage Orchestration Instances](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-instance-management), [hermes-agent kanban toolset issue #18968](https://github.com/NousResearch/hermes-agent/issues/18968), [hermes-agent kanban status writes issue #19535](https://github.com/NousResearch/hermes-agent/issues/19535).

**WebSearch finding 2:** the «external REST-driven manual status transition» pattern is documented in Hermes Kanban + operator + Kanban Tool API. Notably, the Hermes Kanban issue #19535 («prevent direct status writes into running») describes exactly the failure mode aif-handoff avoids by enforcing event-driven transitions through `applyHumanTaskEvent` rather than free-form `PUT` writes — i.e., aif-handoff's state-machine discipline is actually competitive with peers, but that doesn't make Variant C's value-add higher.

---

## §3 T16 problem-class match table

| Dimension | Upstream (aif-handoff Variant C surface) | Our problem class | Match? | Evidence |
|---|---|---|---|---|
| **Core function** | aif-handoff's shipped surface: full autonomous Kanban runtime (Planner→Implementer→Reviewer cycle in coordinator daemon) PLUS `paused:true + autoMode:false` for «pure tracker» degenerate mode | Variant C goal: «aif-handoff as Implementer-equivalent only; bypass Planner+Reviewer; spawn one `claude --agent`; track status» | MISMATCH — kickoff-framed Variant C inverts the upstream's primary use (subagents bypassed, external CC drives) and reuses only the «kanban card + REST state machine» substrate. Upstream is autonomous-pipeline-shaped; Variant C wants tracker-shape | DeepWiki Probe 1: «Tasks are designed to flow through the full `Planner → Implementer → Reviewer` pipeline by default»; Probe 5 adversarial: tracker-shape requires `paused:true + autoMode:false` + manual `PUT /tasks/:id` |
| **Wrapper CLI shape** | No `aif-handoff exec`, `aif-handoff submit`, `aif-handoff cli run` exists. Only `npm run init` + `npm run dev` (lifecycle scripts for the coordinator daemon itself). Tasks created via REST `POST /tasks` or MCP `handoff_create_task` | Variant C posits a new thin-wrapper CLI command that accepts a kickoff path | MISMATCH — the wrapper shape would have to be built by us (~30-100 LOC bash + MCP / REST calls), not adopted | DeepWiki Probe 1: no CLI command for task creation; Probe 2: aif-handoff CLI surface is dev/init only |
| **Implementer-only path** | No first-class Implementer-only mode. `skipReview:true` skips ONLY Reviewer; Planner is mandatory unless `accept_existing_plan` with on-disk PLAN.md is used | Variant C explicitly bypasses BOTH Planner AND Reviewer | MISMATCH — requires either `accept_existing_plan` (same disk-coupling SW-A flagged at `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:121`) OR perpetual `paused:true` (no automation gain) OR rewriting the meta-kickoff to be aif-handoff-aware | DeepWiki Probes 1, 4, 5 |
| **Status back-channel** | WebSocket broadcast at `ws://localhost:3009/ws` (all events, no topic subscriptions); REST `GET /tasks/:id`; no CLI status query | Variant C needs status visible in UI; status updates pushed by wrapper after CC subprocess completion | PARTIAL — UI display works; bidirectional sync requires wrapper to call `PUT /tasks/:id` after CC exits, plus WebSocket tail with client-side taskId filter (same complexity SW-A flagged) | Probe 3 + SW-A `:144-145` |
| **Infrastructure** | Node.js 22+ + SQLite + 3 concurrent processes (API + Web UI + Agent coordinator) + ports 3009/5180/3100 (optional MCP HTTP) | DECISION=C HARD: `/meta-orchestrator` runs zero-dep; bridge is optional-only | CONDITIONAL — same infra as Variant A. Variant C does NOT reduce the per-aif-handoff-install cost just because the wrapper logic is thinner | DeepWiki Probe 2 |
| **Reviewer-discipline interaction** | aif-handoff Reviewer is bypassed entirely in Variant C (Planner+Reviewer both off-path) → no conflict with reviewer-discipline.md §2 strategy-fork-surface gate | Our reviewer-discipline.md §2 stays intact; Phase -1 cold-review via SP `requesting-code-review` template (SKILL.md:404+429) fires normally outside the Variant C wrapper | MATCH (low-duplication) — Variant C's «bypass Reviewer» framing is the lowest-conflict shape among A/B/B'/C re reviewer-discipline. **But the trade-off is that Variant C also gets zero autonomous-review value-add — the «bypass» is a feature for criterion 5, a debit for criterion 3** | DeepWiki Probes 1, 5; SKILL.md:404, :429; reviewer-discipline.md §2 |

**Match score: ~22%** — pure-tracker pattern supported (probes 3+4+5); state-machine + REST events reachable; UI tracking works. But the kickoff-framed «thin CLI wrapper with Implementer-only mode» does not exist as a shippable single surface; assembling it from `accept_existing_plan` + `paused:true` + `PUT /tasks/:id` re-introduces the same blockers SW-A flagged for Variant A — plus removes Variant A's auto-rerun value-add that justified the infra in the first place.

---

## §4 BEFORE/AFTER maintainer-action count table (T-AIF-BRIDGE-C MANDATORY)

Per kickoff §5 trap T-AIF-BRIDGE-C: «Per-step maintainer-action count BEFORE/AFTER table mandatory in Variant C evaluation» (kickoff line 188).

Per kickoff §8 STOP: «if BEFORE/AFTER maintainer-action count table shows <30% reduction → verdict «Variant C value-add insufficient»» (kickoff line 338).

The unit of analysis is one umbrella-stage dispatch — from «`/meta-orchestrator` finishes Stage N kickoff + 1-liner» through «Stage N PRs merged and Phase -1 GO».

| # | Step | Today (maintainer-paste) | Variant C (`aif-handoff exec`-style wrapper) | Delta |
|---|---|---|---|---|
| 1 | Decide-to-dispatch (read meta-orchestrator output, confirm Stage N kickoff ready) | maintainer | maintainer | 0 |
| 2 | Open new CC session for the Worker | maintainer (open new tab in CC, ~1 click) | wrapper auto-spawns `claude --agent` subprocess | **-1** |
| 3 | Paste 1-liner (`Agent: <role> ... Skill: <skill>`) into the new session | maintainer (clipboard paste, ~1 keystroke) | wrapper passes kickoff content via subprocess stdin or `--prompt-file` | **-1** |
| 4 | Verify Worker session actually started + dispatched to the right kickoff | maintainer (read first response or progress line) | maintainer (verify kanban card appeared in `implementing` lane + WebSocket / page-refresh confirm) | 0 (different surface, same cognitive step) |
| 5 | Monitor progress mid-flight (anomaly check; abort-or-let-run decision) | maintainer (glance at CC chat occasionally) | maintainer (glance at kanban card occasionally) | 0 (UX shift; not action count change) |
| 6 | Detect Worker completion (CC says «done», PR opened, or session stalled) | maintainer (scroll CC output; check `gh pr list`) | maintainer (kanban card moves to `done` via wrapper PUT; check `gh pr list`) | 0 (still requires `gh pr list` per stage gate §6 SKILL.md) |
| 7 | Dispatch Phase -1 cold-review (Agent tool with SP `requesting-code-review` template per SKILL.md:404+429) | maintainer (compose Agent dispatch) | maintainer (same — Variant C bypasses aif-handoff Reviewer entirely; our Phase -1 stays unchanged) | 0 |
| 8 | Read Phase -1 reviewer verdict + decide GO/REVISE/STOP + handle DECISION-NEEDED if surfaced | maintainer | maintainer | 0 |

**Action-count BEFORE/AFTER counts:**

- **By literal step removal:** 8 steps today → 6 steps with Variant C (steps 2+3 collapse) = **2 of 8 = 25% reduction**
- **By weighted effort (each step ~equal):** ≈25% reduction
- **By cognitive load (decision points unchanged):** **0% reduction** — all 5 decision points (1, 4, 5, 6, 7, 8) are preserved; only mechanical steps 2+3 are automated
- **By time saved per dispatch (rough estimate):** ~30 seconds (avoid tab-open + paste) per stage; over a 4-stage umbrella = ~2 minutes saved; trivial against Phase -1 review time (~10-30 min) or Worker time (~5-90 min)

**T-AIF-BRIDGE-C check (automation-theatre):** the «automation» Variant C provides reduces to *replacing one paste with one CLI invocation*. The maintainer still:

- decides when to dispatch (step 1)
- monitors progress (steps 4, 5)
- runs the actual stage-gate verification (`gh pr list --state merged`, step 6 — kanban completion ≠ merged PR; the wrapper must STILL gate on `gh`)
- dispatches Phase -1 separately (step 7, unchanged from today)
- handles strategy decisions (step 8, unchanged from today)

**Verdict against §8 STOP threshold:** literal step-count reduction 25% < 30% threshold. Cognitive-load reduction 0%. **STOP fires** → kickoff §8 directs verdict «Variant C value-add insufficient».

---

## §5 §4 5-criteria scoring

### Criterion 1 — Bridge complexity

**Target:** < 300 LOC, ≤ 4 MCP calls, no upstream PR required.

**LOC estimate (against the most-honest shipped-surface interpretation of Variant C: «wrapper creates paused+autoMode=false kanban card + spawns `claude` subprocess + updates status via PUT on subprocess exit»):**

| Component | LOC | Basis |
|---|---|---|
| Detect aif-handoff installed + health-ping `:3009/health` (capability check per build-first-reuse-default.md §3 +.claude/rules/dual-implementation-discipline.md §4) | ~15 | curl + early-exit |
| Resolve projectId (call `handoff_list_projects` via MCP stdio or REST + jq filter) | ~25 | requires reading a config or env var for project name; lookup + parse |
| Create paused task: REST `POST /tasks` with body `{projectId, title, description, paused:true, autoMode:false, skipReview:true}` | ~20 | curl + JSON construction + capture taskId |
| Spawn `claude --agent` subprocess with meta-kickoff content (no aif-handoff runtime adapter) | ~10 | bash exec with stdin redirect |
| Wait for subprocess exit + capture exit code | ~10 | wait + status check |
| PUT status update on exit: success → `events/start_implementation` + `events/approve_done`; failure → `events/blocked_external` | ~30 | 2-3 curl calls + state-machine awareness |
| Error handling, retries, timeouts, parsing curl errors | ~40 | typical bash error-handling glue |
| **Total** | **~150 LOC** | within target |

**MCP / REST calls:** 1 MCP (`handoff_list_projects`) + 3 REST (`POST /tasks`, 2× `POST /tasks/:id/events`) = 4 endpoint calls total. Within target.

**Upstream PR required?** No — for the «honest» tracker-only shape. Yes — for the literal kickoff-framed «Implementer-only mode» (would require either a new aif-handoff CLI command or a new task-skip-planning configuration mode).

**Criterion 1 score:** PASS on LOC (150 < 300). PASS on call count (4 ≤ 4 budget). PASS on no upstream PR (for tracker-only interpretation). **But:** the «easier than Variant A on LOC» finding is undermined by criterion 3 — see below — because Variant C's lower complexity is bought by accepting near-zero automation gain.

### Criterion 2 — DECISION=C compatibility (substrate dependency-free)

**Hard requirement:** clean checkout + `./install.sh` + `/meta-orchestrator <umbrella>` succeeds identically with and without aif-handoff installed.

**Assessment:**

If Variant C wrapper is an opt-in standalone script (maintainer invokes explicitly, OR a PostToolUse hook with explicit capability-check guard), the meta-orchestrator skill itself has zero dependency on aif-handoff. The 1-liner output (`Agent: <role> ... Skill: <skill>`) remains identical in both cases.

Without aif-handoff: wrapper exit-0 silently (capability check fails); maintainer-paste flow unchanged.

With aif-handoff: wrapper succeeds; kanban card appears; CC subprocess runs.

**DECISION=C verdict:** PASS — same as Variant A's PASS in `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:200`. Conditional on standalone-script implementation (not auto-firing hook without guard).

Evidence: SKILL.md:441 (`Does NOT add npm deps. Substrate stays bash + markdown + CC primitives + existing gh CLI` — anti-scope; line number current on `origin/staging` as of 2026-05-29; differs from SW-A's `:338` because 4 SKILL.md commits landed between SW-A authoring and this Sub-wave); kickoff §4 criterion 2 (line 154); dual-implementation-discipline.md §4 capability-check pattern.

### Criterion 3 — What's actually automated vs maintainer-loop preserved

**Per-stage automation table (compact form; full table in §4 above):**

| Stage | Today | Variant C | Automated? |
|---|---|---|---|
| Meta-kickoff authoring | `/meta-orchestrator` writes kickoff.md | Same | Not changed |
| Sub-wave 1-liner dispatch | Manual paste into new CC tab | `aif-handoff exec`-style CLI auto-invokes | **AUTOMATED** (tab + paste collapse) |
| Sub-wave execution | Worker CC session runs autonomously | Same — `claude --agent` subprocess outside aif-handoff runtime | Same quality, same execution model |
| Planner stage | Not applicable | **Skipped per Variant C framing** — kickoff is the «plan» | Not applicable |
| Phase -1 cold-review between stages | SP `requesting-code-review` template via maintainer-dispatched Agent | Same — Variant C bypasses aif-handoff Reviewer → our Phase -1 fires unchanged | **NOT automated** — by design (preserves reviewer-discipline.md §2) |
| Stage-gate `gh pr list` merge verification | Maintainer runs `gh pr list --state merged` per SKILL.md §6 | **Still required** — kanban card `done` ≠ PR merged; wrapper would falsely claim completion if it only watches subprocess exit | NOT automated |
| Maintainer decision points (strategy forks, DECISION-NEEDED) | Maintainer picks explicitly | Same — Variant C does NOT add any decision-routing capability | Stays with maintainer (correct per reviewer-discipline.md §2) |

**Net assessment:** Variant C automates one mechanical step (tab + paste). It does NOT automate decision-making, review dispatch, stage-gate verification, or strategy-fork handling — by design (Variant C explicitly bypasses Planner+Reviewer). Compared to Variant A which proposed autonomous Planner+Reviewer cycle, Variant C's value-add is much smaller. The kickoff's own framing (line 142): «Doesn't actually achieve the maintainer's «autopilot» goal — Planner/Reviewer cycle of aif-handoff bypassed; bridge = mostly tracking, not orchestration; value-add = «pretty Kanban UI for tracking what's running», not autonomous re-plan» — confirmed by this Sub-wave's evidence.

**T-AIF-BRIDGE-C check fired:** the automation-theatre risk identified in the kickoff is real for Variant C as framed. Per §4 BEFORE/AFTER table, only 2 of 8 steps are automated (25% literal, 0% cognitive).

### Criterion 4 — Fallback ergonomics without aif-handoff installed

**Hard requirement:** no degradation when aif-handoff absent.

**Assessment:**

If wrapper is standalone opt-in script with capability-check guard: fallback = current flow unchanged. PASS.

If wrapper is bundled as automatic PostToolUse hook: must early-exit silently when aif-handoff absent; otherwise hook-failure noise would degrade the experience for consumers without aif-handoff.

**Critical fallback concern unique to Variant C:** if the maintainer's meta-kickoff is rewritten to be aif-handoff-aware (using the SSOT #27 `HANDOFF_TASK_ID` env-var pattern surfaced in Probe 5), consumers without aif-handoff would receive a kickoff containing MCP-call instructions that resolve to errors when their CC subprocess tries to call `handoff_sync_status`. This breaks fallback ergonomics. **Mitigation: do NOT rewrite the meta-kickoff template; keep status updates wrapper-side rather than skill-side.**

**Fallback verdict:** PASS — IF wrapper is standalone opt-in AND meta-kickoff template is NOT rewritten to be aif-handoff-aware. Both conditions must hold.

Evidence: SKILL.md:441 anti-scope (line current on `origin/staging` 2026-05-29); kickoff §4 criterion 4 (line 158); DeepWiki Probe 1 (HANDOFF_TASK_ID requires meta-kickoff awareness which breaks our fallback) and Probe 2 (Node.js+SQLite infra requirement).

### Criterion 5 — Duplication with /orchestrator + SP cycle (under DN-1=B-constrained)

**Dispatch input:** «DN-1=B-constrained (Variant A is ADAPT-candidate with «aif-handoff Reviewer one-clear-pick/escalate-on-doubt» constraint) — use this in criterion 5 duplication analysis.»

The DN-1 maintainer decision applied to Variant A established that aif-handoff's Reviewer subagent could be constrained to «one-clear-pick or escalate-on-doubt» behavior, resolving the reviewer-discipline.md §2 conflict that drove SW-A's verdict away from ADOPT toward REFERENCE.

**Variant C's relationship to DN-1:**

Variant C bypasses aif-handoff's Planner AND Reviewer entirely (kickoff line 134-138). Therefore:

- The DN-1 constraint is **not directly applicable to Variant C** — there is no aif-handoff Reviewer running in the Variant C wrapper path
- Variant C's reviewer-discipline.md §2 compliance is automatic: our Phase -1 cold-review (SP `requesting-code-review` template, SKILL.md:404+429) fires on the human side via Agent tool, completely outside the Variant C wrapper
- Variant C has the **lowest reviewer-side duplication risk** of all variants (A/B/B'/C)

**However: this is a Pyrrhic «win».** The reason Variant C has low duplication risk is the same reason it has low value-add: it bypasses the very autonomous-review machinery that gave Variant A its autopilot potential. The DN-1 B-constrained framing explicitly invested in *constraining* the Reviewer to make Variant A safer; Variant C side-steps the investment entirely by removing the Reviewer from the path. The investment is wasted from Variant C's perspective.

**SKILL.md:404 vs :429 inconsistency resolution (inherited from SW-A):**

Per SW-A `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:242-248` and grounded in `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md:73` leapfrog table row: SP `requesting-code-review` BFR-default verdict = **REFERENCE** (source classification per SSOT semantics); operational instruction at Phase -1 = **ADOPT the dispatch template**. The two are compatible: the BFR verdict labels the prior-art-source classification; the operational instruction labels what we do with the template at dispatch time. No DECISION-NEEDED arises in this Sub-wave; same disambiguation as SW-A.

**Duplication table:**

| Component | Our current stack | Variant C aif-handoff | Duplication? |
|---|---|---|---|
| Phase -1 cold-review | SP `requesting-code-review` template (ADOPT per SKILL.md:429); orchestrated by Agent tool with reviewer-discipline.md §2 strategy-fork-surface gate | aif-handoff Reviewer subagent **bypassed entirely** in Variant C | NO CONFLICT — Variant C's «skip Reviewer» framing is the lowest-conflict shape vs reviewer-discipline.md §2. But this is bought at the price of zero autonomous-review value-add |
| Worker dispatch | Maintainer pastes 1-liner into new CC session | `aif-handoff exec`-shaped wrapper spawns `claude --agent` subprocess | COMPLEMENTARY — same outcome (CC session running kickoff) via different invocation. No logic duplication |
| Plan generation | Meta-kickoff authoring is our Phase 0/1 (the kickoff IS the plan) | aif-handoff Planner **bypassed entirely** in Variant C | NO CONFLICT — no Planner re-plan = no risk of override |
| Status tracking | Maintainer reads CC chat / `gh pr list` | aif-handoff kanban card via PUT /tasks/:id | COMPLEMENTARY — kanban adds visual surface; doesn't replace gh-CLI gate |
| Strategy-fork DECISION-NEEDED routing | Reviewer surfaces, maintainer decides (reviewer-discipline.md §2) | Same — Variant C does not introduce any new decision surface | NO DUPLICATION |

**Criterion 5 score:** PASS-with-caveat — Variant C has the lowest duplication of all variants under DN-1=B-constrained framing, because it bypasses the Reviewer that DN-1's constraint was designed to fix. The DN-1 investment is **orthogonal** to Variant C: neither beneficial nor harmful to Variant C, but mooted for Variant C's path specifically. The duplication-low-ness here is structurally tied to the automation-low-ness from criterion 3.

Evidence: kickoff §3 Variant C mechanism (line 134-138); SKILL.md:404, :429; reviewer-discipline.md §2; SW-A `:242-260` resolution; dispatch input («DN-1=B-constrained»).

---

## §6 Verdict per build-first-reuse-default.md §1

**Variant C verdict: REJECT**

**Rationale (BFR-default §1 ladder walk):**

- **ADOPT** — No. There is no shipped Variant-C-shaped surface to adopt. No `aif-handoff exec` CLI; no first-class Implementer-only mode. Adopting the closest shipped pattern (`HANDOFF_TASK_ID` env-var + MCP-sync, SSOT #27) would require rewriting the meta-kickoff template to be aif-handoff-aware — fails kickoff §4 criterion 4 fallback ergonomics (DeepWiki Probe 5).

- **ADOPT VOCABULARY** — No specific vocabulary uniquely emerges from Variant C beyond what SW-A already covered for Variant A.

- **ADAPT** — Possible to build, but unjustified. The pure-tracker assembly (`paused:true + autoMode:false + manual PUT /tasks/:id + spawn claude subprocess externally`) IS technically shippable in ~150 LOC (criterion 1). But criterion 3 shows it automates 2 of 8 maintainer steps (25% literal, 0% cognitive); kickoff §8 STOP fires at <30% — verdict directed to «value-add insufficient».

- **REFERENCE** — Marginally. The pure-tracker pattern under SSOT #28 (`paused:true`) is already evaluated and ADAPT'd at the doc level (`status:` frontmatter). The thin-wrapper-with-tracker pattern's value-add does not warrant a new REFERENCE entry beyond what SSOT #27/#28 already capture.

- **KEEP NARROW** — Not applicable. Our scope is unchanged (`/meta-orchestrator` does not narrow or widen based on whether aif-handoff is present).

- **BUILD** — Not justified. Building a tracker-only wrapper that automates 2 of 8 steps does not clear the §8 STOP threshold against Docker+SQLite infra cost. The ecosystem already ships several purpose-built kanban-trackers for Claude Code (vibe-kanban, Claw-Kanban, langwatch/kanban-code per WebSearch finding 1) that don't require Docker+SQLite; if maintainer wants kanban-shape tracking, those competitors are a better fit than retrofitting aif-handoff into the role.

- **REJECT** — YES. Upstream candidate surfaced; explicitly unsuitable for our problem class at current scale. Document why: the kickoff-framed Variant C requires assembling pieces aif-handoff does not ship as a single capability; the best-case shipped-surface implementation reduces maintainer actions by ~25% < §8 STOP 30% threshold; aif-handoff's primary value-add (autonomous Planner+Reviewer cycle) is **bypassed by design** in Variant C, leaving only the kanban-tracker substrate — which is not what aif-handoff is specialized for, and where purpose-built peers exist.

**Match score: ~22%**
- Pure-tracker pattern shipped: ✓ (PARTIAL — via `paused:true`)
- External REST state-machine transitions: ✓ (PARTIAL — via `POST /tasks/:id/events`)
- `aif-handoff exec` CLI shape: ✗ (does not exist)
- Implementer-only mode: ✗ (does not exist as single configuration)
- Planner-skip without PLAN.md disk coupling: ✗
- WebSocket topic filter: ✗ (broadcast only; same as Variant A)
- Docker-free infra: ✓ (SQLite minimum)
- DECISION=C compatible (opt-in): ✓ (conditional on standalone wrapper)
- BEFORE/AFTER ≥30%: ✗ (25% literal, 0% cognitive — §8 STOP fires)

**Verdict sentence (T20 compliant):** Variant C is REJECT — pure-tracker pattern is shipped (`paused:true + autoMode:false + manual state machine` per DeepWiki probes 4+5, 2026-05-29) but the kickoff-framed «Implementer-only mode + thin CLI wrapper» does not exist as a single capability (DeepWiki Probe 1: no Implementer-only CLI; no `aif-handoff exec` command) and BEFORE/AFTER maintainer-action count reduction is ~25% literal / 0% cognitive (§4 above) which is **below the kickoff §8 STOP 30% threshold**, triggering verdict «Variant C value-add insufficient»; building this wrapper would deploy Docker+SQLite for kanban-only tracking against an ecosystem where purpose-built peers (vibe-kanban, Claw-Kanban — WebSearch finding 1, 2026-05-29) ship the same tracker shape without aif-handoff's autonomous-pipeline infra cost.

**Stop condition (kickoff §8):** «Sub-wave C STOP: if BEFORE/AFTER maintainer-action count table shows <30% reduction → verdict «Variant C value-add insufficient».» **STOP fires** at 25% literal reduction (§4 above). Verdict aligns with REJECT under BFR-default §1.

**Falsifier (T20 compliance):** if a future workflow measurement shows ≥30% maintainer-action reduction per umbrella stage (e.g., 3 of 8 steps automated, not 2) AND a thin-wrapper LOC ≤100 against the currently-shipped aif-handoff surface (i.e., without rewriting our meta-kickoff template AND without the `accept_existing_plan` PLAN.md coupling) — re-evaluate as ADAPT with the same criteria re-scored. The wrapper would have to additionally absorb either step 6 (`gh pr list` stage gate) or step 7 (Phase -1 reviewer dispatch) to cross the threshold; both are non-trivial expansions of wrapper scope.

---

## §7 SSOT row / additive-note proposals

**Additive-note only — no verdict changes. Per kickoff §10 backward-check: existing DEFER/REJECT verdicts remain unchanged.**

### SSOT #27 (HANDOFF_MODE env-var fork) — additive note

```text
Additive note 2026-05-29 (Sub-wave C): The HANDOFF_TASK_ID + MCP-sync pattern
(mode 2 in docs/mcp-sync.md, "Manual Claude Code session") IS the closest shipped
analog to Variant C's "aif-handoff exec --kickoff <path>" thin-wrapper framing.
The pattern requires the external CC session itself to be aif-handoff-aware (its
own skills must call handoff_sync_status / handoff_push_plan). For our use case
this means rewriting the meta-kickoff template to inject those MCP calls — which
fails kickoff §4 criterion 4 fallback ergonomics (consumers without aif-handoff
would receive instructions resolving to errors). Sub-wave C verdict = REJECT on
Variant C; SSOT #27 DEFER verdict unchanged. Trigger to revisit unchanged.
```

### SSOT #28 (paused:true semantic) — additive note

```text
Additive note 2026-05-29 (Sub-wave C): paused:true + autoMode:false IS the
shipped surface for Variant C's "kanban as pure tracker, no AI work on the task"
pattern (DeepWiki probes 3+5, 2026-05-29). Combined with skipReview:true and
manual PUT /tasks/:id metadata updates + manual POST /tasks/:id/events state-
machine transitions, an external orchestrator can present in-flight kickoffs as
kanban cards without engaging aif-handoff's autonomous pipeline. However, Sub-
wave C criterion-3 analysis shows this automates 2 of 8 maintainer steps (25%
literal / 0% cognitive), below the kickoff §8 STOP 30% threshold. Verdict =
REJECT. SSOT #28 DEFER verdict unchanged; partial ADAPT for `status:`
frontmatter convention unchanged.
```

### SSOT #67 (aif-handoff Kanban runtime, REJECT) — additive note

```text
Additive note 2026-05-29 (Sub-wave C): Variant C (minimal bridge,
Implementer-equivalent only) evaluated separately as part of
aif-handoff-as-runtime-bridge umbrella. Verdict: REJECT — kickoff-framed
"Implementer-only mode + aif-handoff exec CLI" does not exist as a shipped
single capability (DeepWiki Probe 1, 2026-05-29). Best-case shipped-surface
assembly via paused:true/autoMode:false reaches only 25% literal / 0% cognitive
maintainer-action reduction, below §8 STOP 30% threshold. Bypassing aif-handoff's
Planner+Reviewer cycle removes the very autonomy value-add that motivated the
SW-A/SW-B/SW-C variant family. Falsifier: ≥30% reduction in a measured
workflow + ≤100 LOC wrapper without meta-kickoff rewrite. Trigger-to-revisit
on SSOT #67 unchanged.
```

### Proposed new SSOT row (Sub-wave D to assign slot, if it consolidates)

| Proposed slot | Candidate | Verdict | Evidence |
|---|---|---|---|
| #TBD (Sub-wave D assigns slot) | aif-handoff Variant C bridge — minimal-bridge thin-wrapper (`aif-handoff exec`-style CLI) for kickoff dispatch + kanban tracker. Shipped surface: `paused:true + autoMode:false + POST /tasks/:id/events` state machine (state-machine + REST events reachable per DeepWiki Probe 4, 2026-05-29); does NOT include `aif-handoff exec` CLI (does not exist per Probe 1) or first-class Implementer-only mode (does not exist per Probe 1). Bridge LOC ~150 against tracker-only interpretation; 1 MCP + 3 REST calls; Docker-free feasible (SQLite required). BEFORE/AFTER maintainer-action count reduction: 25% literal / 0% cognitive. | REJECT — value-add insufficient against §8 STOP 30% threshold; aif-handoff's primary autonomy machinery is bypassed by design in Variant C, mooting the infra investment. Falsifier: future workflow measurement showing ≥30% reduction + ≤100 LOC wrapper without meta-kickoff rewrite. | Sub-wave C patch 2026-05-29 (this file); DeepWiki Probes 1–5; WebSearch ×2 (kanban-tracker ecosystem alternatives); Gate-4 admission §2.6 verified (PR #127/#128 touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`) |

Sub-wave D may consolidate all variant proposals (A/B/B'/C) into a single row or split per-variant; this Sub-wave files Variant C's proposal as input.

---

## §8 §1.7 Forward-check applied

- **`build-first-reuse-default.md §1` (verdict ladder):** Variant C verdict = REJECT per §1 ladder. BFR §3 6-layer search applied to this Sub-wave: (a) SSOT consult — rows #27/#28/#29/#30/#43/#44/#46/#67/#80 reviewed at `prior-art-evaluations.md:95-148`; (b) phase-research-coverage §1 6-item checklist on negative-existence claims («no `aif-handoff exec` CLI», «no Implementer-only mode») applied — see §2 evidence + §8 sampling-floor walk; (c) DeepWiki ≥3 phrasings — 5 distinct probes executed in §2 (T1 sampling floor met); (d) WebSearch ≥2 phrasings — §2.7 above; (e) own-stack sweep — `SKILL.md:441` (anti-scope; line current on `origin/staging` 2026-05-29 — differs from SW-A's `:338` due to 4 intervening SKILL.md commits), `SKILL.md:404+:429` (SP `requesting-code-review` ADOPT-template-as-REFERENCE), `dual-implementation-discipline.md §4` (capability-check pattern for criterion 2). ✓

- **`no-paid-llm-in-ci.md §1`:** All evidence gathered via DeepWiki MCP (subscription-bundled), WebSearch (subscription-bundled), `gh` CLI (free), Bash file inspection. Zero API-billed calls. ✓ Evidence: `.claude/rules/no-paid-llm-in-ci.md:1` (Class A header).

- **`reviewer-discipline.md §2`:** This patch does NOT pick project strategy. Variant C verdict (REJECT) is a research finding against §8 STOP threshold, not a strategy choice between legitimate options. The DN-1 maintainer decision (Variant A B-constrained) is consumed as input, not re-litigated. ✓ Evidence: `.claude/rules/reviewer-discipline.md:1` (Class C header); §1 dispatch-input recording above.

- **`phase-research-coverage.md §1.7`:** §8+§9 self-reflexive walks in this file. ✓ Evidence: `.claude/rules/phase-research-coverage.md:1` (Class A header).

- **`ai-laziness-traps.md §3`:** All active T-traps applied — T1 (5 distinct DeepWiki probes; 2 WebSearches; ≥5 channels), T3 (every finding cites DeepWiki URL OR file:line OR command output), T7 (adversarial counter-prompt explicit Probe 5 at `2026-05-29-aif-handoff-bridge-variant-c-minimal.md` §2.5), T11 (SSOT consult performed AT R-phase time; WebSearch ≥2 for prior bridge implementations), T12 (DeepWiki probes at R-phase time, 2026-05-29; not training-data recall), T13 (re-verified SP `requesting-code-review` ADOPT-vs-REFERENCE disambiguation per SW-A grounding — `SKILL.md:404+:429`), T15 (§9 self-application section below), T16 (§3 T16 problem-class match table), T17 (no destructive ops — markdown-only patch; no files outside `docs/meta-factory/research-patches/` written), T19 (cold-QA done before commit — see worker-side self-review note below), T20 (§6 verdict sentence cites SSOT rows + DeepWiki URL + falsifier in same paragraph), T-AIF-BRIDGE-C (per-step BEFORE/AFTER maintainer-action count table mandatory — §4 above is the explicit table). ✓ Evidence: `.claude/rules/ai-laziness-traps.md:1` (Class A header).

- **`doc-authority-hierarchy.md §3`:** Header carries Status + Authoritative-for + NOT authoritative-for. Class field: N/A (research-patch inherits folder-level authority per [doc-authority-hierarchy.md §2 filename-convention authority](../../../.claude/rules/doc-authority-hierarchy.md)). ✓ Evidence: `.claude/rules/doc-authority-hierarchy.md:1` (Class A header).

- **`dual-implementation-discipline.md §2`:** This patch is a markdown-only artefact — rule does not apply at kickoff/research-patch layer. ✓ Evidence: `.claude/rules/dual-implementation-discipline.md` §2 (i) markdown-only carve-out.

- **`memory-codification.md §3`:** No durable conventions written to memory in this Sub-wave. The dispatch input (DN-1=B-constrained) is a maintainer decision consumed as fact, not codified as a new rule. ✓

- **DECISION=C invariant:** §5 criterion 2 confirms PASS conditional on standalone-wrapper implementation. Hard requirement not violated by this evaluation. ✓

- **CLAUDE.md `PR strategy`:** This patch is strictly within the Sub-wave C scope of the `aif-handoff-as-runtime-bridge` umbrella. No drive-by PRs opened. No scope creep into A/B/B'/D Sub-waves. ✓

- **Gate-4 admission re-verified (§2.6):** PR #127 + PR #128 both touch `packages/runtime/` only; NOT `packages/mcp/` or `apps/coordinator/`. Admission gate §2.4 CLEAR for Variant C — no MCP or coordinator surface drift in 30-day window. ✓ Evidence (cross-referencing SW-A's verified GH api evidence per `2026-05-29-aif-handoff-bridge-variant-a-mcp.md:343`).

- **T19 cold-QA note:** This Sub-wave's pre-commit self-review walk (see §10 below) is the worker-side cold-QA against the T19 trap. Per kickoff §9.3 (Phase -1 Stage 2→3 cold-review of this patch is the maintainer-orchestrator-orchestrated step; the worker does not self-approve).

---

## §9 §1.7 Backward-check applied

- **SSOT rows touched:** SSOT #27/#28/#67 receive additive notes per §7 above. Additive-only — no verdict changes. SSOT #27 DEFER unchanged; SSOT #28 DEFER unchanged; SSOT #67 REJECT unchanged. Original DEFER/REJECT rationales reviewed at `prior-art-evaluations.md:95-148` — Sub-wave C findings are consistent with those rationales (the «aif-handoff is not our problem class» framing in #67 is reinforced; #27/#28 are surfaced as adjacent pattern citations, not re-litigated).

- **No `.claude/rules/*` modified.** No `.claude/skills/*` modified. No `agents/*` modified. No `packages/*` modified. No `install.sh` modified. No `.github/workflows/*` modified. No kickoff.md modified. No other research-patch modified. Single output file = this research-patch at `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-c-minimal.md`. Evidence: `git status` shows one untracked file under `docs/meta-factory/research-patches/` after this commit.

- **SW-A patch (`2026-05-29-aif-handoff-bridge-variant-a-mcp.md`) and SW-B patch (`2026-05-29-aif-handoff-bridge-variant-b-watcher.md`) are READ-ONLY for this Sub-wave.** Findings cited from SW-A at `:115-121` (PLAN.md disk coupling), `:144-145` (T16 table format), `:242-260` (criterion 5 SKILL.md inconsistency resolution), `:343` (Gate-4 PR #127/#128 evidence). Findings cited from SW-B at `:39+:117` (PR #128 merge timestamp). PR #269 corrections respected. Per CLAUDE.md «Artifact Ownership Contract»: research-patches/ folder per-patch ownership at author-time; cross-referencing is read-only.

- **SKILL.md:404 and SKILL.md:429** — read but not modified. Criterion 5 disambiguation inherited from SW-A `:242-248`; no further edit needed. The SKILL.md disambiguation is recorded in the SW-A patch and re-grounded here; no SKILL.md text change required.

- **Scope:** this patch covers Variant C only. SW-A (Variant A), SW-B (Variant B), SW-B2 (Variant B', pending dispatch), and SW-D (synthesis, pending dispatch) are out of scope. No scope creep into other Sub-waves. The dispatched **DN-1=B-constrained** input is consumed as fact in criterion 5; no further DN-1 re-litigation.

- **T15 self-application:** This R-phase Sub-wave applied BFR-default §3 to itself — SSOT consult, DeepWiki ≥5 probes, WebSearch ≥2 phrasings, own-stack sweep. The patch is the output of the methodology it evaluates. Recursive self-application confirmed in §10 below.

- **Memory not written.** No new memory entry created. The DN-1=B-constrained dispatch input is a one-shot context for this Sub-wave; it is already codified upstream (kickoff §6 SW-A/SW-B/SW-B'/SW-C cascades + dispatch instruction). Sub-wave D synthesis is the natural codification surface for cross-variant findings, not this single-variant patch.

Evidence:
- `docs/meta-factory/prior-art-evaluations.md:95` — SSOT #27 HANDOFF_MODE
- `docs/meta-factory/prior-art-evaluations.md:96` — SSOT #28 paused:true
- `docs/meta-factory/prior-art-evaluations.md:97` — SSOT #29 task-annotation pattern
- `docs/meta-factory/prior-art-evaluations.md:98` — SSOT #30 P/I/R subagent pipeline
- `docs/meta-factory/prior-art-evaluations.md:111` — SSOT #43 RuntimeAdapter
- `docs/meta-factory/prior-art-evaluations.md:112` — SSOT #44 @aif/mcp tools
- `docs/meta-factory/prior-art-evaluations.md:114` — SSOT #46 Subagents/Skills mode dichotomy
- `docs/meta-factory/prior-art-evaluations.md:135` — SSOT #67 Kanban runtime REJECT
- `docs/meta-factory/prior-art-evaluations.md:148` — SSOT #80 delta-tracking
- `.claude/skills/meta-orchestrator/SKILL.md:441` — anti-scope (no npm deps; line current on `origin/staging` 2026-05-29; SW-A cited `:338` which has shifted due to 4 intervening SKILL.md commits — text content unchanged)
- `.claude/skills/meta-orchestrator/SKILL.md:404` — Phase -1 dispatch template (SP REFERENCE)
- `.claude/skills/meta-orchestrator/SKILL.md:429` — ADOPT SP dispatch-template directive
- `docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md:73` — SP `requesting-code-review` REFERENCE leapfrog row
- `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-a-mcp.md:115-121` — PLAN.md disk coupling
- `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-a-mcp.md:343` — Gate-4 PR #127/#128 verification
- `docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-b-watcher.md:39,117` — PR #128 merge timestamp (post-#269 correction)
- `.claude/rules/reviewer-discipline.md` — DN-1 input consumed without re-litigation
- `.claude/rules/build-first-reuse-default.md §1` — verdict ladder applied in §6
- `.claude/rules/ai-laziness-traps.md §3` — T-trap enumeration discipline followed in §8 above

---

## §10 Self-application (T15)

**Did this R-phase Sub-wave apply BFR-default §3 6-layer search to itself?**

Walk:

1. **SSOT consult** (rows #27/#28/#29/#30/#43/#44/#46/#67/#80) — ✓ done before probing; cited in §3 T16 table and §7 additive notes.

2. **phase-research-coverage §1 6-item checklist on negative-existence claims** («no `aif-handoff exec` CLI», «no Implementer-only mode», «no `aif-handoff submit` command»): (a) scope declared ✓ (§1); (b) prior-art SSOT checked ✓ (rows #27–#80 + SW-A/SW-B/PR #269); (c) DeepWiki ≥3 phrasings ✓ (5 distinct probes: existence, infra, observation surface, REST transitions, T7 adversarial); (d) WebSearch ≥2 phrasings ✓ (§2.7); (e) adversarial counter-prompt ✓ (Probe 5 explicit T7); (f) sampling floor ≥5 ✓ (5 DeepWiki + 2 WebSearch + cross-reference to SW-A's 7 + SW-B's 5 = 19 evidence channels). 6/6 ✓.

3. **DeepWiki ≥3 phrasings at R-phase time** ✓ — 5 probes in 2026-05-29 session, all URL-cited.

4. **WebSearch ≥2 phrasings** ✓ — 2 phrasings in §2.7, both returned hit-lists.

5. **Own-stack sweep** ✓ — `SKILL.md:441+:404+:429` (anti-scope + Phase -1 dispatch + ADOPT-template directive; `:441` line current on `origin/staging` 2026-05-29), `dual-implementation-discipline.md §4`, `reviewer-discipline.md §2`, `build-first-reuse-default.md §1`, `ai-laziness-traps.md §2 T-AIF-BRIDGE-C` all consulted.

6. **T15 self-application** — this section. ✓

**What would auditing this R-phase look like?**

A cold reviewer would: (a) re-run DeepWiki probe 1 with the same question and verify the «no CLI command» finding; (b) independently grep `aif-handoff` for `cli/`, `bin/`, `exec`, `submit`, `dispatch` terms in the repo file tree to confirm no CLI surface exists; (c) re-derive the BEFORE/AFTER table independently from kickoff §3 Variant C mechanism and verify the 25% literal / 0% cognitive figures hold under their own counting; (d) confirm the §8 STOP «<30% → value-add insufficient» rule fires at 25%; (e) cross-check that DN-1=B-constrained as dispatched input is correctly interpreted as «not directly applicable to Variant C» rather than «Variant C must also implement the one-clear-pick constraint». All five are mechanical and deterministic.

**Verdict on own quality:** SUFFICIENT — five DeepWiki probes plus two WebSearches plus cross-reference to SW-A's 7 probes + SW-B's 5 probes give 19+ distinct evidence channels for a single-variant Sub-wave. T1 sampling floor (≥5) exceeded by 3.8× on the direct probes alone; total-channel count is 19/5 = 3.8× of floor. No INCONCLUSIVE findings — every claim is anchored on either a verbatim DeepWiki quote, a SW-A/B file:line citation, or a maintainer-decision-as-fact input.

**One self-noted edge case (T-AIF-BRIDGE-C residual risk):** the «25% literal / 0% cognitive» figure assumes the 8-step decomposition is canonical. If a different decomposition (e.g., 6 steps with finer or coarser granularity) is used, the percentage shifts. The §8 STOP threshold is articulated in the kickoff as «<30%» without specifying decomposition methodology — this is an articulation gap in the kickoff, not in this Sub-wave's evidence. Mitigation: §4 above offers both literal (25%) and cognitive (0%) counts; either way <30%. Sub-wave D synthesis may benefit from harmonizing the BEFORE/AFTER step decomposition across A/B/B'/C for consistent comparison.

---

## §11 See also

- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — parent kickoff; §3 Variant C mechanism (lines 124–145), §4 5 criteria (line 148), §5 T-AIF-BRIDGE-C trap (line 188), §8 Variant C STOP threshold (line 338), §10 §1.7 self-walk pattern.
- [`docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-a-mcp.md`](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — Sub-wave A patch (merged PR #268); inherited findings: PLAN.md disk coupling (`:115-121`), Gate-4 PR #127/#128 verification (`:343`), criterion 5 SKILL.md disambiguation (`:242-260`).
- [`docs/meta-factory/research-patches/2026-05-29-aif-handoff-bridge-variant-b-watcher.md`](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) — Sub-wave B patch (merged PR #267); inherited findings: PR #128 merge timestamp (`:39,117`, post-PR #269 correction); no dir-watch capability finding.
- [PR #269](https://github.com/Yhooi2/rules-as-tests-aif/pull/269) — Stage 1→2 Phase -1 follow-up; mechanical corrections to SW-A/B (B1+M1+m1/m2/m3); no verdict changes.
- [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + SSOT #66-#70 origin; §3 leapfrog table SP `requesting-code-review` row at `:73` (REFERENCE source classification + ADOPT-template directive).
- [`docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md`](2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor sub-component evaluation (autoQueueMode); precedent for evaluating aif-handoff capabilities separately from full-runtime REJECT (SSOT #67).
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT rows #27 (HANDOFF_MODE), #28 (paused:true), #29 (task annotation), #30 (P/I/R pipeline), #43 (RuntimeAdapter), #44 (@aif/mcp), #46 (Subagents/Skills mode), #67 (Kanban runtime REJECT), #80 (delta-tracking) — all reviewed for this Sub-wave.
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — surface this umbrella reasons against; lines `:441` (anti-scope; line current on `origin/staging` 2026-05-29; SW-A cited `:338` per its base snapshot — text unchanged), `:404+:429` (criterion 5 SP `requesting-code-review` resolution per SW-A grounding).
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied in §6.
- [`.claude/rules/reviewer-discipline.md`](../../../.claude/rules/reviewer-discipline.md) — §2 strategy-fork-surface gate; DN-1=B-constrained input consumed without re-litigation.
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-traps active for this Sub-wave; T-AIF-BRIDGE-C BEFORE/AFTER table requirement enforced in §4.
- [`.claude/rules/dual-implementation-discipline.md`](../../../.claude/rules/dual-implementation-discipline.md) — §4 capability-check pattern (not brand-name detection) for criterion 2 standalone-wrapper guard.
- [`.claude/rules/doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) — §3 header format spec; §2 filename-convention authority for research-patches/.
- [`.claude/rules/no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — §1 enforced: all evidence via DeepWiki MCP / WebSearch / `gh` CLI / bash file inspection. Zero API-billed calls.

**DeepWiki search URLs (5 probes for this Sub-wave):**

- [Probe 1 — CLI / Implementer-only mode existence](https://deepwiki.com/search/does-aifhandoff-expose-a-cli-c_a2e1e206-eb0b-40e1-b2f2-9f240bc4c0ac)
- [Probe 2 — infrastructure for single-user setup](https://deepwiki.com/search/what-infrastructure-is-require_e474fbf8-407f-49c2-a7bb-73ece98e8ede)
- [Probe 3 — external observation of task status](https://deepwiki.com/search/how-can-an-external-system-obs_1da61a08-7942-4571-ac91-8d4a495adbd9)
- [Probe 4 — external REST state-machine transitions](https://deepwiki.com/search/can-an-external-script-transit_df08efee-b829-42ab-a3ff-10014c4c6c78)
- [Probe 5 (T7 adversarial) — pure-tracker pattern feasibility](https://deepwiki.com/search/adversarial-probe-if-there-wer_01ae10a0-82e9-427c-88b8-5517a137a07b)

**WebSearch sources (per tool requirements):**

- [Vibe Kanban](https://vibekanban.com/)
- [langwatch/kanban-code](https://github.com/langwatch/kanban-code)
- [untra/operator](https://github.com/untra/operator)
- [GreenSheep01201/Claw-Kanban](https://github.com/GreenSheep01201/Claw-Kanban)
- [nikiforovall — claude-code-kanban observation post (2026)](https://nikiforovall.blog/ai/productivity/2026/02/07/claude-code-kanban.html)
- [9 Open-Source Agent Orchestrators for AI Coding (2026) — Augment Code](https://www.augmentcode.com/tools/open-source-agent-orchestrators)
- [Best Multi-Agent Coding Tools for Claude Code and Codex Users (2026) — Nimbalyst](https://nimbalyst.com/blog/best-multi-agent-coding-tools-2026/)
- [Vibe Kanban vs Paperclip vs Dispatch: Three Philosophies — MindStudio](https://www.mindstudio.ai/blog/vibe-kanban-vs-paperclip-vs-claude-code-dispatch-comparison)
- [The Hermes Kanban: A Complete Guide to Multi-Agent Task Orchestration (May 2026)](https://magnus919.com/2026/05/the-hermes-kanban-a-complete-guide-to-multi-agent-task-orchestration/)
- [SC Kanban — Claude Code Skill for Workflow Management](https://mcpmarket.com/tools/skills/sc-kanban-orchestrator)
- [Kanban Tool API v1](https://kanbantool.com/developer/api-v1)
- [Hermes Agent — Kanban dashboard direct-write issue #19535](https://github.com/NousResearch/hermes-agent/issues/19535)
- [Hermes Agent — Kanban toolset visibility issue #18968](https://github.com/NousResearch/hermes-agent/issues/18968)
