# runtime-bridge — CLI reference

> **Authoritative for:** the `packages/runtime-bridge` CLI command reference — one section per
> entrypoint under `packages/runtime-bridge/src/cli/`, each with Usage, Flags, and Example.
> **NOT authoritative for:** architecture and design rationale — see [`DESIGN.md`](./DESIGN.md).

`packages/runtime-bridge/` bridges this repo's orchestrator to the
[`aif-handoff`](https://github.com/lee-to/aif-handoff) autonomous agent runtime. It exposes seven
CLI entrypoints under `packages/runtime-bridge/src/cli/`. This is the operator-facing reference
manual: one section per command (ordered by name), each with **Usage**, **Flags**, and **Example**.

For the architecture and design rationale see [`DESIGN.md`](./DESIGN.md). The authoritative usage
for each command is its source file's header docblock — this reference is derived from those
docblocks and does not introduce flags that the CLIs do not parse.

All commands are pure TypeScript run via `tsx`. Run them from the repo root.

## Commands

- [`answer`](#answer) — push the resolved answer back and resume the agent.
- [`await`](#await) — watch a dispatched task to a terminal state and print the result.
- [`dispatch`](#dispatch) — send a kickoff to the agent runtime (creates a task).
- [`ensure-parallel`](#ensure-parallel) — self-heal a project's `parallelEnabled` DB flag.
- [`harvest`](#harvest) — push the agent's committed branch, open a PR, arm auto-merge.
- [`park`](#park) — agent-side: stop on a hard fork and ask the operator.
- [`questions`](#questions) — list parked questions awaiting an operator answer.

---

## answer

The resolve side of the question-loop: after a human brainstorms a parked task's question(s) (which
`questions` surfaced), `answer` pushes the resolution back into `aif-handoff` and resumes the task so
the agent finishes it — removing the "re-open the task in the UI and paste the answer" step.

It is non-destructive: it only ever creates a comment and dispatches a forward state-machine event —
no DELETE, no force-push. A second run on an already-resumed task is rejected by the state machine
(4xx → `BackendError`), never silently duplicated.

Decision → sequence:

- `request_changes` (default): attach the answer as a comment, then fire `request_changes` →
  the task goes `done → implementing` with `reworkRequested:true` (aif redoes the work with the feedback).
- `approve`: fire `approve_done` → `done → verified`.
- `retry`: fire `retry_from_blocked` → `blocked_external → prior status`.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --answer "<text>" [--decision request_changes] [--json]
tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision approve
tsx packages/runtime-bridge/src/cli/answer.ts --task <id> --decision retry
```

Config (env): `RUNTIME_BRIDGE_AIF_URL` — base URL (default `http://localhost:3009`).

### Flags

| Flag | Description |
| --- | --- |
| `--task <id>` | **Required.** The parked task to resolve. |
| `--answer <text>` | The resolution text; **required** for `request_changes` (attached as a comment). |
| `--decision <d>` | `request_changes` (default) \| `approve` \| `retry`. |
| `--json` | Print the result as a JSON object. |

Exit codes: `0` — answer pushed + task resumed; `1` — missing/invalid args, or a REST error
(message on stderr).

### Example

```bash
tsx packages/runtime-bridge/src/cli/answer.ts \
  --task "$HANDOFF_TASK_ID" \
  --answer "Use Option B (per-command reference)." \
  --decision request_changes
```

---

## await

Closes the "результат назад" (result read-back) loop: `dispatch` fires the task fire-and-forget
(fast — it runs inside a PostToolUse hook that must not block); `await` is run afterwards to watch
the task to a terminal state and print the result, removing the manual "go check aif-handoff's UI"
step.

Modes:

- **default** — block on `awaitDone` (WebSocket status stream) until the task is `done`/`verified`
  (success) or `blocked_external` (resolves, not success), then print the `TaskResult` as JSON.
  `--timeout-ms` bounds the wait.
- **`--once`** — non-blocking `getStatus` snapshot (point-in-time), print and exit.

The backend is resolved the same way as `dispatch` (`RUNTIME_BRIDGE_MODE` + `available()`). In default
mode with **no** `--timeout-ms`, this **blocks** until the task reaches a terminal state; for long
autonomous runs that is intended. A startup notice is printed to stderr; pass `--timeout-ms` to bound
the wait.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/await.ts <taskId> [--timeout-ms N]
tsx packages/runtime-bridge/src/cli/await.ts <taskId> --once
```

### Flags

| Flag | Description |
| --- | --- |
| `<taskId>` | **Required (positional).** The dispatched task to watch. |
| `--timeout-ms N` | Bound the wait in default (await) mode. |
| `--once` | Non-blocking snapshot: print the current status and exit. |

Exit codes:

- default (await): `0` = terminal success (`done`/`verified`); `1` = non-success
  (`blocked_external`) / timeout / error.
- `--once` (snapshot): `0` unless the backend reports an `error` state. A still-running task
  (`pending`/`running`) also exits `0` — a snapshot is not a verdict; use the default mode when you
  need a terminal success/fail code.

### Example

```bash
tsx packages/runtime-bridge/src/cli/await.ts "$HANDOFF_TASK_ID" --timeout-ms 600000
```

---

## dispatch

The injection leg, invoked by the PostToolUse hook. It builds a `KickoffSpec` from the kickoff path,
checks idempotency (dedup by content hash, TTL 24h), resolves the backend, dispatches the kickoff, and
records a dedup entry. On `quota_exceeded` / `unavailable` it falls back to `ManualBackend` with a
stderr warning.

> **Auto-dispatch is opt-IN at the hook layer** (kickoff §7, 2026-05-31): the PostToolUse hook
> invokes this entrypoint ONLY when the kickoff's first line is exactly `<!-- bridge: auto -->`.
> Default = no auto-dispatch; run `tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path>`
> manually on demand (no marker needed on the manual path). Consumers who ran
> `setup-runtime-bridge.sh` before this flip hold a stale opt-OUT hook copy — re-run the script.

Behaviour:

1. Build `KickoffSpec` from the kickoff path with `{ requireAutoMarker: false }` — the manual-path
   opt-out of the library's opt-in default (null → `bridge: skip` marker → exit 0).
2. Check idempotency (dedup by content hash, TTL 24h) → if hit, exit 0.
3. Resolve backend (`RUNTIME_BRIDGE_MODE` env, probe `available()`).
4. Dispatch kickoff → record dedup entry.
5. Output JSON `hookSpecificOutput.additionalContext` for the CC PostToolUse contract.
6. On `quota_exceeded` / `unavailable` → fall back to `ManualBackend` + stderr warn.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path>
```

### Flags

| Flag | Description |
| --- | --- |
| `<kickoff-path>` | **Required (positional).** Path to the kickoff file to dispatch. |

Exit codes: `0` always — non-blocking injection per the
`rule-enforcement-channel-selection §4` "injection, never gate" contract.

### Example

```bash
tsx packages/runtime-bridge/src/cli/dispatch.ts /tmp/qloop-battletest/kickoff.md
```

---

## ensure-parallel

The self-heal half of Finding A (`dirty_worktree`). `aif` creates a per-task git worktree only
when a 3-gate AND holds (`AIF_TASK_WORKTREES_ENABLED` env && `project.parallelEnabled` DB flag &&
`projectSupportsTaskWorktrees`). `parallelEnabled` is a project-level DB flag settable only via the
web UI / raw DB — no env or config.yaml knob — so a freshly-provisioned instance has it `0` and
every task runs in-place on the shared checkout, dirtying it and 409-ing the next dispatch on
`dirty_worktree`. This guard re-applies the fix on any instance.

It does a full-project round-trip rather than a minimal PUT: `aif` exposes no targeted
`parallelEnabled` write (only `PATCH /:id/auto-queue-mode` exists), and the sole `parallelEnabled`
path is the full `PUT /projects/:id`, whose handler NULLs any omitted `*MaxBudgetUsd` field. So the
guard reads the full project back from `GET /projects` and writes every field, flipping only
`parallelEnabled` — a minimal PUT would silently wipe any UI-set budget.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/ensure-parallel.ts --project <id>
# --project defaults to $RUNTIME_BRIDGE_AIF_PROJECT_ID.
```

### Flags

| Flag | Description |
| --- | --- |
| `--project <id>` | The project to enable. Defaults to `$RUNTIME_BRIDGE_AIF_PROJECT_ID`. |
| `--json` | Print the result as a JSON object. |

Exit codes: `0` — already-enabled or enabled-now; `1` — bad args / project missing / REST error
(message on stderr).

### Example

```bash
tsx packages/runtime-bridge/src/cli/ensure-parallel.ts --project "$RUNTIME_BRIDGE_AIF_PROJECT_ID"
```

---

## harvest

The deterministic egress leg. `aif-handoff` ends a task at "committed on a local feature branch" — it
has no push and no PR-creation in its autonomous path. `harvest` closes that gap: it reads the task's
persisted `branchName` from aif's REST API, pushes that already-made commit out of aif's container to
`origin`, opens a PR against the trunk, and arms GitHub native auto-merge (which merges on green CI).

Zero LLM by construction — plain `git` + `gh` (complies with `no-paid-llm-in-ci.md`). The push happens
from **inside** aif's container (`docker exec <container> git … push`), which already carries working
push creds; the PR is opened from the host where `gh` is authenticated. If docker / the container is
unavailable, harvest prints the exact manual `git`+`gh` commands and exits non-zero rather than
guessing — graceful degradation, no silent half-egress.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/harvest.ts <taskId> \
  [--base <branch>] [--body-file <path>] [--no-auto-merge] [--container <name>]
```

### Flags

| Flag | Description |
| --- | --- |
| `<taskId>` | **Required (positional).** The task whose committed branch to harvest. |
| `--base <branch>` | PR base branch (default `staging`). |
| `--body-file <path>` | File whose contents become the PR body. |
| `--no-auto-merge` | Do not arm GitHub native auto-merge. |
| `--container <name>` | aif container to push from (default `$RUNTIME_BRIDGE_AIF_CONTAINER`, else `aif-handoff-agent-1`). |

Exit codes: `0` = branch pushed + PR opened; `1` = guard failed / push or PR error (the operator runs
the printed fallback commands).

### Example

```bash
tsx packages/runtime-bridge/src/cli/harvest.ts "$HANDOFF_TASK_ID" --base staging
```

---

## park

The agent-side "I hit a hard fork, stop and ask" half. The autonomous agent runs this on a genuine
**blocking** fork it cannot default. Soft/advisory questions do **not** use this — they already flow
non-blocking to chat. This is only for a hard fork that blocks continuing the implementation.

Mechanism: `PUT /tasks/:id { paused:true, blockedReason, plan }`.

- `paused:true` is **the stop** — the coordinator candidate query filters `paused=false`, so the
  agent is not re-picked (`blockedReason` alone does **not** stop it).
- `blockedReason` carries the question and makes `questions`' `isParked()` true.
- `plan` gains a `## ⏸ OPEN QUESTION` anchor that the resume answer is injected under.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/park.ts --task <id> --question "<fork + options>"
# --task defaults to $HANDOFF_TASK_ID (set in the aif agent context).
```

Config (env): `RUNTIME_BRIDGE_AIF_URL` (default `http://localhost:3009`).

### Flags

| Flag | Description |
| --- | --- |
| `--task <id>` | The task to park. Defaults to `$HANDOFF_TASK_ID`. |
| `--question <text>` | **Required.** The fork plus its options (the operator-facing question). |
| `--json` | Print the result as a JSON object. |

Exit codes: `0` parked; `1` bad args or REST error (message on stderr).

### Example

```bash
RUNTIME_BRIDGE_AIF_URL=http://api:3009 \
  tsx packages/runtime-bridge/src/cli/park.ts \
  --task "$HANDOFF_TASK_ID" \
  --question "README structure fork — Option A (narrative) OR Option B (per-command reference). Operator preference required."
```

---

## questions

The "parked questions" collector half. When an aif agent hits a genuine fork it parks the task for
human input (`manualReviewRequired` / `blocked_external` / a `blockedReason` note) rather than
guessing. `questions` pulls every such parked task from the `aif-handoff` REST API and prints them in
one place so a human can resolve them in a single pass — removing the "scan the UI for stuck tasks"
step.

A task is "parked / awaiting human" when **any** of:

- `manualReviewRequired === true`, or
- `status === 'blocked_external'`, or
- `blockedReason` is a non-empty string.

### Usage

```bash
tsx packages/runtime-bridge/src/cli/questions.ts [--project <id>] [--json]
```

Config (env): `RUNTIME_BRIDGE_AIF_URL` — base URL (default `http://localhost:3009`);
`RUNTIME_BRIDGE_AIF_PROJECT_ID` — optional project filter (overridable by `--project`).

### Flags

| Flag | Description |
| --- | --- |
| `--project <id>` | Filter to one `projectId` (overrides `$RUNTIME_BRIDGE_AIF_PROJECT_ID`). |
| `--json` | Print the selected tasks as a JSON array (for piping into a chat). |

Exit codes: `0` — success, even when zero tasks are parked; `1` — fetch/parse error (message on
stderr).

### Example

```bash
tsx packages/runtime-bridge/src/cli/questions.ts --json
```

---

## Operator runbook — `/fire` cloud dispatch (opt-in)

`AifFireBackend` lets you dispatch a kickoff to a CC Routine via the `/fire` API when you want the
agent to run in the cloud (laptop-closed / async). This is **operator-manual only** — it is **not**
the default backend (REST `AifHandoffBackend` remains the default with full `cli/await.ts` parity).

### Overview

- **Dispatch-only, no `await` parity.** `/fire` returns a `session_url`; the routine runs asynchronously.
  `awaitDone()` resolves immediately with `{ success:false, finalStatus:'dispatched_no_readback' }` and
  `meta.sessionUrl` — it does **not** block or poll (the token has no read access by design).
- **REST remains the default.** `AifHandoffBackend` is the agnostic default with full WebSocket
  status readback. Use `AifFireBackend` only when you need laptop-closed / cloud dispatch.
- Cross-reference: [`docs/meta-factory/research-patches/2026-06-01-f2-runtime-bridge-fire.md`](../../docs/meta-factory/research-patches/2026-06-01-f2-runtime-bridge-fire.md) (F2 R-phase).

### Step 1 — Create a routine and generate an API trigger token

1. Go to `claude.ai/code/routines` → select or create your routine.
2. Open **Settings → Triggers** → click **Add API trigger**.
3. Click **Generate token** — copy it now (shown once only).
4. Note the **routine ID** from the URL (`/routines/<routine-id>`).

### Step 2 — Configure env vars

```bash
export RUNTIME_BRIDGE_FIRE_ROUTINE_ID="<routine-id>"
export RUNTIME_BRIDGE_FIRE_TOKEN="sk-ant-oat01-…"
# Optional overrides (defaults shown):
# export RUNTIME_BRIDGE_FIRE_BASE_URL="https://api.anthropic.com/v1/claude_code/routines"
# export RUNTIME_BRIDGE_FIRE_BETA="experimental-cc-routine-2026-04-01"
# export RUNTIME_BRIDGE_FIRE_ANTHROPIC_VERSION="2023-06-01"
```

### Step 3 — Fire via the curl helper (operator-manual)

```bash
# Inline text:
bash scripts/fire-routine.sh --text "Run the f2-aif-fire-backend I-phase per the kickoff."

# From a kickoff file:
bash scripts/fire-routine.sh --text "$(cat .claude/orchestrator-prompts/my-umbrella/kickoff.md)"

# Output: the claude_code_session_url (open in a browser to monitor)
```

Or use `AifFireBackend` directly in TypeScript:

```typescript
import { AifFireBackend } from '@rules-as-tests-aif/runtime-bridge';

const backend = new AifFireBackend(); // reads env vars
const handle = await backend.dispatch({ filePath, content, umbrellaName, contentHash });
// handle.sessionUrl — open this in a browser
const result = await backend.awaitDone(handle);
// result.success === false, result.finalStatus === 'dispatched_no_readback'
// result.meta.sessionUrl — same URL for browser monitoring
```

### Step 4 — Monitor the session in a browser

Open `handle.sessionUrl` (printed by the curl helper) in a browser. The routine's agent runs in
the cloud; you can close your laptop and come back later.

### Step 5 — Review the routine's PR

When the agent finishes, it creates a PR in the linked repository. Review and merge it as normal.

### Cost policy (DN-2)

| Usage pattern | Verdict |
| --- | --- |
| Operator-manual `/fire` (subscription-bundled) | **OK** — draws from the operator's Claude Max subscription, no per-call API billing beyond subscription overage. |
| Committed-CI `/fire` in `.github/workflows/*` | **DEFER-permanent** — classified as `#paid-llm-creep` under [`.claude/rules/no-paid-llm-in-ci.md §3`](../../.claude/rules/no-paid-llm-in-ci.md). Each CI invocation draws subscription usage + possible metered overage silently. No CI workflow may call `/fire` or `routines/*/fire`. |

This is the DN-2 resolution from the F2 brainstorm (2026-06-01). The DEFER-permanent verdict for
committed-CI usage is permanent under the project's no-paid-LLM-in-CI policy; it is not
"armed-and-waiting" — it requires an explicit policy change and a separate PR to unblock.
