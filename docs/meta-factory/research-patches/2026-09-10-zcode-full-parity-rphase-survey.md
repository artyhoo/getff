<!-- scope:zcode-full-parity-rphase-survey -->
<!-- R-phase survey of the FULL ZCode↔CC parity gap (mega-umbrella zcode-full-parity, post-Wave-B).
     Subject: the installed ZCode runtime binary, not the vendor doc — the #1696 doc-ahead-of-runtime
     precedent set the evidence rule. Covers hooks AND the beyond-hooks surface the 2026-07-18 census
     never swept (skills/commands/agents/MCP/permissions/memory/plugins). Records one architecture-level
     discovery: the silent project-hook strip was replaced by a workspace-hooks trust channel. -->

# ZCode↔CC full parity gap — R-phase survey (post-Wave-B, post-#1696)

> **Authoritative for:** the 2026-09-10 binary-level parity evidence behind the next I-phase of [zcode-full-parity-mega-umbrella](../../../.claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md): per-domain verdicts (§7), the ZCode hook I/O contract as actually shipped (§3), the workspace-hooks trust channel discovery (§4), the beyond-hooks census dimension (§5), and the prioritized I-phase plan (§8). Strategy forks are surfaced as DECISION-NEEDED, not decided (reviewer-discipline §2).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Hook census classifications — [zcode-parity-doctrine.md §2](../../../.claude/rules/zcode-parity-doctrine.md) stays the SSOT (this survey re-verified its event-level premises and found them current). Compaction-specific evidence — the [S-verify patch](2026-09-10-zcode-compaction-hook-verification.md) owns it (same binary; its verdicts carry over).

## §1 Subject and method

- **ZCode runtime:** `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs` (12,615,193 bytes, mtime 2026-09-04 16:09, app 3.11.2 / build 3.11.2.6792) + `app.asar` (same build) + `app.asar.unpacked` + `Resources/glm/packages/*` (bundled plugin seeds). Byte-identical build to the [S-verify subject](2026-09-10-zcode-compaction-hook-verification.md) §1 — all #1696 compaction probes carry over without re-run.
- **CC baseline:** `claude` 2.1.233 native binary (`/Users/art/.local/share/claude/versions/2.1.233`), probed for its hook-event vocabulary.
- **Method:** string/minified-code probes (`grep -a`, python byte-slices) over both bundles; Zod schema extraction (the runtime ships its own validators, so the schemas below are *the runtime's own contract*, not prose); cross-checked against live artifacts (installed plugin channel, `~/.zcode/` tree, this session's injected context). Vendor docs (bundled zcode-guide) treated as claims to verify, never as evidence — the #1696 rule.
- **Negative-existence coverage (6 surfaces):** zcode.cjs, app.asar, app.asar.unpacked, glm/packages plugin seeds, live journals (`~/.zcode/v2/logs`, `~/.zcode/cli/log`), live hook artifacts (this session's prompt context, `plugin/hooks/hooks.json` in-tree).

## §2 Hook events — the enum is unchanged; the CC delta is now fully enumerated

**ZCode runtime hook-event enum (verified in 3 independent encodings: the `vRn` Zod enum, the JSON-schema literal array, and the plugin-loader `bPo=new Set(Object.values(on))` source):**

```text
SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop
```

→ `ZCODE_EVENTS` in [`scripts/render-harness-config.mjs:46-54`](../../../../scripts/render-harness-config.mjs) is **current**. The doctrine's 22-row §2 census needs no event-level correction.

**CC 2.1.233 vocabulary (string probes over the native binary):** all of the above **plus** `SessionEnd`, `SubagentStart`, `SubagentStop`, `PreCompact`, `Notification`, `WorktreeCreate` — 13 events total.

**Full delta (6 CC events missing on ZCode) and framework impact:**

| CC event | ZCode | Framework use (doctrine §2 rows) | Action |
|---|---|---|---|
| `SubagentStart` | absent | rows 13/16 — already mitigated (row 15 fallback, #1047 full parity) | none — current |
| `SubagentStop` | absent | row 19 — closed via 4D hybrid (#1046) | none — current |
| `PreCompact` | absent (0 hits, both bundles) | row 21 — `cc-only` | none — current |
| `WorktreeCreate` | absent (0 hits) | row 20 — `cc-only`, maintainer scaffolding | none — current |
| `SessionEnd` | absent as hook (internal `SessionEnded` UI event only) | **none** — framework rides `Stop` | none (new knowledge, no consumer) |
| `Notification` | absent as hook (UI-internal only) | **none** | none (new knowledge, no consumer) |

**Disambiguation that matters:** `grep -c SubagentStop zcode.cjs` → 9 — but every hit is `V.SubagentStopped`, an internal runtime/UI task-lifecycle event (`emitRuntimeTaskSubagentStoppedEvent`) that never reaches the hook runner. A naive probe would have "found" SubagentStop support that does not exist. Same pattern for `SessionEnd`/`Notification`: strings exist, hook wiring does not. **Probe the dispatch sites, not the strings.**

**Unused shared event:** `PostToolUseFailure` exists on BOTH harnesses; the census registers no hook on it (opportunity, not gap — §8 P3).

## §3 Hook mechanics — the runtime's own I/O contract (codified)

Extracted from the shipped Zod schemas and dispatch code; this is the contract any I-phase hook work programs against.

**Output JSON (exit 0, stdout starts with `{`)** — two layers:

1. Strict per-event union `SRn` (discriminated on `hookEventName`):
   - `PreToolUse`: `{additionalContext?, permissionDecision: "allow"|"ask"|"deny", permissionDecisionReason?, updatedInput?}` — `updatedInput` is the mechanism Stage 7B (#1047) rides.
   - `UserPromptSubmit` / `SessionStart` / `PostToolUse` / `PostToolUseFailure` / `Stop`: `{additionalContext?}` — note `additionalContext` is accepted on `Stop` too.
   - `PermissionRequest`: `{decision}` (behavior object with `behavior:"deny", message`).
   - `PostToolUse` carries **no** `permissionDecision` — confirms the renderer's ADVISORY-ONLY note.
2. Lenient top-level `k3t` (parsed when `hookSpecificOutput` is absent): `{additionalContext?, additional_context?, continue?, decision: "approve"|"block", reason?, stopReason?, suppressOutput?, systemMessage?}` — i.e. the CC-documented top-level output grammar is accepted verbatim.

**Exit codes** (`WNr`/`Fni`/`jni`):

- `0` + JSON stdout → parsed via `k3t`. `0` + plain-text stdout (not starting `{`) → **dropped** — no context injection. *CC delta:* CC injects plain exit-0 stdout as context for UserPromptSubmit/SessionStart; ZCode requires JSON. Framework-safe (all twins emit JSON via `_zcode-emit`), but a documented divergence for hand-written consumer hooks.
- `2` → per-event blocking mapping: PreToolUse → `permissionDecision:"deny"` + `permissionDecisionReason`; PermissionRequest → `decision:{behavior:"deny"}`; Stop → `decision:"block"`; else → `continue:false` + `reason`. CC-compatible.
- other → recoverable `HookRunFailed` error (stderr surfaced in diagnostics); for PostToolUse effectively swallowed — advisory-only.

**stdin payload** (per-event switch, `agent_type`/`hook_event_name`/`permission_mode`/`session_id`/`transcript_path` + `transcriptPath` always; then): `tool_name`/`tool_input`/`tool_use_id` when a tool is in scope; `permission_suggestions` (PermissionRequest); `tool_response` (PostToolUse); `error_details`/`error`/`is_interrupt` (PostToolUseFailure); `last_assistant_message`/`stop_hook_active` (Stop). No `permission_result` field anywhere (CC has it on PostToolUse after a permission decision). `transcript_path` is the synthesized one-line preview file (no `.message.usage` — #1696 §3.3; D7/D13 arms structurally inert; unchanged).

**Env vars:** `CLAUDE_CODE_SESSION_ID`, `CLAUDE_SESSION_ID`, `CLAUDE_PROJECT_DIR` (+ `ZCODE_*` twins) always; `CLAUDE_PLUGIN_ROOT/_DATA/_ID/_NAME` (+ `ZCODE_*` twins) in plugin context. CC env-compat is explicit runtime behavior, not accident.

**Config grammar (both channels):** `{type:"command", command, enabled?, async?, shell?, timeoutMs?, statusMessage?}` | `{type:"process", command, args?, enabled?, timeoutMs?, statusMessage?}`. Default timeout constant `600*1e3` (600 s, CC-parity); per-hook `resolvedMaxOutputBytes` cap exists.

## §4 The workspace-hooks trust channel (architecture-level discovery)

The renderer's premise — «ZCode strips project-config hooks (security policy `config_project_hooks_ignored`, T3e/TTn @ zcode.cjs:2047000)» ([`render-harness-config.mjs`](../../../../scripts/render-harness-config.mjs) emitZcode block comment + note op) — is **stale at the mechanism level**:

- `config_project_hooks_ignored`: **0 occurrences** in both bundles. The cited byte offset now lands in WASM-loader code.
- The loader today: reads `zcode.json` **and** `.zcode/config.json` per root (`L_r`), strips `hooks` from the active config (`c5o`), emits diagnostic `config_project_hooks_pending_trust` — *"Project hooks are pending workspace trust and remain blocked"* — and preserves the declarations as a `hookCandidate`.
- Trust machinery (all present in the binary + wired in the app host): trust states `not_applicable|pending_trust|trusted_persistent|blocked_untrusted|blocked_policy|revoked|stale_digest`; policy modes `user_decides|allow_trusted_only|deny`; a persistent trust store keyed `(workspaceIdentity, hookDeclarationDigest)` with sha256 declaration digests + bundle digests (declaration change ⇒ `stale_digest` ⇒ re-trust); a `workspaceHookReview` **interaction kind** (same family as permission prompts) rendered by hosts declaring `workspaceHookReview` capability — the desktop app's hello handshake declares it `true`; reason codes include `workspace_hooks_require_trust_capable_host` and `workspace_hooks_interaction_timeout`.

**Net parity effect today: unchanged for the framework's architecture** — hooks in workspace config still do not run zero-touch; the plugin channel (`plugin/hooks/hooks.json`) remains the only trust-free delivery path, and the renderer's *conclusion* (don't emit hooks into `.zcode/config.json`) remains correct for consumer installs. What changed is the ceiling: a second, trust-gated channel now exists end-to-end (config → review UI → persistent trust → `effectiveRunnable:"configured"`). Whether to exploit it is **Fork A (§8, DECISION-NEEDED)**.

## §5 Beyond-hooks census dimension (new — the 2026-07-18 census covered hooks only)

| Domain | CC surface | ZCode runtime surface (evidence) | Verdict |
|---|---|---|---|
| Instruction files | `CLAUDE.md` + `.claude/rules/*` auto-load | `AGENTS.md` auto-load (20 refs), incl. `.zcode/AGENTS.md` + `.agents/AGENTS.md` candidates; **`.claude/` paths never read** (sole `.claude` literal is a memory-ignore set); no rules-dir equivalent | parity-by-design — repo AGENTS.md + portable rule index already solve this |
| Skills | `~/.claude/skills`, `.claude/skills`, plugins; `SKILL.md` name/description; `disable-model-invocation` | `~/.zcode/skills` + `.zcode/skills` (symlink-following **on** by default — the renderer's symlink works, live-confirmed: repo skills load in this session) + plugin `skills/`; frontmatter name+description; **`disable-model-invocation`: 0 occurrences** | parity with one declared gap: skills cannot be locked against model invocation on ZCode — `dispatcher`/`harvest` invocation-channel discipline is unenforceable there (mitigated by prompt discipline only) |
| Slash commands | `.claude/commands`, plugins; frontmatter `allowed-tools`/`argument-hint`/`disable-model-invocation`… | `.zcode/commands` + `.agents/commands` (`resolveDefaultCustomCommandRoots`) + plugin `commands/`; frontmatter keys `allowed-tools, argument-hint, description, disable-noninteractive, model, skills`; unknown keys → warning `custom_command_unknown_frontmatter` (ignored, not enforced) | parity (framework ships no commands); same disable-model-invocation gap |
| Subagent definitions | `~/.claude/agents`, `.claude/agents`, plugins (runnable) | `~/.zcode/agents` (live: 3 profiles) + `.zcode/agents` + plugin `agents/` — but plugin-shipped agents are **diagnosticOnly, not runnable** (`compatibility.runnable:[skills,commands,hooks,mcpServers,userConfig]`, `diagnosticOnly:[agents,lspServers,outputStyles,channels,settings]`) | parity for user/project scope; plugin-channel agents NOT runnable — constraint if GLM-worker agent defs ever ship via plugin |
| MCP | root `.mcp.json`, user scope; stdio/http/sse | `.zcode/config.json` `mcp.servers` (live: context7/deepwiki http) + plugin `.mcp.json` + `manifest.mcpServers`; stdio/http/sse + headers + oauth + `isolation:session\|workspace` + `protocolVersion legacy\|auto\|2026-07-28`; MCPB/DXT recognized-unsupported | parity — repo design (MCP via `.zcode/config.json`) is the correct native surface |
| Permission modes | default/acceptEdits/plan/bypassPermissions | superset: `default\|yolo\|plan\|edit\|acceptEdits\|auto\|dontAsk\|bypassPermissions\|autoEdit\|build` | parity+ |
| Memory | auto-memory (`MEMORY.md` + topic files) | present — `MEMORY.md` index with line-limit warnings, topic files, "user's auto-memory, persists across conversations" | parity |
| Plugins | `.claude-plugin/plugin.json` | manifest accepted as `.zcode-plugin` **or `.claude-plugin` or `.codex-plugin`**; marketplaces (295 refs); component compatibility per above | high compat — CC plugin layout structurally loadable |
| Plan mode | ExitPlanMode tool + plan mode | `ExitPlanMode`: 20 refs; `plan` in mode enums | parity |
| Status line | settings `statusLine` | **0 occurrences** | gap, unused by framework — declare, no action |
| Compaction hooks | PreCompact + SessionStart:compact | feature present, hook lifecycle absent — [#1696](2026-09-10-zcode-compaction-hook-verification.md) | unchanged (rows 21/22 `cc-only`) |

**Live channel proof (plugin channel end-to-end):** this very session's prompt carries the UserPromptSubmit-injected session-bootstrap digest and the getff/zcode-guide skills from `~/.zcode/cli/plugins/cache/` — the plugin channel fires on the current build, not just in fixtures.

## §6 Stale-claim sweep (backward-check targets found by this survey)

1. [`scripts/render-harness-config.mjs`](../../../../scripts/render-harness-config.mjs) emitZcode comment + note op — cites dead policy name `config_project_hooks_ignored` and dead byte offset `zcode.cjs:2047000`. Mechanism replaced by pending-trust (§4). Conclusion (plugin-only hook emission) still correct. → fold into the parked **D3 renderer-sync** batch (doctrine §3 header note) rather than a lone edit — renderer wording + snapshots move in lockstep.
2. Same file, loud-declaration block (`render-harness-config.mjs:256-268` area): `SubagentStop — NO backup … CC-only` is stale since Stage 5/#1046 — this is the already-parked D3 item; §6.1 joins it.
3. [`plugin/hooks/hooks.json`](../../../../plugin/hooks/hooks.json): two dead-on-ZCode registrations — `SubagentStart -> inject-project-digest` (event absent from runtime enum; the role is served by `PreToolUse:Agent` inject-subagent-context per row 13/15) and `SessionStart [startup|clear|compact]` matcher values `clear|compact` (no dispatch sites — #1696 §3.2). Harmless (registered-but-never-matched), but they are undeclared noise in the shipped manifest. Generator-level prune candidate (§8 P0).
4. Doctrine §2/§4 event-level premises — **re-verified current** on this build (7-event enum ×3 encodings; PreCompact 0; no `source=compact` dispatch). No edit needed.

## §7 Verdicts per parity domain

| # | Domain | Verdict | Basis |
|---|---|---|---|
| D1 | Hook-event coverage | **KEEP** doctrine §2 as-is — 22-row census current; CC delta now fully enumerated (6 events, 4 already classified, 2 unused by framework) | §2 |
| D2 | Hook I/O contract | **CODIFY** — §3 of this patch is the first binary-grounded contract; no divergence found that breaks existing twins (JSON-emitting, exit-2 mapping CC-compatible) | §3 |
| D3 | Hook delivery channels | **SPLIT VERDICT**: plugin channel KEEP (zero-trust, live-proven); workspace-config channel NEW OPTION behind interactive trust — exploit-or-not is Fork A | §4 |
| D4 | Skills | **KEEP + DECLARE GAP**: `disable-model-invocation` unenforceable on ZCode — add honest-degradation note where invocation-channel discipline is claimed | §5 |
| D5 | Commands / agents / MCP / permissions / memory / plan mode | **KEEP** — parity or superset; plugin-agents-diagnosticOnly is the one constraint to remember | §5 |
| D6 | Stale renderer/manifest claims | **FIX in I-phase** — D3-unpark batch (renderer notes) + generator prune (dead registrations) | §6 |
| D7 | Drift prevention | **BUILD candidate** — binary probes are currently hand-run; the method that caught #1696 and §4 should be an executable test (Fork B) | §8 |

## §8 Prioritized I-phase plan

**P0 — autonomous hygiene (no strategic fork):**
1. Unpark D3: one renderer PR syncing (a) the dead `config_project_hooks_ignored`/offset citation → pending-trust mechanism (§4), (b) the stale `SubagentStop NO-backup` loud-declaration → 4D-hybrid wording, with snapshot updates in lockstep (doctrine §3 header already scopes this).
2. Generator prune: drop `SubagentStart` registration + `clear|compact` matcher values from the Stage-6 twin generator output (`plugin/hooks/hooks.json`), regen manifest, tests green.

**P1 — DECISION-NEEDED (operator picks before dispatch):**
- **Fork A — workspace-config trust channel.** Options: (A1) experiment dogfood-only — write hooks into `.zcode/config.json` in the maintainer env, walk the trust review in the app, record UX + digest-churn cost (hooks edit ⇒ re-trust); (A2) keep plugin-only (status quo; consumer install stays friction-free); (A3) adopt for consumers too (rejected-by-default: digest re-trust on every hook update is anti-consumer). Evidence needed for A1: one manual trust walkthrough; no headless CLI entry exists in the app bundle (§1), so this is an operator-at-the-GUI step.
- **Fork B — executable runtime-probe test (getff-style).** `scripts/probe-zcode-runtime.sh` + vitest wrapper (skip cleanly when `/Applications/ZCode.app` absent; no paid LLM): assert the 7-event enum literals, `PreCompact`=0, `runSessionStartHooks` call-set, trust-model markers, `CLAUDE_*` env compat, plugin-component compatibility list. Turns the doc-ahead-of-runtime failure mode into a failing test. This is the recursive self-application of the method that produced #1696 and §4.

**P2 — doctrine extension (docs-only, follows operator nod on scope):** add the §5 beyond-hooks census as a doctrine section (or annex research-patch reference) so parity SSOT covers non-hook domains; include the §3 contract as the normative hook-I/O reference for twin authors.

**P3 — DECISION-NEEDED, low priority:**
- PostToolUseFailure hooks (event exists on BOTH harnesses; candidate: failure-path arm for `runtime-bridge-dispatch` / write-gates). Demand unproven.
- Plugin-agents-diagnosticOnly note into `claude-glm-executor-handoff` skill IF GLM worker agent defs ever ship via plugin channel (today they don't).

**Explicitly out of scope (confirmed non-gaps):** SessionEnd/Notification events (framework rides Stop); statusLine (unused); MCPB/DXT (unsupported upstream, unused).

## §9 Falsifier

Any ZCode build newer than 2026-09-04 (3.11.2.6792) may invalidate §2–§5. Re-probe before relying on this survey: event-enum literals (3 encodings), `config_project_hooks_pending_trust` presence, `workspaceHookReview` interaction wiring, `disable-model-invocation` count, plugin `compatibility.runnable` list. Fork B (§8) automates exactly this set — that is its point.

## §10 §1.7 self-review

**Forward-check (research-only):**

- Every verdict carries its probe + observed output (§2 enum ×3 encodings; §3 Zod schemas quoted from the bundle; §4 function-level loader trace; §5 per-domain evidence column); negative-existence claims swept all 6 surfaces (§1) — including app.asar re-sweep for PreCompact/WorktreeCreate/disable-model-invocation/statusLine/config_project_hooks_ignored (all 0).
- Recommendation discipline (H1): forks A/B/P3 carry options with evidence and explicit default lean, not silent picks; §7 marks what is KEEP vs DECISION-NEEDED. The survey does not decide strategy forks (user directive + reviewer-discipline §2).
- phase-research-coverage §1.11: doctrine + #1696 patch + census were re-read in the worktree at this branch (`a1337cb301`), not pattern-matched from memory; the kickoff's acceptance state (§4) was cross-checked against `git log` before relying on Wave-B merge status.
- No new code/rule/skill shipped — research patch only; principle 13's §1.7 gate applies to this file itself (this section).
- language-discipline: English, category 1 (internal machinery doc).
- **Active ai-laziness traps (T-catalogue)**: T3 countered — every finding is probe-backed, none assertion-backed; T4/T9/T10 countered — the sweep covered ALL domains (hooks + 11 beyond-hooks rows) and all 6 negative-existence surfaces, not the easy ones; T5 countered — implementation findings (renderer sync, generator prune) are deferred to I-phase P0, not bundled here; T7 countered — the SubagentStopped/SessionEnd/Notification disambiguation (§2) is exactly the refuse-the-literal-reading move; T15 self-application — Fork B; T20 countered — §7/§8 verdicts carry evidence columns + falsifier; T21 countered — backward-check below sweeps siblings, not this PR.
- **Domain trap added (extends the catalogue, minified-runtime auditing):** *string-presence ≠ wiring* — `grep -c SubagentStop` returns 9 and would "prove" event support that the dispatch-site probe disproves; in minified bundles, probe the Zod enums and call sites, never the bare string. This generalizes #1696's doc-ahead-of-runtime trap from vendor docs to grep output.

**Backward-check (surfaces whose claims this survey touches):**

- [`render-harness-config.mjs`](../../../../scripts/render-harness-config.mjs): 2 stale claims found (§6.1–6.2) — both already inside the parked-D3 scope; NOT edited here (docs-only research PR; renderer edits move with snapshots). `ZCODE_EVENTS`/`ZCODE_UNSUPPORTED_TOOLS` re-verified current.
- [`plugin/hooks/hooks.json`](../../../../plugin/hooks/hooks.json): dead registrations enumerated (§6.3), not pruned here (generator + manifest + tests = execution work, P0 of I-phase).
- [`.claude/rules/zcode-parity-doctrine.md`](../../../.claude/rules/zcode-parity-doctrine.md): §2 premises re-verified current — no contradiction introduced; §4/§5 of this patch extend, not amend.
- [2026-09-10 compaction S-verify](2026-09-10-zcode-compaction-hook-verification.md): same binary, zero contradiction; §2 disambiguation (probe dispatch sites, not strings) generalizes its §6 revisit rule.
- Census + dated research patches (2026-07-18 family): immutable dated records — exempt; this patch supersedes nothing in them.
- `kickoff.md` §0 «9 of 9 plugin twins work» premise: superseded upstream by Stage 6/#1043 (16 twins live) — carried from doctrine §3, not re-litigated.

**Self-application (T15):** the survey applies the framework's own thesis to itself — «documents lie; binaries don't» — by treating even our OWN prior runtime claims (renderer notes, plugin manifest) as claims re-verified against the binary, and by proposing (Fork B) to make that verification an executable artifact rather than a repeated manual audit.
