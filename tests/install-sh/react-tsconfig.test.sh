#!/usr/bin/env bash
# tests/install-sh/react-tsconfig.test.sh — getff's React templates typecheck and test a Vite-style
# React project (one-button P3; P1 road run step 12, P2 plan G2/G4).
#
# Measured 2026-09-29 on a Vite 6 + React 19 project: the shared tsconfig template
# (packages/core/templates/shared/tsconfig.json: NodeNext, lib ES2022, no jsx) fails `tsc --noEmit`
# with TS17004 (no jsx) and TS2584 (no DOM); adding only jsx + DOM still fails on Vite's own
# `import App from './App.tsx'` (TS5097) and on an extensionless import (TS2835). The React template
# (tsconfig.react.json: Bundler resolution, jsx react-jsx, DOM, noEmit + allowImportingTsExtensions)
# passes both import forms. Which stack gets which template is the installer's routing (P2).
#
# Arms:
#   R1  tsconfig.react.json typechecks a React entry (JSX, `document`, `./App.tsx`, `./Other`)
#   R2  paired negative: the shared tsconfig.json fails on the same files with TS17004 — the reason
#       the React template exists
#   V1  the shipped React vitest configs do not import @vitejs/plugin-react (its latest peers vite ^8,
#       so a project on vite 6 or 7 cannot load it, and the installer drops it — P2 G2) and set
#       `esbuild: { jsx: 'automatic' }`, which was measured to run a JSX test with no plugin on
#       vite 6.4.3, 7.3.6 and 8.3.1 (a config with neither fails on 6 and 7: «React is not defined»)
#
# React itself is stubbed (node_modules/react/jsx-runtime.d.ts): the arms check compiler options,
# not React's types, and CI has no React in getff's own node_modules.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TSC="$REPO_ROOT/node_modules/.bin/tsc"
[ -x "$TSC" ] || { echo "  ⊝ typescript is not installed in this checkout — skipped"; echo "PASS=0 FAIL=0"; exit 0; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/src" "$WORK/node_modules/react"
printf '{"name":"react","version":"19.0.0"}\n' > "$WORK/node_modules/react/package.json"
cat > "$WORK/node_modules/react/jsx-runtime.d.ts" <<'EOF'
export namespace JSX {
  interface Element {}
  interface IntrinsicElements { [name: string]: unknown }
}
export function jsx(type: unknown, props: unknown, key?: unknown): JSX.Element;
export function jsxs(type: unknown, props: unknown, key?: unknown): JSX.Element;
export const Fragment: unique symbol;
EOF
printf '{"name":"probe","private":true,"type":"module"}\n' > "$WORK/package.json"
cat > "$WORK/src/main.tsx" <<'EOF'
import App from './App.tsx';
import Other from './Other';

const root = document.getElementById('root');
export const tree = (
  <div id={root?.id ?? 'root'}>
    <App />
    <Other />
  </div>
);
EOF
printf 'export default function App() {\n  return <h1>hi</h1>;\n}\n' > "$WORK/src/App.tsx"
printf 'export default function Other() {\n  return <p>other</p>;\n}\n' > "$WORK/src/Other.tsx"

cp "$REPO_ROOT/packages/core/templates/shared/tsconfig.react.json" "$WORK/tsconfig.json"
if out=$(cd "$WORK" && "$TSC" --noEmit -p tsconfig.json 2>&1); then
  ok "R1 tsconfig.react.json typechecks JSX, document, './App.tsx' and './Other'"
else bad "R1 tsconfig.react.json fails: $(head -3 <<<"$out" | tr '\n' '|')"; fi

cp "$REPO_ROOT/packages/core/templates/shared/tsconfig.json" "$WORK/tsconfig.json"
out=$(cd "$WORK" && "$TSC" --noEmit -p tsconfig.json 2>&1) && rc=0 || rc=$?
if [ "$rc" -ne 0 ] && grep -q 'TS17004' <<<"$out"; then
  ok "R2 the shared tsconfig.json fails on the same React files (TS17004) — why the React template exists"
else bad "R2 the shared template no longer fails on React files (rc=$rc) — is tsconfig.react.json still needed?"; fi

for cfg in packages/preset-react-spa/templates/vitest.config.ts packages/preset-next-15-canonical/templates/vitest.config.ts; do
  f="$REPO_ROOT/$cfg"
  if grep -qE "from ['\"]@vitejs/plugin-react['\"]|require\\(['\"]@vitejs/plugin-react" "$f"; then bad "V1 $cfg imports @vitejs/plugin-react"
  elif grep -qE "esbuild: \{ jsx: 'automatic' \}" "$f"; then ok "V1 $cfg needs no React plugin and sets the automatic JSX runtime"
  else bad "V1 $cfg sets no JSX runtime: a JSX test fails on vite 6/7 with «React is not defined»"; fi
done

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
