#!/usr/bin/env bash
# Surface 7 — off-CC there is no .claude/rules auto-load. PORTABLE when the root AGENTS.md
# (portable rule index) exists AND names every .claude/rules/*.md file; DEGRADED otherwise.
# Pure bash, deterministic, zero API calls (per .claude/rules/no-paid-llm-in-ci.md).
set -uo pipefail
# Resolve by path, not `git rev-parse` — GIT_DIR-immune for worktree-push hook env (see ../run-audit.sh).
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
source "$REPO_ROOT/tests/agnosticism/_cc-absent-lib.sh"

RULE_ROOT="$REPO_ROOT/.agents/rules"
[ -d "$RULE_ROOT" ] || RULE_ROOT="$REPO_ROOT/.claude/rules"
n=$(find -L "$RULE_ROOT" -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
INDEX_FILE="$REPO_ROOT/AGENTS.md"

if [ ! -f "$INDEX_FILE" ]; then
  record rules-autoload manual-read-burden "AGENTS.md absent" 1 "DEGRADED:${n}-rules"
  exit 0
fi

missing=0
while IFS= read -r rule; do
  bname=$(basename "$rule")
  grep -qF -- "$bname" "$INDEX_FILE" || missing=$((missing + 1))
done < <(find -L "$RULE_ROOT" -name '*.md' 2>/dev/null | sort)

if [ "$missing" -eq 0 ]; then
  record rules-autoload manual-read-burden "AGENTS.md lists all ${n} rules" 0 "PORTABLE"
else
  record rules-autoload manual-read-burden "AGENTS.md missing ${missing}/${n} rules" 1 "DEGRADED:${n}-rules"
fi
