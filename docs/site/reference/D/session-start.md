---
title: session-start hook
description: The getff plugin's front door. The moment a session starts, your agent receives the two-skill map and the priority rule — your repo's own instructions win, the plugin's skills come next, defaults last — so the right skill gets invoked before the first question is asked.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/reference/D/inject-handoff-on-compact.md
  - docs/site/reference/D/warn-subagent-report-zcode.md
  - docs/site/terms.md
  - docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md
  - packages/core/hooks/session-start.test.ts
  - plugin/hooks/hooks.json
  - plugin/hooks/session-start
executed:
  - { example: session-start-prints-the-bootstrap-block-on-claude-code, stack: repo, date: 2026-09-25, result: printed }
  - { example: session-start-wraps-the-same-block-as-one-json-object-on-zcode, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# session-start hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-session-start plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `session-start` |
| kind | hook |
| ships-to | plugin |
| description | Plugin SessionStart hook — injects the getff entry-point context so the using-getff skill auto-triggers |
| source | `plugin/hooks/session-start:2` |
| event | `["SessionStart"]` |
| matcher | `["startup|clear|compact"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-session-start -->

<!-- vale on -->

## Explanation

This is the only hook in the family whose card reads `plugin` on the
ships-to row: it exists only inside the getff plugin, and without that plugin
installed there is nothing to run. What it delivers is small and load-bearing —
the bootstrap block your agent receives at the start of every session. Under
Claude Code, SessionStart stdout is auto-injected into context, so the block
arrives as plain text:

```bash
printf '%s' '{"hook_event_name":"SessionStart","session_id":"docs-demo-ss-1","source":"startup"}' \
  | CLAUDE_PLUGIN_ROOT="$PWD/plugin" bash plugin/hooks/session-start
```

```text
[getff plugin — session bootstrap]
This repo has the getff plugin: turn every codebase convention into an executable
artifact that fails at the earliest reachable channel (edit-time → pre-commit → pre-push → CI
→ production). Thesis: documents lie; tests don't.
  …
Invoke via the Skill tool (do not Read the skill file to "use" it).

Instruction priority: this project's own CLAUDE.md / AGENTS.md / direct user requests WIN over
the plugin's skills, which win over default behaviour. The plugin supplies discipline; the repo
stays in control.

Honest boundary: this plugin delivers the SOFT layer (skills/agents/session hooks). The HARD
layer (git hooks + CI that fail the build) is opt-in via /getff:install-enforcement —
a plugin never silently mutates your git/CI.

Skills live under: <your plugin root>/skills/
[/getff plugin]
```

(The real output names the plugin's own skills directory.) The block is the
[soft layer](../../terms.md#soft-layer-and-hard-layer) speaking for itself:
it hands over the ~1% skill-invocation rule and two entry-point skills, states
the instruction ladder — the project's own files win over the plugin, the
plugin wins over defaults — and volunteers the honest boundary that nothing
here mutates your git or CI without opting in. The full protocol stays in the
skill; the hook carries only the directive (line 16's progressive-disclosure
note).

Under ZCode the same block wraps as one strict-JSON object, because plain
stdout is discarded there:

```json
{
  "additionalContext": "[getff plugin — session bootstrap]\n…\n[/getff plugin]"
}
```

One file serves both harnesses by branching on `ZCODE_PROJECT_DIR` inside its
own `_emit_bootstrap` (lines 27-33). That is also why the card's delivery row
says `@cc-only-rationale` without a `@dual-pair:` anchor: the rationale
(lines 6-10) records that there is deliberately no separate portable
counterpart artifact — the inline branching IS the portability, so the
dual-pair grammar (which requires a distinct twin) does not apply. Contrast
[warn-subagent-report-zcode](warn-subagent-report-zcode.md), whose two
harnesses needed two files.

The matcher `startup|clear|compact` covers three session beginnings. Two of
them pair naturally with the family's other compaction work: after a
compaction, the entry-point context arrives again here, while the saved
recap re-enters through [inject-handoff-on-compact](inject-handoff-on-compact.md).
One honest limit: the parity census (row 22, its note on SessionStart
delivery) records that the installed ZCode runtime dispatches SessionStart
only for `startup` and `resume` — so the `compact` source never fires there
until the runtime catches up; verify in the binary, not the doc.

## Evidence

- `plugin/hooks/session-start:2` is the header the card's description row quotes:
  `# session-start — Plugin SessionStart hook — injects the getff entry-point context so the using-getff skill auto-triggers`.
- Matcher note: line 5 — «Invoked via run-hook.cmd from plugin/hooks/hooks.json
  (matcher: startup|clear|compact)».
- Rationale: lines 6-10 — `@cc-only-rationale: SessionStart is a CC-native fire-point;
  this plugin hook is CC+ZCode dual-harness (inline _emit_bootstrap branches on
  ZCODE_PROJECT_DIR), but has no SEPARATE portable counterpart artifact …`.
- Degradation: lines 11-13 — off-CC/off-ZCode harnesses read the using-getff skill on
  demand, the accepted S7 / dual-implementation-discipline §3 boundary; ZCode
  strict-JSON requirement stated at lines 11-12.
- Spec: line 14 — `docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md`
  §3 (#4, ADAPT of using-superpowers).
- Progressive disclosure: line 16 — «the directive lives here, the full protocol in
  the skill».
- Plugin root: lines 22-23 — `CLAUDE_PLUGIN_ROOT` preferred, script-relative fallback.
- Emit: lines 27-33 — jq strict-JSON under ZCode, plain `printf` otherwise; inlined
  (lines 24-26) because plugin hooks ship standalone with no `lib/` sibling.
- Block: lines 36-60 — the `BOOTSTRAP` heredoc: the ~1% rule, the two skills, the
  instruction ladder, the soft/hard honest boundary, the skills path; emitted at line 61.
- Registration: `plugin/hooks/hooks.json:178` (`SessionStart`), matcher at line 180,
  command via `run-hook.cmd` at line 184, `"async": false` at line 185 — the block is
  in context before the first turn is answered.
- Census context (`.claude/rules/zcode-parity-doctrine.md` §2 row 22): the installed
  ZCode runtime dispatches SessionStart only with `startup|resume` — the `compact`
  source is ahead of its own runtime (S-verify, 2026-09-10).
- Paired test: `packages/core/hooks/session-start.test.ts` — CC plain stdout (line 68),
  instruction-priority ladder named (76), ZCode `{additionalContext}` JSON (86),
  strict top-level schema (95), and the SSOT equality: ZCode's additionalContext is
  byte-identical to CC's plain stdout, one source, two wrappers (128).
