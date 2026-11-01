#!/usr/bin/env bash
# K3 outer control (amended-4 A4-K3) — the UNCHANGED driver over the REAL cf2a/cf2b
# judging channel.
#
# Governed inputs (fixed across pristine/mutant/restored arms):
#   - the three original q3 companions + subject, byte-identical copies from the
#     isolated scratch repo's committed corpus (original32 untouched);
#   - two frozen VIOLATING companions from the packet fixtures dir:
#       q3-wrong-diagnostic.test.ts — fails under each fault WITHOUT the intended
#         diagnostic /expected true to be false/ (wrong-diagnostic kill claim);
#       q3-survival-claim.test.ts   — stays green under each fault while claimed
#         as a kill (survival credit claim).
#
# The judge is ALWAYS the real scripts/test-assurance/counterfactuals/
# counterfactual-lib.sh of $AM4_REPO (apply_patch_once / run_scratch_vitest /
# expect_file_status / expect_intended — sourced, never reimplemented).
#
# Verdict logic (driver bytes identical in every arm — only the judge differs):
#   genuine judge : intended kill ADMITTED (admit rc=0) AND wrong-diagnostic
#                   credit REFUSED (rc=1) AND survival credit REFUSED (rc=1)
#                   -> K3-CONTROL-OK, exit 0
#   permissive    : wrong-diagnostic companion improperly ACCEPTED (rc=0)
#                   -> K3-CONTROL-FAIL, exit 1
#   over-rejecting: legitimate intended kill refused (admit rc=1)
#                   -> K3-CONTROL-FAIL (over-rejection shape), exit 1
#
# Env: AM4_REPO (isolated scratch repo), AM4_FIXTURES (packet fixtures dir),
#      AM4_OUT (receipt log, appended).
set -uo pipefail

AM4_REPO="${AM4_REPO:?AM4_REPO required}"
AM4_FIXTURES="${AM4_FIXTURES:?AM4_FIXTURES required}"
OUT="${AM4_OUT:?AM4_OUT required}"
LIB="$AM4_REPO/scripts/test-assurance/counterfactuals/counterfactual-lib.sh"
CORPUS="$AM4_REPO/scripts/test-assurance/corpus/q3-copied-predicate"

[ -f "$LIB" ] || { echo "K3-INFRA lib missing: $LIB" >>"$OUT"; exit 3; }
[ -f "$CORPUS/subject.ts" ] || { echo "K3-INFRA corpus missing: $CORPUS" >>"$OUT"; exit 3; }
[ -f "$AM4_FIXTURES/q3-wrong-diagnostic.test.ts" ] || { echo "K3-INFRA fixture missing: q3-wrong-diagnostic.test.ts" >>"$OUT"; exit 3; }
[ -f "$AM4_FIXTURES/q3-survival-claim.test.ts" ] || { echo "K3-INFRA fixture missing: q3-survival-claim.test.ts" >>"$OUT"; exit 3; }

echo "K3-CONTROL repo=$AM4_REPO"
echo "K3-CONTROL judge-lib sha256=$(shasum -a 256 "$LIB" | cut -d' ' -f1)"

control_fail=0

# Judge phases run in SUBSHELLS so a refusing judge (die -> exit 1) is an OBSERVED
# verdict, not the death of this driver.
stage_fault() {  # $1=tag $2=FROM $3=TO $4=label — env: SCRATCH
  (
    set -uo pipefail
    source "$LIB"
    mkdir -p "$SCRATCH/tests"
    printf '{ "name": "s1-k3-scratch", "private": true, "type": "module" }\n' >"$SCRATCH/package.json"
    [ -e "$SCRATCH/node_modules" ] || ln -s "$CF_REPO_ROOT/node_modules" "$SCRATCH/node_modules"
    # governed corpus (byte-identical copies) + frozen violating companions
    cp "$CORPUS/subject.ts"                             "$SCRATCH/tests/subject.ts"
    cp "$CORPUS/bad.recomputed-expectation.ts"          "$SCRATCH/tests/q3-bad-recomputed.test.ts"
    cp "$CORPUS/bad.same-predicate-both-sides.ts"       "$SCRATCH/tests/q3-bad-same-predicate.test.ts"
    cp "$CORPUS/good.pinned-expectation.ts"             "$SCRATCH/tests/q3-good-pinned.test.ts"
    cp "$AM4_FIXTURES/q3-wrong-diagnostic.test.ts"      "$SCRATCH/tests/q3-wrong-diagnostic.test.ts"
    cp "$AM4_FIXTURES/q3-survival-claim.test.ts"        "$SCRATCH/tests/q3-survival-claim.test.ts"
    FILTERS=(tests/q3-bad-recomputed.test.ts tests/q3-bad-same-predicate.test.ts \
             tests/q3-good-pinned.test.ts tests/q3-wrong-diagnostic.test.ts tests/q3-survival-claim.test.ts)
    echo "== k3 $TAG: baseline (5/5 green incl. both violators) =="
    run_scratch_vitest "$SCRATCH" baseline "${FILTERS[@]}"
    node -e '
      const fs = require("node:fs");
      const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const failed = (r.testResults ?? []).filter((t) => t.status === "failed");
      if ((r.testResults ?? []).length !== 5 || failed.length !== 0) {
        console.error(`COUNTERFACTUAL-FAIL: k3 baseline must be 5/5 green, got ${(r.testResults ?? []).length} files, ${failed.length} failed`);
        process.exit(1);
      }
      console.log("OK k3 baseline 5/5 green");
    ' "$SCRATCH/report-baseline.json" || die "k3 baseline is not green"
    echo "== k3 $TAG: fault — $LABEL =="
    apply_patch_once "$SCRATCH/tests/subject.ts" "$FROM" "$TO" "$LABEL"
    echo "== k3 $TAG: counterfactual run =="
    run_scratch_vitest "$SCRATCH" counterfactual "${FILTERS[@]}"
  )
}

admit_compliant() {  # the REAL replay-script judging of the governed corpus
  (
    set -uo pipefail
    source "$LIB"
    local REPORT="$SCRATCH/report-counterfactual.json"
    expect_file_status "$REPORT" q3-bad-recomputed.test.ts pass
    expect_file_status "$REPORT" q3-bad-same-predicate.test.ts pass
    expect_file_status "$REPORT" q3-good-pinned.test.ts fail
    expect_intended   "$REPORT" q3-good-pinned.test.ts 'expected true to be false'
  )
}

refuse_wrong_diagnostic() {  # judge must REFUSE the wrong-diagnostic kill claim
  (
    set -uo pipefail
    source "$LIB"
    local REPORT="$SCRATCH/report-counterfactual.json"
    expect_file_status "$REPORT" q3-wrong-diagnostic.test.ts fail
    expect_intended   "$REPORT" q3-wrong-diagnostic.test.ts 'expected true to be false'
  )
}

refuse_survival() {  # judge must REFUSE survival credit (file stayed green)
  (
    set -uo pipefail
    source "$LIB"
    local REPORT="$SCRATCH/report-counterfactual.json"
    expect_file_status "$REPORT" q3-survival-claim.test.ts fail
  )
}

run_fault_control() {  # $1=tag $2=FROM $3=TO $4=label
  local tag="$1" from="$2" to="$3" label="$4"
  local scratch rc_stage rc_admit rc_wrong rc_surv
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/s1-k3-XXXXXX")"

  SCRATCH="$scratch" TAG="$tag" FROM="$from" TO="$to" LABEL="$label" \
    stage_fault "$tag" "$from" "$to" "$label" >>"$OUT" 2>&1
  rc_stage=$?
  if [ "$rc_stage" -ne 0 ]; then
    echo "K3-CONTROL-FAIL $tag: staging/judging phase failed rc=$rc_stage (infrastructure or corpus drift — never a healthy verdict)"
    control_fail=1
    rm -rf "$scratch"
    return
  fi

  : >"$OUT.admit"; : >"$OUT.wrong"; : >"$OUT.surv"
  SCRATCH="$scratch" admit_compliant          >>"$OUT.admit"  2>&1; rc_admit=$?
  SCRATCH="$scratch" refuse_wrong_diagnostic  >>"$OUT.wrong"  2>&1; rc_wrong=$?
  SCRATCH="$scratch" refuse_survival          >>"$OUT.surv"   2>&1; rc_surv=$?
  { echo "-- judge output $tag: admit-compliant (rc=$rc_admit) --"; cat "$OUT.admit"; } >>"$OUT"
  { echo "-- judge output $tag: refuse-wrong-diagnostic (rc=$rc_wrong) --"; cat "$OUT.wrong"; } >>"$OUT"
  { echo "-- judge output $tag: refuse-survival (rc=$rc_surv) --"; cat "$OUT.surv"; } >>"$OUT"

  echo "K3-RC $tag admit=$rc_admit wrong-diagnostic=$rc_wrong survival=$rc_surv"

  if [ "$rc_admit" -eq 0 ] && [ "$rc_wrong" -eq 1 ] && [ "$rc_surv" -eq 1 ]; then
    echo "K3-JUDGE-HEALTHY $tag: intended kill admitted; wrong-diagnostic and survival credit refused"
  elif [ "$rc_admit" -eq 0 ] && [ "$rc_wrong" -eq 0 ]; then
    echo "K3-CONTROL-FAIL $tag: judge ACCEPTED wrong-diagnostic kill credit — the intended-diagnostic predicate (expect_intended) is disabled or permissively weakened"
    control_fail=1
  elif [ "$rc_admit" -ne 0 ]; then
    echo "K3-CONTROL-FAIL $tag: judge refused the legitimate intended kill (over-rejection shape — amended-3 J1/J2 evidence class)"
    control_fail=1
  else
    echo "K3-CONTROL-FAIL $tag: unexpected verdict triple — see $OUT.wrong / $OUT.surv"
    control_fail=1
  fi
  rm -rf "$scratch"
}

echo "== k3 fault 1/2: cf2a age-boundary shift =="
run_fault_control cf2a 'return age >= MIN_AGE;' 'return age >= 0;' 'cf2a: q3 boundary age >= MIN_AGE -> age >= 0'
echo "== k3 fault 2/2: cf2b constant weakening =="
run_fault_control cf2b 'export const MIN_AGE = 18;' 'export const MIN_AGE = 0;' 'cf2b: q3 constant MIN_AGE = 18 -> 0'

# Repo corpus must be untouched by the control (scratch discipline).
if [ -n "$(git -C "$AM4_REPO" status --porcelain scripts/test-assurance/corpus)" ]; then
  echo "K3-CONTROL-FAIL: repo corpus dirty — scratch discipline violated"
  control_fail=1
fi

if [ "$control_fail" -eq 0 ]; then
  echo "K3-CONTROL-OK genuine judge: intended kills admitted (cf2a+cf2b); wrong-diagnostic and survival credit refused"
  rm -f "$OUT.admit" "$OUT.wrong" "$OUT.surv"
  exit 0
fi
echo "K3-CONTROL final: FAIL"
rm -f "$OUT.admit" "$OUT.wrong" "$OUT.surv"
exit 1
