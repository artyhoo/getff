#!/usr/bin/env bash
# scripts/getff-work.sh — `getff work <name>` workspace one-command (spec A9).
#
# Composes:
#   1. Worktree creation (REUSE scripts/create-worktree.sh — do NOT rewrite).
#   2. Dep wiring (detect package manager, run install in worktree).
#   3. Per-detected-harness session start (launch-vs-print matrix — kickoff §4.4
#      + §8a Park-4 + spec A9 binding; R8 documented 2026-08-08):
#        | environment                                   | action                     |
#        |-----------------------------------------------|----------------------------|
#        | inside a live CC session                      | PRINT `claude -w <name>`   |
#        |   (CLAUDE_CODE_SESSION_ID set)                | (DEFER to native — never   |
#        |                                               |  wrap; §8a Park-4 binding) |
#        | outside CC, interactive TTY                   | LAUNCH the session         |
#        |   (spec A9 allows launch or exact printed     | (or print exact command —  |
#        |    command; §8a says launches)                |  TTY-qualifier additive)   |
#        | outside CC, non-TTY (CI / agents)             | PRINT the exact command    |
#        |   (kickoff §4.4 — never launch)               | (never launch)             |
#   4. Flag-first / non-TTY prints instead of launching. `--no-launch` always
#      prints (AI DX — agents can capture stdout).
#
# Usage:
#   bash scripts/getff-work.sh <name> [--no-launch]
#   scripts/getff-work.sh <name>                    # TTY: print next command
#   scripts/getff-work.sh <name> --no-launch        # force print
#
# Binding: docs/superpowers/specs/2026-07-23-beta-program-design.md §4 A9.
# Profile: ships in env+ (setup.d/85-worktree-scripts.sh).

set -euo pipefail

# ─── Args ──────────────────────────────────────────────
NAME=""
NO_LAUNCH=0
# Why the reason is tracked and printed: print-only is reachable two ways — the explicit flag and
# the non-TTY auto-enable below — and they used to be indistinguishable in the output. A test can
# only ever run non-TTY, so an assertion on the print-only line held whether or not the flag arm
# below worked, and a broken `--no-launch` (ignored in a real operator TTY) shipped green.
NO_LAUNCH_REASON=""
for arg in "$@"; do
  case "$arg" in
    --no-launch) NO_LAUNCH=1; NO_LAUNCH_REASON="flag" ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    --*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *)
      if [ -z "$NAME" ]; then
        NAME="$arg"
      else
        echo "unexpected positional arg: $arg (only NAME expected)" >&2
        exit 2
      fi
      ;;
  esac
done

if [ -z "$NAME" ]; then
  echo "usage: bash scripts/getff-work.sh <name> [--no-launch]" >&2
  exit 2
fi

# Auto-enable --no-launch in non-TTY contexts (CI, agents, pipes). Per §4.4,
# non-TTY prints; TTY may launch (we still print by default for safety —
# launching an interactive session from a shell script risks hangs and env
# contamination; the operator runs the printed command).
if [ ! -t 0 ] && [ ! -t 1 ]; then
  NO_LAUNCH=1
  if [ -z "$NO_LAUNCH_REASON" ]; then NO_LAUNCH_REASON="non-tty"; fi
fi

# ─── Locate scripts/create-worktree.sh ─────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREATE_WORKTREE="$SCRIPT_DIR/create-worktree.sh"
if [ ! -x "$CREATE_WORKTREE" ]; then
  if [ ! -f "$CREATE_WORKTREE" ]; then
    echo "✗ scripts/create-worktree.sh missing — expected at $CREATE_WORKTREE" >&2
    echo "  Was setup.d/85-worktree-scripts.sh run? (env+ profile)" >&2
  else
    echo "✗ scripts/create-worktree.sh not executable: $CREATE_WORKTREE" >&2
  fi
  exit 1
fi

# ─── Step 1: worktree creation (REUSE) ─────────────────
echo "▶ Creating worktree '$NAME' via scripts/create-worktree.sh"
WORKTREE_PATH="$("$CREATE_WORKTREE" "$NAME")" || {
  echo "✗ create-worktree.sh failed (exit $?) for name '$NAME'" >&2
  exit 1
}
echo "  ✓ worktree at: $WORKTREE_PATH"

# ─── Step 2: dep wiring (detect package manager) ───────
PKG_MANAGER=""
INSTALL_CMD=""
if   [ -f "$WORKTREE_PATH/pnpm-lock.yaml" ]; then
  PKG_MANAGER="pnpm"; INSTALL_CMD=(pnpm install --frozen-lockfile)
elif [ -f "$WORKTREE_PATH/yarn.lock" ]; then
  PKG_MANAGER="yarn"; INSTALL_CMD=(yarn install --frozen-lockfile)
elif [ -f "$WORKTREE_PATH/package-lock.json" ]; then
  PKG_MANAGER="npm";  INSTALL_CMD=(npm ci)
elif [ -f "$WORKTREE_PATH/package.json" ]; then
  PKG_MANAGER="npm";  INSTALL_CMD=(npm install)
fi

# Never install THROUGH a delivery symlink. create-worktree.sh provisions
# `$WORKTREE_PATH/node_modules` as a symlink to the PRIMARY checkout's tree
# (scripts/worktree-node-modules.sh:131 — the D2 workspace optimisation), so an
# install run here writes into the primary: npm reifies against the worktree's own
# lock and PRUNES every package outside that closure from the primary's real
# node_modules, emptying `node_modules/.bin` on the way. The sibling guard in
# create-worktree.sh:108-111 already states this rule for packages/core; this is the
# same rule at the root level, where the blast radius is the whole tree.
#
# Incident 2026-08-16: this is what reddened `staging` at fa8da9406c. The hooks
# suite runs `getff-work.sh` against the REAL repo (getff-work.test.ts header,
# "the three worktree-creating cases run against the REAL repo"), so step 2 deleted
# the repo's own node_modules mid-run — 673 of 835 packages, `.bin` emptied — and
# every later vitest child died on
# `Cannot find module '<root>/node_modules/vitest/suppress-warnings.cjs'`:
# 972/972 tests passing, 25 unhandled errors, exit 1.
#
# Skipping is correct, not a degradation: the symlink IS the delivery. The deps are
# already present through it, which is the whole point of the optimisation.
if [ -n "$PKG_MANAGER" ] && [ -L "$WORKTREE_PATH/node_modules" ]; then
  echo "  ⊝ node_modules is a delivery symlink into the primary checkout — skipping $PKG_MANAGER install"
  echo "    (installing here would reify the PRIMARY's tree through the link and prune it)"
  PKG_MANAGER=""
fi

if [ -n "$PKG_MANAGER" ]; then
  echo "▶ Dep wiring: $PKG_MANAGER (detected lockfile in worktree)"
  if ! (cd "$WORKTREE_PATH" && "${INSTALL_CMD[@]}" >/dev/null 2>&1); then
    echo "  ⚠ $PKG_MANAGER install failed — run manually in $WORKTREE_PATH" >&2
  else
    echo "  ✓ $PKG_MANAGER deps installed"
  fi
else
  echo "  ⊝ no package.json / lockfile in worktree — skipping dep wiring"
fi

# ─── Step 3: per-detected-harness session start ─────────
# CC detection (§8a Park-4): CLAUDE_CODE_SESSION_ID is set by CC when it
# launches a subprocess from a session. If present, this script is being
# invoked FROM a CC session — we DEFER to the native CC worktree flow and
# DO NOT launch another CC instance (operator resolution 2026-07-23 binding:
# CC has its own worktree UX; double-launching is a MISS, not a neutral
# fallback).
if [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  cat <<EOF
  ℹ Claude Code session detected (CLAUDE_CODE_SESSION_ID set).
    Per operator resolution 2026-07-23 (§8a Park-4), the wrapper DEFERS to
    the native CC worktree flow. To start a CC session in the new worktree:
      cd $WORKTREE_PATH && claude -w $NAME
    (Or use the CC desktop app's worktree UX.)
EOF
  echo
  echo "✓ done (CC deferral). worktree=$WORKTREE_PATH"
  exit 0
fi

# Non-CC path. Per §4.3-4.4: print the ready command always; --no-launch /
# non-TTY is the default safe behaviour (we do not exec an interactive
# session from this shell script).
cat <<EOF
  ℹ Next session command (run in your terminal):
      cd $WORKTREE_PATH
EOF

# Print the harness-specific ready line if we can detect one.
HARNESS="unknown"
if [ -n "${ZCODE_SESSION_ID:-}" ] || command -v zcode >/dev/null 2>&1; then
  HARNESS="zcode"
  echo "      zcode  # (ZCode session in $WORKTREE_PATH)"
elif command -v claude >/dev/null 2>&1; then
  HARNESS="claude-cli"
  echo "      claude -w $NAME  # (Claude Code CLI worktree session)"
else
  echo "      # (no known harness detected — start your editor/agent of choice)"
fi
unset HARNESS

if [ "$NO_LAUNCH" = "1" ]; then
  echo
  echo "✓ done (--no-launch / non-TTY; reason=$NO_LAUNCH_REASON). worktree=$WORKTREE_PATH"
  exit 0
fi

# TTY + launch-permitted: we still only print the command. Spawning an
# interactive session (zcode/claude) from this script would risk
# STDIN/STDOUT/env contamination; the operator runs the printed line.
echo
echo "✓ done. worktree=$WORKTREE_PATH"
