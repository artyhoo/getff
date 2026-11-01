#!/usr/bin/env bash
# CF2b — seed A06 analogue, arm 2 (constant weakening): q3 subject `MIN_AGE = 18` → `0`.
#
# Non-equivalent to CF2a by construction: a different carrier token (the exported
# constant, not the comparison operator) and a different observable signature
# (MIN_AGE flips 18 → 0 in the direct import probe, which CF2a leaves at 18).
# Same frozen-oracle discharge as CF2a: good.pinned-expectation kills with the
# intended assertion; both q3/bad.* companions survive.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.
# Spec §6 record: docs/test-assurance-kernel/s1/counterfactuals/cf2b-min-age-weaken.json

set -uo pipefail
# shellcheck source=counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/counterfactual-lib.sh"

CORPUS="$CF_REPO_ROOT/scripts/test-assurance/corpus/q3-copied-predicate"
SUBJECT_SRC="$CORPUS/subject.ts"
[ -f "$SUBJECT_SRC" ] || infra "q3 subject missing: $SUBJECT_SRC"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/s1-cf2b-XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$SCRATCH/tests"
printf '{ "name": "s1-cf2b-scratch", "private": true, "type": "module" }\n' >"$SCRATCH/package.json"
ln -s "$CF_REPO_ROOT/node_modules" "$SCRATCH/node_modules"

cp "$CORPUS/subject.ts" "$SCRATCH/tests/subject.ts"
cp "$CORPUS/bad.recomputed-expectation.ts" "$SCRATCH/tests/q3-bad-recomputed.test.ts"
cp "$CORPUS/bad.same-predicate-both-sides.ts" "$SCRATCH/tests/q3-bad-same-predicate.test.ts"
cp "$CORPUS/good.pinned-expectation.ts" "$SCRATCH/tests/q3-good-pinned.test.ts"

cat >"$SCRATCH/probe.mts" <<'EOF'
import { isAdult, MIN_AGE } from './tests/subject.ts';
console.log(`PROBE isAdult(17)=${isAdult(17)} MIN_AGE=${MIN_AGE}`);
EOF

FILTERS=(tests/q3-bad-recomputed.test.ts tests/q3-bad-same-predicate.test.ts tests/q3-good-pinned.test.ts)

echo "== phase: baseline (3/3 green) + healthy probe =="
run_scratch_vitest "$SCRATCH" baseline "${FILTERS[@]}"
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const failed = (r.testResults ?? []).filter((t) => t.status === "failed");
  if ((r.testResults ?? []).length !== 3 || failed.length !== 0) {
    console.error(`COUNTERFACTUAL-FAIL: baseline must be 3/3 green, got ${(r.testResults ?? []).length} files, ${failed.length} failed`);
    process.exit(1);
  }
  console.log("OK baseline 3/3 green");
' "$SCRATCH/report-baseline.json" || die "baseline is not green"
expect_tsx_probe "$SCRATCH/probe.mts" 'PROBE isAdult(17)=false MIN_AGE=18'

echo "== phase: fault B — weaken the exported constant in the SCRATCH subject only =="
apply_patch_once "$SCRATCH/tests/subject.ts" 'export const MIN_AGE = 18;' 'export const MIN_AGE = 0;' 'cf2b: q3 constant MIN_AGE = 18 -> 0'
expect_tsx_probe "$SCRATCH/probe.mts" 'PROBE isAdult(17)=true MIN_AGE=0'

echo "== phase: counterfactual run =="
run_scratch_vitest "$SCRATCH" counterfactual "${FILTERS[@]}"
REPORT="$SCRATCH/report-counterfactual.json"
expect_file_status "$REPORT" q3-bad-recomputed.test.ts pass
expect_file_status "$REPORT" q3-bad-same-predicate.test.ts pass
expect_file_status "$REPORT" q3-good-pinned.test.ts fail
expect_intended "$REPORT" q3-good-pinned.test.ts 'expected true to be false'

echo "== phase: restoration + repo untouched proof =="
restore_file "$SCRATCH/tests/subject.ts" "$SUBJECT_SRC"
expect_tsx_probe "$SCRATCH/probe.mts" 'PROBE isAdult(17)=false MIN_AGE=18'
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain scripts/test-assurance/corpus)" ] \
  || die "repo corpus dir is dirty — scratch discipline violated"

echo "CF2B VERDICT: pass (pinned companion killed the constant weakening; both copied/recomputed companions survived)"
exit 0
