#!/usr/bin/env bash
# run-generated-rule-mutation.test.sh — regression home for issue 1459:
# worktree-safe REPO_ROOT resolution in the shipped mutation runner.
#
# Live-fire contract (mirrors pre-merge-local.test.sh): every arm RUNS the real
# runner against a fixture and asserts its OUTPUT and exit code. Nothing here
# greps the runner's source text (one deliberate exception: the fixture-precondition
# guard on the pre-fix variant build, marked below).
#
# The defect (issue 1459): under a git hook inside a linked worktree, git exports
# GIT_DIR into the hook env; it overrides the runner's `cd "$SCRIPT_DIR"`, so
# `git rev-parse --show-toplevel` answers for the hook's git context and REPO_ROOT
# resolves as <worktree>/scripts instead of <worktree>. The runner prints REPO_ROOT
# nowhere — the only direct observation of the resolved root is the no-arg,
# manifest-absent die() message ("manifest not found: <root>/.ai-factory/...").
#
# Arms:
#   a  worktree-under-hook (T-CLP-A, load-bearing): real bare remote + linked
#      worktree + pre-push hook + a REAL `git push`. Direct invocation never sets
#      GIT_DIR, so it cannot witness this defect — the arm must go through the push.
#      Asserts both invocation shapes AND a pre-fix variant (built by transform at
#      test time — never a second checked-in copy of the runner) reproducing the
#      wrong root, so the arm proves both directions on every run.
#   b  plain clone — non-worktree layout: behaviour unchanged (paired control).
#   c  direct invocation with GIT_DIR unset — no hook: behaviour unchanged (control).
#
# Fixture hygiene (each of these silently makes arm (a) vacuous):
#   - GIT_CONFIG_GLOBAL isolates global git config — a global core.hooksPath
#     (husky sets one) would disable the fixture hook and the arm would pass for
#     the wrong reason.
#   - user.name / user.email / init.defaultBranch / commit.gpgsign=false are set
#     in the isolated global config.
#
# Portability: bash 3.2-compatible (no mapfile / associative arrays / ${var,,}),
# no GNU-only flags. Requires git >= 2.5 (worktree add) and node on PATH.

set -uo pipefail

# Same env-unguard pattern this stage repairs would be self-referential to keep
# unguarded here: a hook-exported GIT_DIR would misdirect TEST_ROOT identically.
TEST_ROOT="$(env -u GIT_DIR -u GIT_WORK_TREE git -C "$(dirname "$0")" rev-parse --show-toplevel)"
# Runner under test — overridable as $1 so the non-vacuity proof can point the
# test at a pre-fix copy; CI / sweep / principle 41 all invoke with NO argument,
# so the default must resolve to the tracked runner.
RUNNER="${1:-$TEST_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh}"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ok: $1"; }
bad() { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

# pwd -P: git rev-parse answers in PHYSICAL paths (macOS /var -> /private/var);
# a logical mktemp spelling would make every path-substring assertion compare
# two spellings of one directory.
SCRATCH="$(cd "$(mktemp -d)" && pwd -P)"
# shellcheck disable=SC2329  # invoked indirectly, via `trap cleanup EXIT`
cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT

GIT_CONFIG_GLOBAL="$SCRATCH/gitconfig"
export GIT_CONFIG_GLOBAL
cat > "$GIT_CONFIG_GLOBAL" <<'GCFG'
[user]
	name = mutation-root-test
	email = test@example.com
[init]
	defaultBranch = main
[commit]
	gpgsign = false
GCFG

assert_rc() { # <label> <expected-rc> <actual-rc-file>
  if [ "$(cat "$3")" = "$2" ]; then ok "$1 (rc=$2)"; else bad "$1 — expected rc=$2, got rc=$(cat "$3")"; fi
}
assert_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then ok "$1"; else
    bad "$1 — missing: $3"
    echo "      observed: $(head -n1 "$2" 2>/dev/null)"
  fi
}
assert_not_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then bad "$1 — must NOT contain: $3"; else ok "$1"; fi
}

# Build the pre-fix variant by transform at test time.
# COUPLING: the sed below matches the LITERAL TEXT of the fix on line 39 of
# run-generated-rule-mutation.sh (`env -u GIT_DIR -u GIT_WORK_TREE `). If you
# reword that line, update this sed — do NOT delete this arm; it is the
# non-vacuity proof that the fixture actually witnesses the defect.
build_prefix_variant() { # <dest>
  sed 's/env -u GIT_DIR -u GIT_WORK_TREE //' "$RUNNER" > "$1" || return 1
  if grep -q 'env -u GIT_DIR' "$RUNNER"; then
    # Fixture-construction precondition (not a correctness assertion): a no-op sed
    # after a future reword of line 39 would fail below with a misleading message.
    if cmp -s "$RUNNER" "$1"; then
      bad "pre-fix variant construction: sed was a NO-OP — line 39 wording drifted; update the transform, do not delete this arm"
      return 1
    fi
  else
    # Non-vacuity harness mode: the runner under test ($1 override) is ALREADY
    # pre-fix (no `env -u GIT_DIR` present). The variant is then a plain copy and
    # the fixed-shape assertions (a1/a2) below carry the expected RED.
    echo "  note: runner under test is already pre-fix — fixed-shape assertions will go RED by design"
  fi
  if grep -q 'env -u GIT_DIR' "$1"; then
    bad "pre-fix variant construction: copy still contains 'env -u GIT_DIR' — sed pattern drifted"
    return 1
  fi
  return 0
}

# Each control arm builds its OWN bare remote: the framework-layout controls
# (b)/(c) must not share the worktree-under-hook experiment's (a) fixture
# precondition (a failure in (a)'s fixture setup would otherwise mask as a
# control failure).
make_remote() { # <bare-path>
  local SEED="$1.seed"
  git init -q --bare "$1" || return 1
  git init -q "$SEED" || return 1
  echo fixture > "$SEED/seed.txt"
  git -C "$SEED" add seed.txt
  git -C "$SEED" commit -qm seed
  git -C "$SEED" push -q "$1" main
}

# ─── Arm (a): worktree-under-hook — the load-bearing one (T-CLP-A) ───────────
arm_a() {
  echo "arm (a): worktree-under-hook (real git push from a linked worktree)"
  local PRIMARY="$SCRATCH/primary" WT="$SCRATCH/wt" LOG="$SCRATCH/hooklog"
  mkdir -p "$LOG"

  git init -q --bare "$SCRATCH/remote.git" || { bad "arm (a): bare remote init failed"; return; }
  git init -q "$PRIMARY" || { bad "arm (a): fixture init failed"; return; }
  git -C "$PRIMARY" remote add origin "$SCRATCH/remote.git"
  echo fixture > "$PRIMARY/seed.txt"
  git -C "$PRIMARY" add seed.txt
  git -C "$PRIMARY" commit -qm seed
  git -C "$PRIMARY" push -q "$SCRATCH/remote.git" main

  git -C "$PRIMARY" worktree add -q "$WT" -b topic || { bad "arm (a): worktree add failed"; return; }

  # Delivered consumer layout: runner sits 1 level deep at <worktree>/scripts/.
  mkdir -p "$WT/scripts" "$WT/.githooks"
  cp "$RUNNER" "$WT/scripts/run-generated-rule-mutation.sh"
  build_prefix_variant "$WT/scripts/run-generated-rule-mutation.prefix.sh" || return

  # Pre-push hook: runs the runner in every shape, logs rc + output to $LOG.
  # Ordered so the manifest is ABSENT for the first two shapes, then provisioned.
  {
    echo '#!/bin/sh'
    echo "R=\"$WT/scripts/run-generated-rule-mutation.sh\""
    echo "P=\"$WT/scripts/run-generated-rule-mutation.prefix.sh\""
    echo "M=\"$WT/.ai-factory/synthesizer-output/rules-manifest-additions.json\""
    echo "L=\"$LOG\""
    cat <<'HOOK'
bash "$R" >"$L/f1.out" 2>"$L/f1.err"; echo $? >"$L/f1.rc"
bash "$P" >"$L/p1.out" 2>"$L/p1.err"; echo $? >"$L/p1.rc"
mkdir -p "$(dirname "$M")" "$WT_STUBS"
printf '{}\n' > "$M"
printf '#!/bin/sh\nexit 0\n' > "$WT_STUBS/tsx"
printf '#!/bin/sh\nexit 0\n' > "$WT_STUBS/eslint"
chmod +x "$WT_STUBS/tsx" "$WT_STUBS/eslint"
bash "$R" >"$L/f2.out" 2>"$L/f2.err"; echo $? >"$L/f2.rc"
bash "$R" "$M" >"$L/f3.out" 2>"$L/f3.err"; echo $? >"$L/f3.rc"
bash "$P" "$M" >"$L/p3.out" 2>"$L/p3.err"; echo $? >"$L/p3.rc"
exit 0
HOOK
  } > "$WT/.githooks/pre-push"
  sed -i.bak "s|\$WT_STUBS|$WT/node_modules/.bin|g" "$WT/.githooks/pre-push" && rm -f "$WT/.githooks/pre-push.bak"
  chmod +x "$WT/.githooks/pre-push"
  git -C "$WT" config core.hooksPath "$WT/.githooks"

  # A real commit on the pushed branch so the hook actually fires.
  git -C "$WT" add scripts .githooks
  git -C "$WT" commit -qm fixture
  git -C "$WT" push -q origin topic 2>"$SCRATCH/push.err" || { bad "arm (a): git push failed"; sed 's/^/    /' "$SCRATCH/push.err"; return; }

  # Shape 1 — no-arg, manifest ABSENT: the ONLY direct observation of the root.
  assert_rc "a1 fixed runner, manifest absent" 2 "$LOG/f1.rc"
  assert_contains "a1 die names <worktree>/.ai-factory" "$LOG/f1.err" "manifest not found: $WT/.ai-factory/"
  assert_not_contains "a1 fixed root is NOT <worktree>/scripts" "$LOG/f1.err" "manifest not found: $WT/scripts/"
  assert_rc "a1p pre-fix runner, manifest absent" 2 "$LOG/p1.rc"
  assert_contains "a1p pre-fix die names <worktree>/scripts/.ai-factory (wrong root witnessed)" "$LOG/p1.err" "manifest not found: $WT/scripts/.ai-factory/"

  # Shape 2 — no-arg, manifest PRESENT + tsx/eslint stubs: rc=0 reachable only if
  # both the manifest path and the .bin path resolved under <worktree>.
  assert_rc "a2 fixed runner, manifest + stubs provisioned" 0 "$LOG/f2.rc"
  assert_contains "a2 prints the nothing-to-test verdict" "$LOG/f2.out" "No declarative rules with negative-test inputs in manifest"

  # Shape 3 — explicit-manifest (the pre-push.ts consumer shape).
  assert_rc "a3 fixed runner, explicit manifest" 0 "$LOG/f3.rc"
  # Pre-fix expectation: tsx lookup under the WRONG root (<worktree>/scripts) fails
  # → "tsx not found" rc=2. EXCEPTION: the runner's third search candidate is the
  # absolute /app/node_modules/.bin — where it resolves (some containers), it masks
  # the wrong root and the pre-fix run reaches rc=0. The mask is environmental, not
  # a fix regression: the direct root observation is carried unconditionally by
  # a1/a1p above. On CI (no /app) the full assertion runs.
  if [ -x /app/node_modules/.bin/tsx ] && [ -x /app/node_modules/.bin/eslint ]; then
    # Uncounted: the mask branch is an environmental acknowledgement, not coverage —
    # keep the PASS total a coverage signal.
    echo "  skip: a3p pre-fix mask — /app fallback resolves .bin; wrong-root witness carried by a1p"
  else
    assert_rc "a3p pre-fix runner, explicit manifest" 2 "$LOG/p3.rc"
    assert_contains "a3p pre-fix dies 'tsx not found' (wrong .bin root)" "$LOG/p3.err" "tsx not found"
  fi
}

# ─── Arm (b): plain clone — non-worktree layout, behaviour unchanged ─────────
arm_b() {
  echo "arm (b): plain clone (control — layout axis)"
  local PLAIN="$SCRATCH/plain" REMOTE="$SCRATCH/remote-b.git"
  make_remote "$REMOTE" || { bad "arm (b): bare remote init failed"; return; }
  git clone -q "$REMOTE" "$PLAIN" 2>/dev/null || { bad "arm (b): clone failed"; return; }
  mkdir -p "$PLAIN/scripts" "$PLAIN/.ai-factory/synthesizer-output" "$PLAIN/node_modules/.bin"
  cp "$RUNNER" "$PLAIN/scripts/run-generated-rule-mutation.sh"
  printf '#!/bin/sh\nexit 0\n' > "$PLAIN/node_modules/.bin/tsx"
  printf '#!/bin/sh\nexit 0\n' > "$PLAIN/node_modules/.bin/eslint"
  chmod +x "$PLAIN/node_modules/.bin/tsx" "$PLAIN/node_modules/.bin/eslint"

  # Manifest absent: die must name the CLONE root (not <clone>/scripts) — direct
  # root observation in the plain-clone layout.
  bash "$PLAIN/scripts/run-generated-rule-mutation.sh" >"$SCRATCH/b1.out" 2>"$SCRATCH/b1.err"
  echo $? > "$SCRATCH/b1.rc"
  assert_rc "b1 manifest-absent die rc=2" 2 "$SCRATCH/b1.rc"
  assert_contains "b1 die names <clone>/.ai-factory" "$SCRATCH/b1.err" "manifest not found: $PLAIN/.ai-factory/"

  # Manifest present + stubs: unchanged green path.
  printf '{}\n' > "$PLAIN/.ai-factory/synthesizer-output/rules-manifest-additions.json"
  bash "$PLAIN/scripts/run-generated-rule-mutation.sh" >"$SCRATCH/b2.out" 2>"$SCRATCH/b2.err"
  echo $? > "$SCRATCH/b2.rc"
  assert_rc "b2 provisioned no-arg run rc=0" 0 "$SCRATCH/b2.rc"
  assert_contains "b2 prints the nothing-to-test verdict" "$SCRATCH/b2.out" "No declarative rules with negative-test inputs in manifest"
}

# ─── Arm (c): direct invocation, GIT_DIR unset — behaviour unchanged ─────────
arm_c() {
  echo "arm (c): direct invocation, GIT_DIR unset (control — hook axis)"
  local PLAIN="$SCRATCH/plain2" REMOTE="$SCRATCH/remote-c.git"
  make_remote "$REMOTE" || { bad "arm (c): bare remote init failed"; return; }
  git clone -q "$REMOTE" "$PLAIN" 2>/dev/null || { bad "arm (c): clone failed"; return; }
  mkdir -p "$PLAIN/scripts" "$PLAIN/.ai-factory/synthesizer-output" "$PLAIN/node_modules/.bin"
  cp "$RUNNER" "$PLAIN/scripts/run-generated-rule-mutation.sh"
  printf '#!/bin/sh\nexit 0\n' > "$PLAIN/node_modules/.bin/tsx"
  printf '#!/bin/sh\nexit 0\n' > "$PLAIN/node_modules/.bin/eslint"
  chmod +x "$PLAIN/node_modules/.bin/tsx" "$PLAIN/node_modules/.bin/eslint"
  printf '{}\n' > "$PLAIN/.ai-factory/synthesizer-output/rules-manifest-additions.json"

  # GIT_DIR explicitly cleared, invoked directly (the framework-repo audit-self channel).
  ( cd "$PLAIN" && env -u GIT_DIR -u GIT_WORK_TREE bash \
      "$PLAIN/scripts/run-generated-rule-mutation.sh" >"$SCRATCH/c1.out" 2>"$SCRATCH/c1.err" )
  echo $? > "$SCRATCH/c1.rc"
  assert_rc "c1 direct invocation, provisioned, rc=0" 0 "$SCRATCH/c1.rc"
  assert_contains "c1 prints the nothing-to-test verdict" "$SCRATCH/c1.out" "No declarative rules with negative-test inputs in manifest"
}

[ -f "$RUNNER" ] || { echo "runner not found: $RUNNER" >&2; exit 2; }
arm_a
arm_b
arm_c

echo
echo "run-generated-rule-mutation.test.sh: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
