#!/usr/bin/env bash
# imr-registration.test.sh — register_imr_hooks (setup.d/lib.sh) wires inject-matching-rule's
# three arms and WIDENS an install made before them (trigger build, slice 1).
#
# Before slice 1 an install registered the hook once, PostToolUse "Edit|Write|MultiEdit".
# register_cc_hook is add-only and idempotent per event, so a re-install alone would keep that
# matcher and the Read arm would never fire. Contract pinned here (jq back-end):
#   W1 legacy install: our PostToolUse entry is replaced by one with "…|Read"; exactly one of ours
#      remains on PostToolUse; the consumer's own PostToolUse handlers stay
#   W2 PreToolUse "Bash" and SessionStart "compact" are registered
#   W3 a second run is byte-identical (idempotent)
#   W4 a fresh project (no settings file) gets all three
#   W5 a matcher of ours that already names Read (here with a consumer's extra tool) is left as is
# shellcheck disable=SC2015,SC2016  # ok/bad pairs never fail; the $CLAUDE_PROJECT_DIR commands are literal by design
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

command -v jq >/dev/null 2>&1 || { echo "SKIP: jq not on PATH (the widening is jq-only by design)"; exit 0; }

IMR='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"'
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

ours() { # settings event → the matchers of our entries on that event, one JSON array
  jq -c --arg e "$2" '[(.hooks[$e] // [])[] | select(any(.hooks[]?; .command | test("inject-matching-rule\\.sh"))) | .matcher]' "$1"
}

echo "── W1-W3: legacy install is widened, idempotently ──"
jq -n --arg c "$IMR" '{hooks: {PostToolUse: [
  {matcher: "Edit|Write", hooks: [{type: "command", command: "consumer-own.sh"}]},
  {matcher: "Edit|Write|MultiEdit", hooks: [{type: "command", command: $c}]}
]}}' > "$T/legacy.json"
register_imr_hooks "$T/legacy.json" >/dev/null
[ "$(ours "$T/legacy.json" PostToolUse)" = '["Edit|Write|MultiEdit|Read"]' ] \
  && ok "W1: one PostToolUse entry of ours, matcher Edit|Write|MultiEdit|Read" \
  || bad "W1: ours on PostToolUse = $(ours "$T/legacy.json" PostToolUse)"
[ "$(jq -c '[.hooks.PostToolUse[].hooks[].command | select(. == "consumer-own.sh")] | length' "$T/legacy.json")" = 1 ] \
  && ok "W1: the consumer's own PostToolUse handler stays" || bad "W1: consumer handler lost"
[ "$(ours "$T/legacy.json" PreToolUse)" = '["Bash"]' ] && [ "$(ours "$T/legacy.json" SessionStart)" = '["compact"]' ] \
  && ok "W2: PreToolUse:Bash + SessionStart:compact registered" \
  || bad "W2: PreToolUse $(ours "$T/legacy.json" PreToolUse), SessionStart $(ours "$T/legacy.json" SessionStart)"
cp "$T/legacy.json" "$T/once.json"
register_imr_hooks "$T/legacy.json" >/dev/null
cmp -s "$T/once.json" "$T/legacy.json" && ok "W3: second run byte-identical" || bad "W3: second run changed the file"

echo "── W4: fresh project ──"
register_imr_hooks "$T/fresh.json" >/dev/null
[ "$(ours "$T/fresh.json" PostToolUse)" = '["Edit|Write|MultiEdit|Read"]' ] \
  && [ "$(ours "$T/fresh.json" PreToolUse)" = '["Bash"]' ] && [ "$(ours "$T/fresh.json" SessionStart)" = '["compact"]' ] \
  && ok "W4: all three registered" || bad "W4: $(jq -c .hooks "$T/fresh.json")"

echo "── W5: a matcher of ours that already names Read is kept ──"
jq -n --arg c "$IMR" '{hooks: {PostToolUse: [
  {matcher: "Edit|Write|MultiEdit|Read|NotebookEdit", hooks: [{type: "command", command: $c}]}
]}}' > "$T/wide.json"
register_imr_hooks "$T/wide.json" >/dev/null
[ "$(ours "$T/wide.json" PostToolUse)" = '["Edit|Write|MultiEdit|Read|NotebookEdit"]' ] \
  && ok "W5: consumer-widened matcher untouched" || bad "W5: ours on PostToolUse = $(ours "$T/wide.json" PostToolUse)"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
