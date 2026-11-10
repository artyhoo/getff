#!/usr/bin/env bash
# check-husky-presence.sh — Structural presence/marker check only; does not execute or certify hook semantics.
# Optional hook directory allows the same production checker to inspect disposable fixtures.
set -euo pipefail

HOOK_DIR="${1:-.husky}"
for hook in "$HOOK_DIR/pre-commit" "$HOOK_DIR/pre-push"; do
  test -f "$hook" || { echo "::error::missing $hook"; exit 1; }
  test -x "$hook" || { echo "::error::$hook not executable"; exit 1; }
  # non-empty + non-trivial (not just exit 0). Wave 10.1: the pre-push
  # hook may delegate its probes to the TS orchestrator
  # (packages/core/hooks/pre-push.ts) rather than inline them, so the
  # dispatch reference counts as non-trivial too.
  grep -qE '\b(actionlint|zizmor|bash -n|json\.load|yaml\.safe_load)\b|packages/core/hooks/pre-push\.ts' "$hook" \
    || { echo "::error::$hook lacks expected probes (looks empty/stub)"; exit 1; }
done
echo "✓ .husky/ hooks present, executable, non-trivial"
