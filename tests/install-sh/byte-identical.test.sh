#!/usr/bin/env bash
# tests/install-sh/byte-identical.test.sh — byte-identical gate for install.sh refactor.
#
# Runs SNAPSHOT_MODE=compare for the 4 npm stacks × {greenfield,brownfield} + the python toolchain
# row × {greenfield,brownfield-ruff,brownfield-sgconfig} + the cargo toolchain row ×
# {greenfield,brownfield-clippy} (ecosystem-wiring W4) against the tracked golden baselines at
# tests/install-sh/baselines/<stack>/<mode>.fingerprint.
# FAILS with a diff on any non-empty diff — proving byte-identical behaviour is preserved.
#
# Against the CURRENT monolith it must PASS (sanity check: baseline == itself).
#
# Shellcheck:
#   Pinned version: shellcheck 0.9.0 (or whatever is available — recorded below)
#   Asserts: shellcheck --exclude=SC2034,SC2016,SC2317 setup.d/*.sh install.sh → clean
#   (The setup.d/ glob initially only matches install.sh; grows as layers land.)
#
# CI: invoked from .github/workflows/audit-self.yml (Mechanical checks job).

set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0

ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── Snapshot gate ─────────────────────────────────────────────────────────────
echo "▶ Byte-identical snapshot compare (4 npm stacks × {greenfield,brownfield} + python × 3 cells + cargo × 2 cells)"
echo ""

SNAPSHOT_MODE=compare bash "$REPO_ROOT/tests/install-sh/snapshot.sh" 2>&1 | while IFS= read -r line; do
  echo "  $line"
done
snapshot_rc=${PIPESTATUS[0]}

if [ "${snapshot_rc:-0}" -eq 0 ]; then
  ok "snapshot compare: all 13 combinations byte-identical (8 npm + 3 python + 2 cargo)"
else
  bad "snapshot compare: one or more stacks/modes differ from baseline (see diff above)"
fi

# ── Shellcheck gate ───────────────────────────────────────────────────────────
echo ""
echo "▶ Shellcheck gate"

# Detect shellcheck
SHELLCHECK_BIN=""
if command -v shellcheck >/dev/null 2>&1; then
  SHELLCHECK_BIN="shellcheck"
fi

if [ -z "$SHELLCHECK_BIN" ]; then
  echo "  ⊝ shellcheck not found on PATH — skipping shellcheck gate"
  echo "    (install shellcheck >= 0.9.0 to enable this gate locally)"
else
  # Record pinned version
  SC_VERSION=$("$SHELLCHECK_BIN" --version 2>/dev/null | grep '^version' | awk '{print $2}' || echo "unknown")
  echo "  shellcheck version: $SC_VERSION"

  # Collect files to check: install.sh + any setup.d/*.sh that exist
  SC_FILES=("$REPO_ROOT/install.sh")
  while IFS= read -r -d '' f; do
    SC_FILES+=("$f")
  done < <(find "$REPO_ROOT/setup.d" -name '*.sh' -print0 2>/dev/null | sort -z)

  echo "  Checking ${#SC_FILES[@]} file(s)..."

  SC_OUT=$(
    "$SHELLCHECK_BIN" \
      --shell=bash \
      --severity=warning --exclude=SC2034,SC2016,SC2317 \
      "${SC_FILES[@]}" 2>&1
  ) && SC_RC=0 || SC_RC=$?

  if [ "$SC_RC" -eq 0 ]; then
    ok "shellcheck: ${#SC_FILES[@]} file(s) clean (version $SC_VERSION)"
  else
    bad "shellcheck: found issues (version $SC_VERSION):"
    echo "$SC_OUT" | sed 's/^/    /'
  fi
fi

# ── Final result ──────────────────────────────────────────────────────────────
echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ]
