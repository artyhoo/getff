#!/usr/bin/env bash
# S3 acceptance — Stage 3 twins (inject-project-digest + inject-output-language) emit correctly
# under both CC (plain stdout) and ZCode (strict-JSON {additionalContext:<text>}).
# spec: .claude/orchestrator-prompts/zcode-full-parity-mega-umbrella/kickoff.md §2 Stage 3
#       docs/meta-factory/research-patches/2026-07-18-zcode-parity-step1.md (B1 latent fix)
#
# Asserts:
#   (1) inject-project-digest:
#       (a) CC path: CLAUDE_PROJECT_DIR set + jq present + no ZCODE_PROJECT_DIR → plain stdout
#           matches the digest block from .claude/session-bootstrap.md
#       (b) ZCode path: ZCODE_PROJECT_DIR set → strict JSON {additionalContext:<text>} wrapping
#           the same digest
#       (c) absent digest file → exit 0 with no stdout (zero-setup default)
#       (d) SubagentStart event (CC-only branch) → emits hookSpecificOutput JSON shape
#   (2) inject-output-language:
#       (a) AIF_HOOK_LANG unset → silent (exit 0, no stdout)
#       (b) AIF_HOOK_LANG=ru + CC → plain stdout containing «Address the operator in Russian»
#       (c) AIF_HOOK_LANG=ru + ZCode → strict JSON {additionalContext:<text>} containing same
#       (d) AIF_HOOK_LANG=fr + CC → plain stdout with the language code «fr» interpolated
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PLUGIN="$REPO_ROOT/plugin"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

command -v jq >/dev/null 2>&1 || { echo "jq required for this test"; exit 77; }
command -v python3 >/dev/null 2>&1 || { echo "python3 required for this test"; exit 77; }

# --- fixture: a consumer-like session-bootstrap.md with a digest block -------------
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT
mkdir -p "$TMPD/.claude"
cat >"$TMPD/.claude/session-bootstrap.md" <<'SB'
# Session bootstrap
Some prose.
<!-- digest:start -->
PROJECT-ANCHOR-LINE-1
PROJECT-ANCHOR-LINE-2
<!-- digest:end -->
Footer prose.
SB

# ===== inject-project-digest =====
DIGEST="$PLUGIN/hooks/inject-project-digest"

# (1a) CC plain stdout
OUT=$(env -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$TMPD" \
  bash "$DIGEST" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$OUT" | grep -q 'PROJECT-ANCHOR-LINE-1' \
  && ! printf '%s' "$OUT" | grep -q '"additionalContext"'; then
  ok "(1a) inject-project-digest CC: plain stdout digest"
else
  bad "(1a) inject-project-digest CC path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (1b) ZCode JSON wrap
OUT=$(env ZCODE_PROJECT_DIR="$TMPD" CLAUDE_PROJECT_DIR="$TMPD" \
  bash "$DIGEST" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] \
  && printf '%s' "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["additionalContext"])' 2>/dev/null \
    | grep -q 'PROJECT-ANCHOR-LINE-1'; then
  ok "(1b) inject-project-digest ZCode: {additionalContext:<digest>}"
else
  bad "(1b) inject-project-digest ZCode path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (1c) absent digest file → silent no-op
mkdir -p "$TMPD/empty/.claude"
rm -f "$TMPD/empty/.claude/session-bootstrap.md"
OUT=$(env -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$TMPD/empty" \
  bash "$DIGEST" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && [ -z "$OUT" ]; then
  ok "(1c) inject-project-digest: absent digest → silent exit 0"
else
  bad "(1c) inject-project-digest absent-digest path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (1d) SubagentStart event → hookSpecificOutput JSON
OUT=$(env -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$TMPD" \
  bash -c 'printf "%s" "{\"hook_event_name\":\"SubagentStart\"}" | bash "$0"' "$DIGEST" 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] \
  && printf '%s' "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["hookSpecificOutput"]["additionalContext"])' 2>/dev/null \
    | grep -q 'PROJECT-ANCHOR-LINE-1'; then
  ok "(1d) inject-project-digest SubagentStart: hookSpecificOutput JSON"
else
  bad "(1d) inject-project-digest SubagentStart path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# ===== inject-output-language =====
LANG_HOOK="$PLUGIN/hooks/inject-output-language"

# (2a) AIF_HOOK_LANG unset → silent
OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR bash "$LANG_HOOK" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && [ -z "$OUT" ]; then
  ok "(2a) inject-output-language: en/default → silent"
else
  bad "(2a) inject-output-language default-silent: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (2b) ru + CC → plain stdout
OUT=$(env AIF_HOOK_LANG=ru ZCODE_PROJECT_DIR="" bash "$LANG_HOOK" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$OUT" | grep -q 'Address the operator in Russian' \
  && ! printf '%s' "$OUT" | grep -q '"additionalContext"'; then
  ok "(2b) inject-output-language ru+CC: plain stdout"
else
  bad "(2b) inject-output-language ru+CC path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (2c) ru + ZCode → JSON wrap
OUT=$(env AIF_HOOK_LANG=ru ZCODE_PROJECT_DIR="$TMPD" \
  bash "$LANG_HOOK" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] \
  && printf '%s' "$OUT" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["additionalContext"])' 2>/dev/null \
    | grep -q 'Address the operator in Russian'; then
  ok "(2c) inject-output-language ru+ZCode: {additionalContext:<text>}"
else
  bad "(2c) inject-output-language ru+ZCode path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

# (2d) AIF_HOOK_LANG=fr + CC → plain stdout with «fr» interpolated
OUT=$(env AIF_HOOK_LANG=fr ZCODE_PROJECT_DIR="" bash "$LANG_HOOK" </dev/null 2>/dev/null); rc=$?
if [ "$rc" -eq 0 ] && printf '%s' "$OUT" | grep -q 'AIF_HOOK_LANG=fr'; then
  ok "(2d) inject-output-language fr+CC: language code interpolated"
else
  bad "(2d) inject-output-language fr path: rc=$rc out=$(printf '%s' "$OUT" | head -c 80)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
