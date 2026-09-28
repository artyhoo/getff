#!/usr/bin/env bash
# synth-wire-consumer-config.test.sh — getff adds its block to an ESLint config the CONSUMER owns,
# by insertions only, and keeps the original (operator decision Q4.7, 2026-09-28).
#
# History. copy_safe keeps a consumer's own eslint.config.mjs. Until #1860 the synth-wire merged the
# preset's rules-as-tests rules into it anyway, with no RULE_GLOBS block, so check:globs failed
# validate and every push (own-config consumer-matrix cell, react-next). #1860 stopped writing and
# printed «add it by hand» instead, which left getff's rules switched off in every project with its
# own config — a manual step the operator never asked for. Q4.7: getff writes its block itself —
# its stack rules, an ignores entry for the files getff delivered, and R2 with a RULE_GLOBS block
# when the install found an HTTP boundary — as text insertions; the file's original is kept at
# .ai-factory/before-getff/<path>.<sha8> whenever the write changes it; the config stays the
# consumer's (never recorded in the refresh baseline); and check:globs stays green on it.
#
# Provenance, not content, decides ownership: a config getff delivered is staged by this run or
# recorded in .ai-factory/refresh-baseline.json by an earlier one; the consumer's own is neither.
#
# Arms:
#   U  lib.sh helpers: eslint_flat_config follows ESLint's own lookup order; keep_original_snapshot
#      + keep_original_settle keep a copy only when the file changed;
#   A  consumer-owned eslint.config.mjs (react-next, ambiguous layout): getff's rules and ignores
#      land in it by insertions only, the original is kept, the config is not claimed in
#      the baseline, check:globs passes, nothing asks for a manual edit; a re-install changes nothing;
#   P  the same config on an install without ts-morph (no --full): untouched, and the not-wired
#      summary says a --full install adds the block — not «by hand»;
#   B  paired negative — getff's own config (fresh install, then a plain re-install that finds it
#      in the baseline manifest): synth-wire still runs on it as before;
#   C  consumer-owned config WITH a live-research snippet: the snippet's rule lands in it;
#   R  consumer-owned config on a project with an HTTP boundary (ts-server): RULE_GLOBS + R2 land in
#      it, check:globs and check:enforced pass, and R2 FIRES on the boundary file;
#   G  a root eslint.config.js (ESM) — the name ESLint loads first — is wired the same way;
#   H  a root eslint.config.cjs is left byte-identical and reported without a manual step, and
#      check:globs no longer exits 2 on it;
#   D  a monorepo workspace config the consumer owns: the live snippet lands in it, original kept;
#   I  a root config getff placed on an EARLIER install (the refresh-baseline manifest holds its hash)
#      that the consumer has edited since — a trailing comma and a same-line comment on its last
#      entry: its bytes are the consumer's, so the next live rule goes in the own-config way —
#      insertions only, the original kept — never the AST re-print, which printed the new blocks
#      INSIDE that comment (the rule never reached ESLint) and repeated the comment after each;
#   J  paired with I: the same config left as getff wrote it (the manifest's hash still matches the
#      post-processed file) still goes through getff's branch, so I's route is the edit;
#   K  both at once on the per-workspace synth-wire: of two getff-placed workspace configs, the
#      edited one goes the own-config way and the untouched one through getff's branch;
#   E  the R2 Layer-2 wirer (`--yes` under --full) on a per-package config the consumer owns: R2
#      lands in it, the original is kept, and prettier still accepts the file;
#   F  the R2 per-workspace wirer on a multi-stack monorepo: the consumer's workspace config gets R2
#      with its original kept, and the one getff placed in a sibling workspace goes through as before.
# E and F need --full (the wirer only writes with --yes); the dependency install it triggers is
# stubbed — `npm`, `pnpm` and `yarn` install/add exit 0 without touching the network, every other
# command of theirs is real.
# ts-morph is borrowed from the framework through per-package symlinks inside a REAL node_modules
# directory, and a scope such as @eslint is a real directory too, with each of its packages linked:
# any symlinked directory would let a package install write into the framework's tree. The last
# check compares the framework's scope directories before and after all arms. Without ts-morph the
# wirer degrades and arm A would fail for the wrong reason, so its absence is a FAIL, not a skip.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM

FW_NM="$REPO_ROOT/node_modules"
borrow() { # $1 = project dir — link the packages the wirer and its lint probe resolve
  # $2 = tsx: also link tsx, so the R2 wirer's `npx --no-install tsx` resolves, and prettier (E, F)
  # A scope directory is created for real and its packages linked one by one: a linked scope
  # directory is the framework's own, and a package install in the fixture writes into it.
  local p q
  mkdir -p "$1/node_modules"
  for p in ts-morph typescript eslint @eslint typescript-eslint @typescript-eslint; do
    [ -e "$FW_NM/$p" ] || continue
    case "$p" in
      @*) mkdir -p "$1/node_modules/$p"
          for q in "$FW_NM/$p"/*; do ln -s "$q" "$1/node_modules/$p/${q##*/}"; done ;;
      *)  ln -s "$FW_NM/$p" "$1/node_modules/$p" ;;
    esac
  done
  if [ "${2:-}" = tsx ]; then
    ln -s "$FW_NM/tsx" "$1/node_modules/tsx"
    ln -s "$FW_NM/prettier" "$1/node_modules/prettier"
    mkdir -p "$1/node_modules/.bin"
    ln -s "$FW_NM/.bin/tsx" "$1/node_modules/.bin/tsx"
  fi
}
unborrow() {
  find "$1/node_modules" -maxdepth 2 -type l -exec rm -f {} + 2>/dev/null
  rmdir "$1/node_modules/.bin" "$1/node_modules/@eslint" "$1/node_modules/@typescript-eslint" 2>/dev/null
  rmdir "$1/node_modules" 2>/dev/null; return 0
}

if [ ! -f "$FW_NM/ts-morph/package.json" ]; then
  bad "ts-morph is not installed in the framework (run npm install first) — without it arm A is vacuous"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
# The framework's scope directories, entry by entry with link targets. A package manager that runs
# in a fixture writes through any directory the fixture reaches by symlink: pnpm renamed
# @eslint/js to .ignored_js here and left a link into a .pnpm store the framework does not have.
fw_print() {
  local d e
  for d in "$FW_NM/@eslint" "$FW_NM/@typescript-eslint"; do
    for e in "$d"/* "$d"/.[!.]*; do
      [ -e "$e" ] || [ -L "$e" ] || continue
      if [ -L "$e" ]; then printf '%s -> %s\n' "$e" "$(readlink "$e")"; else printf '%s\n' "$e"; fi
    done
  done
}
fw_print > "$WORK/fw.before"

# only_insertions <before> <after> — <after> is <before> with text inserted: every character of
# <before> is still there, in order, none changed or removed. Character level, not line level: a
# one-line list (`export default tseslint.config(a, b);`, the form used here) can only grow on its
# own line (appendInsertion in wire-eslint-r2.ts). The multi-line form keeps every line whole —
# tests/consumer-matrix/own-config-cell.sh checks that on the scaffolder-shaped config.
only_insertions() {
  node -e 'const fs = require("fs");
    const a = fs.readFileSync(process.argv[1], "utf8"), b = fs.readFileSync(process.argv[2], "utf8");
    let i = 0; for (const c of b) if (i < a.length && c === a[i]) i++;
    process.exit(i === a.length ? 0 : 1);' "$1" "$2"
}
# kept_original <project> <rel> <before> — exactly one kept original of <rel>, byte-equal to <before>.
kept_original() {
  local n=0 f k=""
  for f in "$1/.ai-factory/before-getff/$2".*; do [ -f "$f" ] && { n=$((n+1)); k="$f"; }; done
  [ "$n" -eq 1 ] && cmp -s "$k" "$3"
}
# The not-wired summary: its header, then one «- …» line per piece, up to the blank line that ends
# it (the «files were skipped» list after it names kept files, which is not a not-wired report).
not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }
# asks_by_hand <log> — a line about the ESLint config that hands the work back to the human, in any
# wording the wirers have used (T3: the R2 snippet said «Add to <cfg> (adjust the relative path…)»).
asks_by_hand() {
  grep -iE 'eslint|R2' "$1" | grep -qiE 'by hand|manually|merge .* into it|add to .*adjust|adjust the relative path'
}
in_baseline() { jq -e --arg k "$2" 'has($k)' "$1/.ai-factory/refresh-baseline.json" >/dev/null 2>&1; }

# ── U: lib.sh helpers ──────────────────────────────────────────────────────────────────────────
(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  u="$WORK/u"; mkdir -p "$u/order" "$u/cjs" "$u/ts" "$u/none"
  : > "$u/order/eslint.config.mjs"; : > "$u/order/eslint.config.js"
  : > "$u/cjs/eslint.config.cjs"; : > "$u/ts/eslint.config.mts"; : > "$u/ts/eslint.config.ts"
  [ "$(eslint_flat_config "$u/order")" = eslint.config.js ] \
    && echo "OK eslint_flat_config picks eslint.config.js over .mjs, as ESLint does" \
    || echo "BAD eslint_flat_config on .js + .mjs: '$(eslint_flat_config "$u/order" 2>&1)'"
  [ "$(eslint_flat_config "$u/cjs")" = eslint.config.cjs ] && [ "$(eslint_flat_config "$u/ts")" = eslint.config.ts ] \
    && [ -z "$(eslint_flat_config "$u/none")" ] \
    && echo "OK eslint_flat_config names .cjs / .ts (before .mts) and nothing for a dir with no config" \
    || echo "BAD eslint_flat_config on .cjs / .ts+.mts / none"
  PROJECT_ROOT="$u/proj"; mkdir -p "$PROJECT_ROOT/apps/api"
  f="$PROJECT_ROOT/apps/api/eslint.config.mjs"; printf 'export default [];\n' > "$f"
  snap=$(keep_original_snapshot "$f")
  kept=$(keep_original_settle "$f" "$snap")
  [ -z "$kept" ] && [ ! -e "$snap" ] && [ ! -d "$PROJECT_ROOT/.ai-factory/before-getff" ] \
    && echo "OK an unchanged file keeps no copy and leaves no snapshot" \
    || echo "BAD unchanged file: kept='$kept' snapshot-left=$([ -e "$snap" ] && echo yes || echo no)"
  snap=$(keep_original_snapshot "$f")
  printf 'export default [{ ignores: [] }];\n' > "$f"
  kept=$(keep_original_settle "$f" "$snap")
  case "$kept" in
    "$PROJECT_ROOT/.ai-factory/before-getff/apps/api/eslint.config.mjs."????????)
      [ "$(cat "$kept")" = 'export default [];' ] && [ ! -e "$snap" ] \
        && echo "OK a changed file's original is kept at .ai-factory/before-getff/<path>.<sha8>" \
        || echo "BAD the kept copy is not the original, or the snapshot was left behind" ;;
    *) echo "BAD a changed file's original was not kept where expected (got '$kept')" ;;
  esac
  # The original cannot be kept aside (here .ai-factory/before-getff is a file): the write is undone
  # and the caller told, never the original silently lost (cold-review F10).
  PROJECT_ROOT="$u/proj2"; mkdir -p "$PROJECT_ROOT/.ai-factory"; : > "$PROJECT_ROOT/.ai-factory/before-getff"
  f="$PROJECT_ROOT/eslint.config.mjs"; printf 'export default [];\n' > "$f"
  snap=$(keep_original_snapshot "$f")
  printf 'export default [{ ignores: [] }];\n' > "$f"
  kept=$(keep_original_settle "$f" "$snap" 2>"$u/settle.err") && rc=0 || rc=$?
  [ "$rc" -ne 0 ] && [ -z "$kept" ] && [ "$(cat "$f")" = 'export default [];' ] && [ ! -e "$snap" ] \
    && grep -q 'eslint.config.mjs' "$u/settle.err" \
    && echo "OK an original that cannot be kept aside: the write is undone, the caller told (rc $rc), the file named" \
    || echo "BAD unkeepable original: rc=$rc kept='$kept' file='$(cat "$f")' snapshot-left=$([ -e "$snap" ] && echo yes || echo no) err='$(tr '\n' '|' < "$u/settle.err")'"
  # The ignores entry names the files getff delivered, never a directory the consumer may own too:
  # getff places .storybook/main.ts and .storybook/preview.ts, and the consumer's own stories config
  # beside them keeps its lint (cold-review F13 — the entry was .storybook/**).
  eval "$(sed -n '/^_own_eslint_ignores() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"
  PROJECT_ROOT="$u/proj3"; mkdir -p "$PROJECT_ROOT/.storybook"
  getff_delivered() { case "${1#"$PROJECT_ROOT"/}" in .storybook/main.ts|.storybook/preview.ts) return 0 ;; esac; return 1; }
  ign=$(_own_eslint_ignores)
  printf '%s\n' "$ign" | grep -qxF '.storybook/main.ts' && printf '%s\n' "$ign" | grep -qxF '.storybook/preview.ts' \
    && ! printf '%s\n' "$ign" | grep -qF '.storybook/**' \
    && echo "OK the ignores entry names .storybook/main.ts and .storybook/preview.ts, not the whole .storybook/" \
    || echo "BAD the storybook ignores: $(printf '%s\n' "$ign" | tr '\n' '|')"
) > "$WORK/u.log" 2>&1
while IFS= read -r l; do
  case "$l" in OK\ *) ok "U: ${l#OK }" ;; BAD\ *) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u.log"
grep -qE '^(OK|BAD) ' "$WORK/u.log" || bad "U: the lib.sh helper arm printed nothing ($(tail -2 "$WORK/u.log" | tr '\n' '|'))"

# ── A: consumer-owned config, react-next, ambiguous layout ─────────────────────────────────────
A="$WORK/own"; mkdir -p "$A/lib"
printf '{ "name": "swa", "version": "0.0.0" }\n' > "$A/package.json"
cat > "$A/eslint.config.mjs" <<'JS'
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);
JS
printf 'export const answer = 42;\n' > "$A/lib/answer.ts"
cp "$A/eslint.config.mjs" "$WORK/own.before"
borrow "$A"
( cd "$A" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/a.log" 2>&1
rc_a=$?
cp "$A/eslint.config.mjs" "$WORK/own.after"
( cd "$A" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/a2.log" 2>&1
rc_a2=$?
unborrow "$A"
[ "$rc_a" -eq 0 ] && [ "$rc_a2" -eq 0 ] || bad "A: install rc=$rc_a / re-install rc=$rc_a2 (tail: $(tail -3 "$WORK/a.log" | tr '\n' '|'))"
grep -q 'rules-as-tests/' "$WORK/own.after" && grep -qF "'eslint-rules-local/**'" "$WORK/own.after" \
  && ok "A: getff's stack rules and its ignores entry are in the consumer's eslint.config.mjs" \
  || { bad "A: getff's block is not in the consumer's eslint.config.mjs:"; sed 's/^/      /' "$WORK/own.after" | head -20; }
only_insertions "$WORK/own.before" "$WORK/own.after" \
  && ok "A: nothing of the consumer's config was changed or removed — getff only inserted" \
  || bad "A: a character of the consumer's config was changed or removed"
kept_original "$A" eslint.config.mjs "$WORK/own.before" \
  && ok "A: the original is kept once at .ai-factory/before-getff/eslint.config.mjs.<sha8>" \
  || bad "A: no single byte-equal kept original under .ai-factory/before-getff/ ($(ls "$A/.ai-factory/before-getff" 2>&1 | tr '\n' ' '))"
in_baseline "$A" eslint.config.mjs \
  && bad "A: the consumer's config was recorded in the refresh baseline — a refresh would treat it as getff's" \
  || ok "A: the config stays the consumer's (not recorded in the refresh baseline)"
not_wired "$WORK/a.log" | grep -q 'eslint.config' \
  && bad "A: the not-wired summary still lists the eslint config: $(not_wired "$WORK/a.log" | grep 'eslint.config' | head -2 | tr '\n' '|')" \
  || ok "A: the not-wired summary has no eslint config line"
asks_by_hand "$WORK/a.log" \
  && bad "A: the install still asks for a manual ESLint edit: $(grep -iE 'eslint' "$WORK/a.log" | grep -iE 'by hand|manually|merge .* into it' | head -2 | tr '\n' '|')" \
  || ok "A: nothing in the install output asks for a manual ESLint edit"
( cd "$A" && bash scripts/check-rule-globs.sh ) >"$WORK/a.globs" 2>&1 \
  && ok "A: check:globs passes on the wired config (no RULE_GLOBS: no boundary was found)" \
  || bad "A: check:globs fails on the wired config: $(tail -3 "$WORK/a.globs" | tr '\n' '|')"
grep -qiE 'by hand|manually' "$WORK/a.globs" && bad "A: check:globs asks for a manual edit" || ok "A: check:globs asks for no manual edit"
cmp -s "$A/eslint.config.mjs" "$WORK/own.after" && kept_original "$A" eslint.config.mjs "$WORK/own.before" \
  && ok "A: a re-install changes nothing and keeps no second copy" \
  || bad "A: the re-install changed the config or kept another copy"

# ── P: the same config, no ts-morph (a plain install puts none in node_modules) ────────────────
P="$WORK/own-plain"; mkdir -p "$P/lib"
printf '{ "name": "swp", "version": "0.0.0" }\n' > "$P/package.json"
cp "$WORK/own.before" "$P/eslint.config.mjs"
printf 'export const answer = 42;\n' > "$P/lib/answer.ts"
( cd "$P" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/p.log" 2>&1
cmp -s "$P/eslint.config.mjs" "$WORK/own.before" \
  && ok "P: without ts-morph the consumer's config is left byte-identical" \
  || bad "P: the config changed on an install that cannot run the AST editor"
not_wired "$WORK/p.log" | grep 'eslint.config.mjs' | grep -q -- '--full' \
  && ok "P: the not-wired summary says a --full install adds getff's block" \
  || bad "P: the not-wired summary does not point at --full: $(not_wired "$WORK/p.log" | grep 'eslint' | head -2 | tr '\n' '|')"
asks_by_hand "$WORK/p.log" && bad "P: the install asks for a manual ESLint edit" || ok "P: nothing asks for a manual ESLint edit"

# ── B: getff's own config — fresh install, then a plain re-install ─────────────────────────────
B="$WORK/fresh"; mkdir -p "$B"
printf '{ "name": "swb", "version": "0.0.0" }\n' > "$B/package.json"
borrow "$B"
( cd "$B" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/b1.log" 2>&1
rc_b1=$?
( cd "$B" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/b2.log" 2>&1
rc_b2=$?
unborrow "$B"
[ "$rc_b1" -eq 0 ] && [ "$rc_b2" -eq 0 ] || bad "B: install rc=$rc_b1 / re-install rc=$rc_b2"
grep -q '▶ synth-wire: confirming' "$WORK/b1.log" && ! grep -q 'is your own config' "$WORK/b1.log" \
  && ok "B neg: a freshly placed getff config still goes through synth-wire" \
  || bad "B neg: synth-wire treated getff's own freshly placed config as the consumer's"
grep -q '▶ synth-wire: confirming' "$WORK/b2.log" && ! grep -q 'synth-wire: eslint.config.mjs is your own config' "$WORK/b2.log" \
  && ok "B neg: on a re-install, getff's config (in the baseline manifest) still goes through synth-wire" \
  || bad "B neg: synth-wire treated getff's own config as the consumer's on a re-install"
[ ! -d "$B/.ai-factory/before-getff" ] && ok "B neg: getff's own config keeps no 'before getff' copy" \
  || bad "B neg: a copy of getff's own config was kept as if it were the consumer's"

# ── C: consumer-owned config WITH a live-research snippet ──────────────────────────────────────
SEL="Identifier[name='swcLiveProbe']"
seed_snippet() { # $1 = project dir
  mkdir -p "$1/.ai-factory/synthesizer-output"
  cat > "$1/.ai-factory/synthesizer-output/eslint-rules-snippet.json" <<JSON
{ "rules-as-tests/restricted-syntax-audit-exempt": ["error", { "selector": "$SEL", "message": "live-research probe" }] }
JSON
}
C="$WORK/own-live"; mkdir -p "$C/lib"
printf '{ "name": "swc", "version": "0.0.0" }\n' > "$C/package.json"
cp "$WORK/own.before" "$C/eslint.config.mjs"
printf 'export const answer = 42;\n' > "$C/lib/answer.ts"
seed_snippet "$C"
borrow "$C"
( cd "$C" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/c.log" 2>&1
rc_c=$?
unborrow "$C"
[ "$rc_c" -eq 0 ] || bad "C: install.sh react-next rc=$rc_c (tail: $(tail -3 "$WORK/c.log" | tr '\n' '|'))"
grep -qF 'swcLiveProbe' "$C/eslint.config.mjs" && only_insertions "$WORK/own.before" "$C/eslint.config.mjs" \
  && ok "C: the live-researched rule lands in the consumer's config, every original line kept" \
  || bad "C: the live-researched rule is not in the consumer's config (or a character of it was changed or removed)"
kept_original "$C" eslint.config.mjs "$WORK/own.before" && ok "C: the original is kept" || bad "C: no kept original"
not_wired "$WORK/c.log" | grep -q 'eslint-rules-snippet.json' \
  && bad "C: the not-wired summary still points at the snippet" || ok "C: the snippet is not reported as unwired"

# ── R: consumer-owned config on a project with an HTTP boundary (ts-server) ────────────────────
R="$WORK/own-r2"; mkdir -p "$R/src/routes"
printf '{ "name": "swr", "version": "0.0.0", "dependencies": { "zod": "^3.23.0" } }\n' > "$R/package.json"
cp "$WORK/own.before" "$R/eslint.config.mjs"
cat > "$R/src/routes/users.ts" <<'TS'
import { z } from 'zod';

const User = z.object({ name: z.string() });

export const create = (body: unknown) => User.parse(body);
TS
borrow "$R"
( cd "$R" && git init -q && bash "$REPO_ROOT/install.sh" ts-server </dev/null ) >"$WORK/r.log" 2>&1
rc_r=$?
( cd "$R" && node node_modules/eslint/bin/eslint.js src/routes/users.ts ) >"$WORK/r.lint" 2>&1
( cd "$R" && AIF_ESLINT_CMD="node $R/node_modules/eslint/bin/eslint.js" bash scripts/check-rule-enforced.sh ) >"$WORK/r.enforced" 2>&1
rc_enf=$?
unborrow "$R"
[ "$rc_r" -eq 0 ] || bad "R: install.sh ts-server rc=$rc_r (tail: $(tail -3 "$WORK/r.log" | tr '\n' '|'))"
grep -q 'const RULE_GLOBS' "$R/eslint.config.mjs" && grep -qF "'rules-as-tests/no-unsafe-zod-parse': 'error'" "$R/eslint.config.mjs" \
  && ok "R: RULE_GLOBS and R2 are in the consumer's config" \
  || { bad "R: RULE_GLOBS / R2 are not in the consumer's config:"; sed 's/^/      /' "$R/eslint.config.mjs" | head -30; }
only_insertions "$WORK/own.before" "$R/eslint.config.mjs" && kept_original "$R" eslint.config.mjs "$WORK/own.before" \
  && ok "R: insertions only, and the original kept aside" || bad "R: a character of the config was changed or removed, or no kept original"
( cd "$R" && bash scripts/check-rule-globs.sh ) >"$WORK/r.globs" 2>&1 && grep -q '✓ R2 no-unsafe-zod-parse' "$WORK/r.globs" \
  && ok "R: check:globs reads the inserted RULE_GLOBS and finds the boundary file" \
  || bad "R: check:globs does not pass on the inserted RULE_GLOBS: $(tail -3 "$WORK/r.globs" | tr '\n' '|')"
[ "$rc_enf" -eq 0 ] && grep -q 'OK' "$WORK/r.enforced" \
  && ok "R: check:enforced resolves R2 to error on the boundary file" \
  || bad "R: check:enforced rc=$rc_enf: $(tail -3 "$WORK/r.enforced" | tr '\n' '|')"
grep -q 'rules-as-tests/no-unsafe-zod-parse' "$WORK/r.lint" \
  && ok "R: R2 fires on src/routes/users.ts under the consumer's own config" \
  || bad "R: R2 did not fire on the boundary file: $(tail -4 "$WORK/r.lint" | tr '\n' '|')"
asks_by_hand "$WORK/r.log" && bad "R: the install asks for a manual ESLint edit" || ok "R: nothing asks for a manual ESLint edit"

# ── G: a root eslint.config.js (ESM) ──────────────────────────────────────────────────────────
G="$WORK/own-js"; mkdir -p "$G/lib"
printf '{ "name": "swg", "version": "0.0.0", "type": "module" }\n' > "$G/package.json"
cp "$WORK/own.before" "$G/eslint.config.js"
printf 'export const answer = 42;\n' > "$G/lib/answer.ts"
borrow "$G"
( cd "$G" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/g.log" 2>&1
unborrow "$G"
[ ! -e "$G/eslint.config.mjs" ] && ok "G: no eslint.config.mjs placed beside the consumer's eslint.config.js" \
  || bad "G: eslint.config.mjs placed — ESLint would still load the .js, and getff's file would be dead"
grep -q 'rules-as-tests/' "$G/eslint.config.js" && only_insertions "$WORK/own.before" "$G/eslint.config.js" \
  && kept_original "$G" eslint.config.js "$WORK/own.before" \
  && ok "G: getff's block is added to eslint.config.js by insertions only, the original kept" \
  || bad "G: eslint.config.js was not wired the way eslint.config.mjs is"
( cd "$G" && bash scripts/check-rule-globs.sh ) >"$WORK/g.globs" 2>&1 \
  && ok "G: check:globs finds eslint.config.js and passes" \
  || bad "G: check:globs on an eslint.config.js project: $(tail -2 "$WORK/g.globs" | tr '\n' '|')"
asks_by_hand "$WORK/g.log" && bad "G: the install asks for a manual ESLint edit" || ok "G: nothing asks for a manual ESLint edit"

# ── H: a root eslint.config.cjs ────────────────────────────────────────────────────────────────
H="$WORK/own-cjs"; mkdir -p "$H/lib"
printf '{ "name": "swh", "version": "0.0.0" }\n' > "$H/package.json"
printf 'module.exports = [];\n' > "$H/eslint.config.cjs"
cp "$H/eslint.config.cjs" "$WORK/cjs.before"
printf 'export const answer = 42;\n' > "$H/lib/answer.ts"
( cd "$H" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/h.log" 2>&1
cmp -s "$H/eslint.config.cjs" "$WORK/cjs.before" && ok "H: eslint.config.cjs is byte-identical" \
  || bad "H: eslint.config.cjs was changed"
not_wired "$WORK/h.log" | grep -q 'eslint.config.cjs' && ! asks_by_hand "$WORK/h.log" \
  && ok "H: the not-wired summary names eslint.config.cjs and asks for no manual edit" \
  || bad "H: eslint.config.cjs not reported, or reported with a manual step: $(not_wired "$WORK/h.log" | grep -i eslint | head -2 | tr '\n' '|')"
( cd "$H" && bash scripts/check-rule-globs.sh ) >"$WORK/h.globs" 2>&1 \
  && ok "H: check:globs passes on an eslint.config.cjs project (it used to exit 2: config not found)" \
  || bad "H: check:globs on an eslint.config.cjs project: $(tail -2 "$WORK/h.globs" | tr '\n' '|')"

# ── D: a monorepo workspace config the consumer owns (no root config) ──────────────────────────
D="$WORK/mono"; mkdir -p "$D/apps/mobile" "$D/apps/api"
printf '{"name":"swd","version":"0.0.0","private":true}\n' > "$D/package.json"
printf 'packages:\n  - "apps/*"\n' > "$D/pnpm-workspace.yaml"
printf '{"name":"mobile","version":"0.0.0","dependencies":{"react-native":"0.74.0","expo":"~51.0.0","react":"18.2.0"}}\n' > "$D/apps/mobile/package.json"
printf '{"name":"api","version":"0.0.0","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$D/apps/api/package.json"
cp "$WORK/own.before" "$D/apps/mobile/eslint.config.mjs"
seed_snippet "$D"
borrow "$D"
( cd "$D" && git init -q && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >"$WORK/d.log" 2>&1
rc_d=$?
unborrow "$D"
[ "$rc_d" -eq 0 ] || bad "D: install.sh react-native rc=$rc_d (tail: $(tail -3 "$WORK/d.log" | tr '\n' '|'))"
grep -q 'synth-wire per-workspace' "$WORK/d.log" \
  || bad "D: the per-workspace synth-wire never ran — the arm below would be vacuous"
grep -qF 'swcLiveProbe' "$D/apps/mobile/eslint.config.mjs" && only_insertions "$WORK/own.before" "$D/apps/mobile/eslint.config.mjs" \
  && kept_original "$D" apps/mobile/eslint.config.mjs "$WORK/own.before" \
  && ok "D: the live rule lands in the consumer's workspace config, lines and original kept" \
  || bad "D: the consumer's apps/mobile/eslint.config.mjs was not wired with its original kept"
not_wired "$WORK/d.log" | grep -q 'apps/mobile/eslint.config.mjs' \
  && bad "D: the not-wired summary still lists apps/mobile/eslint.config.mjs" || ok "D: the workspace config is not reported as unwired"

# ── I, J, K: a config getff placed on an earlier install, edited or not since ────────────────
# The first install wires one live rule (eqeqeq) into getff's config, so the manifest records the
# post-processed bytes, which no template matches: only the manifest's hash can say they are still
# getff's. The second install brings a new live rule (no-var) to wire.
NOTE='// consumer: keep this block last'
live_snippet() { # $1 = project dir, $2 = JSON rules object
  mkdir -p "$1/.ai-factory/synthesizer-output"
  printf '%s\n' "$2" > "$1/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
}
# edit_last_entry <file> — the consumer's edit: a trailing comma and a comment on the last entry.
edit_last_entry() {
  NOTE="$NOTE" perl -0pi -e 's/,?\n(\)|\]);\n\z/, $ENV{NOTE}\n$1;\n/' "$1"
}
# lands_no_var <file> — no-var is on a line of <file> outside a // comment (a rule printed inside
# the consumer's comment is text, not config).
lands_no_var() { sed 's://.*$::' "$1" | grep -q 'no-var'; }
# note_line_kept <file> <edited> — the consumer's annotated line is in <file> once, unchanged.
note_line_kept() {
  local line; line=$(grep -F "$NOTE" "$2")
  [ -n "$line" ] && [ "$(grep -cxF -- "$line" "$1")" -eq 1 ]
}
# edited_then_reinstall <project> <stack> <config…> — install with the first live rule, let the
# consumer edit each named config (relative path), then re-install with the second live rule.
edited_then_reinstall() {
  local p="$1" stack="$2" c; shift 2
  live_snippet "$p" '{ "eqeqeq": "error" }'
  borrow "$p"
  ( cd "$p" && git init -q && bash "$REPO_ROOT/install.sh" "$stack" </dev/null ) >"$p.1.log" 2>&1 \
    || bad "$(basename "$p"): first install.sh $stack failed (tail: $(tail -3 "$p.1.log" | tr '\n' '|'))"
  for c in "$@"; do
    edit_last_entry "$p/$c"
    grep -qF "$NOTE" "$p/$c" || bad "$(basename "$p"): the fixture edit did not land in $c — the arm would be vacuous"
    cp "$p/$c" "$p.$(printf '%s' "$c" | tr '/' '_').edited"
  done
  live_snippet "$p" '{ "eqeqeq": "error", "no-var": "error" }'
  ( cd "$p" && bash "$REPO_ROOT/install.sh" "$stack" </dev/null ) >"$p.2.log" 2>&1 \
    || bad "$(basename "$p"): re-install failed (tail: $(tail -3 "$p.2.log" | tr '\n' '|'))"
  unborrow "$p"
}

I="$WORK/placed-edited"; mkdir -p "$I"
printf '{ "name": "swi", "version": "0.0.0" }\n' > "$I/package.json"
edited_then_reinstall "$I" react-next eslint.config.mjs
in_baseline "$I" eslint.config.mjs \
  || bad "I: the first install did not record getff's eslint.config.mjs in the manifest — the arm would be vacuous"
grep -q 'getff placed eslint.config.mjs, and it has been edited since' "$I.2.log" \
  && ok "I: the install says the edited getff config is treated as the consumer's" \
  || bad "I: the re-install did not treat the edited config as the consumer's: $(grep 'synth-wire' "$I.2.log" | head -2 | tr '\n' '|')"
note_line_kept "$I/eslint.config.mjs" "$I.eslint.config.mjs.edited" \
  && ok "I: the consumer's annotated last line is there once, unchanged" \
  || { bad "I: the consumer's annotated line was rewritten:"; grep -F "$NOTE" "$I/eslint.config.mjs" | sed 's/^/      /' | head -3; }
lands_no_var "$I/eslint.config.mjs" \
  && ok "I: the new live rule is config, not text inside the consumer's comment" \
  || bad "I: no-var is not on any line outside a // comment"
only_insertions "$I.eslint.config.mjs.edited" "$I/eslint.config.mjs" \
  && ok "I: nothing of the edited config was changed or removed — getff only inserted" \
  || bad "I: a character of the edited config was changed or removed"
kept_original "$I" eslint.config.mjs "$I.eslint.config.mjs.edited" \
  && ok "I: the edited original is kept at .ai-factory/before-getff/eslint.config.mjs.<sha8>" \
  || bad "I: no single byte-equal kept original ($(ls "$I/.ai-factory/before-getff" 2>&1 | tr '\n' ' '))"
not_wired "$I.2.log" | grep -q 'eslint.config' && bad "I: the not-wired summary lists the eslint config" \
  || ok "I: the not-wired summary has no eslint config line"
asks_by_hand "$I.2.log" && bad "I: the install asks for a manual ESLint edit" || ok "I: nothing asks for a manual ESLint edit"

J="$WORK/placed-intact"; mkdir -p "$J"
printf '{ "name": "swj", "version": "0.0.0" }\n' > "$J/package.json"
edited_then_reinstall "$J" react-next
grep -q '▶ synth-wire: confirming' "$J.2.log" && ! grep -qE 'edited since|is your own config' "$J.2.log" \
  && ok "J neg: getff's config as the first install left it (manifest hash matches) goes through getff's branch" \
  || bad "J neg: an unedited manifest-recorded config left getff's branch: $(grep 'synth-wire' "$J.2.log" | head -2 | tr '\n' '|')"
lands_no_var "$J/eslint.config.mjs" && [ ! -d "$J/.ai-factory/before-getff" ] \
  && ok "J neg: the new live rule lands, and getff's own config keeps no 'before getff' copy" \
  || bad "J neg: no-var did not land, or a copy of getff's own config was kept"

K="$WORK/placed-ws"; mkdir -p "$K/apps/mobile" "$K/apps/tablet"
printf '{"name":"swk","version":"0.0.0","private":true}\n' > "$K/package.json"
printf 'packages:\n  - "apps/*"\n' > "$K/pnpm-workspace.yaml"
for w in mobile tablet; do
  printf '{"name":"%s","version":"0.0.0","dependencies":{"react-native":"0.74.0","expo":"~51.0.0","react":"18.2.0"}}\n' "$w" > "$K/apps/$w/package.json"
done
edited_then_reinstall "$K" react-native apps/mobile/eslint.config.mjs
grep -q 'synth-wire per-workspace' "$K.2.log" \
  || bad "K: the per-workspace synth-wire never ran on the re-install — the arm would be vacuous"
in_baseline "$K" apps/mobile/eslint.config.mjs && in_baseline "$K" apps/tablet/eslint.config.mjs \
  || bad "K: the first install did not record both workspace configs in the manifest — the arm would be vacuous"
grep -q 'getff placed apps/mobile/eslint.config.mjs, and it has been edited since' "$K.2.log" \
  && ok "K: the install says the edited workspace config is treated as the consumer's" \
  || bad "K: the edited apps/mobile config was not treated as the consumer's: $(grep 'synth-wire (live)' "$K.2.log" | head -2 | tr '\n' '|')"
note_line_kept "$K/apps/mobile/eslint.config.mjs" "$K.apps_mobile_eslint.config.mjs.edited" \
  && lands_no_var "$K/apps/mobile/eslint.config.mjs" \
  && only_insertions "$K.apps_mobile_eslint.config.mjs.edited" "$K/apps/mobile/eslint.config.mjs" \
  && ok "K: the new live rule lands in the edited workspace config by insertions, its annotated line unchanged" \
  || { bad "K: the edited apps/mobile config was rewritten, or no-var is not config:"; grep -nE 'consumer:|no-var' "$K/apps/mobile/eslint.config.mjs" | sed 's/^/      /' | head -4; }
kept_original "$K" apps/mobile/eslint.config.mjs "$K.apps_mobile_eslint.config.mjs.edited" \
  && ok "K: the edited original is kept at .ai-factory/before-getff/apps/mobile/eslint.config.mjs.<sha8>" \
  || bad "K: no kept original of the edited apps/mobile config"
grep -qE 'synth-wire \(live\): .*/apps/tablet/eslint\.config\.mjs$' "$K.2.log" \
  && ! grep -q 'apps/tablet/eslint.config.mjs.*edited since' "$K.2.log" \
  && lands_no_var "$K/apps/tablet/eslint.config.mjs" && [ ! -e "$K/.ai-factory/before-getff/apps/tablet" ] \
  && ok "K neg: the untouched workspace config goes through getff's branch, the rule lands, no copy kept" \
  || bad "K neg: the unedited apps/tablet config left getff's branch: $(grep 'apps/tablet' "$K.2.log" | head -2 | tr '\n' '|')"

# ── E, F: the R2 wirer under --full ────────────────────────────────────────────────────────────
if [ ! -x "$FW_NM/.bin/tsx" ]; then
  bad "tsx is not installed in the framework — without it the R2 wirer never runs and E/F are vacuous"
  echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi
STUB="$WORK/stub-bin"; mkdir -p "$STUB"
# F is a pnpm workspace, so 70-deps.sh runs `pnpm add -D -w … && pnpm install` there, not npm.
for pm in npm pnpm yarn; do
  real=$(command -v "$pm" || true)
  cat > "$STUB/$pm" <<SH
#!/usr/bin/env bash
case "\$1" in install|i|ci|add) exit 0 ;; esac
[ -n "$real" ] && exec "$real" "\$@"
exit 127
SH
  chmod +x "$STUB/$pm"
done
# A per-package config the wirer can add to. Its last line is a commented-out entry: the AST writer the
# R2 wirer used before dropped it (cold-review F1, measured on this shape). Prettier accepts the file
# under getff's .prettierrc.json.
cat > "$WORK/pkg.before" <<'JS'
// The consumer's own lint config for this package.
const base = [{ files: ['**/*.ts'], rules: { 'no-console': 'error' } }];

export default [
  ...base, // shared base
  // { rules: { 'no-debugger': 'off' } }, — kept for later
];
JS
prettier_accepts() { ( cd "$1" && node "$FW_NM/prettier/bin/prettier.cjs" --check "$2" ) >/dev/null 2>&1; }
# r2_scoped <file> — R2 is in <file> only as the RULE_GLOBS.boundary-scoped element (cold-review F15:
# it used to land unscoped, on every file of the package). Read with line breaks folded: the
# consumer's prettier splits the element over several lines when its original was formatted.
r2_scoped() {
  tr '\n' ' ' < "$1" | tr -s ' ' \
    | grep -qE "\{ ?files: RULE_GLOBS\.boundary, plugins: \{[^}]*\}, rules: \{ ?'rules-as-tests/no-unsafe-zod-parse'" \
    && grep -q '^const RULE_GLOBS = {' "$1"
}

# E — flat repo: getff places the root config, the consumer owns three per-package configs, and the
# parse boundary in src/api makes the root R2 verdict boundary-present (r2-auto-wire fixture B).
# apps/api has HTTP boundary code of its own (routes/), apps/lib has none, and apps/web has boundary
# code under a config whose export shape the wirer cannot add to.
E="$WORK/l2"; mkdir -p "$E/src/api" "$E/apps/api/src/routes" "$E/apps/lib/src" "$E/apps/web/src/routes"
printf '{ "name": "swe", "version": "0.0.0" }\n' > "$E/package.json"
echo 'export const h = (b) => schema.parse(b);' > "$E/src/api/handler.ts"
echo 'export const u = (b) => schema.parse(b);' > "$E/apps/api/src/routes/users.ts"
printf 'export const x = 1;\n' > "$E/apps/lib/src/h.ts"
echo 'export const w = (b) => schema.parse(b);' > "$E/apps/web/src/routes/w.ts"
cp "$WORK/pkg.before" "$E/apps/api/eslint.config.mjs"
cp "$WORK/pkg.before" "$E/apps/lib/eslint.config.mjs"
printf "import { makeConfig } from './make.mjs';\nexport default makeConfig();\n" > "$WORK/web.before"
cp "$WORK/web.before" "$E/apps/web/eslint.config.mjs"
borrow "$E" tsx
( cd "$E" && git init -q && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full </dev/null ) >"$WORK/e.log" 2>&1
unborrow "$E"
grep -q 'R2 Layer-2' "$WORK/e.log" \
  || bad "E: the R2 Layer-2 block never ran — the arm below would be vacuous (tail: $(tail -3 "$WORK/e.log" | tr '\n' '|'))"
r2_scoped "$E/apps/api/eslint.config.mjs" \
  && ok "E: R2 lands in the consumer's apps/api/eslint.config.mjs, scoped to RULE_GLOBS.boundary" \
  || bad "E: R2 is not in the consumer's apps/api/eslint.config.mjs as the RULE_GLOBS.boundary-scoped element"
only_insertions "$WORK/pkg.before" "$E/apps/api/eslint.config.mjs" \
  && ok "E: every character of apps/api/eslint.config.mjs is kept, the comment and trailing comma included" \
  || bad "E: the R2 write changed or removed text of the consumer's apps/api/eslint.config.mjs"
kept_original "$E" apps/api/eslint.config.mjs "$WORK/pkg.before" \
  && ok "E: the original is kept at .ai-factory/before-getff/apps/api/eslint.config.mjs.<sha8>" \
  || bad "E: no kept original of apps/api/eslint.config.mjs"
prettier_accepts "$E" apps/api/eslint.config.mjs \
  && ok "E: prettier still accepts the wired file (format:check stays green)" \
  || bad "E: prettier rejects the wired apps/api/eslint.config.mjs — format:check would fail every push"
not_wired "$WORK/e.log" | grep -q 'apps/api/eslint.config.mjs' \
  && bad "E: the not-wired summary still lists apps/api/eslint.config.mjs" || ok "E: the per-package config is not reported as unwired"
cmp -s "$WORK/pkg.before" "$E/apps/lib/eslint.config.mjs" && [ ! -e "$E/.ai-factory/before-getff/apps/lib" ] \
  && ok "E: apps/lib, with no HTTP boundary code, keeps its config byte-identical — R2 has nothing to guard there" \
  || bad "E: R2 was added to apps/lib/eslint.config.mjs, whose package has no HTTP boundary code"
not_wired "$WORK/e.log" | grep -q 'apps/lib/eslint.config.mjs' \
  && bad "E: apps/lib is in the not-wired summary, though nothing was missing there" || ok "E: apps/lib is not reported as unwired"
cmp -s "$WORK/web.before" "$E/apps/web/eslint.config.mjs" && [ ! -e "$E/.ai-factory/before-getff/apps/web" ] \
  && ok "E: a config getff cannot add to (apps/web) is left byte-identical, no copy kept" \
  || bad "E: apps/web/eslint.config.mjs changed, or a copy of it was kept"
not_wired "$WORK/e.log" | grep -q 'apps/web/eslint.config.mjs' \
  && ok "E: the not-wired summary names apps/web/eslint.config.mjs" \
  || bad "E: apps/web/eslint.config.mjs (not wired) is missing from the not-wired summary"
asks_by_hand "$WORK/e.log" && bad "E: the install asks for a manual ESLint edit" || ok "E: nothing asks for a manual ESLint edit"

# F — multi-stack monorepo, no root config: two ts-server workspaces, the consumer owns the config
# of apps/api, getff places the one in apps/svc.
# apps/lib: a ts-server library workspace with no HTTP code (cold-review F15's scenario).
F="$WORK/l2mono"; mkdir -p "$F/apps/api/src/routes" "$F/apps/svc/src" "$F/apps/lib/src"
printf '{"name":"swf","version":"0.0.0","private":true}\n' > "$F/package.json"
printf 'packages:\n  - "apps/*"\n' > "$F/pnpm-workspace.yaml"
for w in api svc lib; do
  printf '{"name":"%s","version":"0.0.0","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' "$w" > "$F/apps/$w/package.json"
  printf 'export const x = 1;\n' > "$F/apps/$w/src/h.ts"
done
echo 'export const u = (b) => schema.parse(b);' > "$F/apps/api/src/routes/users.ts"
cp "$WORK/pkg.before" "$F/apps/api/eslint.config.mjs"
cp "$WORK/pkg.before" "$F/apps/lib/eslint.config.mjs"
borrow "$F" tsx
( cd "$F" && git init -q && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full </dev/null ) >"$WORK/f.log" 2>&1
unborrow "$F"
grep -q 'R2 per-workspace: scoped wiring' "$WORK/f.log" \
  || bad "F: the R2 per-workspace block never ran — the arm below would be vacuous (tail: $(tail -3 "$WORK/f.log" | tr '\n' '|'))"
r2_scoped "$F/apps/api/eslint.config.mjs" && kept_original "$F" apps/api/eslint.config.mjs "$WORK/pkg.before" \
  && ok "F: R2 lands in the consumer's workspace config apps/api/eslint.config.mjs, scoped, original kept" \
  || bad "F: the consumer's apps/api/eslint.config.mjs was not wired (scoped) with its original kept"
only_insertions "$WORK/pkg.before" "$F/apps/api/eslint.config.mjs" \
  && ok "F: every character of apps/api/eslint.config.mjs is kept" \
  || bad "F: the R2 write changed or removed text of the consumer's apps/api/eslint.config.mjs"
cmp -s "$WORK/pkg.before" "$F/apps/lib/eslint.config.mjs" && [ ! -e "$F/.ai-factory/before-getff/apps/lib" ] \
  && ok "F: the library workspace apps/lib (no HTTP code) keeps its config byte-identical" \
  || bad "F: R2 was added to apps/lib/eslint.config.mjs, a workspace with no HTTP boundary code"
asks_by_hand "$WORK/f.log" && bad "F: the install asks for a manual ESLint edit" || ok "F: nothing asks for a manual ESLint edit"
not_wired "$WORK/f.log" | grep -q 'apps/api/eslint.config.mjs' \
  && bad "F: the not-wired summary still lists apps/api/eslint.config.mjs" || ok "F: the workspace config is not reported as unwired"
grep -q 'R2 wiring: .*apps/svc/eslint.config.mjs' "$WORK/f.log" \
  && ok "F neg: the workspace config getff placed (apps/svc) still goes through the R2 wirer" \
  || bad "F neg: the R2 wirer skipped the config getff placed in apps/svc"
[ ! -e "$F/.ai-factory/before-getff/apps/svc" ] && ok "F neg: getff's own apps/svc config keeps no 'before getff' copy" \
  || bad "F neg: a copy of getff's own apps/svc config was kept as if it were the consumer's"

fw_print > "$WORK/fw.after"
if cmp -s "$WORK/fw.before" "$WORK/fw.after"; then
  ok "the framework's node_modules scope directories are unchanged after every arm"
else
  bad "a fixture install wrote into the framework's node_modules:"
  diff "$WORK/fw.before" "$WORK/fw.after" | head -8 | sed 's/^/      /'
fi

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
