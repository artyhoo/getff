#!/usr/bin/env bash
# installer-greps-read-code.test.sh — the install reads a consumer's ESLint config as code, not text.
#
# The install decides «R2 is wired», «getff's rules are in this config», «this config has a RULE_GLOBS
# block» and «this glob is already covered» by grepping the config. A grep of the raw file counts a
# comment: `// TODO: turn on 'rules-as-tests/no-unsafe-zod-parse'` read as R2 wired. The push gates
# (check-rule-globs.sh, check-rule-enforced.sh) were fixed to read the config with its comments cut out
# (code_of over the shared awk uncomment()); these arms hold the install's own greps to the same
# reading, one arm per site, each with a paired arm where the same text in code still counts.
#
#   S1  99-finalize: ESLINT_ROOT_NOT_WIRED — a root config naming getff's rules only in a comment
#       is not wired, so the self-verify does not claim «fences fire» for it.
#   S2  99-finalize _r2_would_wire, the consumer's config: a quoted R2 id in a comment is no rule entry.
#   S3  99-finalize _r2_would_wire, getff's own config: a comment naming R2 is not R2.
#   S4  99-finalize unknown-stack workspace: a quoted R2 id in a comment does not hide the workspace.
#   S5  99-finalize F11: a config naming RULE_GLOBS / the rules only in comments is not handed to the gate.
#   S6  99-finalize F11: RULE_GLOBS in a comment does not make the summary say «its RULE_GLOBS has no
#       boundary array».
#   S7  99-finalize F11: a rule id in a comment is not listed among the rules the config sets itself.
#   S8  60-ci: getff's config with RULE_GLOBS only in a comment has no RULE_GLOBS block to widen.
#   S9  60-ci: a boundary glob in a comment is not «already covered».
#   S10 lib.sh eslint_config_has_getff_rules: a rule id, or an import, in a comment does not count.
#   S11 lib.sh's uncomment() is the push gates' uncomment(), byte for byte.
#   S12 60-ci: the glob goes into the boundary array in code, not a commented-out one (idempotent).
#   S13 reading as code keeps real code (a `//` in a string, a multi-line comment before a rule).
#   S14 an unreadable config reads as empty and never aborts the install.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"
CI_LAYER="$REPO_ROOT/setup.d/60-ci.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

if ! command -v node >/dev/null 2>&1; then
  if [ -n "${CI:-}" ]; then bad "node is not installed — the finalize arms cannot run in CI"; else echo "· SKIP — node not installed"; fi
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]; exit
fi

WORK=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$WORK"' EXIT

R2_ID="rules-as-tests/no-unsafe-zod-parse"
R2_CFG="export default [{ rules: { '$R2_ID': 'error' } }];"
PLAIN_CFG="export default [{ rules: { 'no-console': 'warn' } }];"

# Stub package root: a no-op synth bundle, a stand-in R2 wirer, the real boundary detector.
PKG="$WORK/pkg"
mkdir -p "$PKG/packages/core/install" "$PKG/packages/core/audit-self"
printf 'console.log("stub synth");\n' > "$PKG/packages/core/install/synth-and-wire.bundle.mjs"
printf 'console.log("stub wirer");\n' > "$PKG/packages/core/install/wire-eslint-r2.ts"
cp "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" "$PKG/packages/core/audit-self/"

# 99-finalize with the real lib.sh; DELIVERED names the configs getff placed this run.
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
_detect_stacks_per_workspace() { [ -z "${WS_MAP:-}" ] || printf '%b\n' "$WS_MAP"; return 0; }
REFRESH_BASELINE_STAGED=()
for _d in ${DELIVERED:-}; do REFRESH_BASELINE_STAGED+=("$PROJECT_ROOT/$_d"); done
source "$FINALIZE"
EOF

make_project() {
  local p="$WORK/$1"
  mkdir -p "$p/eslint-rules-local"
  printf '{"name":"%s","version":"0.0.0","type":"module"}\n' "$1" > "$p/package.json"
  printf 'export default { rules: {} };\n' > "$p/eslint-rules-local/index.mjs"
  echo "$p"
}
put() { mkdir -p "$(dirname "$1/$2")"; printf '%s\n' "$3" > "$1/$2"; }
boundary_code() { put "$1" "$2/src/routes/users.ts" "export const users = (req: { body: unknown }) => schema.parse(req.body);"; }

# run_finalize <project> [WS_MAP] [DELIVERED] → $F_OUT, summary lines in $F_SUM
run_finalize() {
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$1" PKG_ROOT="$PKG" FINALIZE="$FINALIZE" \
    WS_MAP="${2:-}" DELIVERED="${3:-}" T_FULL="${T_FULL:-}" bash "$DRIVER" < /dev/null 2>&1)
  F_SUM=$(printf '%s\n' "$F_OUT" | grep -E '^      - ' || true)
}
sum_has() { printf '%s\n' "$F_SUM" | grep -qE "$1"; }
sum_show() { printf '%s\n' "$F_SUM" | tr '\n' '|'; }
ran_through() {
  printf '%s\n' "$F_OUT" | grep -q 'For full guide: see INSTALL.md' \
    || bad "$1: the finalize stopped before its end (tail: $(printf '%s\n' "$F_OUT" | tail -4 | tr '\n' '|'))"
}
R2_LINE='^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in '

# ─── S1: ESLINT_ROOT_NOT_WIRED ──────────────────────────────────────────────────
FF_SKIP='fences-fire: skipped — getff.s rules are not in your own root ESLint config'
S1=$(make_project s1)
put "$S1" eslint.config.mjs "// TODO: turn on 'rules-as-tests/no-bare-todo' after the cleanup
$PLAIN_CFG"
T_FULL=1 run_finalize "$S1"; ran_through S1
if printf '%s\n' "$F_OUT" | grep -qE "$FF_SKIP"; then
  ok "S1: a root config naming getff's rules only in a comment is not wired — fences-fire is skipped"
else
  bad "S1: fences-fire was not skipped as not wired for a root config naming getff's rules only in a comment"
fi
S1P=$(make_project s1p)
put "$S1P" eslint.config.mjs "export default [{ rules: { 'rules-as-tests/no-bare-todo': 'error' } }];"
T_FULL=1 run_finalize "$S1P"
if printf '%s\n' "$F_OUT" | grep -qE "$FF_SKIP"; then
  bad "S1 paired: a root config carrying getff's rules in code is treated as not wired"
else
  ok "S1 paired: a root config carrying getff's rules in code is wired"
fi

# ─── S2/S3: _r2_would_wire (the Layer-2 pass cannot run: no ts-morph) ──────────
S2=$(make_project s2); put "$S2" eslint.config.mjs "$R2_CFG"
put "$S2" apps/api/eslint.config.mjs "// TODO: turn on '$R2_ID' once the schemas land
/* '$R2_ID': 'error', */
$PLAIN_CFG"
boundary_code "$S2" apps/api
put "$S2" apps/svc/eslint.config.mjs "// $R2_ID is set by the root config
$PLAIN_CFG"
put "$S2" apps/lib/eslint.config.mjs "$R2_CFG"; boundary_code "$S2" apps/lib
run_finalize "$S2" "" "eslint.config.mjs apps/svc/eslint.config.mjs"; ran_through S2
if sum_has "${R2_LINE}apps/api/eslint.config.mjs — "; then
  ok "S2: your config naming R2 as a quoted id only in comments is a NOT wired line"
else
  bad "S2: expected a NOT wired line for apps/api, whose config quotes R2 only in comments (summary: $(sum_show))"
fi
if sum_has "${R2_LINE}apps/svc/eslint.config.mjs — "; then
  ok "S3: getff's config naming R2 only in a comment is a NOT wired line"
else
  bad "S3: expected a NOT wired line for apps/svc, getff's config naming R2 only in a comment (summary: $(sum_show))"
fi
if sum_has "${R2_LINE}apps/lib/"; then
  bad "S2 paired: apps/lib sets R2 in code, yet it is listed (summary: $(sum_show))"
else
  ok "S2 paired: a config setting R2 in code is not listed"
fi
S3P=$(make_project s3p); put "$S3P" eslint.config.mjs "$R2_CFG"
put "$S3P" apps/svc/eslint.config.mjs "// getff's config for apps/svc
$R2_CFG"
run_finalize "$S3P" "" "eslint.config.mjs apps/svc/eslint.config.mjs"; ran_through S3P
if sum_has "${R2_LINE}apps/svc/"; then
  bad "S3 paired: getff's config setting R2 in code is listed (summary: $(sum_show))"
else
  ok "S3 paired: getff's config setting R2 in code is not listed"
fi

# ─── S4: unknown-stack workspace ───────────────────────────────────────────────
S4=$(make_project s4); boundary_code "$S4" apps/x
put "$S4" apps/x/eslint.config.mjs "// later: { '$R2_ID': 'error' }
$PLAIN_CFG"
run_finalize "$S4" 'apps/x\tunknown'; ran_through S4
if sum_has "${R2_LINE}apps/x — .*stack"; then
  ok "S4: an unknown-stack workspace whose config quotes R2 only in a comment is a NOT wired line"
else
  bad "S4: expected a NOT wired line for apps/x, whose config quotes R2 only in a comment (summary: $(sum_show))"
fi
S4P=$(make_project s4p); boundary_code "$S4P" apps/x
put "$S4P" apps/x/eslint.config.mjs "$R2_CFG"
run_finalize "$S4P" 'apps/x\tunknown'; ran_through S4P
if sum_has "${R2_LINE}apps/x — .*stack"; then
  bad "S4 paired: an unknown-stack workspace setting R2 in code is listed (summary: $(sum_show))"
else
  ok "S4 paired: an unknown-stack workspace setting R2 in code is not listed"
fi

# ─── S5-S7: F11 — the install asks scripts/check-rule-globs.sh about the root config ───
# A stand-in gate: records that it was asked, and fails the way the real one does on a config whose
# RULE_GLOBS.boundary it cannot read.
f11_project() { # $1 name, $2 root config body
  local p; p=$(make_project "$1")
  put "$p" eslint.config.mjs "$2"
  mkdir -p "$p/scripts"
  printf '#!/usr/bin/env bash\ntouch "%s/.gate-asked"\necho "✗ R2 no-unsafe-zod-parse: no globs found under RULE_GLOBS.boundary"\nexit 1\n' "$p" \
    > "$p/scripts/check-rule-globs.sh"
  echo "$p"
}
F11_LINE='^      - RULE_GLOBS in eslint\.config\.mjs \(your own config\) — '

S5=$(f11_project s5 "// RULE_GLOBS and '$R2_ID' come with the next install
$PLAIN_CFG")
run_finalize "$S5"; ran_through S5
if [ -e "$S5/.gate-asked" ]; then
  bad "S5: the gate was asked about a config naming RULE_GLOBS and R2 only in a comment (summary: $(sum_show))"
else
  ok "S5: a config naming RULE_GLOBS and R2 only in a comment is not handed to the gate"
fi
S5P=$(f11_project s5p "$R2_CFG")
run_finalize "$S5P"
if [ -e "$S5P/.gate-asked" ]; then
  ok "S5 paired: a config setting R2 in code is handed to the gate"
else
  bad "S5 paired: the gate was not asked about a config setting R2 in code — S5 would be vacuous"
fi

S6=$(f11_project s6 "// no RULE_GLOBS here: the boundary is the whole repo
$R2_CFG")
run_finalize "$S6"; ran_through S6
if sum_has "${F11_LINE}it sets $R2_ID itself with no RULE_GLOBS block"; then
  ok "S6: RULE_GLOBS in a comment — the summary says the config sets R2 with no RULE_GLOBS block"
else
  bad "S6: expected «it sets $R2_ID itself with no RULE_GLOBS block» (summary: $(sum_show))"
fi

S7=$(f11_project s7 "// rules-as-tests/require-otel-span waits for AIF_STRICT_RUNTIME
$R2_CFG")
run_finalize "$S7"; ran_through S7
if sum_has "${F11_LINE}it sets $R2_ID itself with no RULE_GLOBS block"; then
  ok "S7: a rule id in a comment is not listed among the rules the config sets"
else
  bad "S7: expected only $R2_ID named as set by the config (summary: $(sum_show))"
fi

# ─── S8/S9: 60-ci — widening getff's RULE_GLOBS.boundary ───────────────────────
PKG60="$WORK/pkg60"; mkdir -p "$PKG60/packages/core/audit-self"
printf '#!/usr/bin/env bash\necho boundary-present\necho "glob:src/routes/**/*.ts"\n' \
  > "$PKG60/packages/core/audit-self/detect-r2-boundary.sh"
CI_DRIVER="$WORK/driver-ci.sh"
cat > "$CI_DRIVER" << 'EOF'
set -euo pipefail
DRY_RUN=""; STACK="ts-server"; SKIPPED=(); NOT_WIRED=()
source "$REPO_ROOT/setup.d/lib.sh"
note_not_wired() { NOT_WIRED+=("$1"); echo "NOT-WIRED: $1"; }
REFRESH_BASELINE_STAGED=("$PROJECT_ROOT/eslint.config.mjs")
source "$CI_LAYER"
EOF
run_ci() { # $1 project → $C_OUT
  C_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$1" PKG_ROOT="$PKG60" CI_LAYER="$CI_LAYER" \
    bash "$CI_DRIVER" < /dev/null 2>&1)
}

S8=$(make_project s8)
put "$S8" eslint.config.mjs "// RULE_GLOBS lives in the shared preset, not here
$PLAIN_CFG"
run_ci "$S8"
if printf '%s\n' "$C_OUT" | grep -q 'has no RULE_GLOBS block' \
   && ! printf '%s\n' "$C_OUT" | grep -q 'could not add glob'; then
  ok "S8: RULE_GLOBS only in a comment — no RULE_GLOBS block to widen, no failed write"
else
  bad "S8: expected «has no RULE_GLOBS block» and no «could not add glob» (output: $(printf '%s\n' "$C_OUT" | grep -E 'R2|glob|RULE_GLOBS' | tr '\n' '|'))"
fi

S9=$(make_project s9)
put "$S9" eslint.config.mjs "const RULE_GLOBS = {
  boundary: [
    'src/api/**/*.ts',
  ],
};
// was: 'src/routes/**/*.ts'
$PLAIN_CFG"
run_ci "$S9"
if printf '%s\n' "$C_OUT" | grep -q 'added 1 glob(s) to RULE_GLOBS.boundary' \
   && awk '/boundary: \[/{a=1} a&&/\]/{exit} a' "$S9/eslint.config.mjs" | grep -qF "'src/routes/**/*.ts'"; then
  ok "S9: a boundary glob in a comment is not «already covered» — it is added to the array"
else
  bad "S9: expected the glob added to RULE_GLOBS.boundary (output: $(printf '%s\n' "$C_OUT" | grep -E 'glob|boundary' | tr '\n' '|'))"
fi
S9P=$(make_project s9p)
put "$S9P" eslint.config.mjs "const RULE_GLOBS = {
  boundary: [
    'src/routes/**/*.ts',
  ],
};
$PLAIN_CFG"
run_ci "$S9P"
if printf '%s\n' "$C_OUT" | grep -q 'already covered'; then
  ok "S9 paired: a glob already in the array is already covered"
else
  bad "S9 paired: expected «already covered» (output: $(printf '%s\n' "$C_OUT" | grep -E 'glob|boundary' | tr '\n' '|'))"
fi
S8P=$(make_project s8p)
put "$S8P" eslint.config.mjs "const RULE_GLOBS = {
  boundary: [
    'src/api/**/*.ts',
  ],
};
$PLAIN_CFG"
run_ci "$S8P"
if printf '%s\n' "$C_OUT" | grep -q 'has no RULE_GLOBS block'; then
  bad "S8 paired: a RULE_GLOBS block in code reads as no block — S8 would be vacuous"
else
  ok "S8 paired: a RULE_GLOBS block in code is a block to widen"
fi

# S12: the glob goes into the array the code declares, never into a commented-out one above it —
# and a second install finds it there (idempotent), rather than adding it to the comment again.
S12=$(make_project s12)
put "$S12" eslint.config.mjs "/* old layout, kept for reference:
const RULE_GLOBS = {
  boundary: [
    'src/legacy/**/*.ts',
  ],
};
*/
const RULE_GLOBS = {
  boundary: [
    'src/api/**/*.ts',
  ],
};
$PLAIN_CFG"
run_ci "$S12"; run_ci "$S12"
s12_real=$(sed -n '/^\*\//,$p' "$S12/eslint.config.mjs")   # the code after the commented-out block
s12_n=$(grep -cF "'src/routes/**/*.ts'" "$S12/eslint.config.mjs" || true)
if [ "$s12_n" = 1 ] && grep -qF "'src/routes/**/*.ts'" <<<"$s12_real" \
   && printf '%s\n' "$C_OUT" | grep -q 'already covered'; then
  ok "S12: a commented-out boundary array is skipped — the glob lands once in the real array"
else
  bad "S12: expected the glob once, in the real array, and «already covered» on the 2nd run (count=$s12_n; file: $(tr '\n' '|' < "$S12/eslint.config.mjs"))"
fi

# ─── S10: lib.sh eslint_config_has_getff_rules ─────────────────────────────────
has_rules() { ( export INSTALL_SH_LIB_ONLY=1; source "$REPO_ROOT/setup.d/lib.sh"; eslint_config_has_getff_rules "$1" ); }
S10=$(make_project s10)
put "$S10" base.mjs "$R2_CFG"
put "$S10" a/eslint.config.mjs "// TODO: 'rules-as-tests/no-bare-todo'
$PLAIN_CFG"
put "$S10" b/eslint.config.mjs "// import base from '../base.mjs';
$PLAIN_CFG"
put "$S10" c/eslint.config.mjs "import base from '../base.mjs';
export default [...base];"
if has_rules "$S10/a/eslint.config.mjs"; then
  bad "S10: a rule id in a comment counts as getff's rules"
else
  ok "S10: a rule id in a comment is not getff's rules"
fi
if has_rules "$S10/b/eslint.config.mjs"; then
  bad "S10: an import in a comment is followed"
else
  ok "S10: an import in a comment is not followed"
fi
if has_rules "$S10/c/eslint.config.mjs"; then
  ok "S10 paired: an import in code of a config carrying getff's rules counts"
else
  bad "S10 paired: an import in code was not followed — the arms above would be vacuous"
fi

# S13: reading as code keeps real code — `//` inside a string and a multi-line /* */ before the
# rule do not hide a rule that is set.
S13=$(make_project s13)
put "$S13" a/eslint.config.mjs "const docs = 'https://example.com//rules'; /* a comment
spanning lines */
export default [{ rules: { 'rules-as-tests/no-bare-todo': 'error' } }];"
if has_rules "$S13/a/eslint.config.mjs"; then
  ok "S13: a rule set after a URL string and a multi-line comment still counts"
else
  bad "S13: reading as code dropped a rule that is set (a URL string / multi-line comment before it)"
fi

# S14: an unreadable config reads as empty — it never aborts an install running under set -e.
S14=$(make_project s14); put "$S14" eslint.config.mjs "$R2_CFG"; chmod 000 "$S14/eslint.config.mjs"
s14_err=$( ( set -euo pipefail; export INSTALL_SH_LIB_ONLY=1; source "$REPO_ROOT/setup.d/lib.sh"
  c=$(eslint_config_code "$S14/eslint.config.mjs"); echo "survived:${#c}" ) 2>&1 ) || true
chmod 644 "$S14/eslint.config.mjs"
if [ "$s14_err" = "survived:0" ]; then
  ok "S14: an unreadable config reads as empty, silently, without aborting set -e"
else
  bad "S14: expected «survived:0», got: $(printf '%s' "$s14_err" | tr '\n' '|')"
fi

# ─── S11: one uncomment() ──────────────────────────────────────────────────────
# uncomment() and the regexctx() it calls, as awk source; the quote that may close the shell string
# after the last } is not part of the function.
uncomment_fns() { sed -n -e '/^function regexctx(/,/^}/p' -e '/^function uncomment(/,/^}/p' "$1" | sed "s/^}'$/}/"; }
for gate in check-rule-globs.sh check-rule-enforced.sh; do
  g="$REPO_ROOT/packages/core/audit-self/$gate"
  if uncomment_fns "$g" | grep -q '^function uncomment(' \
     && [ "$(uncomment_fns "$g")" = "$(uncomment_fns "$REPO_ROOT/setup.d/lib.sh")" ]; then
    ok "S11: setup.d/lib.sh's uncomment() and regexctx() are $gate's, byte for byte"
  else
    bad "S11: setup.d/lib.sh's uncomment()/regexctx() differ from $gate's, or are missing ($(diff <(uncomment_fns "$g") <(uncomment_fns "$REPO_ROOT/setup.d/lib.sh") | head -3 | tr '\n' '|'))"
  fi
done

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
