#!/usr/bin/env bash
# CF1 — seed A03 sibling (circular oracle): q5 backing-behavior break.
#
# Fault (reached, non-equivalent): the good companion's INVOKED backing helper is
# broken (`sealed = true;` → `sealed = false;`) in a SCRATCH copy. The behavior-backed
# companion must die on the intended assertion («expected false to be true»); the
# circular companion — whose required token lives only in the assertion's own source —
# must survive, demonstrating it inspects nothing.
#
# Exit: 0 demonstration reproduced · 1 demonstration failed · 3 infrastructure.
# Spec §6 record: docs/test-assurance-kernel/s1/counterfactuals/cf1-a03-circular-oracle.json

set -uo pipefail
# shellcheck source=counterfactual-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/counterfactual-lib.sh"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/s1-cf1-XXXXXX")"
trap 'rm -rf "$SCRATCH"' EXIT
mkdir -p "$SCRATCH/tests"
printf '{ "name": "s1-cf1-scratch", "private": true, "type": "module" }\n' >"$SCRATCH/package.json"
ln -s "$CF_REPO_ROOT/node_modules" "$SCRATCH/node_modules"

BAD_SRC="$CF_REPO_ROOT/scripts/test-assurance/corpus/q5-self-source/bad.circular-phrase.ts"
GOOD_SRC="$CF_REPO_ROOT/scripts/test-assurance/corpus/q5-self-source/good.behavior-backed-phrase.ts"
[ -f "$BAD_SRC" ] && [ -f "$GOOD_SRC" ] || infra "q5 corpus files missing"

# Verbatim corpus copies, renamed so only the scratch runner discovers them.
cp "$BAD_SRC" "$SCRATCH/tests/q5-bad-circular-phrase.test.ts"
cp "$GOOD_SRC" "$SCRATCH/tests/q5-good-behavior-backed.test.ts"

echo "== phase: baseline (both corpus cases pass under the real runner) =="
run_scratch_vitest "$SCRATCH" baseline tests/q5-bad-circular-phrase.test.ts tests/q5-good-behavior-backed.test.ts
# baseline green proof re-derived from the JSON report (the rc alone could mask a crash)
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const failed = (r.testResults ?? []).filter((t) => t.status === "failed");
  if ((r.testResults ?? []).length !== 2 || failed.length !== 0) {
    console.error(`COUNTERFACTUAL-FAIL: baseline must be 2/2 green, got ${(r.testResults ?? []).length} files, ${failed.length} failed`);
    process.exit(1);
  }
  console.log("OK baseline 2/2 green");
' "$SCRATCH/report-baseline.json" || die "baseline is not green"

echo "== phase: fault — break the backing behavior in the SCRATCH good copy only =="
apply_patch_once "$SCRATCH/tests/q5-good-behavior-backed.test.ts" 'sealed = true;' 'sealed = false;' 'cf1: q5 backing behavior sealed = true -> false'

echo "== phase: counterfactual run =="
run_scratch_vitest "$SCRATCH" counterfactual tests/q5-bad-circular-phrase.test.ts tests/q5-good-behavior-backed.test.ts

GOOD_REPORT="$SCRATCH/report-counterfactual.json"
# The circular companion SURVIVES the fault (reject demonstrated for its shape).
expect_file_status "$GOOD_REPORT" q5-bad-circular-phrase.test.ts pass
# The behavior-backed companion KILLS the fault — with the intended assertion (K7).
expect_file_status "$GOOD_REPORT" q5-good-behavior-backed.test.ts fail
expect_intended "$GOOD_REPORT" q5-good-behavior-backed.test.ts 'expected false to be true'

# Repo corpus was never mutated.
[ -z "$(git -C "$CF_REPO_ROOT" status --porcelain scripts/test-assurance/corpus)" ] \
  || die "repo corpus dir is dirty — scratch discipline violated"

echo "CF1 VERDICT: pass (circular companion survived; behavior-backed companion killed with intended assertion)"
exit 0
