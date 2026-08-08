<!-- scope:aif-handoff-bridge-variant-b-prime-hybrid -->
<!-- line-limit-exempt: closed research-patch, 605 lines at closure (2026-05-29); append-only archive — splitting would sever folder-level authority + external citations. Grandfathered per operator decision 2026-08-08; enforcement: .husky/pre-commit exempt case. -->

# Variant B' — hybrid CC-hook (or standalone watcher) + aif-handoff existing MCP — R-phase patch

> **Status:** R-phase Sub-wave B2 complete — 2026-05-29. **NOT prescriptive** — additive evaluation for maintainer decision. Class N/A (research-patch, folder-level authority inherited per [`doc-authority-hierarchy.md §5`](../../../.claude/rules/doc-authority-hierarchy.md)). No code changes, no skill edits, no SSOT row landings in this patch.
> **Authoritative for:** Variant B' (hybrid fs-watcher → aif-handoff MCP) feasibility — CC-hook capability probe outcome, aif-handoff MCP standalone-callability outcome, fs-watcher LOC comparison across 3 sub-options (a/b/c), Write-atomicity / race-condition analysis, per-blocker walk against SW-A's 3 ADOPT-blockers, §4 5-criteria scoring, BFR-default verdict, comparison table vs A and B, SSOT additive-note proposal.
> **NOT authoritative for:** project goal (see [README.md#why-this-exists](../../../README.md#why-this-exists)); SW-A's own MCP / `accept_existing_plan` / WebSocket findings (those belong to [SW-A patch](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — re-cited here, not re-evaluated); SW-B's native-fs-watcher REJECT (separate evaluation per [SW-B patch §0](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) — B' is a different mechanism that does NOT require a native aif-handoff watcher); cross-variant synthesis (Sub-wave D); the kickoff itself (parent: [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md)).

---

## §0 TL;DR

**Verdict: REFERENCE** (design vocabulary for dispatch-trigger optimisation of Variant A; not actionable standalone)

**Match score:** ~35% — the fs-watcher mechanism is feasible (3 sub-options all under <100 LOC target — Option (a') = **0 LOC** of code via the `type: "mcp_tool"` PostToolUse hook config, Option (a) = ~20-30 LOC bash via PostToolUse `command` + curl, Option (b) = ~50-80 LOC Node via chokidar), aif-handoff MCP is callable standalone without coordinator daemon (DeepWiki probe 2026-05-29: «MCP server can be invoked statelessly from an arbitrary process and does not strictly require the coordinator daemon to be running»), CC PostToolUse hooks **cannot** invoke MCP directly via `command` type **but a dedicated `mcp_tool` hook type exists** for already-connected MCP servers — solving T-AIF-BRIDGE-B'-1 in a different shape than originally framed. **BUT:** B' inherits **all three** SW-A ADOPT-blockers verbatim (PLAN.md disk coupling, WebSocket-broadcast no-topic-filter, autoMode Reviewer ↔ [`reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) conflict), and B' optimises only the **dispatch trigger** (replacing one maintainer-paste with one auto-event) — it does **not** unlock anything A doesn't already block.

**Falsifier outcome: CONDITIONAL PASS / STRUCTURAL FAIL**

CC hooks can invoke MCP via the `mcp_tool` hook type (verbatim from `code.claude.com/docs/en/hooks.md`, fetched 2026-05-29: «call a tool on an already-connected MCP server. The tool's text output is treated like command-hook stdout»). aif-handoff MCP runs standalone via `npm run mcp:http` against `packages/mcp/scripts/dev-http.mjs` (DeepWiki 2026-05-29 — see §2.2). Both 2026-05-29 probes pass. But the inherited 3 ADOPT-blockers from SW-A are unchanged by the dispatch-trigger optimisation, the consumer-side aif-handoff MCP server must still be connected to the CC session for Option (a'), and `tool_input` substitution exposes only `file_path` — not file *content* — so the hook config alone cannot fully populate `handoff_create_task`'s `description` field with the kickoff body (a thin command pre-processor or a server-side file-read is still required). Structural fail = «B' standalone changes only the cheapest part of A's adoption cost; the load-bearing blockers persist».

**Key falsifier per kickoff §3 Variant B' line 122:**
- (a) CC PostToolUse hooks CANNOT invoke MCP via `command` type → TRUE per docs but `mcp_tool` hook type **exists** → falsifier evades, B' viable via Option (a').
- (b) aif-handoff MCP requires coordinator-daemon-local context → FALSE per DeepWiki probe — MCP is self-sufficient → falsifier evades, B' viable.

Both legs of the kickoff falsifier evade; the verdict downgrade comes from inherited-blocker analysis (§4 criterion 5 below), not from the original falsifier.

---

## §1 Scope

**Variant evaluated:** Variant B' (B-prime) — hybrid where WE build a small fs-watcher on OUR side (CC PostToolUse hook OR standalone Node/bash watcher) that calls aif-handoff's **existing** `handoff_create_task` MCP tool — without requiring aif-handoff to ship a new native fs-watcher (which SW-B rejected).

**Origin:** Sub-wave B2 added 2026-05-29 to kickoff §6 (commit on staging) after [SW-B](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) scoped its rejection narrowly to «aif-handoff has built-in directory-watch as native feature». SW-B verdict on native upstream feature stands; SW-B2 evaluates the hybrid alternative as a separate research artefact.

**What was probed (5 distinct evidence channels per [`ai-laziness-traps.md T1`](../../../.claude/rules/ai-laziness-traps.md) sampling floor):**

1. CC hooks capability — can PostToolUse hook execute Bash / curl / invoke MCP server / read tool_input fields?
2. aif-handoff MCP standalone — can `handoff_create_task` be invoked over HTTP without coordinator daemon running locally?
3. fs-watcher LOC comparison — chokidar vs inotifywait vs fswatch — minimum-viable-script line counts for «watch glob → emit event → invoke command».
4. Write atomicity / race condition — when does PostToolUse fire relative to file-content-on-disk; what are documented mitigation patterns?
5. Cross-platform feasibility — does each sub-option work on macOS + Linux + Windows-WSL?

Plus: per-blocker walk against SW-A's 3 ADOPT-blockers (PLAN.md, WebSocket broadcast, autoMode-Reviewer conflict); DN-1=B-constrained compatibility check; DECISION=C HARD-requirement re-verification.

---

## §2 DeepWiki + upstream + CC-docs sweep evidence

### §2.1 CC hooks capability — `code.claude.com/docs/en/hooks.md` fetch (2026-05-29)

**Probe:** «What shell capabilities are available to a PostToolUse command hook? Can a hook invoke an MCP server (stdio spawn or HTTP)? What atomicity guarantees on the Write tool? What is the JSON input schema for tool_input fields?»

**Key extraction (verbatim, fetched 2026-05-29 via WebFetch):**

> «Handlers run in the current directory with Claude Code's environment.»
> «The `command` string is passed to a shell: `sh -c` on macOS and Linux, Git Bash on Windows, or PowerShell when Git Bash isn't installed.»
> «On macOS and Linux, command hooks run in their own session without a controlling terminal as of v2.1.139. The hook process and any child processes cannot open `/dev/tty` or send escape sequences directly to the Claude Code interface.»
> «**MCP tool hooks** (`type: "mcp_tool"`): call a tool on an already-connected MCP server. The tool's text output is treated like command-hook stdout.»
> «`server` (required): Name of a configured MCP server. The server must already be connected; the hook never triggers an OAuth or connection flow.»
> «`input` (optional): Arguments passed to the tool. String values support `${path}` substitution from the hook's JSON input, such as `"${tool_input.file_path}"`.»
> «If the named server is not connected, or the tool returns `isError: true`, the hook produces a non-blocking error and execution continues.»
> «PostToolUse cannot block (it fires after the tool succeeds). Exit code 2 displays stderr as feedback; execution continues.»

**Critical findings:**

- **Command hooks CANNOT invoke MCP servers via `command` type** — but the dedicated `mcp_tool` hook type **exists** and is purpose-built for this exact use case. T-AIF-BRIDGE-B'-1 trap evades in shape: the original framing «hook calls handoff_create_task via curl» turns out to be **one** option; the cleaner option is `type: "mcp_tool"` hook config (zero shell code).
- **`tool_input.file_path` is substitutable into `mcp_tool` `input` field** via `${tool_input.file_path}` syntax — but `tool_input.content` (the file body for Write/Edit) is **NOT** documented as substitutable, and inspection of our shipped `inject-matching-rule.sh` ([line 25](../../../.claude/hooks/inject-matching-rule.sh#L25): `ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' …)"`) shows our existing hooks **parse `tool_input.file_path` from the JSON input via jq but do NOT consume `tool_input.content`**. To read the file body, a hook would need to open the file from disk after the write completes (no current hook does this — confirmed by inspection of all 9 hooks in `.claude/hooks/`). This means **Option (a') with `mcp_tool` config can pass `title="${tool_input.file_path}"` but cannot pass `description=<full kickoff body>` from the hook input directly** — a thin pre-processor (Option (a) command hook that opens the file + curls MCP) is still needed if the full kickoff body must reach `description`.
- **PostToolUse fires AFTER the tool succeeds** — implies the write is complete on disk, but **no explicit atomicity guarantee in the documentation**. T-AIF-BRIDGE-B'-2 trap (race condition) is **PARTIALLY MITIGATED** by empirical timing but **NOT DOCUMENTED** — handled in §2.4 below.
- **Cross-platform shell:** macOS/Linux via `sh -c`; Windows via Git Bash or PowerShell. Known Windows bash-resolution bug ([anthropics/claude-code#37634](https://github.com/anthropics/claude-code/issues/37634)) — Node.js `.mjs` hooks are the documented portable choice.

**Source URL:** [`code.claude.com/docs/en/hooks.md`](https://code.claude.com/docs/en/hooks.md) (fetched 2026-05-29).

### §2.2 aif-handoff MCP standalone — DeepWiki probe 1 (T1 floor)

**Probe:** «Can the aif-handoff MCP server be invoked statelessly from an arbitrary process (e.g. a filesystem watcher script, or a CC hook), or does the MCP server require the aif-handoff coordinator daemon (cron-based, `packages/agent/src/coordinator.ts`) to be running in the same process or on the same machine?»

**Key extraction (verbatim, 2026-05-29):**

> «The AIF Handoff MCP server can be invoked statelessly from an arbitrary process and does not strictly require the coordinator daemon to be running for basic task creation. The MCP server primarily interacts with the SQLite database directly.»
> «When the MCP server runs in HTTP mode on `MCP_PORT` (default 3100), invoking `handoff_create_task` over HTTP does not require the coordinator daemon to be running. The MCP server is self-sufficient, directly interacting with the SQLite database for task creation and updates.»
> «The MCP stdio-mode server can be spawned by a non-Claude Code process. The `docs/mcp-sync.md` documentation provides an example of how to configure the `stdio` transport with a `command` and `args` that can be executed by any process capable of spawning a child process and writing JSON-RPC to its stdin.»
> «The minimum runtime footprint to call `handoff_create_task` once and walk away is Node.js and a SQLite database.»
> «`docs/mcp-sync.md` explicitly states that "Mode 1 does not require MCP — the coordinator writes to the database directly via `@aif/data`," and "Mode 2: Manual Claude Code session… Skills call MCP tools themselves because there is no coordinator managing the run."»

**DeepWiki URL:** [aif-handoff MCP server standalone-callability](https://deepwiki.com/search/can-the-aifhandoff-mcp-server_fe20b286-5f4e-4dc7-bc19-93a95699096a)

### §2.3 aif-handoff MCP HTTP-daemon standalone — DeepWiki probe 2 (T1 floor, triangulation)

**Probe:** «Is the aif-handoff MCP server itself ABLE to run as an HTTP daemon on the consumer's machine separately from the coordinator? Can a consumer run JUST the MCP HTTP server (`npm run mcp:http`) without spinning up coordinator/api/web packages?»

**Key extraction (verbatim, 2026-05-29):**

> «Yes, the AIF Handoff MCP server can run as an HTTP daemon independently on a consumer's machine, persisting tasks to SQLite without requiring the coordinator, api, or web packages to be active.»
> «To run just the MCP HTTP server, you can use the `npm run mcp:http` command, which is defined in `packages/mcp/package.json` and executed by `packages/mcp/scripts/dev-http.mjs`. This script explicitly sets `MCP_TRANSPORT` to "http" and uses the `MCP_PORT` environment variable.»
> «The minimum docker-compose subset to run only the MCP HTTP server would involve the `mcp` service [shows yaml block: mcp service + ports 3100 + DATABASE_URL + db-data volume].»
> «The MCP server does not have an opinion about who created a task. Tasks created via external MCP HTTP calls (using `handoff_create_task`) are persisted to the SQLite database.»
> «**Autonomous progression to the planner stage works regardless of the task's origin (UI, CLI, or external MCP call). The agent coordinator, when running, polls the database for tasks in the `backlog` state and initiates the `planning` stage.**»

**DeepWiki URL:** [aif-handoff MCP HTTP-daemon independence](https://deepwiki.com/search/is-the-aifhandoff-mcp-server-i_b74a3b36-627e-43f2-89e0-5881fa9ee595)

**Critical synthesis (probes §2.2 + §2.3):** T-AIF-BRIDGE-B'-3 trap evades — MCP HTTP server is callable without coordinator. BUT: autonomous **pipeline progression** (the maintainer's actual hypothesis from kickoff §0 — «Planner → Implementer → Reviewer» autopilot) DOES require the coordinator daemon. So the «cheap MCP-only» footprint creates tasks that **sit in `backlog` forever** unless the coordinator is also running. For the maintainer's stated goal, B' has the **same infrastructure footprint as Variant A** (coordinator + MCP + SQLite); the standalone-MCP capability only optimises the «tracking-only» Variant C.

### §2.4 Write atomicity + chokidar `awaitWriteFinish` mitigation — WebSearch (2026-05-29)

**WebSearch query 1:** «Claude Code Write tool atomicity PostToolUse hook fires after file fully written partial-write race condition»

**Key extraction (verbatim from search-result synthesis):**

> «The hook does not block the agent's next action — by the time PostToolUse runs, the write has already happened.»
> «PostToolUse hooks fire after file writes complete.»
> «**No explicit documentation** addressing the specific concern about atomicity or partial-write race conditions. The documentation confirms that: (1) PostToolUse hooks run only after file-editing tools, (2) the PostToolUse event fires after the command completes.»
> «There is no explicit statement in the available documentation about: whether the Write tool guarantees atomic file writes, whether PostToolUse fires only after the entire file is fully written to disk, what happens if a partial write occurs or if there's a race condition between the write completing and the hook executing.»

**WebSearch query 2:** «chokidar `awaitWriteFinish` `stabilityThreshold` partial-write atomic-rename completion-marker file watcher race condition»

**Key extraction (verbatim):**

> «The `awaitWriteFinish` option will poll file size, holding its add and change events until the size does not change for a configurable amount of time.»
> «The `awaitWriteFinish.stabilityThreshold` option has a default value of 2000 milliseconds. Additionally, the `awaitWriteFinish.pollInterval` option (default: 100) controls the file size polling interval in milliseconds.»
> «The `atomic` option (default: true if useFsEvents and usePolling are false) automatically filters out artifacts that occur when using editors that use "atomic writes" instead of writing directly to the source file.»

**T-AIF-BRIDGE-B'-2 verdict: INCONCLUSIVE / MITIGABLE.**

- For **Option (a) command hook** + **Option (a') mcp_tool hook**: the empirical timing «PostToolUse fires after write completes» is **likely sufficient** but **not contractually documented**. Mitigation: hook should re-read file size before invoking MCP, and if invocation fails idempotently, retry once after 500 ms.
- For **Option (b) chokidar standalone**: `awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }` is the documented mitigation. Default 2000 ms delay between detection and event-fire eliminates partial-write artifacts.
- For **Option (c) fswatch/inotifywait standalone**: no native equivalent — typical pattern is debounce via `xargs -I {} sleep 0.5 && command {}` or write-completion-marker file (`<name>.done` written after `<name>` finalises).

**Sources (WebSearch):**

- [chokidar (paulmillr) — README on `awaitWriteFinish`](https://github.com/paulmillr/chokidar)
- [chokidar issue #458 — `awaitWriteFinish` does not work properly for 'change' events](https://github.com/paulmillr/chokidar/issues/458)
- [Claude Code Hooks tutorial — PostToolUse timing](https://blakecrosley.com/blog/claude-code-hooks-tutorial)

### §2.5 fs-watcher LOC comparison — WebSearch (2026-05-29)

**WebSearch query:** «chokidar minimum viable script watch glob emit command Node.js 2026 ESM» + «inotifywait fswatch macOS Linux portable bash script watch directory file pattern execute command 2026»

**Key extractions (verbatim from search results):**

- **chokidar v5 (November 2025):** «package ESM-only and increases minimum node.js requirement to v20. … reduced on-disk package size from ~150kb to ~80kb.» Minimum viable: `chokidar.watch('.').on('all', (event, path) => { console.log(event, path); })` — **~3 LOC** core + ~10 LOC for glob filter + spawn call + error handling = **~15-20 LOC for option (b)** (not 50-80 as the kickoff estimated — the v5 ESM-only / Node-built-in `glob` change pushes the realistic LOC down).
- **fswatch (em crisostomo):** «cross-platform file change monitor with multiple backends: Apple macOS File System Events, *BSD kqueue, Solaris/Illumos File Events Notification, Linux inotify and fanotify, Microsoft Windows and a stat()-based backend.» Minimum viable: `fswatch path/to/file | xargs -n 1 bash_command` — **~5 LOC for option (c)** if `fswatch` is installable via `brew`/`apt`.
- **inotifywait (Linux-only):** «macOS doesn't natively support Linux's inotify API, and uses a different framework: FSEvents.» Not portable cross-platform alone — pairing with `fswatch` for macOS = ~10 LOC and a dependency split. Worse than fswatch-everywhere.

**Sources (WebSearch):**

- [chokidar (paulmillr) — npm package and README](https://www.npmjs.com/package/chokidar)
- [chokidar v5 release notes (Nov 2025) — ESM-only](https://github.com/paulmillr/chokidar/releases)
- [fswatch — cross-platform file change monitoring](https://emcrisostomo.github.io/fswatch/)
- [fswatch (GitHub) — multiple backends overview](https://github.com/emcrisostomo/fswatch)

### §2.6 Cross-platform hook portability — WebSearch (2026-05-29)

**WebSearch query:** «Claude Code PostToolUse hook Windows WSL portable bash sh cross-platform Git Bash»

**Key extractions (verbatim):**

> «The recommended approach for cross-platform PostToolUse hooks is to invoke Node.js directly: `node .claude/hooks/formatter.mjs` works on Windows, Linux, and macOS. Claude Code requires Node.js, so node is always available.»
> «On Windows 11 with the native installer, hooks that invoke bash resolve to `C:\Windows\System32\bash.exe` (the WSL launcher stub) instead of Git Bash, causing hooks to hang indefinitely and freeze the entire TUI.»
> «The best practice to avoid bash resolution issues entirely is to use Node.js with `.mjs` hooks rather than shell scripts.»

**T-AIF-BRIDGE-B'-2 cross-platform finding:**

- **Option (a) bash hook** — works natively on macOS/Linux; on Windows requires `CLAUDE_CODE_GIT_BASH_PATH` env-var workaround OR known-bug exposure ([anthropics/claude-code#37634](https://github.com/anthropics/claude-code/issues/37634)).
- **Option (a') `mcp_tool` hook config** — zero shell involvement; portable to any CC-supported OS by construction.
- **Option (b) chokidar Node script** — invoke via `node .claude/hooks/watcher.mjs` per documented best-practice; portable by construction.
- **Option (c) fswatch** — `brew install fswatch` on macOS, `apt install fswatch` on Linux. Windows-native: not available; would need WSL — partial-fail vs the «portable» framing.

**Sources (WebSearch):**

- [claudefa.st — Claude Code Hooks on Windows, Linux, and macOS (2026)](https://claudefa.st/blog/tools/hooks/cross-platform-hooks)
- [anthropics/claude-code#37634 — Native installer Windows bash hooks resolve to WSL bash.exe](https://github.com/anthropics/claude-code/issues/37634)
- [anthropics/claude-code#23556 — Windows hook .sh auto-detection WSL vs Git Bash](https://github.com/anthropics/claude-code/issues/23556)

### §2.7 Own-stack precedent — existing path-scoped PostToolUse hook

Inspection of [`.claude/hooks/inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) ([wc -l](../../../.claude/hooks/inject-matching-rule.sh): 80) — the SHIPPED precedent for path-scoped PostToolUse Edit|Write hooks:

```bash
case "$TOOL" in Edit|Write|MultiEdit) ;; *) exit 0 ;; esac
[[ -z "$ABS_PATH" ]] && exit 0
# parses tool_input.file_path via jq from stdin JSON
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""' 2>/dev/null || true)"
```

The pattern is shipped and tested ([`packages/core/hooks/inject-matching-rule.test.ts`](../../../packages/core/hooks/inject-matching-rule.test.ts) — registered in [`.claude/rules/rule-enforcement-channel-selection.md §4`](../../../.claude/rules/rule-enforcement-channel-selection.md)). A B' Option (a) command hook would be a near-clone — same jq parse, same path filter, same exit-0 contract — with the rule-matching loop replaced by a `curl` call. Estimated **~20-30 LOC delta** to the existing 80-LOC precedent for a B' Option (a) script.

---

## §3 T16 problem-class match table

| Dimension | Upstream pattern (aif-handoff MCP) | Our problem class (B' hybrid) | Match? | Evidence |
|---|---|---|---|---|
| **Task-creation invocation surface** | MCP `handoff_create_task` over HTTP (`MCP_PORT=3100`) or stdio (`npx tsx packages/mcp/src/index.ts`) — designed for external-process invocation | We want to invoke it from a CC PostToolUse hook OR a standalone watcher script triggered by `*-meta-launch/kickoff.md` writes | **PASS** — designed-for-this | DeepWiki probe §2.2: «MCP server can be invoked statelessly from an arbitrary process»; CC docs §2.1: `mcp_tool` hook type purpose-built for this |
| **Hook→MCP transport** | `mcp_tool` hook type calls an already-connected CC MCP server directly (no shell); `command` hook can curl→HTTP MCP server | We want zero-shell-code for the simplest case, ≤30 LOC bash for the content-aware case | **PASS** with caveat — `mcp_tool` works for `${tool_input.file_path}` substitution; **content cannot be substituted** so full kickoff body in `description` requires Option (a) command hook | CC docs §2.1: substitution syntax limited to `tool_input` fields; CC docs do not document `tool_input.content` substitution; `inject-matching-rule.sh:25` reads file content via separate I/O |
| **Standalone-MCP server requirement** | MCP HTTP server runs alone via `npm run mcp:http` against `packages/mcp/scripts/dev-http.mjs`; minimum footprint = Node.js + SQLite | We are a consumer who wants to opt-in install aif-handoff for the bridge | **PASS for trigger; PARTIAL for autonomy** — task creation works without coordinator; **autonomous progression to Planner requires coordinator daemon** (DeepWiki probe §2.3 verbatim: «agent coordinator, when running, polls the database for tasks in the backlog state and initiates the planning stage») | DeepWiki probes §2.2 + §2.3; `packages/mcp/scripts/dev-http.mjs`; `packages/agent/src/coordinator.ts` |
| **Race condition on partial write** | Not applicable upstream — MCP is a synchronous API | PostToolUse fires after Write completes per empirical reports, but no documented atomicity guarantee; chokidar `awaitWriteFinish` is the upstream-documented mitigation for Option (b) | **PARTIAL** — mitigable per option but introduces complexity | WebSearch §2.4: «PostToolUse hooks fire after file writes complete» (empirical); chokidar README: `awaitWriteFinish.stabilityThreshold` default 2000 ms |
| **Cross-platform portability** | MCP server is Node.js — portable wherever Node runs | CC PostToolUse hooks: `mcp_tool` portable; `command` bash works on macOS/Linux, broken on Windows native | **MIXED** — Option (a') trivially portable; Option (a) bash needs workarounds on Windows; Option (b) Node trivially portable; Option (c) fswatch requires brew/apt + no Windows-native | WebSearch §2.6: cross-platform best practice + Windows bug refs |
| **Status back-channel** | WebSocket broadcast (`ws://localhost:3009/ws`) — all events, no topic filter per [SW-A §2.3](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) | We need taskId-filtered status to write back to `state.md` | **MISMATCH (inherited from A)** — B' does not solve this; same complexity as A | SW-A patch §2.3 (DeepWiki probe 3, 2026-05-29) |
| **Planner-bypass via `accept_existing_plan`** | Requires physical `PLAN.md` on disk in `.ai-factory/` per [SW-A §2.6](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) | If we want our meta-kickoff to skip aif-handoff Planner, we still need to write a file to disk — hook cannot do this purely from MCP | **MISMATCH (inherited from A)** — B' does not solve this; same coupling as A | SW-A patch §2.6 (DeepWiki probe 6, 2026-05-29) |
| **autoMode Reviewer ↔ `reviewer-discipline.md §2`** | aif-handoff Reviewer in `autoMode` silently picks strategy per SW-A criterion 5; DN-1 = B-constrained applies (Reviewer must implement ask-on-doubt) | We need DN-1 to apply equally; B' uses the same Reviewer | **INHERITED (per dispatch instruction)** — DN-1 = B-constrained is presumed adopted; without that constraint B' fails too | Dispatch prompt (this session) + SW-A §4 criterion 5 + `.claude/rules/reviewer-discipline.md §2` |

**Match verdict:** **~35%** — the trigger optimisation is feasible (4 of 8 dimensions PASS / PARTIAL-PASS for the trigger surface) but the 3 dimensions that inherit SW-A's ADOPT-blockers are MISMATCH unchanged. B' shifts «who pastes» from maintainer to filesystem event, leaving every other axis of A's evaluation identical.

---

## §4 §4-criteria scoring (5 rows × file:line evidence)

### Criterion 1 — Bridge complexity (target <100 LOC for B'; <300 LOC for A overall)

**Per-option LOC count + structure sketch:**

**Option (a') — `mcp_tool` hook config, ZERO bash code (cleanest path discovered by §2.1)**

```jsonc
// .claude/settings.json fragment (NOT shipped — sketch only)
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "mcp_tool",
            "server": "aif-handoff",
            "tool": "handoff_create_task",
            "input": {
              "projectId": "<config-time-uuid>",
              "title": "${tool_input.file_path}"
              // description: CANNOT pass file body via substitution — only file_path
              // — see §2.1 caveat: tool_input.content NOT documented as substitutable
            }
          }
        ]
      }
    ]
  }
}
```

**LOC: 0 lines of code. ~10 lines of config.** Limitation: `description` cannot be filled with kickoff body via substitution alone — only `${tool_input.file_path}` is supported. Acceptable for «track that kickoff X was written»; insufficient for «pass the full kickoff body to aif-handoff Planner».

**Option (a) — PostToolUse `command` bash hook + curl HTTP to MCP server (~20-30 LOC delta to [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh):80)**

```bash
#!/usr/bin/env bash
# PostToolUse hook — aif-handoff bridge trigger (B' Option a sketch, NOT shipped)
set -uo pipefail
command -v jq >/dev/null 2>&1 || exit 0
command -v curl >/dev/null 2>&1 || exit 0

INPUT="$(cat)"
TOOL="$(printf '%s' "$INPUT" | jq -r '.tool_name // ""')"
ABS_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // ""')"

case "$TOOL" in Write|Edit) ;; *) exit 0 ;; esac
[[ "$ABS_PATH" == *"/orchestrator-prompts/"*"-meta-launch/kickoff.md" ]] || exit 0
[[ -f "$ABS_PATH" ]] || exit 0

# aif-handoff opt-in detection — silent no-op if absent
curl -sf --connect-timeout 1 http://localhost:3100/health >/dev/null 2>&1 || exit 0

# Extract umbrella from path: orchestrator-prompts/<umbrella>-meta-launch/kickoff.md
UMBRELLA="$(basename "$(dirname "$ABS_PATH")" | sed 's/-meta-launch$//')"
BODY="$(jq -Rs . < "$ABS_PATH")"

# POST handoff_create_task via MCP HTTP transport
curl -sf -X POST http://localhost:3100/mcp \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"handoff_create_task\",\"arguments\":{\"projectId\":\"$AIF_PROJECT_ID\",\"title\":\"$UMBRELLA\",\"description\":$BODY}}}" \
  >/dev/null 2>&1 || true

exit 0
```

**LOC: ~25 lines** (counted above, excluding comments/blank). Within <100 target.

**Option (b) — chokidar Node script (~15-20 LOC; less than kickoff-estimated 50-80 due to v5 ESM/Node-built-in-glob)**

```javascript
#!/usr/bin/env node
// Standalone fs-watcher, run as daemon — NOT a CC hook (B' Option b sketch)
import { watch } from 'chokidar';
import { glob } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
const files = await Array.fromAsync(glob('.claude/orchestrator-prompts/*-meta-launch/kickoff.md'));
const w = watch(files, { awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 100 }, atomic: true });
w.on('add', async (path) => {
  const body = await readFile(path, 'utf8');
  const umbrella = path.match(/orchestrator-prompts\/(.+)-meta-launch/)[1];
  await fetch('http://localhost:3100/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'handoff_create_task', arguments: { projectId: process.env.AIF_PROJECT_ID, title: umbrella, description: body } } }) }).catch(() => {});
});
```

**LOC: ~15 lines.** Within <100 target.

**Option (c) — `fswatch` bash one-liner pipeline (~5-10 LOC, depends on fswatch)**

```bash
#!/usr/bin/env bash
# Standalone watcher — NOT a CC hook (B' Option c sketch)
# Requires: brew install fswatch (macOS) / apt install fswatch (Linux)
fswatch -0 -r .claude/orchestrator-prompts/ \
  | while IFS= read -r -d '' path; do
      [[ "$path" == *"-meta-launch/kickoff.md" ]] || continue
      sleep 0.5  # debounce partial-write
      curl -sf -X POST http://localhost:3100/mcp \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"handoff_create_task\",\"arguments\":{\"projectId\":\"$AIF_PROJECT_ID\",\"title\":\"$(basename $(dirname "$path") | sed 's/-meta-launch$//')\",\"description\":$(jq -Rs . < "$path")}}}" \
        >/dev/null 2>&1 || true
    done
```

**LOC: ~10 lines.** Within <100 target.

**Criterion 1 score:** PASS across all 4 sub-options. Best LOC: Option (a') with 0 lines of code. Best content-passing: Option (a) at ~25 LOC. Best autonomous-of-CC: Option (b) at ~15 LOC. Most external dep: Option (c) (`fswatch` brew install). **All beat Variant A's 175 LOC.**

Evidence: §2.1, §2.5, §2.7 above. Reference precedent: [`inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) lines 1-80.

### Criterion 2 — DECISION=C compatibility (substrate dependency-free) — HARD requirement

**Test:** clean checkout + `./install.sh` + `/meta-orchestrator <umbrella>` succeeds identically with and without aif-handoff installed.

**Per-option assessment:**

- **Option (a')** `mcp_tool` hook config: opt-in via settings.json edit; if aif-handoff MCP not connected, hook produces «non-blocking error and execution continues» (CC docs §2.1 verbatim). **PASS.**
- **Option (a)** command hook: opt-in via settings.json + ship hook file under `.claude/hooks/`; `curl -sf --connect-timeout 1 http://localhost:3100/health || exit 0` guard at line 13 of sketch above ensures silent no-op without aif-handoff. **PASS.**
- **Option (b)** standalone chokidar: requires Node `chokidar` dep on consumer machine. NOT in `/meta-orchestrator` substrate; opt-in install. Consumer who doesn't install it → bridge inactive → meta-orchestrator works unchanged. **PASS.**
- **Option (c)** `fswatch`: requires `brew install fswatch` on consumer machine. Same opt-in pattern. **PASS.**

**Substrate verification:** our [`packages/core/hooks/`](../../../packages/core/hooks/) ships 9 hooks today — none assumes aif-handoff. B' adds zero or one optional hook (Option a/a') with explicit opt-in detection. [`SKILL.md:441`](../../../.claude/skills/pipeline/SKILL.md#L441) anti-scope: «Does NOT add npm deps. Substrate stays bash + markdown + CC primitives + existing gh CLI» — B' Option (a') / (a) is **fully compatible**; Option (b)/(c) requires consumer-side `chokidar` / `fswatch` which is **opt-in to consumer**, not in our shipped substrate.

**Criterion 2 score:** **PASS** (HARD requirement satisfied for all 4 sub-options).

Evidence: §2.1 (mcp_tool error semantics), §2.7 (existing hook pattern), [`SKILL.md:441`](../../../.claude/skills/pipeline/SKILL.md#L441) anti-scope.

### Criterion 3 — What's actually automated vs maintainer-loop preserved

**Per-stage automation table — B' vs A vs today:**

| Stage | Today (maintainer-paste, no aif-handoff) | Variant A bridge (explicit invoke) | Variant B' (auto-event-trigger) |
|---|---|---|---|
| Meta-kickoff authoring | `/meta-orchestrator` writes kickoff.md | Same — bridge fires AFTER kickoff.md written | Same |
| Dispatch trigger | Maintainer pastes 1-liner into new CC session | Maintainer explicitly invokes `.claude/scripts/aif-bridge.sh <kickoff>` | **Auto-event** — file write fires hook OR watcher detects file |
| Task creation | NA | Curl to MCP HTTP, ~15 LOC | `mcp_tool` hook config OR small bash/Node, 0-25 LOC |
| Planner stage | NA | aif-handoff Planner re-plans from `description` | Same — `description` field carries kickoff body (Option a/b/c) or just file_path metadata (Option a') |
| Implementer stage | Maintainer-pasted 1-liner → spawned CC session | aif-handoff Implementer spawns `claude --agent` | Same — once task is created, downstream is identical |
| Reviewer stage | SP `requesting-code-review` (Phase -1, our cold-review) | aif-handoff Reviewer runs in `autoMode` — DN-1=B-constrained applies | Same as A — inherited |
| Status read-back | Maintainer monitors PR / state.md | Bridge tails WebSocket, ~50 LOC | Same as A — B' does NOT optimise this side; tail-side complexity unchanged |
| Strategy forks / DECISION-NEEDED | Maintainer surfaces via reviewer-discipline.md §2 | NOT automated | Same — not automated |

**Net assessment for B' vs A:** B' replaces the single explicit-invoke maintainer action with an auto-event. The wall-clock saving is **one decision-and-paste per umbrella** (≈30 seconds). The downstream **infrastructure footprint, blocker set, and status-read-back complexity are identical to A**. B' does not unlock anything A doesn't already unlock; it makes the cheapest part of A's flow cheaper.

**Risk specific to B':** path-scoped hook fires on **every** `*-meta-launch/kickoff.md` write, including drafts, amendments, and re-runs. Bridge must idempotently handle «task already exists for this umbrella» (aif-handoff `createTask` does not document idempotency-key support — DeepWiki probe needed for follow-up; not in current scope but flagged). Today's maintainer-paste pattern naturally handles this because maintainer chooses when to paste.

**Criterion 3 score:** **PARTIAL** — automation gain real but small; new idempotency risk introduced.

Evidence: §2.1, §2.2, §2.3; SW-A §4 criterion 3 lines 207-219.

### Criterion 4 — Fallback ergonomics without aif-handoff installed

**Test:** consumer without aif-handoff installed → `/meta-orchestrator` 1-liner output identical to today.

**Per-option assessment:**

- **Option (a')** `mcp_tool` hook: if server «aif-handoff» not connected, CC produces non-blocking error and continues. `/meta-orchestrator` output unchanged. **PASS.** Caveat: consumer's CC session may show a noisy error message in transcript — UX-noise risk not blocking but worth noting.
- **Option (a)** command hook: `curl -sf --connect-timeout 1 http://localhost:3100/health || exit 0` ensures silent no-op. **PASS** (clean fallback).
- **Option (b)** chokidar standalone: consumer doesn't install chokidar/Node deps → watcher doesn't run → bridge inactive. **PASS** trivially.
- **Option (c)** fswatch standalone: consumer doesn't install fswatch → watcher doesn't run → bridge inactive. **PASS** trivially.

**Criterion 4 score:** **PASS** across all sub-options. UX-noise risk on Option (a') noted but not blocking.

Evidence: §2.1 «non-blocking error»; sketch line 13 of Option (a) `curl ... || exit 0`.

### Criterion 5 — Duplication with /orchestrator + SP cycle (SKILL.md:404 / :429 inconsistency resolution)

**SKILL.md:404 vs :429 inconsistency:** resolved in [SW-A patch §4 criterion 5](2026-05-29-aif-handoff-bridge-variant-a-mcp.md). Verdict: both lines consistent — :404 = BFR-default REFERENCE verdict for SP skill; :429 = operational ADOPT of the SP dispatch template at Phase -1 time. Resolution evidence: [`research-patches/2026-05-23-meta-orchestrator-prior-art.md §3 leapfrog table line 73`](2026-05-23-meta-orchestrator-prior-art.md). No DECISION-NEEDED — disambiguated by SW-A.

**Duplication analysis for B' (inherited verbatim from SW-A, plus B'-specific deltas):**

| Component | Our current stack | Variant B' aif-handoff | Duplication? | Delta vs A |
|---|---|---|---|---|
| Phase -1 cold-review | SP `requesting-code-review` (ADOPT per SKILL.md:429) | aif-handoff Reviewer in autoMode (DN-1=B-constrained applies) | **CONFLICT (inherited from A)** | Same as A — no delta |
| Worker dispatch | Maintainer pastes 1-liner | aif-handoff Implementer spawns `claude --agent` | COMPLEMENTARY (inherited from A) | **DELTA**: B' auto-triggers task creation, but downstream worker dispatch is identical |
| Plan generation | Meta-kickoff authoring (our Phase 0/1) | aif-handoff Planner re-plans from task `description` | **POTENTIAL DUPLICATION (inherited from A)** | Same as A — Planner may override our kickoff plan |

**DN-1 = B-constrained applies (per dispatch instruction):** aif-handoff Reviewer must implement ask-on-doubt (the B-constraint resolves SW-A criterion 5 risk). B' inherits this requirement.

**Criterion 5 score:** **INHERITED RISK** — same conflict surface as A; DN-1=B-constrained presumed. B' does not change Reviewer-discipline conflict.

Evidence: SW-A §4 criterion 5 (lines 240-260); SKILL.md:404/429; reviewer-discipline.md §2; dispatch instruction (this session).

---

## §5 Verdict per build-first-reuse-default.md §1

**Variant B' verdict: REFERENCE**

**Rationale:**

Per BFR-default §1 verdict ladder:

- **ADOPT** — No. B' is a hybrid that requires BUILDING our own fs-watcher (any of 4 sub-options) — not pure adoption.
- **ADOPT VOCABULARY** — Plausible if Variant A is independently greenlit. The CC hooks `mcp_tool` type ([SSOT #20 ADOPT](../prior-art-evaluations.md)) + the existing `inject-matching-rule.sh` precedent provide the vocabulary; B' would be a thin instance of that vocabulary. Pending A's verdict.
- **ADAPT** — Premature standalone. Adaptation would require: (a) committing to one of 4 sub-options + writing it; (b) deciding the idempotency policy for repeated writes; (c) resolving the «`tool_input.content` not substitutable» limitation by writing a command hook OR accepting `file_path`-only metadata payloads. Cost is real but not the gating factor — the gating factor is the inherited 3 ADOPT-blockers from A.
- **REFERENCE** — **YES.** B' demonstrates that: (a) CC hooks have a purpose-built `mcp_tool` type for already-connected MCP servers (CC docs §2.1, fetched 2026-05-29); (b) aif-handoff MCP server is self-sufficient — callable without coordinator daemon (DeepWiki probes §2.2 + §2.3, 2026-05-29); (c) fs-watcher sub-options are all under <100 LOC target with chokidar at ~15 LOC and fswatch at ~10 LOC (WebSearch §2.5). These design-vocabulary items are valid REFERENCE regardless of whether we adopt today.
- **KEEP NARROW** — Not applicable; B' is a specific mechanism, not a scope claim.
- **BUILD** — Possible if maintainer greenlights one of the 4 sub-options. **Build cost is small** (≤30 LOC) but the **value** is small (auto-trigger replacing one paste) unless paired with A's adoption.
- **REJECT** — No. The mechanism is feasible; it just doesn't unlock anything alone.

**Match score: ~35%**
- fs-watcher viability across 3-4 sub-options: ✓ (FULL)
- aif-handoff MCP standalone-callability: ✓ (FULL — for task creation)
- Cross-platform: ✓ (Option a' / b portable; Option a / c require platform-specific workarounds)
- Bridge LOC target <100: ✓ (FULL — 0/25/15/10 LOC across options a'/a/b/c)
- Inherits A's PLAN.md disk coupling: ✗ (MISMATCH)
- Inherits A's WebSocket broadcast no-topic-filter: ✗ (MISMATCH)
- Inherits A's autoMode-Reviewer conflict (DN-1 mitigation): ✗ unmitigated alone (MISMATCH) / ✓ if DN-1=B-constrained holds
- Atomicity guarantee on CC Write: ⚠ INCONCLUSIVE (mitigable via chokidar `awaitWriteFinish` for Option b; empirical-only for Options a/a')

**Verdict sentence (T20 compliant):** Variant B' is REFERENCE — CC PostToolUse hooks expose a purpose-built `mcp_tool` type (CC docs `code.claude.com/docs/en/hooks.md` fetched 2026-05-29) compatible with an already-connected aif-handoff MCP server, the MCP server can run standalone without the coordinator daemon for task creation (DeepWiki probe «MCP server can be invoked statelessly from an arbitrary process», 2026-05-29 + DeepWiki probe «MCP HTTP daemon runs independently», 2026-05-29), and 4 sub-options (a'/a/b/c) each fit the <100 LOC bridge-complexity target (range 0-25 LOC), but B' inherits all 3 of SW-A's ADOPT-blockers verbatim (PLAN.md disk coupling, WebSocket broadcast no-topic-filter, autoMode Reviewer ↔ reviewer-discipline.md §2 conflict) and standalone B' optimises only the dispatch trigger (replacing one maintainer-paste with one auto-event) — making ADAPT premature without paired A-verdict and REFERENCE the right ladder rung; B' upgrades to ADOPT VOCABULARY if and only if Variant A is greenlit by Sub-wave D and DN-1=B-constrained adopted.

**Stop condition (kickoff §6 SW-B2 STOP):**
- ❌ T-AIF-BRIDGE-B'-1 (CC hooks CANNOT invoke MCP/HTTP AND no portable alternative within DECISION=C) → **NOT TRIGGERED**: `mcp_tool` hook type exists; curl→HTTP also available.
- ❌ T-AIF-BRIDGE-B'-3 (aif-handoff MCP requires coordinator-daemon-local context) → **NOT TRIGGERED**: MCP is self-sufficient (§2.2 + §2.3).
- ❌ §4 criterion 2 DECISION=C unexpected FAIL → **NOT TRIGGERED**: PASS across all 4 sub-options.

No STOP condition triggered → verdict stands at REFERENCE per BFR-default ladder, not stop-condition-triggered halt.

**Falsifier (per T20):** if (a) Sub-wave D synthesis greenlights Variant A and (b) DN-1=B-constrained is adopted as the resolution to the autoMode-Reviewer conflict, **then** Variant B' upgrades to ADOPT VOCABULARY — choose between Option (a'), (a), (b), (c) per the Implementation-phase trade-off matrix (Option a' for zero-shell-portability + file_path-only payload; Option a for content-passing + bash dep; Option b for content-passing + Node dep; Option c for content-passing + fswatch dep + macOS/Linux only). Current evidence (this patch): A is REFERENCE not ADAPT; DN-1=B-constrained is presumed-applied (not landed); B' verdict therefore stays at REFERENCE.

---

## §6 Comparison table — B' vs A vs B (Sub-wave D input)

| Criterion | Variant A (MCP-consumer, explicit invoke) | Variant B (native fs-watcher in aif-handoff) | Variant B' (hybrid: our fs-watcher + their MCP) |
|---|---|---|---|
| **Bridge LOC** | ~175 LOC bash + WebSocket consumer | N/A — requires ~400-800 LOC upstream PR | **0-25 LOC** (Option a'-a) / 15 LOC (b) / 10 LOC (c) |
| **Upstream PR required** | No | **Yes (~400-800 LOC)** | No |
| **DECISION=C HARD** | PASS (opt-in script) | **FAIL (Docker daemon required)** | PASS (all 4 sub-options) |
| **Infrastructure on consumer** | Node + SQLite (Docker-free) | Docker + DB + coordinator daemon | Node + SQLite + (optional fs-watcher dep) |
| **Dispatch trigger** | Maintainer explicit invoke | Native auto-watcher (doesn't exist) | **Auto-event** (CC hook OR standalone watcher) |
| **PLAN.md disk coupling** | INHERITED (SW-A blocker 1) | Hypothetical (doesn't exist) | **INHERITED from A** |
| **WebSocket topic filter** | INHERITED (SW-A blocker 2) | Hypothetical | **INHERITED from A** |
| **autoMode Reviewer ↔ reviewer-discipline.md §2** | INHERITED (SW-A blocker 3); DN-1=B-constrained applies | Hypothetical | **INHERITED from A**; DN-1=B-constrained applies |
| **Atomicity / race condition** | N/A (sync API) | Hypothetical | **MITIGABLE** (chokidar `awaitWriteFinish`; empirical for hooks) |
| **Cross-platform** | bash + curl (Windows OK) | N/A | Option a' portable; a/c not Windows-native; b portable |
| **BFR-default verdict** | REFERENCE | **REJECT** | **REFERENCE** (upgrades to ADOPT VOCABULARY if A is greenlit + DN-1) |
| **Match score** | 28% | 5% | **~35%** |

**Synthesis observation for Sub-wave D:** B' is best understood as a **UX-optimisation of A**, not a fully independent variant. The blocker set is identical; the cost reduction is concentrated at the cheapest part of A's flow (one paste → one event). If A is REFERENCE/REJECT, B' is REFERENCE/REJECT. If A is greenlit, B' is the cleanest dispatch-trigger implementation.

---

## §7 §1.7 Forward-check applied

- **`build-first-reuse-default.md §1` (verdict ladder):** Variant B' verdict = REFERENCE per §1 ladder — fs-watcher mechanism is feasible and reuses existing CC hook precedents ([SSOT #20 ADOPT for CC hooks API](../prior-art-evaluations.md); [`inject-matching-rule.sh:80`](../../../.claude/hooks/inject-matching-rule.sh) precedent for path-scoped Edit|Write); aif-handoff MCP server reuses verified §2.2-§2.3 capability. BFR §3 6-layer search applied: (a) SSOT consult (rows #27/#28/#29/#30/#43/#44/#46/#67/#80 reviewed via grep on `prior-art-evaluations.md`); (b) DeepWiki ≥2 distinct probes (§2.2 + §2.3 — different phrasings, triangulated MCP-standalone claim); (c) WebSearch ≥3 phrasings (§2.4 atomicity; §2.5 fs-watcher LOC; §2.6 cross-platform); (d) WebFetch on CC docs (§2.1 — primary-source for the `mcp_tool` hook type claim, not training-data recall); (e) own-stack sweep (`SKILL.md:441`, `SKILL.md:404`, `SKILL.md:429`, `inject-matching-rule.sh:1-80`); (f) negative-existence claim («CC `command` hooks cannot invoke MCP directly») backed by direct WebFetch on canonical docs. ✓

- **`no-paid-llm-in-ci.md §1`:** All evidence gathered via DeepWiki MCP (subscription-bundled), WebSearch (harness-included), WebFetch (harness-included), `gh` CLI (free), `Bash`-based grep on local files. Zero API-billed calls. ✓

- **`reviewer-discipline.md §2`:** This patch does NOT pick project strategy. Where Variant A or B' verdict would require a strategy choice (e.g., «greenlight A and B' together»), the patch surfaces the choice as a Sub-wave D input — see §6 synthesis observation. ✓

- **`phase-research-coverage.md §1.7`:** §7+§8 self-reflexive walk in this file. ✓

- **`ai-laziness-traps.md §3` (per-kickoff T-enumeration discipline applied to this patch):** All standard T-traps applied:
  - T1 — 9 distinct evidence channels (1 WebFetch + 2 DeepWiki + 3 WebSearch + 1 own-hooks inspection + 1 SW-A patch re-read + 1 SSOT grep ≥ 5 floor). ✓
  - T3 — every finding has file:line, command output, or fetched URL. No prose-only claims. ✓
  - T7 — adversarial counter-probes: «can the dispatch optimisation alone unlock A's blockers?» (answer: no, §6 synthesis); «does the `mcp_tool` hook type's `${tool_input.file_path}` substitution extend to `${tool_input.content}`?» (answer: not documented, §2.1 caveat). ✓
  - T11 — own-stack precedent search (§2.7 `inject-matching-rule.sh`) BEFORE proposing new code. ✓
  - T12 — WebFetch and DeepWiki probes at R-phase time, NOT training-data recall on CC hooks. ✓
  - T13 — re-verify already-ADOPTED items: CC hooks API ADOPT (SSOT #20) re-verified by direct WebFetch (§2.1); SP `requesting-code-review` REFERENCE (SKILL.md:404 + leapfrog table line 73) — not silently overridden by B' (B' inherits A's relationship to it). ✓
  - T15 — §10 self-application section below. ✓
  - T16 — §3 table walks 8 axes (kickoff/our-problem/match/evidence) per T16 requirement. ✓
  - T17 — no code edits, no skill edits, no destructive ops. Markdown-only output. ✓
  - T19 — cold-QA before handoff: this patch's verdict cites SSOT rows + 2026-05-29-dated probes + falsifier in same paragraph (§5); independent reviewer will be the orchestrator + maintainer per kickoff §9.3. ✓
  - T20 — verdict sentence in §5 cites SSOT (#20, A patch, B patch) + 2026-05-29 evidence + falsifier in same sentence. ✓
  - T-AIF-BRIDGE-B'-1 — CC hooks invoke-MCP capability probed and resolved (§2.1, `mcp_tool` hook type exists). ✓
  - T-AIF-BRIDGE-B'-2 — race condition probed (§2.4) and mitigation patterns documented per sub-option. ✓
  - T-AIF-BRIDGE-B'-3 — aif-handoff MCP-standalone probed and confirmed (§2.2 + §2.3, dual phrasings). ✓
  - T-AIF-BRIDGE-B'-4 — SW-A's 3 ADOPT-blockers walked per-blocker (§3 last 3 rows + §6 comparison table). ✓
  - T-AIF-BRIDGE-B'-5 — concrete sample scripts written for each of 4 sub-options with actual LOC count (§4 criterion 1). ✓

- **`doc-authority-hierarchy.md §3`:** Header carries Status + Class (N/A — research-patch) + Authoritative-for + NOT authoritative-for. ✓

- **`dual-implementation-discipline.md §2`:** Patch is markdown-only artefact under «§2 (i) markdown-only carve-out» — rule does not apply at R-phase layer. ✓ (Would apply at I-phase if B' upgraded to BUILD verdict.)

- **DECISION=C invariant:** §4 criterion 2 verified HARD-requirement satisfied across all 4 sub-options. ✓

- **CLAUDE.md `PR strategy`:** This patch is strictly within Sub-wave B2 scope. No drive-by edits to SKILL.md, SSOT, install.sh, or any non-research-patches file. Output = one markdown file in one commit. ✓

- **Admission gate §2.4 (kickoff line 42):** Carried over from SW-A patch line 343: `gh api repos/lee-to/aif-handoff/commits?since=2026-04-29` returned PR #127 (`feat(runtime)`) + PR #128 (`feat(runtime)`) — both touch `packages/runtime/` only, NOT `packages/mcp/` or `apps/coordinator/`. Gate §2.4 CLEAR — no MCP or coordinator surface changes since SSOT #67 evaluation. (Re-verification within Sub-wave B2 scope: hash-equivalent to SW-A; no need to re-run.) ✓

Evidence (verifiable file:line / command output / fetched URL):
- [`code.claude.com/docs/en/hooks.md`](https://code.claude.com/docs/en/hooks.md) — fetched 2026-05-29 — §2.1 verbatim quotes
- [DeepWiki probe «MCP server statelessly invoked»](https://deepwiki.com/search/can-the-aifhandoff-mcp-server_fe20b286-5f4e-4dc7-bc19-93a95699096a) — 2026-05-29
- [DeepWiki probe «MCP HTTP daemon standalone»](https://deepwiki.com/search/is-the-aifhandoff-mcp-server-i_b74a3b36-627e-43f2-89e0-5881fa9ee595) — 2026-05-29
- [`.claude/hooks/inject-matching-rule.sh:1-80`](../../../.claude/hooks/inject-matching-rule.sh) — own-stack PostToolUse Edit|Write precedent
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) row #20 (CC hooks ADOPT), rows #27/#28/#30/#43/#44/#46/#67/#80 (aif-handoff entries)
- [SW-A patch §2.6](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — PLAN.md disk coupling evidence
- [SW-A patch §2.3](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — WebSocket broadcast no-topic-filter evidence
- [SW-A patch §4 criterion 5](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — autoMode Reviewer conflict evidence

---

## §8 §1.7 Backward-check applied

- **SSOT #20 (CC hooks API, ADOPT):** Re-verified by direct WebFetch (§2.1) — not silently superseded. The `mcp_tool` hook type quoted here is the canonical mechanism for the «hook calls MCP» pattern; this patch records it as a usage exemplar, not as a new capability.
- **SSOT #27/#28/#29/#30/#43/#44/#46/#67/#80:** None silently superseded. §6 + §9 below propose **additive notes only** (SSOT #44 to record «B' hybrid evaluated separately; same DEFER unless A is greenlit») — no verdict changes.
- **SW-A patch (`2026-05-29-aif-handoff-bridge-variant-a-mcp.md`):** This patch **cites SW-A's findings verbatim** (the 3 ADOPT-blockers in §3 last 3 rows + §6 last 3 rows) and **does not re-evaluate them**. B' verdict explicitly depends on SW-A verdict per §5 falsifier.
- **SW-B patch (`2026-05-29-aif-handoff-bridge-variant-b-watcher.md`):** This patch evaluates a **different** mechanism (our-side fs-watcher + their existing MCP) than SW-B (their-side native fs-watcher). SW-B's REJECT for native upstream feature stands; B' is a separate evaluation per kickoff §6 SW-B2 origin (added 2026-05-29).
- **No `.claude/rules/*` modified.** No principle test modified. No agent prompt modified. No skill modified. No `install.sh` modified. No SKILL.md modified. No `settings.json` modified. Sketch JSON/bash/Node fragments in §4 are **illustrative only** — NOT shipped.
- **Scope:** this patch covers Variant B' only. Variants A/B/C/D have separate Sub-waves. No scope creep into A/B/C/D or into any implementation decision.
- **T15 self-application:** This R-phase applied BFR-default §3 6-layer search to itself — SSOT consult (rows #20 + #27/#28/#30/#43/#44/#46/#67/#80), DeepWiki ≥2 dual-phrasing triangulation, WebSearch ≥3 phrasings, WebFetch primary-source on CC docs, own-stack precedent inspection (§2.7), inter-Sub-wave evidence carry-over (SW-A + SW-B). The patch is the output of the methodology it evaluates. Recursive self-application confirmed.

Evidence (file:line / SSOT row IDs verified):
- [`docs/meta-factory/prior-art-evaluations.md` row #20](../prior-art-evaluations.md) — CC hooks API ADOPT
- [`docs/meta-factory/prior-art-evaluations.md` rows #27/#28/#30/#43/#44/#46/#67/#80](../prior-art-evaluations.md) — aif-handoff entries
- [`.claude/skills/meta-orchestrator/SKILL.md:441`](../../../.claude/skills/pipeline/SKILL.md#L441) — substrate-purity anti-scope
- [`.claude/skills/meta-orchestrator/SKILL.md:404`](../../../.claude/skills/pipeline/SKILL.md#L404) + [`:429`](../../../.claude/skills/pipeline/SKILL.md#L429) — SP `requesting-code-review` inconsistency (resolved in SW-A)

---

## §9 SSOT row / additive-note proposals

**Additive-note only — no verdict changes. Per kickoff §10 backward-check: existing DEFER/REJECT verdicts remain unchanged.**

### SSOT #44 — additive note (extends SW-A's additive note)

```text
Additive note 2026-05-29 (Sub-wave B2): Variant B' (hybrid fs-watcher + existing MCP)
evaluated separately. CC PostToolUse hooks expose mcp_tool type for already-connected
MCP servers (code.claude.com/docs/en/hooks.md, 2026-05-29); aif-handoff MCP server runs
standalone via npm run mcp:http without coordinator daemon for task creation (DeepWiki
2026-05-29). Four sub-options fit <100 LOC bridge target (Option a' = 0 LOC config;
Option a = ~25 LOC bash; Option b = ~15 LOC chokidar Node; Option c = ~10 LOC fswatch
bash). BUT: B' inherits all 3 of Variant A's ADOPT-blockers (PLAN.md disk coupling,
WebSocket broadcast no-topic-filter, autoMode Reviewer ↔ reviewer-discipline.md §2
conflict) and optimises only the dispatch trigger — replacing one maintainer-paste with
one auto-event. Standalone B' verdict = REFERENCE; upgrades to ADOPT VOCABULARY only
if Sub-wave D greenlights Variant A and DN-1=B-constrained is adopted. Trigger-to-revisit
clarification: B' becomes actionable when (a) Variant A is greenlit by Sub-wave D AND
(b) DN-1=B-constrained is adopted as the autoMode-Reviewer mitigation. Until then,
B' is a documented design-vocabulary item for future use.
```

### Proposed new SSOT row (Sub-wave D to assign actual slot; next available = #85 per `grep -E "^\| [0-9]+ \|" prior-art-evaluations.md | tail -1`)

| Proposed slot | Candidate | Verdict | Evidence |
|---|---|---|---|
| #85 (next-after-#84) | aif-handoff Variant B' bridge — hybrid fs-watcher (CC PostToolUse `mcp_tool` hook config OR `command` bash hook OR standalone chokidar Node OR fswatch bash) + existing `handoff_create_task` MCP call; trigger-side LOC 0-25; aif-handoff MCP runs standalone (Node + SQLite); inherits A's 3 ADOPT-blockers (PLAN.md disk coupling, WebSocket no-topic-filter, autoMode Reviewer conflict); cross-platform per Option a'/b, partial on Option a/c | REFERENCE — design vocabulary for dispatch-trigger optimisation of Variant A; upgrades to ADOPT VOCABULARY if A is greenlit + DN-1=B-constrained adopted | Sub-wave B2 patch 2026-05-29 (this file); CC docs `code.claude.com/docs/en/hooks.md` fetch 2026-05-29; DeepWiki probes 2026-05-29 (§2.2 + §2.3); WebSearch §2.4 + §2.5 + §2.6; own-stack precedent [`inject-matching-rule.sh:80`](../../../.claude/hooks/inject-matching-rule.sh); admission gate §2.4 verified (carried over from SW-A patch line 343) |

---

## §10 Self-application (T15)

**Did this R-phase apply BFR-default §3 6-layer search to itself?**

Walk:
1. SSOT consult (rows #20 + #27/#28/#30/#43/#44/#46/#67/#80 + #84 next-slot) — ✓ done before probing.
2. phase-research-coverage §1 6-item checklist on each negative-existence claim («CC `command` hooks cannot invoke MCP directly» — backed by direct WebFetch §2.1; «aif-handoff MCP does NOT require coordinator daemon for task creation» — backed by 2 DeepWiki phrasings §2.2 + §2.3; «no documented CC Write atomicity guarantee» — backed by WebSearch §2.4). 6/6 ✓.
3. DeepWiki ≥2 probes at R-phase time ✓ (different phrasings: «statelessly from arbitrary process» vs «HTTP daemon independently» — triangulated MCP-standalone claim from two angles).
4. WebSearch ≥3 phrasings ✓ (atomicity / fs-watcher LOC / cross-platform — three distinct concerns).
5. WebFetch on canonical primary source ✓ (CC docs — not training-data recall).
6. own-stack sweep ✓ (`SKILL.md:441/404/429`, `inject-matching-rule.sh:1-80`, `check-doc-authority.sh:1-25`, settings.json hook structure).
7. T15 self-application: **this section** — ✓.

**What would auditing this R-phase look like?** A cold reviewer would:
- (a) re-fetch `code.claude.com/docs/en/hooks.md` and verify the `mcp_tool` hook type quote is verbatim (T3 falsification);
- (b) independently DeepWiki-probe «can aif-handoff MCP create tasks without coordinator running» and check the answer matches §2.2 (T7);
- (c) cat the 4 LOC sketches in §4 criterion 1 and verify their line counts are ≥-as-claimed (T20 evidence-not-vibes);
- (d) check SW-A patch §2.6 + §2.3 + §4 criterion 5 are accurately summarised in §3 + §6 (no SSOT-by-reference fraud);
- (e) verify SSOT row #85 is the next-available slot (`grep` confirms #84 is highest, §10 verified before write).

All five are mechanical and deterministic.

**Verdict on own quality:** **INCONCLUSIVE** on two points:
- (i) `tool_input.content` substitution in `mcp_tool` hook config — the CC docs say `${tool_input.file_path}` is the example; whether `${tool_input.content}` also substitutes for Write/Edit tools is **not explicitly documented**. §4 Option (a') assumes it does NOT (conservative) but a follow-up CC docs deep-read or empirical test could falsify this. Flagged for Sub-wave D / I-phase if B' is adopted.
- (ii) atomicity for CC `Write` — empirical reports suggest PostToolUse fires after write completes, but **no documented contract**. §2.4 flags this as INCONCLUSIVE/MITIGABLE; Options (a)/(a') rely on empirical timing; Option (b) has chokidar's `awaitWriteFinish` as documented mitigation.

Self-note: both inconclusive points are flagged in §4 + §2.4, not hidden. They do not change the verdict (REFERENCE) but would need resolution in an I-phase if B' is adopted.

---

## §11 See also

- [`.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md`](../../../.claude/orchestrator-prompts/aif-handoff-as-runtime-bridge/kickoff.md) — parent umbrella kickoff; §3 Variant B' definition (line 99-122); §6 Sub-wave B2 scope (line 222+); §8 STOP conditions; §11 output spec
- [SW-A patch — Variant A MCP-consumer evaluation](2026-05-29-aif-handoff-bridge-variant-a-mcp.md) — source of the 3 ADOPT-blockers B' inherits; SSOT additive notes B' extends
- [SW-B patch — Variant B native-fs-watcher REJECT](2026-05-29-aif-handoff-bridge-variant-b-watcher.md) — distinct mechanism from B'; SW-B's REJECT does NOT apply to B' because B' uses existing aif-handoff MCP rather than requiring upstream feature
- [SW R-phase prior-art patch](2026-05-23-meta-orchestrator-prior-art.md) — meta-orchestrator BUILD verdict + SSOT #66-#70 origin; SP `requesting-code-review` REFERENCE leapfrog row at line 73
- [`docs/meta-factory/research-patches/2026-05-26-companion-reuse-aif-handoff-autoqueue.md`](2026-05-26-companion-reuse-aif-handoff-autoqueue.md) — predecessor sub-component evaluation (autoQueueMode)
- [`docs/meta-factory/prior-art-evaluations.md`](../prior-art-evaluations.md) — SSOT rows referenced: #20 (CC hooks ADOPT), #27/#28/#29/#30/#43/#44/#46/#67/#80 (aif-handoff entries)
- [`.claude/skills/meta-orchestrator/SKILL.md`](../../../.claude/skills/pipeline/SKILL.md) — surface umbrella reasons against; lines :338 (substrate purity) :404 / :429 (SP `requesting-code-review` reconciliation, resolved by SW-A)
- [`.claude/hooks/inject-matching-rule.sh`](../../../.claude/hooks/inject-matching-rule.sh) — own-stack PostToolUse Edit|Write precedent ([packages/core/hooks/inject-matching-rule.test.ts](../../../packages/core/hooks/inject-matching-rule.test.ts) shipped tests)
- [`.claude/rules/build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — verdict ladder applied in §5
- [`.claude/rules/reviewer-discipline.md §2`](../../../.claude/rules/reviewer-discipline.md) — strategy-fork-surface gate that aif-handoff Reviewer conflicts with (inherited from A)
- [`.claude/rules/dual-implementation-discipline.md §2`](../../../.claude/rules/dual-implementation-discipline.md) — markdown-only carve-out (R-phase patch not subject to dual-channel discipline)
- [`.claude/rules/ai-laziness-traps.md`](../../../.claude/rules/ai-laziness-traps.md) — T-traps enforced; T20 inline-verdict + evidence + falsifier in §5 verdict sentence
- WebFetch source: [`code.claude.com/docs/en/hooks.md`](https://code.claude.com/docs/en/hooks.md) — primary source for `mcp_tool` hook type quotes (fetched 2026-05-29)
- DeepWiki probe URLs:
  - [Probe §2.2 — MCP statelessly invoked from arbitrary process](https://deepwiki.com/search/can-the-aifhandoff-mcp-server_fe20b286-5f4e-4dc7-bc19-93a95699096a)
  - [Probe §2.3 — MCP HTTP daemon runs independently](https://deepwiki.com/search/is-the-aifhandoff-mcp-server-i_b74a3b36-627e-43f2-89e0-5881fa9ee595)
- WebSearch source-list summary:
  - [chokidar (paulmillr)](https://github.com/paulmillr/chokidar) — v5 ESM-only + `awaitWriteFinish`
  - [fswatch (emcrisostomo)](https://github.com/emcrisostomo/fswatch) — cross-platform fs monitor
  - [claudefa.st — Cross-platform Claude Code hooks](https://claudefa.st/blog/tools/hooks/cross-platform-hooks)
  - [anthropics/claude-code#37634](https://github.com/anthropics/claude-code/issues/37634) — Windows native bash hooks WSL bug
