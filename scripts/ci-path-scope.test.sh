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
# The scratch repos below must never resolve to this repo: a GIT_DIR exported by a hook in a
# linked worktree would make `git init`/`checkout`/`merge` act on the real repository.
# shellcheck disable=SC2046  # the word split IS the variable list
unset $(git rev-parse --local-env-vars 2>/dev/null) 2>/dev/null || true
SCOPE="$HERE/ci-path-scope.sh"
PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); printf 'PASS: %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf 'FAIL: %s\n' "$1"; }

TMP=$(mktemp -d)
# "no git repository" below must hold even when TMPDIR sits inside a work tree.
export GIT_CEILING_DIRECTORIES="$TMP"
trap 'rm -rf "$TMP"' EXIT

# A path inside the first two measured skip patterns (a `*` pattern becomes a file under it).
PATTERNS=()
while IFS= read -r line; do PATTERNS+=("$line"); done < <(bash "$SCOPE" --list)   # no mapfile: bash 3.2
[ "${#PATTERNS[@]}" -ge 2 ] || { echo "FATAL: ci-path-scope.sh --list printed fewer than 2 patterns"; exit 1; }
SKIP_A="${PATTERNS[0]//\*/probe-a.md}"
SKIP_B="${PATTERNS[1]//\*/sub dir/probe-é b.md}"   # a space and non-ASCII: the -z read must hold
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

# The runtime optimization is narrower than the install-area skip set: it needs an actual
# kickoff, regular tracked document companions, and no executable/configuration changes.
# Removing the kickoff requirement or widening the path set must fail these real-git arms.
expect_runtime() {
  local want="$1" desc="$2" dir="$3" event="${4-pull_request}" out got
  out="$TMP/runtime.$PASS.$FAIL"
  : >"$out"
  (cd "$dir" && EVENT_NAME="$event" GITHUB_OUTPUT="$out" bash "$SCOPE" >/dev/null 2>&1)
  got=$(sed -n 's/^runtime=//p' "$out")
  if [ "$got" = "$want" ]; then ok "$desc (runtime=$got)"; else bad "$desc — wanted runtime=$want, got '${got}'"; fi
}
KICKOFF='.claude/orchestrator-prompts/new-plan/kickoff.md'
SPEC='docs/superpowers/specs/2026-10-22-new-plan-design.md'
repo_with_change "$TMP/kickoff" "$KICKOFF" "$SPEC" docs/site/face-facts.json
expect_runtime false "kickoff with design and generated facts uses document CI" "$TMP/kickoff"
expect false "kickoff publication skips install-area jobs too" "$TMP/kickoff"
expect_runtime true "push remains a full-runtime backstop" "$TMP/kickoff" push
expect_runtime true "merge queue remains a full-runtime backstop" "$TMP/kickoff" merge_group
expect_runtime true "non-merge checkout cannot skip runtime" "$TMP/linear"
expect_runtime true "missing repository cannot skip runtime" "$TMP/not-git"
expect_runtime true "empty merge cannot skip runtime" "$TMP/empty"
repo_with_change "$TMP/spec-only" "$SPEC"
expect_runtime true "design without a kickoff is outside this optimization" "$TMP/spec-only"
repo_with_change "$TMP/stage" '.claude/orchestrator-prompts/new-plan/kickoff-s2b.md'
expect_runtime false "recognized stage-only publication uses document CI" "$TMP/stage"
repo_with_change "$TMP/near-miss" '.claude/orchestrator-prompts/new-plan/kickoff-bs0.md'
expect_runtime true "unrecognized stage name cannot enter the reduced lane" "$TMP/near-miss"
repo_with_change "$TMP/nested" '.claude/orchestrator-prompts/new-plan/nested/kickoff.md'
expect_runtime true "nested kickoff outside corpus enumeration retains full CI" "$TMP/nested"
repo_with_change "$TMP/sandbox-name" '.claude/orchestrator-prompts/c2-test-real/kickoff.md'
expect_runtime true "a corpus-excluded scratch name cannot buy the reduced lane" "$TMP/sandbox-name"
repo_with_change "$TMP/sidecar" '.claude/orchestrator-prompts/new-plan/kickoff-s1.decisions.md'
expect_runtime true "a sidecar alone is not a dispatch input" "$TMP/sidecar"
case_index=0
for p in packages/core/index.ts .github/workflows/probe.yml scripts/probe.sh .claude/orchestrator-prompts/new-plan/probe.sh .agents/rules/probe.md; do
  case_index=$((case_index + 1))
  repo_with_change "$TMP/mixed-$case_index" "$KICKOFF" "$p"
  expect_runtime true "kickoff plus $p runs full runtime CI" "$TMP/mixed-$case_index"
done
repo_with_change "$TMP/kickoff-fixture" '.claude/orchestrator-prompts/getff-freshness-widening-s1/kickoff.md'
expect_runtime true "a known install-test kickoff fixture retains its readers" "$TMP/kickoff-fixture"

# The only allowed .gitignore edit is adding a stage-document exception for an umbrella
# included in this PR. A general ignore-policy change must still run the installer tests.
repo_with_change "$TMP/ignore" "$KICKOFF"
git -C "$TMP/ignore" checkout -q pr
printf '%s\n' '!.claude/orchestrator-prompts/new-plan/kickoff-s*.md' >"$TMP/ignore/.gitignore"
echo 'stage publication' >>"$TMP/ignore/$KICKOFF"
git -C "$TMP/ignore" add .gitignore "$KICKOFF" && git -C "$TMP/ignore" commit -qm 'publish stages'
git -C "$TMP/ignore" checkout -q main && git -C "$TMP/ignore" merge -q --no-ff pr -m merge2
expect_runtime false "additive stage exception for changed umbrella is safe" "$TMP/ignore"
expect false "safe stage exception does not restore install battery" "$TMP/ignore"
git -C "$TMP/ignore" checkout -q pr
printf '%s\n' 'packages/' >>"$TMP/ignore/.gitignore"
echo 'mixed change' >>"$TMP/ignore/$KICKOFF"
git -C "$TMP/ignore" add .gitignore "$KICKOFF" && git -C "$TMP/ignore" commit -qm 'change ignore policy'
git -C "$TMP/ignore" checkout -q main && git -C "$TMP/ignore" merge -q --no-ff pr -m merge3
expect_runtime true "general ignore-policy edits keep full CI" "$TMP/ignore"

repo_with_change "$TMP/link" "$KICKOFF" "$SPEC"
git -C "$TMP/link" checkout -q pr
rm "$TMP/link/$SPEC" && ln -s /tmp/foreign-plan "$TMP/link/$SPEC"
git -C "$TMP/link" add -A && git -C "$TMP/link" commit -qm 'symlink companion'
git -C "$TMP/link" checkout -q main && git -C "$TMP/link" merge -q --no-ff pr -m merge2
expect_runtime true "symlink disguised as a planning document keeps full CI" "$TMP/link"

repo_with_change "$TMP/deleted" "$KICKOFF" "$RUN_PATH"
git -C "$TMP/deleted" checkout -q pr
git -C "$TMP/deleted" rm -q "$RUN_PATH"
echo 'updated plan' >>"$TMP/deleted/$KICKOFF"
git -C "$TMP/deleted" add -A && git -C "$TMP/deleted" commit -qm 'remove code with plan update'
git -C "$TMP/deleted" checkout -q main && git -C "$TMP/deleted" merge -q --no-ff pr -m merge2
expect_runtime true "deleted runtime files cannot hide beside a kickoff" "$TMP/deleted"

# The hook calls the SAME selector with an explicit committed range, without a fabricated
# pull_request event or a synthetic merge. Unknown/malformed ranges never authorize a skip.
expect_range() {
  local want="$1" desc="$2" dir="$3" base="$4" head="$5" got
  got=$(cd "$dir" && bash "$SCOPE" --kickoff-range "$base" "$head" 2>/dev/null)
  if [ "$got" = "kickoff_only=$want" ]; then ok "$desc"; else bad "$desc — got '$got'"; fi
}
range_head=$(git -C "$TMP/kickoff" rev-parse HEAD)
range_base=$(git -C "$TMP/kickoff" rev-parse HEAD^1)
expect_range true "explicit publication range is reusable by pre-push" "$TMP/kickoff" "$range_base" "$range_head"
expect_range false "invalid explicit range keeps full pre-push" "$TMP/kickoff" missing "$range_head"
expect_range false "empty explicit range keeps full pre-push" "$TMP/kickoff" "$range_head" "$range_head"
range_head=$(git -C "$TMP/linear" rev-parse HEAD)
range_base=$(git -C "$TMP/linear" rev-parse HEAD^)
expect_range false "spec-only linear range keeps full pre-push" "$TMP/linear" "$range_base" "$range_head"
range_head=$(git -C "$TMP/stage" rev-parse pr)
range_base=$(git -C "$TMP/stage" rev-parse pr^)
expect_range true "linear stage publication needs no merge commit" "$TMP/stage" "$range_base" "$range_head"

printf '\n── ci-path-scope: %d pass / %d fail ──\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
