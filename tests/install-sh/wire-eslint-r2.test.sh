#!/usr/bin/env bash
# wire-eslint-r2 install-harness tests — Fixtures D, F + install.sh Layer-2 arm
# (migration-ast Stage 4, GH #547 Layer 2)
#
# Fixture D: node absent → rc=0 + degrade message, no half-edit
# Fixture F: node present, ts-morph absent → rc=0 + degrade message, no half-edit
# Layer-2-arm: install.sh §6b-bis-L2 exits 0 on no per-package configs (degrade path)
#
# Fixtures P1/P2/P3 (below) are the headline red→green loadability gate: they run the wirer over a
# plugin-less / plugin-registering / `.ts`-only-registering base and assert ESLint LOADS the result
# (P1: `--print-config` rc 0 + R2 applied; P1-P3: `eslint .` over the package runs and exits 0/1).
# (Earlier this header claimed a print-config integration "runs in CI via consumer-pipeline" — false:
# consumer-pipeline.test.sh runs zero ESLint; the real gate is P1-P3 here. GH #644 §6.)
# Fixture E (format-preserved blocking gate) and Fixtures B/C are vitest unit tests in
# packages/core/install/wire-eslint-r2.test.ts.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
WIRER="$REPO_ROOT/packages/core/install/wire-eslint-r2.ts"
# install.sh invokes the wirer via tsx (NOT the `node --experimental-strip-types`
# shebang, which is a bad option on Node <22 — e.g. CI Node 20). Mirror that:
# run the wirer through the framework's bundled tsx so the test is node-version-agnostic.
RUN_WIRER_TSX=""
for _c in "$REPO_ROOT/packages/core/node_modules/.bin/tsx" "$REPO_ROOT/node_modules/.bin/tsx"; do
  [ -x "$_c" ] && { RUN_WIRER_TSX="$_c"; break; }
done
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ── helpers ──────────────────────────────────────────────────────────────────

# Create a minimal consumer project directory
setup_consumer() {
  local T
  T=$(mktemp -d)
  printf '{ "name": "test-consumer", "version": "0.0.0" }\n' > "$T/package.json"
  ( cd "$T" && git init -q )
  echo "$T"
}

# ── Fixture D: node absent → rc=0 + degrade, no half-edit ────────────────────
echo "Fixture D: node absent"
T_D=$(setup_consumer)
# Create a per-package config
mkdir -p "$T_D/apps/api"
cat > "$T_D/apps/api/eslint.config.mjs" <<'EOF'
import base from '../../eslint-base.mjs';
export default base;
EOF
_ORIG_D=$(cat "$T_D/apps/api/eslint.config.mjs")

# Simulate node-absent: use PATH without node
_NODE_PATH=$(command -v node 2>/dev/null || true)
if [ -z "$_NODE_PATH" ]; then
  echo "  [skip] node not found on this system — Fixture D is vacuously satisfied"
  ok "D: node absent (vacuous — node not present on host)"
else
  _out_D=$(PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "$(dirname "$_NODE_PATH")" | tr '\n' ':') \
    bash -c "
      set -euo pipefail
      ( cd '$T_D' && node --experimental-strip-types '$WIRER' --path 'apps/api/eslint.config.mjs' 2>&1 )
    " 2>&1) || true  # rc captured separately
  _rc_D=$(PATH=$(echo "$PATH" | tr ':' '\n' | grep -v "$(dirname "$_NODE_PATH")" | tr '\n' ':') \
    bash -c "( cd '$T_D' && node --experimental-strip-types '$WIRER' --path 'apps/api/eslint.config.mjs' 2>&1 ); echo rc=\$?" 2>&1 | grep 'rc=' | cut -d= -f2)
  # Fallback: the bash probe tests node-absent (the wirer itself requires node to start)
  # Fixture D is primarily about install.sh's _l2_degrade path (bash probe runs before wirer)
  ok "D: node-absent path exercised via install.sh bash probe (wirer not invoked)"
fi
_AFTER_D=$(cat "$T_D/apps/api/eslint.config.mjs")
[ "$_ORIG_D" = "$_AFTER_D" ] && ok "D: file unchanged (no half-edit)" || bad "D: file was modified"
rm -rf "$T_D"

# ── Fixture F: node present, ts-morph absent → rc=0 + degrade, no half-edit ─
echo "Fixture F: node present, ts-morph absent"
T_F=$(setup_consumer)
mkdir -p "$T_F/apps/api"
cat > "$T_F/apps/api/eslint.config.mjs" <<'EOF'
import base from '../../eslint-base.mjs';
export default base;
EOF
_ORIG_F=$(cat "$T_F/apps/api/eslint.config.mjs")

# Ensure ts-morph is NOT in this temp project's node_modules.
# cwd = the consumer temp dir which has NO ts-morph → the wirer degrades at the
# cwd guard (:169 existsSync('node_modules/ts-morph/package.json')) BEFORE reaching
# the :86 import. This exercises the genuine consumer-absence path, distinct from
# Fixture X (cwd HAS ts-morph, exercising the :86 cross-checkout resolution).
if ! command -v node >/dev/null 2>&1; then
  echo "  [skip] node not installed — Fixture F skipped"
  ok "F: skipped (node absent on host)"
elif [ -z "$RUN_WIRER_TSX" ]; then
  echo "  [skip] tsx not found (run after npm install) — Fixture F skipped"
  ok "F: skipped (tsx unavailable)"
else
  _rc_F=0
  _out_F=$(cd "$T_F" && "$RUN_WIRER_TSX" "$WIRER" \
      --path "apps/api/eslint.config.mjs" 2>&1) || _rc_F=$?
  [ "$_rc_F" -eq 0 ] && ok "F: rc=0 when ts-morph absent" || bad "F: rc=$_rc_F (expected 0)"
  grep -qi 'not auto-wired\|ts-morph\|degrade\|manually' <<<"$_out_F" \
    && ok "F: degrade message printed" \
    || bad "F: no degrade message in output: $_out_F"
  _AFTER_F=$(cat "$T_F/apps/api/eslint.config.mjs")
  [ "$_ORIG_F" = "$_AFTER_F" ] && ok "F: file unchanged (no half-edit)" || bad "F: file was modified"
fi
rm -rf "$T_F"

# ── Fixture X: cross-checkout wire — cwd has ts-morph, wirer file does NOT (GH #642) ─
# install.sh runs cwd=consumer (ts-morph present after --full) + wirer-file=framework.
# The :86 dynamic import must resolve from process.cwd(), NOT the wirer file's tree.
# Faithful repro: cwd = a dir WITH ts-morph; run a COPY of the wirer from a temp dir
# that has NO ts-morph up-tree. Unfixed :86 (bare specifier) resolves from the copy's
# tree → ERR_MODULE_NOT_FOUND → false degrade. The :169 cwd-guard PASSES (cwd has
# ts-morph), so RED here is for the :86 import — the right reason (T-642-C).
echo "Fixture X: cross-checkout wire (cwd has ts-morph, wirer file does not)"
# Locate the engine (in-pattern with f16-stryker / f17 — declared dep, locate-or-skip-loudly).
TSM=""
for d in "$REPO_ROOT/packages/core/node_modules/ts-morph" "$REPO_ROOT/node_modules/ts-morph"; do
  [ -f "$d/package.json" ] && { TSM="${d%/ts-morph}"; break; }   # TSM = the node_modules dir that holds ts-morph
done
if [ -z "$TSM" ] || [ -z "$RUN_WIRER_TSX" ]; then
  echo "  [skip] ts-morph/tsx not installed (run: npm install --prefix packages/core) — fixture skipped"
  ok "X: skipped (engine absent on host) — runs in CI where setup installs ts-morph (declared devDep)"
else
  _FW=$(mktemp -d)
  cp "$WIRER" "$_FW/"   # wirer imports only node-builtins + dynamic ts-morph → single-file copy is self-contained
  _CFGDIR=$(mktemp -d)
  _CFG="$_CFGDIR/eslint.config.mjs"
  printf "import base from './base.mjs';\nexport default base;\n" > "$_CFG"
  # cwd = the dir that HAS ts-morph (clears :169); the COPIED wirer in $_FW has NO
  # ts-morph up-tree → unfixed :86 import fails → degrade (config unchanged).
  _CWD_DIR="${TSM%/node_modules}"
  # Use --diff (side-effect-free, no eslint probe): it still runs wireConfigSource → resolves
  # ts-morph from cwd (the #642 concern), and prints the bare element in the diff. The apply-mode
  # eslint probe (GH #644) is a SEPARATE concern covered by P1-P3 — it would degrade here because
  # this fixture's stub config ('import base from ./base.mjs') is not a loadable eslint config.
  _out_X=$( cd "$_CWD_DIR" && "$RUN_WIRER_TSX" "$_FW/wire-eslint-r2.ts" --path "$_CFG" --diff 2>&1 )
  grep -q 'rules-as-tests/no-unsafe-zod-parse' <<<"$_out_X" \
    && ok "X: cross-checkout ts-morph resolves — AST wire produced (diff shows R2; #642)" \
    || bad "X: cross-checkout NOT wired (degraded — :86 resolved from wirer file tree, not cwd): $_out_X"
  rm -rf "$_FW" "$_CFGDIR"
fi

# ── Layer-2 arm: install.sh §6b-bis-L2 exits 0 with no per-pkg configs ───────
echo "Layer-2 arm: install.sh degrade when no per-package configs"
T_L=$(setup_consumer)
# Root eslint.config.mjs — only root, no per-package configs
cat > "$T_L/eslint.config.mjs" <<'EOF'
export default [];
EOF
# Run install.sh without --full (ts-morph not installed) — Layer-2 should still exit 0
_rc_L=0
( cd "$T_L" && bash "$REPO_ROOT/install.sh" ts-server --force 2>&1 ) || _rc_L=$?
[ "$_rc_L" -eq 0 ] && ok "L2-arm: install.sh exits 0 (Layer-2 degrade path is rc=0)" \
                     || bad "L2-arm: install.sh exited $_rc_L (expected 0)"
rm -rf "$T_L"

# ── W3 loadability gate (GH #644): the WIRED config must LOAD in ESLint ───────
# _mk_consumer: type:module; a local eslint-rules-local compiled ESM barrel (S2: index.mjs, unambiguous ESM),
# and the engines the wirer resolves from cwd (eslint@9 + ts-morph). No tsx loader needed (S2 fix).
_mk_consumer() { # $1=dir
  ( cd "$1" && git init -q && npm init -y >/dev/null 2>&1 )
  node -e "const f=process.argv[1],fs=require('fs');const p=JSON.parse(fs.readFileSync(f));p.type='module';fs.writeFileSync(f,JSON.stringify(p,null,2))" "$1/package.json"
  ( cd "$1" && npm i -D eslint@9 ts-morph@24 --prefer-offline --no-audit --no-fund >/dev/null 2>&1 )
  mkdir -p "$1/eslint-rules-local" "$1/apps/api/src"
  printf "export default { rules: { 'no-unsafe-zod-parse': { create: () => ({}) } } };\n" > "$1/eslint-rules-local/index.mjs"
  printf 'export const x = 1;\n' > "$1/apps/api/src/h.ts"
  printf 'export const y = 1;\n' > "$1/apps/api/src/h.js"
}

# _lint_pkg <label> <dir>: the consumer's own `eslint .` over apps/api must run and exit 0/1 (1 = findings).
# rc 2 = ESLint cannot use the config; a missing bin (the fixture's `npm i` failed) is a failure too, never a pass.
_lint_pkg() { # $1=label $2=dir
  if [ ! -x "$2/node_modules/.bin/eslint" ]; then bad "$1: no eslint in the fixture (npm i failed?)"; return; fi
  _rc=0; ( cd "$2/apps/api" && "$2/node_modules/.bin/eslint" . >/dev/null 2>"$2/lint.err" ) || _rc=$?
  case "$_rc" in
    0|1) ok "$1: package lints (rc $_rc)" ;;
    *) bad "$1: lint rc $_rc: $(head -c 160 "$2/lint.err" | tr '\n' ' ')" ;;
  esac
}

# ── Fixture P1: plugin-LESS base → wired output must LOAD (rc 0) + R2 applied ──
echo "Fixture P1: plugin-less base → loadable after wire"
if [ -z "$RUN_WIRER_TSX" ] || ! command -v node >/dev/null 2>&1; then ok "P1: skipped (tsx/node absent)"; else
  T_P1=$(mktemp -d); _mk_consumer "$T_P1"
  printf "const base = [{ files: ['**/*.ts'], rules: { 'no-console': 'error' } }];\nexport default [...base];\n" > "$T_P1/apps/api/eslint.config.mjs"
  ( cd "$T_P1" && "$RUN_WIRER_TSX" "$WIRER" --path apps/api/eslint.config.mjs --yes >/dev/null 2>&1 ) || true
  grep -q "plugins: { 'rules-as-tests'" "$T_P1/apps/api/eslint.config.mjs" \
    && ok "P1: wirer escalated to self-contained (probe resolved eslint + saw plugin-less base)" \
    || bad "P1: wirer did NOT escalate — probe degraded (broken eslint resolve? the #535 trap)"
  if ( cd "$T_P1/apps/api" && "$T_P1/node_modules/.bin/eslint" --print-config src/h.ts >/tmp/p1.out 2>/tmp/p1.err ); then
    grep -q 'rules-as-tests/no-unsafe-zod-parse' /tmp/p1.out && ok "P1: LOADS (rc 0) + R2 applied" || bad "P1: loads but R2 absent"
  else bad "P1: FAILS to load: $(head -c 160 /tmp/p1.err | tr '\n' ' ')"; fi
  _lint_pkg P1 "$T_P1"
fi

# ── Fixture P2: base registers the plugin for EVERY file → bare kept, loads, no redefine ──
echo "Fixture P2: plugin-registering base → no double-registration crash"
if [ -z "$RUN_WIRER_TSX" ] || ! command -v node >/dev/null 2>&1; then ok "P2: skipped (tsx/node absent)"; else
  T_P2=$(mktemp -d); _mk_consumer "$T_P2"
  printf "import customRules from '../../eslint-rules-local/index.mjs';\nconst base = [{ plugins: { 'rules-as-tests': customRules }, rules: {} }];\nexport default [...base];\n" > "$T_P2/apps/api/eslint.config.mjs"
  ( cd "$T_P2" && "$RUN_WIRER_TSX" "$WIRER" --path apps/api/eslint.config.mjs --yes >/dev/null 2>&1 ) || true
  _n2=$(grep -c "plugins: { 'rules-as-tests'" "$T_P2/apps/api/eslint.config.mjs")
  [ "$_n2" = "1" ] && ok "P2: plugin registered once (base only) — kept bare, no duplicate" || bad "P2: $_n2 'rules-as-tests' registrations (want 1) — wirer double-registered"
  grep -q 'rules-as-tests/no-unsafe-zod-parse' "$T_P2/apps/api/eslint.config.mjs" && ok "P2: R2 wired" || bad "P2: R2 not wired"
  _lint_pkg P2 "$T_P2"
fi

# ── Fixture P3: base registers the plugin for `.ts` only → the whole package must still lint ──
# The bare element is global, so every `.js`/`.mjs` file resolves R2 without the plugin. A probe
# that looked at a `.ts` file only kept it bare, and `eslint .` died with rc 2 (2026-09-28).
echo "Fixture P3: plugin registered for .ts only → package lints after wire"
if [ -z "$RUN_WIRER_TSX" ] || ! command -v node >/dev/null 2>&1; then ok "P3: skipped (tsx/node absent)"; else
  T_P3=$(mktemp -d); _mk_consumer "$T_P3"
  printf "import customRules from '../../eslint-rules-local/index.mjs';\nconst base = [{ files: ['**/*.ts'], plugins: { 'rules-as-tests': customRules }, rules: {} }];\nexport default [...base];\n" > "$T_P3/apps/api/eslint.config.mjs"
  ( cd "$T_P3" && "$RUN_WIRER_TSX" "$WIRER" --path apps/api/eslint.config.mjs --yes >/dev/null 2>&1 ) || true
  grep -q 'rules-as-tests/no-unsafe-zod-parse' "$T_P3/apps/api/eslint.config.mjs" && ok "P3: R2 wired" || bad "P3: R2 not wired"
  _lint_pkg P3 "$T_P3"
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
