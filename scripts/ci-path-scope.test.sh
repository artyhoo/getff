#!/usr/bin/env bash
# Paired-negative for scripts/ci-path-scope.sh — the decision behind the `path-scope` job that
# `if:`-gates audit-self.yml's install-area jobs. Every case builds a REAL merge commit (the shape
# actions/checkout gives a pull_request run) in a tmp repo and runs the real script against it.
# The load-bearing direction is the negative one: anything the script cannot prove is outside the
# measured skip set must come out `install=true`.
#
# CI: invoked from .github/workflows/audit-self.yml#install-sh-b, next to ci-success-gate.test.sh.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SCOPE="$HERE/ci-path-scope.sh"
PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS: %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# A path inside the first two measured skip patterns (a `*` pattern becomes a file under it).
PATTERNS=()
while IFS= read -r line; do PATTERNS+=("$line"); done < <(bash "$SCOPE" --list)   # no mapfile: bash 3.2
[ "${#PATTERNS[@]}" -ge 2 ] || { echo "FATAL: ci-path-scope.sh --list printed fewer than 2 patterns"; exit 1; }
SKIP_A="${PATTERNS[0]//\*/probe-a.md}"
SKIP_B="${PATTERNS[1]//\*/sub dir/проба b.md}"   # a space and non-ASCII: the -z read must hold
RUN_PATH="setup.d/probe.sh"                          # an install-area path: never skippable

# repo_with_change <dir> <path>... — base commit, a branch changing <path>s, a --no-ff merge of
# the branch into base. HEAD ends on the merge commit, parent 1 = base tip.
repo_with_change() {
  local dir="$1"; shift
  git init -q -b main "$dir"
  git -C "$dir" config user.email t@example.com
  git -C "$dir" config user.name t
  echo base >"$dir/README.md"
  mkdir -p "$dir/setup.d" && echo 'echo base' >"$dir/$RUN_PATH"
  git -C "$dir" add -A && git -C "$dir" commit -qm base
  git -C "$dir" checkout -qb pr
  local p
  for p in "$@"; do mkdir -p "$dir/$(dirname "$p")" && echo "change $p" >"$dir/$p"; done
  git -C "$dir" add -A && git -C "$dir" commit -qm change
  git -C "$dir" checkout -q main
  echo moved >>"$dir/README.md" && git -C "$dir" commit -qam "base moved"
  git -C "$dir" merge -q --no-ff pr -m merge
}

# expect <want true|false> <desc> <repo> [EVENT_NAME]
expect() {
  local want="$1" desc="$2" dir="$3" event="${4-pull_request}" out got
  out="$TMP/out.$PASS.$FAIL"
  : >"$out"
  (cd "$dir" && EVENT_NAME="$event" GITHUB_OUTPUT="$out" bash "$SCOPE" >/dev/null 2>&1)
  got=$(sed -n 's/^install=//p' "$out")
  if [ "$got" = "$want" ]; then ok "$desc (install=$got)"; else bad "$desc — wanted install=$want, got '${got}'"; fi
}

repo_with_change "$TMP/skip-only" "$SKIP_A" "$SKIP_B"
expect false "PR touching only measured-skip paths"                "$TMP/skip-only"
expect true  "same tree on a push event (backstop runs everything)" "$TMP/skip-only" push
expect true  "same tree on merge_group"                             "$TMP/skip-only" merge_group
expect true  "same tree with EVENT_NAME unset"                      "$TMP/skip-only" ""

repo_with_change "$TMP/mixed" "$SKIP_A" "$RUN_PATH"
expect true  "PR touching a skip path AND an install-area path"     "$TMP/mixed"

# A traced single-file reader inside a skip region: NEVER_SKIP wins over SKIP_PATTERNS.
NEVER=()
while IFS= read -r line; do NEVER+=("$line"); done < <(bash "$SCOPE" --list-never)
[ "${#NEVER[@]}" -ge 1 ] || { echo "FATAL: ci-path-scope.sh --list-never printed nothing"; exit 1; }
for n in "${NEVER[@]}"; do
  skippable_by_pattern=0
  for pat in "${PATTERNS[@]}"; do
    # shellcheck disable=SC2254  # the pattern IS the glob
    case "$n" in $pat) skippable_by_pattern=1 ;; esac
  done
  [ "$skippable_by_pattern" = 1 ] || bad "NEVER_SKIP entry '$n' sits in no skip region — stale entry"
done
repo_with_change "$TMP/never" "$SKIP_A" "${NEVER[0]}"
expect true  "PR touching a NEVER_SKIP file inside a skip region"    "$TMP/never"

repo_with_change "$TMP/new-dir" "brand-new-dir/file.txt"
expect true  "PR adding a path nobody listed (fail-closed default)" "$TMP/new-dir"

# A file moved OUT of the install area into a skip region: with rename detection the diff would
# name only the new (skippable) path. --no-renames must surface the deletion too.
repo_with_change "$TMP/rename" "$SKIP_A"
git -C "$TMP/rename" checkout -q pr
mkdir -p "$TMP/rename/$(dirname "$SKIP_B")"
git -C "$TMP/rename" mv "$RUN_PATH" "$SKIP_B" && git -C "$TMP/rename" commit -qm "move out of setup.d"
git -C "$TMP/rename" checkout -q main && git -C "$TMP/rename" merge -q --no-ff pr -m merge2
expect true  "PR moving an install-area file into a skip region"   "$TMP/rename"

# HEAD not a merge commit: the script cannot know the PR's change. HEAD^1 exists and the last
# commit touches only a skip path, so only the two-parent guard stands between this and `false`.
git init -q -b main "$TMP/linear"
echo one >"$TMP/linear/README.md"
git -C "$TMP/linear" add -A && git -C "$TMP/linear" -c user.email=t@e -c user.name=t commit -qm one
mkdir -p "$TMP/linear/$(dirname "$SKIP_A")" && echo two >"$TMP/linear/$SKIP_A"
git -C "$TMP/linear" add -A && git -C "$TMP/linear" -c user.email=t@e -c user.name=t commit -qm two
expect true  "HEAD is not a two-parent merge commit"                "$TMP/linear"

# A merge whose tree equals its first parent: nothing to classify, never a silent skip.
repo_with_change "$TMP/empty" "$SKIP_A"
empty=$(git -C "$TMP/empty" commit-tree "HEAD^1^{tree}" -p HEAD^1 -p pr -m empty)
git -C "$TMP/empty" checkout -q --detach "$empty"   # CI checks out the merge ref detached too
expect true  "merge with an empty diff against its base"            "$TMP/empty"

# Not a git repo at all.
mkdir -p "$TMP/not-git"
expect true  "no git repository"                                    "$TMP/not-git"

printf '\n── ci-path-scope: %d pass / %d fail ──\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
