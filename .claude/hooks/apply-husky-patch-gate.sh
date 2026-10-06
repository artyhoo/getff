#!/usr/bin/env bash
# apply-husky-patch-gate.sh — PreToolUse permission gate for the sanctioned .husky patch channel.
# @cc-only-rationale: the gate emits CC's PreToolUse hookSpecificOutput.permissionDecision JSON ("allow"); zcode's PreToolUse consumes "deny" only (render-harness-config.mjs emitter note), so on zcode the gate degrades to a silent no-decision and the invocation follows the normal permission flow — a portable twin cannot carry the approval
#
# Installed once by the operator in project .claude/settings.json hooks.PreToolUse (matcher
# "Bash"). For each Bash call it decides ONLY about the two canonical apply-husky-patch.sh
# invocation shapes (CLAUDE.md «Harness gates», scripts/apply-husky-patch.sh header); every other
# command exits 0 with no output — no decision, normal permission flow. It APPROVES:
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

dry_re = re.compile(
    r'^bash "\$CLAUDE_PROJECT_DIR/' + re.escape(script_rel) + r'" --dry-run\b'
)
apply_re = re.compile(
    r"^GIT_SAFETY_OVERRIDE='" + re.escape(canon) + r"'"
    r' bash "\$CLAUDE_PROJECT_DIR/' + re.escape(script_rel) + r'" --apply\b'
)

def allow(reason):
    sys.stdout.write(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "allow",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)

if dry_re.match(cmd):
    allow("sanctioned apply-husky-patch.sh dry-run — read-only channel check "
          "(operator-approved once via project settings; see CLAUDE.md harness gates)")
if apply_re.match(cmd):
    allow("sanctioned apply-husky-patch.sh apply — canonical GIT_SAFETY_OVERRIDE literal present, "
          "byte-verified by the script against a tested expected file "
          "(operator-approved once via project settings; see CLAUDE.md harness gates)")
sys.exit(0)
PY
)"
printf '%s' "$payload" | python3 -c "$py_code" "$CANONICAL_OVERRIDE" "$SCRIPT_REL"
