#!/usr/bin/env bash
# Paired-negative for .claude/skills/orchestrator/helpers/memory-sweep.sh (orchestrator Phase -1 pre-flight step 0).
#
# Every arm is hermetic: MEMORY_DIR (or HOME, for the derivation arms) points at a mktemp
# dir, so the operator's real memory store is never read. GREEN arms prove a matching entry
# is reported with its description; RED arms prove the sweep refuses to report a clean
# answer it could not ask for (missing store, no keywords) and does not over-match.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
SWEEP="$DIR/../../.claude/skills/orchestrator/helpers/memory-sweep.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/memory-sweep-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
MEM="$TMP/memory"
mkdir -p "$MEM"

fails=0
fail() { echo "FAIL: $1"; sed 's/^/    /' "$TMP/out" "$TMP/err" 2>/dev/null; fails=$((fails + 1)); }

sweep() { MEMORY_DIR="$MEM" bash "$SWEEP" "$@" >"$TMP/out" 2>"$TMP/err"; }

cat >"$MEM/feedback_stop_hook.md" <<'EOF'
---
name: stop-hook-askuserquestion
description: AskUserQuestion must trigger the end-of-turn reminder, never be excluded
metadata:
  type: feedback
---
The Stop hook fires on AskUserQuestion too.
EOF
cat >"$MEM/project_other.md" <<'EOF'
---
name: other
description: unrelated project note
---
Nothing about the reminder here; mentions harvestXts only.
EOF
cat >"$MEM/MEMORY.md" <<'EOF'
- [Stop hook](feedback_stop_hook.md) — AskUserQuestion
EOF
cat >"$MEM/index_hooks.md" <<'EOF'
- [Stop hook](feedback_stop_hook.md) — AskUserQuestion
EOF

# 1. GREEN — a keyword hit reports the file, its description and the match count.
sweep askuserquestion; rc=$?
[ "$rc" -eq 0 ] || fail "hit: expected exit 0, got $rc"
grep -q 'feedback_stop_hook.md — AskUserQuestion must trigger' "$TMP/out" || fail "hit: file + description line missing"
grep -q '^MEMORY-SWEEP: 1 match' "$TMP/out" || fail "hit: summary must count exactly 1 (index files excluded)"

# 2. RED guard — the index files are not memories; they never appear as hits.
grep -q 'MEMORY.md\|index_hooks.md' "$TMP/out" && fail "index: MEMORY.md / index_*.md must be excluded"

# 3. Keywords are fixed strings, not regexes: `harvest.ts` must NOT match `harvestXts`.
sweep harvest.ts; rc=$?
[ "$rc" -eq 0 ] || fail "fixed-string: expected exit 0, got $rc"
grep -q 'project_other.md' "$TMP/out" && fail "fixed-string: '.' was treated as a regex wildcard"
grep -q '^MEMORY-SWEEP: 0 matches' "$TMP/out" || fail "fixed-string: summary must report 0 matches"

# 4. Several keywords are OR-ed.
sweep nonexistent-term reminder; rc=$?
[ "$rc" -eq 0 ] || fail "or: expected exit 0, got $rc"
grep -q '^MEMORY-SWEEP: 2 matches' "$TMP/out" || fail "or: both files mention 'reminder' — expected 2 matches"

# 5. RED — no keywords is a usage error, never an empty «clean» sweep.
sweep; rc=$?
[ "$rc" -eq 64 ] || fail "usage: expected exit 64 with no keywords, got $rc"

# 6. RED — a missing store is INCOMPLETE (exit 2), never «0 matches».
MEMORY_DIR="$TMP/nope" bash "$SWEEP" anything >"$TMP/out" 2>"$TMP/err"; rc=$?
[ "$rc" -eq 2 ] || fail "missing store: expected exit 2, got $rc"
grep -q 'MEMORY-SWEEP-INCOMPLETE' "$TMP/err" || fail "missing store: must print MEMORY-SWEEP-INCOMPLETE"
grep -q '0 matches' "$TMP/out" && fail "missing store: reported a clean 0-match answer"

# 7. Default store derivation — from a LINKED worktree the slug is the PRIMARY checkout's,
#    because Claude Code files memory under the project the session was opened in.
REPO="$TMP/code/my.repo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
git -C "$REPO" worktree add -q "$REPO/.claude/worktrees/wt" -b wt 2>/dev/null
SLUG="$(printf '%s' "$(cd "$REPO" && pwd -P)" | sed 's#[/.]#-#g')"
FAKEHOME="$TMP/home"
mkdir -p "$FAKEHOME/.claude/projects/$SLUG/memory"
cp "$MEM/feedback_stop_hook.md" "$FAKEHOME/.claude/projects/$SLUG/memory/"
(cd "$REPO/.claude/worktrees/wt" && env -u MEMORY_DIR -u CLAUDE_CONFIG_DIR HOME="$FAKEHOME" \
  bash "$SWEEP" AskUserQuestion) >"$TMP/out" 2>"$TMP/err"; rc=$?
[ "$rc" -eq 0 ] || fail "derivation: expected exit 0 from a linked worktree, got $rc"
grep -q '^MEMORY-SWEEP: 1 match' "$TMP/out" || fail "derivation: did not resolve the primary checkout's memory store"

if [ "$fails" -gt 0 ]; then
  echo "memory-sweep.test.sh: $fails failure(s)"; exit 1
fi
echo "memory-sweep.test.sh: all arms passed"
