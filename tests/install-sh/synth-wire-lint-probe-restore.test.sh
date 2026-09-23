#!/usr/bin/env bash
# synth-wire-lint-probe-restore.test.sh — critical-review wave 2: the N-rule wirer
# (packages/core/install/synth-and-wire.ts → shipped synth-and-wire.bundle.mjs) rolls back a wiring
# its lint probe PROVES broke ESLint (modified config exits 2, original lints), and 99-finalize.sh
# must not swallow a wiring that did not land.
#
# What the probe does NOT prove (cold-review round 2, recorded in the critical-review ledger): it lints
# throwaway files, so a rule that breaks only on real code, a probe path the consumer's global ignores
# hide, a typed-lint parser that refuses a stdin path, or a config the original already fails on are
# all reported as wired («not verified» in the last case) — the pre-probe behaviour, never worse.
#
#   P1  a brownfield config that already declares `const customRules` (critical-review S7-7) gets a
#       second `customRules` binding injected — a SyntaxError, so ESLint exits 2 on every file.
#       The post-write lint probe must restore the original bytes and exit 3 (NOT wired).
#   P2  paired: a brownfield config the wiring does not break → rules land, rc 0, ESLint loads it.
#   P3  a config whose own plugin is not installed yet (every no-deps install) fails ESLint with AND
#       without the change → the probe cannot judge the wiring, so the rules stay wired (rc 0) and
#       the output says «not verified». Rolling back here un-wired every no-deps install (cold-review
#       F1/F2; b3-monorepo-per-workspace-wire.test.sh went red).
#   P4  a live selector ESLint cannot parse lands in a block scoped to the react-next boundary globs;
#       a probe file next to the config never reaches that block, so the probe also lints one path
#       inside every appended scope → rolled back, rc 3 (cold-review F3).
#   F1  99-finalize maps the wirer's rc 3 to a «NOT wired» summary line (it used to be `|| true`).
#   F2  paired: rc 0 adds no such line.
#
# P1/P2 run the real bundle against the real ESLint (node_modules linked read-only, never installed
# into). Without ESLint they SKIP locally and FAIL under CI, where a skip would prove nothing.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUNDLE="${SYNTH_BUNDLE:-$REPO_ROOT/packages/core/install/synth-and-wire.bundle.mjs}"  # override: RED-check an older bundle
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }

if ! command -v node >/dev/null 2>&1; then
  echo "· node not available — SKIP"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

NM_SRC=""
for _nm in "$REPO_ROOT/packages/core/node_modules" "$REPO_ROOT/node_modules"; do
  # the bundle resolves ts-morph from the consumer, the probe resolves eslint — both must be there
  [ -f "$_nm/eslint/package.json" ] && [ -f "$_nm/ts-morph/package.json" ] && NM_SRC="$_nm" && break
done

# make_consumer <name> <config-body> — a brownfield consumer with a stub rules-as-tests barrel
# (both synthesized rules, schema off so any options validate; like the real wrapper, every
# option's selector becomes a listener, so an unparsable selector fails ESLint) and node_modules
# linked read-only.
make_consumer() {
  local d="$WORK/$1"
  mkdir -p "$d/eslint-rules-local"
  printf '{"name":"%s","version":"0.0.0","type":"module"}\n' "$1" > "$d/package.json"
  printf '%s\n' "$2" > "$d/eslint.config.mjs"
  cat > "$d/eslint-rules-local/index.mjs" << 'EOF'
const rule = { meta: { schema: false }, create(ctx) { return Object.fromEntries(ctx.options.filter((o) => o && o.selector).map((o) => [o.selector, () => {}])); } };
export default { rules: { 'no-server-imports-in-client': rule, 'restricted-syntax-audit-exempt': rule } };
EOF
  ln -s "$NM_SRC" "$d/node_modules"
  echo "$d"
}

# run_wirer <dir> → output in $W_OUT, rc in $W_RC
run_wirer() {
  W_OUT=$(cd "$1" && AIF_SYNTH_PKG_ROOT="$REPO_ROOT/packages/core" \
    node "$BUNDLE" --stack react-next --path "$1/eslint.config.mjs" 2>&1)
  W_RC=$?
}

if [ -z "$NM_SRC" ]; then
  if [ -n "${CI:-}" ]; then
    bad "P1/P2: eslint + ts-morph are not installed under packages/core or the repo root — the probe arms cannot run in CI"
  else
    echo "· P1/P2 SKIP — eslint + ts-morph not installed (run npm ci --prefix packages/core)"
  fi
else
  # ─── P1: a wiring that breaks ESLint is rolled back, rc 3 ────────────────────
  BROKEN_SRC="const customRules = { 'no-console': 'warn' };
export default [{ rules: customRules }];"
  P1=$(make_consumer p1 "$BROKEN_SRC")
  cp "$P1/eslint.config.mjs" "$WORK/p1.orig"
  run_wirer "$P1"
  if [ "$W_RC" -eq 3 ] && cmp -s "$P1/eslint.config.mjs" "$WORK/p1.orig" \
     && printf '%s\n' "$W_OUT" | grep -q 'rolled back'; then
    ok "P1: the wiring broke ESLint → original bytes restored, rc 3, reason printed"
  else
    bad "P1: expected rc 3 + original bytes + 'rolled back', got rc=$W_RC identical=$(cmp -s "$P1/eslint.config.mjs" "$WORK/p1.orig" && echo yes || echo no) (tail: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi
  if ls "$P1"/__aif_nrule_probe__.* >/dev/null 2>&1; then
    bad "P1: the probe left its throwaway files behind"
  else
    ok "P1: the probe removed its throwaway files"
  fi

  # ─── P2: paired — a wiring ESLint accepts lands, rc 0 ─────────────────────────
  CLEAN_SRC="const eslintConfig = [{ rules: { 'no-console': 'warn' } }];
export default [...eslintConfig];"
  P2=$(make_consumer p2 "$CLEAN_SRC")
  cp "$P2/eslint.config.mjs" "$WORK/p2.orig"
  run_wirer "$P2"
  printf 'export const x = 1;\n' > "$P2/probe.js"
  (cd "$P2" && node "$NM_SRC/eslint/bin/eslint.js" probe.js >/dev/null 2>&1); lint_rc=$?
  if [ "$W_RC" -eq 0 ] && ! cmp -s "$P2/eslint.config.mjs" "$WORK/p2.orig" \
     && grep -q 'restricted-syntax-audit-exempt' "$P2/eslint.config.mjs" && [ "$lint_rc" -ne 2 ]; then
    ok "P2: a wiring ESLint accepts is kept (rc 0, rules present, eslint rc=$lint_rc)"
  else
    bad "P2: expected rc 0 + wired config ESLint can load, got rc=$W_RC eslint-rc=$lint_rc (tail: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi

  # ─── P3: plugins not installed yet → the wiring stands, marked not verified ───
  MISSING_SRC="import rn from 'eslint-plugin-aif-not-installed-yet';
const eslintConfig = [{ plugins: { rn }, rules: { 'no-console': 'warn' } }];
export default [...eslintConfig];"
  P3=$(make_consumer p3 "$MISSING_SRC")
  cp "$P3/eslint.config.mjs" "$WORK/p3.orig"
  run_wirer "$P3"
  if [ "$W_RC" -eq 0 ] && grep -q 'restricted-syntax-audit-exempt' "$P3/eslint.config.mjs" \
     && printf '%s\n' "$W_OUT" | grep -q 'not verified'; then
    ok "P3: ESLint fails without the change too → rules kept wired (rc 0), output says not verified"
  else
    bad "P3: expected rc 0 + rules present + 'not verified', got rc=$W_RC identical=$(cmp -s "$P3/eslint.config.mjs" "$WORK/p3.orig" && echo yes || echo no) (tail: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi

  # ─── P4: a broken rule inside a files:-scoped block is caught, rc 3 ───────────
  P4=$(make_consumer p4 "$CLEAN_SRC")
  mkdir -p "$P4/.ai-factory/synthesizer-output"
  cat > "$P4/.ai-factory/synthesizer-output/eslint-rules-snippet.json" << 'JSON'
{ "rules-as-tests/restricted-syntax-audit-exempt": ["error", { "selector": "CallExpression[[[bad", "message": "x" }] }
JSON
  cp "$P4/eslint.config.mjs" "$WORK/p4.orig"
  run_wirer "$P4"
  if [ "$W_RC" -eq 3 ] && cmp -s "$P4/eslint.config.mjs" "$WORK/p4.orig" \
     && printf '%s\n' "$W_OUT" | grep -q 'rolled back'; then
    ok "P4: a scoped block ESLint cannot use → original restored, rc 3"
  else
    bad "P4: expected rc 3 + original bytes + 'rolled back', got rc=$W_RC identical=$(cmp -s "$P4/eslint.config.mjs" "$WORK/p4.orig" && echo yes || echo no) (tail: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi
  if find "$P4" -name '__aif_nrule_probe__*' -not -path '*/node_modules/*' | grep -q .; then
    bad "P4: the scoped probe left files behind"
  else
    ok "P4: the scoped probe left nothing in the consumer tree"
  fi
fi

# ─── F1/F2: 99-finalize turns the wirer's rc 3 into a NOT wired line ───────────
DRIVER="$WORK/driver.sh"
cat > "$DRIVER" << 'EOF'
set -o pipefail
FULL=""; DRY_RUN=""; STACK="react-next"
SKIPPED=(); NOT_WIRED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
_detect_stacks_per_workspace() { :; }
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
reassert_husky_shields() { :; }
source "$REPO_ROOT/setup.d/lib.sh"
source "$FINALIZE"
EOF

# run_finalize <wirer-rc> → output in $F_OUT
run_finalize() {
  local proj="$WORK/f$1-proj" pkg="$WORK/f$1-pkg"
  mkdir -p "$proj" "$pkg/packages/core/install"
  : > "$proj/eslint.config.mjs"
  printf 'console.log("stub wirer"); process.exit(%s);\n' "$1" > "$pkg/packages/core/install/synth-and-wire.bundle.mjs"
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$proj" PKG_ROOT="$pkg" FINALIZE="$FINALIZE" \
    bash "$DRIVER" 2>&1)
}

run_finalize 3
if printf '%s\n' "$F_OUT" | grep -q 'stack rules in eslint.config.mjs'; then
  ok "F1: wirer rc 3 → 99-finalize lists the stack rules under NOT wired"
else
  bad "F1: wirer rc 3 was swallowed — no NOT wired line (tail: $(printf '%s\n' "$F_OUT" | tail -6 | tr '\n' '|'))"
fi
run_finalize 0
if printf '%s\n' "$F_OUT" | grep -q 'stack rules in eslint.config.mjs'; then
  bad "F2: wirer rc 0 still produced a NOT wired line"
elif printf '%s\n' "$F_OUT" | grep -q 'stub wirer'; then
  ok "F2: paired — wirer rc 0 adds no NOT wired line (and the wirer did run)"
else
  bad "F2: the stub wirer never ran, so F1/F2 prove nothing (tail: $(printf '%s\n' "$F_OUT" | tail -4 | tr '\n' '|'))"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
