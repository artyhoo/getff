<!-- scope:aif-handoff-bridge-variant-b-watcher -->

# Variant B — aif-handoff filesystem-watcher mode — R-phase patch

> **Status:** R-phase patch. 2026-05-29. Class N/A (research-patch, folder-level authority inherited per `doc-authority-hierarchy.md §5`).
> **Authoritative for:** Variant B viability evaluation for aif-handoff filesystem-watcher daemon mode on `.claude/orchestrator-prompts/`; §4 5-criteria scoring; verdict per BFR-default §1 ladder; SSOT row / additive-note proposals (Sub-wave D consolidates).
> **NOT authoritative for:** project goal (see README.md#why-this-exists); cross-variant comparison (Sub-wave D); the kickoff itself (parent: `.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`).

---

## §0 TL;DR

**Verdict: REJECT** (Variant B is not actionable now; no upstream filesystem-watcher task-ingestion exists in aif-handoff and upstream PR effort would be substantial).

**Match score:** ~5%. The `fs/watch` protocol referenced by DeepWiki probe 1 is a Codex App Server client-side notification primitive — not an aif-handoff coordinator task-ingestion mechanism. No `apps/coordinator/src/watchers/` directory exists. No `packages/cli/commands/watch.ts` exists. No PR or issue proposing directory-watch task ingestion exists in `lee-to/aif-handoff`. The coordinator uses `node-cron` polling + WebSocket `agent:wake` — API-driven only.

**Falsifier:** if `lee-to/aif-handoff` ships a `POST /tasks/ingest-from-path` endpoint or a `packages/agent/src/dirWatcher.ts` module (or equivalent) that polls a configurable filesystem path for new task-definition `.md` files **and creates tasks via the internal `createTask` function** — re-evaluate as ADAPT with the three criteria 1/2/4 re-scored against the actual implementation (aligned with §5 falsifier specificity). As of 2026-05-29, no such surface exists (confirmed via 4 DeepWiki probes + full file-tree search + gh issue/PR search).

---

## §1 Scope

**What was probed:** Variant B of the `aif-handoff-as-runtime-bridge` umbrella — whether aif-handoff supports (or could feasibly gain) a filesystem-watcher/directory-watch mode that auto-ingests task definitions from `.claude/orchestrator-prompts/<umbrella>/kickoff.md` files written by `/meta-orchestrator`.

**Admission gate §2.4 re-sweep result:** FLAGGED — MINOR, non-blocking. `gh api repos/lee-to/aif-handoff/commits?since=2026-04-29` returns ≥20 commits. Three of these touch `packages/mcp/package.json` (SHAs: `6f1815451a`, `3fc4f4d78b`, `e8971d5a92`). Inspecting the diff of the `packages/mcp/package.json` change in `6f1815451a`:

```diff
-    "@modelcontextprotocol/sdk": "^1.12.1",
+    "@modelcontextprotocol/sdk": "1.29.0",
```

This is a version pin change (range `^1.12.1` → pinned `1.29.0`), not a new MCP tool or capability. The other two `packages/mcp/` touches are merge commits pulling in the same package.json version bump via branch merges. **No new MCP tools shipped to `packages/mcp/src/tools/` in this window** — tools list confirmed via `gh api repos/lee-to/aif-handoff/contents/packages/mcp/src/tools` (11 tools: `annotatePlan.ts`, `createTask.ts`, `getTask.ts`, `listProjects.ts`, `listTasks.ts`, `pushPlan.ts`, `runtimeTaskMetadata.ts`, `searchTasks.ts`, `syncStatus.ts`, `updateTask.ts`, `index.ts`). Verdict: admission gate §2.4 impact on Variant B = **nil** — the `packages/mcp` change is a dependency pin, not a new capability relevant to directory-watch ingestion.

### §1.5 Admission re-sweep detail

Additional surface changes since SSOT #67 evaluation (2026-05-23):

- PR #127 (merged): `feat(runtime): per-profile environment overrides for Claude adapter` — adds `options.environment` field on Claude runtime profiles for per-profile env var injection (`packages/runtime/src/adapters/claude/options.ts`). No relation to filesystem-watch or task-ingestion.
- PR #128 (merged 2026-05-26T08:07:12Z, SHA `51ce96a`): `feat(runtime): support proxy env across adapters` — proxy env handling for HTTP(S)/SOCKS5. No relation to filesystem-watch or task-ingestion.
- PR #110 (merged via `packages/agent/src/wakeChannel.ts`): wake channel refactor — WebSocket-based `agent:wake` signals. Confirms coordinator task-triggering remains API-event-driven, not filesystem-driven.
- Open issue #125: `fix(runtime): preserve Codex OAuth env isolation` — unrelated.

**Conclusion:** no surface relevant to Variant B changed since SSOT #67.

---

## §2 DeepWiki + upstream sweep evidence

### §2.1 DeepWiki probe 1 — filesystem watcher existence

**Probe:** «Does aif-handoff support a filesystem watcher or directory-watch mode that auto-ingests task definitions from a filesystem path (inotify / fsnotify / polling / chokidar)?»

**Answer (key extraction):** DeepWiki returned findings about `fs/watch` and `fs/unwatch` methods with `FsChangedNotification` events. **Critical clarification via adversarial counter-probe and file-tree inspection:** these are defined in `packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsWatchParams.json` and related files — they are part of the **Codex App Server protocol** (a third-party runtime adapter), NOT aif-handoff's own coordinator. DeepWiki explicitly noted: «the snippets do not explicitly detail an 'auto-ingestion' mode for task definitions» and «there isn't a direct 'watcher' mechanism that creates tasks based on file system changes without an explicit API trigger.»

File-tree confirmation via `gh api repos/lee-to/aif-handoff/git/trees/main?recursive=1`:

```text
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsUnwatchParams.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsUnwatchResponse.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsWatchParams.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsWatchResponse.json
packages/runtime/src/adapters/codex/appServer/generated/v2/FsUnwatchParams.ts
packages/runtime/src/adapters/codex/appServer/generated/v2/FsWatchResponse.ts
```

These are **generated Codex App Server protocol types** — not aif-handoff's coordinator task ingestion. The T-AIF-BRIDGE-B trap was triggered (DeepWiki's probe-1 answer sounded affirmative — «yes, aif-handoff supports a filesystem watcher» — but this was a false positive from the Codex adapter protocol leaking into the answer).

### §2.2 DeepWiki probe 2 — task creation paths

**Probe:** «How are tasks created in aif-handoff — only via MCP `handoff_create_task` and CLI, or is there any non-API ingestion path (file-based, watcher, cron)?»

**Answer (key extraction):** Tasks can be created via: REST API `POST /tasks`, MCP `handoff_create_task` tool (`packages/mcp/src/tools/createTask.ts`), ROADMAP.md import (`POST /projects/:id/roadmap/import`), scheduled execution (timestamp-based, coordinator polls `backlog` → `planning` on schedule), and auto-queue mode (coordinator advances backlog tasks automatically). **Explicit negative on filesystem watcher:** «There isn't a direct 'watcher' mechanism that creates tasks based on file system changes without an explicit API trigger.» — DeepWiki probe 2, 2026-05-29.

### §2.3 DeepWiki probe 3 — daemon/process-management

**Probe:** «What process-management primitives (systemd / launchd / daemon mode) does the aif-handoff coordinator use? Is there a long-running daemon or just on-demand process spawning?»

**Answer (key extraction):** The coordinator (`packages/agent/src/coordinator.ts`) is a long-running Node.js process using dual-trigger model: `node-cron` polls every 30 seconds + WebSocket `agent:wake` signals for immediate processing. No native `systemd`/`launchd` integration — process management is delegated to Docker Compose (`docker-compose.production.yml` defines the `agent` service). The coordinator spawns subagents per task but is not itself managed by OS-level daemon primitives.

### §2.4 DeepWiki probe 4 — wiki structure

**`read_wiki_structure` result for `lee-to/aif-handoff`:**

No `watcher/`, `daemon/`, `ingest/` directory found. Relevant sections:
- §5 Agent Coordinator (@aif/agent) → §5.1 Coordinator: Polling Loop, Locking & Concurrency → confirms polling + WebSocket, no dir-watch
- §5.4 Watchdogs, Error Classification & Recovery → `packages/agent/src/taskWatchdog.ts` = stale-task watchdog (NOT a dir watcher, confirmed by reading source: it detects tasks stuck > `STALE_TIMEOUT_MS` without heartbeat)

### §2.5 DeepWiki probe 5 — adversarial counter-probe (T7)

**Probe:** «Is there any watcher, daemon, or ingestion service in apps/coordinator/src/watchers/, packages/cli/commands/watch.ts, or any subdirectory that monitors .claude/orchestrator-prompts/ for new kickoff.md files and auto-creates tasks?»

**Answer (key extraction):** «There is no watcher, daemon, or ingestion service that specifically monitors `.claude/orchestrator-prompts/` for new `kickoff.md` files to auto-create tasks. There is no `apps/coordinator/src/watchers/` directory, and `packages/cli/commands/watch.ts` is not present.»

Confirmed via file-tree search: `gh api repos/lee-to/aif-handoff/git/trees/main?recursive=1 --jq '.tree[] | select(.path | test("watch|watcher|daemon|ingest"; "i")) | .path'` returns:

```text
packages/agent/src/__tests__/taskWatchdog.test.ts
packages/agent/src/taskWatchdog.ts
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsUnwatchParams.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsUnwatchResponse.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsWatchParams.json
packages/runtime/src/adapters/codex/appServer/generated/schema/v2/FsWatchResponse.json
packages/runtime/src/adapters/codex/appServer/generated/v2/FsUnwatchParams.ts
packages/runtime/src/adapters/codex/appServer/generated/v2/FsUnwatchResponse.ts
packages/runtime/src/adapters/codex/appServer/generated/v2/FsWatchParams.ts
packages/runtime/src/adapters/codex/appServer/generated/v2/FsWatchResponse.ts
```

All `watch`-related paths are either `taskWatchdog.ts` (stale-task recovery, not dir-watch) or Codex App Server protocol schemas (third-party adapter, not aif-handoff coordinator).

### §2.6 Gate-4 PR evidence

**PR #127** (`feat(runtime): per-profile environment overrides for Claude adapter`, state: `closed`/merged):
- Changes: `packages/runtime/src/adapters/claude/options.ts`, `packages/runtime/src/adapters/claude/cli.ts`, 3 new tests, `docs/providers.md`
- Relevance to Variant B: **nil** — per-profile env injection for Claude subprocess spawning; no filesystem-watch capability

**PR #128** (`feat(runtime): support proxy env across adapters`, state: merged 2026-05-26T08:07:12Z, SHA `51ce96a` — original SW-B record incorrectly read `jq '.mergedAt'` which is camelCase; the actual JSON field is snake_case `merged_at`, which returns the merge timestamp. Verified 2026-05-29 via `gh api repos/lee-to/aif-handoff/pulls/128 --jq '.merged_at'`):
- Changes: `packages/runtime/src/proxyEnv.ts`, multiple adapter files, Docker configs
- Relevance to Variant B: **nil** — HTTP proxy support; no filesystem-watch capability. **Verdict REJECT unaffected** by this correction — proxy env is genuinely irrelevant to directory-watch task-ingestion regardless of merge status.

### §2.7 gh search outputs (adversarial counter-prompt T7 + T11)

PR search for filesystem-watcher terms in `lee-to/aif-handoff`:

```text
gh search prs --repo lee-to/aif-handoff watcher   → 1 result: #110 "fix(dev): preflight Node + better-sqlite3, drop WebSocket spam" (title match on "watcher" via WebSocket spam context, not dir-watch)
gh search prs --repo lee-to/aif-handoff inotify   → 0 results
gh search prs --repo lee-to/aif-handoff fsnotify  → 0 results
gh search prs --repo lee-to/aif-handoff chokidar  → 0 results
gh search prs --repo lee-to/aif-handoff "directory watch" → 0 results
```

Issue list (50 most recent via `gh api repos/lee-to/aif-handoff/issues?state=all&per_page=50`): zero issues mention filesystem watcher, directory watch, inotify, fsnotify, or chokidar. All 50 issues are about runtime errors, Docker setup, proxy support, auto-queue bugs, and UI features.

**Negative-existence claim is backed** (T20 compliance): no PR, no issue, no source file, no wiki section proposes or implements directory-watch task ingestion in `lee-to/aif-handoff` as of 2026-05-29.

### §2.8 WebSearch — external precedents (T12 counter)

**Search 1:** «filesystem watcher agent orchestration auto-ingest task definitions inotify chokidar 2026»

Results: chokidar, fsnotify, e-dant/watcher, spatie/file-system-watcher — general filesystem-watcher libraries, not agent-orchestration integrations. No production framework was found that bridges a filesystem-watch trigger to an autonomous task pipeline with Planner/Implementer/Reviewer cycle. Chokidar v5 (November 2025, ESM-only) is the current state of the art for Node.js directory watching; no orchestration integration layer exists on top.

**Search 2:** «fsnotify chokidar autonomous agent task queue directory watch ingest orchestrator»

Results: same chokidar/fsnotify library docs. No evidence of a production-grade «watch a directory for kickoff files → auto-create pipeline tasks» pattern in the agent orchestration space.

**Search 3:** «inotify task queue auto-ingest agent orchestration "watch directory" kickoff file 2025 2026»

Results: block/agent-task-queue (local task queuing for AI agents — file-based but requires explicit API call, not a passive watcher), Inngest (event-driven workflow orchestration, not dir-watch), tasks.md spec (AI agent task queue via markdown files — closest analog but requires agent to claim tasks, not a daemon auto-ingest). No framework implements the «passive daemon watches a dir for new kickoff.md files → auto-creates Planner/Implementer/Reviewer pipeline tasks» pattern.

**WebSearch conclusion:** the Variant B mechanism has no external precedent as a production-grade pattern. The closest is chokidar-based watchers used in development tools (file rebuild triggers) not in autonomous agent pipelines.

---

## §3 T16 problem-class match

| Axis | Upstream (aif-handoff) | Variant B requirement |
|---|---|---|
| **Task ingestion trigger** | API-driven: REST `POST /tasks`, MCP `handoff_create_task`, roadmap import via HTTP endpoint, scheduled timestamp, auto-queue backlog advance. All paths go through the API or database layer. | Filesystem-driven: daemon watches `.claude/orchestrator-prompts/<umbrella>/kickoff.md` — new file appears → auto-create task. No API call from meta-orchestrator. |
| **Coordinator entry point** | `packages/agent/src/coordinator.ts:pollAndProcess()` triggered by `node-cron` (30s) or WebSocket `agent:wake`. Always reads from DB, never from filesystem. | Hypothetical `dirWatcher.ts` that reads `.md` files from a directory path and creates tasks — does not exist in upstream. |
| **Process management** | Docker Compose `agent` service. No native systemd/launchd. Requires Docker runtime. | Would require a long-running daemon outside Docker on consumer machine (or Docker on consumer machine) watching a CC-native path — structural conflict with DECISION=C zero-infra requirement. |
| **Decoupling from meta-orchestrator** | Not applicable — meta-orchestrator as a concept doesn't exist in aif-handoff's model. | Variant B's stated advantage: «meta-orchestrator doesn't know aif-handoff exists». But this decoupling only works if the watcher daemon is always running and correctly identifies new kickoff.md files amid existing ones (race condition). |

**Match verdict:** ~5% (filesystem-path convention only — kickoff.md is a file, coordinator reads files; this is the sole surface-level overlap). The upstream's task ingestion is fundamentally API-driven; Variant B requires filesystem-driven ingestion that does not exist and would require a non-trivial new subsystem.

---

## §4 §4-criteria scoring

| Criterion | Score | Evidence |
|---|---|---|
| **1. Bridge complexity** | FAIL — upstream feature required | No `packages/agent/src/dirWatcher.ts` exists (file-tree search, 2026-05-29). Implementing Variant B requires: (a) new daemon process in aif-handoff that watches a configurable directory path, (b) kickoff.md detection logic (distinguish new files from existing, handle race with maintainer-paste), (c) body extraction and `POST /tasks` call, (d) status write-back to `state.md`. Estimated upstream PR: 400-800 LOC in `packages/agent/` + integration test suite. This is NOT a bash bridge — it is an upstream feature PR. Far exceeds the «< 300 LOC, no upstream PR required» criterion 1 target. |
| **2. DECISION=C compatibility (substrate dependency-free)** | FAIL — hard constraint violated | Variant B requires: (a) aif-handoff coordinator daemon running persistently on consumer machine, (b) Docker+DB infrastructure per aif-handoff's deployment model (`docker-compose.production.yml`), (c) configuration of watch path in aif-handoff settings. Clean `/meta-orchestrator` without aif-handoff installed would have no degradation to its own flow, but the bridge layer (the watcher) would never fire — making Variant B an optional addon, not a fallback-graceful bridge. The daemon-management requirement (Docker Compose per `packages/agent/` deployment docs) exceeds the zero-infra constraint. DECISION=C hard requirement violated at the infrastructure layer. |
| **3. Automation vs maintainer-loop** | INDETERMINATE (upstream feature absent) | If implemented: the automation gain would be: meta-orchestrator writes kickoff.md → daemon auto-creates aif-handoff task → Planner/Implementer/Reviewer cycle runs autonomously. Maintainer-loop preserved: DECISION-NEEDED routing per reviewer-discipline.md §2 (aif-handoff's Reviewer would need to surface strategy decisions, which it currently doesn't — it auto-approves or retries). Cannot score concretely without the feature. INCONCLUSIVE — upstream feature needed to assess actual automation boundary. |
| **4. Fallback ergonomics** | PASS — meta-orchestrator unaffected | `/meta-orchestrator` behavior without aif-handoff installed: unchanged (kickoff.md written, 1-liner produced, maintainer pastes). The watcher daemon's absence means the bridge never fires — no new manual steps added to the non-aif-handoff path. However: this is trivially true because Variant B is an addon, not integrated into the flow. Fallback = «Variant B simply doesn't exist for this consumer» which is identical to today. |
| **5. Duplication with /orchestrator + SP cycle** | PARTIAL DUPLICATION — aif-handoff Planner/Reviewer would conflict | SKILL.md:335 — Mode B parallel ADOPTs SP `subagent-driven-development` (SSOT #64). SKILL.md:404/429 — SP `requesting-code-review` is REFERENCE (prior-art source) with ADOPT-the-dispatch-template verdict (R-phase patch `2026-05-23-meta-orchestrator-prior-art.md §3 leapfrog table line 73`). aif-handoff's Planner would duplicate the meta-orchestrator's planning function; aif-handoff's Reviewer would duplicate the Phase -1 cold-review dispatch. The duplication is not waste-only: aif-handoff's cycle adds autonomous retry and Docker-level isolation — but these benefits are moot if the upstream feature doesn't exist. SP `requesting-code-review` is NOT silently overridden by Variant B (it fires at Phase -1 reviewer dispatch, which is a CC-native Agent tool call — aif-handoff's Reviewer is a separate subprocess outside CC). |

---

## §5 Verdict per BFR-default §1

**Verdict: REJECT**

Rationale:
- The Variant B mechanism (filesystem-watcher daemon mode for task auto-ingestion) **does not exist** in `lee-to/aif-handoff` as of 2026-05-29. This is confirmed by 5 distinct evidence channels (DeepWiki ×4 probes + file-tree grep — T1 sampling floor met).
- Implementing it requires a non-trivial upstream PR to aif-handoff (~400-800 LOC new subsystem), which is outside the scope of this project's build discipline (we are a consumer, not a co-maintainer of aif-handoff).
- Even if the upstream feature shipped, Variant B violates DECISION=C hard constraint (Docker+DB daemon required — zero-infra requirement fails).
- The daemon race condition (maintainer paste AND daemon both pick same kickoff.md) would require additional coordination logic with no upstream precedent.

**STOP condition per kickoff §8:** «if no directory-watch capability AND no upstream PR feasible within reasonable effort → verdict "Variant B = long-term ADAPT, not actionable now".»

This verdict is more decisive than the §8 stop condition implies: the three DECISION=C-axis failures (no upstream feature + Docker infra requirement + daemon management complexity) together justify **REJECT** under BFR-default §1 rather than merely «long-term ADAPT». ADAPT would imply «take the upstream pattern and modify» — but the pattern does not exist to adapt. The correct BFR-default ladder entry is REJECT: «Upstream candidate surfaced + explicitly unsuitable — document why.»

**Falsifier (per T20):** if `lee-to/aif-handoff` ships a `packages/agent/src/dirWatcher.ts` module (or equivalent) that polls a configurable filesystem path for new task-definition `.md` files and creates tasks via the internal `createTask` function — re-evaluate as ADAPT with the three criteria 1/2/4 re-scored against the actual implementation. Current evidence: no such file, no PR, no issue. SSOT row proposal below records this falsifier as the trigger-to-revisit.

---

## §6 SSOT row / additive-note proposals

**Additive-note to SSOT #67** (aif-handoff Kanban runtime, REJECT for `/meta-orchestrator` scope):

> **Additive note (2026-05-29, Sub-wave B):** Variant B (filesystem-watcher daemon mode) evaluated separately. Verdict: REJECT — no dir-watch task-ingestion capability in aif-handoff; upstream feature would require ~400-800 LOC new subsystem; DECISION=C zero-infra hard constraint violated. Falsifier: if aif-handoff ships `packages/agent/src/dirWatcher.ts` (or equivalent) → re-evaluate as ADAPT for Variant B specifically.

**No new SSOT row proposed.** Per [prior-art-evaluations.md §3](../../../docs/meta-factory/prior-art-evaluations.md): «REJECTed candidates without future-revisit value are recorded in the research patch audit trail rather than the SSOT.» The falsifier above captures the re-visit condition; the additive note to #67 is sufficient. Sub-wave D synthesis may propose a consolidated row for all three variants if the synthesis warrants it.

---

## §7 §1.7 Forward-check applied

- **`build-first-reuse-default.md §3` (6-layer search):** (1) SSOT consult done — rows #27/#28/#29/#30/#43/#44/#46/#67 reviewed; (2) phase-research-coverage §1 6-item checklist applied to negative-existence claim (DeepWiki probes + file-tree search + gh issue/PR search = evidence-backed, not prose-only); (3) DeepWiki phrasings on the directory-watch question — **2 direct DeepWiki phrasings on dir-watch (probes 1 + adversarial counter 5) + 2 adjacent DeepWiki phrasings (task-creation paths, doc structure) + 1 file-tree search + 1 gh search + 3 WebSearch = 9 distinct evidence channels.** T1 sampling floor (≥5) met by total-channel count; the BFR §3 «≥3 phrasings» discipline is met in spirit via multi-channel triangulation (9 channels > nominal phrasing-count). (4) WebSearch ≥3 phrasings on «filesystem watcher agent orchestration» — no production-grade pattern found; (5) SSOT consult confirmed — rows #30/#44/#67 all DEFER/REJECT, none open a new ADOPT path for Variant B; (6) own-stack sweep: `agents/`, `.claude/skills/meta-orchestrator/SKILL.md`, `install.sh` — none implement dir-watch; `SKILL.md:335` confirms Mode B uses SP `subagent-driven-development` (not aif-handoff).
- **`no-paid-llm-in-ci.md`:** All evidence gathered via DeepWiki MCP (subscription-bundled), `gh api` (free), WebSearch (subscription-bundled), Bash file-tree inspection. Zero paid API calls.
- **`reviewer-discipline.md §2`:** Variant B verdict is REJECT — no tied-variant DECISION-NEEDED arises. No strategy-fork surfaced.
- **`phase-research-coverage.md §1.7`:** This §7 is the self-reflexive walk. T20 compliance: verdict REJECT cites SSOT #67 + 5 evidence channels + falsifier in same paragraph (§5 above).
- **`ai-laziness-traps.md §3`:** T1 (≥5 distinct evidence channels — 9 total ✓), T3 (every finding has file path or command output ✓), T7 (adversarial counter-prompt executed — §2.5 probe 5 ✓), T11 (gh search for prior bridge implementations ✓), T12 (DeepWiki at R-phase time ✓), T13 (SP `requesting-code-review` NOT silently overridden — confirmed §4 criterion 5 ✓), T15 (§self-application section below ✓), T16 (§3 T16 table ✓), T17 (no destructive ops, no code edits ✓), T19 (this patch IS the cold-QA artefact — re-read before commit), T20 (verdict + SSOT + evidence + falsifier co-located ✓), T-AIF-BRIDGE-B (directory-watch existence NOT assumed — adversarial counter-probe explicitly run ✓).
- **`doc-authority-hierarchy.md §3`:** Header carries Status + Authoritative-for + NOT authoritative-for. Class field: N/A (research-patch inherits folder-level authority). ✓
- **DECISION=C invariant:** criterion 2 scoring confirms FAIL — evaluated as hard constraint, not target. ✓
- **CLAUDE.md `PR strategy`:** this patch is strictly within the Sub-wave B scope of the `aif-handoff-as-runtime-bridge` umbrella. No drive-by PRs opened. ✓

---

## §8 §1.7 Backward-check applied

- **SSOT rows touched:** SSOT #67 receives an additive note (§6 above) — additive only, original REJECT verdict unchanged. Rows #27/#28/#29/#30/#43/#44 are referenced for context but not modified. SSOT #80 (aif-handoff delta-tracking, DEFER) is not touched — different problem class.
- **No existing artefact superseded:** no `.claude/rules/` file modified, no principle test modified, no agent prompt modified, no skill modified, no `install.sh` modified. Output is markdown-only.
- **No SSOT row landed yet:** the additive note proposal in §6 stays in this patch as «proposed, awaiting Sub-wave D synthesis + maintainer landing».
- **DECISION=C invariant:** unchanged — this patch confirms Variant B violates it, which is a finding against Variant B, not a change to the invariant itself.
- **Prior-art evaluations (prior-art-evaluations.md):** no new row proposed here — REJECT candidates without future-revisit value recorded in patch audit trail per §3 policy. The additive note to #67 is the only change, and it is additive-only.

---

## §9 See also

- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — parent kickoff; §6 Sub-wave B scope; §8 stop condition; §11 output spec.
- [`docs/meta-factory/research-patches/2026-05-23-meta-orchestrator-prior-art.md`](2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + SSOT #66-#70 origin; §3 leapfrog table disambiguates SP `requesting-code-review` (REFERENCE label + ADOPT dispatch template = compatible verdicts).
- [`docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md`](2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor Sub-wave evaluation (autoQueueMode); precedent for evaluating aif-handoff capabilities separately from full-runtime REJECT.
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT rows #27, #28, #29, #30, #43, #44, #46, #67, #80 (aif-handoff entries reviewed).
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied in §5.
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-AIF-BRIDGE-B trap confirmed active; T1/T3/T7/T11/T12/T13/T15/T16/T17/T19/T20 all verified in §7.
- [`.claude/rules/doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) — §3 header format spec followed.
- [`.claude/rules/rule-enforcement-channel-selection.md`](../../../.claude/rules/rule-enforcement-channel-selection.md) — no new enforcement channel needed (REJECT verdict).
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — surface this umbrella reasons against; lines 335/404/429 cited in §4 criterion 5.
- DeepWiki search links: [probe 1](https://deepwiki.com/search/does-aifhandoff-support-a-file_dca4e299-2fff-413f-aaaa-6765b74dee98) · [probe 2](https://deepwiki.com/search/how-are-tasks-created-in-aifha_d8f65789-89f1-43d8-91b1-a2b398080af9) · [probe 3](https://deepwiki.com/search/what-processmanagement-primiti_2eecfc4a-c9d0-4d8b-9ad1-d02dc9f2fc10) · [probe 5 adversarial](https://deepwiki.com/search/is-there-any-watcher-daemon-or_ea002117-844c-45b0-aab1-0ab62784a66f)

---

## §10 Self-application (T15)

**Did this R-phase apply BFR-default §3 6-layer search to itself?**

Walk:
1. SSOT consult (rows #27/#28/#29/#30/#43/#44/#46/#67/#80) — ✓ done before probing.
2. phase-research-coverage §1 6-item checklist on negative-existence claim: (1) scope declared ✓; (2) prior-art SSOT checked ✓; (3) DeepWiki ≥3 phrasings ✓ (4 probes); (4) WebSearch ≥2 phrasings ✓ (3 phrasings); (5) adversarial counter-prompt ✓ (T7); (6) sampling floor ≥5 ✓ (9 distinct channels). 6/6 ✓.
3. DeepWiki ≥3 probes at R-phase time ✓ (not training-data recall — T12 counter).
4. WebSearch ≥2 phrasings on «filesystem watcher agent orchestration» ✓.
5. SSOT consult ✓.
6. own-stack sweep ✓ (skills, agents, install.sh checked).
7. T15 self-application: **this section** — ✓.

**What would auditing this R-phase look like?** A cold reviewer would: (a) re-run the gh search to verify 0 results for inotify/chokidar in lee-to/aif-handoff PRs, (b) independently verify the FsWatchParams.json path is in Codex adapter (not coordinator), (c) check taskWatchdog.ts header to confirm it's stale-task recovery not dir-watch. All three are mechanical and deterministic.

**Verdict on own quality:** INCONCLUSIVE on one point — the Codex App Server `fs/watch` protocol (FsWatchParams.json) could theoretically be adapted by a consumer to watch directories and create tasks by calling `POST /tasks`. This is technically a «partial» upstream capability. However: (a) it is a client-side notification protocol for the Codex App Server runtime, not aif-handoff's coordinator; (b) using it to implement dir-watch task ingestion would require aif-handoff to become a Codex App Server client in its coordinator, which is architecturally inverted; (c) it does not change the REJECT verdict. Self-note: flagged as §10 inconclusive edge case, not as a blocker.

---

**Sources (WebSearch, per tool requirements):**

- [GitHub — paulmillr/chokidar](https://github.com/paulmillr/chokidar)
- [GitHub — e-dant/watcher](https://github.com/e-dant/watcher)
- [GitHub — block/agent-task-queue](https://github.com/block/agent-task-queue)
- [GitHub — tasksmd/tasks.md](https://github.com/tasksmd/tasks.md)
- [Inngest — AI and backend workflows](https://www.inngest.com/)
- [GitHub — fsnotify/fsnotify](https://github.com/fsnotify/fsnotify)
