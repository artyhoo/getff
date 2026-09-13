#!/usr/bin/env bash
# register-handoff-gate-target.test.sh — the arming script must write the settings file a
# WORKTREE session actually reads, and say which file that is before it writes.
#
# Measured 2026-09-13 (spec: docs/superpowers/specs/2026-09-08-handoff-currency-gate-design.md
# §Changelog round 3): `scripts/register-handoff-gate.sh` armed `<checkout>/.claude/settings.json`,
# but a desktop worktree session's project settings are the WORKTREE's own committed file, so
# 0 of 100+ worktrees were armed and the gate never fired there. `env` blocks of the user and
# project settings MERGE per key, so ~/.claude/settings.json is the one file every worktree
# session reads — the script now targets it BY DEFAULT; `--project` keeps the per-checkout arm.
#
# `--print-target` runs the real target resolution and exits before any write — the same
# testable-without-writing shape as `--print-root` (scripts/register-root-resolution.test.sh).
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
S="$DIR/register-handoff-gate.sh"
FAILED=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE 2>/dev/null || true

# An ISOLATED home: the test must never read or name the developer's real ~/.claude.
FAKE_HOME="$TMP/home"
mkdir -p "$FAKE_HOME/.claude"

check() { # check <label> <expected> <actual>
  if [[ "$2" == "$3" ]]; then
    echo "ok   $1"
  else
    echo "FAIL $1"
    echo "       expected: $2"
    echo "       actual:   $3"
    FAILED=1
  fi
}

# 1 — DEFAULT target is the USER settings file (the delivery fix itself).
got="$(cd "$ROOT" && HOME="$FAKE_HOME" bash "$S" --print-target 2>&1)"
check "default target = user settings" "$FAKE_HOME/.claude/settings.json" "$got"

# 2 — `--user` names the same file explicitly.
got="$(cd "$ROOT" && HOME="$FAKE_HOME" bash "$S" --user --print-target 2>&1)"
check "--user target" "$FAKE_HOME/.claude/settings.json" "$got"

# 3 — `--project` keeps the historical per-checkout arm, resolved from the script's own location.
got="$(cd "$ROOT" && HOME="$FAKE_HOME" bash "$S" --project --print-target 2>&1)"
check "--project target = this checkout" "$ROOT/.claude/settings.json" "$got"

# 4 — PAIRED NEGATIVE: `--project` from inside a FOREIGN git repo must still name THIS checkout
#     (the root-resolution contract carries into the target), never the foreign tree.
other="$TMP/other-repo"
mkdir -p "$other"
git -C "$other" init -q 2>/dev/null
got="$(cd "$other" && HOME="$FAKE_HOME" bash "$S" --project --print-target 2>&1)"
check "--project ignores a foreign git toplevel" "$ROOT/.claude/settings.json" "$got"

# 5 — an explicit root argument with `--project` targets that root's settings file.
got="$(cd "$ROOT" && HOME="$FAKE_HOME" bash "$S" --project "$TMP" --print-target 2>&1)"
check "--project <root> targets that root" "$TMP/.claude/settings.json" "$got"

# 6 — PAIRED NEGATIVE: `--print-target` writes NOTHING — the fake home's settings stays absent
#     and the checkout's settings.json keeps its bytes.
before="$(cat "$ROOT/.claude/settings.json" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)"
(cd "$ROOT" && HOME="$FAKE_HOME" bash "$S" --print-target >/dev/null 2>&1)
after="$(cat "$ROOT/.claude/settings.json" 2>/dev/null | shasum -a 256 | cut -d' ' -f1)"
check "--print-target leaves the checkout settings untouched" "$before" "$after"
if [[ -e "$FAKE_HOME/.claude/settings.json" ]]; then
  echo "FAIL --print-target must not create the user settings file"; FAILED=1
else
  echo "ok   --print-target creates no user settings file"
fi

if [[ $FAILED -eq 0 ]]; then
  echo "PASS — register-handoff-gate.sh targets the user settings by default and prints its target without writing."
else
  echo "FAILED"
fi
exit $FAILED
