#!/usr/bin/env bash
# Self-test for probe-hook-stdin.sh — covers every NON-LLM part of the probe with a stub
# `claude` binary (CLAUDE_BIN), so it is hermetic: no network, no model call, no real
# settings touched (no-paid-llm-in-ci.md). The live `claude -p` run itself is session-only by
# design and is exercised by hand, never here.
#
# The stub reads the inline --settings JSON it was given, pulls out the hook command for the
# requested event, and runs it with a synthetic payload on stdin — i.e. it plays the part of
# Claude Code dispatching the hook. Knobs: STUB_FIRES (0/1/2 firings), STUB_EXIT (its own exit).
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$DIR/probe-hook-stdin.sh"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/probe-hook-stdin-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
unset CI GITHUB_ACTIONS

pass=0
fail=0
ok() { pass=$((pass + 1)); echo "  ok   $1"; }
bad() { fail=$((fail + 1)); echo "  FAIL $1"; }

STUB="$TMP/claude-stub"
cat >"$STUB" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" >"$STUB_ARGS"
settings=""
while [ $# -gt 0 ]; do
  if [ "$1" = "--settings" ]; then settings="$2"; shift; fi
  shift
done
cmd=$(printf '%s' "$settings" | jq -r --arg e "$STUB_EVENT" '.hooks[$e][0].hooks[0].command')
i=0
while [ "$i" -lt "${STUB_FIRES:-1}" ]; do
  printf '{"session_id":"s-%s","hook_event_name":"%s","cwd":"/x"}' "$i" "$STUB_EVENT" | bash -c "$cmd"
  i=$((i + 1))
done
exit "${STUB_EXIT:-0}"
EOF
chmod +x "$STUB"
export STUB_ARGS="$TMP/stub-args"

run() { # run <outdir> <args...> — captures stdout+stderr to $TMP/out, exit code to $rc
  local od="$1"; shift
  PROBE_OUT_DIR="$od" CLAUDE_BIN="$STUB" bash "$SCRIPT" "$@" >"$TMP/out" 2>&1
  rc=$?
}

echo "probe-hook-stdin.test.sh"

# 1. no args → usage, exit 2
run "$TMP/o1"
if [ "$rc" -eq 2 ] && grep -q "usage" "$TMP/out"; then ok "no args → exit 2 + usage"; else bad "no args (rc=$rc)"; fi

# 2. malformed event names → exit 2 (the name is spliced into settings JSON and a file path)
for ev in "pre tool" 'Stop;rm' "stop" "Pre-Tool"; do
  run "$TMP/o2" "$ev"
  if [ "$rc" -eq 2 ]; then ok "bad event '$ev' → exit 2"; else bad "bad event '$ev' (rc=$rc)"; fi
done

# 3. CI refusal — a live probe is a model call; it must never run on a CI runner
rm -f "$STUB_ARGS"
CI=true PROBE_OUT_DIR="$TMP/o3" CLAUDE_BIN="$STUB" STUB_EVENT=Stop bash "$SCRIPT" Stop >"$TMP/out" 2>&1
rc=$?
if [ "$rc" -eq 3 ] && grep -q "no-paid-llm-in-ci" "$TMP/out" && [ ! -e "$STUB_ARGS" ]; then
  ok "CI=true → exit 3, claude never invoked"; else bad "CI refusal (rc=$rc)"; fi
rm -f "$STUB_ARGS"
GITHUB_ACTIONS=true PROBE_OUT_DIR="$TMP/o3b" CLAUDE_BIN="$STUB" STUB_EVENT=Stop bash "$SCRIPT" Stop >"$TMP/out" 2>&1
rc=$?
if [ "$rc" -eq 3 ] && [ ! -e "$STUB_ARGS" ]; then ok "GITHUB_ACTIONS=true → exit 3"; else bad "GITHUB_ACTIONS refusal (rc=$rc)"; fi

# 4. --print-settings without matcher: valid JSON, command hook, no matcher key
run "$TMP/o4" --print-settings Stop
if [ "$rc" -eq 0 ] && jq -e '.hooks.Stop[0].hooks[0].type == "command" and (.hooks.Stop[0] | has("matcher") | not)' "$TMP/out" >/dev/null 2>&1; then
  ok "--print-settings Stop → command hook, no matcher"
else bad "--print-settings Stop (rc=$rc): $(cat "$TMP/out")"; fi

# 5. --print-settings with a regex matcher carrying JSON-hostile characters
hostile='Bash|Write "x"'"\\"   # ends in one literal backslash
run "$TMP/o5" --print-settings PreToolUse "$hostile"
if [ "$rc" -eq 0 ] && jq -e '.hooks.PreToolUse[0].matcher == "Bash|Write \"x\"\\"' "$TMP/out" >/dev/null 2>&1; then
  ok "--print-settings PreToolUse matcher is JSON-escaped verbatim"
else bad "--print-settings matcher (rc=$rc): $(cat "$TMP/out")"; fi

# 6. end-to-end with the stub: payload captured byte-for-byte, keys listed, args passed through
export STUB_EVENT=SessionStart
STUB_FIRES=1 run "$TMP/o6" SessionStart -- --worktree probe-x
f6=""
for f in "$TMP/o6"/payload-*.json; do [ -e "$f" ] && f6="$f" && break; done
if [ "$rc" -eq 0 ] && [ -n "$f6" ] \
  && [ "$(cat "$f6")" = '{"session_id":"s-0","hook_event_name":"SessionStart","cwd":"/x"}' ] \
  && grep -q "hook_event_name" "$TMP/out"; then
  ok "stub run → exit 0, payload captured verbatim, keys reported"
else bad "stub run (rc=$rc): $(cat "$TMP/out")"; fi
if grep -qx -- "-p" "$STUB_ARGS" && grep -qx -- "--settings" "$STUB_ARGS" \
  && grep -qx -- "--worktree" "$STUB_ARGS" && grep -qx -- "probe-x" "$STUB_ARGS"; then
  ok "claude got -p, --settings and the passthrough args"; else bad "stub args: $(tr '\n' ' ' <"$STUB_ARGS" 2>/dev/null)"; fi

# 7. event never fires → exit 1
STUB_FIRES=0 run "$TMP/o7" SessionStart
if [ "$rc" -eq 1 ] && grep -qi "did not fire" "$TMP/out"; then ok "no firing → exit 1"; else bad "no firing (rc=$rc)"; fi

# 8. claude binary missing → exit 4
PROBE_OUT_DIR="$TMP/o8" CLAUDE_BIN="$TMP/nope" bash "$SCRIPT" Stop >"$TMP/out" 2>&1
rc=$?
if [ "$rc" -eq 4 ]; then ok "missing claude → exit 4"; else bad "missing claude (rc=$rc)"; fi

# 9. claude exits non-zero AFTER the hook fired (WorktreeCreate with a capture-only hook) →
#    the payload is the deliverable, so exit 0 with a note
STUB_FIRES=1 STUB_EXIT=7 run "$TMP/o9" SessionStart
if [ "$rc" -eq 0 ] && grep -q "exited 7" "$TMP/out"; then ok "claude non-zero after capture → exit 0 + note"; else bad "non-zero claude (rc=$rc): $(cat "$TMP/out")"; fi

# 10. two firings → two distinct payload files
STUB_FIRES=2 run "$TMP/o10" SessionStart
n10=0
for f in "$TMP/o10"/payload-*.json; do [ -e "$f" ] && n10=$((n10 + 1)); done
if [ "$rc" -eq 0 ] && [ "$n10" -eq 2 ]; then ok "two firings → two payload files"; else bad "two firings (rc=$rc, files=$n10)"; fi

# 11. a non-empty pre-existing out dir is refused — stale payloads would read as fresh ones
mkdir -p "$TMP/o11" && echo '{}' >"$TMP/o11/payload-old.json"
run "$TMP/o11" SessionStart
if [ "$rc" -eq 2 ]; then ok "non-empty out dir → exit 2"; else bad "non-empty out dir (rc=$rc)"; fi

echo "probe-hook-stdin.test.sh: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || exit 1
echo "PASS"
