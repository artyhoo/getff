#!/usr/bin/env bash
# refresh-aif-base.test.sh — fixture test for refresh-aif-base.sh
#
# Exercises acceptance criteria 1-5 (kickoff §3) against a throwaway local git
# repo. HERMETIC ON BOTH HALVES (per rework §a — fix the test, not the helper):
#
#   IN-CONTAINER HALF (docker exec/cp/ps, gh api): docker and gh are EXPLICITLY
#   EXPORTED BASH FUNCTIONS that delegate to the stub scripts in stubs/. Exported
#   functions take precedence over PATH lookups in child bash, so the stubs win
#   regardless of whether real docker/gh binaries are on PATH. The helper's own
#   `export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"` at line 37 PREPENDS
#   those dirs but cannot unset the functions — they are independent of PATH.
#
#   HOST HALF (helper host-side git at :49 cd, :50 remote, :179 rev-parse,
#   :196 bundle create): the helper is invoked with $WORK (the fixture repo) as
#   CWD. The helper's own `cd "$(git rev-parse --show-toplevel)"` then lands in
#   the fixture, and all subsequent host-side git operations operate on the
#   fixture — never on the caller's real repository. The original test invoked
#   the helper from the caller's CWD, so on a real-host run these resolved
#   against the live repo (`real_tip=d6291de`, `bundle 12M`).
#
# ENVIRONMENT-INDEPENDENCE PROOF (per rework §b — must pass with real docker on
# PATH). The original test was green only inside a container that has no docker
# binary at all, where stubs/$STUBS_DIR was the only docker on PATH — the exact
# condition that hid the problem. A green run in that environment is meaningless.
# To make environment-independence LOAD-BEARING rather than asserted, the suite
# prepends a DECOY BIN to PATH containing `docker` and `gh` scripts that exit 99
# with a loud message if ever hit. Bash function override wins over PATH lookup,
# so the decoys are never reached. A green run with decoys on PATH is structural
# proof the override works — and the decoy is the strongest signal short of
# having a real docker binary present (a real docker would either succeed-and-
# corrupt-the-fixture or fail-and-fall-through; the decoy deterministically
# fails loud the moment the override regresses).
#
# SYNC-HELPER GUARD. The helper's fallback (line 181) invokes an operator-local
# sync helper at $AIF_SYNC_HELPER if present. We set AIF_SYNC_HELPER to a
# nonexistent path so the fallback cannot accidentally invoke a real one when
# the host happens to have it.
#
# Run: bash tests/aif-doctor/refresh-aif-base.test.sh
set -uo pipefail

STUBS_DIR="$(cd "$(dirname "$0")/stubs" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HELPER="$SCRIPT_DIR/../../.claude/skills/aif-doctor/helpers/refresh-aif-base.sh"

PASS=0; FAIL=0
record_pass() { PASS=$((PASS + 1)); echo "  [PASS] $*"; }
record_fail() { FAIL=$((FAIL + 1)); echo "  [FAIL] $*"; }

ORIGIN=""; WORK=""; SHA_A=""; SHA_B=""
HELPER_OUTPUT=""; HELPER_EXIT=""
DECOY_BIN=""

cleanup() {
  [ -n "$ORIGIN"    ] && rm -rf "$ORIGIN"    2>/dev/null || true
  [ -n "$WORK"      ] && rm -rf "$WORK"      2>/dev/null || true
  [ -n "$DECOY_BIN" ] && rm -rf "$DECOY_BIN" 2>/dev/null || true
}
trap cleanup EXIT

# ── Stub FUNCTIONS: override PATH lookups in child bash ─────────────────────────────
# Defined + exported BEFORE any helper invocation. The helper (run as
# `bash "$HELPER"`) inherits these; bash resolves functions BEFORE PATH, so real
# docker/gh binaries on PATH (e.g. host machine /opt/homebrew/bin/docker) are
# never reached. The decoy bin below makes this load-bearing.
#
# `export STUBS_DIR` is REQUIRED alongside `export -f`: the function body
# references $STUBS_DIR at call time, and the helper runs with `set -uo
# pipefail`, so an unbound STUBS_DIR in the child shell would hard-fail the
# function call (and surface as REAL="" / "gh api unreachable").
export STUBS_DIR
docker() { "$STUBS_DIR/docker" "$@"; }
gh()     { "$STUBS_DIR/gh"     "$@"; }
export -f docker gh

# ── Decoy bin — load-bearing proof of environment-independence ──────────────────────
# If a stub function ever fails to override (bash version weirdness, function
# accidentally unset, etc.), the decoy is hit and the test fails loudly. Green
# with decoys on PATH proves the stub-function override is what's working — not
# absence of real docker/gh on PATH (the original test's hidden assumption).
DECOY_BIN="$(mktemp -d)"
cat > "$DECOY_BIN/docker" <<'EOF'
#!/usr/bin/env bash
echo "DECOY docker HIT — exported-function override failed; suite is NOT environment-independent" >&2
exit 99
EOF
chmod +x "$DECOY_BIN/docker"
cat > "$DECOY_BIN/gh" <<'EOF'
#!/usr/bin/env bash
echo "DECOY gh HIT — exported-function override failed; suite is NOT environment-independent" >&2
exit 99
EOF
chmod +x "$DECOY_BIN/gh"
export PATH="$DECOY_BIN:$PATH"

# ── Fixture ─────────────────────────────────────────────────────────────────────────
# Creates ORIGIN (bare repo, staging at SHA_B with commits A→B) and WORK (clone at SHA_A,
# staging checked out). Sets globals: ORIGIN, WORK, SHA_A, SHA_B.
setup_base_fixture() {
  ORIGIN="$(mktemp -d)"; git init -q --bare "$ORIGIN"

  local seed; seed="$(mktemp -d)"
  git init -q "$seed"
  git -C "$seed" config user.email t@t.tt
  git -C "$seed" config user.name  t
  git -C "$seed" checkout -q -b staging

  echo "v1" > "$seed/file.txt"
  git -C "$seed" add file.txt
  GIT_AUTHOR_DATE="2026-01-01T00:00:00" GIT_COMMITTER_DATE="2026-01-01T00:00:00" \
    git -C "$seed" commit -q -m "initial"
  SHA_A="$(git -C "$seed" rev-parse staging)"
  git -C "$seed" remote add origin "$ORIGIN"
  git -C "$seed" push -q origin staging

  echo "v2" > "$seed/file.txt"
  GIT_AUTHOR_DATE="2026-01-02T00:00:00" GIT_COMMITTER_DATE="2026-01-02T00:00:00" \
    git -C "$seed" commit -q -am "descendant"
  SHA_B="$(git -C "$seed" rev-parse staging)"
  git -C "$seed" push -q origin staging

  WORK="$(mktemp -d)"
  git clone -q "$ORIGIN" "$WORK"
  git -C "$WORK" config user.email t@t.tt
  git -C "$WORK" config user.name  t
  # Move working clone to SHA_A (behind origin) without git reset --hard (banned per kickoff §4)
  git -C "$WORK" checkout -q "$SHA_A"
  git -C "$WORK" branch -f staging "$SHA_A"
  git -C "$WORK" checkout -q staging
  rm -rf "$seed"
}

# ── Run helper against fixture, capture exit + output ────────────────────────────────
# TWO HERMETICITY SEAMS (state explicitly per rework §a):
#   1. docker/gh stub FUNCTIONS exported above (in-container half).
#   2. CWD = $WORK via `cd "$WORK"` (host half) — the helper's
#      `cd "$(git rev-parse --show-toplevel)"` lands in the fixture, and all
#      host-side git operations (helper :49 cd, :50 remote, :179 rev-parse,
#      :196 bundle create) operate on the fixture repo, not the caller's real repo.
# AIF_SYNC_HELPER=/nonexistent-sync-helper prevents the helper's fallback branch
# from invoking a real operator-local sync helper if one exists on the host.
run_helper() {
  local real_sha="$1"
  export STUB_REAL_SHA="$real_sha"
  export AIF_AGENT_CONTAINER="aif-test-agent"
  export AIF_CONTAINER_REPO="$WORK"
  export AIF_SYNC_HELPER="/nonexistent-sync-helper"
  HELPER_OUTPUT="$(cd "$WORK" && bash "$HELPER" staging 2>&1)"
  HELPER_EXIT=$?
}

# ── AC1: ref-current + tree-parked is DETECTED, not passed ───────────────────────────
test_ac1() {
  echo ""
  echo "=== AC1: ref-current + tree-parked is DETECTED, not passed ==="
  setup_base_fixture
  # Parked: staging ref at target (SHA_B), HEAD on 'other' at SHA_A
  git -C "$WORK" checkout -q -b other "$SHA_A"
  git -C "$WORK" branch -f staging "$SHA_B"

  run_helper "$SHA_B"
  echo "  exit=$HELPER_EXIT"
  echo "$HELPER_OUTPUT" | sed 's/^/    /'

  if printf '%s' "$HELPER_OUTPUT" | grep -qiE "no-op" \
     && [ "$HELPER_EXIT" -eq 0 ] \
     && ! printf '%s' "$HELPER_OUTPUT" | grep -qi "other"; then
    record_fail "helper took ref-only no-op exit — parked tree not detected (defect 1)"
  elif printf '%s' "$HELPER_OUTPUT" | grep -qi "other"; then
    record_pass "helper detected parked state and named the branch"
  else
    record_fail "unexpected output — neither no-op nor parked-branch named"
  fi
  cleanup; ORIGIN=""; WORK=""
}

# ── AC2: realign lands — both ref and HEAD at target after run ───────────────────────
test_ac2() {
  echo ""
  echo "=== AC2: realign lands — ref and HEAD both at target after run ==="
  setup_base_fixture
  git -C "$WORK" checkout -q -b other "$SHA_A"
  git -C "$WORK" branch -f staging "$SHA_B"

  run_helper "$SHA_B"
  echo "  exit=$HELPER_EXIT"
  echo "$HELPER_OUTPUT" | sed 's/^/    /'

  local ref_now head_now
  ref_now="$(git  -C "$WORK" rev-parse staging 2>/dev/null || echo none)"
  head_now="$(git -C "$WORK" rev-parse HEAD    2>/dev/null || echo none)"
  echo "  post-run: staging=${ref_now:0:7}  HEAD=${head_now:0:7}  target=${SHA_B:0:7}"

  if [ "$ref_now" = "$SHA_B" ] && [ "$head_now" = "$SHA_B" ]; then
    record_pass "both ref and HEAD at target after realign"
  else
    record_fail "ref=${ref_now:0:7} head=${head_now:0:7} != target=${SHA_B:0:7}"
  fi
  cleanup; ORIGIN=""; WORK=""
}

# ── AC3: checked-out branch refresh works ────────────────────────────────────────────
test_ac3() {
  echo ""
  echo "=== AC3: checked-out branch refresh (no 'cannot force update') ==="
  setup_base_fixture
  # Base fixture: staging checked out at SHA_A, origin/staging at SHA_B

  run_helper "$SHA_B"
  echo "  exit=$HELPER_EXIT"
  echo "$HELPER_OUTPUT" | sed 's/^/    /'

  local ref_now head_now
  ref_now="$(git  -C "$WORK" rev-parse staging 2>/dev/null || echo none)"
  head_now="$(git -C "$WORK" rev-parse HEAD    2>/dev/null || echo none)"
  echo "  post-run: staging=${ref_now:0:7}  HEAD=${head_now:0:7}  target=${SHA_B:0:7}"

  if [ "$ref_now" = "$SHA_B" ] && [ "$head_now" = "$SHA_B" ] && [ "$HELPER_EXIT" -eq 0 ]; then
    record_pass "checked-out branch refreshed to target"
  else
    record_fail "ref=${ref_now:0:7} head=${head_now:0:7} exit=$HELPER_EXIT — defect 2: branch -f refused on checked-out branch"
  fi
  cleanup; ORIGIN=""; WORK=""
}

# ── AC4: true no-op — fast and quiet when ref AND HEAD both at target ────────────────
test_ac4() {
  echo ""
  echo "=== AC4: true no-op — ref and HEAD both at target ==="
  setup_base_fixture
  # Move both ref and HEAD to SHA_B
  git -C "$WORK" checkout -q "$SHA_B"
  git -C "$WORK" branch -f staging "$SHA_B"
  git -C "$WORK" checkout -q staging

  run_helper "$SHA_B"
  echo "  exit=$HELPER_EXIT"
  echo "$HELPER_OUTPUT" | sed 's/^/    /'

  if [ "$HELPER_EXIT" -eq 0 ] && printf '%s' "$HELPER_OUTPUT" | grep -qiE "already current|no-op"; then
    record_pass "fast no-op on current base"
  else
    record_fail "exit=$HELPER_EXIT — expected fast no-op"
  fi
  cleanup; ORIGIN=""; WORK=""
}

# ── AC5: dirty tracked changes abort ─────────────────────────────────────────────────
test_ac5() {
  echo ""
  echo "=== AC5: dirty tracked changes abort ==="
  setup_base_fixture
  # Plant uncommitted tracked modification
  echo "dirty change" >> "$WORK/file.txt"

  run_helper "$SHA_B"
  echo "  exit=$HELPER_EXIT"
  echo "$HELPER_OUTPUT" | sed 's/^/    /'

  local ref_now head_now
  ref_now="$(git  -C "$WORK" rev-parse staging 2>/dev/null || echo none)"
  head_now="$(git -C "$WORK" rev-parse HEAD    2>/dev/null || echo none)"
  echo "  post-run: staging=${ref_now:0:7}  HEAD=${head_now:0:7}  (expected: staging=${SHA_A:0:7}, nothing moved)"

  if [ "$HELPER_EXIT" -ne 0 ] \
     && printf '%s' "$HELPER_OUTPUT" | grep -qiE "file\.txt|dirty|uncommitted"; then
    record_pass "dirty tracked changes aborted with file named"
  elif [ "$ref_now" != "$SHA_A" ] || [ "$head_now" != "$SHA_A" ]; then
    record_fail "dirty checkout was moved — ref=${ref_now:0:7} head=${head_now:0:7} (expected no movement)"
  else
    record_fail "exit=$HELPER_EXIT but dirty file not named in output"
  fi
  cleanup; ORIGIN=""; WORK=""
}

# ── Main ────────────────────────────────────────────────────────────────────────────
echo "refresh-aif-base.sh fixture test"
echo "Helper:    $HELPER"
echo "Stubs:     $STUBS_DIR (invoked via exported bash functions)"
echo "Decoy bin: $DECOY_BIN (docker/gh fail-loud probes on PATH)"
echo "Date:      $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Hermeticity seams (per rework §a):"
echo "  - in-container half: docker/gh exported FUNCTIONS override PATH lookups"
echo "    (helper :37 'export PATH=/opt/homebrew/bin:/usr/local/bin:\$PATH' cannot unset them)"
echo "  - host half: helper runs with \$WORK as CWD (helper :49 cd, :50/179/196 git ops on fixture)"
echo "  - decoy on PATH: any function-override regression -> exit 99 loud (per rework §b)"
echo ""

test_ac1
test_ac2
test_ac3
test_ac4
test_ac5

echo ""
echo "================================================================"
echo "Results: $PASS passed, $FAIL failed (of $((PASS + FAIL)))"
echo "================================================================"
[ "$FAIL" -eq 0 ] || exit 1
