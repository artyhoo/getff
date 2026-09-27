---
title: check-hook-marker hook
description: Every hook file must declare how it ships — portable twin or Claude-Code-only with a reason. This gate reads that declaration off the file you just edited, and checks the hook's own header line while it is there.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/check-hook-marker.sh
  - .claude/hooks/lib/hook-emit.sh
  - .claude/rules/dual-implementation-discipline.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - packages/core/hooks/check-hook-marker.test.ts
  - plugin/hooks/hooks.json
executed:
  - { example: hook-marker-green-on-a-hook-with-a-marker, stack: repo, date: 2026-09-25, result: silent }
  - { example: hook-marker-red-on-a-hook-without-a-marker, stack: repo, date: 2026-09-25, result: printed }
  - { example: hook-marker-red-on-a-malformed-strict-header, stack: repo, date: 2026-09-25, result: printed }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# check-hook-marker hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-check-hook-marker plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `check-hook-marker` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PostToolUse gate — delivery-channel marker + strict header grammar on touched hook files |
| source | `.claude/hooks/check-hook-marker.sh:2` |
| event | `["PostToolUse"]` |
| matcher | `["Edit|Write|MultiEdit"]` |
| delivery | `["@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-check-hook-marker -->

<!-- vale on -->

## Explanation

A hook that only works in Claude Code is fine. A hook that only works in Claude Code
and nobody said so is how a framework quietly stops working everywhere else. This
[gate](../../terms.md#gate) closes that door at the moment a hook file is written:
every `.claude/hooks/*.sh` must carry a delivery-channel marker on its own comment
line — `# @dual-pair: <anchor>` when a portable [twin](../../terms.md#twin) exists,
or `# @cc-only-rationale: <reason>` when the hook is deliberately Claude-Code-only.
Writing a hook without one fails the edit on the spot.

Here it is passing on a real hook (which declares a dual pair):

```bash
printf '%s' '{"tool_name":"Edit","session_id":"docs-demo-chm-1",
  "tool_input":{"file_path":"'$PWD'/.claude/hooks/inject-matching-rule.sh"}}' \
  | bash .claude/hooks/check-hook-marker.sh
```

```text
(nothing — exit 0)
```

And failing on a hook file with no marker — the demo creates one so you can run it:

```bash
printf '#!/usr/bin/env bash\n# a hook with no marker\nexit 0\n' > .claude/hooks/zz-red-demo.sh
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-chm-2",
  "tool_input":{"file_path":"'$PWD'/.claude/hooks/zz-red-demo.sh"}}' \
  | bash .claude/hooks/check-hook-marker.sh
```

```text
❌ hook-marker: .claude/hooks/zz-red-demo.sh has no delivery-channel marker.
   Add ONE of (own comment line, near the top):
     # @cc-only-rationale: <why CC-only — no portable counterpart>
     # @dual-pair: <anchor shared with the portable agent/skill>
   Per dual-implementation-discipline.md §6 (prevents silent CC vendor-lock-in).
```

The same gate reads the file's second line. Hooks follow a strict header grammar —
line 2 must be `# <filename> — <what this hook does>` — because the docs generator
scrapes exactly that line to build reference tables. A file that has a marker but no
grammar-conforming header fails with its own message:

```bash
printf '#!/usr/bin/env bash\n# @cc-only-rationale: demo\n# short\nexit 0\n' > .claude/hooks/zz-red-demo2.sh
printf '%s' '{"tool_name":"Write","session_id":"docs-demo-chm-3",
  "tool_input":{"file_path":"'$PWD'/.claude/hooks/zz-red-demo2.sh"}}' \
  | bash .claude/hooks/check-hook-marker.sh
```

```text
❌ hook-marker: .claude/hooks/zz-red-demo2.sh line 2 is not the strict header.
   Expected as line 2, immediately after the shebang: '# zz-red-demo2.sh — <what this hook does>' (≥10 chars after the em-dash).
   Insert it above any @-marker block — the marker block moves down one line; this gate reads markers anywhere in the head.
   Per the D29 reference-generator spec §5 #3 (HEADER_TABLE['D']) + the arm-F backstop (principle 46).
```

Delete both demo files when you are done. Both violations exit 2 — the
[channel](../../terms.md#channel) the model receives after a PostToolUse.

The gate goes one question deeper than marker presence. A hook whose body validates
file content must be registered for **every** editing tool, so it also cross-checks
the registration: a hook carrying `@file-content-gate` must have `Edit`, `Write`, and
`MultiEdit` all present in its registered matcher — in any order, tested as tokens, so
`Write|Edit|MultiEdit` passes. A hook with an internal tool filter must have a
registration that delivers every tool its own `case` statement handles. Both checks
read the matcher out of the registries — your `.claude/settings.json` first, then the
plugin's `hooks.json` — because a body that handles a tool the matcher never delivers
is a silent bypass.

One applicability rule keeps this from being noise outside the framework: the marker
convention is defined by a rule file this repo carries, so a project without that file
gets silence, not a demand it cannot understand. Skip notices for missing `jq` stay
loud and scoped — «a SKIP, not a pass».

## Evidence

- `.claude/hooks/check-hook-marker.sh:2` is the header the card's description row
  quotes: `# check-hook-marker.sh — PostToolUse gate — delivery-channel marker + strict header grammar on touched hook files`.
- Registration: `.claude/settings.json:141` reads `"matcher": "Edit|Write|MultiEdit"`
  with the command at line 145; the plugin registry registers it too
  (`plugin/hooks/hooks.json:117`).
- Arm 1: line 134 greps `^# @(dual-pair|cc-only-rationale):` — anchored to a comment
  line so prose documenting the syntax is not mis-counted (comment at lines 132-133);
  the violation text is lines 135-139.
- Arm 2: line 148 reads line 2 with `sed -n '2p'`, line 150 checks the
  `# <basename> — ` prefix and the ≥10-char description; the comment (lines 141-146)
  records why the header must sit above the marker block — a «first non-marker comment
  line» rule was measured and rejected.
- Strict-header spec: the violation cites the D29 reference-generator spec §5 #3 and
  the arm-F backstop (principle 46) — the grammar exists so the generator can scrape it.
- File-content-gate invariant: line 174 greps `^# @file-content-gate:`; lines 183-196
  test token membership against the registered matcher and reject any of `Edit`,
  `Write`, `MultiEdit` missing «in any order» — the comment (lines 177-181) records the
  positional-glob bug this replaced, which rejected the very form `hooks.json` itself
  used.
- Matcher-parity invariant: line 212 extracts `case "$TOOL" in …` arms from
  non-comment lines; lines 221-232 demand the registration deliver every tool the
  case-arm handles — self-calibrating, so a Write-only hook stays green (comment lines
  200-211).
- Both-channel matcher lookup: `_reg_matcher` at lines 68-83 queries
  `.claude/settings.json` then `plugin/hooks/hooks.json`, stripping `.sh` for the
  plugin lookup (lines 76-78 record the GAP-2 cold-review fix).
- Applicability: line 102 exits silently unless
  `.claude/rules/dual-implementation-discipline.md` exists — the comment (lines 87-101)
  names this the framework-convention-leaks-to-consumer fix: the gate is
  NOT-APPLICABLE without the convention, and correctly silent.
- Exit contract: `_adv_violation` (line 54) prints to stderr and exits 2 under Claude
  Code, or emits JSON `additionalContext` under a schema-bound harness; the header
  (lines 21-24) cites the live-verified channel finding.
- Paired test: `packages/core/hooks/check-hook-marker.test.ts` — its header (lines
  1-14) states the contract: «❌ a .claude/hooks/*.sh with NO marker → exit 2 (the
  silent-CC-lock-in gap)», plus green cases for each marker and the off-path skip.
