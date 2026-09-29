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
#      + keep_original_settle keep a copy only when the file changed; the R2 wirer's write into a
#      config getff placed is recorded as getff's bytes (_r2_wire_cfg with a stand-in wirer);
#      rule_globs_boundary reads RULE_GLOBS.boundary's elements as the own-config wirer does, and
#      99-finalize's _r2_own_gap / _r2_own_refused say what that wirer would add or refuse;
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
#   L  paired with J: a third install after getff's own write on the second still reads the config
#      as getff's — that write is recorded as getff's bytes, not taken for a consumer edit; the same
#      for K's untouched workspace config on the per-workspace pass;
#   M  the same for 60-ci's boundary-glob insert when HTTP boundary code appears between installs,
#      on that install and the next;
#   Q  an edited getff config on an install without ts-morph: nothing is reported as not wired while
#      getff's rules are already in it; Q neg: a live rule it does not carry is reported, with --full;
#   N  HTTP boundary code appears after the consumer edited getff's config: the boundary globs reach
#      it through the own-config pass — insertions only, the edited original kept without them —
#      never 60-ci's in-place insert, which M (its paired negative) keeps for getff's untouched config;
#   O  the same on an install without ts-morph: the config is left as it is and the not-wired summary
#      names the boundary globs it lacks, with --full — not getff's rules, which are in it; O neg:
#      when it lacks none (the first install added them), nothing is reported;
#   S  the edit removes RULE_GLOBS.boundary: the own-config wirer refuses R2 there with or without
#      ts-morph, so the summary gives its reason and no --full; S2 is the same with ts-morph, and its
#      summary line is S's word for word;
#   T  a glob the edited config carries in another RULE_GLOBS key (application:) is still one R2
#      lacks: only the elements of RULE_GLOBS.boundary count, as they do for the wirer;
#   V  the same boundary code on a re-install without Node: nothing is written, and the summary names
#      the globs R2 lacks with that reason (60-ci stopped writing them into the edited config itself);
#   E  the R2 Layer-2 wirer (`--yes` under --full) on a per-package config the consumer owns: R2
#      lands in it, the original is kept, and prettier still accepts the file; a per-package
#      ES-module eslint.config.js gets R2 the same way, and an eslint.config.cjs with boundary code
#      is named in the not-wired summary (ESLint's own lookup order, as for the root config);
#   F  the R2 per-workspace wirer on a multi-stack monorepo: the consumer's workspace config gets R2
#      with its original kept, and the one getff placed in a sibling workspace goes through as before;
#   M  a workspace config the consumer owns that BOTH per-workspace passes write (live snippet, then
#      R2): exactly one kept original — the true one — announced once (cold-review F9); and a
#      workspace whose own config is an ES-module eslint.config.js gets both, as an .mjs does.
# E, F and M need --full (the wirer only writes with --yes); the dependency install it triggers is
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
# asks_by_hand <log> — any line of the install that hands work back to the human (operator directive
# 2026-09-28, Q4.7). Shared with install-no-manual-step.test.sh: the wordings it knows include every one
# this file's ESLint-only predicate used to (T3: the R2 snippet said «Add to <cfg> (adjust the relative
# path…)»), so a narrower check here would pass a manual step the other test fails.
# shellcheck source=tests/install-sh/lib/manual-step.sh
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
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
  # A second pass over a file whose original this run already kept keeps nothing more: its copy
  # would carry the first pass's block and be announced as a second «original» (cold-review F9).
  keep_original_mark "$f"
  snap=$(keep_original_snapshot "$f")
  printf 'export default [{ ignores: [] }, { rules: {} }];\n' > "$f"
  kept=$(keep_original_settle "$f" "$snap")
  n=$(find "$PROJECT_ROOT/.ai-factory/before-getff" -type f | grep -c .)
  [ -z "$snap" ] && [ -z "$kept" ] && [ "$n" -eq 1 ] \
    && echo "OK a file whose original this run already kept gets no second copy" \
    || echo "BAD second pass: snapshot='$snap' kept='$kept' copies=$n"
  # eslint_flat_configs_under: in each directory, the config ESLint loads there (eslint_flat_config),
  # once per directory; left out, as the push gates leave them out (CFG_PRUNE in check-rule-globs.sh):
  # node_modules, build output (dist, coverage, .stryker-tmp, .next), .git and the repo copies under
  # .claude/worktrees. Kept: a workspace named packages/core (the gates prune that path for getff's
  # vendored copy only) and one named reports (the gates leave reports out of their source probes, not
  # out of the config search — a find -name there would cut the workspace).
  mkdir -p "$u/tree/a" "$u/tree/b/c" "$u/tree/node_modules/x" "$u/tree/.git/x" "$u/tree/.claude/worktrees/w/apps/a" \
    "$u/tree/packages/core" "$u/tree/dist" "$u/tree/coverage/x" "$u/tree/.stryker-tmp/s" "$u/tree/apps/web/.next" \
    "$u/tree/apps/reports"
  : > "$u/tree/eslint.config.mjs"; : > "$u/tree/a/eslint.config.mjs"; : > "$u/tree/a/eslint.config.js"
  : > "$u/tree/b/c/eslint.config.cjs"; : > "$u/tree/node_modules/x/eslint.config.mjs"
  : > "$u/tree/.git/x/eslint.config.mjs"; : > "$u/tree/.claude/worktrees/w/eslint.config.mjs"
  : > "$u/tree/.claude/worktrees/w/apps/a/eslint.config.mjs"; : > "$u/tree/packages/core/eslint.config.mjs"
  : > "$u/tree/dist/eslint.config.js"; : > "$u/tree/coverage/x/eslint.config.mjs"
  : > "$u/tree/.stryker-tmp/s/eslint.config.mjs"; : > "$u/tree/apps/web/.next/eslint.config.mjs"
  : > "$u/tree/apps/reports/eslint.config.mjs"
  got=$(eslint_flat_configs_under "$u/tree" | tr '\0' '\n' | sed "s#^$u/tree/##" | sort | tr '\n' ' ')
  [ "$got" = "a/eslint.config.js apps/reports/eslint.config.mjs b/c/eslint.config.cjs eslint.config.mjs packages/core/eslint.config.mjs " ] \
    && [ "$(eslint_flat_configs_under "$u/tree/packages/core" | tr '\0' '\n')" = "$u/tree/packages/core/eslint.config.mjs" ] \
    && echo "OK eslint_flat_configs_under lists the config ESLint loads in each directory, once, dependencies/build output/.git/worktree copies pruned" \
    || echo "BAD eslint_flat_configs_under: '$got'"
  # The directory searched is never pruned itself: a workspace named dist is still read.
  mkdir -p "$u/ws/dist"; : > "$u/ws/dist/eslint.config.js"
  [ "$(eslint_flat_configs_under "$u/ws/dist" | tr '\0' '\n')" = "$u/ws/dist/eslint.config.js" ] \
    && echo "OK eslint_flat_configs_under reads the directory it is given, whatever its name" \
    || echo "BAD eslint_flat_configs_under pruned the directory it was given ($u/ws/dist)"
  # eslint_config_has_getff_rules: a config carries getff's rules when it names one (rules-as-tests/…) or
  # imports, by a relative path, a config that does — a workspace config spreading a sibling's getff
  # preset is not «a config getff's rules are not in» (second cold review, after #1868). A bare package
  # import is not followed; an import cycle ends.
  h="$u/imp"; mkdir -p "$h/shared" "$h/w"
  printf "export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" > "$h/shared/eslint.config.js"
  printf "import base from \"../shared/eslint.config.js\";\nexport default [...base];\n" > "$h/w/dq.mjs"
  printf "import mid from './mid.mjs';\nexport default [...mid];\n" > "$h/w/two.mjs"
  printf "export { default } from '../shared/eslint.config.js';\n" > "$h/w/mid.mjs"
  printf "import base from '@acme/eslint-config';\nexport default [...base];\n" > "$h/w/bare.mjs"
  printf "import b from './cyc-b.mjs';\nexport default [...b];\n" > "$h/w/cyc-a.mjs"
  printf "import a from './cyc-a.mjs';\nexport default [...a];\n" > "$h/w/cyc-b.mjs"
  printf 'export default [];\n' > "$h/w/none.mjs"
  # A CommonJS eslint.config.js reaches its base through require(); a line may import more than one config.
  printf "const base = require('../shared/eslint.config.js');\nmodule.exports = [...base];\n" > "$h/w/cjs.js"
  printf "import base from '../shared/eslint.config.js'; import none from './none.mjs';\nexport default [...base, ...none];\n" > "$h/w/oneline.mjs"
  eslint_config_has_getff_rules "$h/shared/eslint.config.js" && eslint_config_has_getff_rules "$h/w/dq.mjs" \
    && eslint_config_has_getff_rules "$h/w/two.mjs" && eslint_config_has_getff_rules "$h/w/cjs.js" \
    && eslint_config_has_getff_rules "$h/w/oneline.mjs" \
    && echo "OK eslint_config_has_getff_rules follows relative imports (and re-exports) to getff's rules" \
    || echo "BAD eslint_config_has_getff_rules missed getff's rules reached by a relative import"
  ! eslint_config_has_getff_rules "$h/w/bare.mjs" && ! eslint_config_has_getff_rules "$h/w/none.mjs" \
    && ! eslint_config_has_getff_rules "$h/w/cyc-a.mjs" \
    && echo "OK eslint_config_has_getff_rules: no rule, a bare package import, or an import cycle is not getff's rules" \
    || echo "BAD eslint_config_has_getff_rules claimed getff's rules for a config that does not reach them"
  # A config getff cannot add to is named once, however many steps reach it.
  NOT_WIRED=()
  note_eslint_config_not_esm "$u/tree/b/c" eslint.config.cjs
  note_eslint_config_not_esm "$u/tree/b/c" eslint.config.cjs
  [ "${#NOT_WIRED[@]}" -eq 1 ] && printf '%s' "${NOT_WIRED[0]}" | grep -q "b/c — your eslint.config.cjs" \
    && ! printf '%s' "${NOT_WIRED[0]}" | grep -qiE 'by hand|manually' \
    && echo "OK a config getff cannot add to is named once in the not-wired summary, with no manual step" \
    || echo "BAD not-esm note: ${#NOT_WIRED[@]} line(s): $(printf '%s|' ${NOT_WIRED[@]+"${NOT_WIRED[@]}"})"
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
  grep -qxF '.storybook/main.ts' <<<"$ign" && grep -qxF '.storybook/preview.ts' <<<"$ign" \
    && ! grep -qF '.storybook/**' <<<"$ign" \
    && echo "OK the ignores entry names .storybook/main.ts and .storybook/preview.ts, not the whole .storybook/" \
    || echo "BAD the storybook ignores: $(printf '%s\n' "$ign" | tr '\n' '|')"
) > "$WORK/u.log" 2>&1
while IFS= read -r l; do
  case "$l" in OK\ *) ok "U: ${l#OK }" ;; BAD\ *) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u.log"
grep -qE '^(OK|BAD) ' "$WORK/u.log" || bad "U: the lib.sh helper arm printed nothing ($(tail -2 "$WORK/u.log" | tr '\n' '|'))"
# The R2 wirer's write into a config getff placed and nobody edited since is getff's too: the
# manifest the install records afterwards holds the new bytes, so the next install still reads the
# config as getff's. _r2_wire_cfg runs as 99-finalize defines it, the flush as lib.sh does; only the
# wirer is a stand-in (npx) that adds R2 to the config it is given, as the real one does on getff's
# branch for a config whose template carries no R2.
(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  eval "$(sed -n -e '/^_r2_note_outcome() {/,/^}/p' -e '/^_r2_wire_cfg() {/,/^}/p' "$REPO_ROOT/setup.d/99-finalize.sh")"
  PROJECT_ROOT="$WORK/u-r2"; PKG_ROOT="$REPO_ROOT"; DRY_RUN=""; NOT_WIRED=()
  f="$PROJECT_ROOT/apps/svc/eslint.config.mjs"; mkdir -p "${f%/*}"
  printf 'export default [];\n' > "$f"
  REFRESH_BASELINE_STAGED=("$f"); REFRESH_BASELINE_STAGED_WEAK=()
  refresh_baseline_flush >/dev/null   # the earlier install that placed it
  # npx --no-install tsx <wirer> --path <cfg> --yes --install
  npx() { printf "export default [{ rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" > "$5"; echo "  ✓ R2 wired"; }
  getff_delivered "$f" && getff_bytes_intact "$f" \
    || echo "BAD R2 re-stage: getff's config does not read as getff's before the write — the arm would be vacuous"
  _r2_wire_cfg "$f" "$REPO_ROOT/packages/core/install/wire-eslint-r2.ts" >/dev/null
  grep -q 'no-unsafe-zod-parse' "$f" || echo "BAD R2 re-stage: the stand-in wirer wrote nothing — the arm would be vacuous"
  refresh_baseline_flush >/dev/null   # the end of this install
  getff_bytes_intact "$f" \
    && echo "OK the R2 wirer's write into getff's own config is recorded as getff's bytes for the next install" \
    || echo "BAD the next install would read the R2 wirer's own write into getff's config as a consumer edit"
) > "$WORK/u-r2.log" 2>&1
while IFS= read -r l; do
  case "$l" in OK\ *) ok "U: ${l#OK }" ;; BAD\ *) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u-r2.log"
grep -qE '^(OK|BAD) ' "$WORK/u-r2.log" || bad "U: the R2 re-stage arm printed nothing ($(tail -2 "$WORK/u-r2.log" | tr '\n' '|'))"
# What the own-config wirer does with R2 (wireOwnConfig, packages/core/install/wire-eslint-r2.ts) is
# what the not-wired summary names when that wirer cannot run: it reads the ELEMENTS of
# RULE_GLOBS.boundary — a glob in a comment, in another key or in a nested object is not one of them
# — refuses a RULE_GLOBS with no boundary array, and leaves alone an R2 the config registers without
# RULE_GLOBS.
(
  # shellcheck disable=SC1090
  INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
  eval "$(sed -n -e '/^_R2_OWN_REFUSAL=/p' -e '/^_r2_own_refused() {/,/^}/p' -e '/^_r2_own_gap() {/,/^}/p' \
    "$REPO_ROOT/setup.d/99-finalize.sh")"
  PROJECT_ROOT="$WORK/u-rg"; mkdir -p "$PROJECT_ROOT"; c="$PROJECT_ROOT/eslint.config.mjs"
  cat > "$c" <<'JS'
// const RULE_GLOBS = { boundary: ['**/commented/**'] };
// prettier-ignore
const RULE_GLOBS = {
  // R2 — '**/in-a-comment/**' is no element
  boundary: [
    '**/api/**/*.{ts,tsx}',
    // '**/handlers/**/*.{ts,tsx}',
    "**/routes/**/*.{ts,tsx}",
    `**/actions/**/*.{ts,tsx}`,
    `**/${dir}/**`,
  ],
  application: ['**/application/**/*.{ts,tsx}'],
  nested: { boundary: ['**/nested/**'] },
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
JS
  want=$(printf 'array\n%s\n%s\n%s' '**/api/**/*.{ts,tsx}' '**/routes/**/*.{ts,tsx}' '**/actions/**/*.{ts,tsx}')
  [ "$(rule_globs_boundary "$c")" = "$want" ] \
    && echo "OK rule_globs_boundary lists the string elements of RULE_GLOBS.boundary and nothing else in the file" \
    || echo "BAD rule_globs_boundary: $(rule_globs_boundary "$c" 2>&1 | tr '\n' '|')"
  _r2_own_globs=$(printf '%s\n' '**/api/**/*.{ts,tsx}' '**/routes/**/*.{ts,tsx}')
  [ -z "$(_r2_own_gap eslint.config.mjs)" ] && ! _r2_own_refused eslint.config.mjs \
    && echo "OK _r2_own_gap: nothing is missing when every glob is an element of the array" \
    || echo "BAD _r2_own_gap with every glob in: '$(_r2_own_gap eslint.config.mjs)'"
  _r2_own_globs=$(printf '%s\n' '**/api/**/*.{ts,tsx}' '**/application/**/*.{ts,tsx}' '**/handlers/**/*.{ts,tsx}')
  gap=$(_r2_own_gap eslint.config.mjs)
  case "$gap" in
    *"'**/application/**/*.{ts,tsx}'"*"'**/handlers/**/*.{ts,tsx}'"*)
      case "$gap" in *"'**/api/"*) echo "BAD _r2_own_gap names a glob the array has: $gap" ;;
        *) echo "OK _r2_own_gap names a glob found only in another key or a comment, and not one the array has" ;; esac ;;
    *) echo "BAD _r2_own_gap missed a glob that is no element of the array: '$gap'" ;;
  esac
  printf 'const RULE_GLOBS = { application: [], nested: { boundary: ["**/n/**"] } };\n' > "$c"
  [ "$(rule_globs_boundary "$c")" = no-array ] && _r2_own_refused eslint.config.mjs \
    && [ -z "$(_r2_own_gap eslint.config.mjs)" ] \
    && echo "OK a RULE_GLOBS with no boundary array of its own: the wirer's refusal, and no gap --full would fill" \
    || echo "BAD RULE_GLOBS without a boundary array: shape '$(rule_globs_boundary "$c" | head -1)' gap '$(_r2_own_gap eslint.config.mjs)'"
  printf 'export const RULE_GLOBS = makeGlobs();\n' > "$c"
  [ "$(rule_globs_boundary "$c")" = no-array ] && echo "OK a RULE_GLOBS that is no object literal reads as having no boundary array" \
    || echo "BAD RULE_GLOBS = makeGlobs(): '$(rule_globs_boundary "$c" | tr '\n' '|')'"
  printf 'function f() { const RULE_GLOBS = { boundary: ["x"] }; return RULE_GLOBS; }\nexport default [];\n' > "$c"
  [ "$(rule_globs_boundary "$c")" = none ] && [ "$(_r2_own_gap eslint.config.mjs)" = "RULE_GLOBS and R2 (60-ci found an HTTP boundary)" ] \
    && ! _r2_own_refused eslint.config.mjs \
    && echo "OK no top-level RULE_GLOBS and no R2: the gap is RULE_GLOBS and R2" \
    || echo "BAD no top-level RULE_GLOBS: shape '$(rule_globs_boundary "$c" | head -1)' gap '$(_r2_own_gap eslint.config.mjs)'"
  printf "export default [{ files: ['src/**'], rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];\n" > "$c"
  [ -z "$(_r2_own_gap eslint.config.mjs)" ] && ! _r2_own_refused eslint.config.mjs \
    && echo "OK R2 registered without RULE_GLOBS: no gap — the wirer adds nothing there" \
    || echo "BAD R2 without RULE_GLOBS: gap '$(_r2_own_gap eslint.config.mjs)'"
  printf 'export const RULE_GLOBS = { boundary: [] };\nexport default [];\n' > "$c"
  gap=$(_r2_own_gap eslint.config.mjs)
  [ "$(rule_globs_boundary "$c")" = array ] && case "$gap" in "R2 and "*"'**/handlers/**/*.{ts,tsx}'"*) true ;; *) false ;; esac \
    && echo "OK an empty boundary array and no R2: the gap is R2 and every glob" \
    || echo "BAD empty boundary array: shape '$(rule_globs_boundary "$c" | tr '\n' '|')' gap '$gap'"
  _r2_own_globs=""
  [ -z "$(_r2_own_gap eslint.config.mjs)" ] && ! _r2_own_refused eslint.config.mjs \
    && echo "OK no boundary found by 60-ci: no gap and no refusal" || echo "BAD no boundary globs: gap or refusal reported"
) > "$WORK/u-rg.log" 2>&1
while IFS= read -r l; do
  case "$l" in OK\ *) ok "U: ${l#OK }" ;; BAD\ *) bad "U: ${l#BAD }" ;; esac
done < "$WORK/u-rg.log"
grep -qE '^(OK|BAD) ' "$WORK/u-rg.log" || bad "U: the RULE_GLOBS reader arm printed nothing ($(tail -2 "$WORK/u-rg.log" | tr '\n' '|'))"

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
grep -q 'eslint\.config' <<<"$(not_wired "$WORK/a.log")" \
  && bad "A: the not-wired summary still lists the eslint config: $(not_wired "$WORK/a.log" | grep 'eslint\.config' | head -2 | tr '\n' '|')" \
  || ok "A: the not-wired summary has no eslint config line"
asks_by_hand "$WORK/a.log" \
  && bad "A: the install still asks for a manual step: $(manual_step_lines "$WORK/a.log" | head -2 | tr '\n' '|')" \
  || ok "A: nothing in the install output asks for a manual step"
# The summary's two file lists: the config getff added its block to is named there, never among the
# files «left as they are» (before Q4.7's follow-up it sat in «N files were skipped … re-run with --force»).
summary_list() { awk -v h="$2" 'index($0, h){on=1; next} on && /^[[:space:]]*$/{exit} on' "$1"; }
grep -q -- '- eslint\.config\.mjs$' <<<"$(summary_list "$WORK/a.log" "of your own file(s)")" \
  && ok "A: the summary lists eslint.config.mjs as the file getff added its block to" \
  || bad "A: eslint.config.mjs is not in the summary's «getff's block added» list: $(grep -A4 -E "block added|left as they are" "$WORK/a.log" | tr '\n' '|')"
grep -q 'eslint\.config\.mjs' <<<"$(summary_list "$WORK/a.log" "were left as they are")" \
  && bad "A: the summary still lists eslint.config.mjs among the files left as they are" \
  || ok "A: eslint.config.mjs is not among the files left as they are"
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
grep -q -- '--full' <<<"$(not_wired "$WORK/p.log" | grep 'eslint.config.mjs')" \
  && ok "P: the not-wired summary says a --full install adds getff's block" \
  || bad "P: the not-wired summary does not point at --full: $(not_wired "$WORK/p.log" | grep 'eslint' | head -2 | tr '\n' '|')"
asks_by_hand "$WORK/p.log" && bad "P: the install asks for a manual step: $(manual_step_lines "$WORK/p.log" | head -2 | tr '\n' '|')" || ok "P: nothing asks for a manual step"

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
grep -q 'eslint-rules-snippet.json' <<<"$(not_wired "$WORK/c.log")" \
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
asks_by_hand "$WORK/r.log" && bad "R: the install asks for a manual step: $(manual_step_lines "$WORK/r.log" | head -2 | tr '\n' '|')" || ok "R: nothing asks for a manual step"

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
asks_by_hand "$WORK/g.log" && bad "G: the install asks for a manual step: $(manual_step_lines "$WORK/g.log" | head -2 | tr '\n' '|')" || ok "G: nothing asks for a manual step"

# ── H: a root eslint.config.cjs ────────────────────────────────────────────────────────────────
H="$WORK/own-cjs"; mkdir -p "$H/lib"
printf '{ "name": "swh", "version": "0.0.0" }\n' > "$H/package.json"
printf 'module.exports = [];\n' > "$H/eslint.config.cjs"
cp "$H/eslint.config.cjs" "$WORK/cjs.before"
printf 'export const answer = 42;\n' > "$H/lib/answer.ts"
( cd "$H" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$WORK/h.log" 2>&1
cmp -s "$H/eslint.config.cjs" "$WORK/cjs.before" && ok "H: eslint.config.cjs is byte-identical" \
  || bad "H: eslint.config.cjs was changed"
grep -q 'eslint.config.cjs' <<<"$(not_wired "$WORK/h.log")" && ! asks_by_hand "$WORK/h.log" \
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
grep -q 'apps/mobile/eslint.config.mjs' <<<"$(not_wired "$WORK/d.log")" \
  && bad "D: the not-wired summary still lists apps/mobile/eslint.config.mjs" || ok "D: the workspace config is not reported as unwired"
grep -q -- '- apps/mobile/eslint\.config\.mjs$' <<<"$(summary_list "$WORK/d.log" "of your own file(s)")" \
  && ok "D: the summary lists apps/mobile/eslint.config.mjs as a file getff added its block to" \
  || bad "D: apps/mobile/eslint.config.mjs is not in the summary's «getff's block added» list"

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
# Fixed-string match on the file name: the summary's dependencies line names eslint-config-prettier,
# which an unescaped «eslint.config» pattern also matches.
not_wired "$I.2.log" | grep -qF 'eslint.config.mjs' && bad "I: the not-wired summary lists the eslint config" \
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

# ── L, M: getff's own later writes leave a config getff's ─────────────────────────────────────
# The manifest records a config's hash at the end of the install that delivered it. A later install
# that finds the config intact and writes to it again — a new live rule (L), or 60-ci's boundary
# globs once HTTP boundary code appears (M) — leaves bytes that are still getff's: the check after
# that write, and every later install, must read them as getff's, not as a consumer edit.
L="$J"   # J's project after its two installs: the second wired no-var through getff's branch
live_snippet "$L" '{ "eqeqeq": "error", "no-var": "error", "no-caller": "error" }'
borrow "$L"
( cd "$L" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$L.3.log" 2>&1 \
  || bad "L: the third install.sh react-next failed (tail: $(tail -3 "$L.3.log" | tr '\n' '|'))"
unborrow "$L"
grep -q '▶ synth-wire: confirming' "$L.3.log" && ! grep -qE 'edited since|is your own config' "$L.3.log" \
  && ok "L neg: after getff's own write on the second install, the third still reads the config as getff's" \
  || bad "L neg: getff's own write on the second install read as a consumer edit: $(grep 'synth-wire' "$L.3.log" | head -2 | tr '\n' '|')"
sed 's://.*$::' "$L/eslint.config.mjs" | grep -q 'no-caller' && [ ! -d "$L/.ai-factory/before-getff" ] \
  && ok "L neg: the third live rule lands through getff's branch, and no 'before getff' copy is kept" \
  || bad "L neg: no-caller did not land, or a copy of getff's own config was kept"
# The same on the per-workspace pass: K's second install wrote no-var into apps/tablet through
# getff's branch, so a third install still reads apps/tablet as getff's.
live_snippet "$K" '{ "eqeqeq": "error", "no-var": "error", "no-caller": "error" }'
borrow "$K"
( cd "$K" && bash "$REPO_ROOT/install.sh" react-native </dev/null ) >"$K.3.log" 2>&1 \
  || bad "L: the third install.sh react-native on K failed (tail: $(tail -3 "$K.3.log" | tr '\n' '|'))"
unborrow "$K"
grep -qE 'synth-wire \(live\): .*/apps/tablet/eslint\.config\.mjs$' "$K.3.log" \
  && ! grep -q 'apps/tablet/eslint.config.mjs.*edited since' "$K.3.log" \
  && sed 's://.*$::' "$K/apps/tablet/eslint.config.mjs" | grep -q 'no-caller' \
  && [ ! -e "$K/.ai-factory/before-getff/apps/tablet" ] \
  && ok "L neg: after getff's own write on the second install, a third reads the workspace config apps/tablet as getff's" \
  || bad "L neg: getff's own write into apps/tablet read as a consumer edit: $(grep 'synth-wire.*apps/tablet' "$K.3.log" | head -2 | tr '\n' '|')"

M="$WORK/placed-boundary"; mkdir -p "$M/lib"
printf '{ "name": "swm", "version": "0.0.0" }\n' > "$M/package.json"
printf 'export const answer = 42;\n' > "$M/lib/answer.ts"
borrow "$M"
( cd "$M" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$M.1.log" 2>&1 \
  || bad "M: the first install.sh react-next failed (tail: $(tail -3 "$M.1.log" | tr '\n' '|'))"
mkdir -p "$M/app/api/x"
printf "import { z } from 'zod';\nexport async function POST(req: Request) {\n  return z.object({ a: z.string() }).parse(await req.json());\n}\n" \
  > "$M/app/api/x/route.ts"
for n in 2 3; do
  ( cd "$M" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$M.$n.log" 2>&1 \
    || bad "M: re-install $n failed (tail: $(tail -3 "$M.$n.log" | tr '\n' '|'))"
done
unborrow "$M"
grep -q 'added [0-9]* glob(s) to RULE_GLOBS.boundary' "$M.2.log" \
  || bad "M: 60-ci added no boundary glob on the re-install — the arm would be vacuous"
for n in 2 3; do
  grep -q '▶ synth-wire: confirming' "$M.$n.log" && ! grep -qE 'edited since|is your own config' "$M.$n.log" \
    && ok "M neg: re-install $n reads getff's config as getff's after 60-ci added the boundary globs" \
    || bad "M neg: re-install $n read 60-ci's own glob insert as a consumer edit: $(grep -E 'synth-wire|R2' "$M.$n.log" | head -2 | tr '\n' '|')"
done
[ ! -d "$M/.ai-factory/before-getff" ] && ok "M neg: getff's own config keeps no 'before getff' copy" \
  || bad "M neg: a copy of getff's own config was kept as if it were the consumer's"

# ── Q: an edited getff config on an install without ts-morph ───────────────────────────────────
# A plain install puts no ts-morph in node_modules, so nothing can be inserted into a config treated
# as the consumer's. Only what is missing from it is a not-wired line: getff's rules came with its
# template, so an edited config that still carries them has nothing to report (Q); one live rule it
# does not carry is a real gap, and the summary names it (Q neg).
edited_plain_reinstall() { # $1 = project dir, $2 = live snippet for the re-install ("" = none)
  # $3 = a command run on the project dir after the edit, before the re-install ("" = none); what it
  # does to the config is part of the consumer's edit. $REINSTALL_PATH, when set, is the re-install's PATH.
  printf '{ "name": "swq", "version": "0.0.0" }\n' > "$1/package.json"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$1.1.log" 2>&1 \
    || bad "$(basename "$1"): the first plain install failed (tail: $(tail -3 "$1.1.log" | tr '\n' '|'))"
  edit_last_entry "$1/eslint.config.mjs"
  grep -qF "$NOTE" "$1/eslint.config.mjs" || bad "$(basename "$1"): the fixture edit did not land — the arm would be vacuous"
  [ -z "${3:-}" ] || "$3" "$1"
  cp "$1/eslint.config.mjs" "$1.edited"
  [ -z "$2" ] || live_snippet "$1" "$2"
  ( cd "$1" && PATH="${REINSTALL_PATH:-$PATH}" bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$1.2.log" 2>&1 \
    || bad "$(basename "$1"): the plain re-install failed (tail: $(tail -3 "$1.2.log" | tr '\n' '|'))"
  [ ! -e "$1/node_modules/ts-morph/package.json" ] \
    || bad "$(basename "$1"): ts-morph is in node_modules — the arm would be vacuous"
  grep -q 'getff placed eslint.config.mjs, and it has been edited since' "$1.2.log" \
    || bad "$(basename "$1"): the edited config was not routed as the consumer's — the arm would be vacuous"
}
Q="$WORK/placed-edited-plain"; mkdir -p "$Q"
edited_plain_reinstall "$Q" ""
not_wired "$Q.2.log" | grep -qF 'eslint.config.mjs' \
  && bad "Q: the not-wired summary lists eslint.config.mjs although getff's rules are already in it: $(not_wired "$Q.2.log" | grep -F 'eslint.config.mjs' | head -1)" \
  || ok "Q: with getff's rules already in the edited config, nothing about it is reported as not wired"
cmp -s "$Q/eslint.config.mjs" "$Q.edited" && ok "Q: the edited config is left byte-identical" \
  || bad "Q: the edited config changed on an install that cannot run the AST editor"
Qn="$WORK/placed-edited-plain-rule"; mkdir -p "$Qn"
edited_plain_reinstall "$Qn" '{ "no-var": "error" }'
not_wired "$Qn.2.log" | grep -F 'eslint.config.mjs' | grep -q -- '--full' \
  && ok "Q neg: a live rule the edited config does not carry is named in the not-wired summary, with --full" \
  || bad "Q neg: the missing live rule is not reported: $(not_wired "$Qn.2.log" | head -3 | tr '\n' '|')"

# ── N, O: HTTP boundary code appears in a project whose getff config the consumer has edited ───
# 60-ci widens RULE_GLOBS.boundary in place only in a config that is getff's: delivered AND still
# holding getff's bytes (M). An edited one is the consumer's, as for the synth-wire (I): its boundary
# globs go to 99-finalize's own-config pass (_r2_own_globs → --r2-boundary), which keeps the edited
# original before it inserts them. 60-ci's own insert bypassed that keep — no copy recorded the
# change, and a copy kept later already carried getff's globs.
HANDLERS_GLOB="'**/handlers/**/*.{ts,tsx}'"   # a detector glob the react-next template does not carry
add_handler() { # $1 = project dir — HTTP boundary code under handlers/, which only HANDLERS_GLOB covers
  mkdir -p "$1/lib/handlers"
  printf "import { z } from 'zod';\nexport const create = (body: unknown) => z.object({ a: z.string() }).parse(body);\n" \
    > "$1/lib/handlers/create.ts"
}
N="$WORK/placed-edited-boundary"; mkdir -p "$N"
printf '{ "name": "swn", "version": "0.0.0" }\n' > "$N/package.json"
borrow "$N"
( cd "$N" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$N.1.log" 2>&1 \
  || bad "N: the first install.sh react-next failed (tail: $(tail -3 "$N.1.log" | tr '\n' '|'))"
edit_last_entry "$N/eslint.config.mjs"
cp "$N/eslint.config.mjs" "$N.edited"
grep -qF "$NOTE" "$N.edited" && ! grep -qF "$HANDLERS_GLOB" "$N.edited" \
  || bad "N: the edited config lacks the edit or already carries the handlers glob — the arm would be vacuous"
add_handler "$N"
( cd "$N" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$N.2.log" 2>&1 \
  || bad "N: the re-install failed (tail: $(tail -3 "$N.2.log" | tr '\n' '|'))"
unborrow "$N"
grep -q 'getff placed eslint.config.mjs, and it has been edited since' "$N.2.log" \
  || bad "N: the re-install did not route the edited config as the consumer's — the arm would be vacuous"
# boundary_block <cfg> — the lines of RULE_GLOBS.boundary, from `boundary: [` to its closing `]`.
boundary_block() { awk '/^[[:space:]]*boundary:[[:space:]]*\[/{on=1} on{print} on && /\]/{exit}' "$1"; }
boundary_block "$N/eslint.config.mjs" | grep -qF "$HANDLERS_GLOB" \
  && ok "N: the boundary glob for the new HTTP boundary code is in the edited config's RULE_GLOBS.boundary" \
  || bad "N: the handlers glob did not land in the edited config: $(grep -nE 'R2 auto-wire|HTTP boundary|synth-wire' "$N.2.log" | head -3 | tr '\n' '|')"
grep -q 'added [0-9]* glob(s) to RULE_GLOBS.boundary' "$N.2.log" \
  && bad "N: 60-ci wrote the boundary globs into the consumer's edited config itself" \
  || ok "N: 60-ci leaves the edited config to the own-config pass"
kept_original "$N" eslint.config.mjs "$N.edited" \
  && ok "N: the edited original is kept at .ai-factory/before-getff/, byte-equal to the consumer's edit" \
  || bad "N: no single byte-equal kept original of the edited config ($(ls "$N/.ai-factory/before-getff" 2>&1 | tr '\n' ' '))"
cat "$N/.ai-factory/before-getff/eslint.config.mjs".* 2>/dev/null | grep -qF "$HANDLERS_GLOB" \
  && bad "N: a kept 'original' already carries getff's boundary glob" \
  || ok "N: no kept original carries getff's boundary glob"
only_insertions "$N.edited" "$N/eslint.config.mjs" \
  && ok "N: nothing of the edited config was changed or removed — getff only inserted" \
  || bad "N: a character of the edited config was changed or removed"
not_wired "$N.2.log" | grep -qF 'eslint.config.mjs' \
  && bad "N: the not-wired summary lists the eslint config: $(not_wired "$N.2.log" | grep -F 'eslint.config.mjs' | head -1)" \
  || ok "N: the not-wired summary has no eslint config line"

# Without ts-morph nothing can be inserted into the consumer's config. Only the globs it does not
# carry are a gap — never getff's rules, which came with its template and are still in it.
O="$WORK/placed-edited-boundary-plain"; mkdir -p "$O"
edited_plain_reinstall "$O" "" add_handler
cmp -s "$O/eslint.config.mjs" "$O.edited" && ok "O: the edited config is left byte-identical" \
  || bad "O: the edited config changed on an install that cannot run the AST editor: $(diff "$O.edited" "$O/eslint.config.mjs" | head -4 | tr '\n' '|')"
_o_line=$(not_wired "$O.2.log" | grep -F 'eslint.config.mjs')
printf '%s\n' "$_o_line" | grep -qF "$HANDLERS_GLOB" && printf '%s\n' "$_o_line" | grep -q -- '--full' \
  && ok "O: the not-wired summary names the missing boundary glob, with --full" \
  || bad "O: the missing boundary glob is not reported: $(not_wired "$O.2.log" | head -3 | tr '\n' '|')"
printf '%s\n' "$_o_line" | grep -qF "getff's rules" \
  && bad "O: the not-wired line says getff's rules are missing, but they are in the edited config: $_o_line" \
  || ok "O: the not-wired line does not claim getff's rules are missing"
# O neg: the boundary code was there on the first install, whose 60-ci added every glob while the
# config was getff's; after the consumer's edit there is nothing left to add, so nothing to report.
On="$WORK/placed-edited-boundary-covered"; mkdir -p "$On"
add_handler "$On"
edited_plain_reinstall "$On" ""
grep -qF "$HANDLERS_GLOB" "$On.edited" \
  || bad "O neg: the first install did not add the handlers glob — the arm would be vacuous"
not_wired "$On.2.log" | grep -qF 'eslint.config.mjs' \
  && bad "O neg: the not-wired summary lists eslint.config.mjs although every boundary glob is in it: $(not_wired "$On.2.log" | grep -F 'eslint.config.mjs' | head -1)" \
  || ok "O neg: with every boundary glob already in the edited config, nothing about it is reported"
cmp -s "$On/eslint.config.mjs" "$On.edited" && ok "O neg: the edited config is left byte-identical" \
  || bad "O neg: the edited config changed"

# ── S, T, V: what R2 lacks is what the own-config wirer would add, read as that wirer reads it ──
# S: the consumer's edit removes RULE_GLOBS.boundary. The wirer does not redefine a RULE_GLOBS the
# config declares, so it refuses R2 there with or without ts-morph: the summary gives its reason, and
# no --full (S2 runs the wirer itself, with ts-morph, and must print the same line).
drop_boundary() { # $1 = project dir — the edit drops the boundary array; then HTTP boundary code appears
  awk '/^[[:space:]]*boundary:[[:space:]]*\[/{skip=1} skip{ if ($0 ~ /\]/) skip=0; next } { print }' \
    "$1/eslint.config.mjs" > "$1/eslint.config.mjs.edit" && mv "$1/eslint.config.mjs.edit" "$1/eslint.config.mjs"
  add_handler "$1"
}
R2_REFUSAL='declares its own RULE_GLOBS with no boundary array, and getff does not redefine it'
Sx="$WORK/placed-edited-no-boundary-plain"; mkdir -p "$Sx"
edited_plain_reinstall "$Sx" "" drop_boundary
grep -q 'RULE_GLOBS' "$Sx.edited" && ! grep -qE '^[[:space:]]*boundary:' "$Sx.edited" \
  || bad "S: the edit did not leave RULE_GLOBS without its boundary array — the arm would be vacuous"
cmp -s "$Sx/eslint.config.mjs" "$Sx.edited" && ok "S: the edited config is left byte-identical" \
  || bad "S: the edited config changed: $(diff "$Sx.edited" "$Sx/eslint.config.mjs" | head -4 | tr '\n' '|')"
_s_line=$(not_wired "$Sx.2.log" | grep -F "$R2_REFUSAL")
[ -n "$_s_line" ] && ! printf '%s\n' "$_s_line" | grep -q -- '--full' \
  && ! not_wired "$Sx.2.log" | grep -F 'eslint.config.mjs' | grep -qiE 'boundary glob' \
  && ok "S: the summary gives the wirer's reason R2 is refused, with no --full and no boundary globs to add" \
  || bad "S: the summary does not give the wirer's refusal: $(not_wired "$Sx.2.log" | grep -F 'eslint.config.mjs' | head -3 | tr '\n' '|')"
S2="$WORK/placed-edited-no-boundary"; mkdir -p "$S2"
printf '{ "name": "sws", "version": "0.0.0" }\n' > "$S2/package.json"
borrow "$S2"
( cd "$S2" && git init -q && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$S2.1.log" 2>&1 \
  || bad "S2: the first install.sh react-next failed (tail: $(tail -3 "$S2.1.log" | tr '\n' '|'))"
edit_last_entry "$S2/eslint.config.mjs"; drop_boundary "$S2"
( cd "$S2" && bash "$REPO_ROOT/install.sh" react-next </dev/null ) >"$S2.2.log" 2>&1 \
  || bad "S2: the re-install failed (tail: $(tail -3 "$S2.2.log" | tr '\n' '|'))"
unborrow "$S2"
_s2_line=$(not_wired "$S2.2.log" | grep -F "$R2_REFUSAL")
[ -n "$_s2_line" ] && [ "$_s2_line" = "$_s_line" ] \
  && ok "S2: with ts-morph the wirer refuses R2 in the same words the install without it uses" \
  || bad "S2: the two routes disagree — with ts-morph: '$_s2_line'; without: '$_s_line'"
# T: the react-next template carries '**/application/**/*.{ts,tsx}' under application:, and a parse
# site under application/ makes 60-ci ask for that glob in boundary:. It is not an element of the
# array, so R2 lacks it, and the wirer would add it; a match anywhere in the file is not coverage.
APP_GLOB="'**/application/**/*.{ts,tsx}'"
add_app_parse() { # $1 = project dir — a hand-rolled parse boundary under application/
  mkdir -p "$1/lib/application"
  printf "import { z } from 'zod';\nexport const run = (input: unknown) => z.object({ a: z.string() }).parse(input);\n" \
    > "$1/lib/application/run.ts"
}
T="$WORK/placed-edited-application"; mkdir -p "$T"
edited_plain_reinstall "$T" "" add_app_parse
grep -qF "$APP_GLOB" "$T.edited" && ! boundary_block "$T.edited" | grep -qF "$APP_GLOB" \
  || bad "T: the edited config does not carry the glob outside its boundary array — the arm would be vacuous"
not_wired "$T.2.log" | grep -F 'eslint.config.mjs' | grep -F "$APP_GLOB" | grep -q -- '--full' \
  && ok "T: a glob found only in another RULE_GLOBS key is named as one R2 lacks, with --full" \
  || bad "T: the glob the boundary array lacks is not reported: $(not_wired "$T.2.log" | grep -F 'eslint.config.mjs' | head -2 | tr '\n' '|')"
# V: the same edited config on a re-install without Node. Every writer of the own-config pass runs
# on Node, so nothing lands — and 60-ci no longer writes the globs into the edited config itself.
# What R2 lacks can still be read without Node, and the summary names it with that reason.
NONODE="$WORK/nonode-bin"; mkdir -p "$NONODE"
IFS=: read -ra _path_dirs <<< "$PATH"
for _d in "${_path_dirs[@]}"; do
  [ -d "$_d" ] || continue
  for _f in "$_d"/*; do
    case "${_f##*/}" in node|nodejs|npm|npx|pnpm|yarn|corepack) continue ;; esac
    [ -x "$_f" ] && [ ! -d "$_f" ] && [ ! -e "$NONODE/${_f##*/}" ] && ln -s "$_f" "$NONODE/${_f##*/}"
  done
done
V="$WORK/placed-edited-boundary-nonode"; mkdir -p "$V"
# Asked in a new shell, like the install runs: this one has run node already, and bash answers
# `command -v` from its hash table even under a changed PATH.
if PATH="$NONODE" "$BASH" -c 'command -v node' >/dev/null 2>&1; then
  bad "V: node is still on the PATH without Node — the arm would be vacuous"
else
  REINSTALL_PATH="$NONODE" edited_plain_reinstall "$V" "" add_handler
  cmp -s "$V/eslint.config.mjs" "$V.edited" && ok "V: without Node the edited config is left byte-identical" \
    || bad "V: the edited config changed on an install without Node: $(diff "$V.edited" "$V/eslint.config.mjs" | head -4 | tr '\n' '|')"
  _v_line=$(not_wired "$V.2.log" | grep -F 'eslint.config.mjs')
  printf '%s\n' "$_v_line" | grep -qF "$HANDLERS_GLOB" && printf '%s\n' "$_v_line" | grep -q 'needs Node' \
    && ! printf '%s\n' "$_v_line" | grep -q -- '--full' \
    && ok "V: without Node the summary names the boundary globs R2 lacks, and that adding them needs Node" \
    || bad "V: the globs R2 lacks are not reported without Node: $(not_wired "$V.2.log" | head -4 | tr '\n' '|')"
  asks_by_hand "$V.2.log" && bad "V: the install without Node asks for a manual edit: $(manual_step_lines "$V.2.log" | head -1)" \
    || ok "V: the install without Node asks for no manual edit"
fi

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
  grep -qE "\{ ?files: RULE_GLOBS\.boundary, plugins: \{[^}]*\}, rules: \{ ?'rules-as-tests/no-unsafe-zod-parse'" \
    <<<"$(tr '\n' ' ' < "$1" | tr -s ' ')" \
    && grep -q '^const RULE_GLOBS = {' "$1"
}

# E — flat repo: getff places the root config, the consumer owns three per-package configs, and the
# parse boundary in src/api makes the root R2 verdict boundary-present (r2-auto-wire fixture B).
# apps/api has HTTP boundary code of its own (routes/), apps/lib has none, and apps/web has boundary
# code under a config whose export shape the wirer cannot add to.
# tools/esm (a package, not a workspace: _workspace_pkg_dirs reads apps/ packages/ services/ libs/ modules/
# only) has boundary code under an ES-module eslint.config.js — the name ESLint loads first, as at
# the root — and tools/cjs under an eslint.config.cjs, which has no ES-module export to add to.
E="$WORK/l2"; mkdir -p "$E/src/api" "$E/apps/api/src/routes" "$E/apps/lib/src" "$E/apps/web/src/routes" \
  "$E/tools/esm/src/routes" "$E/tools/cjs/src/routes"
printf '{ "name": "swe", "version": "0.0.0" }\n' > "$E/package.json"
echo 'export const h = (b) => schema.parse(b);' > "$E/src/api/handler.ts"
echo 'export const u = (b) => schema.parse(b);' > "$E/apps/api/src/routes/users.ts"
printf 'export const x = 1;\n' > "$E/apps/lib/src/h.ts"
echo 'export const w = (b) => schema.parse(b);' > "$E/apps/web/src/routes/w.ts"
echo 'export const e = (b) => schema.parse(b);' > "$E/tools/esm/src/routes/e.ts"
echo 'export const c = (b) => schema.parse(b);' > "$E/tools/cjs/src/routes/c.ts"
cp "$WORK/pkg.before" "$E/apps/api/eslint.config.mjs"
cp "$WORK/pkg.before" "$E/apps/lib/eslint.config.mjs"
printf "import { makeConfig } from './make.mjs';\nexport default makeConfig();\n" > "$WORK/web.before"
cp "$WORK/web.before" "$E/apps/web/eslint.config.mjs"
printf '{ "name": "esm", "version": "0.0.0", "type": "module" }\n' > "$E/tools/esm/package.json"
cp "$WORK/pkg.before" "$E/tools/esm/eslint.config.js"
printf "module.exports = [{ rules: { 'no-console': 'error' } }];\n" > "$WORK/cjs-pkg.before"
cp "$WORK/cjs-pkg.before" "$E/tools/cjs/eslint.config.cjs"
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
grep -q 'apps/api/eslint.config.mjs' <<<"$(not_wired "$WORK/e.log")" \
  && bad "E: the not-wired summary still lists apps/api/eslint.config.mjs" || ok "E: the per-package config is not reported as unwired"
grep -q -- '- apps/api/eslint\.config\.mjs$' <<<"$(summary_list "$WORK/e.log" "of your own file(s)")" \
  && ok "E: the summary lists apps/api/eslint.config.mjs as a file getff added its block to" \
  || bad "E: apps/api/eslint.config.mjs is not in the summary's «getff's block added» list"
cmp -s "$WORK/pkg.before" "$E/apps/lib/eslint.config.mjs" && [ ! -e "$E/.ai-factory/before-getff/apps/lib" ] \
  && ok "E: apps/lib, with no HTTP boundary code, keeps its config byte-identical — R2 has nothing to guard there" \
  || bad "E: R2 was added to apps/lib/eslint.config.mjs, whose package has no HTTP boundary code"
grep -q 'apps/lib/eslint.config.mjs' <<<"$(not_wired "$WORK/e.log")" \
  && bad "E: apps/lib is in the not-wired summary, though nothing was missing there" || ok "E: apps/lib is not reported as unwired"
cmp -s "$WORK/web.before" "$E/apps/web/eslint.config.mjs" && [ ! -e "$E/.ai-factory/before-getff/apps/web" ] \
  && ok "E: a config getff cannot add to (apps/web) is left byte-identical, no copy kept" \
  || bad "E: apps/web/eslint.config.mjs changed, or a copy of it was kept"
grep -q 'apps/web/eslint.config.mjs' <<<"$(not_wired "$WORK/e.log")" \
  && ok "E: the not-wired summary names apps/web/eslint.config.mjs" \
  || bad "E: apps/web/eslint.config.mjs (not wired) is missing from the not-wired summary"
r2_scoped "$E/tools/esm/eslint.config.js" && only_insertions "$WORK/pkg.before" "$E/tools/esm/eslint.config.js" \
  && kept_original "$E" tools/esm/eslint.config.js "$WORK/pkg.before" \
  && ok "E: a per-package ES-module eslint.config.js gets R2 the way an .mjs does — scoped, insertions only, original kept" \
  || bad "E: tools/esm/eslint.config.js (the config ESLint loads there) did not get R2 with its original kept"
not_wired "$WORK/e.log" | grep -q 'tools/esm' \
  && bad "E: tools/esm is in the not-wired summary, though R2 was added to it" || ok "E: tools/esm is not reported as unwired"
cmp -s "$WORK/cjs-pkg.before" "$E/tools/cjs/eslint.config.cjs" && [ ! -e "$E/.ai-factory/before-getff/tools/cjs" ] \
  && ok "E: a per-package eslint.config.cjs is left byte-identical, no copy kept" \
  || bad "E: tools/cjs/eslint.config.cjs changed, or a copy of it was kept"
not_wired "$WORK/e.log" | grep 'tools/cjs' | grep -q 'eslint.config.cjs' \
  && ok "E: the not-wired summary names tools/cjs's eslint.config.cjs (boundary code R2 does not reach)" \
  || bad "E: tools/cjs/eslint.config.cjs, with boundary code and no R2, is missing from the not-wired summary"
asks_by_hand "$WORK/e.log" && bad "E: the install asks for a manual step: $(manual_step_lines "$WORK/e.log" | head -2 | tr '\n' '|')" || ok "E: nothing asks for a manual step"

# F — multi-stack monorepo, no root config: two ts-server workspaces, the consumer owns the config
# of apps/api, getff places the one in apps/svc.
# apps/lib: a ts-server library workspace with no HTTP code (cold-review F15's scenario).
# apps/ui: a workspace whose own config spreads apps/svc's — the config getff places, with getff's rules.
F="$WORK/l2mono"; mkdir -p "$F/apps/api/src/routes" "$F/apps/svc/src" "$F/apps/lib/src" "$F/apps/ui/src"
printf '{"name":"swf","version":"0.0.0","private":true}\n' > "$F/package.json"
printf 'packages:\n  - "apps/*"\n' > "$F/pnpm-workspace.yaml"
for w in api svc lib ui; do
  printf '{"name":"%s","version":"0.0.0","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' "$w" > "$F/apps/$w/package.json"
  printf 'export const x = 1;\n' > "$F/apps/$w/src/h.ts"
done
echo 'export const u = (b) => schema.parse(b);' > "$F/apps/api/src/routes/users.ts"
cp "$WORK/pkg.before" "$F/apps/api/eslint.config.mjs"
cp "$WORK/pkg.before" "$F/apps/lib/eslint.config.mjs"
printf "import svc from '../svc/eslint.config.mjs';\n\nexport default [...svc];\n" > "$F/apps/ui/eslint.config.mjs"
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
# Nothing of getff reaches apps/lib — 40-configs placed no preset beside its own config, and no pass added
# to it: the summary names it once, not a silence (cold-review, after #1868).
_n=$(not_wired "$WORK/f.log" | grep -c 'apps/lib.*eslint\.config\.mjs')
[ "$_n" -eq 1 ] && ok "F: the not-wired summary names apps/lib/eslint.config.mjs once" \
  || bad "F: the not-wired summary names apps/lib/eslint.config.mjs $_n time(s), expected 1 (summary: $(not_wired "$WORK/f.log" | tr '\n' '|' | head -c 400))"
grep -q "rules-as-tests/" "$F/apps/svc/eslint.config.mjs" \
  || bad "F: getff's apps/svc config carries none of getff's rules — the apps/ui arm below would be vacuous"
not_wired "$WORK/f.log" | grep -q 'apps/ui' \
  && bad "F: the summary names apps/ui, whose config spreads apps/svc's with getff's rules: $(not_wired "$WORK/f.log" | grep 'apps/ui' | head -1)" \
  || ok "F: apps/ui, whose config imports getff's apps/svc config, is not named as unwired"
asks_by_hand "$WORK/f.log" && bad "F: the install asks for a manual step: $(manual_step_lines "$WORK/f.log" | head -2 | tr '\n' '|')" || ok "F: nothing asks for a manual step"
grep -q 'apps/api/eslint.config.mjs' <<<"$(not_wired "$WORK/f.log")" \
  && bad "F: the not-wired summary still lists apps/api/eslint.config.mjs" || ok "F: the workspace config is not reported as unwired"
grep -q 'R2 wiring: .*apps/svc/eslint.config.mjs' "$WORK/f.log" \
  && ok "F neg: the workspace config getff placed (apps/svc) still goes through the R2 wirer" \
  || bad "F neg: the R2 wirer skipped the config getff placed in apps/svc"
[ ! -e "$F/.ai-factory/before-getff/apps/svc" ] && ok "F neg: getff's own apps/svc config keeps no 'before getff' copy" \
  || bad "F neg: a copy of getff's own apps/svc config was kept as if it were the consumer's"

# M — the two per-workspace passes on one config. A live-research snippet goes to every ts-server
# workspace (synth-wire per-workspace), then R2 to those with HTTP boundary code (R2 per-workspace):
# apps/api's own eslint.config.mjs is written by both. apps/js owns an ES-module eslint.config.js.
# r2_scoped_after_live <file> — R2 is in <file> as the RULE_GLOBS.boundary-scoped element, after the
# live pass: getff's live element already registers the plugin for every file, so the R2 element
# carries files and rules only, and the plugin is registered once.
r2_scoped_after_live() {
  tr '\n' ' ' < "$1" | tr -s ' ' \
    | grep -qE "\{ ?files: RULE_GLOBS\.boundary, rules: \{ ?'rules-as-tests/no-unsafe-zod-parse'" \
    && grep -q '^const RULE_GLOBS = {' "$1" \
    && [ "$(grep -cF "plugins: { 'rules-as-tests': customRules }" "$1")" -eq 1 ]
}
M="$WORK/twopass"; mkdir -p "$M/apps/api/src/routes" "$M/apps/js/src/routes"
printf '{"name":"swm","version":"0.0.0","private":true}\n' > "$M/package.json"
printf 'packages:\n  - "apps/*"\n' > "$M/pnpm-workspace.yaml"
printf '{"name":"api","version":"0.0.0","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$M/apps/api/package.json"
printf '{"name":"js","version":"0.0.0","type":"module","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$M/apps/js/package.json"
echo 'export const u = (b) => schema.parse(b);' > "$M/apps/api/src/routes/users.ts"
echo 'export const j = (b) => schema.parse(b);' > "$M/apps/js/src/routes/j.ts"
cp "$WORK/pkg.before" "$M/apps/api/eslint.config.mjs"
cp "$WORK/pkg.before" "$M/apps/js/eslint.config.js"
seed_snippet "$M"
borrow "$M" tsx
( cd "$M" && git init -q && PATH="$STUB:$PATH" bash "$REPO_ROOT/install.sh" ts-server --full </dev/null ) >"$WORK/m.log" 2>&1
unborrow "$M"
{ grep -q 'synth-wire per-workspace' "$WORK/m.log" && grep -q 'R2 per-workspace: scoped wiring' "$WORK/m.log"; } \
  || bad "M: a per-workspace pass never ran — the arm below would be vacuous (tail: $(tail -3 "$WORK/m.log" | tr '\n' '|'))"
grep -qF 'swcLiveProbe' "$M/apps/api/eslint.config.mjs" && r2_scoped_after_live "$M/apps/api/eslint.config.mjs" \
  || bad "M: apps/api/eslint.config.mjs did not get both the live rule and R2 — the F9 check below would be vacuous"
kept_original "$M" apps/api/eslint.config.mjs "$WORK/pkg.before" \
  && ok "M: one kept original of apps/api/eslint.config.mjs, byte-equal to the consumer's file before getff (F9)" \
  || bad "M: kept originals of apps/api/eslint.config.mjs: $(ls "$M/.ai-factory/before-getff/apps/api/" 2>/dev/null | tr '\n' ' ')— not exactly one true original (F9)"
[ "$(grep -c 'your original apps/api/eslint.config.mjs is kept at' "$WORK/m.log")" -eq 1 ] \
  && ok "M: the kept original is announced once" \
  || bad "M: the kept original of apps/api/eslint.config.mjs is announced $(grep -c 'your original apps/api/eslint.config.mjs is kept at' "$WORK/m.log") times"
[ ! -e "$M/apps/js/eslint.config.mjs" ] && ok "M: no eslint.config.mjs placed beside apps/js's own eslint.config.js" \
  || bad "M: eslint.config.mjs placed in apps/js — ESLint still loads the .js, getff's file would be dead"
grep -qF 'swcLiveProbe' "$M/apps/js/eslint.config.js" && r2_scoped_after_live "$M/apps/js/eslint.config.js" \
  && only_insertions "$WORK/pkg.before" "$M/apps/js/eslint.config.js" \
  && ok "M: the workspace's own ES-module eslint.config.js gets the live rule and scoped R2, insertions only" \
  || bad "M: apps/js/eslint.config.js (the config ESLint loads there) did not get the live rule and scoped R2"
kept_original "$M" apps/js/eslint.config.js "$WORK/pkg.before" \
  && ok "M: one kept original of apps/js/eslint.config.js" || bad "M: no single true kept original of apps/js/eslint.config.js"
not_wired "$WORK/m.log" | grep -qE 'apps/(js|api)' \
  && bad "M: the not-wired summary lists a workspace config getff wired: $(not_wired "$WORK/m.log" | grep -E 'apps/(js|api)' | head -2 | tr '\n' '|')" \
  || ok "M: neither workspace config is reported as unwired"
asks_by_hand "$WORK/m.log" && bad "M: the install asks for a manual ESLint edit" || ok "M: nothing asks for a manual ESLint edit"

fw_print > "$WORK/fw.after"
if cmp -s "$WORK/fw.before" "$WORK/fw.after"; then
  ok "the framework's node_modules scope directories are unchanged after every arm"
else
  bad "a fixture install wrote into the framework's node_modules:"
  diff "$WORK/fw.before" "$WORK/fw.after" | head -8 | sed 's/^/      /'
fi

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
