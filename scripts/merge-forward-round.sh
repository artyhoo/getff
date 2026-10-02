#!/usr/bin/env bash
# merge-forward-round.sh — one full merge-forward round for a CONFLICTING PR, parameterising
# the verified recipe in .claude/rules/git-conflict-merge-forward.md §2.
#
# WHY. Staging lands 2-7 install-area PRs an hour while one audit-self CI round takes ~1h,
# so a long-running PR that touches generated artefacts turns CONFLICTING again during every
# CI round; un-conflicting by hand is the same §2 recipe re-typed once per round (measured
# 2026-10-02 on PR #2008: 4 manual rounds in one day). This script is that recipe.
#
# ONE ROUND (§2): fetch -> throwaway scratch worktree at the remote PR tip -> merge
# origin/<base> -> triage the unmerged list (generated vs semantic, §4) -> regenerate the
# generated conflicts with their own SSOT generators -> commit --no-edit -> verify
# (SNAPSHOT_MODE=compare N pass/0 fail, build-getff-dist --check, vitest on the PR's own
# test files) -> pr-body-fidelity pre-flight on the new head (§9) -> merge-base
# --is-ancestor interlock -> plain push HEAD:<pr-branch>. Never rebase, never force (§3).
#
# GENERATED SET (§4 populations plus this repo's other byte-renderers — the auto-resolvable
# list; each is regenerated only by its own SSOT generator):
#   packages/getff/MANIFEST.sha256     -> scripts/build-getff-dist.sh
#   tests/install-sh/baselines/*       -> SNAPSHOT_MODE=capture tests/install-sh/snapshot.sh
#   plugin/hooks/*                     -> scripts/generate-plugin-twins.sh
#   plugin/skills/*                    -> scripts/generate-plugin-skills.sh
#   docs/site/reference/*.json         -> render-reference.mjs --write (+ face-facts first)
#   docs/site/face-facts.json          -> render-face-facts.mjs --write
# (the docs/site pair is not in git-conflict-merge-forward.md §4 — found live on this
#  tool's first real round, PR #2017 2026-10-03: F3.json renders from the prior-art SSOT
#  and conflicts exactly like a baseline; same safety class, deterministic regenerator.)
# Anything else in the unmerged list is SEMANTIC: the merge is parked unpushed in the
# scratch worktree, the file list is printed, exit 4 — human judgment, never automation.
#
# SAFETY:
#   - no PR argument -> prints the planned round and exits (dry by default; nothing runs);
#   - --dry-run with a PR -> read-only probe: trial merge in a throwaway worktree,
#     classification report, cleanup; it never regenerates, commits or pushes;
#   - a MERGEABLE PR is refused without --force-round: a merge that resolves nothing is
#     never pushed (§10, anti-pattern #merge-forward-buries-the-audited-head §5);
#   - a local trial merge that is CLEAN on a PR GitHub calls CONFLICTING is reported and
#     NOT pushed (same one-way-door reasoning);
#   - the push is plain and only after `git merge-base --is-ancestor origin/<branch> HEAD`
#     holds (§2 step 9); a remote tip that moved mid-round parks or retries, never forces;
#   - a PR body carrying Audited-SHA stops matching the head after the merge commit: the
#     script reports the §9 case-(b) obligation (narrow cold delta check + body refresh)
#     and pushes anyway — a CONFLICTING PR gets no CI at all, and body rewriting is the
#     session's judgment, not this script's.
#
# PRIOR-ART: docs/meta-factory/prior-art-evaluations.md#263 (artyhoo/timeliner
# scripts/pre-merge-local.sh, ADAPT — throwaway-worktree merge construction and
# conflict-as-distinct-outcome transfer); #260 GitHub merge queue (REJECT — Enterprise-only,
# metered) and #262 jjq (DEFER — jj-only, owns the landing) do not serve plain-git PR
# un-conflicting. Not a capability commit by the CLAUDE.md detector (no new dependency, no
# >=80-LOC file under packages/); the consult is recorded here and in the PR body.
#
# Usage:
#   scripts/merge-forward-round.sh                    # print the planned round (no side effects)
#   scripts/merge-forward-round.sh <PR> [options]     # one full round; ends in a push
#   scripts/merge-forward-round.sh --classify [file]  # seam: classify paths (stdin/file), exit 0
#                                                     # iff every path is generated (§4)
# Options:
#   --repo <owner/repo>  GitHub slug          (default: resolved from `gh repo view`)
#   --base <branch>      integration branch   (default: staging)
#   --branch <name>      PR head branch override (default: from the PR)
#   --dry-run            probe only: classify conflicts, push nothing
#   --force-round        round even when GitHub reports MERGEABLE (§10 wants a named reason)
#   --park               everything except the push; the merge commit stays in the scratch worktree
#   --watch              after the push, wrap ci-wait.sh; start the next round on CONFLICTING
#   --max-rounds <n>     watch cap (default 3)
#   --timeout <sec>      ci-wait timeout (default 3600)
#   --keep               keep the scratch worktree even on success/clean paths
#   --ci-wait <path>     ci-wait location (default $CI_WAIT_SCRIPT, else ~/.claude/scripts/ci-wait.sh)
# Exit codes: 0 landed / clean / up-to-date; 1 CI RED after push; 2 usage; 3 transient
# (pending timeout, scratch exists, race); 4 PARKED (semantic conflict — human needed);
# 5 round machinery failed (regen / commit / verify / provision / push) — scratch kept.
# Output: progress lines, then one `VERDICT: <TOKEN> ...` line per round (last line).
# Bash 3.2-compatible (scripts/check-bash32.sh clean). Installs nothing (ci-tool-pinning
# population). English only (language-discipline principle 22).
# Test: scripts/merge-forward-round.test.sh (CI: .github/workflows/audit-self.yml).
set -uo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)

PR=""
REPO=""
BASE="staging"
BRANCH_OVERRIDE=""
MODE="run" # run | dry | classify
FORCE_ROUND=0
PARK=0
WATCH=0
MAX_ROUNDS=3
TIMEOUT=3600
KEEP=0
CI_WAIT="${CI_WAIT_SCRIPT:-$HOME/.claude/scripts/ci-wait.sh}"
CLASSIFY_FILE=""

ROUND_N=0
SCRATCH=""
SCRATCH_CREATED=0
SCRATCH_PARK=0
PUSHED_SHA=""
PROVISIONED=0

usage() {
  sed -n '2,60p' "$0" | sed 's/^# \{0,1\}//'
}

die() { # <exit-code> <message...>
  local rc="$1"
  shift
  printf 'ERROR: %s\n' "$*" >&2
  exit "$rc"
}

verdict() {
  printf 'VERDICT: %s\n' "$*"
}

plan() {
  printf '+ %s\n' "$*"
}

ghp() { # gh pr ... against the resolved repo
  if [ -n "$REPO" ]; then gh pr "$@" --repo "$REPO"; else gh pr "$@"; fi
}

# classify_path <repo-relative-path> -> rc 0 generated (auto-resolvable by regeneration),
# 1 semantic. The §4 population list; keep in sync with the rule file.
classify_path() {
  case "$1" in
    packages/getff/MANIFEST.sha256) return 0 ;;
    tests/install-sh/baselines/*) return 0 ;;
    plugin/hooks/*) return 0 ;;
    plugin/skills/*) return 0 ;;
    docs/site/reference/*.json) return 0 ;;
    docs/site/face-facts.json) return 0 ;;
    *) return 1 ;;
  esac
}

do_classify() {
  local src="/dev/stdin" gen=0 sem=0 p
  if [ -n "$CLASSIFY_FILE" ]; then
    src="$CLASSIFY_FILE"
    [ -r "$src" ] || die 2 "cannot read '$src'"
  fi
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if classify_path "$p"; then
      printf 'CLASSIFY generated %s\n' "$p"
      gen=$((gen + 1))
    else
      printf 'CLASSIFY semantic %s\n' "$p"
      sem=$((sem + 1))
    fi
  done <"$src"
  printf 'CLASSIFY SUMMARY generated=%d semantic=%d\n' "$gen" "$sem"
  [ "$sem" -eq 0 ]
}

print_plan() {
  cat <<'EOF'
Planned merge-forward round (git-conflict-merge-forward.md §2) for a CONFLICTING <PR>:
  1. git fetch origin <base> <pr-branch>
  2. git worktree add --detach <scratch> <remote-pr-tip>
  3. git -C <scratch> merge --no-ff --no-edit origin/<base>
  4. triage the unmerged list — generated = packages/getff/MANIFEST.sha256,
     tests/install-sh/baselines/*, plugin/hooks/*, plugin/skills/*; anything else is
     SEMANTIC and parks the round unpushed (§4)
  5. git checkout --theirs <generated...> && git add <generated...>
  6. regenerate the conflicted populations only: build-getff-dist.sh |
     SNAPSHOT_MODE=capture tests/install-sh/snapshot.sh | generate-plugin-twins.sh |
     generate-plugin-skills.sh
  7. git add -u && git commit --no-edit
  8. verify: SNAPSHOT_MODE=compare -> N pass / 0 fail; build-getff-dist.sh --check;
     npx vitest run <the PR's own test files>
  9. pr-body-fidelity pre-flight on the new head (§9; Audited-SHA staleness is reported,
     not patched)
  10. git merge-base --is-ancestor origin/<pr-branch> HEAD   (must hold)
  11. git push origin HEAD:refs/heads/<pr-branch>            # plain push, never force
Pass a PR number to run it for real; `--dry-run <PR>` probes without regenerating or pushing.
EOF
}

cleanup() {
  if [ "$SCRATCH_CREATED" -eq 1 ] && [ -n "$SCRATCH" ]; then
    if [ "$KEEP" -eq 1 ]; then
      echo "scratch worktree kept (--keep): $SCRATCH"
    elif [ "$SCRATCH_PARK" -eq 1 ]; then
      echo "scratch worktree kept (parked round — resolve by hand, then push/drop): $SCRATCH"
      echo "  inspect: git -C '$SCRATCH' status"
      echo "  drop:    git worktree remove --force '$SCRATCH'"
    else
      git -C "$SCRATCH" merge --abort >/dev/null 2>&1 || true
      if ! git worktree remove --force "$SCRATCH" >/dev/null 2>&1; then
        echo "note: could not remove scratch worktree '$SCRATCH' — remove by hand: git worktree remove --force '$SCRATCH'"
      fi
    fi
  fi
}
trap cleanup EXIT

# provision_node <why> — scratch worktree needs node_modules for npx (vitest / the
# pr-body-fidelity bin). Uses the repo's own SSOT provisioning script, never a raw symlink.
provision_node() {
  [ "$PROVISIONED" -eq 1 ] && return 0
  plan "bash scripts/worktree-node-modules.sh <scratch>   # $1"
  if ! bash "$SCRIPT_DIR/worktree-node-modules.sh" "$SCRATCH"; then
    SCRATCH_PARK=1
    verdict "PARKED-PROVISION" "pr=$PR step=worktree-node-modules scratch=$SCRATCH"
    return 1
  fi
  PROVISIONED=1
  return 0
}

round() { # one full round; sets PUSHED_SHA on a successful push; returns the round's exit code
  local meta state tip mergeable mstate unmerged p newsha
  local generated="" semantic="" body_file="" body_out="" body_rc=0 body_state="unreadable"
  local compare_out="" tests="" pr_files=""

  meta=$(ghp view "$PR" --json state,headRefName,headRefOid,mergeable,mergeStateStatus \
    -q '[.state, .headRefName, .headRefOid, .mergeable, (.mergeStateStatus // "")] | @tsv' 2>/dev/null) ||
    { echo "ERROR: gh pr view failed for PR $PR" >&2; return 5; }
  state=$(printf '%s' "$meta" | cut -f1)
  PR_BRANCH=$(printf '%s' "$meta" | cut -f2)
  tip=$(printf '%s' "$meta" | cut -f3)
  mergeable=$(printf '%s' "$meta" | cut -f4)
  mstate=$(printf '%s' "$meta" | cut -f5)
  [ -n "$BRANCH_OVERRIDE" ] && PR_BRANCH="$BRANCH_OVERRIDE"

  if [ "$state" != "OPEN" ]; then
    verdict "SKIP-STATE" "pr=$PR state=$state — nothing to un-conflict"
    return 0
  fi
  if [ "$mergeable" = "MERGEABLE" ] && [ "$FORCE_ROUND" -ne 1 ]; then
    verdict "UP-TO-DATE" "pr=$PR mergeable=$mergeable mergeStateStatus=${mstate:-?} — nothing conflicting; refusing a no-op merge-forward push (git-conflict-merge-forward.md §10; override with --force-round and a named reason)"
    return 0
  fi
  echo "== round $ROUND_N: pr=$PR branch=$PR_BRANCH tip=$tip mergeable=$mergeable mergeStateStatus=${mstate:-?}"

  # §2 step 1 — the fetch also refreshes the local origin/<base> tracking ref that the
  # pre-push trailer-gate range exclusion reads; do not skip it.
  plan "git fetch origin $BASE $PR_BRANCH"
  git fetch origin "$BASE" "$PR_BRANCH" || { echo "ERROR: git fetch failed" >&2; return 5; }

  local slug
  slug=$(printf '%s' "$REPO" | tr -c 'A-Za-z0-9_.-' '-')
  SCRATCH="${TMPDIR:-/tmp}/getff-merge-forward/$slug/pr-$PR"
  if [ -d "$SCRATCH" ]; then
    verdict "SCRATCH-EXISTS" "pr=$PR path=$SCRATCH — a previous round left state there; resolve or drop it first (git worktree remove --force '$SCRATCH')"
    return 3
  fi
  plan "git worktree add --detach <scratch> $tip"
  if ! git worktree add --detach "$SCRATCH" "$tip" >/dev/null; then
    echo "ERROR: git worktree add failed" >&2
    return 5
  fi
  SCRATCH_CREATED=1

  # §2 step 3 — the trial merge; conflict is the expected outcome on this path.
  plan "git -C <scratch> merge --no-ff --no-edit origin/$BASE"
  if git -C "$SCRATCH" merge --no-ff --no-edit "origin/$BASE"; then
    if [ "$MODE" = "dry" ]; then
      verdict "DRY-UP-TO-DATE" "pr=$PR — trial merge is clean; no round needed (GitHub mergeable=$mergeable was stale or the conflict dissolved)"
    else
      verdict "CLEAN-NO-CONFLICT" "pr=$PR — merge origin/$BASE is CLEAN locally (GitHub mergeable=$mergeable); refusing to push a merge that resolves nothing (§10)"
    fi
    return 0
  fi
  unmerged=$(git -C "$SCRATCH" diff --name-only --diff-filter=U)
  if [ -z "$unmerged" ]; then
    echo "ERROR: merge failed without an unmerged list — inspect $SCRATCH by hand" >&2
    SCRATCH_PARK=1
    return 5
  fi

  # §2 step 4 — triage generated vs semantic (§4).
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if classify_path "$p"; then
      generated="$generated$p
"
    else
      semantic="$semantic$p
"
    fi
  done <<EOF
$unmerged
EOF
  local n_gen n_sem
  n_gen=$(printf '%s' "$generated" | grep -c . || true)
  n_sem=$(printf '%s' "$semantic" | grep -c . || true)
  echo "   unmerged: generated=$n_gen semantic=$n_sem"

  if [ "$MODE" = "dry" ]; then
    printf '%s' "$generated" | sed 's/^/   generated: /'
    printf '%s' "$semantic" | sed 's/^/   semantic:  /'
    if [ -n "$semantic" ]; then
      verdict "DRY-CONFLICTING-SEMANTIC" "pr=$PR generated=$n_gen semantic=$n_sem — a real round would PARK here (exit 4, merge left unpushed)"
      if [ "$KEEP" -eq 1 ]; then SCRATCH_PARK=1; fi
      return 4
    fi
    verdict "DRY-CONFLICTING-GENERATED" "pr=$PR generated=$n_gen semantic=0 — a real round would regenerate and push"
    return 0
  fi

  if [ -n "$semantic" ]; then
    echo "SEMANTIC conflicts — outside the generated set (git-conflict-merge-forward.md §4);"
    echo "the merge is PARKED unpushed in: $SCRATCH"
    printf '%s' "$semantic" | sed 's/^/   conflicted: /'
    SCRATCH_PARK=1
    verdict "PARKED-SEMANTIC" "pr=$PR semantic=$n_sem scratch=$SCRATCH"
    return 4
  fi

  # §2 step 5 — take either side; the regeneration below is the authoritative content.
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    if ! git -C "$SCRATCH" checkout --theirs -- "$p"; then
      echo "ERROR: git checkout --theirs failed for $p" >&2
      SCRATCH_PARK=1
      verdict "PARKED-CHECKOUT" "pr=$PR path=$p scratch=$SCRATCH"
      return 5
    fi
    git -C "$SCRATCH" add -- "$p" || { SCRATCH_PARK=1; verdict "PARKED-ADD" "pr=$PR path=$p"; return 5; }
  done <<EOF
$generated
EOF

  # §2 step 6 — regenerate each conflicted population with its own SSOT generator.
  if grep -q '^packages/getff/MANIFEST.sha256$' <<<"$generated"; then
    plan "(cd <scratch> && bash scripts/build-getff-dist.sh)   # regenerate MANIFEST.sha256"
    if ! (cd "$SCRATCH" && bash scripts/build-getff-dist.sh); then
      SCRATCH_PARK=1
      verdict "PARKED-REGEN" "pr=$PR step=build-getff-dist scratch=$SCRATCH"
      return 5
    fi
  fi
  if grep -q '^tests/install-sh/baselines/' <<<"$generated"; then
    plan "(cd <scratch> && SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh)   # regenerate baselines"
    if ! (cd "$SCRATCH" && SNAPSHOT_MODE=capture bash tests/install-sh/snapshot.sh); then
      SCRATCH_PARK=1
      verdict "PARKED-REGEN" "pr=$PR step=snapshot-capture scratch=$SCRATCH"
      return 5
    fi
  fi
  if grep -q '^plugin/hooks/' <<<"$generated"; then
    plan "(cd <scratch> && bash scripts/generate-plugin-twins.sh)"
    if ! (cd "$SCRATCH" && bash scripts/generate-plugin-twins.sh); then
      SCRATCH_PARK=1
      verdict "PARKED-REGEN" "pr=$PR step=generate-plugin-twins scratch=$SCRATCH"
      return 5
    fi
  fi
  if grep -q '^plugin/skills/' <<<"$generated"; then
    plan "(cd <scratch> && bash scripts/generate-plugin-skills.sh)"
    if ! (cd "$SCRATCH" && bash scripts/generate-plugin-skills.sh); then
      SCRATCH_PARK=1
      verdict "PARKED-REGEN" "pr=$PR step=generate-plugin-skills scratch=$SCRATCH"
      return 5
    fi
  fi
  if grep -q '^docs/site/' <<<"$generated"; then
    provision_node "rendering the site references needs node_modules (tsx/ajv)" || return 5
    plan "(cd <scratch> && npx tsx scripts/render-face-facts.mjs --write && npx tsx scripts/render-reference.mjs --write)   # regenerate rendered site references"
    if ! (cd "$SCRATCH" && npx tsx scripts/render-face-facts.mjs --write && npx tsx scripts/render-reference.mjs --write); then
      SCRATCH_PARK=1
      verdict "PARKED-REGEN" "pr=$PR step=render-site-references scratch=$SCRATCH"
      return 5
    fi
  fi

  # §2 step 7 — the pre-commit hook re-runs the twin/skills regeneration idempotently and
  # the merge-state gates (check-merge-pushed MERGE_HEAD arm, manifest --check-index).
  git -C "$SCRATCH" add -u
  plan "git -C <scratch> commit --no-edit"
  if ! git -C "$SCRATCH" commit --no-edit; then
    SCRATCH_PARK=1
    verdict "PARKED-COMMIT" "pr=$PR — commit rejected (read the hook output above); state kept in $SCRATCH"
    return 5
  fi
  newsha=$(git -C "$SCRATCH" rev-parse HEAD)
  echo "   merge commit: $newsha"

  # §2 step 8 — verify.
  if grep -q '^tests/install-sh/baselines/' <<<"$generated"; then
    plan "(cd <scratch> && SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh)"
    compare_out=$(cd "$SCRATCH" && SNAPSHOT_MODE=compare bash tests/install-sh/snapshot.sh 2>&1) || true
    printf '%s\n' "$compare_out" | grep '^Result:' || true
    case "$compare_out" in
      *"0 fail"*) : ;;
      *)
        printf '%s\n' "$compare_out" | tail -5
        SCRATCH_PARK=1
        verdict "PARKED-VERIFY" "pr=$PR step=snapshot-compare — not 'N pass / 0 fail'; state kept in $SCRATCH"
        return 5
        ;;
    esac
  fi
  if grep -q '^packages/getff/MANIFEST.sha256$' <<<"$generated"; then
    plan "(cd <scratch> && bash scripts/build-getff-dist.sh --check)"
    if ! (cd "$SCRATCH" && bash scripts/build-getff-dist.sh --check); then
      SCRATCH_PARK=1
      verdict "PARKED-VERIFY" "pr=$PR step=manifest-check scratch=$SCRATCH"
      return 5
    fi
  fi
  if grep -q '^docs/site/' <<<"$generated"; then
    plan "(cd <scratch> && npx tsx scripts/render-face-facts.mjs --check && npx tsx scripts/render-reference.mjs --check)"
    if ! (cd "$SCRATCH" && npx tsx scripts/render-face-facts.mjs --check && npx tsx scripts/render-reference.mjs --check); then
      SCRATCH_PARK=1
      verdict "PARKED-VERIFY" "pr=$PR step=render-check scratch=$SCRATCH"
      return 5
    fi
  fi

  pr_files=$(ghp view "$PR" --json files -q '.files[].path' 2>/dev/null || true)
  tests=$(printf '%s\n' "$pr_files" | grep -E '\.(test|spec)\.(ts|tsx|js|jsx|mjs)$' || true)
  if [ -n "$tests" ]; then
    provision_node "vitest needs node_modules in the scratch worktree" || return 5
    # shellcheck disable=SC2086  # repo-relative paths, no spaces in this repo
    plan "(cd <scratch> && npx vitest run $tests)"
    # shellcheck disable=SC2086
    if ! (cd "$SCRATCH" && npx vitest run $tests); then
      SCRATCH_PARK=1
      verdict "PARKED-VERIFY" "pr=$PR step=vitest — the PR's own tests are red on the merge head; state kept in $SCRATCH"
      return 5
    fi
  else
    echo "   no *.test.* / *.spec.* files in the PR diff — the vitest arm of §2 step 8 is skipped"
  fi

  # §9 — pr-body-fidelity pre-flight on the NEW head. An Audited-SHA mismatch is the
  # documented §9 case (b): report the obligation, do not rewrite the body, do not park.
  body_file=$(mktemp "${TMPDIR:-/tmp}/getff-merge-forward-body-pr-${PR}-XXXXXX") || body_file=""
  if [ -n "$body_file" ]; then
    ghp view "$PR" --json body -q .body >"$body_file" 2>/dev/null || true
    if [ -s "$body_file" ]; then
      provision_node "pr-body-fidelity-bin.ts needs node_modules (tsx)" || { rm -f "$body_file"; return 5; }
      body_out=$(cd "$SCRATCH" && BASE_REF="$BASE" PR_BODY="$(cat "$body_file")" HEAD_SHA="$newsha" \
        npx tsx packages/core/hooks/checks/pr-body-fidelity-bin.ts 2>&1) || body_rc=$?
      printf '%s\n' "$body_out"
      if [ "$body_rc" -eq 0 ]; then
        body_state="green"
      else
        case "$body_out" in
          *Audited-SHA*)
            body_state="stale-audited-sha"
            echo "   note: Audited-SHA no longer prefixes the head — expected on a conflicting PR (§9 case b):"
            echo "         the verdict earns a narrow cold delta check + a body refresh; not a park"
            ;;
          *)
            body_state="red"
            echo "   warning: pr-body-fidelity is RED on the new head — the 'fidelity-verdict-in-pr-body' CI check will follow;"
            echo "            refresh the PR body sections (the conflict itself is still worth un-parking)"
            ;;
        esac
      fi
    fi
    rm -f "$body_file"
  fi

  # §2 step 9 — the fast-forward interlock.
  if ! git -C "$SCRATCH" merge-base --is-ancestor "origin/$PR_BRANCH" HEAD; then
    SCRATCH_PARK=1
    verdict "PARKED-INTERLOCK" "pr=$PR — origin/$PR_BRANCH is NOT an ancestor of HEAD; refusing to push (§2 step 9)"
    return 5
  fi

  if [ "$PARK" -eq 1 ]; then
    SCRATCH_PARK=1
    verdict "PARKED-OK" "pr=$PR head=$newsha body=$body_state — round done, push withheld (--park); push by hand: git -C '$SCRATCH' push origin HEAD:refs/heads/$PR_BRANCH"
    return 0
  fi

  # §2 step 10 — plain push; git itself refuses a non-fast-forward, so no force exists here.
  plan "git -C <scratch> push origin HEAD:refs/heads/$PR_BRANCH   # plain push, fast-forward"
  if ! git -C "$SCRATCH" push origin "HEAD:refs/heads/$PR_BRANCH"; then
    git fetch origin "$PR_BRANCH" >/dev/null 2>&1 || true
    local moved
    moved=$(git rev-parse --verify "origin/$PR_BRANCH" 2>/dev/null || true)
    if [ -n "$moved" ] && [ "$moved" != "$tip" ]; then
      echo "   remote tip moved mid-round: $tip -> $moved (the round is deterministic — retrying)"
      git -C "$SCRATCH" merge --abort >/dev/null 2>&1 || true
      if git worktree remove --force "$SCRATCH" >/dev/null 2>&1; then
        SCRATCH_CREATED=0
      else
        SCRATCH_PARK=1
      fi
      verdict "RACE" "pr=$PR round=$ROUND_N — remote tip moved during the round; re-run the round"
      return 3
    fi
    SCRATCH_PARK=1
    verdict "PARKED-PUSH" "pr=$PR head=$newsha — push failed (non-race); merge commit kept in $SCRATCH"
    return 5
  fi

  PUSHED_SHA="$newsha"
  verdict "PUSHED" "pr=$PR round=$ROUND_N head=$newsha body=$body_state branch=$PR_BRANCH"
  return 0
}

wait_ci() { # watch arm after a PUSHED round; 10 = conflicting again, start the next round
  local wout wrc mmergeable mmstate agg agg_wait
  if [ ! -f "$CI_WAIT" ]; then
    verdict "NO-CIWAIT" "ci-wait not found at $CI_WAIT — watch by hand: bash <ci-wait> $PR --sha $PUSHED_SHA ${REPO:+--repo $REPO}"
    return 0
  fi
  echo "== ci-wait: waiting for CI on head $PUSHED_SHA (timeout ${TIMEOUT}s)"
  local wait_args="--sha $PUSHED_SHA --timeout $TIMEOUT"
  [ -n "$REPO" ] && wait_args="$wait_args --repo $REPO"
  # shellcheck disable=SC2086  # slug and numbers, no spaces
  wout=$(bash "$CI_WAIT" "$PR" $wait_args 2>&1)
  wrc=$?
  printf '%s\n' "$wout"
  case "$wrc" in
    0)
      # ci-wait can exit 0 while checks are still REGISTERING (0 pending at poll 1 over a
      # half-empty check set: measured live on PR #2017, 2026-10-03 — "GREEN: 11 pass" with
      # ci-success ABSENT and mergeStateStatus=BLOCKED). The ci-success aggregate is the
      # cheapest sufficient verdict (prior-art #1625/#1627 lesson): wait for it to resolve
      # before believing anything, bounded by the same --timeout budget.
      agg_wait=0
      agg=""
      while :; do
        agg=$(gh api "repos/$REPO/commits/$PUSHED_SHA/check-runs" --paginate \
          -q '.check_runs[] | select(.name=="ci-success") | .conclusion' 2>/dev/null | tail -1 || true)
        case "$agg" in success | failure) break ;; esac
        agg_wait=$((agg_wait + 1))
        if [ "$agg_wait" -gt $((TIMEOUT / 60)) ]; then break; fi
        sleep 60
      done
      if [ "$agg" = "failure" ]; then
        verdict "RED" "pr=$PR head=$PUSHED_SHA — ci-success=failure on THIS head; diagnose per-SHA (gh api .../commits/$PUSHED_SHA/check-runs --paginate); do not refresh by moving the head (§10)"
        return 1
      fi
      if grep -q '⚠' <<<"$wout"; then
        echo "   note: ⚠ lines above are blockers even at EXIT=0 — resolve per-SHA via gh api repos/<o>/<r>/commits/$PUSHED_SHA/check-runs"
      fi
      # the PR's mergeability decides whether the round must run again (2026-10-02, PR #1998)
      mmergeable=$(ghp view "$PR" --json mergeable -q .mergeable 2>/dev/null || true)
      mmstate=$(ghp view "$PR" --json mergeStateStatus -q '.mergeStateStatus // ""' 2>/dev/null || true)
      echo "   post-wait PR state: mergeable=$mmergeable mergeStateStatus=${mmstate:-?} ci-success=${agg:-ABSENT}"
      if [ "$mmergeable" = "CONFLICTING" ] || [ "$mmstate" = "DIRTY" ]; then
        if [ "$ROUND_N" -lt "$MAX_ROUNDS" ]; then
          echo "== conflicting again during the CI round — starting round $((ROUND_N + 1))"
          return 10
        fi
        verdict "WATCH-EXHAUSTED" "pr=$PR rounds=$ROUND_N — still conflicting after $ROUND_N rounds; raise --max-rounds or park"
        return 3
      fi
      if [ "$agg" != "success" ]; then
        verdict "PENDING" "pr=$PR head=$PUSHED_SHA — ci-success is '${agg:-ABSENT}' after ${TIMEOUT}s (checks never settled); re-run --watch or ci-wait later"
        return 3
      fi
      verdict "GREEN" "pr=$PR head=$PUSHED_SHA mergeable=$mmergeable mergeStateStatus=${mmstate:-?} ci-success=success — round(s) complete"
      return 0
      ;;
    1)
      verdict "RED" "pr=$PR head=$PUSHED_SHA — CI failed on THIS head; diagnose per-SHA (gh api .../commits/$PUSHED_SHA/check-runs --paginate); do not refresh by moving the head (§10)"
      return 1
      ;;
    3)
      verdict "PENDING" "pr=$PR head=$PUSHED_SHA — checks still pending after ${TIMEOUT}s; re-run --watch (or ci-wait) later"
      return 3
      ;;
    *)
      verdict "CIWAIT-ERROR" "pr=$PR ci-wait rc=$wrc"
      return 5
      ;;
  esac
}

main() {
  local rc wrc
  case "$MODE" in
    classify)
      do_classify
      exit $?
      ;;
  esac

  if [ -z "$PR" ]; then
    [ "$WATCH" -eq 1 ] && die 2 "--watch needs a PR argument"
    print_plan
    verdict "DRY-PLAN" "no PR given — dry by default; pass <PR> to run a real round, --dry-run <PR> to probe read-only"
    exit 0
  fi

  command -v gh >/dev/null 2>&1 || die 2 "gh CLI is required"
  git rev-parse --git-dir >/dev/null 2>&1 || die 2 "run from inside the repository checkout (the scratch worktree is created from it)"
  if [ -z "$REPO" ]; then
    REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null) || REPO=""
  fi
  [ -n "$REPO" ] || die 2 "could not resolve owner/repo — pass --repo <owner/repo>"

  if [ "$MODE" = "dry" ]; then
    ROUND_N=1
    round
    exit $?
  fi

  while :; do
    ROUND_N=$((ROUND_N + 1))
    PUSHED_SHA=""
    round
    rc=$?
    case "$rc" in
      0) : ;;
      3)
        if [ "$WATCH" -eq 1 ] && [ "$ROUND_N" -lt "$MAX_ROUNDS" ]; then
          continue
        fi
        exit "$rc"
        ;;
      *) exit "$rc" ;;
    esac
    if [ "$WATCH" -ne 1 ] || [ -z "$PUSHED_SHA" ]; then
      exit 0
    fi
    wait_ci
    wrc=$?
    case "$wrc" in
      10) continue ;;
      *) exit "$wrc" ;;
    esac
  done
}

# ── argument parsing ─────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --classify) MODE="classify"; shift ;;
    --dry-run) MODE="dry"; shift ;;
    --repo)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      REPO="$2"; shift 2
      ;;
    --base)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      BASE="$2"; shift 2
      ;;
    --branch)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      BRANCH_OVERRIDE="$2"; shift 2
      ;;
    --force-round) FORCE_ROUND=1; shift ;;
    --park) PARK=1; shift ;;
    --watch) WATCH=1; shift ;;
    --max-rounds)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      MAX_ROUNDS="$2"; shift 2
      ;;
    --timeout)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      TIMEOUT="$2"; shift 2
      ;;
    --keep) KEEP=1; shift ;;
    --ci-wait)
      [ $# -ge 2 ] || die 2 "option $1 needs a value"
      CI_WAIT="$2"; shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    --*) die 2 "unknown option: $1 (see --help)" ;;
    *)
      if [ "$MODE" = "classify" ]; then
        [ -z "$CLASSIFY_FILE" ] || die 2 "classify takes at most one input file"
        CLASSIFY_FILE="$1"
      else
        [ -z "$PR" ] || die 2 "exactly one PR argument is allowed"
        PR="$1"
      fi
      shift
      ;;
  esac
done

case "$MAX_ROUNDS" in ''|*[!0-9]*) die 2 "--max-rounds needs a number" ;; esac
case "$TIMEOUT" in ''|*[!0-9]*) die 2 "--timeout needs a number (seconds)" ;; esac
[ "$WATCH" -eq 0 ] || [ "$PARK" -eq 0 ] || die 2 "--watch and --park are mutually exclusive (a parked round has nothing to wait for)"
[ "$WATCH" -eq 0 ] || [ "$MODE" != "dry" ] || die 2 "--watch and --dry-run are mutually exclusive"

main
