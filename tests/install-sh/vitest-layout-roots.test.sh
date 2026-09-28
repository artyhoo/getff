#!/usr/bin/env bash
# vitest-layout-roots.test.sh — the vitest.config.ts getff places must find the tests of a project
# that keeps its code outside src/ (operator decision Q4.5, 2026-09-28: layout assumptions are fixed
# by class, derived from the layout, never per stack).
#
# THE BUG (own-config consumer-matrix cell, all four stacks): every preset's vitest.config.ts anchors
# its test and coverage globs on `src/**/`. A project whose code lives in lib/ (or app/ + components/,
# the create-next-app and Expo layouts without src/) got «No test files found, exiting with code 1»
# from `npm test`, and so a RED validate, right after install.
#
# The installer rewrites the `src/**/` anchor of a vitest.config.ts it has just placed to the
# project's own top-level source directories. The preset templates are untouched (Q4.4: whether
# presets ship config templates at all is the one-button design session's call).
#
# Arms:
#   A  every stack: a lib/ project gets exactly the template with `'src/**/` → `'lib/**/`, and an
#      e2e/ directory of Playwright specs is not taken for unit-test code;
#   B  several roots (app/ + components/ + lib/) → one brace anchor `{app,components,lib}`;
#   C  a src/ project and a project with no code yet keep the template byte-for-byte;
#   D  the consumer's own vitest.config.ts is never rewritten;
#   E  with the baseline manifest gone (an install that never reached its flush, or one from before
#      the manifest existed): a plain re-install re-stages the rewritten, unedited delivery as
#      getff's (it is back in the rebuilt manifest), and a --force re-install preserves nothing as a
#      consumer edit. Both compare the disk against the REWRITTEN bytes — the copy_safe parity mode
#      `vitest-layout` — because the raw template is not what was delivered.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

template_of() {
  case "$1" in
    ts-server) echo "$REPO_ROOT/templates/ts-server/vitest.config.ts" ;;
    react-next) echo "$REPO_ROOT/packages/preset-next-15-canonical/templates/vitest.config.ts" ;;
    react-spa) echo "$REPO_ROOT/packages/preset-react-spa/templates/vitest.config.ts" ;;
    react-native) echo "$REPO_ROOT/packages/preset-react-native/templates/vitest.config.ts" ;;
  esac
}
project() { # $1 = dir — an empty project with a package.json and a git repo
  mkdir -p "$1"
  printf '{ "name": "vlr", "version": "0.0.0" }\n' > "$1/package.json"
  git -C "$1" init -q
}
install_into() { # $1 = dir, $2 = stack, rest = install.sh flags
  local d="$1" s="$2"; shift 2
  ( cd "$d" && bash "$REPO_ROOT/install.sh" "$s" "$@" </dev/null ) >"$d.log" 2>&1
}
anchored() { sed "s#'src/\*\*/#'$1/**/#g" "$2"; } # $1 = anchor, $2 = template → the expected bytes

# ── A: lib/ layout, every stack ────────────────────────────────────────────────────────────────
for stack in ts-server react-next react-spa react-native; do
  tpl=$(template_of "$stack")
  grep -q "'src/\*\*/" "$tpl" || { bad "A $stack: the template has no 'src/**/ anchor — arm is vacuous"; continue; }
  d="$WORK/a-$stack"; project "$d"
  mkdir -p "$d/lib" "$d/e2e"
  printf 'export const answer = 42;\n' > "$d/lib/answer.ts"
  printf "import { expect, it } from 'vitest';\nit('x', () => expect(1).toBe(1));\n" > "$d/lib/answer.test.ts"
  printf "import { test } from '@playwright/test';\ntest('home', async () => {});\n" > "$d/e2e/home.spec.ts"
  install_into "$d" "$stack"
  if [ ! -f "$d/vitest.config.ts" ]; then
    bad "A $stack: no vitest.config.ts placed (install rc/log: $(tail -2 "$d.log" | tr '\n' '|'))"
  elif anchored lib "$tpl" | cmp -s - "$d/vitest.config.ts"; then
    ok "A $stack: vitest.config.ts is the template with its test globs anchored on lib/ (e2e/ left out)"
  else
    bad "A $stack: vitest.config.ts is not the lib/-anchored template:"
    anchored lib "$tpl" | diff - "$d/vitest.config.ts" | head -6 | sed 's/^/      /'
  fi
done
grep -q "vitest.config.ts.*lib/" "$WORK/a-react-spa.log" \
  && ok "A: the install says which directories the test globs now cover" \
  || bad "A: the install did not report the rewritten test globs"

# ── B: several source roots ────────────────────────────────────────────────────────────────────
d="$WORK/b"; project "$d"
mkdir -p "$d/app" "$d/components" "$d/lib" "$d/public"
printf 'export default function Page() { return null; }\n' > "$d/app/page.tsx"
printf 'export const Button = () => null;\n' > "$d/components/button.tsx"
printf 'export const x = 1;\n' > "$d/lib/x.ts"
printf 'console.log(1);\n' > "$d/public/sw.js"
install_into "$d" react-next
anchored '{app,components,lib}' "$(template_of react-next)" | cmp -s - "$d/vitest.config.ts" \
  && ok "B: app/ + components/ + lib/ → one brace anchor {app,components,lib} (public/ is not code)" \
  || { bad "B: several roots not anchored as {app,components,lib}:"; grep -n "/\*\*/" "$d/vitest.config.ts" | head -3 | sed 's/^/      /'; }

# ── C: src/ layout, and a project with no code yet — the template, byte for byte ────────────────
d="$WORK/c-src"; project "$d"; mkdir -p "$d/src" "$d/lib"
printf 'export const a = 1;\n' > "$d/src/a.ts"; printf 'export const b = 1;\n' > "$d/lib/b.ts"
install_into "$d" react-spa
cmp -s "$(template_of react-spa)" "$d/vitest.config.ts" \
  && ok "C: a project with src/ keeps the template byte-for-byte" \
  || bad "C: a src/ project's vitest.config.ts was rewritten"
d="$WORK/c-empty"; project "$d"
install_into "$d" react-spa
cmp -s "$(template_of react-spa)" "$d/vitest.config.ts" \
  && ok "C: a project with no code yet keeps the template byte-for-byte" \
  || bad "C: an empty project's vitest.config.ts was rewritten"

# ── D: the consumer's own vitest.config.ts ─────────────────────────────────────────────────────
d="$WORK/d"; project "$d"; mkdir -p "$d/lib"
printf 'export const x = 1;\n' > "$d/lib/x.ts"
printf "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { include: ['src/**/*.test.ts'] } });\n" > "$d/vitest.config.ts"
cp "$d/vitest.config.ts" "$WORK/d.before"
install_into "$d" react-spa
cmp -s "$WORK/d.before" "$d/vitest.config.ts" \
  && ok "D: the consumer's own vitest.config.ts is byte-identical (never rewritten)" \
  || bad "D: the consumer's own vitest.config.ts was changed"

# ── E: no baseline manifest — re-stage on a plain re-install, no false preserve on --force ──────
d="$WORK/a-react-spa"
rm -f "$d/.ai-factory/refresh-baseline.json"
install_into "$d" react-spa
if jq -e 'has("vitest.config.ts")' "$d/.ai-factory/refresh-baseline.json" >/dev/null 2>&1; then
  ok "E: a plain re-install puts the rewritten, unedited vitest.config.ts back in the baseline manifest"
else
  bad "E: the rebuilt baseline manifest has no vitest.config.ts entry (the rewritten delivery reads as the consumer's)"
fi
rm -f "$d/.ai-factory/refresh-baseline.json"
install_into "$d" react-spa --force
if ls "$d/.ai-factory/refresh-conflicts/" 2>/dev/null | grep -q '^vitest\.config\.ts\.'; then
  bad "E: --force preserved the unedited rewritten vitest.config.ts as a consumer edit (parity mode missing)"
else
  ok "E: --force re-install preserves nothing for the unedited rewritten vitest.config.ts"
fi
anchored lib "$(template_of react-spa)" | cmp -s - "$d/vitest.config.ts" \
  && ok "E: after --force the config is still the lib/-anchored template" \
  || bad "E: after --force the config lost its lib/ anchor"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
