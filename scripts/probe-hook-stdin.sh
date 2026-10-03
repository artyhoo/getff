#!/usr/bin/env bash
# probe-hook-stdin.sh — capture the REAL stdin payload Claude Code sends a hook event.
#
# WHY: a hook that reads a stdin field the docs do not publish is guessing. PR #279 (the
# WorktreeCreate hook) hit exactly that — the event's input schema was absent from
# code.claude.com/docs/en/hooks — and without a probe it would have shipped a defensive
# fallback chain (`.name // .worktreeName // .worktree_name // …`) that works while masking
# contract drift. A live capture showed `.name` is the one canonical field, so the hook could
# fail loud on a missing key instead. This script is that capture, made repeatable.
#
# HOW: one headless `claude -p` run with an INLINE `--settings` JSON that registers a
# capture-only hook for <EventName>. The hook writes its stdin to a payload file. Nothing
# persistent changes: `.claude/settings.json` is never edited (it is agent-deny-listed, see
# CLAUDE.md), and the inline settings live only for that one invocation.
#
# COST: the live run is a model call on the operator's own Claude Code subscription, so it is
# SESSION-RUN ONLY. On a CI runner (CI / GITHUB_ACTIONS set) the script refuses with exit 3 —
# .claude/rules/no-paid-llm-in-ci.md. Its non-LLM parts are covered hermetically by
# scripts/probe-hook-stdin.test.sh with a stub `claude`.
#
# Usage:
#   scripts/probe-hook-stdin.sh <EventName> [matcher] [-- <extra claude args>]
#   scripts/probe-hook-stdin.sh --print-settings <EventName> [matcher]
#
# Examples:
#   scripts/probe-hook-stdin.sh SessionStart
#   PROBE_PROMPT='Run the shell command `true` with the Bash tool, then stop.' \
#     scripts/probe-hook-stdin.sh PreToolUse Bash -- --allowedTools Bash
#   scripts/probe-hook-stdin.sh WorktreeCreate -- --worktree probe-x
#     (WorktreeCreate expects the hook to print a worktree path; the capture hook prints
#      nothing, so claude fails AFTER the payload is written — that is still a success here.)
#
# Env:
#   PROBE_PROMPT   prompt for the run (default: a one-word reply). Tool events need a prompt
#                  that makes the model call that tool.
#   PROBE_OUT_DIR  where payload-*.json land (default: a fresh mktemp dir). Must be empty or
#                  absent — stale payloads would read as fresh ones.
#   CLAUDE_BIN     the claude binary (default: claude on PATH).
#
# Exit: 0 payload(s) captured · 1 the event did not fire · 2 usage / bad input ·
#       3 refused on CI · 4 claude binary not found.
#
# bash 3.2 compatible (macOS /bin/bash). Needs jq.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

usage() {
  cat >&2 <<'EOF'
usage: probe-hook-stdin.sh <EventName> [matcher] [-- <extra claude args>]
       probe-hook-stdin.sh --print-settings <EventName> [matcher]
EventName is a Claude Code hook event in PascalCase (SessionStart, PreToolUse, WorktreeCreate…).
EOF
  exit 2
}

print_only=0
if [ "${1:-}" = "--print-settings" ]; then print_only=1; shift; fi
[ $# -ge 1 ] || usage
event="$1"; shift
# The name is spliced into a settings key and printed into paths — PascalCase letters only.
case "$event" in
  [A-Z]*) ;;
  *) echo "probe-hook-stdin: bad event name '$event' (PascalCase letters only)" >&2; exit 2 ;;
esac
case "$event" in
  *[!A-Za-z]*) echo "probe-hook-stdin: bad event name '$event' (PascalCase letters only)" >&2; exit 2 ;;
esac

matcher=""
has_matcher=0
if [ $# -ge 1 ] && [ "$1" != "--" ]; then
  # A dash-leading matcher is almost always a claude flag missing its `--`; taking it as the
  # matcher would make the event "not fire" and report a false negative about the runtime.
  case "$1" in
    -*) echo "probe-hook-stdin: matcher '$1' looks like a flag — put claude args after '--'" >&2; exit 2 ;;
  esac
  matcher="$1"; has_matcher=1; shift
fi
if [ $# -ge 1 ] && [ "$1" = "--" ]; then shift; fi
# Remaining "$@" = extra claude args (passthrough).

command -v jq >/dev/null 2>&1 || { echo "probe-hook-stdin: jq is required" >&2; exit 2; }

# build_settings <hook-path> — the inline --settings JSON registering the capture hook.
build_settings() {
  local cmd
  cmd="bash $(printf '%q' "$1")"
  if [ "$has_matcher" -eq 1 ]; then
    jq -cn --arg e "$event" --arg m "$matcher" --arg c "$cmd" \
      '{hooks: {($e): [{matcher: $m, hooks: [{type: "command", command: $c}]}]}}'
  else
    jq -cn --arg e "$event" --arg c "$cmd" \
      '{hooks: {($e): [{hooks: [{type: "command", command: $c}]}]}}'
  fi
}

if [ "$print_only" -eq 1 ]; then
  # Nothing is created: the path is where a live run would write its hook.
  build_settings "${PROBE_OUT_DIR:-<out-dir>}/capture-hook.sh"
  exit 0
fi

# --- live run (session-only) --------------------------------------------------------------
# Refusals come before anything is written, so a refused run leaves no directory behind.
if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "probe-hook-stdin: refusing on CI — a live probe is a model call (.claude/rules/no-paid-llm-in-ci.md). Run it from a session." >&2
  exit 3
fi
claude_bin="${CLAUDE_BIN:-claude}"
if ! command -v "$claude_bin" >/dev/null 2>&1; then
  echo "probe-hook-stdin: claude binary '$claude_bin' not found" >&2
  exit 4
fi

if [ -n "${PROBE_OUT_DIR:-}" ]; then
  out="$PROBE_OUT_DIR"
  if [ -d "$out" ] && [ -n "$(ls -A "$out" 2>/dev/null)" ]; then
    echo "probe-hook-stdin: PROBE_OUT_DIR '$out' is not empty — refusing (stale payloads would read as fresh)" >&2
    exit 2
  fi
  mkdir -p "$out" || exit 2
else
  out="$(mktemp -d "${TMPDIR:-/tmp}/probe-hook-stdin.XXXXXX")" || exit 2
fi
out="$(cd "$out" && pwd)"
hook="$out/capture-hook.sh"
# File names start with a UTC timestamp, so glob order is capture order (to the second; ties
# within one second keep an arbitrary order).
{
  echo '#!/usr/bin/env bash'
  echo '# Capture-only probe hook: stdin → one payload file per firing. Prints nothing.'
  printf 'f=$(mktemp %q/payload-$(date -u +%%Y%%m%%dT%%H%%M%%SZ)-XXXXXX) || exit 0\n' "$out"
  echo 'cat >"$f" && mv "$f" "$f.json"'
  echo 'exit 0'
} >"$hook"
chmod +x "$hook"
settings="$(build_settings "$hook")"

prompt="${PROBE_PROMPT:-Reply with the single word: ok}"
echo "probe-hook-stdin: event=$event${matcher:+ matcher=$matcher} out=$out" >&2
"$claude_bin" -p --no-session-persistence --settings "$settings" "$@" "$prompt" >"$out/claude.log" 2>&1
claude_rc=$?

n=0
first=""
for f in "$out"/payload-*.json; do
  [ -e "$f" ] || continue
  n=$((n + 1))
  [ -n "$first" ] || first="$f"
  echo "payload: $f"
  echo "  keys: $(jq -r 'keys_unsorted | join(", ")' "$f" 2>/dev/null || echo '<not JSON>')"
done

if [ "$n" -eq 0 ]; then
  echo "probe-hook-stdin: $event did not fire (claude exited $claude_rc; log: $out/claude.log)." >&2
  echo "  Tool events need a PROBE_PROMPT that makes the model call the tool, and a matcher that matches it." >&2
  exit 1
fi
if [ "$claude_rc" -ne 0 ]; then
  echo "note: claude exited $claude_rc after the hook fired (expected for events that want hook output, e.g. WorktreeCreate); log: $out/claude.log"
fi
echo "--- earliest payload ($n captured) ---"
jq . "$first" 2>/dev/null || cat "$first"
exit 0
