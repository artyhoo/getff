#!/usr/bin/env bash
# b3-monorepo-per-workspace-wire.test.sh — #827 B3 paired-negative (monorepo routing).
#
# Proves setup.d/99-finalize.sh wires the live-research snippet into the per-WORKSPACE
# eslint.config.mjs of a multi-stack monorepo that has NO root eslint.config.mjs — the case
# where the root-only synth-wire block (gated on a root config) wires the live rule NOWHERE.
#
# Boundary: this test pre-seeds the EMITTED snippet (.ai-factory/synthesizer-output/
# eslint-rules-snippet.json) and runs the REAL `install.sh react-native --force`, so it exercises
# the actual 99-finalize per-workspace routing + 40-configs per-workspace config placement. The
# snippet's ORIGIN (the factory under --full) is B1/B2's concern, proven by the wire-live-snippet
# oracle; B3's concern is "given a snippet, route it to the right workspace config".
#
# Routing under test: research is root-level + stack-keyed; `install.sh <stack>` routes the snippet
# to workspaces whose DETECTED stack == <stack>. So a react-native install wires apps/mobile (RN)
# and MUST NOT wire apps/api (ts-server).
#
# Arms (each able to fail; T1/T14 non-vacuity):
#   POS — apps/mobile/eslint.config.mjs (react-native) gains the RN selector (FAILS without B3:
#         no root config ⇒ the root synth-wire block never runs ⇒ snippet wires nowhere).
#   NEG — apps/api/eslint.config.mjs (ts-server) does NOT gain the RN selector (routing is
#         stack-matched, not blanket — proves the wire is conditional on stack, not unconditional).
#   CTL — apps/mobile/eslint.config.mjs exists at all (40-configs per-workspace placement) — guards
#         against a vacuous POS where the file is simply absent.
#   JS  — apps/native (react-native) owns an ES-module eslint.config.js, the name ESLint loads first:
#         the selector lands in THAT file by insertions, its original is kept, no eslint.config.mjs is
#         placed beside it, and it is not in the not-wired summary (the pass used to look for
#         eslint.config.mjs only, and the .js got nothing — cold-review, after #1868).
#   OWN — apps/worker, a ts-server workspace with its own ES-module eslint.config.js and no HTTP
#         boundary code, gets nothing from a react-native install: it is named once in the not-wired
#         summary and left byte-identical (40-configs named it before the per-workspace passes took
#         the .js over, and it went silent when they did not apply — cold-review). A same-name own
#         eslint.config.mjs is synth-wire-consumer-config's arm F: --force here replaces it by design.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

if ! command -v node >/dev/null 2>&1; then
  skip "node not available — B3 monorepo wire test skipped (degrade-on-absent)"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0
fi

RN_SEL="object.name='localStorage'"
echo "▶ #827 B3 — per-workspace live-research wiring in a no-root-config monorepo"
echo ""

# ── Build a multi-stack monorepo: apps/mobile (expo/RN) + apps/api (ts-server), NO root config ──
E=$(mktemp -d)
mkdir -p "$E/apps/mobile" "$E/apps/api" "$E/apps/native" "$E/apps/worker/src" "$E/.ai-factory/synthesizer-output"
printf '{"name":"b3-monorepo","version":"0.0.0","private":true}\n' > "$E/package.json"
printf 'packages:\n  - "apps/*"\n' > "$E/pnpm-workspace.yaml"
printf '{"name":"mobile","version":"0.0.0","dependencies":{"react-native":"0.74.0","expo":"~51.0.0","react":"18.2.0"}}\n' > "$E/apps/mobile/package.json"
printf '{"name":"api","version":"0.0.0","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$E/apps/api/package.json"
printf '{"name":"native","version":"0.0.0","type":"module","dependencies":{"react-native":"0.74.0","react":"18.2.0"}}\n' > "$E/apps/native/package.json"
NATIVE_BEFORE="$E/.native.before"
printf "// The consumer's own lint config for this workspace.\nexport default [{ rules: { 'no-console': 'error' } }];\n" > "$NATIVE_BEFORE"
cp "$NATIVE_BEFORE" "$E/apps/native/eslint.config.js"
printf '{"name":"worker","version":"0.0.0","type":"module","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$E/apps/worker/package.json"
echo 'export const x = 1;' > "$E/apps/worker/src/index.ts"
cp "$NATIVE_BEFORE" "$E/apps/worker/eslint.config.js"

# Pre-seed the EMITTED live-research snippet (factory output — B1/B2 concern, decoupled here).
cat > "$E/.ai-factory/synthesizer-output/eslint-rules-snippet.json" <<JSON
{ "rules-as-tests/restricted-syntax-audit-exempt": ["error", { "selector": "MemberExpression[$RN_SEL]", "message": "no web localStorage in React Native" }] }
JSON

# The synth-wire bundle (run from PROJECT_ROOT during 99-finalize) parses the config via ts-morph
# to AST-merge the rule — it does NOT execute the config, so only ts-morph must resolve. A --force
# install installs no dev-deps, so borrow the framework's node_modules (which carries ts-morph) for
# the duration of the install — the same pattern t6 uses for its eslint run. Without it wireNRules
# degrades to manual-add guidance and the POS arm would be a false negative (env, not logic).
NM_SRC=""
for _nm in "$REPO_ROOT/node_modules" "$REPO_ROOT/packages/core/node_modules"; do
  [ -f "$_nm/ts-morph/package.json" ] && NM_SRC="$_nm" && break
done
if [ -n "$NM_SRC" ] && [ ! -e "$E/node_modules" ]; then
  ln -s "$NM_SRC" "$E/node_modules"
fi

( cd "$E" && git init -q && bash "$REPO_ROOT/install.sh" react-native --force </dev/null ) >"$E/.install.log" 2>&1
install_rc=$?
if [ "$install_rc" -ne 0 ]; then
  bad "install.sh react-native --force non-zero rc=$install_rc (tail: $(tail -3 "$E/.install.log" | tr '\n' '|'))"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

# ── CTL — per-workspace config placed ────────────────────────────────────────
if [ -f "$E/apps/mobile/eslint.config.mjs" ]; then
  ok "CTL: apps/mobile/eslint.config.mjs placed (40-configs per-workspace) — POS is non-vacuous"
else
  bad "CTL: apps/mobile/eslint.config.mjs MISSING — 40-configs did not place the RN workspace config"
fi

# ── POS — RN selector wired into the react-native workspace ──────────────────
if [ -z "$NM_SRC" ] && grep -qiE 'could not auto-wire|AST editor unavailable|ts-morph' "$E/.install.log"; then
  skip "POS SKIP — ts-morph unavailable in this env; the per-workspace synth-wire ran but degraded to manual-add (the NEG routing arm + the install log confirm the loop fired)"
elif [ -f "$E/apps/mobile/eslint.config.mjs" ] && grep -q "$RN_SEL" "$E/apps/mobile/eslint.config.mjs"; then
  ok "POS: RN live selector wired into apps/mobile/eslint.config.mjs (per-workspace synth-wire — B3)"
else
  bad "POS: RN selector NOT in apps/mobile/eslint.config.mjs — B3 unfixed (no root config ⇒ snippet wired nowhere). synth-wire log: $(grep -i 'synth-wire' "$E/.install.log" | tr '\n' '|' | head -c 200)"
fi

# ── NEG — routing: ts-server workspace must NOT get the RN rule ──────────────
if [ -f "$E/apps/api/eslint.config.mjs" ] && grep -q "$RN_SEL" "$E/apps/api/eslint.config.mjs"; then
  bad "NEG: RN selector LEAKED into apps/api/eslint.config.mjs (ts-server) — routing is blanket, not stack-matched"
else
  ok "NEG: RN selector absent from apps/api/eslint.config.mjs (ts-server) — routing is stack-matched, not unconditional"
fi

# ── JS — a workspace's own ES-module eslint.config.js gets the selector ──────
if [ -z "$NM_SRC" ]; then
  skip "JS SKIP — ts-morph unavailable in this env"
else
  [ ! -e "$E/apps/native/eslint.config.mjs" ] \
    && ok "JS: no eslint.config.mjs placed beside apps/native's own eslint.config.js" \
    || bad "JS: eslint.config.mjs placed in apps/native — ESLint still loads the .js, getff's file would be dead"
  if grep -q "$RN_SEL" "$E/apps/native/eslint.config.js" \
     && node -e 'const fs = require("fs");
       const a = fs.readFileSync(process.argv[1], "utf8"), b = fs.readFileSync(process.argv[2], "utf8");
       let i = 0; for (const c of b) if (i < a.length && c === a[i]) i++;
       process.exit(i === a.length ? 0 : 1);' "$NATIVE_BEFORE" "$E/apps/native/eslint.config.js"; then
    ok "JS: RN live selector wired into apps/native/eslint.config.js by insertions only"
  else
    bad "JS: RN selector NOT in apps/native/eslint.config.js (or a character of it changed) — the per-workspace pass skips an eslint.config.js"
  fi
  _kept=0; _k=""
  for _f in "$E/.ai-factory/before-getff/apps/native/eslint.config.js".*; do [ -f "$_f" ] && { _kept=$((_kept+1)); _k="$_f"; }; done
  [ "$_kept" -eq 1 ] && cmp -s "$_k" "$NATIVE_BEFORE" \
    && ok "JS: one kept original of apps/native/eslint.config.js" \
    || bad "JS: $_kept kept original(s) of apps/native/eslint.config.js, expected one byte-equal copy"
  grep -q 'apps/native' <<<"$(awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$E/.install.log")" \
    && bad "JS: the not-wired summary still lists apps/native: $(grep -n 'apps/native' "$E/.install.log" | head -2 | tr '\n' '|')" \
    || ok "JS: apps/native is not reported as unwired"
fi

# ── OWN — a workspace's own config this install adds nothing to is named, not skipped in silence ──
_nw=$(awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$E/.install.log")
cmp -s "$NATIVE_BEFORE" "$E/apps/worker/eslint.config.js" && ok "OWN: apps/worker/eslint.config.js is byte-identical" \
  || bad "OWN: apps/worker/eslint.config.js was changed"
_n=$(printf '%s\n' "$_nw" | grep -c 'apps/worker.*eslint\.config\.js')
[ "$_n" -eq 1 ] && ok "OWN: the not-wired summary names apps/worker/eslint.config.js once" \
  || bad "OWN: the not-wired summary names apps/worker/eslint.config.js $_n time(s), expected 1 (summary: $(printf '%s' "$_nw" | tr '\n' '|' | head -c 400))"
grep -qiE 'by hand|manually|merge .* into' <<<"$(printf '%s\n' "$_nw" | grep 'apps/worker')" \
  && bad "OWN: the line asks for a manual step: $(printf '%s\n' "$_nw" | grep 'apps/worker' | head -1)" \
  || ok "OWN: no manual step in the line for apps/worker"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
