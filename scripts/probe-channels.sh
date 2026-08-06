#!/usr/bin/env bash
# Per-rule deterministic channel report for ai-doc-audit C1-Audit.
# For each .claude/rules/*.md reports the activation artefacts that ACTUALLY exist on disk
# (not what a header claims): a principle-test referencing the rule slug, a PostToolUse hook
# wired in settings.json, a `<!-- globs: -->` marker, a `paths:` frontmatter field.
# Session-only probes (does inject-matching-rule.sh FIRE; does paths: LOAD at read-time)
# CANNOT be settled in bash → emitted as INCONCLUSIVE for a live-session probe.
# spec: §Verify-don't-trust ; reconciliation tier assignment is downstream judgment.
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1
SETTINGS=".claude/settings.json"

for rule in .claude/rules/*.md; do
  slug="$(basename "$rule" .md)"
  # gate = a principle test naming this slug (the real test, on disk)
  if grep -rql -- "$slug" packages/core/principles/*.test.ts 2>/dev/null; then gate=yes; else gate=no; fi
  # globs/paths markers present?
  grep -q '^<!-- globs:' "$rule" && globs=yes || globs=no
  grep -qE '^paths:' "$rule" && paths=yes || paths=no
  echo "$slug gate=$gate globs=$globs paths=$paths inject-fire=INCONCLUSIVE-needs-live-probe"
done
# Hook wiring (deterministic): is inject-matching-rule wired at all?
if grep -q 'inject-matching-rule.sh' "$SETTINGS" 2>/dev/null; then
  echo "_hook inject-matching-rule=wired-in-settings (FIRING still needs live probe)"
else
  echo "_hook inject-matching-rule=NOT-wired"
fi
