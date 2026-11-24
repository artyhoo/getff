#!/usr/bin/env bash
# Paired-negative for scripts/cited-spec-addenda.sh (doc-authority-hierarchy.md §4.1 supersession clause).
#
# Every arm is hermetic: a throw-away git repo under mktemp with pinned commit dates, and the
# operator's global/system git config switched off so a global core.hooksPath can never fire.
# GREEN arms prove the helper stays quiet when the cited intent was never amended; RED arms prove
# it names every later commit and every addendum heading. A helper that reports CLEAN on an
# amended spec is exactly the BY-DESIGN false blessing it exists to prevent.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="$DIR/cited-spec-addenda.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/cited-spec-addenda-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"

export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.invalid GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.invalid

fails=0
rc=0
run() { ( cd "$REPO" && bash "$HELPER" "$@" ) >"$TMP/out" 2>"$TMP/err"; rc=$?; }

# $1 = arm name, $2 = expected exit, $3.. = fixed strings that must appear in stdout+stderr
expect() {
  local name="$1" want="$2"; shift 2
  if [ "$rc" -ne "$want" ]; then
    echo "FAIL: $name — expected exit $want, got $rc"; sed 's/^/    /' "$TMP/out" "$TMP/err"
    fails=$((fails + 1)); return
  fi
  local s
  for s in "$@"; do
    if ! grep -qF -- "$s" "$TMP/out" "$TMP/err"; then
      echo "FAIL: $name — output did not contain '$s'"; sed 's/^/    /' "$TMP/out" "$TMP/err"
      fails=$((fails + 1)); return
    fi
  done
}

# $1 = arm name, $2.. = fixed strings that must NOT appear in stdout
expect_absent() {
  local name="$1"; shift
  local s
  for s in "$@"; do
    if grep -qF -- "$s" "$TMP/out"; then
      echo "FAIL: $name — output unexpectedly contained '$s'"; sed 's/^/    /' "$TMP/out"
      fails=$((fails + 1)); return
    fi
  done
}

commit_at() {
  # $1 = ISO date, $2 = subject; commits whatever is staged
  GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git -C "$REPO" commit -q -m "$2"
}

git init -q "$REPO"

# spec.md: the declaring artefact; D18 on line 3.
printf '# Gate spec\n\n- D18: consumers receive no residue writer.\n- D19: unrelated.\n' >"$REPO/spec.md"
# plain.md: a non-spec artefact whose line 3 is rewritten later, line 1 is not.
printf 'alpha\nbeta\ngamma\n' >"$REPO/plain.md"
git -C "$REPO" add spec.md plain.md
commit_at 2026-09-01T10:00:00Z "docs: land the gate spec"

# ── usage + inconclusive arms ────────────────────────────────────────────────────────────────────
run
expect "no arguments is a usage error" 1 "usage:"

run spec.md:3 --bogus
expect "unknown flag is a usage error" 1 "usage:"

printf 'x\n' >"$REPO/untracked.md"
run untracked.md:1
expect "untracked path is INCONCLUSIVE, never CLEAN" 3 "VERDICT: INCONCLUSIVE" "not tracked"

run spec.md:99
expect "line past EOF is INCONCLUSIVE" 3 "outside spec.md" "VERDICT: INCONCLUSIVE"

run spec.md:99 --since 2026-01-01
expect "line past EOF is INCONCLUSIVE under --since too" 3 "outside spec.md" "VERDICT: INCONCLUSIVE"

for bad in 'garbage words' 2026-09-31 2026-13-01 deadbeefz; do
  run spec.md:3 --since "$bad"
  expect "unparseable --since '$bad' is a usage error, never a silent CLEAN" 1 "--since"
done

# ── GREEN: the cited intent was never amended ────────────────────────────────────────────────────
run spec.md:3
expect "unamended spec, line citation" 0 "CITED: spec.md:3" "BASELINE:" "blame of line 3" "VERDICT: CLEAN"
expect_absent "unamended spec lists no later commit" "LATER:"

run spec.md
expect "unamended spec, whole-file citation" 0 "file birth" "VERDICT: CLEAN"

# ── RED: an addendum lands after the cited decision ──────────────────────────────────────────────
printf '\n## Consumer-axis addendum (2026-09-08)\n\nPremise changed: consumers must work. D18 lapses.\n' >>"$REPO/spec.md"
git -C "$REPO" add spec.md
commit_at 2026-09-08T17:00:00Z "docs(specs): withdraw the operator-axis audience decision"

run spec.md:3
expect "addendum after the cited line is named" 2 \
  "LATER:" "withdraw the operator-axis audience decision" \
  "MARKER: spec.md:6:" "Consumer-axis addendum" "VERDICT: AMENDED later=1 markers=1"

run spec.md
expect "whole-file citation sees the addendum too" 2 "VERDICT: AMENDED later=1 markers=1"

# The addendum heading is reported even when the cited line itself was rewritten AFTER the
# addendum (the blame baseline then post-dates it) — markers read today's file, not history.
sed -i.bak 's/^- D18: consumers receive no residue writer\./- D18: consumers receive no residue writer (see addendum)./' "$REPO/spec.md"
rm -f "$REPO/spec.md.bak"
git -C "$REPO" add spec.md
commit_at 2026-09-09T09:00:00Z "docs: point D18 at its addendum"
run spec.md:3
expect "marker survives a baseline that post-dates the addendum" 2 "blame of line 3" "VERDICT: AMENDED later=0 markers=1"
expect_absent "later commit before the baseline is not listed" "LATER:"

# ── baseline precision: blame of the cited line, not of the file ─────────────────────────────────
printf 'alpha\nbeta\nGAMMA\n' >"$REPO/plain.md"
git -C "$REPO" add plain.md
commit_at 2026-09-10T08:00:00Z "chore: rewrite plain line 3"

run plain.md:3
expect "rewritten line is its own baseline — nothing after it" 0 "VERDICT: CLEAN"

run plain.md:1
expect "older line sees the later rewrite of its file" 2 "chore: rewrite plain line 3" "VERDICT: AMENDED later=1 markers=0"

# ── --since: explicit baseline, date or revision ─────────────────────────────────────────────────
run plain.md:1 --since 2026-09-20
expect "--since after every commit is CLEAN" 0 "--since 2026-09-20" "VERDICT: CLEAN"

run plain.md:1 --since 2026-09-02
expect "--since the spec date lists the later commit" 2 "chore: rewrite plain line 3" "VERDICT: AMENDED later=1"

run plain.md:1 --since HEAD
expect "--since a revision uses rev..HEAD" 0 "VERDICT: CLEAN"

run plain.md:1 --since HEAD~1
expect "--since HEAD~1 lists HEAD" 2 "chore: rewrite plain line 3"

# ── rename: the file's birth is the ORIGINAL add, not the rename ─────────────────────────────────
mkdir -p "$REPO/docs"
printf '# Old spec\n\n- D20: no writer.\n' >"$REPO/docs/old.md"
git -C "$REPO" add docs/old.md
commit_at 2026-09-11T08:00:00Z "docs: land old spec"
printf '# Old spec\n\n- D20: no writer. WITHDRAWN inline, consumers must work.\n' >"$REPO/docs/old.md"
git -C "$REPO" add docs/old.md
commit_at 2026-09-12T08:00:00Z "docs: withdraw D20 inline"
git -C "$REPO" mv docs/old.md docs/spec2.md
commit_at 2026-09-13T08:00:00Z "chore: move the spec"

run docs/spec2.md
expect "whole-file citation of a renamed spec sees the pre-rename withdrawal" 2 \
  "file birth" "docs: withdraw D20 inline" "VERDICT: AMENDED later=2 markers=0"

# ── citations are repo-relative, wherever the helper runs from ───────────────────────────────────
( cd "$REPO/docs" && bash "$HELPER" docs/spec2.md ) >"$TMP/out" 2>"$TMP/err"; rc=$?
expect "run from a subdirectory resolves the repo-relative path" 2 "docs: withdraw D20 inline"

# ── staged but never committed: no history, no verdict ───────────────────────────────────────────
printf 'draft\n' >"$REPO/staged.md"
git -C "$REPO" add staged.md
run staged.md:1
expect "staged-only file is INCONCLUSIVE with a VERDICT line" 3 "VERDICT: INCONCLUSIVE"
git -C "$REPO" rm -q --cached staged.md
rm -f "$REPO/staged.md"

# ── last line without a trailing newline is a real line ──────────────────────────────────────────
printf 'l1\nl2' >"$REPO/nonl.md"
git -C "$REPO" add nonl.md
commit_at 2026-09-14T08:00:00Z "docs: file without trailing newline"
run nonl.md:2
expect "unterminated last line is citable" 0 "blame of line 2" "VERDICT: CLEAN"

# ── a shell comment inside a code block is not an amendment heading ──────────────────────────────
# shellcheck disable=SC2016 # literal backticks: the fixture IS a fenced code block
printf '# Runbook\n\n```bash\n# revoke the token\n```\n\n~~~\n# withdraw the key\n~~~\n' >"$REPO/fence.md"
git -C "$REPO" add fence.md
commit_at 2026-09-15T08:00:00Z "docs: runbook"
run fence.md
expect "fenced shell comments are not markers" 0 "VERDICT: CLEAN"
expect_absent "fenced shell comments are not listed" "MARKER:"

# ── shallow history cannot prove absence ─────────────────────────────────────────────────────────
git clone -q --depth 1 "file://$REPO" "$TMP/shallow" 2>/dev/null
( cd "$TMP/shallow" && bash "$HELPER" plain.md:1 ) >"$TMP/out" 2>"$TMP/err"; rc=$?
expect "shallow clone is INCONCLUSIVE, never CLEAN" 3 "VERDICT: INCONCLUSIVE" "shallow"

if [ "$fails" -ne 0 ]; then
  echo "cited-spec-addenda.test.sh: $fails arm(s) failed"
  exit 1
fi
echo "cited-spec-addenda.test.sh: all arms passed"
