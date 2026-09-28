#!/usr/bin/env bash
# depcruise-config-esm.test.sh — the shipped dependency-cruiser config must not turn the consumer's
# OWN lint RED, and must never be placed beside a dependency-cruiser config the consumer already has.
#
# THE BUG (2026-09-28, own-config consumer-matrix cell, all four stacks): install shipped
# `.dependency-cruiser.cjs` (`module.exports = {…}`). ESLint 9 lints *.cjs by default, and a
# consumer's own eslint.config.mjs built from the typescript-eslint getting-started page parses
# every file as an ES module with no node globals — `'module' is not defined (no-undef)`, so
# `npm run lint`, validate and the first commit went RED on a file getff placed. A `/* global */`
# or `/* eslint-disable */` header does not fix it: a consumer config that DOES declare node
# globals for *.cjs reports that header as no-redeclare / an unused directive, RED under
# `--max-warnings=0` (measured on seven configs). Only an ES module with no free globals is
# clean under all of them, so the config ships as `.dependency-cruiser.mjs`.
#
# Arms:
#   A  the template is an ES module whose default export is the rules object;
#   B  it lints clean under the typescript-eslint getting-started config, and the old CJS
#      shape does not (paired negative — proves the lint arm can fail);
#   C  a fresh install places `.dependency-cruiser.mjs` and arch:check names it;
#   D  a project with its own `.dependency-cruiser.js` keeps it: nothing placed beside it,
#      arch:check names the consumer's file, the not-wired summary says so;
#   E  check-arch-boundaries.sh finds the config under any name dependency-cruiser reads,
#      without DEPCRUISE_CONFIG.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TPL="$REPO_ROOT/templates/ts-server/dependency-cruiser.mjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

arch_check() { node -e 'process.stdout.write((require(process.argv[1]).scripts||{})["arch:check"]||"")' "$1/package.json"; }

# ── A: ES module, default export = the rules object ─────────────────────────────────────────────
if [ -f "$TPL" ] && node --input-type=module -e "
  const m = await import(process.argv[1]);
  const c = m.default;
  if (!c || !Array.isArray(c.forbidden) || !c.forbidden.some((r) => r.name === 'no-circular')) process.exit(1);
" "$TPL" 2>/dev/null; then
  ok "A: templates/ts-server/dependency-cruiser.mjs is an ES module exporting the rules (forbidden[] incl. no-circular)"
else
  bad "A: templates/ts-server/dependency-cruiser.mjs missing or not an ES module exporting the rules object"
fi

# ── B: lint-clean under a consumer's own typescript-eslint getting-started config ──────────────
ESLINT="$REPO_ROOT/node_modules/.bin/eslint"
if [ -x "$ESLINT" ] && [ -d "$REPO_ROOT/node_modules/typescript-eslint" ]; then
  L="$WORK/lint"; mkdir -p "$L"
  # Read-only symlink so the config below resolves @eslint/js + typescript-eslint; no install runs here.
  ln -s "$REPO_ROOT/node_modules" "$L/node_modules"
  cat > "$L/eslint.config.mjs" <<'CFG'
// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);
CFG
  [ -f "$TPL" ] && cp "$TPL" "$L/.dependency-cruiser.mjs"
  printf "module.exports = {\n  forbidden: [],\n};\n" > "$L/.dependency-cruiser.cjs"
  out_mjs=$(cd "$L" && "$ESLINT" --max-warnings=0 .dependency-cruiser.mjs 2>&1); rc_mjs=$?
  out_cjs=$(cd "$L" && "$ESLINT" --max-warnings=0 .dependency-cruiser.cjs 2>&1); rc_cjs=$?
  rm -f "$L/node_modules"
  if [ -f "$TPL" ] && [ "$rc_mjs" -eq 0 ]; then
    ok "B: the shipped .dependency-cruiser.mjs lints clean (--max-warnings=0) under the typescript-eslint getting-started config"
  else
    bad "B: the shipped .dependency-cruiser.mjs is not lint-clean under the consumer's config (rc=$rc_mjs):"
    printf '%s\n' "$out_mjs" | tail -5 | sed 's/^/      /'
  fi
  if [ "$rc_cjs" -ne 0 ] && printf '%s\n' "$out_cjs" | grep -q "'module' is not defined"; then
    ok "B neg: the old CommonJS shape fails the same config with no-undef on 'module' (the lint arm can fail)"
  else
    bad "B neg: the CommonJS shape did not fail with no-undef (rc=$rc_cjs) — arm B proves nothing"
  fi
else
  echo "  · B skipped — the framework's eslint/typescript-eslint are not installed (run npm install first)"
fi

# ── C: fresh install ────────────────────────────────────────────────────────────────────────────
C="$WORK/fresh"; mkdir -p "$C"
printf '{ "name": "dcc", "version": "0.0.0" }\n' > "$C/package.json"
( cd "$C" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$WORK/c.log" 2>&1
[ -f "$C/.dependency-cruiser.mjs" ] && ok "C: fresh install placed .dependency-cruiser.mjs" \
  || bad "C: fresh install did not place .dependency-cruiser.mjs"
[ ! -e "$C/.dependency-cruiser.cjs" ] && ok "C: no .dependency-cruiser.cjs placed" \
  || bad "C: a .dependency-cruiser.cjs was placed (the CommonJS shape still ships)"
case "$(arch_check "$C")" in
  *"--config .dependency-cruiser.mjs"*) ok "C: arch:check runs depcruise --config .dependency-cruiser.mjs" ;;
  *) bad "C: arch:check does not name .dependency-cruiser.mjs: '$(arch_check "$C")'" ;;
esac

# ── D: the consumer already has its own dependency-cruiser config ──────────────────────────────
D="$WORK/own"; mkdir -p "$D"
printf '{ "name": "dcd", "version": "0.0.0" }\n' > "$D/package.json"
printf "/** the consumer's own */\nmodule.exports = { forbidden: [] };\n" > "$D/.dependency-cruiser.js"
cp "$D/.dependency-cruiser.js" "$WORK/own.before"
( cd "$D" && git init -q && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$WORK/d.log" 2>&1
cmp -s "$D/.dependency-cruiser.js" "$WORK/own.before" && ok "D: the consumer's .dependency-cruiser.js is byte-identical after install" \
  || bad "D: the consumer's .dependency-cruiser.js was changed"
[ ! -e "$D/.dependency-cruiser.mjs" ] && [ ! -e "$D/.dependency-cruiser.cjs" ] \
  && ok "D: nothing placed beside the consumer's config" \
  || bad "D: getff placed its own dependency-cruiser config beside the consumer's"
case "$(arch_check "$D")" in
  *"--config .dependency-cruiser.js "*) ok "D: arch:check runs depcruise with the consumer's .dependency-cruiser.js" ;;
  *) bad "D: arch:check does not name the consumer's config: '$(arch_check "$D")'" ;;
esac
grep -q 'dependency-cruiser.*\.dependency-cruiser\.js' "$WORK/d.log" \
  && ok "D: the install says the consumer's dependency-cruiser config was kept" \
  || bad "D: the install did not report the kept consumer config"

# ── E: check-arch-boundaries.sh auto-detects the config name ───────────────────────────────────
GATE="$REPO_ROOT/packages/core/audit-self/check-arch-boundaries.sh"
for name in .dependency-cruiser.mjs .dependency-cruiser.js .dependency-cruiser.json; do
  E="$WORK/e-${name#.dependency-cruiser.}"; mkdir -p "$E/apps/web" "$E/packages/lib"
  # A monorepo config WITHOUT a packages→apps rule: the gate must find it and fail (not skip).
  printf "export default { forbidden: [{ name: 'x', from: { path: '^src' }, to: { path: '^lib' } }] };\n" > "$E/$name"
  out=$(cd "$E" && env -u DEPCRUISE_CONFIG bash "$GATE" 2>&1); rc=$?
  if [ "$rc" -eq 1 ] && printf '%s\n' "$out" | grep -q "$name has NO packages"; then
    ok "E: check-arch-boundaries.sh found $name without DEPCRUISE_CONFIG (and alarmed on the missing boundary)"
  else
    bad "E: check-arch-boundaries.sh did not find $name (rc=$rc): $(printf '%s' "$out" | head -1)"
  fi
done

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
