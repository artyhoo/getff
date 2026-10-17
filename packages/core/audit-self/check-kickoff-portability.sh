#!/usr/bin/env bash
# check-kickoff-portability.sh — D5: fail-loud that an IN-FLIGHT umbrella's
# kickoff.md is git-tracked (and therefore portable to another machine/container).
# Cross-session kickoff portability I-phase, SSOT #116.
#
# "Committed only when the author remembers" is a memory-dependent convention —
# the exact thing the project goal forbids ([README.md#why-this-exists]). This
# check makes portability a property verified at the earliest reachable channel
# (pre-push), not a habit.
#
# An umbrella trips the check when ALL of:
#   - .claude/orchestrator-prompts/<u>/kickoff.md exists ON DISK, AND
#   - it is NOT listed by `git ls-files` (untracked → invisible on machine B), AND
#   - the umbrella has NO done.md (i.e. still in-flight; a closed umbrella never trips).
#
# Calibration: warn-only by default (peer to the §1.7 trailer rollout). Set
# KICKOFF_PORTABILITY_WARN_ONLY=false to flip to a hard fail once the back-catalog
# is migrated (PR-2).
#
# No-ops in repos without .claude/orchestrator-prompts (consumers — out of scope).
#
# Seams (tests): REPO_ROOT, KICKOFF_PORTABILITY_WARN_ONLY.
# @cc-only-rationale: pre-push repo-hygiene gate (maintainer repo); no portable
#   equivalent fires at the same moment, and consumers ship no orchestrator-prompts.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
PROMPTS_DIR="${REPO_ROOT}/.claude/orchestrator-prompts"
WARN_ONLY="${KICKOFF_PORTABILITY_WARN_ONLY:-true}"

# Consumer-safe no-op: no orchestrator-prompts surface → nothing to enforce.
[ -d "$PROMPTS_DIR" ] || exit 0

# Tracked kickoffs (single git call). `|| true` keeps set -e happy when grep finds none.
tracked="$(cd "$REPO_ROOT" && git ls-files -- '.claude/orchestrator-prompts/' 2>/dev/null | grep '/kickoff\.md$' || true)"

unportable=""
for dir in "$PROMPTS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  [ -f "${dir}kickoff.md" ] || continue   # on-disk kickoff only
  [ -f "${dir}done.md" ] && continue       # closed umbrella — never trips
  rel=".claude/orchestrator-prompts/${name}/kickoff.md"
  if ! grep -qxF "$rel" <<<"$tracked"; then
    unportable="${unportable}${name}"$'\n'
  fi
done

if [ -z "$unportable" ]; then
  echo "✅ kickoff-portability: all in-flight kickoffs are git-tracked."
  exit 0
fi

echo "⚠ kickoff-portability: in-flight umbrella(s) with an untracked kickoff.md (not portable to another machine):" >&2
printf '%s' "$unportable" | while IFS= read -r u; do
  [ -n "$u" ] && echo "   - ${u}  → git add .claude/orchestrator-prompts/${u}/kickoff.md" >&2
done

if [ "$WARN_ONLY" = "false" ]; then
  echo "❌ kickoff not portable — git add it (calibration window closed; KICKOFF_PORTABILITY_WARN_ONLY=false)." >&2
  exit 1
fi
echo "   (warn-only calibration window — set KICKOFF_PORTABILITY_WARN_ONLY=false to enforce)" >&2
exit 0
