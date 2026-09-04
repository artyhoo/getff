# Runtime-bridge MCP dispatch fix — R-phase / brainstorm kickoff

> **Mode:** R-phase (research + brainstorm → research-patch). NO production code in this phase (T5). Output is a decision-bearing research-patch + I-phase sketch.
> **Origin:** live setup session 2026-05-31 — first time the runtime-bridge (`AifHandoffBackend`) was exercised against a *running* aif-handoff instance. Dispatch path (variant «c») is **coded but non-functional**. This kickoff bakes in every concrete finding so the session does not re-discover them.
> **Umbrella:** parallel to `consumer-setup-autowrite-nc3`. Use a git worktree (`bash scripts/create-worktree.sh runtime-bridge-mcp-fix` or `claude -w runtime-bridge-mcp-fix`) — parallel-subwave-isolation.md.
> **PR base:** staging.

## §0 The question to settle

**The bridge dispatch (`AifHandoffBackend.dispatch()` → `_mcpCall`) does not reach a working aif-handoff MCP endpoint.** Decide HOW to make variant (c) — "send work from a `/meta-orchestrator` kickoff to aif-handoff for autonomous production" — actually function, then sketch the I-phase.

The maintainer's stated preference (2026-05-31): **the bridge should work through MCP** (it is aif-handoff's sanctioned integration surface). Brainstorm must take this seriously as the lead option, but adversarially compare against the REST fallback before committing.

## §1 Live findings (this session — verified, do NOT re-litigate the facts, only the design)

Running aif-handoff: docker-compose, `api:3009`, `mcp:3100`, `web:5180`, `agent:3010` (internal). Test project id `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2`, isolated clone at `/Users/art/code/aif-handoff/projects/rules-as-tests-aif` (→ container `/home/www/rules-as-tests-aif`).

1. **Wrong port.** `_mcpCall` POSTs `${baseUrl}/mcp`; `baseUrl` defaults to `http://localhost:3009` (`AifHandoffBackend.ts:123`). Live: `POST :3009/mcp → 404`. The real MCP server is on **:3100** (`POST :3100/mcp` responds). The docstring (`AifHandoffBackend.ts:264-267`) *assumed* the API server hosts `/mcp` when `MCP_TRANSPORT=http` — **false for the standard docker-compose** (MCP is a separate `mcp` service on :3100).
2. **No separate `mcpUrl`.** One `baseUrl` (:3009) is used for BOTH MCP dispatch (`/mcp`) AND REST/WS status (`/health`, `GET /tasks/:id`, `ws://…/ws`). REST/WS = :3009, MCP = :3100. **A single base URL cannot serve both** (known follow-up «MCP-port split», SW-C ATTN-2 — now live-confirmed).
3. **Missing MCP handshake.** `POST :3100/mcp` with a bare `{jsonrpc,method:"tools/call"}` returns `400 {"error":{"code":-32000,"message":"Bad Request: Server not initialized"}}`. The MCP server uses **Streamable HTTP** and requires an `initialize` handshake (likely + a session id on subsequent calls) before `tools/call`. `_mcpCall` (`AifHandoffBackend.ts:269`) sends a single stateless `tools/call` POST — insufficient. **DeepWiki was uncertain on this; the live 400 is authoritative.**
4. **Never run live.** The dispatch was built from source-reading (`AifHandoffBackend.ts:5-11` «NC-1 MCP SCHEMA DISCOVERY» via `gh api …/tools/*.ts`), not an end-to-end round-trip. So (c) is untested code.

## §2 The REST alternative (verified live — the fallback to compare against)

aif-handoff REST (:3009) can do the dispatch sequence, but non-atomically (DeepWiki + live probe):
- `POST /tasks` → **201** (verified). Accepts `projectId, title, description, priority, autoMode, isFix, skipReview, paused`. `paused:true` settable at create.
- Plan push: **no dedicated endpoint** — set the `plan` field via `PUT /tasks/:id`.
- Status → `plan_ready`: `POST /tasks/:id/events` with `start_ai` (backlog→planning) or **`accept_existing_plan` (backlog→plan_ready directly)**. `paused` via `PUT /tasks/:id`. **Not atomic** (vs MCP's `handoff_sync_status` which sets status+paused atomically with conflict-resolution).
- `GET /tasks?projectId=…` → 200; `GET /tasks/:id` → 200; `DELETE /tasks/:id` → 200 (all verified).

DeepWiki verdict: **MCP is the «intended and sanctioned external integration surface»** with atomic semantics + conflict resolution; REST is «core CRUD». So MCP = aligned-with-design but needs handshake work; REST = simpler (one port :3009, no handshake, no MCP-HTTP-mode dependency) but less-sanctioned and non-atomic.

## §3 R-phase tasks

1. **MCP Streamable-HTTP contract:** DeepWiki `lee-to/aif-handoff` (≥3 phrasings) + read `packages/mcp/src/*` via `gh api` — exact `initialize` handshake: required? session-id header (`Mcp-Session-Id`)? SSE vs JSON response mode? Is there a stateless mode? Determine the minimal client sequence for `tools/call`. Cross-check the official MCP TS SDK `StreamableHTTPClientTransport` (it does init+session automatically — **ADOPT candidate** vs hand-rolling in `_mcpCall`).
2. **Decision: MCP-fix vs REST-switch vs hybrid.** Score against: alignment with aif-handoff design (MCP wins), implementation effort (REST likely wins), robustness/atomicity (MCP wins), dependency surface (REST = no MCP-HTTP-mode requirement; consumer must set `MCP_PORT`/`MCP_TRANSPORT=http` for MCP). Use brainstorming skill — this is a genuine fork.
3. **Config refactor:** design separate `mcpUrl` (default `:3100`) decoupled from `baseUrl` (`:3009`) regardless of verdict; add `RUNTIME_BRIDGE_AIF_MCP_URL` env. Update `setup-runtime-bridge.sh` + `docs/runtime-bridge-setup.md` (Ports table already documents the split — wire it into config).
4. **BFR §3** on "build MCP client handshake ourselves vs ADOPT `@modelcontextprotocol/sdk` StreamableHTTPClientTransport". Likely ADOPT — do the search, cite SSOT.
5. **Live end-to-end test design:** against the running instance (project `441c1c0c…`) — create task → push plan → plan_ready → coordinator picks up → done. Define pass/fail. (Execution is I-phase, but design the harness now.)
6. **No-paid-LLM check:** the fix is client-side dispatch wiring only; aif-handoff runs on the operator's subscription (CLI transport). Trivially compliant — confirm.

## §4 Output (research-patch)

`docs/meta-factory/research-patches/2026-05-31-runtime-bridge-mcp-dispatch-fix.md`:
§1 Live findings (port/handshake/no-mcpUrl/untested — copy §1 above with file:line) · §2 MCP contract (handshake + session-id, evidenced) · §3 MCP-vs-REST brainstorm + scored verdict · §4 BFR §3 (MCP SDK adopt?) · §5 Config refactor (mcpUrl) · §6 I-phase sketch + live-test harness · §7 §1.7 forward+backward.

## §5 AI laziness traps (per ai-laziness-traps.md §2 — MANDATORY enumerate + extend)

Active: **T3** (every claim = file:line or live command output — the §1 facts are already in that shape, keep it), **T5** (NO code in R-phase — research-patch only), **T11/T12** (BFR + MCP-SDK search before "build handshake ourselves"), **T13** (don't trust «MCP is sanctioned» as zero-work — verify the handshake live), **T15** (self-application: does the fix respect dual-implementation-discipline + doc-authority?), **T16** (don't assume the MCP SDK client matches our problem-class without checking — we need a *programmatic* one-shot dispatch, not an interactive session), **T19** (own cold-QA on the research-patch before handoff), **T20** (every verdict in the patch backed by a tool call).
Domain-specific: **T-MCPfix-A** — «tempted to declare REST the answer because it's simpler, without verifying REST can replicate MCP's atomic status+paused + conflict-resolution semantics under concurrent coordinator polling». Counter: test the REST sequence live against a task the coordinator is actively polling.

## §6 Read-first
1. `packages/runtime-bridge/src/AifHandoffBackend.ts` (full — esp. `:123` baseUrl, `:156` dispatch, `:269` _mcpCall, `:262-267` docstring assumption).
2. `packages/runtime-bridge/src/aifWsStatus.ts` + `backend.ts` + `types.ts`.
3. `docs/runtime-bridge-setup.md` (Ports section — the :3009/:3100 split is already documented).
4. This kickoff §1/§2 (the live evidence).
5. memory `project_aif_handoff_bridge_umbrella_phase1_state` follow-up #1 (MCP-port split origin).
6. `.claude/rules/dual-implementation-discipline.md` + `no-paid-llm-in-ci.md` + `build-first-reuse-default.md`.

Finish REPORT with: research-patch PR# · MCP-vs-REST verdict + rationale · handshake contract (evidenced) · §1.7 presence · `## 🟢 Простыми словами`.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
