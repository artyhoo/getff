#!/usr/bin/env bash
# S6 acceptance — plugin twins match declared @plugin-transform output.
# spec: docs/meta-factory/zcode-parity-mega.decisions.md §Meta-fork B + §Fork 4 (2B-standardize)
#       .ai-factory/plans/zcode-parity-s6-twin-generator.md
#
# For each .claude/hooks/<name>.sh that has a plugin/hooks/<name> twin:
#   - manual marker → declared, hand-maintained (no mechanical check beyond marker presence)
#   - sed <expr>    → applying the sed expr to source (minus AUTO-GENERATED header on twin)
#                     produces byte-identical output to the twin
#   - no marker     → source matches twin modulo the twin's AUTO-GENERATED first line
#
# Catches drift / generator bugs / missing markers. Twins without a source (e.g. session-start)
# are skipped (the generator only iterates .claude/hooks/*.sh).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PLUGIN_DIR="$REPO_ROOT/plugin/hooks"
SRC_DIR="$REPO_ROOT/.claude/hooks"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# (1) generator runs cleanly
if bash "$REPO_ROOT/scripts/generate-plugin-twins.sh" >/dev/null 2>&1; then
  ok "generator exits 0"
else
  bad "generator non-zero exit"
fi

# (2) for each source, divergence must be declared
shopt -s nullglob
for src in "$SRC_DIR"/*.sh; do
  name=$(basename "$src" .sh)
  twin="$PLUGIN_DIR/$name"
  # Skip sources with no twin — those are intentionally not twinned (internal-only
  # or have other delivery arrangements). The generator also skips these.
  [ -f "$twin" ] || { ok "$name: no twin (intentionally not twinned)"; continue; }

  # Strip the shebang from source and the shebang + AUTO-GENERATED header from twin,
  # so the comparison is body-vs-body. The generator inserts the AUTO-GENERATED line
  # as line 2 of the twin (after the shebang).
  tail -n +2 "$src" > "$TMP/src.body"
  tail -n +3 "$twin" > "$TMP/twin.body"

  marker=$(grep -E '^# @plugin-transform:' "$src" | head -1 | sed 's/^# @plugin-transform: //' || true)

  case "$marker" in
    manual*)
      # Require a ≥20-char rationale on the same line.
      rationale=${marker#manual}
      if [ ${#rationale} -ge 20 ]; then
        ok "$name: manual (declared, hand-maintained)"
      else
        bad "$name: manual marker lacks ≥20-char rationale"
      fi
      ;;
    sed\ *)
      sed_expr=${marker#sed }
      # Apply same transform to source body (post-shebang), compare against twin body.
      bash -c "sed '$sed_expr' \"\$1\"" _ "$TMP/src.body" > "$TMP/src.transformed"
      if diff -q "$TMP/src.transformed" "$TMP/twin.body" >/dev/null; then
        ok "$name: sed transform matches declared output"
      else
        bad "$name: sed transform diverges from declared marker"
      fi
      ;;
    "")
      if diff -q "$TMP/src.body" "$TMP/twin.body" >/dev/null; then
        ok "$name: byte-identical (no marker needed)"
      else
        bad "$name: divergent without @plugin-transform marker — add marker or fix drift"
      fi
      ;;
    *)
      bad "$name: unknown marker format: $marker"
      ;;
  esac
done

echo "Pass: $PASS  Fail: $FAIL"
exit $((FAIL > 0))
