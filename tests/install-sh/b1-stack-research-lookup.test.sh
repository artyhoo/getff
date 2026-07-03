#!/usr/bin/env bash
# b1-stack-research-lookup.test.sh — #827 B1 paired-negative.
#
# Proves setup.d/80-rule-bootstrap.sh looks up the rules-research artefacts by the install's
# $STACK (`<stack>.{research,selection}.json`) rather than the former react-next-only hardcode
# that silently degraded every non-react-next install ("no rules-research artefacts").
#
# Arms (each able to fail; T1/T14 non-vacuity):
#   POS  — STACK=react-native + ONLY react-native.{research,selection}.json present ⇒ the step
#          FINDS them (no "no rules-research artefacts" degrade, reaches the dry-run "would run").
#          FAILS under the old hardcode: it looked for react-next.* (absent) → degraded.
#   REG  — STACK=react-next + react-next.{research,selection}.json present ⇒ still FOUND
#          (the fix does not regress the validated demo stack).
#   NEG  — STACK=react-native + NO artefacts at all ⇒ the degrade STILL fires (proves the
#          "found" assertion is conditional on artefact presence, not unconditional).
#
# The step is SOURCED (its `return` guards require sourcing) under --dry-run so it never runs the
# factory or writes to disk — the lookup + degrade-check happen BEFORE the dry-run guard.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "▶ #827 B1 — 80-rule-bootstrap.sh stack-keyed research lookup"
echo ""

# Run the step in an isolated dispatcher-scope subshell; capture its stdout.
# $1 = STACK ; $2 = consumer PROJECT_ROOT (already seeded with artefacts).
_run_step() {
  local _stack="$1" _proot="$2"
  (
    export PKG_ROOT="$REPO_ROOT"
    export PROJECT_ROOT="$_proot"
    export STACK="$_stack"
    export FULL="1"            # the --full carrier gate
    export DRY_RUN="--dry-run" # never run the factory / write to disk
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/lib.sh" 2>/dev/null || true
    # shellcheck source=/dev/null
    source "$REPO_ROOT/setup.d/80-rule-bootstrap.sh" 2>&1
  ) 2>&1
}

# Minimal valid-enough JSON: the step only checks file PRESENCE before the dry-run guard,
# so placeholder content is sufficient for the lookup assertion.
_seed() {
  local _dir="$1" _stack="$2"
  mkdir -p "$_dir/.ai-factory/rules-research"
  printf '{}\n' > "$_dir/.ai-factory/rules-research/${_stack}.research.json"
  printf '{}\n' > "$_dir/.ai-factory/rules-research/${_stack}.selection.json"
}

# ── POS — react-native artefacts present, react-native install ───────────────
P=$(mktemp -d); printf '{"name":"b1-pos","version":"0.0.0"}\n' > "$P/package.json"
_seed "$P" "react-native"
out=$(_run_step "react-native" "$P")
if echo "$out" | grep -q "no rules-research artefacts"; then
  bad "POS: react-native install degraded despite react-native.{research,selection}.json present (B1 unfixed — hardcoded react-next lookup)"
elif echo "$out" | grep -q "would: run rule-bootstrap LIVE"; then
  ok "POS: react-native artefacts FOUND (stack-keyed lookup reached the LIVE dry-run path)"
else
  bad "POS: unexpected output (neither degrade nor dry-run-would-run): $(echo "$out" | tr '\n' '|' | head -c 200)"
fi

# ── REG — react-next still works ─────────────────────────────────────────────
R=$(mktemp -d); printf '{"name":"b1-reg","version":"0.0.0"}\n' > "$R/package.json"
_seed "$R" "react-next"
out=$(_run_step "react-next" "$R")
if echo "$out" | grep -q "would: run rule-bootstrap LIVE"; then
  ok "REG: react-next artefacts still FOUND (no regression to the validated demo stack)"
else
  bad "REG: react-next lookup broke — $(echo "$out" | tr '\n' '|' | head -c 200)"
fi

# ── NEG — react-native install, NO artefacts ⇒ degrade still fires ───────────
N=$(mktemp -d); printf '{"name":"b1-neg","version":"0.0.0"}\n' > "$N/package.json"
out=$(_run_step "react-native" "$N")
if echo "$out" | grep -q "no rules-research artefacts"; then
  ok "NEG: react-native install with NO artefacts degrades (the FOUND assertion is conditional, not unconditional)"
else
  bad "NEG: degrade did not fire on absent artefacts — $(echo "$out" | tr '\n' '|' | head -c 200)"
fi

# ── control — the OLD hardcode is gone from the source ───────────────────────
if grep -qE '_(plan|sel)="\$_research_dir/react-next\.' "$REPO_ROOT/setup.d/80-rule-bootstrap.sh"; then
  bad "control: setup.d/80-rule-bootstrap.sh still hardcodes react-next.{research,selection}.json"
else
  ok "control: no react-next.{research,selection}.json hardcode remains in 80-rule-bootstrap.sh"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
