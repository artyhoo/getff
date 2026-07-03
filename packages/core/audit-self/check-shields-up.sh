#!/usr/bin/env bash
# check-shields-up.sh — prove installed Husky shields are wired and active.
#
# Asserts:
#   1. git core.hooksPath is configured to '.husky' (husky v8) OR '.husky/_' (husky v9):
#      husky v9's prepare step runs `git config core.hooksPath .husky/_`, so '.husky/_' is the
#      v9-valid value — hooks ARE active via the .husky/_/<hook> wrappers that source ../<hook>.
#   2. .husky/pre-commit exists, is executable, and references 'lint-staged' (the gate command)
#   3. .husky/pre-push exists, is executable, and references the pre-push dispatcher
#
# Behavioural smoke (invoke hook against a bad fixture in a scratch sandbox) is deferred
# as a fast-follow: the gate-wiring check above catches the most common failure mode
# (shields raised but not wired; hooksPath overridden by a subsequent git config call).
#
# SKIP GRACEFULLY when not inside a git repo (e.g. container with no .git) — rc=0.
#
# CONSUMER PATH: scripts/check-shields-up.sh (copied by setup.d/40-configs.sh).
#
# @cc-only-rationale: sourced by install.sh dispatcher and consumer scripts; pure bash,
#   no CC primitives.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─── Resolve project root ──────────────────────────────────────────────────────
if [ -n "${AIF_PROJECT_ROOT:-}" ]; then
  PROJECT_ROOT="$AIF_PROJECT_ROOT"
elif command -v git &>/dev/null && git -C "$SCRIPT_DIR" rev-parse --show-toplevel &>/dev/null 2>&1; then
  PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
elif [ -d "$SCRIPT_DIR/../scripts" ] && [ -d "$SCRIPT_DIR/../node_modules" ]; then
  # Consumer: script lives at PROJECT_ROOT/scripts/check-shields-up.sh
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -d "$SCRIPT_DIR/../../../packages" ]; then
  # Framework: script lives at packages/core/audit-self/check-shields-up.sh
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
else
  PROJECT_ROOT="$(pwd)"
fi

PASS=0; FAIL=0; SKIP=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  · $1"; }

# ─── Must be inside a git repo ───────────────────────────────────────────────
if ! command -v git &>/dev/null; then
  skip "check-shields-up SKIP — git not available"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
fi

if ! git -C "$PROJECT_ROOT" rev-parse --show-toplevel &>/dev/null 2>&1; then
  skip "check-shields-up SKIP — $PROJECT_ROOT is not a git repository (Husky requires git)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"; exit 0
fi

GIT_ROOT="$(git -C "$PROJECT_ROOT" rev-parse --show-toplevel)"

echo "▶ check-shields-up: git root $GIT_ROOT"

# ─── Check 1: core.hooksPath ───────────────────────────────────────────────────
HOOKS_PATH="$(git -C "$GIT_ROOT" config core.hooksPath 2>/dev/null || true)"
if [ -z "$HOOKS_PATH" ]; then
  bad "core.hooksPath not set — Husky hooks are NOT wired (run ./setup or git config core.hooksPath .husky)"
elif [ "$HOOKS_PATH" = ".husky" ] || [ "$HOOKS_PATH" = ".husky/_" ]; then
  ok "core.hooksPath = $HOOKS_PATH — hooks are wired (.husky = husky v8, .husky/_ = husky v9)"
else
  bad "core.hooksPath = '$HOOKS_PATH' (expected '.husky' or '.husky/_') — shields not pointing to the installed hooks"
fi

HUSKY_DIR="$GIT_ROOT/.husky"

# ─── Check 2: .husky/pre-commit ───────────────────────────────────────────────
PRE_COMMIT="$HUSKY_DIR/pre-commit"
if [ ! -f "$PRE_COMMIT" ]; then
  bad "pre-commit hook missing at $PRE_COMMIT — commit-time shield not installed"
elif [ ! -x "$PRE_COMMIT" ]; then
  bad "$PRE_COMMIT exists but is not executable — chmod +x .husky/pre-commit to activate"
elif grep -q 'lint-staged' "$PRE_COMMIT" 2>/dev/null; then
  ok "pre-commit: present, executable, references lint-staged gate — commit shield ACTIVE"
else
  bad "pre-commit: present + executable but does not reference 'lint-staged' — shield content unexpected (check $PRE_COMMIT)"
fi

# ─── Check 3: .husky/pre-push ─────────────────────────────────────────────────
PRE_PUSH="$HUSKY_DIR/pre-push"
if [ ! -f "$PRE_PUSH" ]; then
  bad "pre-push hook missing at $PRE_PUSH — push-time shield not installed"
elif [ ! -x "$PRE_PUSH" ]; then
  bad "$PRE_PUSH exists but is not executable — chmod +x .husky/pre-push to activate"
else
  # The shipped pre-push must reference the TS-core dispatcher (pre-push.ts) or the fallback
  if grep -qE '(pre-push\.ts|pre-push\.fallback\.sh)' "$PRE_PUSH" 2>/dev/null; then
    ok "pre-push: present, executable, references pre-push dispatcher — push shield ACTIVE"
  else
    bad "pre-push: present + executable but does not reference pre-push.ts or pre-push.fallback.sh — shield may be empty stub (check $PRE_PUSH)"
  fi
fi

echo ""
echo "PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
