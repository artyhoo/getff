#!/usr/bin/env bash
# pre-merge-local.test.sh — live-fire self-tests for the pre-merge carrier
# (pre-merge-local.sh) and the ci-available probe (ci-available-probe.sh).
#
# T-PMC-D contract: every arm RUNS the real script against a fixture repo and
# asserts its OUTPUT and exit code on a seeded outcome. Nothing here greps the
# scripts' source text — a self-test that cannot fail on a broken carrier
# proves nothing.
#
# Arms (spec §a.6 + kickoff §3):
#   1  three-sha contract — asserted on EVERY carrier arm below (W-1/T-PMC-B)
#   2  seeded failing gate            -> exit 1, FAIL verdict, failed_gates ledgered
#   3  seeded merge conflict          -> exit 2, distinct message + GitHub-runs-nothing warning
#   4  vacuity: declared gate skipped from the run (aggregate still exits 0) -> exit 90
#   5  PASS: log retained OUTSIDE the throwaway worktree; worktree cleaned up
#   6  F2 containment: base already in head -> merge = head (base already contained)
#   7  observability: NDJSON ledger line + copy-paste PR-body block on PASS
#   8  pin mismatch (.nvmrc)          -> exit 3, the pin named
#   9  unresolvable base ref          -> exit 64 (usage class, no verdict)
#   10 lock contention                -> exit 75
#   P1 probe: gh absent               -> exit 3, named
#   P2 probe: quota signature / red-with-steps / green / no-checks -> 4 / 1 / 0 / 2
#
# Environment notes:
# - Fixtures are throwaway git repos (mktemp -d); npm-run-all2 is not
#   installable offline, so fixture PATH prepends a shim that loops the gates
#   via `npm run` — npm prints the SAME "> pkg@version <script>" report
#   headers the production aggregate produces. Arm 4's shim variant silently
#   skips one declared gate while exiting 0 (the #1466 item-1 shape).
# - npm cache is redirected per fixture (container caches can be root-owned).
# - Requires git >= 2.28 (`git init -b`) and npm on PATH.

set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
CARRIER="$REPO_ROOT/packages/core/audit-self/pre-merge-local.sh"
PROBE="$REPO_ROOT/packages/core/audit-self/ci-available-probe.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

SCRATCH=$(mktemp -d)
cleanup() { rm -rf "$SCRATCH"; }
trap cleanup EXIT

assert_contains() { # <label> <haystack-file> <needle>
  if grep -qF -- "$3" "$2"; then ok "$1"; else bad "$1 — missing: $3"; fi
}
assert_three_shas() { # <label> <output-file>  (arm 1, on every carrier arm)
  _l=$1; _f=$2
  if grep -qE '^head:   [0-9a-f]{40}$' "$_f" && grep -qE '^base:   [0-9a-f]{40}' "$_f" && grep -qE '^merge:  ' "$_f"; then
    ok "$_l — three-sha block (head/base/merge)"
  else
    bad "$_l — three-sha block incomplete (W-1/T-PMC-B violation)"
  fi
}
run_carrier() { # <fixture> <base-ref> ; output -> $OUT, rc -> $RC
  OUT=$(cd "$1" && npm_config_cache="$1/.npm-cache" bash "$CARRIER" "$2" 2>&1); RC=$?
  printf '%s\n' "$OUT" > "$1/.last-out"
}

# make_fixture <lint-script-body> — base advanced after branching, so a REAL
# merge is constructed; prints the fixture dir. Uses the honest shim.
make_fixture() {
  local T
  T=$(mktemp -d)
  cat > "$T/package.json" <<EOF
{
  "name": "fixture-pkg",
  "version": "0.0.0",
  "scripts": {
    "validate": "npm-run-all2 --parallel typecheck lint",
    "typecheck": "echo tc-ok",
    "lint": "$1"
  }
}
EOF
  printf '%s\n' '{"name":"fixture-pkg","version":"0.0.0","lockfileVersion":3,"requires":true,"packages":{"":{"name":"fixture-pkg","version":"0.0.0"}}}' > "$T/package-lock.json"
  mkdir -p "$T/.shim-bin" "$T/.shim-skip"
  printf '%s\n' '#!/usr/bin/env bash' \
    'args=(); for a in "$@"; do case "$a" in --*) ;; *) args+=("$a");; esac; done' \
    'for g in "${args[@]}"; do npm run "$g" || exit 1; done' > "$T/.shim-bin/npm-run-all2"
  printf '%s\n' '#!/usr/bin/env bash' \
    'args=(); for a in "$@"; do case "$a" in --*) ;; *) args+=("$a");; esac; done' \
    'for g in "${args[@]}"; do [ "$g" = lint ] && continue; npm run "$g"; done' > "$T/.shim-skip/npm-run-all2"
  chmod +x "$T/.shim-bin/npm-run-all2" "$T/.shim-skip/npm-run-all2"
  git -C "$T" init -q -b main
  git -C "$T" config user.email t@t; git -C "$T" config user.name T
  git -C "$T" add -A; git -C "$T" commit -qm base
  git -C "$T" checkout -qb feature/x
  echo head-change > "$T/head.txt"; git -C "$T" add -A; git -C "$T" commit -qm headwork
  git -C "$T" checkout -q main
  echo base-change > "$T/base.txt"; git -C "$T" add -A; git -C "$T" commit -qm basework
  git -C "$T" checkout -q feature/x
  echo "$T"
}

echo "== carrier arms =="

# ── arm 5 + 7 + 1: the PASS reference run (log retention, ledger, PR-body) ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 0 ] && ok "arm5/7: PASS exit 0" || bad "arm5/7: expected exit 0, got $RC"
assert_three_shas "arm1(PASS)" "$T/.last-out"
assert_contains "arm5: LOCAL PRE-MERGE PASS string (§e.1)" "$T/.last-out" "LOCAL PRE-MERGE PASS"
assert_contains "arm5: weaker-evidence sentence (§e.1)" "$T/.last-out" "weaker evidence than CI"
assert_contains "arm7: PR-body citation block (§e.4)" "$T/.last-out" "Local pre-merge run: PASS"
assert_contains "arm5: NOT COVERED list present (§e.2)" "$T/.last-out" "NOT COVERED (CI legs not reproduced locally)"
LEDGER="$T/.git/getff/pre-merge-runs.ndjson"
if [ -f "$LEDGER" ] && tail -n 1 "$LEDGER" | grep -q '"verdict":"PASS"' \
   && tail -n 1 "$LEDGER" | grep -q '"failed_gates":\[\]' \
   && tail -n 1 "$LEDGER" | grep -qE '"(ts|remote|head|base|merge|duration_s)":'; then
  ok "arm7: NDJSON ledger line with §f.1 fields"
else
  bad "arm7: ledger line missing/malformed at $LEDGER"
fi
MERGE_SHA_LOG=$(ls "$T/.git/getff/pre-merge-logs"/*.log 2>/dev/null | head -1)
[ -n "$MERGE_SHA_LOG" ] && ok "arm5: PASS log retained outside the worktree ($(basename "$MERGE_SHA_LOG"))" \
  || bad "arm5: no retained log under .git/getff/pre-merge-logs/"
if [ -z "$(ls -A "$T/.git/getff/pre-merge-worktrees" 2>/dev/null)" ]; then
  ok "arm5: throwaway worktree cleaned up"
else
  bad "arm5: worktree residue left behind"
fi
# arm 1 sharp edge: on a REAL merge (base advanced), merge sha must differ
# from the head sha — the verified sha is the merge result, not the head.
HEAD_SHA=$(git -C "$T" rev-parse HEAD)
if grep -q "base already contained" "$T/.last-out"; then
  bad "arm1: unexpected containment on advanced-base fixture"
elif grep -q "^merge:  $HEAD_SHA" "$T/.last-out"; then
  bad "arm1: verified sha equals head sha on a real merge (#1466 defect shape)"
else
  ok "arm1: real-merge run gates a merge sha distinct from head"
fi
export PATH=$PATH_SAVE

# ── arm 2: seeded failing gate -> 1 ──
T=$(make_fixture "exit 1")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 1 ] && ok "arm2: failing gate -> exit 1" || bad "arm2: expected 1, got $RC"
assert_three_shas "arm1(FAIL)" "$T/.last-out"
assert_contains "arm2: FAIL verdict names the merge result" "$T/.last-out" "gate(s) red on the merge result"
tail -n 1 "$T/.git/getff/pre-merge-runs.ndjson" | grep -q '"verdict":"FAIL"' \
  && ok "arm2: FAIL ledgered" || bad "arm2: FAIL not ledgered"
export PATH=$PATH_SAVE

# ── arm 3: seeded conflict -> 2 ──
T=$(make_fixture "echo lint-ok")
echo conflict-line > "$T/shared.txt"; git -C "$T" add -A; git -C "$T" commit -qm headconf
git -C "$T" checkout -q main
echo different-line > "$T/shared.txt"; git -C "$T" add -A; git -C "$T" commit -qm baseconf
git -C "$T" checkout -q feature/x
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 2 ] && ok "arm3: conflict -> exit 2" || bad "arm3: expected 2, got $RC"
assert_three_shas "arm1(CONFLICT)" "$T/.last-out"
assert_contains "arm3: merge: CONFLICT display (§a.2)" "$T/.last-out" "merge:  CONFLICT"
assert_contains "arm3: GitHub-runs-nothing warning (§e.3)" "$T/.last-out" "GitHub runs no pull_request workflow at all in this state"
assert_contains "arm3: conflicted file named" "$T/.last-out" "conflicted: shared.txt"
export PATH=$PATH_SAVE

# ── arm 4: vacuity -> 90 (shim skips 'lint', aggregate exits 0) ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-skip:$PATH"
run_carrier "$T" main
[ "$RC" -eq 90 ] && ok "arm4: declared gate never reported -> exit 90" || bad "arm4: expected 90, got $RC"
assert_three_shas "arm1(VACUITY)" "$T/.last-out"
assert_contains "arm4: never-reported gate named" "$T/.last-out" "never reported: lint"
export PATH=$PATH_SAVE

# ── arm 6: F2 containment ──
T=$(make_fixture "echo lint-ok")
BRANCH_BASE=$(git -C "$T" rev-parse HEAD~1)
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" "$BRANCH_BASE"
[ "$RC" -eq 0 ] && ok "arm6: containment proceeds (F2), exit per gates" || bad "arm6: expected 0, got $RC"
assert_three_shas "arm1(F2)" "$T/.last-out"
assert_contains "arm6: merge = head (base already contained)" "$T/.last-out" "merge = head (base already contained)"
HEAD_NOW=$(git -C "$T" rev-parse HEAD)
if grep -q "^merge:  $HEAD_NOW" "$T/.last-out"; then
  ok "arm6: merge equals HEAD (correct under F2), three shas intact"
else
  bad "arm6: merge display does not carry the head sha"
fi
grep -q "^head:   $HEAD_NOW" "$T/.last-out" && ok "arm6: head sha reported" || bad "arm6: head sha missing"
export PATH=$PATH_SAVE

# ── arm 8: pin mismatch -> 3 ──
T=$(make_fixture "echo lint-ok")
echo 42 > "$T/.nvmrc"; git -C "$T" add -A; git -C "$T" commit -qm pin
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
if [ "$RC" -eq 3 ]; then
  ok "arm8: node/.nvmrc major mismatch -> exit 3"
  assert_contains "arm8: the pin named" "$T/.last-out" ".nvmrc"
  assert_three_shas "arm1(CANNOT-RUN)" "$T/.last-out"
else
  # host node major == 42 only in a fixture universe; treat 0 as env-unreachable
  bad "arm8: expected 3, got $RC (host node major == 42?)"
fi
export PATH=$PATH_SAVE

# ── arm 9: unresolvable base -> 64, no verdict/ledger ──
T=$(make_fixture "echo lint-ok")
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" no-such-ref
[ "$RC" -eq 64 ] && ok "arm9: unresolvable base -> exit 64 (usage class)" || bad "arm9: expected 64, got $RC"
[ -f "$T/.git/getff/pre-merge-runs.ndjson" ] && bad "arm9: usage error must not ledger" || ok "arm9: no ledger line for usage error"
export PATH=$PATH_SAVE

# ── arm 10: lock contention -> 75 ──
T=$(make_fixture "echo lint-ok")
mkdir -p "$T/.git/getff/pre-merge-carrier.lock"
PATH_SAVE=$PATH; export PATH="$T/.shim-bin:$PATH"
run_carrier "$T" main
[ "$RC" -eq 75 ] && ok "arm10: held lock -> exit 75" || bad "arm10: expected 75, got $RC"
export PATH=$PATH_SAVE

echo "== probe arms =="

# ── P1: gh absent -> 3 ──
P=$(mktemp -d); git -C "$P" init -q; git -C "$P" remote add origin git@github.com:acme/widget.git
git -C "$P" config user.email t@t; git -C "$P" config user.name T
echo x > "$P/f"; git -C "$P" add -A; git -C "$P" commit -qm c1
mkdir -p "$P/p1bin"; ln -s "$(command -v git)" "$P/p1bin/git"
OUT=$(cd "$P" && PATH="$P/p1bin" /bin/bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 3 ] && ok "P1: gh absent -> exit 3" || bad "P1: expected 3, got $RC"
case "$OUT" in *"gh (GitHub CLI) is required"*) ok "P1: gh named as the missing tool";; *) bad "P1: gh not named";; esac

# make_gh_shim <fixture-dir> <tsv-lines...>  — simulates gh INCLUDING --jq
make_gh_shim() {
  local dir=$1; shift
  mkdir -p "$dir/.ghbin"
  {
    echo '#!/usr/bin/env bash'
    echo 'case "$2" in'
    for entry in "$@"; do
      printf '%s\n' "$entry"
    done
    echo '  *) echo "unexpected gh call: $*" >&2; exit 1 ;;'
    echo 'esac'
  } > "$dir/.ghbin/gh"
  chmod +x "$dir/.ghbin/gh"
}

# ── P2a: the quota signature -> 4 ──
make_gh_shim "$P" \
  '  repos/acme/widget/check-runs/9001/annotations) printf "%s\n" "The runner has received a job, but billing quota is exhausted" ;;' \
  '  repos/acme/widget/check-runs/9001) printf "%s\n" "[0,2]" ;;' \
  '  */check-runs) printf "9001\tlint\tcompleted\tfailure\t15368\n9002\tcodecov\tcompleted\tsuccess\t9999\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 4 ] && ok "P2a: quota signature -> exit 4 (CI UNAVAILABLE)" || bad "P2a: expected 4, got $RC"
case "$OUT" in *"CI UNAVAILABLE (Actions quota/billing)"*) ok "P2a: UNAVAILABLE named";; *) bad "P2a: UNAVAILABLE not named";; esac
case "$OUT" in *"billing quota is exhausted"*) ok "P2a: annotation names the true cause";; *) bad "P2a: annotation cause missing";; esac

# ── P2b: first-party failure WITH steps -> 1 (not the signature) ──
make_gh_shim "$P" \
  '  repos/acme/widget/check-runs/7001) printf "%s\n" "[1,90]" ;;' \
  '  */check-runs) printf "7001\tlint\tcompleted\tfailure\t15368\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 1 ] && ok "P2b: real red (steps ran) -> exit 1" || bad "P2b: expected 1, got $RC"

# ── P2c: all green -> 0 ──
make_gh_shim "$P" \
  '  */check-runs) printf "1\tlint\tcompleted\tsuccess\t15368\n" ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 0 ] && ok "P2c: all success -> exit 0" || bad "P2c: expected 0, got $RC"

# ── P2d: no check-runs -> 2 (pending / no-workflow-state) ──
make_gh_shim "$P" \
  '  */check-runs) : ;;'
OUT=$(cd "$P" && PATH="$P/.ghbin:$PATH" bash "$PROBE" HEAD 2>&1); RC=$?
[ "$RC" -eq 2 ] && ok "P2d: no check-runs -> exit 2" || bad "P2d: expected 2, got $RC"
case "$OUT" in *"MERGE CONFLICT looks exactly like this"*) ok "P2d: conflict-state hint present";; *) bad "P2d: conflict hint missing";; esac

echo ""
echo "Result: $PASS pass / $FAIL fail"
[ "$FAIL" -eq 0 ]
