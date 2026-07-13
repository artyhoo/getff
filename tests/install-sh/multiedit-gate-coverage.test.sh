#!/usr/bin/env bash
# multiedit-gate-coverage.test.sh — every shipped PostToolUse file-edit hook wakes on MultiEdit.
#
# Closes the "MultiEdit slips past an Edit|Write gate" class: Claude Code matches a PostToolUse hook's
# `matcher` against the exact tool_name, and `MultiEdit` is its OWN tool — it does NOT also fire an
# `Edit`/`Write` event. So a hook registered `Edit|Write` never wakes on a MultiEdit, and a batch edit
# that strips a required header (or otherwise violates the hook's rule) silently bypasses the gate.
# Two hooks already carried MultiEdit (check-worker-dispatch-channel, runtime-bridge-dispatch); the
# file-content gates shipped via register_cc_hook were brought to parity and this gate keeps them there.
#
# RULE (precise, false-positive-free): for every `register_cc_hook … "PostToolUse" … "<matcher>"` call
# in the shipped delivery surface (setup.d/*.sh + install.sh), if the matcher lists the `Edit` tool it
# MUST also list `MultiEdit`. Edit and MultiEdit are the paired edit tools — gating on one without the
# other is the blind spot. A matcher of `Write` alone (a deliberate creation-time hook, e.g. a
# /memory/ reminder) lists no `Edit` token and is structurally exempt — no escape hatch needed.
#
# SCOPE: the shipped register_cc_hook surface only (setup.d + install.sh). The framework's own
# .claude/settings.json is agent-deny-listed (maintainer-applied handoff) — asserting on it here would
# false-RED until that patch lands; it is out of this gate's population by construction.
#
# Channel: CI gate (deterministic grep, no network, no paid LLM per .claude/rules/no-paid-llm-in-ci.md).
# A real detection layer, not attention-dependent (.claude/rules/attention-is-not-a-mechanism.md §1).
# Paired-negative arm proves non-vacuity (a real Edit|Write-only gate flips it RED).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SURFACE=("$REPO_ROOT"/setup.d/*.sh "$REPO_ROOT/install.sh")

# last_matcher <register_cc_hook line> → the final double-quoted field (the matcher arg)
last_matcher() { printf '%s' "$1" | grep -oE '"[^"]*"' | tail -1 | tr -d '"'; }

# matcher_violates <matcher> → 0 (true) if it lists Edit but NOT MultiEdit; 1 otherwise.
# Tokenises on `|` so the "MultiEdit contains the substring Edit" trap is avoided.
matcher_violates() {
  local m="$1" tok has_edit=0 has_multiedit=0 IFS='|'
  for tok in $m; do
    [ "$tok" = "Edit" ] && has_edit=1
    [ "$tok" = "MultiEdit" ] && has_multiedit=1
  done
  [ "$has_edit" -eq 1 ] && [ "$has_multiedit" -eq 0 ]
}

# ── Check 1: every shipped PostToolUse edit-hook registration lists MultiEdit ──
violations=""
scanned=0
while IFS= read -r line; do
  case "$line" in *'"PostToolUse"'*) ;; *) continue ;; esac
  scanned=$((scanned+1))
  m=$(last_matcher "$line")
  if matcher_violates "$m"; then
    hook=$(printf '%s' "$line" | grep -oE '/hooks/[a-z0-9-]+\.sh' | head -1)
    violations="$violations\n    → matcher \"$m\"  ($hook)"
  fi
done < <(grep -hE '^[[:space:]]*register_cc_hook' "${SURFACE[@]}")

[ "$scanned" -gt 0 ] || { echo "FATAL: found 0 PostToolUse register_cc_hook calls to scan — grep/glob broke"; exit 1; }

if [ -z "$violations" ]; then
  ok "all $scanned shipped PostToolUse edit-hook registration(s) that list Edit also list MultiEdit"
else
  bad "PostToolUse edit-hook registration(s) list Edit without MultiEdit (batch edits bypass the gate):$(printf '%b' "$violations")"
fi

# ── Check 2 (paired-negative, non-vacuous): a synthetic Edit|Write-only gate MUST flip it RED ──
neg_line='    register_cc_hook "$SETTINGS" "PostToolUse" '"'"'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/zz-fake-gate.sh"'"'"' "zz-fake-gate" "Edit|Write"'
neg_m=$(last_matcher "$neg_line")
if matcher_violates "$neg_m"; then
  ok "neg: a synthetic Edit|Write-only PostToolUse gate is detected as a violation (non-vacuous)"
else
  bad "neg: synthetic Edit|Write-only gate NOT detected → gate is VACUOUS"
fi

# ── Check 3 (paired-negative, no-false-positive): a Write-only matcher MUST NOT be flagged ──
wo_line='    register_cc_hook "$SETTINGS" "PostToolUse" '"'"'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/zz-write-only.sh"'"'"' "zz-write-only" "Write"'
wo_m=$(last_matcher "$wo_line")
if matcher_violates "$wo_m"; then
  bad "neg: a Write-only matcher was flagged → false-positive (deliberate creation hooks would break)"
else
  ok "neg: a Write-only matcher (no Edit token) is correctly NOT flagged (structurally exempt)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
