# aif-doctor — inventory and triage

> **Authoritative for:** the selected aif-doctor procedure sections below; read when routed by [the skill card](../SKILL.md).
> **NOT authoritative for:** project goal or unrelated skill modes. Commands execute from the project root unless stated otherwise.

<!-- @harness-posture: cc-only — deliberate: operator-internal diagnostic runbook, slash-command auto-invocation is CC-native, markdown content readable anywhere (matches the adjacent @cc-only-rationale) -->

<!-- @cc-only-rationale: operator-internal diagnostic runbook for the maintainer's local aif-handoff stack; the markdown content is harness-agnostic (any session can read it), only the slash-command auto-invocation is CC-native. No portable counterpart to keep in sync → §6 dual-implementation-discipline.md marker is @cc-only, not @dual-pair. -->

> **Class:** C — prose-only runbook; mechanical substrate = existing passive helper (`bridge-health.sh`) + upstream read-only endpoints (`/health`, `/agent/status`). No new code, no npm deps. Promotion criterion: ≥2 «re-derived aif operational knowledge» incidents after ship → consider a session-start `bridge-health.sh` auto-run hook (`.claude/hooks/`).
> **Authoritative for:** /aif-doctor behaviour — §0 invocation through §8; the read-only health-sweep → classify → emit-mapped-fix flow with the §4 two-tier mutation split (Tier-1 reversible in-container fixes auto-apply; Tier-2 destructive / spending / standing-config mutations wait for operator GO); the empirically-observed failure-mode catalogue (§3) and its detector→fix→reversibility mapping.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../../README.md#why-this-exists). The dispatch/execution loop — see [.claude/skills/dispatcher/SKILL.md](../../dispatcher/SKILL.md). Planning / priority / launch-table — see [.claude/skills/pipeline/SKILL.md](../../pipeline/SKILL.md). The `orchestrator` skill at `.claude/skills/orchestrator/`. The host proxy tunnel itself (§3.3 names it and stops — fixing it is operator machine-level work).

# /aif-doctor — aif operational-health triage

**Origin:** BUILD verdict 2026-06-03. The `/dispatcher` loop works, but the _operating environment_ repeatedly breaks (runtime crash-loop, capacity saturation, flaky proxy) and nothing captured how to triage it in seconds instead of re-deriving every session. SSOT #112. Kickoff: [`.claude/orchestrator-prompts/aif-doctor-skill/kickoff.md`](../../../../.claude/orchestrator-prompts/aif-doctor-skill/kickoff.md).

**Substrate:** existing helpers + upstream read-only endpoints. Zero new scripts or npm deps; passive probes add no LLM/API-billed calls ([no-paid-llm-in-ci.md §1](../../../rules/no-paid-llm-in-ci.md)). The passive sweep uses `curl`, `docker exec` and log inspection without inference. An explicitly authorized active dispatch smoke may briefly start an executor and consume tokens; it is outside that sweep.

---

## §0 Invocation

**Slash command:** `/aif-doctor` — or auto-fires on the trigger phrases above (`disable-model-invocation: false`, tight description). Must NOT fire during a normal `/dispatcher` run; it is for when something is _wrong_.

**Two decisions baked in (Q1/Q2, do not re-litigate):**

1. **Separate skill, not `dispatcher §4`.** `/dispatcher` owns the happy-path loop and is `disable-model-invocation:true`; its NOT-authoritative-for header names only planning/pipeline/orchestrator — operational-environment health was left implicit, and this skill makes it explicit. Operational triage has a distinct trigger and must be invokable when the dispatcher is NOT running.
2. **Diagnose autonomously; Tier-2 mutations only on operator GO.** Read-only probing (curl `/tasks`+`/agent/status`, `docker ps/logs`, `claude --version`, mode classification, emitting the exact fix command) runs without asking. **Tier-1 reversible in-container fixes** (§4: `npm install`/`install.cjs` in-container, image rebuild, git-config heals, retry) **auto-apply with the APPLIED log**. **Tier-2 mutations** — destructive (delete a task), spending (paid transport switch), or standing-config (bump `COORDINATOR_MAX_CONCURRENT_TASKS_PER_PROJECT`) — are surfaced with **evidence + reversibility**, then wait for GO. Rationale: [`operator-control-not-decide-everything`], [`stop-surface-not-hack-on-dispatch-fail`], [recommendation-laziness-discipline.md §3](../../../rules/recommendation-laziness-discipline.md).

---

## §1 Reuse-first inventory (BFR — do NOT rebuild)

Run the passive probes below in order. **Reuse, do not reimplement.** Active smoke/config operations are separate and are not part of this read-only sweep.

| Probe                    | Command                                                                                                                                                                                         | What it answers                                                                                                                                                                                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container-side health    | `bash packages/runtime-bridge/scripts/bridge-health.sh`                                                                                                                                         | dirty_worktree (409), stale park code (#357), container→aif net, dedup hygiene                                                                                                                                                                                      |
| Liveness                 | `curl -s -m5 http://localhost:3009/health`                                                                                                                                                      | API up? → `{"status":"ok","uptime":N}`                                                                                                                                                                                                                              |
| Active tasks + staleness | `curl -s -m5 http://localhost:3009/agent/status`                                                                                                                                                | per-task `status`, `heartbeatLagMs`, `heartbeatStale`, `activeTaskCount`, `staleTasks` (upstream's own watchdog view)                                                                                                                                               |
| Container state          | `docker ps --filter name=aif --format '{{.Names}}\t{{.Status}}'`                                                                                                                                | are agent/api/mcp/web all Up?                                                                                                                                                                                                                                       |
| Base currency (§3.4)     | `gh api repos/<repo>/git/refs/heads/staging --jq .object.sha` **vs TWO refs:** `docker exec <agent> git -C <repo> rev-parse staging` **AND** `docker exec <agent> git -C <repo> rev-parse HEAD` | container base ref == live tip **AND** working tree HEAD == live tip? Either mismatch → §3.4 stale base. A current ref with HEAD on another branch is the parked-working-tree state (#1 cause of false-`done` garbage — `.claude/` is copied from the working tree) |

**Active operations — outside the passive sweep:** `bash packages/runtime-bridge/scripts/verify-bridge.sh` creates and deletes a real throwaway task; on a clean worktree the coordinator may briefly start it. `tsx packages/runtime-bridge/src/cli/ensure-parallel.ts --project <id>` reads the project and, unless already enabled, persists `parallelEnabled=true` through a full project PUT. Before either operation, apply §4 Tier 2 and obtain operator authorization for that exact smoke/config change; an existing explicit authorization suffices. Do not describe either as a read-only health probe.

**Upstream watchdog already covers slow-stale tasks.** aif-handoff's coordinator runs `recoverStaleInProgressTasks()` each poll: tasks in `planning`/`implementing`/`review` with no heartbeat for `AGENT_STAGE_STALE_TIMEOUT_MS` (default ~90 min) auto-move to `blocked_external`, retry ≤3×, then quarantine (`retryAfter=null`, needs manual intervention). **Implication (BFR):** do NOT manually clear a _slow-stale_ task — the watchdog will. The §3 modes below are precisely the ones the watchdog **cannot** see (a fast crash-loop keeps the heartbeat fresh; a `plan_ready` slot-holder is not in the watchdog's status set; a host-proxy block is off-box). Verified live 2026-06-03 — see §7.

> `/agent/readiness` was probed and **404s on :3009** in the current image (do not trust the upstream wiki claim — verified, T20). Use `docker exec … claude --version` for the runtime-binary check (§3.1), not that endpoint.

---

## §2 The triage flow

1. **Read-only sweep** (autonomous, no GO): run §1 probes top-to-bottom, then read the agent log's error levels — `docker logs <agent> --tail 20000 2>&1 | grep -E '"level":(40|50|60)' | tail` — because a provider rejection (§3.9) is recorded nowhere else and every heartbeat probe stays green through it. Stop early only if `/health` is unreachable → containers down → `docker ps`/`docker logs` first.
2. **Classify** the failure into one §3 mode using the detector signatures. If no §3 mode matches and `bridge-health.sh` is green → report «no known failure mode; collect a fresh symptom» (do NOT speculate, T-AIFDOC-B).
3. **Emit the mapped fix command** with its file:line / log-line evidence and a one-line reversibility note. Read-only fixes (re-run a probe) you may run; Tier-1 reversible fixes auto-apply with the APPLIED log (§4 Tier 1); **Tier-2 mutations stop here for GO**.
4. **On GO** (or existing explicit authorization for that exact operation, Tier 2): run the mutation, re-run the relevant §1 probe to confirm, report the delta.

---
