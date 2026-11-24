#!/usr/bin/env bash
# Regression for register-glossary-hook.sh IDEMPOTENCE (cold-review M2, 2026-09-14).
#
# The dedup probe's jq once placed the entry-array generator INSIDE any() while
# re-addressing `.hooks` on the already-projected array — jq errored on every input, the
# probe always reported "not present", and every rerun appended a DUPLICATE
# hooks.UserPromptSubmit entry (N reruns → N identical entries → CC executes the hook N
# times per prompt: duplicate injected lines, double-speed threshold crossing). The header
# claimed "IDEMPOTENT" the whole time — the probe bug made it a lie.
#
# This test drives the REAL script end-to-end against a fake HOME twice and asserts the
# entry count is 1 after BOTH runs, the .bak backup exists, and the rerun takes the
# already-registered branch. It also pins both entry shapes the script must recognize
# (nested user-settings shape + flat SSOT shape) at the probe level via the same jq
# filter the script ships, so a shape regression cannot pass silently.
#
# CI: invoked from .github/workflows/audit-self.yml.

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
REGISTER="$REPO_ROOT/scripts/register-glossary-hook.sh"
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAKE_HOME="$TMP/home"
mkdir -p "$FAKE_HOME/.claude"
# A realistic pre-existing user file: settings the register must NOT clobber.
printf '{"theme":"dark","hooks":{"Stop":[{"hooks":[{"type":"command","command":"echo preexisting"}]}]}}' \
  > "$FAKE_HOME/.claude/settings.json"

# The command the script bakes is an ABSOLUTE path — derive it the same way the script does.
REAL_CMD="bash \"$REPO_ROOT/.claude/hooks/glossary-inject.sh\""
count_entries() { # count UserPromptSubmit entries naming the glossary command, both shapes
  jq --arg c "$2" '[
    .hooks.UserPromptSubmit[]? | .. | objects | select(.command? == $c)
  ] | length' "$1" 2>/dev/null
}

# ── run 1: registers ─────────────────────────────────────────────────────────
out1="$(HOME="$FAKE_HOME" bash "$REGISTER" 2>&1)"
rc1=$?
if [ "$rc1" -eq 0 ]; then ok "run 1 exits 0"; else bad "run 1 exits 0 (rc=$rc1)"; fi
n1="$(count_entries "$FAKE_HOME/.claude/settings.json" "$REAL_CMD")"
if [ "$n1" = "1" ]; then ok "run 1 leaves exactly 1 glossary entry"; else bad "run 1 leaves exactly 1 glossary entry (got $n1)"; fi
if [ -f "$FAKE_HOME/.claude/settings.json.bak" ]; then ok "run 1 leaves the .bak backup"; else bad "run 1 leaves the .bak backup"; fi
if jq -e '.theme == "dark" and (.hooks.Stop | length == 1)' "$FAKE_HOME/.claude/settings.json" >/dev/null; then
  ok "pre-existing settings survive the write"
else
  bad "pre-existing settings survive the write"
fi

# ── run 2: the idempotence arm (THE regression — was: rc 0 + a second entry) ──
out2="$(HOME="$FAKE_HOME" bash "$REGISTER" 2>&1)"
rc2=$?
if [ "$rc2" -eq 0 ]; then ok "run 2 exits 0"; else bad "run 2 exits 0 (rc=$rc2)"; fi
n2="$(count_entries "$FAKE_HOME/.claude/settings.json" "$REAL_CMD")"
if [ "$n2" = "1" ]; then ok "run 2 still leaves exactly 1 entry (was: N duplicates)"; else bad "run 2 still leaves exactly 1 entry (got $n2)"; fi
if printf '%s' "$out2" | grep -q "already registered"; then
  ok "run 2 reports already-registered"
else
  bad "run 2 reports already-registered"
fi

# ── probe shape-matrix: the shipped filter must recognize BOTH entry shapes ──
# The filter is the single-quoted jq program on the probe's invocation line; field 2 of
# that line (split on ') is exactly the program, without the surrounding shell syntax.
FILTER="$(awk -F"'" '/jq -e --arg c "\$2"/ {print $2; exit}' "$REGISTER")"
if [ -n "$FILTER" ]; then
  nested='{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"X"}]}]}}'
  flat='{"hooks":{"UserPromptSubmit":[{"command":"X"}]}}'
  absent='{"hooks":{"UserPromptSubmit":[{"command":"other"}]}}'
  none='{}'
  if echo "$nested" | jq -e --arg c "X" "$FILTER" >/dev/null 2>&1; then
    ok "probe recognizes the nested user-settings shape"
  else
    bad "probe recognizes the nested user-settings shape"
  fi
  if echo "$flat" | jq -e --arg c "X" "$FILTER" >/dev/null 2>&1; then
    ok "probe recognizes the flat SSOT shape"
  else
    bad "probe recognizes the flat SSOT shape"
  fi
  if ! echo "$absent" | jq -e --arg c "X" "$FILTER" >/dev/null 2>&1; then
    ok "probe rejects a non-matching entry"
  else
    bad "probe must reject a non-matching entry"
  fi
  if ! echo "$none" | jq -e --arg c "X" "$FILTER" >/dev/null 2>&1; then
    ok "probe rejects a file with no hooks key"
  else
    bad "probe must reject a file with no hooks key"
  fi
else
  bad "probe filter not found in register-glossary-hook.sh"
fi

echo "----------------------------------------"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
