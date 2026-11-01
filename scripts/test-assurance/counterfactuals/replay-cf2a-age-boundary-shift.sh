#!/usr/bin/env bash
# CF2a — seed A06 analogue, arm 1 (age-boundary shift): q3 subject `age >= MIN_AGE` → `age >= 0`.
#
# Fault (reached, non-equivalent): the boundary comparison collapses in a SCRATCH copy of
# the q3 mutation subject. The pinned-fact companion (good.pinned-expectation) must KILL
# it on the intended assertion («expected true to be false»); both copied/recomputed
# companions (q3/bad.*) must SURVIVE — that survival is the demonstrated gap behind the
# frozen `reject-by-counterfactual` classifications in scripts/test-assurance/expectations.json.
#
# Independent reachability observation: a tsx probe imports the mutated subject DIRECTLY
# (no test file involved) and shows isAdult(17) flipping false → true.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.
# Spec §6 record: docs/test-assurance-kernel/s1/counterfactuals/cf2a-age-boundary-shift.json

set -uo pipefail
# shellcheck source=counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/counterfactual-lib.sh"

CORPUS="$CF_REPO_ROOT/scripts/test-assurance/corpus/q3-copied-predicate"
SUBJECT_SRC="$CORPUS/subject.ts"
[ -f "$SUBJECT_SRC" ] || infra "q3 subject missing: $SUBJECT_SRC"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/s1-cf2a-XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$SCRATCH/tests"
printf '{ "name": "s1-cf2a-scratch", "private": true, "type": "module" }\n' >"$SCRATCH/package.json"
ln -s "$CF_REPO_ROOT/node_modules" "$SCRATCH/node_modules"

# Verbatim corpus copies (subject keeps its name — the bads import './subject.ts').
cp "$CORPUS/subject.ts" "$SCRATCH/tests/subject.ts"
cp "$CORPUS/bad.recomputed-expectation.ts" "$SCRATCH/tests/q3-bad-recomputed.test.ts"
cp "$CORPUS/bad.same-predicate-both-sides.ts" "$SCRATCH/tests/q3-bad-same-predicate.test.ts"
cp "$CORPUS/good.pinned-expectation.ts" "$SCRATCH/tests/q3-good-pinned.test.ts"

# Reachability probe — imports the subject directly, independent of any test file.
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

echo "== phase: fault A — collapse the boundary comparison in the SCRATCH subject only =="
apply_patch_once "$SCRATCH/tests/subject.ts" 'return age >= MIN_AGE;' 'return age >= 0;' 'cf2a: q3 boundary age >= MIN_AGE -> age >= 0'
expect_tsx_probe "$SCRATCH/probe.mts" 'PROBE isAdult(17)=true MIN_AGE=18'

echo "== phase: counterfactual run =="
run_scratch_vitest "$SCRATCH" counterfactual "${FILTERS[@]}"
REPORT="$SCRATCH/report-counterfactual.json"
# Both copied/recomputed companions SURVIVE the boundary collapse — the Q3 gap, demonstrated.
expect_file_status "$REPORT" q3-bad-recomputed.test.ts pass
expect_file_status "$REPORT" q3-bad-same-predicate.test.ts pass
# The pinned-fact companion KILLS it with the intended assertion (K7).
expect_file_status "$REPORT" q3-good-pinned.test.ts fail
expect_intended "$REPORT" q3-good-pinned.test.ts 'expected true to be false'

echo "== phase: restoration + repo untouched proof =="
restore_file "$SCRATCH/tests/subject.ts" "$SUBJECT_SRC"
expect_tsx_probe "$SCRATCH/probe.mts" 'PROBE isAdult(17)=false MIN_AGE=18'
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain scripts/test-assurance/corpus)" ] \
  || die "repo corpus dir is dirty — scratch discipline violated"

echo "CF2A VERDICT: pass (pinned companion killed the boundary shift; both copied/recomputed companions survived)"
exit 0
