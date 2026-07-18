<!-- scope:zcode-harness-visibility -->
# zcode harness visibility — operator-axis config-derivation shim (#894)

> Scope: the #894 decision to BUILD an operator-axis neutral-harness-model + per-harness config emitters (CC + zcode) with a drift gate, and the boundaries that keep it a shim (not a shipped consumer emitter). Individual-file authority inherited from [README.md](README.md).

## Problem

zcode (a Claude Code fork the framework is developed inside) **does not read `.claude/`** at all — so every edit-time gate, MCP server, and skill the framework ships installs to `/dev/null` there: startup log `hookCount:0`, `mcpServerCount:0`, zero framework skills. The agnosticism audit (principle 21) was green — it verifies CC-coupling *discipline*, never that a non-CC harness actually *reads* the artifact (#894). Green ≠ functional off-CC.

Bundle evidence (direct inspection, `/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs`, 2026-07-03, T3):
- Hook config source = `zcode.json` (project, walk cwd→git-root) + `~/.zcode/cli/config.json` (user); **`.claude/settings.json` unread** (0 refs).
- `hookCount = Σ entry.hooks.length` over the CC hooks shape `{Event:[{matcher?,hooks:[{type,command}]}]}` (bundle @8793167) → zcode uses the **identical CC hooks schema**. `CLAUDE_PROJECT_DIR` IS set for hook commands (verified 2026-07-17, `uRt` @ zcode.cjs:1073004, alongside `ZCODE_PROJECT_DIR` — both = session cwd) → hook *scripts* run unchanged **once registered**.
  - **CORRECTION (2026-07-17, bundle re-inspection T3e/TTn @ zcode.cjs:2047000):** «once registered» was the load-bearing gap. zcode STRIPS the `hooks` key from project-scope config (`zcode.json` AND `.zcode/config.json`) under `config_project_hooks_ignored` (a security policy). Writing hooks to `.zcode/config.json` is a SILENT NO-OP for hooks (MCP + skills load fine). The original claim above was true for the plugin channel (verified live: `superpowers` SessionStart fires) but FALSE for project-config. **Hooks reach zcode ONLY via the plugin channel** (`plugin/hooks/hooks.json`, loaded by the separate `EAo` merge path @ zcode.cjs:8897587, security-policy-exempt). emitPlugin renders this file from the same SSOT; emitZcode no longer emits hooks (MCP + skills only).
- MCP source = `mcp.servers` (nested; **not** top-level `mcpServers`, **not** `.mcp.json`); per-server Zod is `.strict()`: http/sse = `{name,type,url,headers[]}`, stdio = `{name,command,args[],env[{name,value}]}` (bundle @352443). `mcpServerCount = Object.keys(mcp.servers).length`.
- Event set = `{SessionStart,UserPromptSubmit,PreToolUse,PermissionRequest,PostToolUse,PostToolUseFailure,Stop}` (bundle @571313) — **no `SubagentStart`/`SubagentStop`**.
- Workspace resolution (operator-facing): headless `--prompt` reopens the *persisted* workspace, unsteerable by `cwd`/`--cwd`/`--user-data-dir` — so the shim's `zcode.json` must live at the repo root the operator actually opens.

## Correction (2026-07-17): plugin channel is the only zcode-working hook path

The original BUILD shipped `emitZcode` writing hooks to `.zcode/config.json` — assuming the
line-12 claim «hooks run unchanged once registered» covered project-config. Bundle re-inspection
(T3e/TTn @ zcode.cjs:2047000) refuted this for project scope: zcode strips `hooks` from BOTH
project candidates (`zcode.json`, `.zcode/config.json`) via `config_project_hooks_ignored`
(security policy), emitting a warning diagnostic. **Only the plugin channel** (plugin/hooks/hooks.json,
merged via `EAo` @ zcode.cjs:8897587) is security-policy-exempt and actually fires hooks on zcode.

**Fix (Variant 2: additive emitPlugin):** a third `HarnessEmitter` backend renders
`plugin/hooks/hooks.json` from the same `.ai-factory/harness-model.json` SSOT, with T-PLUG-A
relocated hook twins under `plugin/hooks/` (precedent: session-start, inject-matching-rule).
`.claude/settings.json` (CC primary) is untouched — zero CC-consumer regression. `.zcode/config.json`
now carries MCP + skills only; its hooks-branch was a silent no-op anyway.

**Documented degradation (not a fixable gap — inherent, declared loudly via emitZcode note ops):**
4 PostToolUse gate hooks (`check-doc-authority`, `check-hook-marker`, `check-kickoff-traps`,
`check-worker-dispatch-channel`) are ADVISORY-ONLY on zcode. Schema `Uan` (zcode.cjs:53) accepts
`permissionDecision:"deny"` ONLY for PreToolUse; PostToolUse consumes `additionalContext` alone.
Post-mutation checks cannot block on ANY harness (the file is already changed — causality), but
CC surfaces `exit 1 + stderr` loudly while zcode's `additionalContext` is a quieter channel.
Relocation to PreToolUse is semantically impossible (the file has not mutated yet at PreToolUse).
The hooks' existing `_adv_violation → additionalContext` branches (already ZCode-targeted) are
preserved verbatim in the plugin twins — they deliver the advisory context, not a block.

**Live install** requires `/plugin marketplace add artyhoo/getff` + `/plugin install getff@getff`
(the documented SOFT-layer path). The plugin tarball then carries the full hook set; on zcode it
is the only live path. On CC the plugin is a parallel SOFT layer (the HARD layer via install.sh
remains the primary, untouched).

## Root Cause

[SSOT #129](../prior-art-evaluations.md) DEFERred harness-config *generation* as "harness-specific, not operator-portable" — but it never resolved the case where a harness *requires* a non-`.claude/` config **to function at all**, and that harness is the maintainer's daily driver. The DEFER trigger fired.

**BFR-default upstream re-search (2026-07-04, WebSearch ×2 + DeepWiki `intellectronica/ruler`) — a `#pattern-matching-on-name` correction to this umbrella's own framing.** The real upstream class is NOT dotfiles managers (chezmoi — a T16 miss: sounds adjacent, solves user-dotfiles sync) but a mature **AI-agent-config-sync family**: `intellectronica/ruler`, `Goldziher/ai-rulez` (19+ tools), `enckequity/samebrain`, `block/ai-rules`, agentsmesh, skills-sync. The closest — **ruler** — even ships a *failing* drift gate (non-zero exit in CI) and per-agent extensibility via an `IAgent` interface (bespoke schema, nested `mcp.servers`, symlinks — no fork needed). BUILD (not ADOPT) still holds for THIS slice on two evidence-backed grounds: (1) **ruler manages rules/MCP/skills but NOT hooks** (DeepWiki `intellectronica/ruler` 2026-07-04, verbatim: "It does not currently generate or manage HOOKS configurations… for mapping events to shell commands") — and *hooks are the framework's core edit-time enforcement channel* and #894's primary AC (`hookCount>0`); adopting ruler leaves requirement #1 unserved. (2) A zero-dep ~170-LOC operator shim for 2 backends is lighter than a new dependency + `ruler.toml` + a custom `IAgent` + still-separate hooks work. The **consumer-emission fork (§7)** is where ADOPT-ruler becomes the live question (extend it with an `IAgent` for zcode + upstream a hooks capability) — recorded as the trigger to revisit, NOT re-built.

**Deeper 5-angle BFR-default re-sweep (2026-07-04, workflow `wf_6cb8ae9f-ae0`, ≥3 phrasings/angle — against `#parallel-evolution-creep`).** A second, exhaustive sweep tested the operator's hypothesis («GLM is a Claude replacement → ready-made must exist») across five independent angles (zcode identity+docs, config-schema vs shipped Zod, CC→zcode migration + the `claude-import` lead, the config-sync tool family incl. rulesync, and our own companions/AI-Factory). It **confirms-BUILD** with one documentation-completeness amendment:

- **zcode does NOT natively consume CC config.** Its `claude-import` is chat-history-only (shipped Zod `qHr = .strict()` `{source, title, createdAt, updatedAt, messages[]}`, `migrationSource:v.enum(["claudeCode"])` — config *cannot* ride along by construction; the sample file has keys `[messages, meta]` only). The CLI bundle has **0** `settings.json` refs (`grep -c settings.json glm/zcode.cjs = 0`) — the one native `Import` (MCP-servers only, one-time GUI copy) lives in the Electron shell, not the CLI. `CLAUDE.md→AGENTS.md` is a one-time onboarding conversion. **Hooks — #894's primary AC — are consumed from none of these** (no Hooks page in the docs ToC; the `$zcode-configuration-guide` skill + changelog enumerate «skills, plugins, MCP, AGENTS.md» and omit hooks; hooks exist only as a bundled *plugin type*).
- **No ready-made tool serves the intersection {hooks} ∩ {zcode} ∩ {drift-gate}.** The config-sync family splits: ruler / ai-rulez / block-ai-rules render to many agents but **drop hooks**; **rulesync** / ai-config-sync-manager **do** model CC event-hooks (rulesync: `PreToolUse`/`PostToolUse`/`SessionStart`, camelCase→PascalCase, `$CLAUDE_PROJECT_DIR`) but **do not target zcode/GLM**. `samebrain`'s own README concedes «as of mid-2026 NO tool rendered rules + MCP + hooks across all three agents». **`rulesync` is the closest hooks-capable prior-art** — a stronger ADAPT anchor than ruler (which cannot model hooks at all); its hooks pipeline is the reference implementation this shim's hooks emission mirrors. Recorded in [SSOT #200](../prior-art-evaluations.md).
- **Schema confirmed against shipped Zod (not just the bundle read).** The CC-identical hook envelope, the 7-event strict map (`SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Stop` — no `Subagent*`), and nested `mcp.servers` are all CONFIRMED. **One material refinement:** zcode's inner-hook is a two-variant `discriminatedUnion("type", …)` — `command` `{type,command,async?,shell?,timeoutMs?}` AND `process` `{type,command,args[],timeoutMs?,statusMessage?}`; MCP servers additionally allow an optional `timeoutMs`. `render-harness-config.mjs` emits **only** the `command` variant — a `.strict()`-VALID subset (not a bug). The subset is now declared explicitly in `toCCHooks`/`emitZcode` comments as UNEXPRESSED-BY-DESIGN, so a future reader does not mistake it for the whole grammar ([attention-is-not-a-mechanism.md](../../../.claude/rules/attention-is-not-a-mechanism.md) — silent narrowing declared, not hidden). One angle (community-ecosystem) errored on its structured-output cap and is excluded from the synthesis; the four completing angles land 4×`confirms-BUILD` + 1 `ADOPT-partial` that itself concedes the ready-made «covers MCP+skills but explicitly not hooks».

## Solution

A **narrow neutral SSOT** + two live backends + an executable gate:
- `.ai-factory/harness-model.json` — `{hooks, mcpServers, skillsDir}` only; an executable **union-IR guard** rejects vendor keys (`permissions`, `enabledPlugins`, …) leaking in (not prose — N5).
- `scripts/render-harness-config.mjs` — `HarnessEmitter {name, emit()}` extracted from **two** live backends day-one (CC + zcode; the EcosystemAdapter npm#852→cargo#868 precedent): `emitClaude` **merges** — owns only `settings.json.hooks`, foreign keys byte-identical (CC keeps writing its own file) + `.mcp.json`; `emitZcode` renders `zcode.json` in zcode's strict shape + idempotent `.zcode/skills → ../.claude/skills` symlink. `--write`/`--check` (render-rules precedent).
- gitignore: `zcode.json` + `.zcode/` are gitignored maintainer-env shims; `.ai-factory/harness-model.json` negated back as the one tracked SSOT.
- Drift gate `packages/core/hooks/harness-config-drift.test.ts` (`test:hooks`, already CI-armed): claude branch (tracked settings.json + .mcp.json) verified every run; zcode branch loud-skips when `zcode.json` absent (gitignored → absent in CI). A hand-edit or a hook added past the model → RED pointing at the model. This is the "attention is not a mechanism" gate for the shim.

Recursive-self-application note: the strengthened P1 (idempotency) test caught a real generator bug — `rmSync` follows a symlink-to-dir and throws `ERR_FS_EISDIR` on Node 24, crashing every re-write; fixed to `unlinkSync`. A hash-only P1 had masked it (T19 cold-QA class).

## Prevention

Before DEFERring a "harness-specific config" capability again: ask whether a harness **requires** the non-`.claude/` config to *function*, and whether it is an operator daily-driver. If both → the operator-axis slice is in scope now (verdict **BUILD** — the research synthesis's `confirms-BUILD`; ADAPT is the pattern-anchor reasoning, not the verdict), delivered as a **neutral model + per-harness renders + drift gate**, never a hand-copied config (`#sync-by-copy-paste`) and never silently CC-only. Capability *divergence* (zcode lacks `SubagentStart`/`SubagentStop`) is declared **loudly** by the emitter (honest-degraded), never dropped in silence. Consumer-facing emission (install.sh → {zcode,Cursor,Codex,Cline,Aider}) stays a **parked fork** (#894 §7): harnesses diverge by *capability* (Cursor has no hooks, Aider no MCP), so that is a per-harness capability matrix, not a flat translator — a separate decision the owner makes.

## Tags

`#harness-config-derivation` `#operator-axis-shim` `#honest-degradation` `#parallel-evolution-guard` `#pattern-matching-on-name`
