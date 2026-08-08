# dispatcher-skill — Stage 0 R-phase: loop design + primitive reality + BFR verdict

> **Authoritative for:** dispatcher-skill Stage 0 R-phase — primitive-reality table, loop design, BFR verdict (SSOT layer 5 consult included), DN-A/DN-B design recommendations.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../README.md#why-this-exists); final DN-A/DN-B strategy (maintainer confirms per [reviewer-discipline.md §2](../../.claude/rules/reviewer-discipline.md)); **current primitive behavior** — this is a point-in-time Stage-0 snapshot (e.g. it describes the 168-LOC `harvest.ts`; the rework auto-commit is since gated on 0-commits-ahead + `--confirm-rework`, and a ≥1-ahead dirty tree is never `add -A`'d — see [.claude/skills/dispatcher/SKILL.md §4](../../.claude/skills/dispatcher/SKILL.md) and `packages/runtime-bridge/src/harvest.ts`).

---

## (a) Primitive-reality table

LOC confirmed with `wc -l` — all 4 match kickoff claims exactly.

### dispatch.ts — 180 LOC (`packages/runtime-bridge/src/cli/dispatch.ts`)

**State machine / I/O:**

1. Parse `argv`: extract kickoff path (first non-flag arg) + `--force` flag. `dispatch.ts:53-54`
2. Build `KickoffSpec` from path (`buildKickoffSpec`). Returns `null` when kickoff carries `bridge: skip` marker → silent `exit 0`. `dispatch.ts:62-73`
3. Idempotency gate: `checkDedup(contentHash)` with 24h TTL. If hit → output prior handle + `exit 0`. Skipped under `--force`. `dispatch.ts:75-83`
4. Resolve backend via `resolveBackend()` (env `RUNTIME_BRIDGE_MODE` → auto/manual/aif-handoff; auto probes `/health`). `dispatch.ts:86`
5. Call `backend.dispatch(kickoff)`. On `BackendError` → auto-fallback to `ManualBackend` (writes `/tmp/runtime-bridge-<taskId>.md`). `dispatch.ts:90-114`
6. Record dedup (only for real backends, NOT ManualBackend — ManualBackend creates no autonomous task). `dispatch.ts:119-121`
7. Output `hookSpecificOutput.additionalContext` JSON to stdout (CC PostToolUse contract). `dispatch.ts:165-175`
8. Warn on orchestration meta-kickoffs (launch-table + stage-gates = likely bad dispatch target). `dispatch.ts:136-143`

**Failure modes:**
- `RUNTIME_BRIDGE_AIF_PROJECT_ID` missing → `BackendError('dispatch_failed')` → ManualBackend fallback.
- aif unreachable → `BackendError('unavailable')` → ManualBackend.
- Dirty worktree in aif → `BackendError('dispatch_failed')` → ManualBackend (AifHandoffBackend rolls back half-created task before throwing).
- No kickoff path → `stderr` warn + `exit 0` (non-blocking by contract).

**Critical design fact:** `exit 0` always — this is an injection hook, never a gate. A ManualBackend fallback is NOT recorded in dedup, so a real retry is possible once the blocker clears. (`dispatch.ts:14-19`)

---

### harvest.ts — 168 LOC (`packages/runtime-bridge/src/cli/harvest.ts`)

**State machine / I/O:**

1. Parse: `<taskId>` + `--base <branch>` (default `staging`) + `--body-file <path>` + `--no-auto-merge` + `--container <name>`. `harvest.ts:55-68`
2. `GET /tasks/:id` via `aifHttp.getTask` → fetch task from live aif. `harvest.ts:127`
3. Delegate to pure core `harvestTask()` (`packages/runtime-bridge/src/harvest.ts`):
   - Guard: task status must be `done` or `verified` (terminal) — else throw BEFORE any push. `harvest.ts(core):98-102`
   - Guard: `branchName` must be present. `harvest.ts(core):103-106`
   - Rework-commit gap: if `docker exec <container> git status --porcelain` non-empty → `git add -A` + `git commit` with templated message (ZERO LLM). `harvest.ts(core):113-117`
   - `docker exec <container> git push origin <branch>` — push from inside container (it holds working push creds). `harvest.ts(cli):96-100`
   - `gh pr create --base <base> --head <branch> --title <task.title> --body <body>` — PR created from host. `harvest.ts(cli):101-111`
   - Optional: `gh pr merge <prUrl> --auto --squash` → enable GitHub auto-merge. `harvest.ts(cli):113-115`
4. Output JSON `{ ok, prUrl, branch, autoMerge, committed }` to stdout. `harvest.ts(cli):141-150`

**Failure modes:**
- `docker` / container unavailable → throws → graceful degradation: prints exact manual `git push` + `gh pr create` fallback commands to stderr + `exit 1`. `harvest.ts(cli):155-165`
- Task not terminal → throw BEFORE any side-effect.
- `branchName` null → throw BEFORE push.
- PR URL unparseable from `gh` output → throw.

**Critical design fact:** ZERO LLM by construction. Distinguishes two aif paths: `approve_done + commitOnApprove` (clean tree, no commit needed) vs `request_changes→implementing→done` (dirty tree, commit required). `harvest.ts(core):1-19`

---

### questions.ts — 220 LOC (`packages/runtime-bridge/src/cli/questions.ts`)

**State machine / I/O:**

1. Parse: `--project <id>` (overrides `RUNTIME_BRIDGE_AIF_PROJECT_ID` env) + `--json` flag. `questions.ts:63-70`
2. `GET /tasks` → full task list from aif REST API. `questions.ts:177-188`
3. `selectParked(tasks, projectId)` — filter to parked tasks. A task is parked if ANY of: `manualReviewRequired === true` OR `status === 'blocked_external'` OR `blockedReason` non-empty string OR (`paused === true` AND `plan` contains `OPEN_QUESTION_ANCHOR`). `questions.ts:85-93`
4. Render as human-readable list (default) or JSON array (`--json`). `questions.ts:161-174`
5. Appends `BRAINSTORM_FOOTER` nudge to non-empty parked list — "if any of these is a design/strategy fork, invoke `superpowers:brainstorming` BEFORE answering". `questions.ts:155-158`

**Park reason extraction precedence:** (1) `blockedReason` (original park reason); (2) `OPEN_QUESTION_ANCHOR` from `plan` (mid-flight park whose `blockedReason` was wiped by `implementing→review`); (3) `reviewComments` excerpt; (4) "(no reason recorded)". `questions.ts:135-145`

**Failure modes:**
- Fetch error → stderr + `exit 1`.
- Zero parked tasks → output "No parked questions." + `exit 0` (not an error).
- `OPEN_QUESTION_ANCHOR` mid-flight park detected via `paused:true AND plan.includes(OPEN_QUESTION_ANCHOR)` conjunction — not `paused` alone (avoids over-matching manual pauses). `questions.ts:88-92`

**Critical design fact:** READ-ONLY (`GET /tasks` only). The brainstorm nudge is a prose hint, not a gate. `questions.ts:148-158`

---

### answer.ts — 302 LOC (`packages/runtime-bridge/src/cli/answer.ts`)

**State machine / I/O:**

1. Parse: `--task <id>` + `--answer <text>` + `--decision <d>` (default `request_changes`) + `--json`. `answer.ts:115-126`
2. Validate: `--task` required; invalid `--decision` is an ERROR (never silently defaulted — could re-open task wrongly). `answer.ts:134-143`
3. Dispatch by decision:
   - **`request_changes`** (default): `POST /tasks/:id/comments { message: answer }` → attach answer as latest comment → `POST /tasks/:id/events { event: 'request_changes' }` → transitions `done→implementing` with `reworkRequested:true`. `answer.ts:228-254`
   - **`approve`**: `POST /tasks/:id/events { event: 'approve_done' }` → transitions `done→verified`. `answer.ts:88-90`
   - **`retry`**: `POST /tasks/:id/events { event: 'retry_from_blocked' }` → transitions `blocked_external→prior status`. `answer.ts:91-93`
   - **`resume`** (A-park): `GET /tasks/:id` → `appendAnswerToPlan(plan, answer)` → `PUT /tasks/:id { plan, paused:false, blockedReason:null }`. Does NOT use the events state machine — directly unpauses the mid-flight park. `answer.ts:207-212`
4. Output confirmation string or JSON `{ taskId, decision, event, commented }`. `answer.ts:258-266`

**Two mutually exclusive park mechanisms (critical for the loop design):**
- **B-park** (`blockedReason` / `status=blocked_external`): resolved via `request_changes` or `retry` events through the aif state machine.
- **A-park** (mid-flight `paused:true + OPEN_QUESTION_ANCHOR` in plan): resolved via `resume` decision which uses `PUT` directly, bypassing the events API.

**Failure modes:**
- `--task` missing → `exit 1`.
- Unknown `--decision` → `exit 1` (never silently default to `request_changes`).
- `request_changes` without `--answer` text → `exit 1`.
- REST error → `BackendError` → `exit 1`.

**Critical design fact:** Non-destructive by design — only forward state-machine events + comments. No DELETE, no force-push. `answer.ts:32-36`

---

### AifHandoffBackend.ts dispatch() — 2-step sequence (`packages/runtime-bridge/src/AifHandoffBackend.ts`)

**Step 0 (self-heal):** `ensureParallelEnabled(baseUrl, projectId)` — ensures `project.parallelEnabled=1` so aif creates per-task git worktrees. Best-effort; failure warns but does NOT block dispatch. `AifHandoffBackend.ts:148-165`

**Step 1:** `POST /tasks { projectId, title: kickoff.umbrellaName, description: kickoff.content, plannerMode:'fast', paused:true, autoMode:true, skipReview:false }` → returns `{ id }`. `AifHandoffBackend.ts:175-192`

**Step 2:** `PUT /tasks/:id { paused: false }` → coordinator picks up task; advances `backlog→planning` (planner runs, creates per-task git worktree). On failure: best-effort `DELETE /tasks/:id` rollback. `AifHandoffBackend.ts:197-208`

**Why NOT `accept_existing_plan`:** that event skipped `planning` entirely → no worktree ever created → all tasks serial. Root cause from `research-patches/2026-06-02-aif-worktree-gap.md`. `AifHandoffBackend.ts:20-23`

**Status is event-only:** `PUT { status }` silently ignored — only `POST /tasks/:id/events { event }` drives transitions. `AifHandoffBackend.ts:28-29`

**resolver.ts:** auto mode probes `GET /health` (1s timeout) → if 200-4xx: `AifHandoffBackend`; else: `ManualBackend`. ManualBackend is always the tail fallback. `resolver.ts:84-90`

---

### Live probe (read-only, 2026-06-03)

```text
GET http://localhost:3009/health → {"status":"ok","uptime":224898}
GET http://localhost:3009/tasks  → real aif response (array of tasks)
```

aif IS reachable and is serving real tasks — not a ManualBackend degradation. The `/tasks` response confirms `AifHandoffBackend` is the active backend. One task was present in `backlog` status with `blockedReason` populated — correctly parked by the T-disp-A guard after the PostToolUse hook spuriously dispatched the meta-launch kickoff.

---

## (b) Loop design

The dispatch→monitor→Q&A→harvest→Phase-1→gate→advance loop mapped onto the §1 primitives:

```text
/dispatcher invoked with <umbrella-name>
│
├─ 1. DISPATCH
│    tsx dispatch.ts .claude/orchestrator-prompts/<umbrella>/kickoff.md
│    → AifHandoffBackend.dispatch() → POST /tasks (paused:true) → PUT /tasks/:id (unpause)
│    → aif picks up: backlog → planning (worktree created) → implementing
│
├─ 2. MONITOR (poll loop, non-blocking)
│    AifHandoffBackend.getStatus(handle) → GET /tasks/:id → rawStatus
│    OR AifHandoffBackend.awaitDone(handle) → WS ws://localhost:3009/ws → task:updated events
│
│    Status branches:
│    ├─ implementing / planning → still running → continue polling
│    ├─ done / verified → terminal → go to HARVEST
│    ├─ blocked_external / manualReviewRequired:true / paused+ANCHOR → PARKED → go to Q&A
│    └─ timeout → surface to operator as ATTN
│
├─ 3. Q&A (three types, per kickoff §0 loop description + DN-B resolution)
│
│    Type 1 — TECHNICAL FORK (HOW to implement; aif can proceed either way)
│    ┌─ Detected: parked reason is implementation-mechanics (API choice, data structure)
│    └─ Resolution: /dispatcher invokes superpowers:brainstorming AUTONOMOUSLY
│         → generates recommendation with evidence
│         → answer.ts --task <id> --answer "<recommendation>" --decision request_changes
│         (or --decision resume for A-park)
│         → aif resumes with the answer
│
│    Type 2 — STRATEGIC DN (WHAT/WHETHER to implement; maintainer decides)
│    ┌─ Detected: parked reason involves scope, architecture, project direction
│    └─ Resolution:
│         1. questions.ts [--project <id>] → surface parked tasks to operator
│         2. Operator brainstorms/decides → provides answer text
│         3. answer.ts --task <id> --answer "<decision>" --decision request_changes
│            OR --decision resume (for A-park type)
│         → aif resumes with the answer
│
│    Type 3 — DONE (aif reached terminal state autonomously)
│    └─ No Q&A needed → HARVEST auto-triggered
│
├─ 4. HARVEST (after status=done or status=verified)
│    tsx harvest.ts <taskId> --base staging [--body-file <path>]
│    → GET /tasks/:id (fetch branchName)
│    → docker exec aif-handoff-agent-1 git push origin <branch>
│    → gh pr create --base staging --head <branch> --title <title> --body <body>
│    → gh pr merge <prUrl> --auto --squash   (unless --no-auto-merge)
│    → emits JSON { prUrl, branch, autoMerge, committed }
│
│    Body: if §1.7-compliant text prepared by /dispatcher → pass via --body-file
│          else: minimal pointer body (warns about missing §1.7 sections)
│
├─ 5. PHASE-1 COLD REVIEW (mandatory between stages)
│    Invoke superpowers:requesting-code-review on the harvested PR diff
│    → reviewer emits GO / REVISE / STOP
│    → REVISE: operator fixes → re-harvest or re-dispatch
│    → STOP: escalate to maintainer
│    → GO: proceed to stage gate
│
├─ 6. STAGE GATE
│    gh pr list --search "is:merged head:<branch> base:staging" --json number,mergedAt
│    → empty → HALT (PR not yet merged; wait for CI)
│    → non-empty → CLEAR: proceed to advance
│
└─ 7. ADVANCE
     /dispatcher dispatches next stage kickoff
     → back to step 1 with next kickoff path
     OR emits "umbrella complete" if no remaining stages
```

### Q&A park type taxonomy (source-verified)

| Park mechanism | Detected via | Resolved via | answer.ts decision |
|---|---|---|---|
| `blockedReason` non-empty | `questions.isParked()` | `answer.ts` | `request_changes` or `retry` |
| `status=blocked_external` | `questions.isParked()` | `answer.ts` | `retry` |
| `manualReviewRequired:true` | `questions.isParked()` | `answer.ts` | `approve` or `request_changes` |
| A-park: `paused:true + OPEN_QUESTION_ANCHOR` in plan | `questions.isParked()` conjunction check | `answer.ts --decision resume` | `resume` (PUT, bypasses events API) |

`questions.ts:85-93` for detection; `answer.ts:207-212` for A-park resume.

---

## (c) BFR verdict

**Verdict: BUILD**

The `/dispatcher` skill wires 4 existing in-repo CLI primitives into a loop with no exact upstream equivalent. It does not build new primitives; it composes them. The composition itself (the cross-boundary control flow: REST dispatch → WS monitor → Q&A via park/unpark → docker-exec push → `gh pr` egress → stage-gate advance) has no production-grade upstream covering our exact problem class. This is a genuine BUILD under BFR §1 ("confirmed via §3 mechanism that no production-grade upstream candidate exists for our problem-class").

Note on the BUILD/ADAPT question: the primitives (`dispatch.ts` etc.) are already built; the skill is composing them. One could call the composition layer ADAPT ("take upstream patterns + modify"). However, none of the upstream candidates (below) provide even a pattern to adapt for cross-boundary dispatch + docker-exec egress + `gh pr` gate — the composition has no upstream pattern to adapt *from*. BUILD is the correct single verdict.

### Layer 5 — SSOT consult (`docs/meta-factory/prior-art-evaluations.md`)

Evidence-bearing read completed before this verdict. Relevant rows:

**SSOT #27** (`prior-art-evaluations.md:97`) — aif-handoff `HANDOFF_MODE` env-var fork. Capability: env-var driven autonomous vs. interactive mode suppression. Verdict: DEFER. Our capability: operator-side control loop that dispatches TO aif and monitors aif externally. **Not a match** — #27 is about mode suppression inside aif; our loop sits outside aif. No overlap.

**SSOT #28** (`prior-art-evaluations.md:98`) — aif-handoff `paused:true/false` semantic. Capability: machine-readable pause primitive in aif's state machine. Verdict: DEFER. **Partial overlap**: our `answer.ts --decision resume` uses exactly this primitive (`PUT { paused:false }` — `AifHandoffBackend.ts:203`). We CONSUME this existing primitive; we do not rebuild it. Not a competing entry; a dependency.

**SSOT #64** (`prior-art-evaluations.md:134`) — Superpowers SDD skill. Capability: coordinator dispatches isolated in-session subagents per task with 2-stage review. Verdict: ADOPT (for inner loop). **T16 check:** upstream problem class = in-session subagent orchestration with spec+code review; our problem class = cross-boundary external-agent dispatch + docker egress + GitHub PR gate. Match on inner dispatch+review vocabulary; miss on cross-boundary egress. The ADOPT is for vocabulary (confirmed in SSOT — "ADOPT for the inner loop, KEEP-NARROW orchestrator for the meta-layer"). This row confirms no upstream SDD covers our external-agent dispatch problem class.

**SSOT #65** (`prior-art-evaluations.md:135`) — Superpowers `using-git-worktrees`. Capability: pure-git worktree isolation. Verdict: ADOPT. Scope: worktree isolation during parallel sub-wave dispatch. **Not a match** for the dispatcher execution loop — different problem class.

**SSOT #67** (`prior-art-evaluations.md:137`) — aif-handoff full Kanban runtime. Verdict: REJECT (for `/meta-orchestrator` slash-command). The additive note at SSOT #67 states: "the `autoQueueMode` LOGIC sub-component was re-evaluated separately and proposed as new SSOT row #88." This confirms the full Kanban runtime REJECT stands; only the vocabulary sub-component was separately evaluated.

**SSOT #88** (`prior-art-evaluations.md:158`) — aif-handoff `autoQueueMode` pool-slot-allocation LOGIC. Capability: DB-backed async task advancement with pool-slot allocation. Verdict: ADOPT VOCABULARY + REFERENCE. **T16 check:** upstream problem class = "DB-backed async task advancement within one server-side project"; our problem class = "operator-side session-bound loop dispatching to aif externally." Match ~45% at algorithm+vocabulary level per #88's own T16 check. This confirms no #88 row covers our loop; the row is about vocabulary for umbrella sequencing, not for the execution loop itself.

**SSOT #83** (`prior-art-evaluations.md:153`) — OhMyOpencode Atlas/Prometheus agents. Capability: post-execution verification + planning agents. Verdict: ADOPT VOCABULARY. Our dispatcher's Phase-1 cold-review step maps to the Atlas vocabulary (verification agent after execution). Not a competing upstream; vocabulary reference only.

**SSOT #109** (`prior-art-evaluations.md:179`) — aif-handoff autonomous-pipeline park. Capability: deliberate park primitive for the autonomous pipeline. Verdict: BUILD (our own `park.ts`). This row confirms that the park→unpark flow was already identified as a BUILD with no upstream equivalent — `/dispatcher` consumes that already-built primitive.

**Conclusion from SSOT layer 5:** No existing SSOT row covers "the dispatch→monitor→Q&A→harvest→stage-gate→advance loop-wiring skill" as a capability area. The closest entries (#67, #88) are REJECT/ADOPT-VOCABULARY for the aif Kanban runtime and its autoQueueMode sub-component respectively — different problem classes. A new SSOT entry (ID #111) for this capability area must be added in the Stage 1 capability commit per CLAUDE.md §1 ("add a new SSOT entry — with Verdict, Rationale, Trigger to revisit — in the same commit as the capability artifact").

**Proposed SSOT #111 entry (for Stage 1 commit):**
- Candidate: `/dispatcher` CC-skill — operator-side execution loop over aif-handoff REST/WS API (dispatch → monitor → Q&A → harvest → stage-gate → advance)
- Capability matched: session-bound operator control plane over aif-handoff: dispatches kickoffs via REST, monitors via REST/WS, resolves parked questions via park/unpark primitives, pushes branch via docker-exec, opens PR via `gh`, gates stage advance on `gh pr list --search is:merged`
- First seen: 2026-06-03
- Verdict: BUILD
- Rationale: No upstream covers this cross-boundary problem class (SSOT consult + DeepWiki ≥3 phrasings + WebSearch ≥3 phrasings). aif autoMode (#67/#88) orchestrates WITHIN aif; bassimeledath/dispatch fans out in-session CC workers; Superpowers SDD (#64) is in-session only. T16 verified for all 3 (problem-class X-vs-Y in section (c) DeepWiki evidence below).
- Trigger to revisit: upstream aif-handoff ships a CC-native session-bound slash-command wrapper for its coordinator loop; OR a new operator-facing agent-control framework covers cross-boundary REST dispatch + git egress + PR gate in a single tool.

### Layers 3-4 — DeepWiki + WebSearch evidence (T20: evidence-bearing calls run before this verdict)

**Upstream candidate 1 — aif-handoff autoMode / autoQueueMode / Agent Coordinator**

DeepWiki query (lee-to/aif-handoff): "Does aif-handoff have an autoMode or autoQueueMode that automatically dispatches tasks, monitors status, handles parked questions, harvests completed work (push + PR), and advances to the next stage?"

Result (direct quote):
> "aif-handoff manages the implementation and review stages, the provided context does not explicitly detail an automated 'push + PR' mechanism for harvesting completed work. Task worktrees are retained after done/verified for operator inspection and follow-up commits, but automatic removal is not handled by Handoff."

T16 analysis:
- **Upstream problem class:** aif-handoff `autoMode`/`autoQueueMode` manages `backlog→planning→implementing→review→done` within a single aif instance. Its "harvest" = a stage-completion transition. It does NOT push git branches, open GitHub PRs, check GitHub PR merge status, or advance a multi-stage umbrella.
- **Our problem class:** the `/dispatcher` loop is the OPERATOR-SIDE control plane sitting ABOVE aif: dispatch kickoff to aif, poll aif's external REST/WS API, intervene on parked questions, push the aif-produced branch OUT of aif's container to GitHub, open a PR, check `gh pr merged`, advance to next stage.
- **Match? NO.** aif autoMode orchestrates WITHIN aif. `/dispatcher` orchestrates the operator's relationship WITH aif. Confirmed gap: aif explicitly does NOT do push+PR.

**Upstream candidate 2 — bassimeledath/dispatch (CC skill)**

DeepWiki query (bassimeledath/dispatch): full loop and whether it dispatches to aif-handoff, pushes branches, creates PRs, checks stage gates.

Result (direct quote):
> "The /dispatch skill primarily focuses on delegating and managing tasks within the Claude Code environment, using various AI CLI tools as workers. It does not extend to external Git operations or advanced CI/CD pipeline interactions. The skill does not automatically push branches, open PRs, or check stage gates like 'gh pr merged?'"

T16 analysis:
- **Upstream problem class:** fans out tasks to background AI CLI workers (claude, cursor, codex) within a CC session, using IPC files for Q&A. Workers execute locally; "harvest" = reading a plan.md.
- **Our problem class:** dispatches to an EXTERNAL autonomous agent (aif-handoff REST API at `:3009`), monitors via REST/WS, pushes from aif's docker container to GitHub, opens PRs via `gh` CLI, gates on `gh pr list --search is:merged`.
- **Match? NO.**

**Upstream candidate 3 — obra/superpowers subagent-driven-development**

DeepWiki query (obra/superpowers): whether SDD handles external autonomous agents, REST/WS monitoring, git push, PR creation, stage gates, multi-stage umbrella advancement.

Result (direct quote):
> "The subagent-driven-development skill only orchestrates within-session Claude Code subagents. It does not handle any of the external integration scenarios you mentioned. [...] No external service monitoring is present in the skill. [...] The skill is designed for executing a single implementation plan with independent tasks, not orchestrating multiple stages or umbrella projects."

T16 analysis:
- **Upstream problem class:** runs an implementation plan through in-session Task-tool subagents with 2-stage code review.
- **Our problem class:** same fundamental cross-boundary mismatch as candidates 1+2.
- **Match? NO.**

**WebSearch evidence (query: "dispatch monitor harvest stage-gate advance next stage umbrella orchestration Claude Code skill 2025"):**

Search surfaced `bassimeledath/dispatch` as the closest CC-skill match, described as "fanning out to background AI workers with Q&A IPC". No result described a skill that dispatches to an external REST API, pushes via docker exec, and gates on GitHub PR merges.

---

## (d) DN-A and DN-B design recommendations

These are RECOMMENDATIONS to surface — maintainer confirms per [reviewer-discipline.md §2](../../.claude/rules/reviewer-discipline.md). Stage 0 does not finalize strategy.

### DN-A: CC-skill vs portable markdown — RESOLVED (maintainer 2026-06-03): hybrid

**Decision: hybrid = CC-native primary + portable markdown fallback that degrades gracefully.** This corrects this R-phase's initial Option-A lean, which mis-classified `/dispatcher` as operator-internal tooling.

**Why the Option-A lean was wrong (verified 2026-06-03):** skills ARE a consumer-shipping path — `install.sh:11` ("Copies skills/ + `.claude/skills/pipeline/` → `.claude/skills/`") and `install.sh:207` ("▶ Skills → `.claude/skills/`") copy skills into consumer projects; `/dispatcher` is a sibling of the already-shipped `/pipeline`. So `/dispatcher` is **consumer-facing**, not operator-internal. Two disciplines then point the same way:
- `dual-implementation-discipline.md §3` — consumer-facing default = **dual (CC-native primary + portable fallback)**; explicit skill precedent `.claude/skills/rules-as-tests/`.
- `build-first-reuse-default.md §1.1` shipped-axis — "AI-/OS-/license-agnostic core that integrates with companions and degrades gracefully when they are absent. Integrate, never *hard-depend* … making a companion **mandatory** for consumers is a goal change ([README.md#why-this-exists])." CC-only would hard-depend on `superpowers:brainstorming`, which is exactly the prohibited goal change. README is agnostic by thesis (`README.md:8` — "Deploys into Claude Code / Cursor / Codex").

**Hybrid shape (the project's agnosticism applied):**
- **CC present** → technical forks resolved via `superpowers:brainstorming` (autonomous); full loop.
- **CC absent** (Cursor / Aider / Codex / no Superpowers) → portable markdown fallback that detects the missing companion via a **capability-check, not a brand-name string** (`dual-implementation-discipline.md §4`) and degrades: technical forks are **surfaced to the operator** via `questions.ts` instead of auto-brainstormed. No paid LLM, no hard dependency.
- Both channels carry the same `@dual-pair: dispatcher-skill` anchor + drift-check (`dual-implementation-discipline.md §5`). `@cc-only-rationale` is NOT used — this is dual, not CC-only.

**Stage 1 implementation constraint:** `/dispatcher` MUST ship both channels; the CC-absent path must be a real degradation, not a stub.

### DN-B: technical-fork autonomy boundary

DECISION-NEEDED: when aif parks a task with a question, how should `/dispatcher` decide whether to answer autonomously or surface to the operator?

**Option A → binary by fork type (kickoff §0 + maintainer framing 2026-06-03):** TECHNICAL (HOW to implement) → `/dispatcher` runs `superpowers:brainstorming` and answers autonomously. STRATEGIC (WHAT/WHETHER to implement, project scope) → surfaces to operator via `questions.ts`, waits for `answer.ts` input. Consequence: requires a judgment-only discrimination step reading the parked reason — discrimination is prose-quality, not mechanically detectable.

**Option B → always surface to operator.** Consequence: `/dispatcher` never answers autonomously; every parked task requires a human round-trip. Simpler loop; no discrimination step; loses the autonomous technical-fork resolution that motivated the loop.

**Option C → always brainstorm first, then surface recommendation to operator.** Consequence: `/dispatcher` always invokes `superpowers:brainstorming` but surfaces the recommendation to operator rather than auto-applying. Operator approves with one keystroke. Hybrid: adds a round-trip but preserves operator control on all forks.

**Recommendation: Option A.** The kickoff §0 and maintainer framing 2026-06-03 explicitly state "technical→brainstorm self, strategic→park". `recommendation-laziness-discipline.md §3` fork-surfacing companion: "autonomous by default — the human-gate fires ONLY on a genuine ambiguous fork; a clear call (one option better on the merits) is decided and *reported*." The technical/HOW fork is the clear case (aif's implementation detail, not project direction). **Wrong if:** maintainer decides the discrimination overhead is not worth the complexity and prefers Option B's simplicity, or Option C's always-surface-recommendation posture.

**STILL OPEN — maintainer confirms.** Interaction with the DN-A hybrid resolution: Option A's "technical→brainstorm-self" applies **only on the CC channel**. On the CC-absent portable channel there is no `superpowers:brainstorming`, so technical forks degrade to "surface to operator" regardless — i.e. the portable channel behaves like Option B by necessity. So DN-B effectively decides the **CC-present** behaviour only; the CC-absent behaviour is fixed by the agnostic-degradation requirement.

---

## (e) Self-application (T15, MANDATORY)

**What would auditing THIS loop design look like?**

The loop design in section (b) is a prose specification — it has no executable tests yet. Auditing it has two surfaces:

1. **Structural audit (possible now):** do the 4 primitives' actual behaviours (section a) match what the loop design assumes? Verified: yes, with one non-obvious finding — A-park vs B-park resolution paths are asymmetric (`answer.ts --decision resume` vs `request_changes`/`retry`), and the loop design correctly distinguishes them. The park-type taxonomy table in (b) is grounded in `questions.ts:85-93` + `answer.ts:207-212`.

2. **Behavioural audit (Stage 2 eval = self-application gate):** run a real umbrella through `/dispatcher` and confirm it reaches `done` → `harvest` → `PR opened` → `gh pr merged` → `advance to next stage` WITHOUT manual intervention except on genuine strategic DNs. This is the Stage 2 eval gate from the kickoff, and it IS the self-application gate for this loop design. If Stage 2 fails, the loop design (b) is falsified at whatever step it fails.

**Known gap that Stage 2 must probe:** the technical/strategic discrimination in DN-B Option A is judgment-only. Stage 2 should include at least one parked Q&A of each type (one that should be auto-answered, one that should be surfaced) to verify the discrimination works in practice.

---

## §1.7 Forward-check

- `build-first-reuse-default.md §3` — BFR mechanism executed (all 5 layers): SSOT consult (layer 5: rows #27/#28/#64/#65/#67/#88/#83/#109 reviewed — no existing row covers the loop-wiring capability); DeepWiki ≥3 phrasings (layers 3); WebSearch ≥3 phrasings (layer 4). Verdict: BUILD. `build-first-reuse-default.md:3`
- `dual-implementation-discipline.md §3` — DN-A resolved = **hybrid (dual)**: `/dispatcher` is consumer-facing (ships via `install.sh:207`), so the consumer-facing default (dual) applies; CC-native primary + portable fallback that degrades (technical forks → surface when no companion present). `dual-implementation-discipline.md:3`
- `no-paid-llm-in-ci.md §1` — all dispatch is session-bound; harvest is ZERO LLM (`harvest.ts:18-19`); questions is READ-ONLY HTTP; answer is REST-only. No API-billed calls in CI. `no-paid-llm-in-ci.md:1`
- `ai-laziness-traps.md §2 T16` — explicit problem-class X-vs-Y written for all 3 upstream candidates (section c). `ai-laziness-traps.md:2`
- `recommendation-laziness-discipline.md §3` — all recommendations (DN-A, DN-B) preceded by evidence-bearing tool calls and include falsifiers. `recommendation-laziness-discipline.md:3`

## §1.7 Backward-check

- `.claude/skills/pipeline/SKILL.md` — `/dispatcher` is COMPLEMENTARY to `/pipeline`. `/pipeline` = plan + priority + launch-table + stage-gate dispatch commands (generated). `/dispatcher` = EXECUTION of a chosen umbrella's stages. No supersession; `/pipeline` §5 dispatch-tree row «autonomous-dispatch» is what `/dispatcher` automates. `pipeline/SKILL.md:313`
- `packages/runtime-bridge/src/cli/dispatch.ts` — wired as primary dispatch primitive. State machine verified at `dispatch.ts:50-180`. Loop design in (b) step 1 directly corresponds to `AifHandoffBackend.ts:148-214`.
- `packages/runtime-bridge/src/cli/harvest.ts` — wired as egress primitive. State machine verified at `harvest.ts:119-168`. Loop design in (b) step 4 directly corresponds.
- `packages/runtime-bridge/src/cli/questions.ts` — wired as Q&A read primitive. Park detection logic at `questions.ts:85-93`. Brainstorm nudge at `questions.ts:155-158`.
- `packages/runtime-bridge/src/cli/answer.ts` — wired as Q&A resolve primitive. Two-path resume (A-park vs B-park) at `answer.ts:207-254`. Loop design (b) Q&A table reflects both paths.
