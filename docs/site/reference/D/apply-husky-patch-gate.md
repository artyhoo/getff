---
title: apply-husky-patch-gate hook
description: The .husky/ directory is sealed to agents three ways over, so patching a hook needs one sanctioned door — this gate is that door's permission layer, approving exactly the two canonical apply-husky-patch.sh invocation shapes and nothing else.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .ai-factory/harness-model.json
  - .claude/hooks/apply-husky-patch-gate.sh
  - .claude/settings.json
  - CLAUDE.md
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - scripts/apply-husky-patch.sh
  - scripts/apply-husky-patch.test.sh
  - scripts/wire-apply-husky-patch.py
executed:
  - { example: apply-husky-patch-gate-approves-the-dry-run-shape, stack: repo, date: 2026-10-07, result: allow }
  - { example: apply-husky-patch-gate-approves-the-apply-shape-with-the-canonical-literal, stack: repo, date: 2026-10-07, result: allow }
  - { example: apply-husky-patch-gate-stays-silent-for-unrelated-commands, stack: repo, date: 2026-10-07, result: silent }
docs-refresh: deferred — re-verified 2026-10-07, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# apply-husky-patch-gate hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim, including the deliberate unregistered token -->

<!-- getff:begin section=D-card-apply-husky-patch-gate plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `apply-husky-patch-gate` |
| kind | hook |
| ships-to | not installed on any lane (no-lane) |
| description | PreToolUse permission gate for the sanctioned .husky patch channel. |
| source | `.claude/hooks/apply-husky-patch-gate.sh:2` |
| event | `{"absent":"unregistered"}` |
| matcher | `{"absent":"unregistered"}` |
| delivery | `["@cc-only-rationale"]` |
<!-- getff:end section=D-card-apply-husky-patch-gate -->

<!-- vale on -->

## Explanation

Hooks live in `.husky/`, and `.husky/` is the one directory in this repository that agents
cannot write through any ordinary path: the project settings deny `Edit`/`Write` on it, the
user-level git-safety tripwire blocks a direct patch, and the auto-mode classifier refuses
bare override invocations. Those layers are deliberate — `.husky/` is the enforcement layer
of the whole framework. But a refusal with no door is not a policy, it is a dead end: when a
reviewed change to a hook script does need to land, someone has to run the patch script,
and that script's `--apply` form carries a leading environment assignment that permission allow
rules cannot match past. This hook is that door's permission layer.

It reads every Bash call the session is about to make and decides only about two command
shapes: the read-only `--dry-run` check, and the `--apply` form that carries the exact
canonical `GIT_SAFETY_OVERRIDE` literal. Anything else — including an `--apply` with a
different or missing literal — gets no decision at all and falls through to the normal
permission flow. The two approved shapes print an `allow` decision with a reason naming what
was checked, so the approval is legible in the session transcript rather than silent.

Two limits matter. First, approval is not safety: the gate only says "this command shape is
the sanctioned one". The patch script itself re-validates everything load-bearing — the
byte-exact expected file, the `.husky/`-only target, the repo-family pin, the override
literal — and its own 24-arm test suite proves each refusal leaves the target byte-unchanged.
Second, the hook is unregistered at this pin: neither `.claude/settings.json` nor
`.ai-factory/harness-model.json` carries its entry, so today it is dormant. Turning it on is
a one-time operator hand action via `scripts/wire-apply-husky-patch.py`, which registers the
gate, re-renders the hooks file and appends the `--dry-run` allow rule as one reviewed
commit. That registration is deliberately not agent-runnable — it is the approval itself.

Here is the door deciding, with its real output:

```bash
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"bash \"$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh\" --dry-run --patch p.patch --expected e.patch"}}' \
  | bash .claude/hooks/apply-husky-patch-gate.sh
```

```text
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "sanctioned apply-husky-patch.sh dry-run — read-only channel check (operator-approved once via project settings; see CLAUDE.md harness gates)"}}
```

The apply form needs the canonical literal — the same string the git-safety tripwire
independently requires in the command text:

```bash
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"GIT_SAFETY_OVERRIDE='"'"'apply-husky-patch sanctioned channel (operator-approved 2026-10-06)'"'"' bash \"$CLAUDE_PROJECT_DIR/scripts/apply-husky-patch.sh\" --apply --patch p.patch --expected e.patch"}}' \
  | bash .claude/hooks/apply-husky-patch-gate.sh
```

```text
{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "allow", "permissionDecisionReason": "sanctioned apply-husky-patch.sh apply — canonical GIT_SAFETY_OVERRIDE literal present, byte-verified by the script against a tested expected file (operator-approved once via project settings; see CLAUDE.md harness gates)"}}
```

And any other command gets silence, which is the normal permission flow:

```bash
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git status"}}' \
  | bash .claude/hooks/apply-husky-patch-gate.sh
echo "exit=$?"
```

```text
exit=0
```

## Evidence

- `.claude/hooks/apply-husky-patch-gate.sh:2` is the header the card's description row
  quotes: `# apply-husky-patch-gate.sh — PreToolUse permission gate for the sanctioned .husky patch channel.`
- The canonical literal the apply form must carry is one constant,
  `.claude/hooks/apply-husky-patch-gate.sh:23`:
  `CANONICAL_OVERRIDE='apply-husky-patch sanctioned channel (operator-approved 2026-10-06)'`.
  Lines 55 to 90 turn that constant and the script path into a complete single-command
  grammar (`.claude/hooks/apply-husky-patch-gate.sh:61` refuses any shell special
  character or further substitution text, `:69` pins the exact token shape, one mode and
  the required flag pairs), so a literal change in either file makes the approval fail
  loudly rather than match approximately.
- The whole decision surface is that grammar plus the two `allow()` exits: the dry-run
  shape allows with the read-only reason, the apply shape allows with the byte-verified
  reason, and `sys.exit(0)` with no output covers everything else — lines 35 to 44 also
  exit silently for non-PreToolUse events, non-Bash tools and payloads it cannot parse.
- The gate is the permission layer only, by its own header (`.claude/hooks/apply-husky-patch-gate.sh:18`):
  `# The gate is the PERMISSION layer, not the safety layer: the script itself re-validates the`.
  The safety layer's re-validation contract and its refusal arms are enumerated in the
  suite's own header — `scripts/apply-husky-patch.test.sh:12` (arms `P7-P8, P11` prove the
  gate approves the canonical shapes, `P9-P10, P12-P14` that it stays silent otherwise,
  `N11-N25` that a compound suffix gets no allow) and
  `scripts/apply-husky-patch.test.sh:19` (arms `N1-N10` prove the writer leaves the target
  byte-unchanged on every refusal).
- The canonical shapes the gate mirrors are pinned in the patch script's own header,
  `scripts/apply-husky-patch.sh:17`:
  `# Canonical invocations — the gate hook (.claude/hooks/apply-husky-patch-gate.sh) and the allow`.
- Unregistered is measured, not assumed: `grep -c apply-husky-patch-gate .claude/settings.json .ai-factory/harness-model.json`
  prints `0` for both files at this pin. The one-time wiring is the operator script —
  `scripts/wire-apply-husky-patch.py:4`:
  `The ONE reviewed change: register .claude/hooks/apply-husky-patch-gate.sh in`
  (the header text continues: harness-model registration, settings re-render, allow-rule
  append, one reviewed commit).
- The delivery is CC-only by a recorded rationale, not by omission:
  `.claude/hooks/apply-husky-patch-gate.sh:3` carries
  `# @cc-only-rationale: the gate emits CC's PreToolUse hookSpecificOutput.permissionDecision JSON ("allow"); zcode's PreToolUse consumes "deny" only (render-harness-config.mjs emitter note), so on zcode the gate degrades to a silent no-decision and the invocation follows the normal permission flow — a portable twin cannot carry the approval`.
