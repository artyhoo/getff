#!/usr/bin/env bash
# Paired-negative for the `events:` triggers of .claude/rules/coordinator-seat-delegation.md.
#
# The rule reaches a session only through inject-matching-rule.sh's PreToolUse Bash arm, so
# its regexes ARE its channel: a renamed harvest CLI or a typo in a pattern silences the rule
# with every other test still green. FIRE arms pin each pipeline command shape the rule exists
# for; SILENT arms pin the everyday commands it must not tax (every PR session runs them).
# Hermetic: TMPDIR is a mktemp dir (the loader's once-per-session cache lives there) and every
# probe uses its own session id.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
HOOK="$ROOT/.claude/hooks/inject-matching-rule.sh"

command -v jq >/dev/null 2>&1 || { echo "coordinator-seat-card.test.sh: jq is required"; exit 1; }

TMP="$(mktemp -d "${TMPDIR:-/tmp}/seat-card-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

fails=0
n=0
# The counter is bumped by the CALLER: probe runs on the left of a pipe (a subshell), so an
# increment inside it would be lost and every probe would share one session id — the loader's
# once-per-session cache would then silence every probe after the first.
probe() {  # $1 = command, $2 = unique session suffix; prints the loader's output
  jq -nc --arg c "$1" --arg s "seat-card-$$-$2" \
    '{hook_event_name:"PreToolUse",tool_name:"Bash",session_id:$s,tool_input:{command:$c}}' |
    TMPDIR="$TMP" CLAUDE_PROJECT_DIR="$ROOT" bash "$HOOK" 2>/dev/null
}
expect_fire() {
  n=$((n + 1))
  probe "$1" "$n" | grep -q 'coordinator-seat-delegation' || { echo "FAIL: expected the seat card on: $1"; fails=$((fails + 1)); }
}
expect_silent() {
  n=$((n + 1))
  probe "$1" "$n" | grep -q 'coordinator-seat-delegation' && { echo "FAIL: seat card fired on an everyday command: $1"; fails=$((fails + 1)); }
}

expect_fire 'npx tsx packages/runtime-bridge/src/cli/harvest.ts --task 12'
expect_fire 'bash .claude/skills/dispatcher/helpers/harvest-via-api.sh T1'
expect_fire 'bash ~/.claude-coordination/tools/post-harvest.sh wt br none'
expect_fire 'bash ~/.claude-coordination/tools/babysit.sh 1234'
expect_fire 'curl -s localhost:3009/tasks'
expect_fire 'curl -s http://127.0.0.1:3009/tasks/abc'

expect_silent 'gh pr create --base staging --title x'
expect_silent 'git status'
expect_silent 'curl -s localhost:3009/health'
expect_silent 'grep -n harvest docs/notes.md'

if [ "$fails" -gt 0 ]; then
  echo "coordinator-seat-card.test.sh: $fails failure(s)"; exit 1
fi
echo "coordinator-seat-card.test.sh: all arms passed"
