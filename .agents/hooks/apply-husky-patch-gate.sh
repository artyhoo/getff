#!/usr/bin/env bash
# apply-husky-patch-gate.sh — PreToolUse permission gate for the sanctioned .husky patch channel.
# @cc-only-rationale: the gate emits CC's PreToolUse hookSpecificOutput.permissionDecision JSON ("allow"); zcode's PreToolUse consumes "deny" only (render-harness-config.mjs emitter note), so on zcode the gate degrades to a silent no-decision and the invocation follows the normal permission flow — a portable twin cannot carry the approval
#
# Installed once by the operator in project .claude/settings.json hooks.PreToolUse (matcher
# "Bash"). For each Bash call it decides ONLY about the two canonical apply-husky-patch.sh
# invocation shapes (CLAUDE.md «Harness gates», scripts/apply-husky-patch.sh header); every other
# command exits 0 with no output — no decision, normal permission flow. Approval requires the
# COMPLETE canonical single command (D2070-S01): any compound suffix (`; cmd`, `&&`, `|`,
# newlines), command substitution, redirection, shell metacharacter or unknown flag takes the
# normal permission flow — a prefix/end-anchor match over arbitrary shell text once approved
# `; printf EXTRA` ride-alongs. It APPROVES:
#   1. the dry-run form (no writes, harmless);
#   2. the apply form, which must carry the exact canonical GIT_SAFETY_OVERRIDE literal — the
#      user-level git-safety tripwire (part 1d) independently requires that same literal in the
#      command text to skip its revert, and allow rules cannot match past a leading env
#      assignment (documented), so the hook is the only deterministic approval path for it.
# The gate is the PERMISSION layer, not the safety layer: the script itself re-validates the
# byte-exact expected file, the .husky/-only target, the repo-family pin and the override.
# Precedence note (hooks docs): any deny/ask rule still beats this allow; exit 2 would block.
set -euo pipefail

CANONICAL_OVERRIDE='apply-husky-patch sanctioned channel (operator-approved 2026-10-06)'
SCRIPT_REL='scripts/apply-husky-patch.sh'

# stdin is the hook JSON — read it BEFORE handing python its code via a variable
# (python3 - <<PY would occupy stdin itself and lose the payload).
payload="$(cat)"
py_code="$(cat <<'PY'
import json
import re
import shlex
import sys

canon, script_rel = sys.argv[1], sys.argv[2]
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
if data.get("hook_event_name") != "PreToolUse" or data.get("tool_name") != "Bash":
    sys.exit(0)
cmd = (data.get("tool_input") or {}).get("command") or ""
if not isinstance(cmd, str):
    sys.exit(0)

# D2070-S01: the previous prefix regexes approved compound suffixes (`; <unrelated
# command>` rode along inside the approved Bash call). Approval now requires the
# COMPLETE canonical single command; every other text takes the normal permission
# flow (exit 0, no decision).

env_prefix = "GIT_SAFETY_OVERRIDE='" + canon + "' "
had_override = cmd.startswith(env_prefix)
body = cmd[len(env_prefix):] if had_override else cmd

# Structural pre-filter: with the sanctioned $CLAUDE_PROJECT_DIR variable removed,
# ANY metacharacter or further variable/substitution text means this is not one of
# the two canonical shapes — refused even when quoted (the canonical shapes never
# carry shell syntax, so strictness costs nothing and cannot be smuggled through).
script_var = "$CLAUDE_PROJECT_DIR"
probe = body.replace(script_var, "")
if re.search(r'[;&|<>`()\\\n\r]', probe) or "$" in probe:
    sys.exit(0)

try:
    tokens = shlex.split(body)
except ValueError:
    sys.exit(0)
script_token = script_var + "/" + script_rel
if len(tokens) < 2 or tokens[0] != "bash" or tokens[1] != script_token:
    sys.exit(0)

mode = None
seen = {}
i = 2
while i < len(tokens):
    tok = tokens[i]
    if tok in ("--dry-run", "--apply"):
        if mode is not None:
            sys.exit(0)
        mode = tok
        i += 1
    elif tok in ("--patch", "--expected", "--target", "--repo"):
        if tok in seen or i + 1 >= len(tokens):
            sys.exit(0)
        seen[tok] = tokens[i + 1]
        i += 2
    else:
        sys.exit(0)

if mode is None or "--patch" not in seen or "--expected" not in seen:
    sys.exit(0)
# The canonical override literal belongs to the apply form only (the tripwire
# demands it exactly there); a dry-run carrying it is not a canonical shape.
if had_override != (mode == "--apply"):
    sys.exit(0)

def allow(reason):
    sys.stdout.write(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)

if mode == "--dry-run":
    allow("sanctioned apply-husky-patch.sh dry-run — read-only channel check "
          "(operator-approved once via project settings; see CLAUDE.md harness gates)")
allow("sanctioned apply-husky-patch.sh apply — canonical GIT_SAFETY_OVERRIDE literal present, "
      "byte-verified by the script against a tested expected file "
      "(operator-approved once via project settings; see CLAUDE.md harness gates)")
PY
)"
printf '%s' "$payload" | python3 -c "$py_code" "$CANONICAL_OVERRIDE" "$SCRIPT_REL"
