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
#
# The last two sections step outside that hermetic frame on purpose, because a checker
# nobody calls is not a gate: they run the REAL `.husky/pre-commit` over a fixture repo
# to prove the blank-landing arm actually blocks a commit, and compare the hook's
# `CITE_SCOPE` against pre-push.ts's `LIVE_AUTHORITY_MD` so the two channels cannot
# silently come to gate different surfaces.
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

# ...and --write must move BOTH. Half-fixing is worse than not fixing: rewriting the line
# makes its blame uncommitted, so arm 1 goes blind to the sibling it left behind.
(cd "$REPO" && node "$CHECK" --write cite.md) >/dev/null 2>&1
if ! grep -qF 'Pinned at `target.md:3` and `:4`.' "$REPO/cite.md"; then
  echo "FAIL: --write half-fixed the backref sentence: $(cat "$REPO/cite.md")"; fails=$((fails + 1))
fi

# A backreference on the far side of a sentence boundary belongs to a different
# referent ("the audit's `:324`") and must NOT inherit the anchor — measured at 50%
# precision without this guard on the live corpus, 100% with it.
new_repo backref-sentence
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'Pinned at `target.md:1`. The audit numbers it `:99`.\n' >"$REPO/cite.md"
commit_all "backref across a sentence boundary"
expect_pass "a backref in the next sentence is not bound to the anchor" cite.md

# ============================================================ skipped-citation visibility
# Until 2026-09-14 a citation whose path did not resolve was dropped with a bare
# `continue`: no line printed, no count, exit 0. Measured that day over the five
# getff.ai site specs — 141 citations, 43 checked, 98 dropped in silence — and over the
# live-authority corpus the gate actually runs on: 144 citations, 51 dropped. Silence is
# not coverage; it is the `#warning-nobody-reads` shape one rung worse, with no warning
# at all (.claude/rules/attention-is-not-a-mechanism.md §2). These arms pin the three
# things that made the silence load-bearing: a bare basename that IS resolvable must be
# checked, one that is ambiguous must be reported rather than guessed, and every
# unresolved citation must leave a line a reader can act on.

# --- a bare basename unique in the tree resolves, so its drift is caught like any other
new_repo bare-unique
mkdir -p "$REPO/deep/nest"
printf 'alpha\nbeta\ngamma\n' >"$REPO/deep/nest/target.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/cite.md"
commit_all "bare basename citation, target lives in a subdirectory"
expect_pass "an accurate bare-basename citation is quiet" cite.md
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/deep/nest/target.md"
commit_all "target reflowed under the bare citation"
expect_fail "drift behind a bare basename is caught, not skipped" "cite.md:1" cite.md

# --- an ambiguous basename is REPORTED with its candidates, never guessed
new_repo bare-ambiguous
mkdir -p "$REPO/src" "$REPO/vendor/src"
printf 'alpha\nbeta\n' >"$REPO/src/dup.ts"
printf 'ZULU\nYANKEE\n' >"$REPO/vendor/src/dup.ts"
printf 'See `dup.ts:2`.\n' >"$REPO/cite.md"
commit_all "same basename in two places"
expect_pass "an ambiguous basename does not fail the gate" cite.md
for needle in 'ambiguous-basename' 'src/dup.ts' 'vendor/src/dup.ts'; do
  grep -qF "$needle" "$TMP/err" || {
    echo "FAIL: ambiguous basename did not report '$needle'"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1)); }
done

# --- a basename-resolved target whose line does not exist is a WEAK resolution, so it is
# reported as skipped rather than asserted as a hard beyond-EOF failure: the likelier
# reading is that the basename matched the wrong file.
new_repo bare-out-of-range
mkdir -p "$REPO/deep"
printf 'alpha\nbeta\n' >"$REPO/deep/target.md"
printf 'See `target.md:99`.\n' >"$REPO/cite.md"
commit_all "bare basename, line past the end of the match"
expect_pass "an out-of-range bare basename is reported, not failed" cite.md
grep -qF 'line-out-of-range' "$TMP/err" || {
  echo "FAIL: out-of-range bare basename was not reported"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1)); }

# --- the deliberate out-of-repo non-coverage stays exit 0, but stops being invisible
new_repo skip-visible
printf 'Consumer projects put it at `src/app/api/orders/route.ts:24`.\n' >"$REPO/cite.md"
commit_all "out-of-repo illustration"
expect_pass "an out-of-repo path is still skipped, not failed" cite.md
for needle in 'path-missing' 'src/app/api/orders/route.ts:24' 'resolved 0 / skipped 1'; do
  grep -qF "$needle" "$TMP/err" || {
    echo "FAIL: skipped citation did not report '$needle'"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1)); }
done

# --- --strict turns the report into a gate. Default stays 0 so the new visibility can
# land without breaking every push; --strict is what a caller opts into.
if (cd "$REPO" && node "$CHECK" --check --strict cite.md) >"$TMP/out" 2>"$TMP/err"; then
  echo "FAIL: --strict did not fail on a skipped citation"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1))
fi

# --- a bare basename naming nothing in the tree gets its own reason code
new_repo bare-nomatch
printf 'See `nowhere-at-all.md:3`.\n' >"$REPO/cite.md"
commit_all "bare basename matching no tracked file"
expect_pass "an unmatched bare basename does not fail the gate" cite.md
grep -qF 'bare-basename' "$TMP/err" || {
  echo "FAIL: unmatched bare basename was not reported"; sed 's/^/    /' "$TMP/err"; fails=$((fails + 1)); }

# ========================================== --affected-by (reverse-index push scoping)
# The hole this closes: a citation goes stale when the CITED file moves, and the cited
# file is almost never among the push's changed Markdown. Scoping the blame arm to
# changed CITING files therefore left the common case invisible — measured 2026-09-14
# over three PRs merged that day (#1755, #1761/#1762, #1764); none of them was reachable
# by the change-scoped gate, and each was found by a manual full-corpus run instead.
#
# `--affected-by=<path>` is repeatable and names the push's changed files. The blame arm
# then runs for a citation whose CITING file OR whose resolved TARGET is among them.
# Arm 2 (blank landing) and beyond-EOF read only today's tree and cost no git call, so
# they stay unconditional: the flag narrows the `git blame` comparison and nothing else.
new_repo affected-by
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/cite.md"
printf 'unrelated\n' >"$REPO/other.md"
commit_all "citation written while line 2 said beta"
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/target.md"
commit_all "target reflowed — the CITING file was not touched"

# The motivating shape: the push moved the target, never the citing doc.
expect_fail "drift is caught when the push changed the CITED file" \
  "cite.md:1" --affected-by=target.md cite.md

# ...and the scoping actually scopes. Without this arm the one above would still pass if
# `--affected-by` were ignored entirely — the vacuous-green shape these pairs exist to
# exclude (.claude/rules/attention-is-not-a-mechanism.md §2).
expect_pass "arm 1 stays quiet when the push touched neither side" \
  --affected-by=other.md cite.md

# The pre-2026-09-14 scope is preserved, not replaced: naming the citing file still fires.
expect_fail "drift is still caught when the push changed the CITING file" \
  "cite.md:1" --affected-by=cite.md cite.md

# No flag at all = full sweep over whatever was passed. This is the CI backstop's
# invocation, and it must stay the default so an omitted flag fails OPEN into more
# checking rather than less.
expect_fail "with no --affected-by the blame arm sweeps everything given to it" \
  "cite.md:1" cite.md

# Arm 2 is not narrowed by the flag.
printf 'alpha\n\nbeta\n' >"$REPO/target.md"
expect_fail "blank landing fires regardless of --affected-by" \
  "is an empty line" --affected-by=other.md cite.md

# A target named through a markdown link, not a bare path, resolves the same way — the
# reverse edge has to survive link syntax or the corpus's linked citations stay unscoped.
new_repo affected-by-link
mkdir -p "$REPO/docs"
printf 'alpha\nbeta\ngamma\n' >"$REPO/docs/target.md"
printf 'See [the cap](docs/target.md) at `docs/target.md:2`.\n' >"$REPO/cite.md"
commit_all "linked citation written while line 2 said beta"
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/docs/target.md"
commit_all "target reflowed"
expect_fail "a linked citation is reached through its target path too" \
  "cite.md:1" --affected-by=docs/target.md cite.md

# ================================================= --corpus (live-authority population)
# The population is the other half of coverage, and it now has exactly one definition —
# LIVE_AUTHORITY_MD inside the checker — because pre-push and the CI backstop are two
# consumers of it. These arms pin both directions: a corpus path IS swept without being
# named, and a path outside the corpus is NOT, so `--corpus` cannot quietly become
# «everything» (which would fire on the closed historical material the list exists to
# exclude) or «nothing».
new_repo corpus
mkdir -p "$REPO/.claude/rules" "$REPO/docs/meta-factory/retros"
printf 'alpha\nbeta\ngamma\n' >"$REPO/target.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/.claude/rules/inside.md"
printf 'The cap is `target.md:2`.\n' >"$REPO/docs/meta-factory/retros/outside.md"
commit_all "one citation inside the corpus, one in closed historical material"
printf 'alpha\nINSERTED\nbeta\ngamma\n' >"$REPO/target.md"
commit_all "target reflowed — both citations are now stale"

# Swept without being named on the command line...
expect_fail "--corpus reaches a corpus file nobody named" \
  ".claude/rules/inside.md:1" --corpus

# ...and the exclusion is real: the retro's identical drift must not appear.
if grep -qF 'retros/outside.md' "$TMP/err"; then
  echo "FAIL: --corpus swept closed historical material"; sed 's/^/    /' "$TMP/err"
  fails=$((fails + 1))
fi

# `--corpus` composes with the push scoping — this is the pre-push invocation verbatim.
expect_pass "--corpus + an unrelated --affected-by stays quiet" \
  --corpus --affected-by=docs/unrelated.md
expect_fail "--corpus + --affected-by naming the cited file fires" \
  ".claude/rules/inside.md:1" --corpus --affected-by=target.md

# An untracked corpus-shaped file is nobody's authority and must not enter the sweep:
# the population comes from `git ls-files`, not a directory walk.
printf 'The cap is `target.md:2`.\n' >"$REPO/.claude/rules/untracked.md"
run_check --corpus
if grep -qF 'untracked.md' "$TMP/err"; then
  echo "FAIL: --corpus swept an untracked file"; sed 's/^/    /' "$TMP/err"
  fails=$((fails + 1))
fi
rm -f "$REPO/.claude/rules/untracked.md"

# ============================================ the pre-commit CHANNEL, not just the flag
# The `--blank-only` arms above prove the MODE works. They say nothing about whether any
# channel invokes it — and for a day it did not: the mode shipped 2026-09-13, pre-push.ts
# §9 named pre-commit as ARM 2's earliest reachable channel, and
# `grep -c check-line-citations .husky/pre-commit` returned 0 (measured 2026-09-14,
# research-patches/2026-09-14-citation-quoted-literal-arm-measured-and-rejected.md §S1).
# A gate real in prose and absent in fact is the `#hope-as-gate` shape of
# .claude/rules/attention-is-not-a-mechanism.md §2, so these arms run the REAL
# `.husky/pre-commit` — copied byte-for-byte into the fixture, never re-implemented here —
# and assert on its exit code.
#
# Two stubs, both named rather than smuggled in through PATH surgery: `npx` (the
# markdownlint and prettier sections would otherwise reach the network from a fixture with
# no node_modules) and `scripts/format-shipped.sh` (absent in the fixture, so the prettier
# section would go red for an unrelated reason and make every arm below meaningless).
# Nothing else in the hook fires: its remaining sections are scoped to staged manifest,
# orchestrator-prompts, hooks, agents and skills paths, and this fixture stages none.
REAL_ROOT="$(cd "$DIR/.." && pwd)"
HOOK="$REAL_ROOT/.husky/pre-commit"

new_hook_repo() {
  new_repo "$1"
  mkdir -p "$REPO/scripts" "$REPO/.husky" "$REPO/_stub_bin" "$REPO/.claude/rules" "$REPO/docs"
  cp "$CHECK" "$REPO/scripts/check-line-citations.mjs"
  cp "$HOOK" "$REPO/.husky/pre-commit"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$REPO/_stub_bin/npx"
  printf '#!/usr/bin/env bash\nexit 0\n' >"$REPO/scripts/format-shipped.sh"
  chmod +x "$REPO/_stub_bin/npx" "$REPO/scripts/format-shipped.sh"
}

# The hook writes its verdict on stdout and the checker's findings on stderr; a reader of
# a blocked commit sees one stream, so both are merged and asserted together.
run_hook() { (cd "$REPO" && PATH="$REPO/_stub_bin:$PATH" bash .husky/pre-commit) >"$TMP/hook" 2>&1; }

expect_hook_block() {
  local name="$1" needle="$2"
  if run_hook; then
    echo "FAIL: $name — pre-commit exited 0; the commit was NOT refused"
    sed 's/^/    /' "$TMP/hook"; fails=$((fails + 1)); return
  fi
  if ! grep -qF "$needle" "$TMP/hook"; then
    echo "FAIL: $name — hook output did not mention '$needle'"
    sed 's/^/    /' "$TMP/hook"; fails=$((fails + 1))
  fi
}

expect_hook_pass() {
  local name="$1"
  run_hook && return
  echo "FAIL: $name — pre-commit exited non-zero"; sed 's/^/    /' "$TMP/hook"; fails=$((fails + 1))
}

# --- RED: a staged rule file citing a blank line is refused at commit time
new_hook_repo precommit-red
printf 'alpha\n\ngamma\n' >"$REPO/.claude/rules/target.md"
printf '# Rule\n\nThe cap is `target.md:2`.\n' >"$REPO/.claude/rules/cite.md"
git -C "$REPO" add .claude/rules
expect_hook_block "pre-commit refuses a blank-landing citation" "is an empty line"
grep -qF 'blank-landing' "$TMP/hook" || {
  echo "FAIL: the hook's own verdict line did not name the defect"
  sed 's/^/    /' "$TMP/hook"; fails=$((fails + 1)); }

# --- GREEN: the same shape with an accurate citation must not block the commit
new_hook_repo precommit-green
printf 'alpha\nbeta\ngamma\n' >"$REPO/.claude/rules/target.md"
printf '# Rule\n\nThe cap is `target.md:2`.\n' >"$REPO/.claude/rules/cite.md"
git -C "$REPO" add .claude/rules
expect_hook_pass "pre-commit stays quiet on an accurate citation"

# --- SCOPE: outside the live-authority surface the hook must NOT fire. Retros,
# research-patches and specs cite a line as a dated snapshot; blocking a commit there
# would demand rewriting history to make a gate green.
new_hook_repo precommit-scope
printf 'alpha\n\ngamma\n' >"$REPO/docs/target.md"
printf '# Note\n\nAt the time `target.md:2` said beta.\n' >"$REPO/docs/cite.md"
git -C "$REPO" add docs
expect_hook_pass "pre-commit leaves closed historical material alone"

# --- a path staged and then deleted from the working tree must not produce a verdict
# about citations. Measured 2026-09-14: without the `-f` filter the checker threw
# `ENOENT` and the hook reported it as «blank-landing citation(s)» — a red naming a
# defect the commit does not have, which is worse than no gate, because the committer
# goes looking for a citation that is not there.
new_hook_repo precommit-vanished
printf 'alpha\nbeta\n' >"$REPO/.claude/rules/target.md"
printf '# Rule\n\nThe cap is `target.md:2`.\n' >"$REPO/.claude/rules/cite.md"
git -C "$REPO" add .claude/rules
rm "$REPO/.claude/rules/cite.md"
expect_hook_pass "a staged-then-deleted path does not fabricate a citation verdict"
grep -qF 'ENOENT' "$TMP/hook" && {
  echo "FAIL: the checker still crashed on the vanished path"
  sed 's/^/    /' "$TMP/hook"; fails=$((fails + 1)); }

# --------------------------------------------- scope parity with the corpus definition
# `CITE_SCOPE` in .husky/pre-commit is a hand-kept copy of LIVE_AUTHORITY_MD — bash cannot
# read the checker's const. A copy whose drift is caught by «somebody notices both files»
# is the shape this repo refuses, so the two lists are compared mechanically here.
# Divergence is silent by construction: the hook would simply gate a narrower surface than
# the corpus defines, and a birth-wrong citation on the dropped path would sail through
# with every arm above still green.
#
# The list MOVED on 2026-09-14. It lived in packages/core/hooks/pre-push.ts until
# `--corpus` made it a three-consumer population (pre-push §9, the CI backstop, this
# hook), at which point a TS copy beside the checker's own would have been the
# `#sync-by-copy-paste` shape .claude/rules/dual-implementation-discipline.md §8 names.
# This arm follows it to scripts/check-line-citations.mjs. Reading the old home would now
# extract nothing at all, which is exactly why the emptiness guard below is load-bearing
# and not decoration: without it this arm would have gone green comparing two empty
# strings the moment the constant moved.
#
# Unlike every arm above this one reads the real repository, on purpose: a hermetic copy
# of the lists would be the drift it is meant to catch.
mjs_scope=$(awk '/^const LIVE_AUTHORITY_MD/,/^\];/' "$CHECK" |
  grep -oE "'[^']+'" | tr -d "'" | sort)
sh_scope=$(grep -E '^CITE_SCOPE=' "$HOOK" | head -1 | cut -d"'" -f2 | tr ' ' '\n' | grep -v '^$' | sort)
if [ -z "$mjs_scope" ] || [ -z "$sh_scope" ]; then
  # An extraction that silently yields nothing would make this arm pass on two empty
  # strings — the tautology it exists to exclude.
  echo "FAIL: scope parity — extraction came back empty (check-line-citations.mjs: $(printf '%s' "$mjs_scope" | wc -c) bytes, .husky/pre-commit: $(printf '%s' "$sh_scope" | wc -c) bytes)"
  fails=$((fails + 1))
elif [ "$mjs_scope" != "$sh_scope" ]; then
  echo "FAIL: .husky/pre-commit CITE_SCOPE has diverged from LIVE_AUTHORITY_MD in scripts/check-line-citations.mjs:"
  diff <(printf '%s\n' "$mjs_scope") <(printf '%s\n' "$sh_scope") | sed 's/^/    /'
  fails=$((fails + 1))
fi

if [ "$fails" -eq 0 ]; then
  echo "check-line-citations paired-negative: all arms passed"
else
  echo "check-line-citations paired-negative: $fails failure(s)"
fi
exit $((fails > 0))
