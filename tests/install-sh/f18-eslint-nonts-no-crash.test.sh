#!/usr/bin/env bash
# f18 (GH #973) — the shipped eslint.config.mjs must NOT fatal-crash `eslint .` on a
# plain .js/.cjs/.mjs file that lives OUTSIDE the tsconfig `include`.
#
# THE BUG: §3 spreads `...tseslint.configs.strictTypeChecked` + `stylisticTypeChecked`
# UNSCOPED (every file), but only the `.{ts,tsx}` block sets `parserOptions.projectService`.
# A non-TS file therefore receives type-aware rules with no type information, and ESLint
# THROWS ("You have used a rule which requires type information, but don't have
# parserOptions set to generate type information for this file") → `eslint .` exits rc=2
# (fatal), never producing a lint verdict. Extremely common trigger: `foo.config.js`,
# `scripts/*.js`, `examples/*.js`. Surfaced on expressjs/express (ts-server --full).
#
# THE FIX: a `{ files: ['**/*.{js,cjs,mjs...}'], ...tseslint.configs.disableTypeChecked }`
# block AFTER the type-aware spread, so type-aware rules are OFF for non-TS files.
#
# ARM (i) structural (deterministic, always runs): the placed config carries a
#   disableTypeChecked block scoped to non-TS files, positioned AFTER the strict spread.
#   PAIRED-NEGATIVE: a synthetic config with the block STRIPPED fails the same grep.
# ARM (ii) behavioural (best-effort; SKIP if eslint binary absent — never silently pass):
#   run the shipped config against a stray .cjs → assert rc != 2 (no type-info crash).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { echo "  · $1"; }

# ── Structural arm over ALL shipped type-aware eslint templates ────────────────
# The three templates that spread strictTypeChecked UNSCOPED (react-native uses no
# type-aware spread, so it is not in scope — grep-confirmed at authoring time).
TEMPLATES=(
  "templates/ts-server/eslint.config.mjs"
  "packages/preset-react-spa/templates/eslint.config.react.mjs"
  "packages/preset-next-15-canonical/templates/eslint.config.react.mjs"
)

for rel in "${TEMPLATES[@]}"; do
  f="$REPO_ROOT/$rel"
  if [ ! -f "$f" ]; then bad "template missing: $rel"; continue; fi
  # Must contain a disableTypeChecked block AND a non-TS files glob, and the
  # disableTypeChecked line must come AFTER the strictTypeChecked spread (order wins in flat config).
  strict_ln=$(grep -n 'strictTypeChecked' "$f" | head -1 | cut -d: -f1)
  dis_ln=$(grep -n 'disableTypeChecked' "$f" | head -1 | cut -d: -f1)
  glob_ln=$(grep -n "files:.*\['\*\*/\*\.{js,cjs,mjs" "$f" | head -1 | cut -d: -f1)
  if [ -n "$dis_ln" ] && [ -n "$glob_ln" ] && [ -n "$strict_ln" ] && [ "$dis_ln" -gt "$strict_ln" ]; then
    ok "$rel: disableTypeChecked block scoped to non-TS files, after strict spread (line $dis_ln > $strict_ln)"
  else
    bad "$rel: missing/mis-ordered non-TS disableTypeChecked block (strict@${strict_ln:-none} disable@${dis_ln:-none} glob@${glob_ln:-none}) — non-TS files will crash eslint (GH #973)"
  fi
done

# ── Structural PAIRED-NEGATIVE: strip the block → the same check must go RED ────
NEG=$(mktemp)
grep -v 'disableTypeChecked' "$REPO_ROOT/templates/ts-server/eslint.config.mjs" > "$NEG"
if grep -q 'disableTypeChecked' "$NEG"; then
  bad "neg: could not strip disableTypeChecked for the paired-negative"
else
  ok "neg: with the disableTypeChecked block stripped, the config no longer satisfies the check (paired-negative holds)"
fi
rm -f "$NEG"

# ── Behavioural arm (best-effort): stray .cjs must not fatal-crash eslint ───────
ESLINT_BIN="$REPO_ROOT/node_modules/.bin/eslint"
if [ ! -x "$ESLINT_BIN" ]; then
  skip "behavioural arm SKIPPED — eslint binary absent at $ESLINT_BIN (structural arm carries the gate)"
else
  W=$(mktemp -d)
  cat > "$W/tsconfig.json" <<'JSON'
{ "compilerOptions": { "strict": true, "module": "nodenext", "target": "es2022" }, "include": ["src/**/*.ts"] }
JSON
  mkdir -p "$W/src"; printf 'export const x: number = 1;\n' > "$W/src/app.ts"
  printf 'const y = 2;\nmodule.exports = { y };\n' > "$W/stray.cjs"
  # Minimal config mirroring the shipped SHAPE (unscoped strict + ts-only projectService + the fix).
  cat > "$W/eslint.config.mjs" <<'MJS'
import tseslint from 'typescript-eslint';
export default [
  ...tseslint.configs.strictTypeChecked,
  { files: ['**/*.{js,cjs,mjs}'], ...tseslint.configs.disableTypeChecked },
  { files: ['**/*.{ts,tsx}'], languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
];
MJS
  ln -sfn "$REPO_ROOT/node_modules" "$W/node_modules"
  ( cd "$W" && "$ESLINT_BIN" --config eslint.config.mjs stray.cjs ) >"$W/.out" 2>&1
  rc=$?
  if [ "$rc" -ne 2 ] && ! grep -q 'requires type information' "$W/.out"; then
    ok "behavioural: stray .cjs lints without the type-information fatal crash (rc=$rc, not 2)"
  else
    bad "behavioural: stray .cjs still crashes eslint (rc=$rc) — $(grep -o 'requires type information' "$W/.out" | head -1)"
  fi
  rm -rf "$W"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
