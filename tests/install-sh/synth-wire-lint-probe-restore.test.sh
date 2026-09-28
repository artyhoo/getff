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
#       The post-write lint probe must restore the original bytes and exit 3 (NOT wired). What did
#       not land is one «  · not wired: <what> — <why>» line, never advice to add it by hand: adding
#       the same rules by hand breaks ESLint the same way (operator decision Q4.7, 2026-09-28).
#   P2  paired: a brownfield config the wiring does not break → rules land, rc 0, ESLint loads it.
#       Like any TypeScript project's config, it parses TypeScript in the .ts/.tsx files the rules cover.
#   P5  the same config without a TypeScript parser: the stack rules are scoped to .ts/.tsx, so
#       adding them makes ESLint parse those files as JavaScript — a parsing error on every file that
#       uses a type → rolled back, rc 3, the parsing error named, no «by hand» advice.
#   P3  a config whose own plugin is not installed yet (every no-deps install) fails ESLint with AND
#       without the change → the probe cannot judge the wiring, so the rules stay wired (rc 0) and
#       the output says «not verified». Rolling back here un-wired every no-deps install (cold-review
#       F1/F2; b3-monorepo-per-workspace-wire.test.sh went red).
#   P4  a live selector ESLint cannot parse lands in a block scoped to the react-next boundary globs;
#       a probe file next to the config never reaches that block, so the probe also lints one path
#       inside every appended scope → rolled back, rc 3 (cold-review F3).
#   F1  99-finalize maps the wirer's rc 3 to a «NOT wired» summary line (it used to be `|| true`).
#   F1b the wirer's own «  · not wired: <what> — <why>» line reaches that summary with its reason.
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

# no_hand_step <arm> — a wiring that did not land is named with its reason, never left to the consumer
no_hand_step() {
  if printf '%s\n' "$W_OUT" | grep -q '^  · not wired: ' && ! printf '%s\n' "$W_OUT" | grep -qiE 'manually|by hand'; then
    ok "$1: what did not land is a «not wired» line with its reason, no «add it by hand» advice"
  else
    bad "$1: expected a «  · not wired: » line and no manual-step advice (output: $(printf '%s\n' "$W_OUT" | grep -iE 'not wired|manually|by hand' | head -3 | tr '\n' '|'))"
  fi
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
  no_hand_step P1
  if ls "$P1"/__aif_nrule_probe__.* >/dev/null 2>&1; then
    bad "P1: the probe left its throwaway files behind"
  else
    ok "P1: the probe removed its throwaway files"
  fi

  # ─── P2: paired — a wiring ESLint accepts lands, rc 0 ─────────────────────────
  CLEAN_SRC="import tsParser from '@typescript-eslint/parser';
const eslintConfig = [{ files: ['**/*.{ts,tsx}'], languageOptions: { parser: tsParser } }, { rules: { 'no-console': 'warn' } }];
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

  # ─── P5: TS-scoped rules into a config that parses no TypeScript → rolled back ─
  JS_ONLY_SRC="const eslintConfig = [{ rules: { 'no-console': 'warn' } }];
export default [...eslintConfig];"
  P5=$(make_consumer p5 "$JS_ONLY_SRC")
  cp "$P5/eslint.config.mjs" "$WORK/p5.orig"
  run_wirer "$P5"
  if [ "$W_RC" -eq 3 ] && cmp -s "$P5/eslint.config.mjs" "$WORK/p5.orig" \
     && printf '%s\n' "$W_OUT" | grep -q 'Parsing error'; then
    ok "P5: rules over .ts files a config cannot parse → original restored, rc 3, the parsing error named"
  else
    bad "P5: expected rc 3 + original bytes + 'Parsing error', got rc=$W_RC identical=$(cmp -s "$P5/eslint.config.mjs" "$WORK/p5.orig" && echo yes || echo no) (tail: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi
  no_hand_step P5
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
# The config under test is getff's: this run staged it. Unstaged and absent from the baseline
# manifest it is the consumer's own, and 99-finalize never runs the wirer on it (getff_delivered).
REFRESH_BASELINE_STAGED=("$PROJECT_ROOT/eslint.config.mjs")
source "$FINALIZE"
EOF

# run_finalize <wirer-rc> [<line the stub wirer prints>] → output in $F_OUT
run_finalize() {
  local proj="$WORK/f$1-proj${2:+-said}" pkg="$WORK/f$1-pkg${2:+-said}"
  mkdir -p "$proj" "$pkg/packages/core/install"
  : > "$proj/eslint.config.mjs"
  printf 'console.log("stub wirer"); if (process.env.STUB_LINE) console.log(process.env.STUB_LINE); process.exit(%s);\n' "$1" \
    > "$pkg/packages/core/install/synth-and-wire.bundle.mjs"
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$proj" PKG_ROOT="$pkg" FINALIZE="$FINALIZE" \
    STUB_LINE="${2:-}" bash "$DRIVER" 2>&1)
}

run_finalize 3
# The rc-3 fallback wording (this stub prints no «not wired» line of its own), and «stub wirer» so
# the arm fails when the wirer never ran rather than passing on some other NOT wired line.
if printf '%s\n' "$F_OUT" | grep -q 'stub wirer' \
   && printf '%s\n' "$F_OUT" | grep -q 'stack rules in eslint.config.mjs — the synthesized rules-as-tests slice was not added'; then
  ok "F1: wirer rc 3 → 99-finalize lists the stack rules under NOT wired"
else
  bad "F1: wirer rc 3 was swallowed — no NOT wired line (tail: $(printf '%s\n' "$F_OUT" | tail -6 | tr '\n' '|'))"
fi
run_finalize 3 "  · not wired: the stack's rules-as-tests rules — stub-reason-4711"
# The reason must reach the NOT wired summary itself («      - <line>»), not only the wirer's own
# output above it.
if printf '%s\n' "$F_OUT" | grep -q 'stub wirer' \
   && printf '%s\n' "$F_OUT" | grep -qE '^      - .*stub-reason-4711'; then
  ok "F1b: the wirer's «not wired» line reaches the NOT wired summary with its reason"
else
  bad "F1b: the reason the wirer printed is not in the NOT wired summary (tail: $(printf '%s\n' "$F_OUT" | tail -6 | tr '\n' '|'))"
fi
run_finalize 0
if printf '%s\n' "$F_OUT" | grep -q 'stack rules in eslint.config.mjs'; then
  bad "F2: wirer rc 0 still produced a NOT wired line"
elif printf '%s\n' "$F_OUT" | grep -q 'stub wirer'; then
  ok "F2: paired — wirer rc 0 adds no NOT wired line (and the wirer did run)"
else
  bad "F2: the stub wirer never ran, so F1/F2 prove nothing (tail: $(printf '%s\n' "$F_OUT" | tail -4 | tr '\n' '|'))"
fi

# ─── K: the consumer's original cannot be kept aside → the write is undone and reported ────────
# The consumer's own root config, a wirer that adds a line to it, and .ai-factory/before-getff taken
# by a file, so the original cannot be kept there. Run under set -e, as install.sh runs 99-finalize:
# the install must go on, put the original back, and list the config under NOT wired (cold-review
# F10 — the original used to be deleted silently, the changed file left in place).
OWN_DRIVER="$WORK/driver-own.sh"
{ echo 'set -eo pipefail'; grep -v '^REFRESH_BASELINE_STAGED=' "$DRIVER" | grep -v '^set -o pipefail$'; } > "$OWN_DRIVER"
K="$WORK/k-proj"; KP="$WORK/k-pkg"
mkdir -p "$K/.ai-factory" "$K/node_modules/ts-morph" "$KP/packages/core/install"
printf '{"name":"ts-morph","version":"0.0.0"}\n' > "$K/node_modules/ts-morph/package.json"
: > "$K/.ai-factory/before-getff"
printf 'export default [];\n' > "$K/eslint.config.mjs"
printf '%s\n' "import { appendFileSync } from 'node:fs';" \
  "const i = process.argv.indexOf('--path'); appendFileSync(process.argv[i + 1], '// getff block\n');" \
  "console.log('stub own wirer');" > "$KP/packages/core/install/synth-and-wire.bundle.mjs"
K_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$K" PKG_ROOT="$KP" FINALIZE="$FINALIZE" bash "$OWN_DRIVER" 2>&1); K_RC=$?
printf '%s\n' "$K_OUT" | grep -q 'stub own wirer' \
  || bad "K: the own-config wirer never ran — the arm would be vacuous (tail: $(printf '%s\n' "$K_OUT" | tail -4 | tr '\n' '|'))"
[ "$K_RC" -eq 0 ] && [ "$(cat "$K/eslint.config.mjs")" = 'export default [];' ] \
  && printf '%s\n' "$K_OUT" | grep -qE '^      - .*eslint.config.mjs.*original could not be kept' \
  && ok "K: an original that cannot be kept → the install goes on, the file is as it was, NOT wired says why" \
  || bad "K: rc=$K_RC file='$(cat "$K/eslint.config.mjs")' (tail: $(printf '%s\n' "$K_OUT" | tail -6 | tr '\n' '|'))"

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
