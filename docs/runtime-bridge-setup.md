# Runtime bridge — consumer setup

> **Authoritative for:** consumer-facing setup of the runtime bridge (Phase 1, aif-handoff backend) — install/opt-out flow, the `--profile factory` guided install and its `AIF_GUIDED_INSTALL` consent knob, required config env, cost-cap behaviour, port layout, and the auto-review escalation path.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../README.md#why-this-exists). The bridge architecture/interface — see [packages/runtime-bridge/DESIGN.md](../packages/runtime-bridge/DESIGN.md). amux backend — Phase 2 (not yet functional).

The runtime bridge lets `/pipeline` kickoffs dispatch cross-session work to an aif-handoff runtime instead of manual copy-paste. It is **opt-in**: with nothing installed, `ManualBackend` (copy-paste) is always the default, and the bridge never degrades that experience — it only adds automation when aif-handoff is present and you opt in.

## Quick start

**One-click path:** `./setup` (framework repo root) offers this setup as its final step. Its guided-detect layer (`setup.d/bridge-guided.sh`) keys on `/health`, so detection is **runtime-agnostic** — aif-handoff may run in docker OR natively; the installer never assumes docker. If the service is unreachable, it diagnoses the run mode and prints the matching bring-up instruction (docker daemon available → `docker compose up -d` in your aif-handoff checkout; native CLI on `PATH` → start it; neither → an install pointer to this doc) — bring the service up and re-run; detection re-probes `/health` and reports reachable / not reachable explicitly, never silently.

**Direct path:**

```bash
# run from your project root
bash packages/runtime-bridge/scripts/setup-runtime-bridge.sh
```

The script probes `${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/health` for a reachable aif-handoff coordinator (docker or native — the signal is transport-agnostic) and reports the result explicitly, then asks whether to enable the bridge:

- **yes** → it writes the required `RUNTIME_BRIDGE_*` env to your shell rc, copies the PostToolUse hook into `.claude/hooks/`, and **offers to auto-write** the PostToolUse entry to `.claude/settings.json` (idempotent — skips if the entry is already present; backs up to `settings.json.bak` before writing; JSON-validates before swapping; preserves all existing hooks). Pass `--no-write-settings` or decline the prompt to fall back to printing the snippet for manual pasting. Note: the *agent* (Claude Code) is deny-listed from editing `settings.json` via its `Edit(.claude/settings.json)` / `Write(.claude/settings.json)` tool permissions — that deny-list binds the agent's tool calls, not this human-run setup script, which is why the script may write safely with backup + validation + consent.
- **no** → it prints the per-task opt-out marker and changes nothing.

On **yes** the script prompts for your aif-handoff project UUID; leaving it empty triggers an **explicit warning** — the bridge will throw `dispatch_failed` and stay on `ManualBackend` until `RUNTIME_BRIDGE_AIF_PROJECT_ID` is set. No silent degrade at setup time (the silent fallback described under *Required config env* below is the runtime's behaviour when the env is missing, not the setup script's).

The script **detects and instructs — it never installs aif-handoff for you** (`docker compose up`, MCP server bring-up, and the `transport: "cli"` profile change are yours to run). The one path that *can* install it is the factory-profile guided install described in the next section, and only on explicit consent.

## Guided install under `--profile factory` (`AIF_GUIDED_INSTALL`)

The Quick-start paths above only **detect** aif-handoff. Under the **factory profile** the installer additionally offers to *install* it, behind explicit consent. Line references below are to `setup.d/aif-handoff-guided-install.sh` unless prefixed with another filename.

**When it fires.** `install.sh` runs the helper after the `setup.d/` layer loop when `PROFILE=factory` **or** `WITH_AIF_SUITE` is set (`install.sh:1302`) — i.e. `./setup --profile factory`, `./setup --all`, or the legacy `--with-aif-suite`. Under `--profile core` / `--profile env` the block is skipped entirely. If the install payload does not carry the helper (a core-only checkout later refreshed with `--profile factory`), the step prints a pointer to this doc and continues (`install.sh:1304-1307`).

**What it does.** The helper reuses `bridge_diagnose` — the same `/health` probe as the detect-only path (`setup.d/bridge-guided.sh:18-27`) — and branches on the state it reports:

| Diagnosed state | Behaviour | Prompts? |
|---|---|---|
| `up` | detect-first: prints `✓ aif-handoff already running`, does nothing else (`:111-116`) | no |
| `docker` (daemon answering) | **the only install path** — asks for consent, then clones + `docker compose up -d` (`:117-165`) | yes, unless pre-answered |
| `native` (aif-handoff CLI on `PATH`, not responding) | prints "start it manually (e.g. `aif-handoff serve`), then re-run with `--profile factory`", then degrades (`:166-173`) | no |
| `docker-down` (docker binary present, daemon stopped) | prints "start docker, then re-run", then degrades (`:174-184`) | no |
| `absent` (no docker binary, no CLI) | prints "install docker, then re-run", then degrades (`:185-192`) | no |

On the `docker` path with consent the helper clones `$AIF_HANDOFF_REPO_URL` into `$AIF_HANDOFF_CHECKOUT` — or, when that directory already exists, runs `git -C … pull --ff-only` and tolerates a failed pull (`:131-139`); runs `docker compose up -d` in the checkout (`:142`); then polls `/health` for up to **30 seconds** (`:149-160`). A failed clone, a failed `docker compose up -d`, or a health timeout each append a line to the audit log and fall through to the same degrade path as a decline (`:134-147`, `:161-164`).

**The consent ladder** (`_aif_handoff_resolve_consent`, `:64-89`), evaluated in order:

1. `AIF_GUIDED_INSTALL` = `1` / `y` / `Y` / `yes` / `YES` / `true` → consent granted, no prompt (`:66-71`).
2. `AIF_GUIDED_INSTALL` = `0` / `n` / `N` / `no` / `NO` / `false` → refused, no prompt (`:72-75`). Any other value — including unset or empty — falls through.
3. Otherwise, a non-interactive run (`-y` / `--full` / `--all`, surfaced to the helper as `GETFF_NONINTERACTIVE=1` — `install.sh:1322-1324`) **auto-declines** rather than blocking on a prompt, and prints `Set AIF_GUIDED_INSTALL=1 to opt in without a prompt` (`:77-82`). This preserves `./setup -y`'s never-prompt contract.
4. Otherwise an interactive `Clone aif-handoff + docker compose up -d? [y/N]:` prompt; anything other than `y`/`yes` declines (`:83-88`).

Consequence worth internalising: `./setup --all` on its own will **not** install aif-handoff (it is a `--full` path, so rule 3 applies). The opt-in is `AIF_GUIDED_INSTALL=1 ./setup --all <stack>`.

**Declining is a designed success path.** A decline — and every failure branch above — prints that the factory profile degrades to env-level (multi-model contour placeholders only, no aif runtime) and appends `AIF_HANDOFF: degrade env-level` to the audit log (`:206-212`). `install.sh` additionally wraps the helper in `|| true` (`:1325`), so nothing in this flow can fail the install.

**Dry-run is inert twice over.** `install.sh --dry-run` does not even spawn the helper — it prints a preview instead (`install.sh:1308-1315`). A helper invoked by hand with `GETFF_DRY_RUN=--dry-run` self-gates identically: no probe, no clone, no containers, no audit-log line (`:100-106`).

**Without Docker nothing is installed.** `docker-down` and `absent` are deliberately distinct states with opposite guidance ("start docker" vs "install docker"), and neither one prompts or clones.

**Env knobs for this flow:**

| Env var | Default | Purpose |
|---|---|---|
| `AIF_GUIDED_INSTALL` | unset | `1`/`y`/`yes`/`true` = install without prompting; `0`/`n`/`no`/`false` = never install. Unset → prompt when interactive, auto-decline when not (`:44-48`, `:66-75`). |
| `AIF_HANDOFF_REPO_URL` | `https://github.com/lee-to/aif-handoff.git` | Clone source; override when you mirror the repo to another remote (`:26-28`). |
| `AIF_HANDOFF_CHECKOUT` | `$HOME/code/aif-handoff` | Where the clone lands, or is `pull --ff-only`'d if already present (`:29-30`). |
| `AIF_INSTALL_LOG` | `$HOME/.getff-factory-install.log` | Audit trail — one line per bring-up outcome, including every failure (`:31-32`, `:55-58`). |
| `RUNTIME_BRIDGE_AIF_URL` | `http://localhost:3009` | The URL probed for `/health`; same knob as the *Required config env* table below (`:24`). |

## Required config env

The bridge is **non-functional** if `RUNTIME_BRIDGE_AIF_PROJECT_ID` is unset — `AifHandoffBackend.dispatch()` throws `dispatch_failed` and silently falls back to `ManualBackend` with no obvious signal. Set all of:

| Env var | Required? | Default | Purpose |
|---|---|---|---|
| `RUNTIME_BRIDGE_MODE` | no | `auto` | `auto` / `manual` (force ManualBackend) / `aif-handoff` (force or fail). `amux` is reserved for Phase 2 — present as an enum value but **not yet functional** (it warns and falls back to ManualBackend). |
| `RUNTIME_BRIDGE_AIF_PROJECT_ID` | **yes** (for the bridge to dispatch) | — | Your aif-handoff project UUID. Without it the bridge cannot create tasks. |
| `RUNTIME_BRIDGE_AIF_URL` | only for non-default deployments | `http://localhost:3009` | aif-handoff REST/WS base URL. **Dispatch + status both use this** (dispatch is REST as of 2026-05-31). Set if aif-handoff runs on another host/port. |
| `RUNTIME_BRIDGE_AIF_MCP_URL` | no | `http://localhost:3100` | MCP (HTTP-mode) URL. **RESERVED for the MCP-target phase** — read into config but **not used by REST dispatch today**. Set now to avoid a later migration. |

## Required aif-handoff-side config

- **`transport: "cli"`** in the aif-handoff Claude runtime profile. This is **NOT** the default — the default is the metered SDK transport (`RuntimeTransport.SDK`, `packages/runtime/src/adapters/claude/index.ts:449`). The CLI transport runs through the official Claude Code CLI and is safe on a Max/Pro subscription; the SDK transport is API-metered. Verify with `aif-handoff config show`.
- **`AGENT_AUTO_REVIEW_STRATEGY=closure_first`** — aligns aif-handoff's auto-review with the layered-review design (see *Auto-review escalation* below).

## Workspace currency (avoid stale-clone no-ops)

aif-handoff keeps a **per-project clone** under `<PROJECTS_HOST_ROOT>/<repo>/` (bind-mounted to `/home/www` in the agent container). By default it does **not** auto-update — it silently drifts behind your trunk and the agent works against stale code. **Incident 2026-05-31:** the clone was ~50 commits behind `staging`; a full dispatch produced **zero code** ($5.84 burned) because the agent could not see the current files/spec and *correctly* refused to guess. The fix uses aif's **own** knobs (ADOPT, per `build-first-reuse-default` — not a custom sync script):

`<clone>/.ai-factory/config.yaml`:

```yaml
git:
  base_branch: staging          # your trunk, NOT the default `main`
  strict_base_update: true      # `git pull --ff-only origin <base>` before EACH task;
                                # on pull failure → block the task (base_update_failed),
                                # never silently fall back to the stale local base
```

With `strict_base_update: true` every dispatch starts from a freshly-pulled base; if the pull can't run, the task parks loudly instead of shipping a stale no-op. Optional: `AIF_TASK_WORKTREES_ENABLED=true` (deployment `.env`) for per-task git-worktree isolation when running tasks in parallel.

## Git authentication (the clone must `pull`, and optionally `push`)

The agent container has **no ssh client** — an SSH remote (`git@github.com:…`) makes `strict_base_update`'s `git pull` fail. Use **HTTPS**:

```bash
git -C <clone> remote set-url origin https://github.com/<owner>/<repo>.git
```

- **Public repo:** HTTPS fetch works with no credentials.
- **Private repo** (or to let aif push its own PR): add a **GitHub token** to the deployment `.env` (auto-injected — both `agent` and `api` services use `env_file: .env`):

  ```env
  GH_TOKEN=github_pat_…   # fine-grained PAT; scope: Contents: Read  (+ Contents: Write & Pull requests: Write to push)
  ```

  then wire a credential helper in the clone (token never lands in the URL/config):

  ```bash
  git -C <clone> config credential.helper \
    '!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; };f'
  ```

  The token lives only in the gitignored `.env` — never in the image, never in a commit.

## Notifications (Telegram — the "park → ping a human" half)

aif-handoff fires a **Telegram push per parked question** natively (0 code). Set in the deployment `.env`:

```env
TELEGRAM_BOT_TOKEN=…   # @BotFather → /newbot → copy the token
TELEGRAM_USER_ID=…     # your numeric id from @userinfobot
```

Recreate containers (`docker compose up -d`) so `env_file: .env` picks them up. Notify-only by design — resolve the parked questions in a chat via `cli/questions.ts`, not in Telegram.

## Ports

aif-handoff exposes more than one surface; they do **not** share a port:

| Surface | Default port | Used by |
|---|---|---|
| REST + WebSocket | `3009` | **dispatch** (REST `POST /tasks` → `PUT` plan → `POST /events` → `PUT` paused) **and** status read-back (`getStatus` REST `GET /tasks/:id`, `awaitDone` WS `ws://…:3009/ws`) |
| MCP (HTTP mode) | `3100` | **RESERVED for the MCP-target phase** — not used by REST dispatch today (MCP's default transport is **stdio**, not HTTP) |

`RUNTIME_BRIDGE_AIF_URL` points at the **REST/WS** surface (`:3009`) — both dispatch and status use it. `RUNTIME_BRIDGE_AIF_MCP_URL` (`:3100`) is read into config but **reserved** for the future MCP-target dispatch path; switching to MCP is gated on an upstream aif-handoff fix (per-session transport — see research-patch `2026-05-31-runtime-bridge-mcp-dispatch-fix.md`). The dispatch-vs-status URL split (previously a tracked follow-up) is now wired.

## Verify + result read-back

- **Smoke test (paste-and-run):** edit `PROJECT_ID` (or `export RUNTIME_BRIDGE_AIF_PROJECT_ID`) and run

  ```bash
  bash packages/runtime-bridge/scripts/verify-bridge.sh
  ```

  It checks dependencies + reachability + the clean-worktree precondition, then creates **one** throwaway task, reads its status back, and deletes it — printing a PASS/FAIL summary. It changes no persistent config (use `setup-runtime-bridge.sh` for that).

- **Result read-back:** dispatch is fire-and-forget (it runs inside a PostToolUse hook that must not block). To watch a dispatched task to completion and print the result, run the await CLI with the `taskId` printed at dispatch:

  ```bash
  tsx packages/runtime-bridge/src/cli/await.ts <taskId>            # block until done/verified/blocked
  tsx packages/runtime-bridge/src/cli/await.ts <taskId> --once     # one-shot status snapshot
  ```

  Exit code: `0` = terminal success, `1` = non-success / timeout / error.

  > ⚠️ **Known bug — verify on your setup (2026-05-31):** the **blocking** `await.ts <taskId>` (WebSocket `awaitDone`) **missed the terminal `done` event and ran out the full `--timeout-ms`** on a task that actually completed in ~3 min — the WS subscription appears to start *after* a fast task has already transitioned. The `--once` REST snapshot reported `done` correctly the whole time. **Until fixed, poll with `--once` (or short `--timeout-ms` + retry); do not rely on the blocking WS mode for completion.** Tracked as a runtime-bridge read-back (#296) follow-up. To reproduce: dispatch a small task, immediately run `await.ts <id>` (blocking) and `await.ts <id> --once` in parallel — the `--once` flips to `done` while the blocking call hangs.

> **Clean-worktree precondition (verify this before relying on autonomy):** aif-handoff refuses to advance a task to `plan_ready` while the target project worktree is dirty (a branch-isolation guard). A dirty tree surfaces as `dispatch_failed`; `dispatch()` then best-effort **deletes** the half-created task (rollback — no orphan) and the bridge falls back to `ManualBackend`. Commit/stash/gitignore the target tree, then re-run `verify-bridge.sh` to confirm a full `backlog → plan_ready` run. (The same guard applies to the MCP path — it is not REST-specific.) The REST dispatch HTTP mechanics + error mapping are unit- and live-verified; the end-to-end `plan_ready` + coordinator-pickup step is the operator's clean-worktree smoke-test check.

## Auto-dispatch is opt-IN (per kickoff)

The PostToolUse hook does **NOT** auto-dispatch by default (maintainer decision 2026-05-31 — auto-dispatch is real, metered autonomous work). To enable it for one kickoff, make its **first line** exactly:

```text
<!-- bridge: auto -->
```

Everything else stays manual — dispatch on demand with `tsx packages/runtime-bridge/src/cli/dispatch.ts <kickoff-path>`.

The opt-in default also lives at the library layer: `buildKickoffSpec()` returns `null` without the `<!-- bridge: auto -->` marker unless the caller explicitly passes `requireAutoMarker: false` — `cli/dispatch.ts` (the manual on-demand path) is the one caller that does.

> ⚠️ **Stale hook copy:** consumers who ran `setup-runtime-bridge.sh` **before** this flip hold an opt-OUT hook copy in `.claude/hooks/` that still auto-dispatches every kickoff — re-run the script to refresh it.

## Opt-out

The bridge is fully optional and degrades gracefully:

- **Session-wide:** `export RUNTIME_BRIDGE_MODE=manual` forces `ManualBackend` even when aif-handoff is installed.
- **Per task (manual path):** make the **first line** of a kickoff `<!-- bridge: skip -->` → that one task uses `ManualBackend` (copy-paste) even when `dispatch.ts` is invoked on it directly (e.g. via `/dispatcher`).
- **Automatic:** on any backend exception — `quota_exceeded`, `unavailable`, a dropped WebSocket — the bridge auto-falls-back to `ManualBackend` and prints copy-paste instructions. This is expected behaviour, not a bug; the worst case is a return to the manual status quo.

## Cost cap (read before enabling)

> ⚠️ After **2026-06-15**, `claude -p` — and therefore the aif-handoff CLI transport — draws from a **separate monthly Agent SDK credit** ($20 on Pro / $100 on Max 5x / $200 on Max 20x), distinct from your interactive Claude Code usage. Monitor it via `/usage` or the Anthropic billing dashboard. If your monthly use exceeds the credit cap, dispatch fails with `quota_exceeded` and the bridge auto-falls-back to `ManualBackend` until the credit refreshes. The bridge cannot exceed the cap silently — it degrades, it does not overspend.

## Auto-review escalation (non-blocking)

With `AGENT_AUTO_REVIEW_STRATEGY=closure_first`, aif-handoff runs its own review loop on each dispatched task. When that loop cannot converge (unresolved blocking findings, or `maxReviewIterations` reached), the task is **not** left hanging in a review state — it moves to **`done`** with `manualReviewRequired: true` set, and the pipeline continues. This is **non-blocking** by design (verified in `packages/agent/src/coordinator.ts:403` `if (outcome?.status === "manual_review_required")` → `:416` `manualReviewRequired: true` → `:432` log *"Auto review gate stopped at manual review handoff"*, transition `to: "done"`; field defined in `packages/shared/src/stateMachine.ts`).

So strategy decisions never get silently picked by the runtime — they surface as a flag for you to review in batch:

- **Kanban / Task detail:** flagged tasks show a **"MANUAL REVIEW"** badge (`TaskCard` / `TaskDetailHeader`).
- **REST:** `GET /tasks/:id` returns `manualReviewRequired` + `autoReviewState` (review strategy, iteration, findings).
- **Batch-review pattern:** periodically open a fresh Claude Code session, walk the accumulated flagged tasks, and resolve each with aif-handoff's **Approve** / **Request changes** actions (which clear the flag). Pair this with a brainstorming pass when a flagged task needs a real decision rather than a yes/no.

The flag is distinct from `blocked_external` (a runtime/resource error that stops automated processing) — `manualReviewRequired` means automated processing *completed* but wants human oversight.

## Hard-fork park — when the agent cannot pick a default

Soft/advisory questions already flow non-blocking to chat — the agent picks a
reasonable default and keeps going. Use the PARK primitive ONLY for a genuine
**hard fork that blocks continuing the implementation**.

- **Mid-flight hard fork (A):** the agent runs
  `tsx packages/runtime-bridge/src/cli/park.ts --question "<fork + A/B options>"`
  (`--task` defaults to `$HANDOFF_TASK_ID`). This pauses the task (`paused:true`,
  the only agent-reachable stop) and records the question. The operator resolves it
  with `answer.ts --decision resume --answer "<...>"`, which unpauses and injects
  the answer into the plan.
- **Finish-line fork (B):** the work is essentially done and the question is about
  direction/acceptance -> the agent finishes to `done`; the operator answers via the
  existing `answer.ts --decision request_changes` rework path. No new code.

Never use `blockedReason` alone to stop the agent — the coordinator does not honor it
(it filters on `paused`). The `aif-park.test.ts` GUARD enforces this.

## Operator convenience: mount global skills

By default the aif container only sees the repo clone. To give the aif agent access to
your operator-side global skills (whatever `~/.claude/skills/` holds on your machine,
Superpowers plugins, etc.), add bind-mounts to your local `docker-compose.override.yml`:

```yaml
services:
  agent:
    volumes:
      - ~/.claude/skills:/home/www/.claude/skills:ro
      - ~/.claude/plugins:/home/www/.claude/plugins:ro
      - ~/.claude-coordination:/home/www/.claude-coordination:ro
```

This is operator-axis only — consumers of the shipped framework are NOT required to have
these paths. The shipped in-repo discipline (`agents/orchestrator-worker-discipline.md` +
`skill-context/aif-orchestrator-discipline/SKILL.md`) works without the mount.

## See also

- [packages/runtime-bridge/DESIGN.md](../packages/runtime-bridge/DESIGN.md) — bridge architecture + `RuntimeBackend` interface.
- [.claude/hooks/runtime-bridge-dispatch.sh](../.claude/hooks/runtime-bridge-dispatch.sh) — the PostToolUse hook the setup script wires in.
