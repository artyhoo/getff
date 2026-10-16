#!/usr/bin/env bash
# packages/preset-next-15-canonical/audit-self/audit-ai-docs.react-next.sh
#
# Code-vs-docs consistency audit for React 19 + Next.js 15 App Router projects.
# Each probe maps EXPLICITLY to a rule from .ai-factory/RULES.react-next.md.
#
# Rule mapping:
#   R12 Server vs Client          → delegated to ESLint
#                                    (no-restricted-globals + rules-as-tests/no-server-imports-in-client)
#   R13 Data fetching             → manual review (TanStack Query usage)
#   R14 Forms                     → delegated to ESLint rule rules-as-tests/require-form-safe-parse
#   R15 Accessibility             → delegated to ESLint (jsx-a11y/no-static-element-interactions)
#   R16 Performance               → delegated to ESLint (@next/next/no-img-element + no-html-link-for-pages)
#   R17 Component tests           → probe_R17  (each component has .stories.tsx)
#   R18 TanStack Query            → manual review
#   R19 Styles                    → delegated to dependency-cruiser (no styled-components)
#   R20 Server Actions            → delegated to ESLint rule rules-as-tests/require-use-server-directive
#                                    (screen.debug() leftovers → ESLint testing-library/no-debugging-utils)
#
# Plus base server-side probes from audit-ai-docs.sh.
#
# --structured-drift-external (kickoff-d0 §3): forwarded verbatim to the single
# nested base call, which then omits its legacy D1/D2 (structured acquisition
# owns them). Exactly one base invocation either way — never a second one.
#
# Exit codes: 0 PASS / WARN, 1 FAIL.

set -uo pipefail

FAIL_COUNT=0
PASS_COUNT=0
WARN_COUNT=0

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

pass() { echo -e "${GREEN}PASS${NC}: $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "${RED}FAIL${NC}: $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "${YELLOW}WARN${NC}: $1"; WARN_COUNT=$((WARN_COUNT + 1)); }

ONLY=""
STRUCTURED_DRIFT_EXTERNAL=0
for arg in "$@"; do
  case "$arg" in
    --only=*) ONLY="${arg#--only=}" ;;
    --structured-drift-external) STRUCTURED_DRIFT_EXTERNAL=1 ;;
  esac
done

skip_unless() {
  [ -z "$ONLY" ] && return 1
  [ "$ONLY" = "$1" ] && return 1
  return 0
}

# Run baseline server-side probes first (R1-R9, D1-D2)
if [ -f scripts/audit-ai-docs.sh ] && [ -z "$ONLY" ]; then
  echo "▶ Running baseline server-side probes (R1-R9, D1-D2)..."
  echo ""
  if [ "$STRUCTURED_DRIFT_EXTERNAL" = "1" ]; then
    bash scripts/audit-ai-docs.sh --structured-drift-external
  else
    bash scripts/audit-ai-docs.sh
  fi
  BASE_EXIT=$?
  echo ""
  if [ "$BASE_EXIT" -ne 0 ]; then
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
  echo "▶ React/Next-specific probes (R12-R20)..."
  echo ""
fi

# R12: delegated to ESLint rules — no-restricted-globals (Server Components)
#      + rules-as-tests/no-server-imports-in-client ('use client' files).
# R14: delegated to ESLint rule rules-as-tests/require-form-safe-parse.
# R15: delegated to ESLint rule jsx-a11y/no-static-element-interactions
# R16a: delegated to ESLint rule @next/next/no-img-element
# R16b: delegated to ESLint rule @next/next/no-html-link-for-pages

# ────────────────────────────────────────────────────────────────────────
# R17 — Component tests: each component has .stories.tsx
# ────────────────────────────────────────────────────────────────────────
if skip_unless R17; then : ; else
  RULE="R17: Each component has matching .stories.tsx"
  # Layout-presence check — without the canonical UI dirs, find matches zero
  # files; an unconditional pass() would be a silent-PASS (the probe checked
  # zero files). Emit WARN (probe could not run) instead. [universalization-fix F2]
  shopt -s nullglob
  ROOTS=()
  [ -d src/shared/ui ] && ROOTS+=(src/shared/ui)
  for d in src/features/*/ui; do [ -d "$d" ] && ROOTS+=("$d"); done
  shopt -u nullglob
  if [ ${#ROOTS[@]} -eq 0 ]; then
    warn "$RULE (skipped: no src/shared/ui or src/features/*/ui — probe could not run)"
  else
    VIOL=""
    for f in $(find "${ROOTS[@]}" -name "*.tsx" 2>/dev/null \
      | grep -v "\\.unit\\.\\|\\.test\\.\\|\\.stories\\.\\|\\.types\\.\\|\\.module\\." \
      | grep -v "/index\\.tsx$" || true); do
      base=${f%.tsx}
      [ -f "${base}.stories.tsx" ] || VIOL="$VIOL"$'\n'"$f → missing ${base}.stories.tsx"
    done

    if [ -z "$VIOL" ]; then
      pass "$RULE"
    else
      warn "$RULE (treat as MAJOR if pre-merge, OK if WIP)"
      echo "$VIOL" | sed 's/^/    /'
    fi
  fi
fi

# R20: delegated to ESLint rule rules-as-tests/require-use-server-directive.
#      screen.debug() leftovers → ESLint testing-library/no-debugging-utils.

# ────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "UI audit complete: $PASS_COUNT PASS, $FAIL_COUNT FAIL, $WARN_COUNT WARN"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
