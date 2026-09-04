#!/usr/bin/env bash
# @cc-only-rationale: CC-specific context-injection hook — its output is consumed by CC-native
#   fire-points (UserPromptSubmit stdout auto-injection + SubagentStart additionalContext), with no
#   portable counterpart. SHIPPED to consumer CC projects (GH #934 batch D): the PROJECT-AGNOSTIC
#   adaptation of the maintainer-only inject-session-bootstrap.sh / inject-subagent-digest.sh pair
#   (which hard-code the FRAMEWORK's own goal/invariants digest — wrong to inject into a consumer's
#   project). This version injects the CONSUMER's OWN anchor: the digest block of THEIR
#   .claude/session-bootstrap.md. Consumer-safe: reads only the consumer's own file, zero-setup
#   default (empty/absent block → injects nothing), degrades without jq.
#
# One hook, two events (registered on both — output format differs per the CC contract):
#   • UserPromptSubmit  → plain stdout is auto-injected into the prompt context.
#   • SubagentStart     → context must be JSON hookSpecificOutput.additionalContext (needs jq).
# The shared digest source is the block between the markers in .claude/session-bootstrap.md, so the
# main session AND every dispatched subagent get the same project anchor from ONE source of truth.
set -uo pipefail

# @plugin-transform: manual — plugin twin carries inline _is_zcode/_emit_ctx adapter trio + TWIN DIVERGENCE comment block. Source-side trio migration is follow-up Stage 6.5.
# B1 fix (zcode-parity-step1, plan-v3 §"B1"): subshell-aware env-first resolution.
# `$(cd … && pwd)` is command substitution in a SUBSHELL — cwd change is discarded, only
# the path string is captured. Pre-fix this read $0-relative (correct only when the hook is
# copied INTO the consumer repo by install.sh at .claude/hooks/depth-2); as a plugin-twin
# payload file ($0 = ${CLAUDE_PLUGIN_ROOT}/hooks/), the $0-relative path resolved to the
# plugin payload dir, NOT the consumer root. Env-first matches the 7 already-fixed plugin
# twins (check-doc-authority:18, validate-prompt:19, etc — verified Mode A) + deps-hash-check
# cd-guard form. Source-level fix prepares for future plugin-channel shipping (declared
# follow-up umbrella — the twin is NOT shipped in this umbrella).
REPO_ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
DIGEST_FILE="$REPO_ROOT/.claude/session-bootstrap.md"
[ -f "$DIGEST_FILE" ] || exit 0   # no anchor authored — nothing to inject (zero-setup default)

INPUT="$(cat 2>/dev/null || true)"

# Extract the content between the digest markers (awk, no jq — works even without jq for the
# UserPromptSubmit path). Markers must be on their own lines.
BLOCK="$(awk '/<!--[[:space:]]*digest:start[[:space:]]*-->/{f=1;next} /<!--[[:space:]]*digest:end[[:space:]]*-->/{f=0} f' "$DIGEST_FILE" 2>/dev/null || true)"
# No-op when the block is empty / whitespace-only (the shipped template ships empty on purpose).
[ -z "$(printf '%s' "$BLOCK" | tr -d '[:space:]')" ] && exit 0

# Detect the firing event (jq if available; absent → treat as the plain-stdout path).
EVENT=""
if command -v jq >/dev/null 2>&1; then
  EVENT="$(printf '%s' "$INPUT" | jq -r '.hook_event_name // ""' 2>/dev/null || true)"
fi

if [ "$EVENT" = "SubagentStart" ]; then
  # SubagentStart: plain stdout is a silent no-op — must emit JSON additionalContext (jq required;
  # if jq were absent EVENT would be "" and we would not reach here).
  jq -n --arg ctx "$BLOCK" '{hookSpecificOutput:{hookEventName:"SubagentStart",additionalContext:$ctx}}'
else
  # UserPromptSubmit (or jq-absent fallback): plain stdout is auto-injected.
  printf '%s\n' "$BLOCK"
fi
exit 0
