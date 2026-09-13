#!/usr/bin/env bash
# Paired-negative for scripts/check-line-citations.mjs.
#
# Hermetic: every arm builds a throw-away git repo under mktemp and runs the checker
# with that repo as cwd, so `git rev-parse --show-toplevel` resolves there and the real
# repository is never read, blamed, or rewritten. GREEN arms prove the gate stays quiet
# on the shapes that must not block a push (an accurate citation, an out-of-repo path,
# a `cite:historical` escape, a backreference whose antecedent is in another sentence).
# RED arms prove each rule fires — including, separately, BOTH detection arms: content
# drift since authorship (blame) and a landing on a blank line (birth-correct). A gate
# green on everything is the failure mode this file exists to exclude.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK="$DIR/check-line-citations.mjs"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/line-citations-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

fails=0
REPO=""

# A fresh repo per arm: blame is the input to arm 1, so arms must not share history.
new_repo() {
  REPO="$TMP/repo-$1"
  mkdir -p "$REPO"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email t@example.com
  git -C "$REPO" config user.name Test
  git -C "$REPO" commit -q --allow-empty -m init
}

commit_all() { git -C "$REPO" add -A && git -C "$REPO" commit -qm "${1:-wip}"; }

run_check() {
  (cd "$REPO" && node "$CHECK" --check "$@") >"$TMP/out" 2>"$TMP/err"
}

expect_pass() {
  local name="$1"; shift
  run_check "$@"; local rc=$?
  [ "$rc" -eq 0 ] && return
  # rc is captured before anything else runs: a FAIL reporting "got 0" is unactionable.
  echo "FAIL: $name — expected exit 0, got $rc"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
}

expect_fail() {
  local name="$1" needle="$2"; shift 2
  if run_check "$@"; then
    echo "FAIL: $name — expected exit 1, got 0"; fails=$((fails + 1)); return
  fi
  # The finding must NAME the defect; an unactionable red is a red nobody can fix.
  if ! grep -qF "$needle" "$TMP/err"; then
    echo "FAIL: $name — stderr did not mention '$needle'"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
  fi
}

# ---------------------------------------------------------------- arm 1: drift by blame
new_repo drift
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/cite.md"
commit_all "citation written while line 2 said beta"

expect_pass "accurate citation is quiet" cite.md

# Target grows a line above the cited one: line 2 now says something else.
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/target.md"
commit_all "target reflowed, citation untouched"
expect_fail "content drift since authorship is caught" "cite.md:1" cite.md
grep -qF -- '-> :3' "$TMP/err" ||
  grep -qF ':3' "$TMP/err" ||
  { echo "FAIL: drift arm did not print the moved-to line"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1)); }

# --write renumbers, and a range moves as a block rather than collapsing to one line.
printf 'Budget `target.md:2-3` applies.\n' >"$REPO/cite.md"
commit_all "range citation"
printf 'X\nY\nalpha\nINSERTED\nbeta\ngamma\n' >"$REPO/target.md"
commit_all "target shifted down by two, cited content intact"
(cd "$REPO" && node "$CHECK" --write cite.md) >/dev/null 2>&1
if ! grep -qF 'target.md:4-5' "$REPO/cite.md"; then
  echo "FAIL: --write collapsed or mis-shifted the range: $(cat "$REPO/cite.md")"; fails=$((fails + 1))
fi

# ------------------------------------------------------------- arm 2: blank landing
# Arm 1 is blind here by construction: the citation is wrong in the very commit that
# introduces it, so blame's "then" and "now" agree. This arm reads only today's target.
new_repo blank
printf 'alpha\n\ngamma\n' >"$REPO/target.md"
printf 'See `target.md:2` for the cap.\n' >"$REPO/cite.md"
commit_all "citation wrong at birth — lands on the empty line"
expect_fail "birth-wrong citation landing on a blank line is caught" "is an empty line" cite.md

# ...and it fires on an uncommitted working-tree edit, i.e. before the drift can ship.
printf 'alpha\nbeta\n\n' >"$REPO/target.md"
printf 'See `target.md:3` for the cap.\n' >"$REPO/cite.md"
expect_fail "blank landing fires on an uncommitted edit" "is an empty line" cite.md

# ------------------------------------------------------- --blank-only (pre-commit arm)
# The pre-commit channel runs ARM 2 alone: it must still catch the blank landing, and
# must stay silent on blame-detected drift, which at commit time has no stable baseline.
new_repo blank-only
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/cite.md"
commit_all "accurate citation"
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/target.md"
commit_all "target reflowed — ARM 1 territory"
expect_fail "full check sees the drift" "cite.md:1" cite.md
expect_pass "--blank-only leaves ARM 1 drift to pre-push" --blank-only cite.md
printf 'alpha\n\nbeta\n' >"$REPO/target.md"
expect_fail "--blank-only still catches the blank landing" "is an empty line" --blank-only cite.md

# --------------------------------------------------------------------- beyond EOF
new_repo eof
printf 'alpha\nbeta\n' >"$REPO/target.md"
printf 'See `target.md:99`.\n' >"$REPO/cite.md"
commit_all "citation past the end of the file"
expect_fail "citation past EOF is caught" "has 3 lines" cite.md

# ------------------------------------------------------------- deliberate non-coverage
new_repo unresolvable
printf 'Consumer projects put it at `src/app/api/orders/route.ts:24`.\n' >"$REPO/cite.md"
commit_all "out-of-repo illustration"
expect_pass "a path that does not resolve on disk is skipped, not failed" cite.md

# ------------------------------------------------------------------- escape hatch
new_repo escape
printf 'alpha\nbeta\n' >"$REPO/target.md"
printf 'At incident time `target.md:2` said alpha. <!-- cite:historical deliberate past-state quote from the incident -->\n' >"$REPO/cite.md"
commit_all "escaped historical citation"
printf 'REWRITTEN\nbeta\n' >"$REPO/target.md"
commit_all "target rewritten under the escape"
expect_pass "cite:historical suppresses the drift finding" cite.md

printf 'At incident time `target.md:2` said alpha. <!-- cite:historical old -->\n' >"$REPO/cite.md"
commit_all "escape with a placeholder rationale"
expect_fail "a too-short escape rationale is rejected" "rationale must be >= 20 chars" cite.md

# ------------------------------------------------------------ bare backreference
new_repo backref
printf 'alpha\nbeta\ngamma\ndelta\n' >"$REPO/target.md"
printf 'Pinned at `target.md:2` and `:3`.\n' >"$REPO/cite.md"
commit_all "backref bound to the anchor in the same sentence"
printf 'INSERTED\nalpha\nbeta\ngamma\ndelta\n' >"$REPO/target.md"
commit_all "target shifted by one"
run_check cite.md
if [ "$(grep -cF 'cite.md:1' "$TMP/err")" -lt 2 ]; then
  echo "FAIL: backref sibling was not checked alongside its anchor"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
fi

# A backreference on the far side of a sentence boundary belongs to a different
# referent ("the audit's `:324`") and must NOT inherit the anchor — measured at 50%
# precision without this guard on the live corpus, 100% with it.
new_repo backref-sentence
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'Pinned at `target.md:1`. The audit numbers it `:99`.\n' >"$REPO/cite.md"
commit_all "backref across a sentence boundary"
expect_pass "a backref in the next sentence is not bound to the anchor" cite.md

if [ "$fails" -eq 0 ]; then
  echo "check-line-citations paired-negative: all arms passed"
else
  echo "check-line-citations paired-negative: $fails failure(s)"
fi
exit $((fails > 0))
