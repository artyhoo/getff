#!/usr/bin/env bash
# typecheck-matches-tsconfig.test.sh — P2 G4 (one-button): getff's typecheck must check something.
#   (A) a solution tsconfig (`files: []` + `references`, create-vite's shape) → `typecheck` is
#       `tsc -b`. `tsc --noEmit` on it checks NO file: measured 2026-09-29 on a create-vite copy,
#       a planted `const n: number = "x"` gave `tsc -b` exit 2 (TS2322) and `tsc --noEmit` exit 0.
#   (B) paired: a flat tsconfig keeps `tsc --noEmit`.
#   (C) a project's own `typecheck` script is kept.
#   (D) react-spa / react-next with no tsconfig: the tsconfig getff writes can compile a React
#       file — jsx react-jsx, DOM libs, Bundler resolution (P1 run 2026-09-29: TS17004 «Cannot use
#       JSX» and TS2584 «Cannot find name 'document'» on src/main.tsx). Paired: ts-server's is
#       the shared template, unchanged; a project's own tsconfig is never edited.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

proj() {  # $1 = package.json body
  local d; d=$(mktemp -d); TMPS+=("$d")
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t
    printf '%s\n' "$1" > package.json; git add -A && git commit -q -m base )
  echo "$d"
}
script_of() { node -e 'const p=require(process.argv[1]);console.log((p.scripts||{})[process.argv[2]]||"")' "$1/package.json" "$2"; }
tsopt() { node -e 'const c=require(process.argv[1]).compilerOptions||{};const v=c[process.argv[2]];console.log(Array.isArray(v)?v.join(","):String(v))' "$1/tsconfig.json" "$2"; }

SPA='{"name":"s","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0","react-dom":"^19.0.0"},"devDependencies":{"vite":"^6.0.0","typescript":"~5.9.0"}}'

# ── (A) solution tsconfig → tsc -b ──────────────────────────────────────────────────────────────
A=$(proj "$SPA")
printf '{\n  "files": [],\n  "references": [{ "path": "./tsconfig.app.json" }]\n}\n' > "$A/tsconfig.json"
printf '{ "compilerOptions": { "jsx": "react-jsx" }, "include": ["src"] }\n' > "$A/tsconfig.app.json"
( cd "$A" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
[ "$(script_of "$A" typecheck)" = "tsc -b" ] && ok "(A) solution tsconfig → typecheck is 'tsc -b'" \
  || bad "(A) typecheck is '$(script_of "$A" typecheck)'"
grep -q '"files": \[\]' "$A/tsconfig.json" && ok "(A) the project's tsconfig.json is untouched" || bad "(A) tsconfig.json was edited"

# ── (B) flat tsconfig → tsc --noEmit ────────────────────────────────────────────────────────────
B=$(proj "$SPA")
printf '{ "compilerOptions": { "strict": true }, "include": ["src"] }\n' > "$B/tsconfig.json"
( cd "$B" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
[ "$(script_of "$B" typecheck)" = "tsc --noEmit" ] && ok "(B) flat tsconfig → typecheck stays 'tsc --noEmit'" \
  || bad "(B) typecheck is '$(script_of "$B" typecheck)'"

# ── (C) the project's own typecheck is kept ─────────────────────────────────────────────────────
C=$(proj '{"name":"c","version":"0.0.0","type":"module","scripts":{"typecheck":"vue-tsc --noEmit"},"dependencies":{"react":"^19.0.0"}}')
printf '{\n  "files": [],\n  "references": [{ "path": "./tsconfig.app.json" }]\n}\n' > "$C/tsconfig.json"
( cd "$C" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
[ "$(script_of "$C" typecheck)" = "vue-tsc --noEmit" ] && ok "(C) the project's own typecheck is kept" \
  || bad "(C) typecheck is '$(script_of "$C" typecheck)'"

# ── (D) the tsconfig getff writes for a React stack compiles React ───────────────────────────────
for st in react-spa react-next; do
  D=$(proj "$SPA")
  ( cd "$D" && bash "$INSTALL" "$st" < /dev/null >/dev/null 2>&1 )
  [ "$(tsopt "$D" jsx)" = "react-jsx" ] && ok "(D) $st: tsconfig.json has jsx react-jsx" || bad "(D) $st: jsx=$(tsopt "$D" jsx)"
  [ "$(tsopt "$D" lib)" = "ES2022,DOM,DOM.Iterable" ] && ok "(D) $st: lib has DOM" || bad "(D) $st: lib=$(tsopt "$D" lib)"
  [ "$(tsopt "$D" moduleResolution)" = "Bundler" ] && [ "$(tsopt "$D" module)" = "ESNext" ] \
    && ok "(D) $st: Bundler resolution (no .js extension demanded on relative imports)" \
    || bad "(D) $st: module=$(tsopt "$D" module) moduleResolution=$(tsopt "$D" moduleResolution)"
  [ "$(tsopt "$D" strict)" = "true" ] && ok "(D) $st: the rest of getff's template is kept (strict)" || bad "(D) $st: strict=$(tsopt "$D" strict)"
done
T=$(proj '{"name":"t","version":"0.0.0","devDependencies":{"typescript":"~5.9.0"}}')
( cd "$T" && bash "$INSTALL" ts-server < /dev/null >/dev/null 2>&1 )
cmp -s "$REPO_ROOT/packages/core/templates/shared/tsconfig.json" "$T/tsconfig.json" \
  && ok "(D) ts-server: tsconfig.json is the shared template byte-for-byte" || bad "(D) ts-server tsconfig differs from the template"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
