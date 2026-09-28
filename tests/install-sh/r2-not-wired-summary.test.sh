#!/usr/bin/env bash
# r2-not-wired-summary.test.sh — operator decision Q4.7 (2026-09-28) on the install's R2 passes in
# 99-finalize.sh: every place R2 is left out of a per-package ESLint config is named in the «NOT
# wired» summary with its reason — not only echoed into the scroll-back, where nobody reads it. The
# summary names a config only when the R2 pass would have added R2 there: the config does not name
# the rule yet, and getff placed it or there is HTTP boundary code under it (a package without
# boundary code gets no R2 even on --full — cold-review F15). getff's own ts-server template
# already carries R2, so it is never listed.
#
#   L1  Layer-2 pass (flat repo, root config getff's), no ts-morph in node_modules — the default
#       install without --full: each per-package config the pass would wire is one summary line
#       with the ts-morph / --full reason; the others (no boundary code, R2 already named) none.
#   L2  Layer-2 pass, ts-morph present, the R2 wirer missing from the getff package: the same
#       configs, with that reason.
#   L0  paired negative: no per-package config at all → no R2 line (the degrade used to run, and
#       would have noted, before any config was enumerated).
#   W1  per-workspace pass (multi-stack monorepo, no root config), no ts-morph: the ts-server
#       workspace's config is listed; the react-next workspace's is not (R2 is a server rule).
#   W2  per-workspace pass, ts-morph present, the R2 wirer missing: listed with that reason.
#   U1  a workspace whose stack the install cannot tell, with HTTP boundary code and no config naming
#       R2: one summary line with the reason — whether or not ts-morph is there.
#   U0  paired negative: an unknown-stack workspace whose config already names R2 (40-configs placed
#       the ts-server template through its root fallback) → no line.
#
# Pure bash: ts-morph «present» is a package.json under node_modules/ts-morph (the pass only checks
# for it before running the wirer), and no arm runs the wirer.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

if ! command -v node >/dev/null 2>&1; then
  if [ -n "${CI:-}" ]; then bad "node is not installed — the arms cannot run in CI"; else echo "· SKIP — node not installed"; fi
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]; exit
fi

WORK=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$WORK"' EXIT

R2_CFG="export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];"
PLAIN_CFG="export default [{ rules: { 'no-console': 'warn' } }];"

# Stub package roots: a no-op synth bundle and the real boundary detector; PKG_WIRED also carries a
# stand-in R2 wirer file (never run by these arms), PKG_NOWIRER does not.
PKG_WIRED="$WORK/pkg-wired"; PKG_NOWIRER="$WORK/pkg-nowirer"
for p in "$PKG_WIRED" "$PKG_NOWIRER"; do
  mkdir -p "$p/packages/core/install" "$p/packages/core/audit-self"
  printf 'console.log("stub synth");\n' > "$p/packages/core/install/synth-and-wire.bundle.mjs"
  cp "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" "$p/packages/core/audit-self/"
done
printf 'console.log("stub wirer");\n' > "$PKG_WIRED/packages/core/install/wire-eslint-r2.ts"

DRIVER="$WORK/driver.sh"
cat > "$DRIVER" << 'EOF'
set -o pipefail
FULL=""; DRY_RUN=""; STACK="ts-server"; _r2_verdict="boundary-present"
SKIPPED=(); NOT_WIRED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
reassert_husky_shields() { :; }
source "$REPO_ROOT/setup.d/lib.sh"
# after lib.sh, which defines the real one: the workspace map this arm is about
_detect_stacks_per_workspace() { [ -z "${WS_MAP:-}" ] || printf '%b\n' "$WS_MAP"; return 0; }
REFRESH_BASELINE_STAGED=()
for _d in ${DELIVERED:-}; do REFRESH_BASELINE_STAGED+=("$PROJECT_ROOT/$_d"); done
source "$FINALIZE"
EOF

# make_project <name> — an empty project: package.json and the rules-as-tests barrel.
make_project() {
  local p="$WORK/$1"
  mkdir -p "$p/eslint-rules-local"
  printf '{"name":"%s","version":"0.0.0","type":"module"}\n' "$1" > "$p/package.json"
  printf 'export default { rules: {} };\n' > "$p/eslint-rules-local/index.mjs"
  echo "$p"
}
# put <project> <rel path> <content>
put() { mkdir -p "$(dirname "$1/$2")"; printf '%s\n' "$3" > "$1/$2"; }
boundary_code() { put "$1" "$2/src/routes/users.ts" "export const users = (req: { body: unknown }) => schema.parse(req.body);"; }
fake_ts_morph() { put "$1" node_modules/ts-morph/package.json '{"name":"ts-morph","version":"0.0.0"}'; }

# run_finalize <project> <pkg root> [WS_MAP] [DELIVERED] → output in $F_OUT, summary lines in $F_SUM
run_finalize() {
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$1" PKG_ROOT="$2" FINALIZE="$FINALIZE" \
    WS_MAP="${3:-}" DELIVERED="${4:-}" bash "$DRIVER" < /dev/null 2>&1)
  F_SUM=$(printf '%s\n' "$F_OUT" | grep -E '^      - ' || true)
}
sum_has() { printf '%s\n' "$F_SUM" | grep -qE "$1"; }
sum_show() { printf '%s\n' "$F_SUM" | tr '\n' '|'; }
R2_LINE='^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in '

# ─── L1/L2/L0: the Layer-2 pass ────────────────────────────────────────────────
# flat_project <name> — root config getff placed; apps/api (yours, boundary code, no R2), apps/svc
# (getff's, no R2), apps/web (yours, no boundary code), packages/lib (yours, names R2 already).
flat_project() {
  local p; p=$(make_project "$1")
  put "$p" eslint.config.mjs "$R2_CFG"
  put "$p" apps/api/eslint.config.mjs "$PLAIN_CFG"; boundary_code "$p" apps/api
  put "$p" apps/svc/eslint.config.mjs "$PLAIN_CFG"
  put "$p" apps/web/eslint.config.mjs "$PLAIN_CFG"; put "$p" apps/web/src/index.ts "export const x = 1;"
  put "$p" packages/lib/eslint.config.mjs "$R2_CFG"; boundary_code "$p" packages/lib
  echo "$p"
}
# flat_arm <arm> <reason regex>
flat_arm() {
  local arm="$1" why="$2"
  if sum_has "${R2_LINE}apps/api/eslint.config.mjs — .*$why" && sum_has "${R2_LINE}apps/svc/eslint.config.mjs — .*$why"; then
    ok "$arm: apps/api (your config, boundary code) and apps/svc (getff's) are NOT wired lines with the reason"
  else
    bad "$arm: expected NOT wired lines for apps/api and apps/svc naming «$why» (summary: $(sum_show))"
  fi
  if sum_has "${R2_LINE}apps/web/" || sum_has "${R2_LINE}packages/lib/" || sum_has "${R2_LINE}eslint.config.mjs "; then
    bad "$arm: a config R2 would not be added to is listed (summary: $(sum_show))"
  else
    ok "$arm: no line for apps/web (no boundary code), packages/lib (R2 already named) or the root config"
  fi
}

L1=$(flat_project l1)
run_finalize "$L1" "$PKG_WIRED" "" "eslint.config.mjs apps/svc/eslint.config.mjs"
flat_arm L1 'ts-morph.*--full'

L2=$(flat_project l2); fake_ts_morph "$L2"
run_finalize "$L2" "$PKG_NOWIRER" "" "eslint.config.mjs apps/svc/eslint.config.mjs"
flat_arm L2 'missing from this getff package'

L0=$(make_project l0); put "$L0" eslint.config.mjs "$R2_CFG"; boundary_code "$L0" .
run_finalize "$L0" "$PKG_WIRED" "" "eslint.config.mjs"
if sum_has "$R2_LINE"; then
  bad "L0: no per-package config, yet an R2 line is in the summary (summary: $(sum_show))"
else
  ok "L0: paired — no per-package config, no R2 line"
fi

# ─── W1/W2: the per-workspace pass (multi-stack monorepo, no root config) ─────
ws_project() {
  local p; p=$(make_project "$1")
  put "$p" apps/api/eslint.config.mjs "$PLAIN_CFG"; boundary_code "$p" apps/api
  put "$p" apps/web/eslint.config.mjs "$PLAIN_CFG"; boundary_code "$p" apps/web
  echo "$p"
}
WS='apps/api\tts-server\napps/web\treact-next'
# ws_arm <arm> <reason regex>
ws_arm() {
  if sum_has "${R2_LINE}apps/api/eslint.config.mjs — .*$2" && ! sum_has "${R2_LINE}apps/web/"; then
    ok "$1: the ts-server workspace's config is a NOT wired line with the reason; the react-next one is not listed"
  else
    bad "$1: expected a NOT wired line for apps/api naming «$2» and none for apps/web (summary: $(sum_show))"
  fi
}

W1=$(ws_project w1)
run_finalize "$W1" "$PKG_WIRED" "$WS"
ws_arm W1 'ts-morph.*--full'

W2=$(ws_project w2); fake_ts_morph "$W2"
run_finalize "$W2" "$PKG_NOWIRER" "$WS"
ws_arm W2 'missing from this getff package'

# ─── U1/U0: a workspace whose stack the install cannot tell ───────────────────
for state in without with; do
  U1=$(make_project "u1-$state"); boundary_code "$U1" apps/x
  [ "$state" = without ] || fake_ts_morph "$U1"
  run_finalize "$U1" "$PKG_WIRED" 'apps/x\tunknown'
  if sum_has "${R2_LINE}apps/x — .*stack"; then
    ok "U1 ($state ts-morph): the unknown-stack workspace with boundary code is a NOT wired line with the reason"
  else
    bad "U1 ($state ts-morph): expected a NOT wired line for apps/x naming its stack as the reason (summary: $(sum_show))"
  fi
done

U0=$(make_project u0); boundary_code "$U0" apps/x; put "$U0" apps/x/eslint.config.mjs "$R2_CFG"; fake_ts_morph "$U0"
run_finalize "$U0" "$PKG_WIRED" 'apps/x\tunknown' "apps/x/eslint.config.mjs"
if sum_has "${R2_LINE}apps/x"; then
  bad "U0: the unknown-stack workspace's config already names R2, yet it is listed (summary: $(sum_show))"
else
  ok "U0: paired — an unknown-stack workspace whose config names R2 is not listed"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
