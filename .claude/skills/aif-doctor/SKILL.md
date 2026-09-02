---
name: aif-doctor
description: Use when the aif-handoff runtime is misbehaving — a task is stuck or crash-looping, new tasks stay backlog at capacity, the claude runtime is broken. Triggers: aif-doctor, aif health, task stuck, задача висит, runtime broken, рантайм сломан, aif не отвечает, capacity skipping, native binary not installed, why won't my task start. Invokable when the dispatcher is NOT running. NOT for running the dispatch loop (/dispatcher) or planning (/pipeline).
arguments: []
disable-model-invocation: false
model: opus
allowed-tools:
  - Bash(curl *)
  - Bash(docker *)
  - Bash(git *)
  - Bash(bash *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(grep *)
  - Read
---

<!-- @harness-posture: cc-only — deliberate: operator-internal diagnostic runbook, slash-command auto-invocation is CC-native, markdown content readable anywhere (matches the existing @cc-only-rationale, SKILL.md:20) -->

<!-- @cc-only-rationale: operator-internal diagnostic runbook for the maintainer's local aif-handoff stack; the markdown content is harness-agnostic (any session can read it), only the slash-command auto-invocation is CC-native. No portable counterpart to keep in sync → §6 dual-implementation-discipline.md marker is @cc-only, not @dual-pair. -->

> **Class:** C — prose-only runbook; mechanical substrate = existing $0 helpers (`bridge-health.sh`, `verify-bridge.sh`) + upstream read-only endpoints (`/health`, `/agent/status`). No new code, no npm deps. Promotion criterion: ≥2 «re-derived aif operational knowledge» incidents after ship → consider a session-start `bridge-health.sh` auto-run hook (`.claude/hooks/`).
> **Authoritative for:** /aif-doctor behaviour — §0 invocation through §8; the read-only health-sweep → classify → emit-mapped-fix → mutation-needs-GO flow; the empirically-observed failure-mode catalogue (§3) and its detector→fix→reversibility mapping.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). The dispatch/execution loop — see [.claude/skills/dispatcher/SKILL.md](../dispatcher/SKILL.md). Planning / priority / launch-table — see [.claude/skills/pipeline/SKILL.md](../pipeline/SKILL.md). The `orchestrator` skill at `.claude/skills/orchestrator/`. The host proxy tunnel itself (§3.3 names it and stops — fixing it is operator machine-level work).

# /aif-doctor — aif operational-health triage

**Origin:** BUILD verdict 2026-06-03. The `/dispatcher` loop works, but the _operating environment_ repeatedly breaks (runtime crash-loop, capacity saturation, flaky proxy) and nothing captured how to triage it in seconds instead of re-deriving every session. SSOT #112. Kickoff: [`.claude/orchestrator-prompts/aif-doctor-skill/kickoff.md`](../../orchestrator-prompts/aif-doctor-skill/kickoff.md).

**Substrate:** existing helpers + upstream read-only endpoints. Zero new scripts, zero npm deps, zero LLM/API-billed calls ([no-paid-llm-in-ci.md §1](../../rules/no-paid-llm-in-ci.md)). A full agent run costs tokens; this skill spends none — `curl` + `docker exec` + `grep` only.

---

## §0 Invocation

**Slash command:** `/aif-doctor` — or auto-fires on the trigger phrases above (`disable-model-invocation: false`, tight description). Must NOT fire during a normal `/dispatcher` run; it is for when something is _wrong_.

**Two decisions baked in (Q1/Q2, do not re-litigate):**

1. **Separate skill, not `dispatcher §4`.** `/dispatcher` owns the happy-path loop and is `disable-model-invocation:true`; its NOT-authoritative-for header names only planning/pipeline/orchestrator — operational-environment health was left implicit, and this skill makes it explicit. Operational triage has a distinct trigger and must be invokable when the dispatcher is NOT running.
2. **Diagnose autonomously, mutate only on operator GO.** Read-only probing (curl `/tasks`+`/agent/status`, `docker ps/logs`, `claude --version`, mode classification, emitting the exact fix command) runs without asking. **Any mutation** — delete a task, free a slot, `npm install`/`install.cjs` in-container, image rebuild, bump `COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT` — is surfaced with **evidence + reversibility**, then waits for GO. Rationale: [`operator-control-not-decide-everything`], [`stop-surface-not-hack-on-dispatch-fail`], [recommendation-laziness-discipline.md §3](../../rules/recommendation-laziness-discipline.md).

---

## §1 Reuse-first inventory (BFR — do NOT rebuild)

Run these in order; each is $0 and read-only. **Reuse, do not reimplement.**

| Probe                    | Command                                                                                                                                                                                         | What it answers                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container-side health    | `bash packages/runtime-bridge/scripts/bridge-health.sh`                                                                                                                                         | dirty_worktree (409), stale park code (#357), container→aif net, dedup hygiene                                                                                                                                                                                      |
| Host-side dispatch smoke | `bash packages/runtime-bridge/scripts/verify-bridge.sh`                                                                                                                                         | REST dispatch round-trip (creates+deletes ONE throwaway task)                                                                                                                                                                                                       |
| Liveness                 | `curl -s -m5 http://localhost:3009/health`                                                                                                                                                      | API up? → `{"status":"ok","uptime":N}`                                                                                                                                                                                                                              |
| Active tasks + staleness | `curl -s -m5 http://localhost:3009/agent/status`                                                                                                                                                | per-task `status`, `heartbeatLagMs`, `heartbeatStale`, `activeTaskCount`, `staleTasks` (upstream's own watchdog view)                                                                                                                                               |
| Container state          | `docker ps --filter name=aif --format '{{.Names}}\t{{.Status}}'`                                                                                                                                | are agent/api/mcp/web all Up?                                                                                                                                                                                                                                       |
| Self-heal parallel flag  | `tsx packages/runtime-bridge/src/cli/ensure-parallel.ts`                                                                                                                                        | restores `parallelEnabled` DB flag (worktree-isolation gate)                                                                                                                                                                                                        |
| Base currency (§3.4)     | `gh api repos/<repo>/git/refs/heads/staging --jq .object.sha` **vs TWO refs:** `docker exec <agent> git -C <repo> rev-parse staging` **AND** `docker exec <agent> git -C <repo> rev-parse HEAD` | container base ref == live tip **AND** working tree HEAD == live tip? Either mismatch → §3.4 stale base. A current ref with HEAD on another branch is the parked-working-tree state (#1 cause of false-`done` garbage — `.claude/` is copied from the working tree) |

**Upstream watchdog already covers slow-stale tasks.** aif-handoff's coordinator runs `recoverStaleInProgressTasks()` each poll: tasks in `planning`/`implementing`/`review` with no heartbeat for `AGENT_STAGE_STALE_TIMEOUT_MS` (default ~90 min) auto-move to `blocked_external`, retry ≤3×, then quarantine (`retryAfter=null`, needs manual intervention). **Implication (BFR):** do NOT manually clear a _slow-stale_ task — the watchdog will. The §3 modes below are precisely the ones the watchdog **cannot** see (a fast crash-loop keeps the heartbeat fresh; a `plan_ready` slot-holder is not in the watchdog's status set; a host-proxy block is off-box). Verified live 2026-06-03 — see §7.

> `/agent/readiness` was probed and **404s on :3009** in the current image (do not trust the upstream wiki claim — verified, T20). Use `docker exec … claude --version` for the runtime-binary check (§3.1), not that endpoint.

---

## §2 The triage flow

1. **Read-only sweep** (autonomous, no GO): run §1 probes top-to-bottom. Stop early only if `/health` is unreachable → containers down → `docker ps`/`docker logs` first.
2. **Classify** the failure into one §3 mode using the detector signatures. If no §3 mode matches and `bridge-health.sh` is green → report «no known failure mode; collect a fresh symptom» (do NOT speculate, T-AIFDOC-B).
3. **Emit the mapped fix command** with its file:line / log-line evidence and a one-line reversibility note. Read-only fixes (re-run a probe) you may run; **mutations stop here for GO**.
4. **On GO** (and only then): run the mutation, re-run the relevant §1 probe to confirm, report the delta.

---

## §3 Failure-mode catalogue (empirically observed only — T-AIFDOC-B)

Modes `bridge-health.sh` does **not** cover (confirmed by reading its source 2026-06-03: it checks container-present / dirty_worktree / park-code+net / dedup; count-free wording — the list grows on incidence, never speculatively).

> The commands below hard-code `aif-handoff-agent-1`. If the compose project was renamed, resolve the real name first (same logic `bridge-health.sh` uses): `C=$(docker ps --filter name=agent --format '{{.Names}}' | grep -i aif | head -1)` and substitute `$C`, or set `RUNTIME_BRIDGE_AGENT_CONTAINER`.

### §3.1 Runtime native-binary missing → task crash-loops in `planning`

- **Detect (read-only):**
  - `docker exec aif-handoff-agent-1 claude --version` → `exec format error` **or** `Error: claude native binary not installed`.
  - `docker exec aif-handoff-agent-1 sh -c 'ls /usr/local/lib/node_modules/@anthropic-ai/claude-code-linux-arm64/'` → **empty** (optional dep never downloaded).
  - Coordinator log: `docker logs aif-handoff-agent-1 --tail 60 | grep -iE 'native binary|ClaudeRuntimeAdapterError'` → `ClaudeRuntimeAdapterError … Claude CLI exited with code 1: Error: claude native binary not installed … the platform-native optional dependency was not downloaded (--omit=optional)`, `transport:"cli"`.
  - Symptom on `/agent/status`: task stuck `status:"planning"`, **fresh** heartbeat (`heartbeatStale:false`) that resets each tick → the upstream 90-min watchdog NEVER fires (this is why it's a real gap).
- **Root cause:** image rebuilt while the proxy was down → optional `@anthropic-ai/claude-code-<platform>` never fetched from the npm registry.
- **Fix A — durable (operator GO):** rebuild the agent with a working proxy:
  `HTTPS_PROXY=<live-proxy> NO_PROXY=localhost,127.0.0.1,::1,api,agent,web,mcp docker compose build agent && docker compose up -d agent`. **Reversibility:** rebuild is additive; the OAuth credential volume + `env_file` survive (§ topology). Blocked if §3.3 (proxy) is also down.
- **Fix B — in-container install (operator GO):** `docker exec aif-handoff-agent-1 npm i -g @anthropic-ai/claude-code` — works only if the container can reach `registry.npmjs.org`. Under a §3.3 block of the default registry, **try Fix D (mirror) before declaring this blocked** — the block is often host-selective, not whole-tunnel. **Reversibility:** in-place, no data loss; superseded by next image rebuild.
- **Fix D — mirror install, NO VPN change (operator GO, preferred under §3.3) — verified live 2026-06-04:** when `registry.npmjs.org` is the _only_ blocked host (github/google still 200 — see §3.3 discriminator), install from a reachable mirror without touching the tunnel:
  `docker exec aif-handoff-agent-1 npm i -g @anthropic-ai/claude-code --registry=https://registry.npmmirror.com --include=optional`.
  Works because the missing binary is an **npm optional-dep** (the log says «optional dependency was not downloaded (--omit=optional)»), so a full npm mirror (`registry.npmmirror.com` mirrors platform binaries too) serves it. **Reversibility:** in-place, no data loss; superseded by next rebuild. **Post-install caveat (observed):** npm briefly removes then recreates the `/usr/local/bin/claude` symlink → a **single transient `spawn /usr/local/bin/claude ENOENT`** may appear in the coordinator log during the install window. Do NOT treat one post-install ENOENT as failure — verify the fix by `docker exec … claude --version` (expect `2.x.x`, exit 0) + valid symlink, then watch **one** ~30s poll cycle for **zero** recurring errors. **Falsifier:** wrong if `claude-code` fetched the binary from a hard-coded CDN rather than the npm optional-dep — then `claude --version` still throws `exec format error` after install (it did not, 2026-06-04).
- **Fix C — bypass the binary (operator GO, paid-aware):** switch the claude runtime profile to **API transport** (`aif-handoff docs/providers.md:64`; needs `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL`). **Flag the paid-vs-subscription nuance** ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)): a paid API key is NOT the default — DEFER unless the operator explicitly authorizes (§7 stop condition).

### §3.2 Capacity cap saturated by stale/zombie slot-holders

- **Detect (read-only):**
  - New task stays `backlog`; coordinator log: `docker logs aif-handoff-agent-1 --tail 60 | grep -i capacity` → `"active":N,"limit":N,"msg":"Auto-queue: project pipeline at capacity, skipping"` (note: cap is **per-project** when `parallelEnabled`; the log names the `projectId`).
  - `docker exec aif-handoff-agent-1 sh -c 'echo ${COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT:-unset}'` → `unset` means default **3** (range 1–10). **Read the name carefully — `COORDINATOR_MAX_CONCURRENT_TASKS` (no `_PER_PROJECT`) is a DIFFERENT, global knob and setting it does nothing to the per-project lane count.** Source: `packages/agent/dist/coordinator.js:571` in the running image — `const limit = project.parallelEnabled && !usesSharedBranchIsolation ? env.COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT : 1`. Verified live 2026-07-24: a `docker-compose.override.yml` carrying `COORDINATOR_MAX_CONCURRENT_TASKS: "5"` (added 2026-06-27 under operator GO) left the coordinator logging `"limit":3` for a month, and survived a container restart unchanged; adding `COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT: "5"` + `docker compose up -d agent` moved it to `"limit":5`.
  - **Never take the limit from the env var — take it from the coordinator's own log** (`grep -oE '"active":[0-9]+,"limit":[0-9]+'`). The env is what someone intended; the log is what the process decided. That is what caught the wrong-name bug.
  - `curl -s :3009/tasks` → find the N occupiers; a true zombie is `plan_ready`/`review` whose sibling umbrella is already verified/merged.
  - **A `paused` task still consumes a slot — this is an upstream deadlock, not a misreading.** `countActivePipelineTasksForProject` filters only on `projectId` + non-terminal status, with **no** `paused` predicate, while `findCoordinatorTaskCandidates` carries `eq(tasks.paused, false)`. So a `plan_ready` + `paused=true` task is counted as in-flight forever and is never eligible to advance. Verified live 2026-07-24 (two such tasks held 2 of 3 lanes; `activeTaskCount` reported **0** throughout). There is no reaper for this state: it is terminal in practice, non-terminal in schema. Sweep for it whenever the log shows capacity pressure that the task list does not explain.
- **Fix 1 — free a slot via the official route (operator GO):** `curl -s -X DELETE http://localhost:3009/tasks/<id>` (same REST route the web UI uses; upstream `lee-to/aif-handoff api/src/routes/tasks.ts` `DELETE /tasks/:id`, in the aif image — not this repo) on a **verified** zombie. **MUST verify zombie status first** (T-AIFDOC-A) — `implementationLog:false` AND sibling umbrella verified/merged; never delete on name/jaccard match alone. **Reversibility:** DELETE is destructive (task record gone) → this is exactly why it needs GO + verification.
- **Fix 2 — raise the cap (operator GO, reversible):** bump `COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT` (1–10) in compose env + `docker compose up -d agent`. **The `_PER_PROJECT` suffix is the whole fix** — the bare `COORDINATOR_MAX_CONCURRENT_TASKS` is a different knob and a bump written against it is inert (see the detector above; that exact mistake sat in `docker-compose.override.yml` for a month). Confirm from the coordinator log, not the env. **Reversibility:** trivially revert the env value. Prefer this over DELETE when the occupiers are legitimately in-flight.

### §3.3 Host↔npm-registry proxy block (flaky tunnel) — DISCRIMINATE first, then NAME or MIRROR

- **Detect (read-only):** `curl --max-time 25 -sSL -o /dev/null -w '%{http_code}' https://registry.npmjs.org/@anthropic-ai/claude-code` times out (`000`) from host and/or container. Matches memory [`project_github_push_flaky_proxy_tunnel`] (Clash-family fake-ip `198.18.0.0/16` via `utun4`; `route -n get default → interface: utun4` confirms TUN mode owns the default route).
- **DISCRIMINATOR (run before concluding — 2026-06-04 lesson, T20):** the tunnel is rarely down _whole_. Probe a control host vs the registry:
  - `curl --max-time 12 -sS -o /dev/null -w '%{http_code}\n' https://github.com` and `… https://www.google.com` — if these return **200**, the tunnel is **alive** and the failure is **host-selective** (the current proxy node drops `registry.npmjs.org` specifically, often a Cloudflare-IP routing issue), **not** a dead tunnel.
  - Confirm the registry mirror is reachable: `docker exec <agent> sh -c "curl --max-time 15 -sS -o /dev/null -w '%{http_code}' https://registry.npmmirror.com/@anthropic-ai/claude-code"` → **200**.
- **Two outcomes:**
  1. **Host-selective block (github 200, registry 000, mirror 200):** do NOT ask the operator to disable the VPN/TUN — it is neither necessary nor the cause. Go straight to **§3.1 Fix D (mirror install)** — fixes the runtime with zero VPN change. _(This is the actual 2026-06-04 resolution.)_ Durable alternative the operator can do without killing the VPN: add a **DIRECT rule** for `npmjs.org` in the Clash client, or switch proxy node.
  2. **Whole-tunnel down (github 000, google 000 too):** then it is the machine-level proxy issue — **name it and stop** (lever is operator-side: fix/restart the upstream node, or DIRECT-route the needed hosts). Push toward §3.1 Fix D once a mirror becomes reachable, or Fix C (API transport).
- **Either way: do NOT mutate the tunnel from this skill.** «Disable the VPN» is a wrong-layer ask when (1) holds — verify the discriminator before suggesting it.

### §3.4 Stale container base → task false-`done` with off-scope / empty diff (verified live 2026-06-13)

- **Detect (read-only):**
  - **Mismatch (two-part — ref alone is insufficient):** §1 base-currency probe — compare `gh api repos/<repo>/git/refs/heads/staging --jq .object.sha` against **BOTH** `docker exec aif-handoff-agent-1 git -C /home/www/rules-as-tests-aif rev-parse staging` (branch ref) **AND** `docker exec aif-handoff-agent-1 git -C /home/www/rules-as-tests-aif rev-parse HEAD` (working tree). Either differing from the live tip is a stale-base hit. **A current ref with HEAD on another branch is the parked-working-tree state** — the base clone checked out on another branch (e.g. a leftover PR-branch checkout) is a named cause of stale-base garbage, because `.claude/` is copied from the working tree, not the ref.
  - **Synthetic base:** `docker exec … git -C <repo> log -1 staging` → subject like `chore(sync): … (container-base refresh, not for PR)`; `gh api repos/<repo>/commits/<that-sha>` → **422 "No commit found"** (the base was never pushed — it's a hand-sync artefact).
  - **Can't self-heal:** `docker exec … git -C <repo> ls-remote origin staging` → `Failed to connect to github.com port 443` (the §3.3 tunnel, here biting the _base_ not npm — so the container cannot fetch its way current).
  - **The symptom that brought you here:** a task reached `status:"done"` (often `manualReviewRequired:false`, review-gate "accepted") **but** its branch is **0 commits ahead of staging**, or the per-task `worktreePath` (field on `/tasks/<id>`) has off-scope / empty diffs / the intended file untouched. The agent branched off the stale base, did the wrong thing, and the auto-review false-passed it. `/agent/status` shows nothing (already `done`) → **watchdog blind spot**.
- **Root cause:** the agent branches every task off local `staging`; that base is hand-synced host→container (the container can't git-fetch through the tunnel) and **drifts stale within days**. A second cause is the base clone being left checked out on a non-`staging` branch — the ref matches but the working tree (the overlay source for `.claude/`) carries whatever the other branch lands on, producing silent hook/rules drift across every dispatched task. A task on a stale or parked base produces garbage that can't be harvested.
- **Fix — `refresh-aif-base.sh` (Tier 1 when no task is in-flight; reversible):** `bash .claude/skills/aif-doctor/helpers/refresh-aif-base.sh [staging]` — the in-repo **portable** helper shipped to consumers (the maintainer's tunnel-tuned copy at `~/.claude/refresh-aif-base.sh` is equivalent). gh-API real tip → **two-part fast no-op if already current (~1s)** (requires BOTH `rev-parse <branch>` AND `rev-parse HEAD` to equal the live tip; a ref-current + tree-parked state is detected, named, and realigned, not passed as healthy) → **dirty guard** (aborts with the file list if the checkout has uncommitted tracked changes; never stashes silently, never `git reset --hard`) → **PRIMARY (portable):** in-container `git fetch origin <branch>` (works when the container can reach GitHub) → **FALLBACK (tunnel/airgap):** host objects (host current: `git bundle`; host also stale: `~/.claude/sync-branch-from-api.sh` FF-only first — an _optional_ operator-local dep, [`feedback_sync_branch_down_via_gh_api`]) → `docker cp` → container applies the target with **checked-out-branch-safe mechanics** (`merge --ff-only` where history allows; otherwise `checkout --detach` → `branch -f` → `checkout` to re-attach — bare `branch -f` is refused by git on a checked-out branch and would silently fail) + tracking ref update → **verifies BOTH ref AND HEAD** landed at the target before reporting success. **Reversibility:** prints the OLD SHA + a revert command that restores both the ref AND the checkout; non-destructive to task records/worktrees. **In-flight guard:** the heal entrypoint (`.claude/skills/aif-doctor/helpers/heal.sh`) applies the refresh only when no task is in-flight (scanned via `GET /tasks` — statuses `planning`/`implementing`/`review`/un-paused `plan_ready` block; fail-closed if `/tasks` is unreachable); otherwise it skips. The `/agent/status` `activeTaskCount` field is known to under-report (live 2026-07-24: `activeTaskCount=0` while 4 tasks were genuinely in flight — finding F1, #1129) and is NOT consulted.
- **Always-auto wiring (SHIPPED) — «the dispatcher calls the doctor; the doctor heals»:** `dispatch.ts` runs an env-gated preflight (`runPreflight()`) **after the dedup gate, before backend-resolve** — ship-safe NO-OP when unset, non-blocking (a heal failure warns; dispatch proceeds). The operator points the dispatcher at the **doctor's** heal entrypoint (never at the helper directly): `export RUNTIME_BRIDGE_PREFLIGHT='bash .claude/skills/aif-doctor/helpers/heal.sh'` (consumers; the maintainer's `~/.claude/heal.sh` copy is equivalent). `heal.sh` re-checks the in-flight guard, then runs `refresh-aif-base.sh` (which no-ops in ~1s when current). So every dispatch self-heals the base first. The dispatcher only knows «call the doctor»; the doctor owns _what_ healing means (extend `heal.sh` as new Tier-1 auto-heals are codified).
- **Pairs with — ALWAYS verify aif `done` before harvest** (this mode + the auto-review false-pass make `status:"done"` unreliable): `docker exec … git -C <worktreePath> log staging..HEAD` is non-empty AND the intended file actually changed; never harvest on `status` alone.

### §3.5 `cpSync` EEXIST from a tracked-file-symlinked-in-CANON → planner crash-loops in `planning` (verified live 2026-06-27)

- **Detect (read-only):**
  - **Symptom:** every dispatched task aborts the planner stage in ~263ms (before the model runs) and reverts to `planning`; the loop never advances. `docker logs <agent> | grep EEXIST` → `EEXIST, File exists '<worktree>/.claude/orchestrator-prompts/<umbrella>/<file>.md'` from `component:"stage-error-handler"`, `stage:"planner"`. The watchdog can't catch it — the heartbeat resets each crashed retry (same blind spot as §3.1).
  - **Confirm the collision shape:** the named file is **tracked in git** AND present as a **symlink** in the agent's primary checkout `.claude/orchestrator-prompts/`: `docker exec <agent> sh -c 'ls -la /home/www/rules-as-tests-aif/.claude/orchestrator-prompts/<umbrella>/<file>.md'` → `lrwxr-xr-x … -> /home/node/.claude-coordination/…`; and `git -C <repo> ls-files --error-unmatch <path>` (from a clean checkout / GitHub) → tracked. A tracked file should be a **real** file, not a CANON symlink.
  - **Source of the throw:** aif's `copyProjectContextToWorktree` (`packages/shared/src/gitIsolation.ts` — `cpSync('.claude', …, {recursive:true, force:true})`). Node's `cpSync` `force:true` does **not** overwrite when the source is a symlink and the destination is the git-checked-out real file (type mismatch) → EEXIST.
- **Root cause:** `scripts/link-coordination.sh` wrongly **adopted a git-tracked file** into `$CANON` and replaced it with a symlink (its skip-list was hard-coded to `done.md`/`README.md`/`kickoff.md` and missed one-off `.gitignore` tracked-exceptions like `!.../<umbrella>/stage-N.md`, `!.../modular-install-fullpack/kickoff-s*.md`). Fixed systemically in **#759** (skip ALL `git ls-files`-tracked files); targeted predecessor **#758** untracked the first offending file.
- **Fix — two parts (Tier 1, reversible):**
  1. **Stop the recurrence:** ensure the container base carries #759 (`bash .claude/skills/aif-doctor/helpers/refresh-aif-base.sh staging` → §3.4), so the fixed `link-coordination.sh` no longer re-adopts tracked files.
  2. **Repair the live primary checkout:** restore each wrongly-symlinked tracked file to a real file — `docker exec <agent> sh -c 'cd <repo>; rm -f <path>'` then restore content from `git show origin/<branch>:<path>` (host) `| docker exec -i <agent> sh -c "cat > <repo>/<path>"`. **Reversibility:** content is in git; non-destructive to task records.
- **Do NOT** try to delete the dup from `/home/node/.claude-coordination/` inside the container — it is a **read-only host bind-mount** (`mount | grep claude-coordination` → `ro`); the source lives on the host (`~/.claude-coordination/…`) but removing it there is futile while the unfixed `link-coordination.sh` re-seeds it. The durable fix is #759, not pruning CANON.
- **Pairs with — stale-base contamination (§3.4):** tasks dispatched before the base carried #758/#759 produce diffs that _revert_ recent staging — re-dispatch them from a refreshed base, do not harvest the stale-base commit.

### §3.6 Silent-inert hook — helper resolved from ONE hard-coded path + silent exit (verdicted 2026-07-25, backward-check GAP-FOUND on 2 hooks; class incident: 2026-07-24 tsx-resolution)

- **The failure class:** a hook resolves a runtime helper from a single hard-coded path and exits 0 silently when it is absent — the hook is **inert with zero signal** wherever that path does not resolve (container base clones, partial checkouts, renamed roots). Pre-fix carriers: `adopt-orchestrator-prompts.sh:26,51` (single `$REPO_ROOT/scripts/link-coordination.sh` + `[[ -f … ]] || exit 0`) and `worktree-setup.sh:152` (missing helper swallowed by `|| true`). Fixed 2026-07-25: tiered resolution + LOUD `DID NOT RUN` skip (mirror of `check-kickoff-traps.sh` host-verify runner).
- **Detect (read-only):**
  - **Symptom shape:** the hook's expected side effect is absent AND nothing announced it. Concretely: a file written under `.claude/orchestrator-prompts/<umbrella>/` in a worktree stays a **real file** (`ls -la` → no symlink to `~/.claude-coordination/…`) with no adoption notice in the transcript; or a fresh worktree has no coordination symlinks and the creation output carried no `link-coordination.sh not found` warning.
  - **Version discriminator:** `grep -n 'DID NOT RUN\|not found' <checkout>/.claude/hooks/adopt-orchestrator-prompts.sh <checkout>/.claude/hooks/worktree-setup.sh` — no hits = pre-fix hook (silent-inert possible); hits = fixed hook, so **silence + missing links means the hook never fired at all** (registration/matcher problem — different diagnosis, check `.claude/settings.json` wiring).
  - **Container angle:** a stale container base (§3.4) keeps shipping the pre-fix hooks to every dispatched task's worktree overlay — the same silent gap re-opens inside aif even after the host is fixed.
- **Fix (Tier 1, reversible):** refresh the container base so the fixed hooks land — `bash .claude/skills/aif-doctor/helpers/refresh-aif-base.sh` (§3.4); for an already-orphaned prompt file, run the helper manually: `bash scripts/link-coordination.sh <worktree> <project-root>` (idempotent, never clobbers). No GO needed — both are the existing Tier-1 heals; nothing destructive.
- **Class rule for new hooks:** any helper-invoking hook must resolve by tier and announce a miss loudly ([attention-is-not-a-mechanism.md §1](../../rules/attention-is-not-a-mechanism.md) — a skip whose only consumer is «nobody looked» is not a mechanism); the reference implementation is `check-kickoff-traps.sh:111-125`.

### §3.7 Admission bounded by the active lane's exit — dispatched task idles in `backlog` with free slots (verified live 2026-07-25)

- **The failure class:** a task dispatched while another task of the same project is mid-flight sits in `backlog` for the remainder of the active lane's _current pass_, despite free capacity. A pass ends at task termination (`done`) OR at an internal review→rework boundary (review is the last stage of `processProjectLane`'s single iteration, so a rework request closes the cycle mid-flight). Measured 2026-07-25, two observed windows at `active=1, limit=5` (four slots idle), with `grep -c "at capacity"` over the coordinator log = **0**: (1) **47 minutes** ending when the blocking task reached `done` at `09:37:52.345Z` — same second the coordinator logged `Poll cycle complete` → `Starting poll cycle` (do…while follow-up) → `Auto-queue advanced next backlog task` → `Auto-queue advance pass complete`, and the waiting task's activity opened with `[auto-queue] Advanced by project auto-queue mode (pool 1/5)`; (2) a second task admitted at `11:02:24Z` (worktree created, planner started) after the first task's review gate logged `rework_requested` at `11:00:57.359Z` and `Poll cycle complete` at `11:00:57.365Z` — the same instant, because the review→implementing rework transition ended the pass and closed the cycle, while the first task was still mid-rework. This is **admission latency bounded by the active lane's pass-exit (termination OR rework boundary), not starvation and not capacity** — the «only DELETE frees it» folklore (§3.2) does NOT apply to this state. A task whose review passes on iteration 1 yields exactly one pass (the original 47-min shape); a task with rework rounds opens a window per round.
- **Detect (read-only):**
  ```bash
  # no admission since the last advance, while a task is active and capacity is free:
  docker logs aif-handoff-agent-1 --since 30m | grep -cE '"msg":"(Auto-queue advanced|Poll cycle complete)"'   # 0 = admission window closed
  docker logs aif-handoff-agent-1 --since 30m | grep -c '"at capacity"'                                          # 0 = not a §3.2 capacity problem
  docker logs aif-handoff-agent-1 --since 30m | grep -c 'Poll cycle already active'                              # >0 = cycle busy → LATENCY, not starvation
  ```
- **Discriminator (latency vs §3.2 capacity saturation):** the same-second `done` → `Auto-queue advanced` sequence (09:37:52) and the same-instant `rework_requested` → `Poll cycle complete` sequence (11:00:57) together prove admission fires at lane-pass exit, not only at task termination. If `Poll cycle already active` appears in the log alongside a long-running active task and `at capacity` does NOT, the wait is LATENCY (this mode). If `at capacity` appears with `active==limit`, escalate to §3.2 (true capacity saturation). The two are NOT the same mode — §3.2 has zero free slots; this mode has free slots the cycle structure cannot reach until the active lane's current pass ends.
- **Mechanism (source-verified in `/app/packages/agent/dist/coordinator.js`, all anchors re-checked 2026-07-25):**
  - `coordinator.js:825` — `pollAndProcess()` short-circuits every tick while a cycle is open (`Poll cycle already active; queued one follow-up cycle`), and its `do…while(followUpPollRequested)` drain guarantees a fresh cycle immediately after the long one returns.
  - `coordinator.js:647` — `runPollCycle()` runs `processAutoQueueAdvance()` as step 5, _before_ the project lanes; admission can therefore only happen at cycle start.
  - `coordinator.js:702` — `processProjectLane()` iterates the PIPELINE stages **once per lane pass**, selects candidates **once per stage**, and `await`s all spawned stage tasks before lane exit (`[FIX:149] Draining started stage tasks before lane exit`). A pass therefore carries the active task through planning→implementing→review and returns at one of two exit points: review→`done` (termination, the 09:37:52 case), or review→rework (the 11:00:57 case — the rework transition re-queues the task as `implementing` and the pass returns, closing the cycle; the next pass re-admits backlog). The cycle — hence the next admission window — is open for the duration of one pass, not the entire lifecycle of the active task.
- **Two known non-fixes (both measured — do not re-try):**
  - **Raising the caps does nothing.** `env.js:109-110`: global cap `max(100).default(12)` (currently set to 5), per-project hard-capped at `max(10)` — the wait happened with four slots idle, so width was never the constraint.
  - **`start_ai` is not a mid-flight admission path.** `stateMachine.js:80` (`backlog: ["start_ai"]`) + `stateMachine.js:15-19` (patches `status:"planning"` with **no capacity check**) make it look like direct admission, but per `coordinator.js:702` the busy lane has already passed its planner-stage candidate selection, so the task waits for the next cycle anyway — a cosmetic status change that additionally **bypasses the capacity cap** (unsafe as a default path).
- **Mitigation that works today (zero code, Tier 1):** batch-dispatch into an **idle** runtime — the advance pass fills the pool to the limit in a single tick (`while (active < limit)` loop in `processAutoQueueAdvance()`, `coordinator.js:547`), so N tasks queued while nothing runs are admitted together on the next cycle. **Reversibility:** behavioural only (no state change); the next dispatch round re-evaluates capacity as usual.

> **Parked, not prescribed:** an upstream fix (e.g. moving `processAutoQueueAdvance()` onto its own interval, so admission does not wait on the active lane's exit) belongs in `lee-to/aif-handoff` — outside this repo's PR and outside this catalogue entry. This entry codifies the _observable mode_ and the _today-mitigation_ only.

---

## §4 Mutation discipline (the Q2 contract)

Mutations are split into two tiers by reversibility:

### Tier 1 — Reversible config (auto-apply, no GO needed)

Fixes that change only in-container config or retry state with zero data loss:

- `git config --global url.https.insteadOf` — reversible (`git config --global --unset`)
- `git config --global credential.helper` — reversible (`git config --global --unset`)
- `npm i -g @anthropic-ai/claude-code [--registry=…]` — in-place; superseded by next rebuild
- `answer.ts --decision retry` — retries a blocked task; no records deleted

For Tier 1, the skill **applies the fix automatically** and logs:

```text
APPLIED (reversible): <exact command>
  Evidence: <file:line | log line | probe output>
  Reversibility: <how to undo>
```

Then continues without pausing for GO.

### Tier 2 — Destructive or system-disruptive (GO required)

Fixes that delete records or interrupt running processes:

- `DELETE /tasks/:id` — task record gone, irreversible
- `docker compose build/up` — interrupts the active agent container
- Cap bump (`COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT` + `docker compose up -d agent`) — restarts the agent, interrupts in-flight tasks
- Transport switch to API (Fix C) — paid path, requires explicit authorization

For Tier 2, the skill prints and **stops**:

```text
MUTATION (needs GO): <exact command>
  Evidence: <file:line | log line | probe output>
  Reversibility: <how to undo, or "DESTRUCTIVE — task record gone">
  Awaiting operator GO.
```

Read-only fixes (re-running a probe) run freely. This split was introduced 2026-06-04 after the session-2 triage: SSH→HTTPS `insteadOf` + `retry` (both Tier 1) required two GO round-trips that added no safety value — the reversibility is immediate and the data risk is zero.

---

## §5 Anti-scope

- **Does NOT run the dispatch loop** — that is `/dispatcher`. `/aif-doctor` diagnoses the environment the loop runs in.
- **Does NOT plan / score priority** — that is `/pipeline`.
- **Does NOT add npm deps or new scripts** — reuses §1 helpers + endpoints only; a genuinely-needed new probe = surface as a finding, do not build it here.
- **Does NOT auto-mutate destructive/system fixes** — Tier 2 mutations (DELETE task, container restart, cap bump) need operator GO (§4). Tier 1 reversible fixes (git config, npm install, retry) apply automatically.
- **Does NOT fix the host proxy tunnel** — but DOES run the §3.3 discriminator first; if the block is host-selective (tunnel alive, only `registry.npmjs.org` dropped), the runtime is fixable via §3.1 Fix D (mirror) **without** touching the VPN. Only a whole-tunnel-down case is name-and-stop.
- **Does NOT edit `.claude/skills/orchestrator/`** — another skill's artefact; wrap, never fork.

---

## §6 AI-traps active ([ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

- **T11/T13/T16** — verified `bridge-health.sh` scope by reading its source (not by name); confirmed it does NOT cover §3's three modes. Upstream `/agent/status` watchdog reused for slow-stale; §3 modes are the watchdog's blind spots, proven live not assumed.
- **T15 self-application** — see §7: the skill is bench-tested against the three real 2026-06-03 symptoms and classifies each correctly.
- **T20** — every fix command above carries file:line / log-line / probe-output evidence, not a remembered string.
- **T-AIFDOC-A «jaccard/sibling ⇒ blind delete»** — before any `DELETE /tasks/:id`, confirm a true zombie (`implementationLog:false` AND sibling umbrella verified/merged); never delete on name-match alone.
- **T-AIFDOC-B «speculative failure catalogue»** — codify only empirically-observed modes; grow §3 on incidence (pain-driven), never pre-enumerate.

---

## §7 Bench-test (T15 self-application) — verified live 2026-06-03

The skill was run against the three real symptoms of the originating session; each classified correctly:

| Symptom (live)                                | Detector output                                                                                                                                                                                         | Classified | Evidence                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| Task `cf8534d9` stuck `planning`, crash-loops | `claude --version` → `exec format error`; native-binary dir empty; log `ClaudeRuntimeAdapterError … native binary not installed (--omit=optional)`, transport=cli; `/agent/status` heartbeatStale:false | **§3.1**   | watchdog can't catch it (fresh heartbeat) ✅ |
| New task stays `backlog`                      | log `"active":3,"limit":3,"msg":"Auto-queue: project pipeline at capacity, skipping"`; cap `unset`→default 3                                                                                            | **§3.2**   | per-project cap saturated ✅                 |
| npm fetch hangs                               | dual-side `curl registry.npmjs.org` timeout (host+container)                                                                                                                                            | **§3.3**   | proxy block; name-and-stop ✅                |

### §7.1 Second incidence — verified live 2026-06-04 (§3.1 + §3.2 + §3.3-host-selective; §3.1 resolved via Fix D)

Originating prompt: «aif didn't work, dispatcher can't cope». Live triage:

| Symptom (live)                                                               | Detector output                                                                                                                                                                                   | Classified              | Resolution                                                                                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task `b4671c16` («meta-orchestrator-refactor») stuck `planning`, crash-loops | `claude --version` → `exec format error`; `claude-code-linux-arm64/` empty; log `ClaudeRuntimeAdapterError … native binary not installed (--omit=optional)`; `/agent/status` heartbeatStale:false | **§3.1**                | **Fix D** — `npm i -g … --registry=https://registry.npmmirror.com --include=optional` → `claude --version` `2.1.161`, 0 errors/45s, task resumed live tool-calls ✅ |
| New task `c67a4343` stays `backlog`                                          | log `"active":3,"limit":3` for project `441c1c0c`; slots = `b4671c16`(planning) + `a35ecce5`(plan_ready) + `149d3107`(review)                                                                     | **§3.2**                | secondary — fixing §3.1 frees the crash-looper; cap-relief deferred (not the root)                                                                                  |
| `registry.npmjs.org` 000 both sides                                          | **discriminator:** github 200, google 200, mirror `registry.npmmirror.com` 200; `route default → utun4` (`198.18.0.1/16` TUN)                                                                     | **§3.3 host-selective** | tunnel ALIVE — VPN-disable was a wrong-layer ask; Fix D bypassed it with zero VPN change ✅                                                                         |

**Lesson baked into §3.3 + §3.1 Fix D:** «registry times out» ≠ «tunnel down» ≠ «disable the VPN». Run the github/mirror discriminator first; a host-selective block is fixable from a mirror without operator network surgery.

## §8 Stop conditions

- BFR surfaces an existing helper/endpoint that already does a §3 detection → **reuse it, shrink the skill to a pointer** (already applied: §1 reuses `/health`+`/agent/status` rather than building probes; the upstream stale-watchdog is referenced, not re-implemented).
- Any §3 fix requires a **paid-LLM path** (API transport with a paid key) → mark **DEFER** per [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md), never bake it as default (§3.1 Fix-C).

---

## Without this skill

The operator re-derives aif operational knowledge every session: which port the API is on, what `claude --version` should print, whether a stuck `planning` task is a crash-loop or a slow-stale one the watchdog will recover, whether `backlog` means a cap hit or a dispatch failure, and which of rebuild / in-container-install / API-transport / cap-bump / DELETE actually applies. Each diagnosis is improvised under pressure, mutations get attempted without checking reversibility (e.g. blind-`DELETE`-ing a slot-holder), and the host-proxy block gets mistaken for an aif bug and «fixed» in the wrong layer.

## With this skill

`/aif-doctor` runs the $0 read-only sweep, classifies the failure against the empirically-grounded §3 catalogue, and prints the one mapped fix with its evidence and reversibility — in seconds, without re-derivation. It distinguishes the watchdog-recoverable cases (leave them) from the three modes the watchdog cannot see (act on them), refuses to speculate beyond observed modes, and gates every state-changing fix behind an explicit operator GO. The host-proxy block is named and handed back to the operator instead of being chased in the wrong layer.

---

## §9 §1.7 self-reflexive note

**Forward-check:**

- [build-first-reuse-default.md §3](../../rules/build-first-reuse-default.md) + [phase-research-coverage.md §1](../../rules/phase-research-coverage.md) — BUILD verdict (the _runbook_) confirmed via the full mechanism: SSOT consult (#27/#28/#65/#67/#88/#109/#111 reviewed — none is an operator-facing aif health runbook); DeepWiki ≥3 phrasings on `lee-to/aif-handoff` (health/doctor, capacity-enforcement, runtime-transports — surfaced `/health`, `/agent/status`, `probeClaudeCli`, the stale-watchdog → REUSED, shrinking the skill); **WebSearch ≥3 phrasings** (operator health/doctor for aif-handoff; CLI diagnose AI-agent runtime native-binary/capacity; operator runbook self-hosted agent docker-compose triage) — surfaced only **wrong-problem-class** generic tools (Docker "Container Doctor" LLM-agents, `docker-ai` skill, Bedrock AgentCore arm64-binary diagnostics): generic Docker log-analysis, several **paid-LLM** (T16 mismatch + [no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)), none triages the aif coordinator + claude-native-binary + per-project-capacity class. **Adversarial counter-prompt** (§1 item 4 — «if an aif operator-doctor existed it would live in `lee-to/aif-handoff` or the docs site») surfaced no candidate → negative-existence claim holds. New SSOT #112 added in this commit.
- [dual-implementation-discipline.md §6](../../rules/dual-implementation-discipline.md) — operator-internal diagnostic; `@cc-only-rationale` marker present (markdown content is harness-agnostic, only invocation is CC-native — no portable counterpart to drift).
- [no-paid-llm-in-ci.md §1](../../rules/no-paid-llm-in-ci.md) — every probe is `curl`/`docker`/`grep`; zero API-billed calls. The one paid path (§3.1 Fix-C API transport) is explicitly DEFER-gated, never default.
- [doc-authority-hierarchy.md §3](../../rules/doc-authority-hierarchy.md) — Class C + Authoritative-for/NOT-authoritative-for header present.
- Principle 15 — `## Without this skill` / `## With this skill` paired-negative block present, halves differ.
- [recommendation-laziness-discipline.md §3](../../rules/recommendation-laziness-discipline.md) — every emitted fix is evidence-backed; Tier 2 mutations surface for GO; Tier 1 reversible fixes auto-apply with log (2026-06-04 split per §4).

**Backward-check:**

- [.claude/skills/dispatcher/SKILL.md](../dispatcher/SKILL.md) (SSOT #111) — COMPLEMENTARY, not superseded: dispatcher owns the loop; its NOT-authoritative-for header (verified, line 24) names only planning/pipeline/orchestrator and is silent on operational-environment health — this skill makes that implicit gap explicit. No overlap in trigger (dispatcher = `disable-model-invocation:true`, explicit `/dispatcher`; doctor = fires on failure phrases).
- [.claude/skills/pipeline/SKILL.md](../pipeline/SKILL.md) — untouched; planning stays pipeline's.
- `packages/runtime-bridge/scripts/bridge-health.sh` / `verify-bridge.sh` / `src/cli/ensure-parallel.ts` — REUSED as-is, zero edits; this skill points to them.
- No existing rule or skill is superseded; this is a new operational artefact added on incidence (the 2026-06-03 environment breakage).
- **Incidence-driven update 2026-06-04 (T-AIFDOC-B — grow on pain, not speculation):** the second live incidence added §3.1 **Fix D (mirror install)** + the §3.3 **discriminator** (github/google/mirror probe) + §7.1 bench-row. No new failure _mode_ invented — these refine the existing §3.1/§3.3 modes with an empirically-verified resolution path (`registry.npmmirror.com` → 200; `claude --version` → `2.1.161`; 0 errors/45s; task resumed). The earlier §3.3 framing «whole-tunnel down → name-and-stop» was over-absolute (T20: it asserted the tunnel was dead without the github/mirror discriminator that proves it host-selective). Corrected in place; no other artefact superseded; `bridge-health.sh`/`verify-bridge.sh` still REUSED unedited.
- **Incidence-driven update 2026-07-24 (T15 self-application — the detector was teaching the same blind spot the helper had):** §1 base-currency probe + §3.4 Mismatch + §3.4 helper description were corrected to require the two-part check (branch ref AND working-tree HEAD), matching the fix ported into `refresh-aif-base.sh` the same day. The prior detector (`gh api … vs rev-parse staging` — ref only) reproduced the exact blind spot of the buggy helper: a base clone whose ref was current but whose working tree was parked on another branch certified as healthy. The §3.4 symptom list now names «base clone checked out on another branch» as a named cause of stale-base garbage, parallel to the synthetic-base and tunnel-block causes.
