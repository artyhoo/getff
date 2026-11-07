#!/usr/bin/env bash
# f16 — live-signal Check 2: Stryker generates ≥1 mutant on a reference fixture (#549 class).
#
# THE GAP (f13): f13-stryker-pm.test.sh only greps stryker.config.json for "packageManager"
# — pure config-presence check. A Stryker that ships config correctly but produces 0 mutants
# (because a checker plugin isn't discoverable — the real #549 condition on pnpm) stays GREEN
# in f13 while being entirely dead in practice.
#
# THIS CHECK asserts the observable runtime signal: "stryker run" instruments ≥1 mutant AND
# exits without a StrykerError (plugin injection failure). Signal extracted from stryker's
# --logLevel info output: "Instrumented N source file(s) with M mutant(s)".
#
# PAIRED-NEGATIVE (#549 class): configure stryker to require @stryker-mutator/typescript-checker
# (not installed in isolation) → stryker emits StrykerError on checker-worker injection → 0
# mutants tested → check goes RED. This is the exact failure mode from #549: checker plugin not
# discoverable → mutation gate silently dead.
#
# pnpm arm: runs iff pnpm is on PATH; otherwise skip with logged reason (never silently pass).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

# Locate stryker binary: prefer packages/core/node_modules (CI path after npm install --prefix)
STRYKER=""
for _s in \
  "$REPO_ROOT/packages/core/node_modules/.bin/stryker" \
  "$REPO_ROOT/node_modules/.bin/stryker" \
  "/app/node_modules/.bin/stryker"; do
  [ -x "$_s" ] && STRYKER="$_s" && break
done

if [ -z "$STRYKER" ]; then
  echo "  · f16 SKIP — stryker not found in packages/core/node_modules or repo node_modules"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi
echo "  · using stryker: $STRYKER"

# Helper: extract mutant count from stryker --logLevel info output
# Line looks like: "INFO Instrumenter] Instrumented N source file(s) with M mutant(s)"
mutant_count_from_log() {  # $1 = log output string
  echo "$1" | grep -oE 'with [0-9]+ mutant' | grep -oE '[0-9]+' | tail -1 || echo "0"
}

# Helper: minimal JS source with several mutation operators
write_source() {  # $1 = dir
  mkdir -p "$1/src"
  cat > "$1/src/math.js" <<'JS'
function add(a, b) { return a + b; }
function gt(a, b) { return a > b; }
function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
module.exports = { add, gt, clamp };
JS
}

# Helper: minimal stryker config (command test runner, no checkers, JSON + logLevel in log)
write_stryker_cfg() {  # $1 = dir, optional $2 = extra fields
  local extra="${2:-}"
  cat > "$1/stryker.config.json" <<JSON
{
  "testRunner": "command",
  "commandRunner": { "command": "true" },
  "coverageAnalysis": "off",
  "mutate": ["src/math.js"],
  "plugins": [],
  "reporters": [],
  "thresholds": { "break": 0 }
  $( [ -n "$extra" ] && echo ", $extra" )
}
JSON
}

# ══════════ Arm A — npm reference fixture ══════════════════════════════════════
A=$(mktemp -d)
write_source "$A"
write_stryker_cfg "$A"

out_a=$( cd "$A" && "$STRYKER" run --logLevel info 2>&1 || true )
n_a=$(mutant_count_from_log "$out_a")

# Also check no StrykerError (plugin injection failure = #549 class)
if grep -qE 'StrykerError|Could not inject.*Checker|ERROR.*Stryker' <<<"$out_a"; then
  bad "Check2 npm: StrykerError detected — checker/plugin injection failure (#549 class exact condition; f13 config-grep stays GREEN)"
  n_a=0
fi

if [ "$n_a" -ge 1 ]; then
  ok "Check2 npm: stryker instrumented $n_a mutant(s) ≥ 1 (live signal; NOT config-presence)"
else
  bad "Check2 npm: stryker produced 0 mutants — mutation gate silently dead (reproduces #549 false-green; f13 would stay GREEN)"
fi

# ══════════ Arm B — pnpm reference fixture ════════════════════════════════════
if command -v pnpm >/dev/null 2>&1; then
  B=$(mktemp -d)
  write_source "$B"
  touch "$B/pnpm-lock.yaml"
  # pnpm arm: packageManager set to pnpm (the #549 scenario context)
  cat > "$B/stryker.config.json" <<'JSON'
{
  "packageManager": "pnpm",
  "testRunner": "command",
  "commandRunner": { "command": "true" },
  "coverageAnalysis": "off",
  "mutate": ["src/math.js"],
  "plugins": [],
  "reporters": [],
  "thresholds": { "break": 0 }
}
JSON
  out_b=$( cd "$B" && "$STRYKER" run --logLevel info 2>&1 || true )
  n_b=$(mutant_count_from_log "$out_b")
  if grep -qE 'StrykerError|Could not inject.*Checker|ERROR.*Stryker' <<<"$out_b"; then
    bad "Check2 pnpm: StrykerError — checker injection failed on pnpm arm (exact #549 path)"
    n_b=0
  fi
  if [ "$n_b" -ge 1 ]; then
    ok "Check2 pnpm: stryker instrumented $n_b mutant(s) ≥ 1 on pnpm consumer (pnpm path live)"
  else
    bad "Check2 pnpm: stryker produced 0 mutants on pnpm arm (reproduces #549 exactly)"
  fi
else
  skip "Check2 pnpm arm: pnpm not on PATH — skip (add corepack enable to CI job to run this arm)"
fi

# ══════════ Arm C — PAIRED-NEGATIVE: checker plugin not found → StrykerError ════
# Reproduces #549 condition: stryker.config.json requires @stryker-mutator/typescript-checker
# (the shipped template's checker) but it's not installed in this isolation context.
# Stryker emits StrykerError on checker-worker injection → mutation gate dead.
# The check MUST go RED here (detecting this failure before release).
NEG=$(mktemp -d)
write_source "$NEG"
cat > "$NEG/stryker.config.json" <<'JSON'
{
  "testRunner": "command",
  "commandRunner": { "command": "true" },
  "coverageAnalysis": "off",
  "mutate": ["src/math.js"],
  "checkers": ["typescript"],
  "plugins": ["@stryker-mutator/typescript-checker"],
  "reporters": [],
  "thresholds": { "break": 0 }
}
JSON

out_neg=$( cd "$NEG" && "$STRYKER" run --logLevel info 2>&1 || true )

if grep -qE 'StrykerError|Could not inject.*Checker|ERROR.*Stryker|Cannot find Checker plugin' <<<"$out_neg"; then
  ok "Check2 neg (#549 repro): missing checker → StrykerError (RED; f13 config-grep stays GREEN — this is the exact gap)"
else
  # Checker somehow found — still check that mutants were produced correctly
  n_neg=$(mutant_count_from_log "$out_neg")
  if [ "$n_neg" -ge 1 ]; then
    bad "Check2 neg: checker resolved unexpectedly AND produced mutants — paired-negative is VACUOUS (cannot detect #549 class)"
  else
    ok "Check2 neg: checker not found → 0 mutants (RED path confirmed via 0-mutant output)"
  fi
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
