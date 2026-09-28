#!/usr/bin/env bash
# r2-not-wired-summary.test.sh — operator decision Q4.7 (2026-09-28) on the install's R2 passes in
# 99-finalize.sh: every place R2 is left out of a per-package ESLint config is named in the «NOT
# wired» summary with its reason — not only echoed into the scroll-back, where nobody reads it. The
# summary names a config only when the R2 pass would have added R2 there: the config does not name
# the rule yet, and getff placed it or there is HTTP boundary code under it (a package without
# boundary code gets no R2 even on --full — cold-review F15). getff's own ts-server, react-next and
# react-spa templates already carry R2, so they are never listed.
#
#   L1  Layer-2 pass (flat repo, root config getff's), no ts-morph in node_modules — the default
#       install without --full: each per-package config the pass would wire is one summary line
#       with the ts-morph / --full reason; the others (no boundary code, R2 already named) none.
#   L2  Layer-2 pass, ts-morph present, the R2 wirer missing from the getff package: the same
#       configs, with that reason.
#   L3  configs getff placed on an earlier install (refresh-baseline entries): one still holding
#       getff's bytes is listed; one the consumer edited since, with no boundary code under it, is
#       not — _r2_wire_cfg treats it as the consumer's own (getff_bytes_intact) and leaves it.
#   L0  paired negative: no per-package config at all → no R2 line (the degrade used to run, and
#       would have noted, before any config was enumerated).
#   L5  your own configs naming R2 in quotes only inside a comment (a commented-out rule line, a
#       block comment) are listed — the wirer reads a comment as no rule entry; paired: R2 set with
#       a trailing comment on the same line is not.
#   L6  comment and string shapes only a lexer tells apart: a block comment without leading stars,
#       an inline /* */, the id inside a longer string, a Latin-1 byte on a commented-out line — each
#       listed; paired: R2 set after a leading comment, as a template-literal key, after an escaped
#       quote, or with an escaped `\/` in the id — none listed.
#   L7  string shapes the lexer reads by value: the id inside a string continued with a trailing `\`,
#       the id with an escaped `\t`, a template breaking the id over two lines, the id followed by a
#       NUL byte — each listed; paired: the id itself continued with `\`, R2 set after a regex
#       holding a quote — none listed.
#   W1  per-workspace pass (multi-stack monorepo, no root config), no ts-morph: the consumer's own
#       config with boundary code under it is listed for a ts-server, a react-next and a react-spa
#       workspace — the stacks whose getff preset carries R2 (60-ci.sh adds it to a flat repo's own
#       config for the same three) — and not for a react-native one, whose preset ships no R2.
#   W2  per-workspace pass, ts-morph present, the R2 wirer missing: listed with that reason.
#   W3  per-workspace pass that can run: the R2 wirer is handed the ts-server, react-next and
#       react-spa configs as the consumer's own, each with the boundary globs found under its own
#       directory; neither the react-native config nor a react-spa one with no boundary code under
#       it is handed to it.
#   W4  getff's own react-next and react-spa templates, placed this run: they name R2 already, so
#       neither is listed when the pass cannot run.
#   U1  a workspace whose stack the install cannot tell, with HTTP boundary code and no config naming
#       R2: one summary line with the reason — whether or not ts-morph is there.
#   U0  paired negative: an unknown-stack workspace whose config already names R2 (40-configs placed
#       the ts-server template through its root fallback) → no line.
#   U4  an unknown-stack workspace whose quoted R2 rule line is commented out → one line.
#   U5  the same with the R2 line inside a block comment without leading stars → one line.
#   U6  paired: the workspace's only config is an eslint.config.cjs setting R2 → no line.
#   U7  only a backup ESLint never loads (eslint.config.mjs.bak) names R2 → one line.
#   U8  paired: the workspace's eslint.config.mjs is a symlink to a config setting R2 → no line.
#
# Pure bash: ts-morph «present» is a package.json under node_modules/ts-morph (the pass only checks
# for it before running the wirer), and no arm runs the wirer — W3 stands in for npx, recording what
# the pass hands it.
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
set -euo pipefail
FULL="${T_FULL:-}"; DRY_RUN=""; STACK="ts-server"; _r2_verdict="boundary-present"
SKIPPED=(); NOT_WIRED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
reassert_husky_shields() { :; }
source "$REPO_ROOT/setup.d/lib.sh"
# after lib.sh, which defines the real one: the workspace map this arm is about
_detect_stacks_per_workspace() { [ -z "${WS_MAP:-}" ] || printf '%b\n' "$WS_MAP"; return 0; }
# T_NPX_LOG set: npx records its arguments there and reports R2 as wired, so the pass runs through
# without a real wirer (W3).
if [ -n "${T_NPX_LOG:-}" ]; then
  npx() { printf '%s\n' "$*" >> "$T_NPX_LOG"; echo "  ✓ R2 wired into the stand-in"; }
fi
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

# run_finalize <project> <pkg root> [WS_MAP] [DELIVERED] → output in $F_OUT, summary lines in $F_SUM.
# T_FULL=1 runs it as a --full install; T_PATH replaces PATH (N1: no Node on it).
run_finalize() {
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$1" PKG_ROOT="$2" FINALIZE="$FINALIZE" \
    WS_MAP="${3:-}" DELIVERED="${4:-}" T_FULL="${T_FULL:-}" PATH="${T_PATH:-$PATH}" \
    T_NPX_LOG="${T_NPX_LOG:-}" bash "$DRIVER" < /dev/null 2>&1)
  F_SUM=$(printf '%s\n' "$F_OUT" | grep -E '^      - ' || true)
}
sum_has() { printf '%s\n' "$F_SUM" | grep -qE "$1"; }
sum_show() { printf '%s\n' "$F_SUM" | tr '\n' '|'; }
# ran_through <arm> — the finalize reached its last line: under set -e a failing command in it would
# have stopped the driver before the summary, and an arm asserting «no line» would pass on that.
ran_through() {
  if printf '%s\n' "$F_OUT" | grep -q 'For full guide: see INSTALL.md'; then
    ok "$1: the finalize ran to its end"
  else
    bad "$1: the finalize stopped before its end (output tail: $(printf '%s\n' "$F_OUT" | tail -5 | tr '\n' '|'))"
  fi
}
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

# F1: a --full install whose dev-dependency step did not put ts-morph in node_modules — telling the
# consumer to re-run with --full would send them round the same loop; the reason points at that step.
F1=$(flat_project f1)
T_FULL=1 run_finalize "$F1" "$PKG_WIRED" "" "eslint.config.mjs apps/svc/eslint.config.mjs"
flat_arm F1 'ts-morph.*dev-dependency'
if printf '%s\n' "$F_OUT" | grep -qE -- 're-run the install with --full'; then
  bad "F1: a --full install is told to re-run with --full (output: $(printf '%s\n' "$F_OUT" | grep -E -- '--full' | tr '\n' '|'))"
else
  ok "F1: a --full install is not told to re-run with --full"
fi
ran_through F1

# F2: the synth-wire sibling — the root config is the consumer's own, --full, no ts-morph: its
# not-wired line carries the same --full-aware reason.
F2=$(make_project f2); put "$F2" eslint.config.mjs "$PLAIN_CFG"
T_FULL=1 run_finalize "$F2" "$PKG_WIRED" "" ""
if sum_has "^      - getff's rules.* in eslint\.config\.mjs \(your own config\) — .*ts-morph.*dev-dependency" \
   && ! sum_has 're-run the install with --full'; then
  ok "F2: the own root config's not-wired line on a --full install points at the dev-dependency step"
else
  bad "F2: expected the own root config's line to name the dev-dependency step, not a --full re-run (summary: $(sum_show))"
fi

# N1: no Node on PATH at all — the Layer-2 pass names that, not ts-morph.
N1_PATH="/usr/bin:/bin"
if PATH="$N1_PATH" command -v node >/dev/null 2>&1; then
  echo "· SKIP N1 — node is on $N1_PATH, so a PATH without Node cannot be built here"
else
  N1=$(flat_project n1)
  T_PATH="$N1_PATH" run_finalize "$N1" "$PKG_WIRED" "" "eslint.config.mjs apps/svc/eslint.config.mjs"
  flat_arm N1 'needs Node'
  ran_through N1
fi

# L4: your own config mentions the rule id only in a comment — not a rule entry (the wirer's
# own-config path reads a rules key or a string literal only: ruleSetInConfig), so R2 would be added
# and it is listed.
L4=$(make_project l4); put "$L4" eslint.config.mjs "$R2_CFG"
put "$L4" apps/api/eslint.config.mjs "// TODO rules-as-tests/no-unsafe-zod-parse once the schemas land
$PLAIN_CFG"
boundary_code "$L4" apps/api
run_finalize "$L4" "$PKG_WIRED" "" "eslint.config.mjs"
if sum_has "${R2_LINE}apps/api/eslint.config.mjs — .*ts-morph"; then
  ok "L4: your own config naming R2 only in a comment is a NOT wired line"
else
  bad "L4: expected a NOT wired line for apps/api, whose config names R2 only in a comment (summary: $(sum_show))"
fi

# L5: the rule id in quotes, but inside a comment — a commented-out rule line (apps/api) or a block
# comment (apps/blk). The wirer reads a comment as no rule entry at all (ruleSetInConfig), so R2
# would be added to both, and both are listed. Paired: apps/kept sets R2 with a trailing comment on
# the same line — R2 is there, no line.
L5=$(make_project l5); put "$L5" eslint.config.mjs "$R2_CFG"
put "$L5" apps/api/eslint.config.mjs "export default [{ rules: {
  // 'rules-as-tests/no-unsafe-zod-parse': 'error',
  'no-console': 'warn',
} }];"
boundary_code "$L5" apps/api
put "$L5" apps/blk/eslint.config.mjs "/*
 * \"rules-as-tests/no-unsafe-zod-parse\": \"error\" once the schemas land
 */
$PLAIN_CFG"
boundary_code "$L5" apps/blk
put "$L5" apps/kept/eslint.config.mjs "export default [{ files: ['src/**/*.ts'], rules: {
  'rules-as-tests/no-unsafe-zod-parse': 'error', // see https://getff.ai/docs/r2
} }];"
boundary_code "$L5" apps/kept
run_finalize "$L5" "$PKG_WIRED" "" "eslint.config.mjs"
if sum_has "${R2_LINE}apps/api/eslint.config.mjs — .*ts-morph" && sum_has "${R2_LINE}apps/blk/eslint.config.mjs — .*ts-morph"; then
  ok "L5: your own config naming R2 in quotes inside a comment is a NOT wired line"
else
  bad "L5: expected NOT wired lines for apps/api and apps/blk, whose configs name R2 in quotes only inside a comment (summary: $(sum_show))"
fi
if sum_has "${R2_LINE}apps/kept/"; then
  bad "L5: apps/kept sets R2 (a trailing comment on its line), yet it is listed (summary: $(sum_show))"
else
  ok "L5: paired — a config setting R2 with a trailing comment on the same line is not listed"
fi

# L6: comment and string shapes a line-based strip cannot see (cold review of the forecast). Listed:
# a block comment whose body lines have no leading `*` (apps/nostar), an inline /* */ after code
# (apps/inl), the id quoted inside a longer string (apps/msg — the wirer counts an exact literal
# only), a commented-out line ending in a Latin-1 byte (apps/lat). Paired, not listed: R2 set on a
# line that opens with a comment (apps/lead), R2 set as a template-literal key (apps/tpl), R2 set
# after a string holding an escaped quote (apps/esc), R2 set with an escaped `\/` in the id — the
# wirer reads the literal's value (apps/slash).
L6=$(make_project l6); put "$L6" eslint.config.mjs "$R2_CFG"
put "$L6" apps/nostar/eslint.config.mjs "export default [{ rules: {
  'no-console': 'warn',
  /*
  'rules-as-tests/no-unsafe-zod-parse': 'error',
  */
} }];"
put "$L6" apps/inl/eslint.config.mjs "export default [{ rules: { 'no-console': 'warn', /* 'rules-as-tests/no-unsafe-zod-parse': 'error' */ } }];"
put "$L6" apps/msg/eslint.config.mjs "export default [{ rules: { 'no-restricted-syntax': ['error', { selector: 'X', message: \"use safeParse ('rules-as-tests/no-unsafe-zod-parse' lands later)\" }] } }];"
put "$L6" apps/lat/eslint.config.mjs "export default [{ rules: {
  // 'rules-as-tests/no-unsafe-zod-parse': 'error', // d$(printf '\351')sactiv$(printf '\351')
  'no-console': 'warn',
} }];"
put "$L6" apps/lead/eslint.config.mjs "export default [{ rules: {
  /* note */ 'rules-as-tests/no-unsafe-zod-parse': 'error',
} }];"
put "$L6" apps/tpl/eslint.config.mjs "export default [{ rules: { [\`rules-as-tests/no-unsafe-zod-parse\`]: 'error' } }];"
put "$L6" apps/esc/eslint.config.mjs "export default [{ rules: { 'no-x': ['error', { message: 'it\\'s' }], 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];"
put "$L6" apps/slash/eslint.config.mjs "export default [{ rules: { 'rules-as-tests\\/no-unsafe-zod-parse': 'error' } }];"
for d in nostar inl msg lat lead tpl esc slash; do boundary_code "$L6" "apps/$d"; done
run_finalize "$L6" "$PKG_WIRED" "" "eslint.config.mjs"
for d in nostar inl msg lat; do
  if sum_has "${R2_LINE}apps/$d/eslint.config.mjs — .*ts-morph"; then
    ok "L6: apps/$d names R2 only inside a comment or a longer string — a NOT wired line"
  else
    bad "L6: expected a NOT wired line for apps/$d, which does not set R2 (summary: $(sum_show))"
  fi
done
for d in lead tpl esc slash; do
  if sum_has "${R2_LINE}apps/$d/"; then
    bad "L6: apps/$d sets R2, yet it is listed (summary: $(sum_show))"
  else
    ok "L6: paired — apps/$d sets R2 and is not listed"
  fi
done

# L7: string-lexing shapes (cold review of the lexer). Listed — no literal's value is the id: the id
# quoted inside a longer string continued with a trailing `\` (apps/cont), the id with an escaped `\t`
# (apps/tesc — a tab, not a `t`), a template that breaks the id over two lines (apps/mltpl), the id
# followed by a NUL byte inside the literal (apps/nul — measured: mawk or gawk with GNU grep read it
# as the id, BWK awk with BSD grep did not, so this arm guards the Linux runners). Paired,
# not listed: the id itself continued over two lines with a trailing `\` (apps/contsq — its value is
# the id), R2 set on the line after a regex holding a quote (apps/rxq).
L7=$(make_project l7); put "$L7" eslint.config.mjs "$R2_CFG"
put "$L7" apps/cont/eslint.config.mjs "export default [{ rules: { 'no-restricted-syntax': ['error', { selector: 'X', message: \"use safeParse; \\
'rules-as-tests/no-unsafe-zod-parse' lands later\" }] } }];"
put "$L7" apps/tesc/eslint.config.mjs "export default [{ rules: { 'rules-as-\\tests/no-unsafe-zod-parse': 'error' } }];"
put "$L7" apps/mltpl/eslint.config.mjs "export default [{ rules: { 'no-restricted-syntax': ['error', { selector: 'X', message: \`rules-as-tests/
no-unsafe-zod-parse\` }] } }];"
put "$L7" apps/contsq/eslint.config.mjs "export default [{ rules: { 'rules-as-tests/\\
no-unsafe-zod-parse': 'error' } }];"
put "$L7" apps/rxq/eslint.config.mjs "const quote = /'/;
export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];"
mkdir -p "$L7/apps/nul"
printf "export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse\\000xyz': 'error' } }];\n" > "$L7/apps/nul/eslint.config.mjs"
for d in cont tesc mltpl contsq rxq nul; do boundary_code "$L7" "apps/$d"; done
run_finalize "$L7" "$PKG_WIRED" "" "eslint.config.mjs"
for d in cont tesc mltpl nul; do
  if sum_has "${R2_LINE}apps/$d/eslint.config.mjs — .*ts-morph"; then
    ok "L7: apps/$d has no literal whose value is the R2 id — a NOT wired line"
  else
    bad "L7: expected a NOT wired line for apps/$d, which does not set R2 (summary: $(sum_show))"
  fi
done
for d in contsq rxq; do
  if sum_has "${R2_LINE}apps/$d/"; then
    bad "L7: apps/$d sets R2, yet it is listed (summary: $(sum_show))"
  else
    ok "L7: paired — apps/$d sets R2 and is not listed"
  fi
done
ran_through L7

# L3: configs getff placed on an EARLIER install (a refresh-baseline entry, not staged this run).
# apps/svc still holds getff's bytes → the pass would wire it → listed. apps/old was edited since:
# _r2_wire_cfg treats it as the consumer's own (getff_bytes_intact), and with no boundary code under
# it that branch leaves it alone → not listed.
if command -v jq >/dev/null 2>&1 && { command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; }; then
  L3=$(make_project l3); put "$L3" eslint.config.mjs "$R2_CFG"
  put "$L3" apps/svc/eslint.config.mjs "$PLAIN_CFG"
  put "$L3" apps/old/eslint.config.mjs "$PLAIN_CFG"
  _svc_hash=$( (sha256sum "$L3/apps/svc/eslint.config.mjs" 2>/dev/null || shasum -a 256 "$L3/apps/svc/eslint.config.mjs") | awk '{print $1}')
  put "$L3" .ai-factory/refresh-baseline.json \
    "{\"apps/old/eslint.config.mjs\":\"$(printf '0%.0s' $(seq 64))\",\"apps/svc/eslint.config.mjs\":\"$_svc_hash\"}"
  run_finalize "$L3" "$PKG_WIRED" "" "eslint.config.mjs"
  if sum_has "${R2_LINE}apps/svc/eslint.config.mjs — .*ts-morph" && ! sum_has "${R2_LINE}apps/old/"; then
    ok "L3: getff's untouched config from an earlier install is listed; one edited since, with no boundary code under it, is not"
  else
    bad "L3: expected a NOT wired line for apps/svc and none for apps/old (summary: $(sum_show))"
  fi
else
  echo "· SKIP L3 — jq or a sha256 tool not installed (the refresh baseline cannot be read)"
fi

L0=$(make_project l0); put "$L0" eslint.config.mjs "$R2_CFG"; boundary_code "$L0" .
run_finalize "$L0" "$PKG_WIRED" "" "eslint.config.mjs"
if sum_has "$R2_LINE"; then
  bad "L0: no per-package config, yet an R2 line is in the summary (summary: $(sum_show))"
else
  ok "L0: paired — no per-package config, no R2 line"
fi
ran_through L0

# ─── W1/W2: the per-workspace pass (multi-stack monorepo, no root config) ─────
# ws_project <name> — one workspace per stack, each with the consumer's own config (no R2 in it) and
# HTTP boundary code under it: apps/api ts-server, apps/web react-next, apps/spa react-spa,
# apps/mobile react-native.
ws_project() {
  local p w; p=$(make_project "$1")
  for w in api web spa mobile; do
    put "$p" "apps/$w/eslint.config.mjs" "$PLAIN_CFG"; boundary_code "$p" "apps/$w"
  done
  echo "$p"
}
WS='apps/api\tts-server\napps/web\treact-next\napps/spa\treact-spa\napps/mobile\treact-native'
# ws_arm <arm> <reason regex>
ws_arm() {
  local w missing=""
  for w in api web spa; do
    sum_has "${R2_LINE}apps/$w/eslint.config.mjs — .*$2" || missing="$missing apps/$w"
  done
  if [ -z "$missing" ]; then
    ok "$1: the ts-server, react-next and react-spa workspaces' own configs are NOT wired lines with the reason"
  else
    bad "$1: expected a NOT wired line naming «$2» for:$missing (summary: $(sum_show))"
  fi
  if sum_has "${R2_LINE}apps/mobile/"; then
    bad "$1: the react-native workspace is listed, yet its preset ships no R2 (summary: $(sum_show))"
  else
    ok "$1: paired — the react-native workspace is not listed (its preset ships no R2)"
  fi
}

W1=$(ws_project w1)
run_finalize "$W1" "$PKG_WIRED" "$WS"
ws_arm W1 'ts-morph.*--full'

W2=$(ws_project w2); fake_ts_morph "$W2"
run_finalize "$W2" "$PKG_NOWIRER" "$WS"
ws_arm W2 'missing from this getff package'

# W3: the pass can run (ts-morph and the wirer there); npx is the stand-in that records its calls.
# apps/spa also parses in src/api/ (a boundary outside the token folders, so detect adds an api/ glob
# for it), and apps/site is a react-spa workspace with no boundary code: both tell a detect run in
# each config's own directory from one at the repo root, which would find all of it everywhere.
W3=$(ws_project w3); fake_ts_morph "$W3"
put "$W3" apps/spa/src/api/client.ts "export const getUser = async () => schema.parse(await (await fetch('/api/user')).json());"
put "$W3" apps/site/eslint.config.mjs "$PLAIN_CFG"; put "$W3" apps/site/src/index.ts "export const x = 1;"
W3_LOG="$WORK/w3-npx.log"; : > "$W3_LOG"
T_NPX_LOG="$W3_LOG" run_finalize "$W3" "$PKG_WIRED" "$WS\napps/site\treact-spa"
w3_call() { grep -F "wire-eslint-r2.ts --path $W3/apps/$1/eslint.config.mjs " "$W3_LOG"; }
w3_missing=""
for w in api web spa; do
  w3_call "$w" | grep -F -- '--own-config' \
    | grep -qF -- '--boundary **/routes/**/*.{ts,tsx}' || w3_missing="$w3_missing apps/$w"
done
if [ -z "$w3_missing" ]; then
  ok "W3: the ts-server, react-next and react-spa configs are handed to the R2 wirer as your own, with their boundary globs"
else
  bad "W3: not handed to the R2 wirer with --own-config and the routes/ boundary glob:$w3_missing (npx calls: $(tr '\n' '|' < "$W3_LOG"))"
fi
if w3_call spa | grep -qF -- '--boundary **/api/**/*.{ts,tsx}' \
   && ! w3_call web | grep -qF -- '**/api/**' && ! w3_call api | grep -qF -- '**/api/**'; then
  ok "W3: each config gets the globs found under its own directory (the api/ glob on apps/spa's call only)"
else
  bad "W3: expected the api/ boundary glob on apps/spa's wirer call and on no other (npx calls: $(tr '\n' '|' < "$W3_LOG"))"
fi
if grep -qF -e "apps/mobile/eslint.config.mjs" -e "apps/site/eslint.config.mjs" "$W3_LOG"; then
  bad "W3: the react-native config, or a react-spa one with no boundary code under it, is handed to the R2 wirer (npx calls: $(tr '\n' '|' < "$W3_LOG"))"
else
  ok "W3: paired — neither the react-native config nor the react-spa one with no boundary code is handed to the R2 wirer"
fi
if sum_has "$R2_LINE"; then
  bad "W3: the stand-in reported R2 wired, yet the pass put an R2 line in the NOT wired summary (summary: $(sum_show))"
else
  ok "W3: the stand-in reported R2 wired for each config, and the pass adds no NOT wired line after it"
fi
ran_through W3

# W4: getff placed its own react-next and react-spa templates (this run's deliveries), which name R2
# already — the pass cannot run (no ts-morph), and neither is listed. apps/api is the consumer's own
# config with boundary code: its line shows the pass did run and note.
W4=$(make_project w4)
put "$W4" apps/web/eslint.config.mjs "$(cat "$REPO_ROOT/packages/preset-next-15-canonical/templates/eslint.config.react.mjs")"
put "$W4" apps/spa/eslint.config.mjs "$(cat "$REPO_ROOT/packages/preset-react-spa/templates/eslint.config.react.mjs")"
put "$W4" apps/api/eslint.config.mjs "$PLAIN_CFG"
for w in api web spa; do boundary_code "$W4" "apps/$w"; done
run_finalize "$W4" "$PKG_WIRED" 'apps/api\tts-server\napps/web\treact-next\napps/spa\treact-spa' \
  "apps/web/eslint.config.mjs apps/spa/eslint.config.mjs"
if sum_has "${R2_LINE}apps/api/eslint.config.mjs — .*ts-morph" \
   && ! sum_has "${R2_LINE}apps/web/" && ! sum_has "${R2_LINE}apps/spa/"; then
  ok "W4: getff's react-next and react-spa templates name R2 already, so neither is listed (your own apps/api is)"
else
  bad "W4: expected an R2 line for apps/api only, not for getff's react templates in apps/web and apps/spa (summary: $(sum_show))"
fi

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

U2=$(make_project u2); put "$U2" apps/x/src/index.ts "export const x = 1;"
run_finalize "$U2" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x"; then
  bad "U2: an unknown-stack workspace with no HTTP boundary code is listed (summary: $(sum_show))"
else
  ok "U2: paired — an unknown-stack workspace with no HTTP boundary code is not listed"
fi

# U3: the unknown-stack workspace's config mentions the rule id only in a comment — R2 is not there.
U3=$(make_project u3); boundary_code "$U3" apps/x
put "$U3" apps/x/eslint.config.mjs "// rules-as-tests/no-unsafe-zod-parse: see the ts-server template
$PLAIN_CFG"
run_finalize "$U3" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x — .*stack"; then
  ok "U3: an unknown-stack workspace whose config names R2 only in a comment is a NOT wired line"
else
  bad "U3: expected a NOT wired line for apps/x, whose config names R2 only in a comment (summary: $(sum_show))"
fi

# U4: the same with the rule id in quotes — a commented-out rule line is still no rule entry.
U4=$(make_project u4); boundary_code "$U4" apps/x
put "$U4" apps/x/eslint.config.mjs "export default [{ rules: {
  // 'rules-as-tests/no-unsafe-zod-parse': 'error',
  'no-console': 'warn',
} }];"
run_finalize "$U4" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x — .*stack"; then
  ok "U4: an unknown-stack workspace whose config comments out a quoted R2 rule line is a NOT wired line"
else
  bad "U4: expected a NOT wired line for apps/x, whose R2 rule line is commented out (summary: $(sum_show))"
fi

# U5: a block comment whose body lines have no leading `*` — still no rule entry.
U5=$(make_project u5); boundary_code "$U5" apps/x
put "$U5" apps/x/eslint.config.mjs "export default [{ rules: {
  /*
  'rules-as-tests/no-unsafe-zod-parse': 'error',
  */
  'no-console': 'warn',
} }];"
run_finalize "$U5" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x — .*stack"; then
  ok "U5: an unknown-stack workspace whose R2 line sits in a block comment without leading stars is a NOT wired line"
else
  bad "U5: expected a NOT wired line for apps/x, whose R2 line is inside a block comment (summary: $(sum_show))"
fi

# U6: paired — the workspace's only config is an eslint.config.cjs that sets R2 → no line.
U6=$(make_project u6); boundary_code "$U6" apps/x
put "$U6" apps/x/eslint.config.cjs "module.exports = [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];"
run_finalize "$U6" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x"; then
  bad "U6: apps/x sets R2 in eslint.config.cjs, yet it is listed (summary: $(sum_show))"
else
  ok "U6: paired — an unknown-stack workspace whose eslint.config.cjs sets R2 is not listed"
fi
ran_through U6

# U7: a backup ESLint never loads (eslint.config.mjs.bak) names R2; the live config does not → one line.
U7=$(make_project u7); boundary_code "$U7" apps/x
put "$U7" apps/x/eslint.config.mjs "$PLAIN_CFG"
put "$U7" apps/x/eslint.config.mjs.bak "$R2_CFG"
run_finalize "$U7" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x — .*stack"; then
  ok "U7: a backup file naming R2 does not hide the workspace from the summary"
else
  bad "U7: expected a NOT wired line for apps/x — only its eslint.config.mjs.bak names R2 (summary: $(sum_show))"
fi

# U8: paired — the workspace's eslint.config.mjs is a symlink to a file that sets R2 → no line.
U8=$(make_project u8); boundary_code "$U8" apps/x
put "$U8" apps/x/real.mjs "$R2_CFG"
ln -s real.mjs "$U8/apps/x/eslint.config.mjs"
run_finalize "$U8" "$PKG_WIRED" 'apps/x\tunknown'
if sum_has "${R2_LINE}apps/x"; then
  bad "U8: apps/x's eslint.config.mjs links to a config setting R2, yet it is listed (summary: $(sum_show))"
else
  ok "U8: paired — a symlinked eslint.config.mjs that sets R2 is read, and the workspace is not listed"
fi
ran_through U8

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
