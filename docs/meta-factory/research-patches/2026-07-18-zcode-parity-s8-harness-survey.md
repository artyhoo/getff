# zcode-parity Stage 8 — non-CC/ZCode harness agnosticism survey

> **Authoritative for:** Stage 8 of `zcode-full-parity-mega-umbrella` — per-harness verdicts (SUPPORTED / FEASIBLE / OUT-OF-SCOPE) on hook-system support for Cursor, Codex CLI, Aider, and Windsurf; the CC/ZCode-vs-harness delta table; the parked agnosticism-claim fork.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Framework event SSOT — see [`scripts/render-harness-config.mjs`](../../../scripts/render-harness-config.mjs). Public agnosticism claim of the framework — operator decision; this doc only provides per-harness evidence (per kickoff §4 park-don't-guess contract).

> **Origin:** 2026-07-18, Stage 8 of `zcode-full-parity-mega-umbrella` (R-phase, research-only). Kickoff: [`.claude/orchestrator-prompts/zcode-parity-s8-harness-survey-11774f/kickoff.md`](../../../.claude/orchestrator-prompts/zcode-parity-s8-harness-survey-11774f/kickoff.md).

---

## §1 Problem

The framework currently models only two harnesses: **Claude Code (CC)** and **ZCode** (the framework's own re-named event surface, declared in [`scripts/render-harness-config.mjs:46-54`](../../../scripts/render-harness-config.mjs)). README and several rules name Cursor / Codex / Aider as *deployment surfaces* (per kickoff §1), but no formal hook-event comparison exists. This survey answers, per harness:

1. Does the harness have a hook system at all?
2. If yes, what events and what transcript format?
3. Cross-reference against framework's `ZCODE_EVENTS` / CC-side events — what's the delta?
4. Verdict: **SUPPORTED** (works today) / **FEASIBLE** (could work with adapter) / **OUT-OF-SCOPE** (no hook system / fundamentally incompatible).

Per-harness verdicts are **technically objective** — decided autonomously with evidence. The strategic question of *what the framework should publicly claim* is parked via `park.ts` (§6) per kickoff §4.

---

## §2 Inputs (verified 2026-07-18, not from memory)

**Framework event SSOT:**

- [`scripts/render-harness-config.mjs:46-54`](../../../scripts/render-harness-config.mjs) — `ZCODE_EVENTS = { SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop }` (7 events; **no** `SubagentStart`/`SubagentStop`).
- [`.ai-factory/harness-model.json`](../../../.ai-factory/harness-model.json) — framework's CC-side hook surface uses 7 events: `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `SessionStart`, `Stop`, `SubagentStart`, `SubagentStop`.

**Framework's plugin channel today** (`ls plugin/hooks/`, 2026-07-18): `ask-question-reminder`, `check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`, `check-worker-dispatch-channel`, `deps-hash-check`, `end-of-turn-reminder`, `inject-matching-rule`, `inject-memory-codification`, `inject-session-bootstrap`, `inject-subagent-context`, `runtime-bridge-dispatch`, `session-start`, `validate-prompt`, plus `_zcode-emit` helper, `lang/`, `run-hook.cmd`, `hooks.json`.

**Existing framework agnosticism mentions** (grep-verified):

- [`README.md:45`](../../../README.md) — names "Claude, Cursor, Copilot, Aider" as agents that violate undocumented conventions.
- [`README.md:81,85`](../../../README.md) — names Cursor / Codex as framework *deployment surfaces*, not companions.
- [`.claude/rules/dual-implementation-discipline.md:32`](../../../.claude/rules/dual-implementation-discipline.md) — explicitly anticipates "non-Claude-Code harnesses (Cursor, Aider, Codex)".
- [`.claude/rules/memory-codification.md:60`](../../../.claude/rules/memory-codification.md) + [`.claude/rules/no-paid-llm-in-ci.md:20`](../../../.claude/rules/no-paid-llm-in-ci.md) — name "Cursor / Aider / Codex" as consumer harnesses for AI-agnostic sub-agents.
- No formal agnosticism claim for Cursor/Codex/Aider/Windsurf hook systems in [`doc-authority-hierarchy.md`](../../../.claude/rules/doc-authority-hierarchy.md) or `render-harness-config.mjs`.

---

## §3 Per-harness findings

### §3.1 Cursor — SUPPORTED

**Hook system: yes.** Cursor ships a comprehensive hook system mirroring CC's API nearly 1:1.

**Source (retrieved 2026-07-18):** <https://cursor.com/docs/hooks> (official).

**Event list (direct from docs):**

| Cursor event | CC/ZCode equivalent |
|---|---|
| `preToolUse` | `PreToolUse` |
| `postToolUse` | `PostToolUse` |
| `postToolUseFailure` | `PostToolUseFailure` (ZCode-only on the framework side) |
| `subagentStart` | `SubagentStart` (CC-only on the framework side; absent from `ZCODE_EVENTS`) |
| `subagentStop` | `SubagentStop` (CC-only on the framework side) |
| `sessionStart` | `SessionStart` |
| `sessionEnd` | (no direct equivalent in framework model — symmetric to SessionStart) |
| `stop` | `Stop` |
| `notification` | (no framework equivalent — Cursor-specific UX surface) |
| `userPromptSubmit` | `UserPromptSubmit` |
| `preCompact` | (no framework equivalent) |

**Compatibility surface:** Cursor docs explicitly state that `CLAUDE_PROJECT_DIR` is provided as an alias for the project root, and that hook scripts receive the same JSON-stdin contract as CC hooks (so existing CC hook scripts are largely portable). Cursor documents a matcher-based registration (`hooks.json` keyed by event type with tool-name matchers).

**Transcript/log format:** Cursor writes session transcripts under `~/.cursor/` (project-scoped state lives under `<project>/.cursor/`). Verified via docs.

**Verdict draft:** **SUPPORTED** — near-complete overlap with CC events; framework's existing CC hooks would require only minimal adapter work (mostly path-and-env-var translation). Cursor explicitly models CC compatibility as a design goal.

### §3.2 Codex CLI — FEASIBLE

**Hook system: yes (lifecycle hooks, different taxonomy).**

**Source (retrieved 2026-07-18):** <https://github.com/openai/codex/blob/main/docs/config.md> (official open-source repo), supplemented by <https://ai.sulat.com/codex-cli-has-hooks-now-stop-stuffing-agents-md-c181465fe271> (community explainer) and StackOverflow 79933632.

**Evidence (direct from `docs/config.md`):**

- Section "Lifecycle hooks" documents hook firing at agent-turn boundaries.
- `requirements.toml` (Codex config) carries an `allow_managed_hooks_only` flag — i.e. a real hook-gating mechanism, not just config files.
- The `~/.codex/` config directory and `AGENTS.md` convention are documented as first-class.

**Event taxonomy (Codex):** Codex does NOT use the CC event names. Documented event surfaces include:

- agent-turn-complete (post-turn hook)
- agent-turn-start (pre-turn hook)
- managed-hooks gate (`allow_managed_hooks_only`)

This is a **lifecycle-level** taxonomy (turn-start / turn-complete) rather than the **per-tool** taxonomy CC/ZCode use (PreToolUse / PostToolUse / PostToolUseFailure). No first-class `PreToolUse`/`PostToolUse` equivalent was found in the docs as of retrieval date.

**Transcript/log format:** Codex CLI writes session trajectories under `~/.codex/sessions/` (JSONL rollup). Verified via docs.

**Verdict draft:** **FEASIBLE** — has a hook system and a managed-hooks gating mechanism, but the event taxonomy differs from CC's per-tool model. A framework adapter mapping CC's `UserPromptSubmit` → Codex's agent-turn-start, `Stop` → agent-turn-complete, etc., is plausible; per-tool hooks (`PreToolUse`/`PostToolUse`) would require Codex-side extension and may not be reachable today.

### §3.3 Aider — OUT-OF-SCOPE

**Hook system: no** first-class hook event system.

**Sources (retrieved 2026-07-18):**

- <https://aider.chat/docs/config.html> (official) — documents `.aider.conf.yml` config, slash commands (`/run`, `/messages`, `/add`, `/drop`), `--message` and `--load` scripting flags. No hook event system.
- <https://github.com/Aider-AI/aider/issues/2045> — feature REQUEST: "Pre- and Post- prompt hooks". Open; not implemented.
- <https://github.com/Aider-AI/aider/issues/2557> — feature REQUEST: "Command hooks for better editor integration". Open; not implemented.

**Evidence:** Both upstream issues are *requests*, not implementations. Aider's automation surface today is limited to:

- `.aider.conf.yml` for static config.
- Slash commands within an interactive Aider session (`/run`, `/add`, `/drop`, `/messages`).
- `--message <text>` for one-shot CLI invocation.
- `--load <history>` for scripted playback.

None of these give framework-style hooks at edit/session/tool-call boundaries. There is no `UserPromptSubmit` interceptor, no `PreToolUse` gate, no `PostToolUse` observation channel.

**Transcript/log format:** `.aider.chat.history.md` (per-project chat log; markdown). `~/.aider.input.history` (input-only readline log). Neither is structured for hook consumption.

**Verdict draft:** **OUT-OF-SCOPE** — no hook system; the framework's deterministic-gate discipline (per [`rule-enforcement-channel-selection.md`](../../../.claude/rules/rule-enforcement-channel-selection.md)) is unreachable inside Aider. Aider consumers can still read the framework's portable artifacts (rules markdown, agent prompts, principles prose), but they cannot enforce them at edit/pre-push/CI-equivalent channels from within Aider.

### §3.4 Windsurf — FEASIBLE

**Hook system: yes (Cascade Hooks, different taxonomy).**

**Source (retrieved 2026-07-18):** <https://docs.windsurf.com/windsurf/cascade/hooks> (official).

**Event list (direct from docs):** 12 events, grouped:

| Windsurf event | CC/ZCode equivalent |
|---|---|
| `pre_read_code` | (subset of `PreToolUse` for read tools) |
| `post_read_code` | (subset of `PostToolUse` for read tools) |
| `pre_write_code` | (subset of `PreToolUse` for edit tools) |
| `post_write_code` | (subset of `PostToolUse` for edit tools) |
| `pre_run_command` | (subset of `PreToolUse` for bash tools) |
| `post_run_command` | (subset of `PostToolUse` for bash tools) |
| `pre_mcp_tool_use` | `PreToolUse` (MCP tools) |
| `post_mcp_tool_use` | `PostToolUse` (MCP tools) |
| `pre_user_prompt` | `UserPromptSubmit` |
| `post_cascade_response` | (no direct equivalent — post-LLM-response) |
| `post_cascade_response_with_transcript` | (no direct equivalent) |
| `post_setup_worktree` | (no equivalent — Windsurf-specific) |

**Blocking semantics (direct from docs):** pre-hooks may exit with code 2 to block the action — i.e. real gating, not advisory.

**Transcript/log format:** `~/.windsurf/transcripts/{trajectory_id}.jsonl` — structured JSONL trajectory per Cascade session. Verified via docs.

**Verdict draft:** **FEASIBLE** — has a hook system with real gating (exit-2 block) and structured transcripts. The event taxonomy is **tool-shape-aware** (`pre_read_code` vs `pre_write_code` vs `pre_run_command` vs `pre_mcp_tool_use`) — finer-grained than CC's single `PreToolUse`. An adapter that aggregates Windsurf's per-tool-shape pre-hooks into CC's single `PreToolUse` is straightforward; the inverse (CC → Windsurf) loses tool-shape granularity. `SessionStart`/`SessionEnd`/`Stop`/`SubagentStart`/`SubagentStop` have **no Windsurf equivalent** found in the docs.

---

## §4 Delta table — framework events vs each harness

Rows = every event in the framework's CC-side `harness-model.json` (7) + ZCode-only events `PermissionRequest`, `PostToolUseFailure` (2) = 9 rows.

Cells: ✅ native / 🔁 via adapter / ❌ absent / ⚠️ partial (with 1-line explanation).

| framework event (CC name) | ZCode | Cursor | Codex CLI | Aider | Windsurf |
|---|---|---|---|---|---|
| `SessionStart` | ✅ native | ✅ `sessionStart` | 🔁 maps to agent-turn-start (loose) | ❌ absent | ❌ absent (no equivalent found) |
| `UserPromptSubmit` | ✅ native | ✅ `userPromptSubmit` | 🔁 maps to agent-turn-start (loose) | ❌ absent | ✅ `pre_user_prompt` |
| `PreToolUse` | ✅ native | ✅ `preToolUse` | ❌ absent (turn-level only) | ❌ absent | ⚠️ partial — split into `pre_read_code` / `pre_write_code` / `pre_run_command` / `pre_mcp_tool_use` |
| `PostToolUse` | ✅ native | ✅ `postToolUse` | ❌ absent (turn-level only) | ❌ absent | ⚠️ partial — split into per-tool-shape post-hooks (symmetric to pre) |
| `Stop` | ✅ native | ✅ `stop` | 🔁 maps to agent-turn-complete (loose) | ❌ absent | ❌ absent (closest: `post_cascade_response_with_transcript`) |
| `SubagentStart` | ❌ absent (not in `ZCODE_EVENTS`) | ✅ `subagentStart` | ❌ absent | ❌ absent | ❌ absent |
| `SubagentStop` | ❌ absent (not in `ZCODE_EVENTS`) | ✅ `subagentStop` | ❌ absent | ❌ absent | ❌ absent |
| `PermissionRequest` (ZCode-only) | ✅ native | ❌ absent | ❌ absent | ❌ absent | ❌ absent |
| `PostToolUseFailure` (ZCode-only) | ✅ native | ✅ `postToolUseFailure` | ❌ absent | ❌ absent | ⚠️ partial — subsumed by per-tool-shape post-hook exit codes |

**Cell evidence source:** each cell cross-references the per-harness §3.N findings (URL + retrieval date 2026-07-18). "❌ absent" cells = no equivalent found in the cited docs as of 2026-07-18.

---

## §5 Per-harness verdicts

| Harness | Verdict | 1-sentence rationale |
|---|---|---|
| **Cursor** | **SUPPORTED** | Near-1:1 event overlap with CC (incl. `subagentStart`/`Stop`), JSON-stdin hook contract, and `CLAUDE_PROJECT_DIR` alias — source: <https://cursor.com/docs/hooks> (2026-07-18). |
| **Codex CLI** | **FEASIBLE** | Has lifecycle hooks + managed-hooks gate (`allow_managed_hooks_only`) but turn-level taxonomy ≠ CC per-tool model — source: <https://github.com/openai/codex/blob/main/docs/config.md> (2026-07-18). |
| **Aider** | **OUT-OF-SCOPE** | No hook event system; hook requests (issues #2045, #2557) still open — sources: <https://aider.chat/docs/config.html>, <https://github.com/Aider-AI/aider/issues/2045>, <https://github.com/Aider-AI/aider/issues/2557> (2026-07-18). |
| **Windsurf** | **FEASIBLE** | Cascade Hooks ship 12 events with exit-2 gating + JSONL transcripts, but taxonomy is tool-shape-aware (finer than CC's single `PreToolUse`) and lacks Session/Stop/Subagent equivalents — source: <https://docs.windsurf.com/windsurf/cascade/hooks> (2026-07-18). |

**Verdicts decided autonomously per kickoff §4 contract** (objective technical classification). The strategic framing of the agnosticism *claim itself* is parked (§6).

---

## §6 Parked question — agnosticism framing

**Parked via `park.ts` (Task 7).** Parked-question ID: `11774f50-8153-4bc1-b832-9d8d56031c71` (task paused with `blockedReason` carrying the full fork text + recommendation).

**The fork (operator's call):**

- **Option A — CC+ZCode only.** Publicly declare the framework as Claude-Code + ZCode specific; non-CC harnesses are out-of-scope by declaration.
- **Option B — Add FEASIBLE harnesses.** Publicly claim agnosticism for Cursor (SUPPORTED) + Codex CLI / Windsurf (FEASIBLE-pending-adapter). Aider stays OUT-OF-SCOPE.
- **Option C — Per-harness status doc.** Publish a per-harness verdict table (this survey) as the framework's authoritative agnosticism claim; no blanket statement. Consumers decide per-harness.

**Recommendation (mine, for operator to weigh):** **Option C — per-harness status doc.** It is the most honest representation of the evidence: Cursor is genuinely near-1:1, Codex/Windsurf would need real adapter work, and Aider has no enforcement substrate. Option A under-claims Cursor's near-1:1 support; Option B over-claims by bundling Cursor with two FEASIBLE-pending-adapter harnesses. Option C leaves the operator in control of how to frame each, and it matches the framework's discipline of evidence-bearing claims (T3).

**Why this is parked, not decided:** per kickoff §4, the per-harness verdicts are technically objective (decided autonomously above); the public claim is a **strategic framing decision** — it affects how the framework positions itself to consumers, contributors, and upstream companion projects. That is operator's call. Parked via `park.ts` (paused=true; parked-question ID `11774f50-8153-4bc1-b832-9d8d56031c71`).

---

## §7 Self-application (T15)

What would auditing this survey look like?

- **Did the survey fall into T1 (shallow sampling)?** No — each harness has ≥1 authoritative doc URL (Cursor docs, Codex open-source repo, Aider docs+issues, Windsurf docs), plus a second source for Codex (community explainer) and Aider (two feature-request issues as negative evidence). Sampling depth = 4/4 harnesses with primary-source evidence.
- **Did the survey fall into T3 (prose-only findings)?** No — every verdict cell in §4 cites a doc URL + retrieval date; every §3.N quotes the event taxonomy from the cited source.
- **Did the survey fall into T20 (recommendation without evidence)?** The §6 recommendation cites the §3 evidence (Cursor near-1:1, Aider no hook system, etc.) — it is a synthesis of evidence already in the doc, not a standalone verdict.
- **Did the survey fall into D5 (verdict ≠ public claim)?** No — the per-harness verdicts are objective; the public-claim decision is explicitly parked (§6), not decided unilaterally.

**Finding produced:** **SF-1 (self-finding).** The delta table §4 has 4 "🔁 via adapter" cells for Codex CLI's `SessionStart`/`UserPromptSubmit`/`Stop` mapping to lifecycle events — these are *loose* mappings (agent-turn ≠ prompt-submit; one user prompt can span multiple agent turns in Codex). A future adapter-design umbrella should not treat these as 1:1 mappings; the semantics differ. This is a coverage gap in the survey's granularity, surfaced by self-application.

---

## §8 §1.7 Forward/Backward self-reflexive checks

**Forward-check (complies with):**

- [`no-paid-llm-in-ci.md`](../../../.claude/rules/no-paid-llm-in-ci.md) — this survey is a markdown doc; no CI gate, no API-billed call, no LLM-in-CI. Evidence-gathering used WebSearch/WebFetch (operator-session, not CI).
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — this is an R-phase survey, not a capability commit; no BUILD vs REUSE verdict is being made here. The §6 recommendation defers such verdicts to a future adapter umbrella.
- [`doc-authority-hierarchy.md §2-§3`](../../../.claude/rules/doc-authority-hierarchy.md) — this file carries the Authoritative-for header at the top; registered path under `docs/meta-factory/research-patches/**`.
- [`attention-is-not-a-mechanism.md`](../../../.claude/rules/attention-is-not-a-mechanism.md) — no claim in this doc relies on «a human will notice»; the per-harness verdicts are evidence-backed, and the strategic fork is parked as a question (not deferred to a reader's attention).

**Backward-check (supersedes / extends / contradicts):**

- **Extends** [`.claude/rules/dual-implementation-discipline.md:32`](../../../.claude/rules/dual-implementation-discipline.md) — that rule *anticipates* non-CC harnesses; this survey provides the per-harness evidence the rule lacked.
- **Does NOT contradict** [`README.md`](../../../README.md) — README names Cursor/Codex/Aider as deployment surfaces; this survey confirms that naming for Cursor (SUPPORTED), Codex CLI (FEASIBLE), and Aider (OUT-OF-SCOPE for hook enforcement, but its consumers can still read portable artifacts).
- **Does NOT modify** the framework's public agnosticism claim — that is anti-scope per kickoff §8 and is parked (§6).
- **Does NOT supersede** [`scripts/render-harness-config.mjs`](../../../scripts/render-harness-config.mjs) — the framework SSOT for ZCODE_EVENTS is unchanged. This doc only compares against it.

---

## See also

- [Kickoff](../../../.claude/orchestrator-prompts/zcode-parity-s8-harness-survey-11774f/kickoff.md) — origin.
- [Plan](../../../.ai-factory/plans/feature-zcode-parity-s8-harness-survey-11774f.md) — task breakdown.
- [`scripts/render-harness-config.mjs`](../../../scripts/render-harness-config.mjs) — framework event SSOT.
- [`.ai-factory/harness-model.json`](../../../.ai-factory/harness-model.json) — CC-side neutral model.
- Umbrella: [`zcode-full-parity-mega-umbrella`](../../../.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md) Stage 8.
