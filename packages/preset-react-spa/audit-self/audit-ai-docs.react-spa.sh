#!/usr/bin/env bash
# packages/preset-react-spa/audit-self/audit-ai-docs.react-spa.sh
#
# Code-vs-docs consistency audit for React 19 SPA (Vite) projects.
# Each probe maps EXPLICITLY to a rule from .ai-factory/RULES.react-spa.md.
#
# Rule mapping:
#   R-SPA-EB Error-boundary presence → delegated to ESLint
#                                       (rules-as-tests/require-error-boundary on appRoot globs)
#   R-SPA-A11Y Accessibility          → delegated to ESLint (jsx-a11y/*)
#   R-SPA-ARCH Architectural bounds   → delegated to eslint-plugin-boundaries + dependency-cruiser
#   R-SPA-HOOKS Rules of Hooks        → delegated to ESLint (react-hooks/rules-of-hooks etc.)
#   R4 Component tests                → probe_R4 (each component has a .unit.tsx or .test.tsx)
#
# NOTE: No R12/R14/R20 probes — Server Components, Server Actions, and 'use server' are
#       NOT applicable to a React SPA (all code runs in the browser).
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
  echo "▶ React SPA-specific probes (R-SPA-EB, R4, config guards)..."
  echo ""
fi

# R-SPA-EB: delegated to ESLint rules-as-tests/require-error-boundary.
#           The rule fires at edit-time on app-root globs.
#           Pre-push audit: verify eslint config wires the rule for appRoot globs.
if skip_unless R-SPA-EB; then : ; else
  RULE="R-SPA-EB: require-error-boundary wired for app-root files in eslint.config.mjs"
  if [ -f eslint.config.mjs ] || [ -f eslint.config.js ]; then
    CONFIG_FILE="eslint.config.mjs"
    [ -f eslint.config.js ] && CONFIG_FILE="eslint.config.js"
    if grep -qE "require-error-boundary" "$CONFIG_FILE" 2>/dev/null; then
      pass "$RULE"
    else
      warn "$RULE (require-error-boundary not found in $CONFIG_FILE — verify appRoot glob config)"
    fi
  else
    warn "$RULE (no eslint.config.mjs found — probe could not run)"
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# R-SPA-HOOKS guard: ensure no doc tells consumers to install
#                    eslint-plugin-react-compiler separately.
#                    Those rules live in eslint-plugin-react-hooks@^6.
# ────────────────────────────────────────────────────────────────────────
if skip_unless R-SPA-HOOKS; then : ; else
  RULE="R-SPA-HOOKS: no docs tell consumers to install eslint-plugin-react-compiler standalone"
  VIOL=$(grep -rn "eslint-plugin-react-compiler" \
    RULES.md RULES.react-spa.md ARCHITECTURE.react-spa.md README.md 2>/dev/null \
    | grep -v "deprecated" | grep -v "merged" | grep -v "RULES.react-spa.md" || true)
  if [ -z "$VIOL" ]; then
    pass "$RULE"
  else
    fail "$RULE (found reference to standalone react-compiler plugin):"
    echo "$VIOL" | sed 's/^/    /'
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# R4 — Component tests: each component file has a paired test
# ────────────────────────────────────────────────────────────────────────
if skip_unless R4; then : ; else
  RULE="R4: Each component has matching .unit.tsx or .test.tsx"
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
      if [ ! -f "${base}.unit.tsx" ] && [ ! -f "${base}.test.tsx" ]; then
        VIOL="$VIOL"$'\n'"$f → missing ${base}.unit.tsx or ${base}.test.tsx"
      fi
    done

    if [ -z "$VIOL" ]; then
      pass "$RULE"
    else
      warn "$RULE (treat as MAJOR if pre-merge, OK if WIP)"
      echo "$VIOL" | sed 's/^/    /'
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# SPA guard: ensure Server Action / 'use server' directives are absent
# (SPA cannot have Server Actions — this would indicate an accidental
#  copy-paste from the Next.js preset)
# ────────────────────────────────────────────────────────────────────────
if skip_unless SPA-GUARD; then : ; else
  RULE="SPA-GUARD: no 'use server' directives in src/ (SPA has no Server Actions)"
  shopt -s nullglob
  if [ -d src ]; then
    VIOL=$(grep -rn "\"use server\"\|'use server'" src/ 2>/dev/null \
      | grep -v "\.test\.\|\.spec\.\|\.stories\." || true)
    if [ -z "$VIOL" ]; then
      pass "$RULE"
    else
      fail "$RULE (SPA should not have 'use server' directives):"
      echo "$VIOL" | sed 's/^/    /'
    fi
  else
    warn "$RULE (no src/ directory — probe could not run)"
  fi
  shopt -u nullglob
fi

# ────────────────────────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────"
echo "React SPA audit complete: $PASS_COUNT PASS, $FAIL_COUNT FAIL, $WARN_COUNT WARN"

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
