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

# (3) agents population — deliberately NOT checked against the real tree here, and this
# absence is measured rather than lazy. Arm (1) above runs the generator on the REAL tree,
# and the generator now re-syncs agent twins, so an in-tree byte-identity arm placed after
# it can never fail: seeding drift into agents/review-sidecar.md and running this file
# reports "byte-identical" and silently repairs the tree (verified 2026-08-17). Such an arm
# would be decoration — the shape of a check with no failing input.
#
# Real-tree drift detection for this population lives where it can actually fail, in CI:
# packages/core/principles/24-plugin-manifest-integrity.test.ts (d). It caught a live drift
# in PR #1430. This file's job is the GENERATOR, exercised below against a sandbox tree.
# Do not "restore" an in-tree arm here without first moving it above arm (1).

# (4) generator contract, end-to-end in a sandbox: the agents arm re-syncs drift and never
# invents a twin. CLAUDE_PROJECT_DIR keeps the real tree untouched — and a sandbox (rather
# than a predicate-only negative) is what proves the population is actually wired in.
SANDBOX="$TMP/sandbox"
mkdir -p "$SANDBOX/.claude/hooks" "$SANDBOX/plugin/hooks" "$SANDBOX/agents" "$SANDBOX/plugin/agents"
printf -- '---\nname: drifted\n---\n\nSOURCE version\n' > "$SANDBOX/agents/drifted.md"
printf -- '---\nname: drifted\n---\n\nSTALE twin version\n' > "$SANDBOX/plugin/agents/drifted.md"
printf -- '---\nname: untwinned\n---\n\nno twin exists for me\n' > "$SANDBOX/agents/untwinned.md"

if CLAUDE_PROJECT_DIR="$SANDBOX" bash "$REPO_ROOT/scripts/generate-plugin-twins.sh" >/dev/null 2>&1; then
  if cmp -s "$SANDBOX/agents/drifted.md" "$SANDBOX/plugin/agents/drifted.md"; then
    ok "sandbox: drifted agent twin re-synced to byte-identical"
  else
    bad "sandbox: drifted agent twin NOT re-synced (agents arm is a no-op)"
  fi
  if [ -f "$SANDBOX/plugin/agents/untwinned.md" ]; then
    bad "sandbox: generator invented a twin for an intentionally-untwinned agent"
  else
    ok "sandbox: untwinned agent left alone (no twin invented)"
  fi
else
  bad "sandbox: generator failed on a minimal tree"
fi

echo "Pass: $PASS  Fail: $FAIL"
exit $((FAIL > 0))
