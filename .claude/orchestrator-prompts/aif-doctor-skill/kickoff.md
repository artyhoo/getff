# KICKOFF — `aif-doctor` operational-health skill

> **Type:** Skill-authoring (BUILD a new `.claude/skills/aif-doctor/`). Design-approved in dialogue 2026-06-03 (Q1+Q2 below). Brainstorm-equivalent decisions already taken — this kickoff IS the design handoff; run writing-plans → implement, OR dispatch as a single-stage umbrella.
> **Origin:** 2026-06-03 session. `/dispatcher hygiene-cleanup` dogfood exposed that I re-derive aif operational knowledge every session and stall on infra (cap=3 saturation, broken claude runtime, flaky proxy). Maintainer: «постоянно не умеешь ты с ним работать → заведи скилл именно на него». The dispatcher loop worked; the **operating environment** broke, and nothing captured how to triage it.
> **Base branch:** staging.
> **Deliverable:** `.claude/skills/aif-doctor/SKILL.md` (Class C runbook) — diagnose aif health in seconds, map each failure mode to its **existing helper** or documented fix, mutate only with operator GO. **$0, reuse-heavy, minimal new code.**

---

## §0 Two decisions already made (do NOT re-litigate)

- **Q1 — separate skill, NOT extend `dispatcher §4`.** `dispatcher` is `disable-model-invocation:true` and owns the *happy-path execution loop* (it declares «NOT authoritative for health»). Operational triage has a distinct trigger («aif down / task stuck / runtime broken») and must be invokable when the dispatcher is NOT running. New skill `aif-doctor`.
- **Q2 — diagnose autonomously, mutate only on operator GO.** Read-only probing (curl `/tasks`, `docker ps/logs`, mode classification, emit the exact fix command) runs without asking. Mutations (delete a task, free a slot, `npm install`/`install.cjs` in-container, image rebuild, bump `COORDINATOR_MAX_CONCURRENT_TASKS`) are **surfaced with evidence + reversibility, then wait for GO**. Rationale: maintainer's standing rule «operator = control + intervene» (memory `operator-control-not-decide-everything`) + `stop-surface-not-hack-on-dispatch-fail` + `recommendation-laziness-discipline §3`. This is the discipline the whole 2026-06-03 session exercised; the skill codifies it so it is not re-improvised.

---

## §1 BFR FIRST — reuse the helper layer, do NOT rebuild it

A mature helper layer already exists. The skill is a **thin runbook over it**, plus glue ONLY for the gap in §3. Before writing any new script, the implementing session MUST inventory and reuse:

| Helper | Path | Role |
|---|---|---|
| `bridge-health.sh` | `packages/runtime-bridge/scripts/bridge-health.sh` | $0 container-side health: dirty_worktree, dedup, stale park code, container→aif net (Findings A/B/C, qloop-ux-probe) |
| `verify-bridge.sh` | `packages/runtime-bridge/scripts/verify-bridge.sh` | host-side dispatch smoke (creates throwaway task) |
| `bridge-cleanup.sh` | `packages/runtime-bridge/scripts/bridge-cleanup.sh` | cleanup |
| `ensure-parallel.ts` | `packages/runtime-bridge/src/cli/ensure-parallel.ts` | self-heal `parallelEnabled` DB flag (worktree isolation gate) |
| `dispatch / harvest / questions / answer / park / await / openQuestion .ts` | `packages/runtime-bridge/src/cli/*.ts` | loop primitives (dispatcher owns the loop; doctor only points) |
| `aif-clone-hygiene.sh`, `link-coordination.sh`, `install-coordination-wiring.sh`, `create-worktree.sh`, `setup-cc-adoptions.sh` | `scripts/*.sh` | coordination / worktree wiring |

**Formal BFR gate (build-first-reuse-default.md §3):** the implementing session runs the 6-layer check (SSOT consult `docs/meta-factory/prior-art-evaluations.md` — dispatcher is SSOT #111; DeepWiki ≥3 phrasings on `lee-to/aif-handoff` «health check / doctor / self-diagnose»; WebSearch ≥3) and records a `Prior-art:` trailer. Expected verdict: BUILD the *runbook* (no upstream runbook for THIS stack) but REUSE every helper above; the only new code is small glue for §3 gaps if a helper does not already cover them.

---

## §2 Topology the skill must encode (so it is never re-derived)

- **Bridge API:** `http://localhost:3009` (`GET /tasks`, `GET/PUT /tasks/:id`, `DELETE /tasks/:id`, `/projects`). Board UI: `http://localhost:5180`.
- **Containers:** `aif-handoff-agent-1` (coordinator + runtime), `-api-1`, `-mcp-1`, `-web-1`.
- **Concurrency cap:** `COORDINATOR_MAX_CONCURRENT_TASKS` — env, default **3**, range 1–10 (`packages/.../env.ts:111` in the aif image; `coordinator.ts` `active>=limit` → «pipeline at capacity, skipping»). Applies only when `parallelEnabled && worktree-isolation`.
- **Auth:** OAuth subscription at volume `/home/node/.claude/.credentials.json` (key `claudeAiOauth`) — survives rebuild (volume). Env (`GH_TOKEN`, `TELEGRAM_*`, `DATABASE_URL`) comes from compose `env_file` — also survives rebuild.
- **claude runtime:** image-baked via `npm i -g @anthropic-ai/claude-code` (`.docker/Dockerfile:57/95`). Native binary is an **optional dep fetched from the npm registry at build time** through the `HTTP_PROXY`/`HTTPS_PROXY` build-args (`docker-compose.yml` forwards `${HTTPS_PROXY:-}`). Transports: SDK / CLI / **API** (`aif-handoff docs/providers.md:64`).

---

## §3 The GAP — failure modes NO existing helper covers (the skill's real value-add)

These three surfaced 2026-06-03 and are NOT caught by `bridge-health.sh` (which covers dirty_worktree/dedup/park/net). Each needs: a **detector** + the **documented fix** + **reversibility note**.

1. **Runtime native-binary missing (CLI/SDK transport dead).**
   - Detect: `docker exec aif-handoff-agent-1 claude --version` prints `Error: claude native binary not installed`; coordinator log `ClaudeRuntimeAdapterError … native binary not installed`; symptom = task stuck `planning`, `costUsd:0 tokenTotal:0`, reverts to `planning` each tick (crash-loop).
   - Root cause: image rebuilt while proxy down → optional native dep `@anthropic-ai/claude-code-<platform>` never fetched (`/usr/local/lib/node_modules/@anthropic-ai/claude-code-linux-arm64` empty).
   - Fix A (durable, operator GO): rebuild agent with a working proxy — `HTTPS_PROXY=<live> NO_PROXY=localhost,127.0.0.1,::1,api,agent,web,mcp docker compose build agent && docker compose up -d agent`.
   - Fix B (bypass binary): switch the claude runtime profile to **API transport** (`providers.md:64`; needs `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL`; flag the paid-vs-subscription nuance per `no-paid-llm-in-ci.md`).
   - In-container `npm install` of the native pkg WORKS only if the container can reach the registry (see mode 3).

2. **Capacity-cap saturated by stale/zombie tasks.**
   - Detect: new task stays `backlog` while coordinator log says `active:N, limit:N "pipeline at capacity, skipping"`; the N occupiers are `plan_ready`/`review` with stale heartbeats.
   - Fix (operator GO): free a slot by `DELETE /tasks/:id` on a verified zombie (a `plan_ready` task with `implementationLog:false` whose sibling umbrella is already `verified`/merged) — the official route (`api/src/routes/tasks.ts:443`, same as web UI). **Verify zombie status before delete** (T-AIFDOC-A below). Alternative: bump `COORDINATOR_MAX_CONCURRENT_TASKS` (1–10) — config change, operator GO.

3. **Host↔npm-registry proxy block (flaky tunnel).**
   - Detect: `curl --max-time 25 https://registry.npmjs.org/...tgz` times out from BOTH host and container; matches memory `project_github_push_flaky_proxy_tunnel` (Clash fake-ip via `utun4`).
   - This is the deferred machine-level proxy issue (operator-side lever: real-ip/DIRECT routing). The skill's job is to **name it and stop**, not fix the tunnel — it blocks fix-A's npm path, pushing toward rebuild-with-working-proxy or API transport.

> **Empirical-only catalogue (T-AIFDOC-B):** start with these three + what `bridge-health.sh` already covers. Do NOT speculatively enumerate failure modes never observed — grow the catalogue on incidence (pain-driven, per project doctrine).

---

## §4 Skill shape (implementing session decides details; these are constraints)

- **Invocation:** `disable-model-invocation:false` with tight trigger description — fires on «aif не отвечает / задача висит / рантайм сломан / aif health / why won't my task start», plus explicit `/aif-doctor`. Must NOT over-trigger on normal dispatcher runs.
- **Flow:** (1) read-only health sweep — call `bridge-health.sh` + `verify-bridge.sh` (reuse, don't reimplement) + a quick capacity/runtime probe for the §3 gap; (2) classify the failure mode; (3) print the mapped fix command + reversibility; (4) for any mutation, surface + await GO.
- **Class C** + `Authoritative-for`/`NOT authoritative for` header (`doc-authority-hierarchy.md §3`); paired-negative block (principle 15); `@dual-pair`/`@cc-only-rationale` marker (`dual-implementation-discipline.md §6`). Promotion criterion: ≥2 «re-derived aif knowledge» incidents after ship → consider a session-start `bridge-health.sh` auto-run hook.
- **Anti-scope:** does NOT own the dispatch loop (`dispatcher`), planning (`pipeline`), or `~/.claude/skills/orchestrator/`. Does NOT add npm deps. Does NOT auto-mutate the aif runtime. Does NOT fix the host proxy tunnel (names it, stops).

---

## §5 AI-traps active (`.claude/rules/ai-laziness-traps.md §2`)

- **T11/T13/T16** — do NOT assume a helper covers a mode by its name; verify `bridge-health.sh` scope vs the §3 gap empirically (it does NOT cover runtime-binary/capacity/host-proxy — confirmed 2026-06-03).
- **T15 self-application** — the skill that diagnoses aif must itself be tested: bench it against ≥3 of today's real symptoms (stuck-planning crash-loop, backlog-at-capacity, npm-timeout) and show it classifies each correctly.
- **T20** — every fix the skill emits must be evidence-backed (file:line / log line / command output), not a remembered command.
- **T-AIFDOC-A — «jaccard/sibling ⇒ blind delete»:** before any `DELETE /tasks/:id`, confirm the target is a true zombie (`implementationLog:false` AND sibling umbrella verified/merged), never delete on name-match alone.
- **T-AIFDOC-B — «speculative failure catalogue»:** only codify empirically-observed modes (§3 note).

## §6 Recursive self-application

`aif-doctor` is itself an operational artefact: ship its own `done.md` at close; bench-test it on real 2026-06-03 symptoms (T15); register it in SSOT (`prior-art-evaluations.md`) with the reuse verdict.

## §7 Stop conditions

- BFR gate surfaces an existing upstream/own helper that already does the §3 detection → REUSE it, shrink the skill to a pointer.
- Any §3 fix requires a paid-LLM path (API transport with paid key) → mark DEFER per `no-paid-llm-in-ci.md`, do not bake it as default.

## §8 Carry-over from the originating session (separate, do NOT bundle)

- The 2026-06-03 aif runtime is STILL broken (task `cf8534d9` crash-looping on missing binary; proxy blocks npm). Fixing it = operator action (rebuild-with-proxy or API transport), tracked separately from this skill build.
- The original `hygiene-cleanup` umbrella (wave-plan §0 reconcile, `done.md` sweep, memory-codify) was NEVER executed — it remains open. Decide separately whether to do it in-session (markdown, ~15 min) or re-dispatch once the runtime is fixed.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
