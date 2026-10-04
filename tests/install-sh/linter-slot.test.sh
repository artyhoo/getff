#!/usr/bin/env bash
# linter-slot.test.sh — P2 G5 / K4 (one-button, operator log entry 28 fork 1 = A: getff adapts to the
# project's linter). A project that lints with oxlint or Biome keeps its linter as the only one:
#   (A) oxlint: no getff eslint.config.mjs, no ESLint packages among the dev-dependencies getff adds
#   (B) oxlint: lint-staged's lint step runs oxlint (through the record), never eslint
#   (C) oxlint: the record says `linter: oxlint`; the gates that read an ESLint config are not-armed
#       with that reason; the project's own `lint` script is kept
#   (D) oxlint: getff's plugin is registered in the project's oxlint config (P4's oxlint_register_jsplugin),
#       and NOT wired says why no getff rule is switched on (P5 place_lint_rules: the lint cannot run here)
#   (E) Biome: no getff ESLint config, no .prettierrc.json, lint-staged runs `biome lint` under lint
#       and `biome format --write` under format:check (never `biome check`), no prettier step; the record says `linter: biome`, `formatter: biome`
#   (F) paired negative: a project with no linter still gets getff's eslint.config.mjs and the
#       eslint step in lint-staged
#   (G) oxlint project whose own tsconfig does not include tests/: tests/setup.ts is delivered all the
#       same — the reason to withhold it (typed ESLint rejects a file outside every tsconfig) is
#       ESLint's, and vitest.config.ts's setupFiles points at it (without it the project's first test
#       dies «Cannot find module tests/setup.ts», measured in the vite-shape cell 2026-09-29);
#       paired negative: the same tsconfig under getff's ESLint still withholds it
#   (H) --refresh adds the scripts the install adds: lint / lint:fix follow the project's linter
#       (derived — 40-configs.sh does not run on refresh), a solution tsconfig gets `tsc -b`, validate
#       runs the record; paired: a lint script the project has is kept
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
    printf '%s\n' "$1" > package.json; mkdir -p src; echo 'export const x = 1;' > src/x.ts
    git add -A && git commit -q -m base )
  echo "$d"
}
install_into() { ( cd "$1" && bash "$INSTALL" react-spa < /dev/null ) > "$1/.log" 2>&1; }; rc=$?
[ "$rc" -eq 0 ] || { echo "FAIL: install.sh exited $rc"; exit 1; }
block() { awk '/<!-- aif:project-checks:end -->/{f=0} f; /<!-- aif:project-checks:begin -->/{f=1}' "$1/.ai-factory/tool-decisions.md"; }
section() { block "$1" | awk -v h="$2:" '/^[a-z-]+:$/{f=($0==h);next} f'; }
not_wired() { awk '/NOT wired, or wired only in part/{on=1; next} on && /^[[:space:]]*$/{exit} on' "$1/.log"; }
steps() { node -e 'const j=require(process.argv[1]);console.log(Object.values(j).flat().join("\n"))' "$1/.lintstagedrc.json"; }

# ── (A)-(D) oxlint ──────────────────────────────────────────────────────────────────────────────
O=$(proj '{"name":"o","version":"0.0.0","type":"module","scripts":{"lint":"oxlint"},"dependencies":{"react":"^19.0.0"},"devDependencies":{"oxlint":"^1.20.0"}}')
printf '{\n  "rules": {}\n}\n' > "$O/.oxlintrc.json"; git -C "$O" add -A; git -C "$O" commit -qm oxlint
install_into "$O"; rc=$?
[ "$rc" -eq 0 ] || bad "(A) install rc=$rc: $(tail -3 "$O/.log" | tr '\n' '|')"
[ ! -e "$O/eslint.config.mjs" ] && ok "(A) oxlint project: no getff eslint.config.mjs" || bad "(A) eslint.config.mjs placed beside oxlint"
dl=$(not_wired "$O" | grep -E '^[[:space:]]*- dependencies \(' || true)
[ -n "$dl" ] || bad "(A) no dependencies line in NOT wired — the arm below would be vacuous"
grep -Eq '(^|[ (:])(eslint|typescript-eslint|@eslint/js|eslint-config-[a-z-]+|eslint-plugin-[a-z-]+|@[a-z-]+/eslint-plugin[a-z-]*)@' <<<"$dl" \
  && bad "(A) ESLint packages among getff's dev-dependencies: $(grep -oE '[@a-z/-]*eslint[@a-z/.^~0-9-]*' <<<"$dl" | tr '\n' ' ')" \
  || ok "(A) oxlint project: no ESLint package among the dev-dependencies getff adds"
grep -q 'prettier@' <<<"$dl" && ok "(A) the rest of getff's toolchain is still offered (prettier)" || bad "(A) prettier dropped too: $dl"
grep -q 'eslint' <<<"$(steps "$O")" && bad "(B) lint-staged still runs eslint: $(steps "$O" | grep eslint)" \
  || ok "(B) no eslint step in lint-staged"
grep -qx "bash scripts/run-armed.sh --if-armed 'npm run lint' oxlint" <<<"$(steps "$O")" \
  && ok "(B) lint-staged runs oxlint while npm run lint is armed" || bad "(B) steps: $(steps "$O" | tr '\n' '|')"
grep -qx 'linter: oxlint' <<<"$(block "$O")" && ok "(C) record: linter: oxlint" || bad "(C) linter line: $(block "$O" | grep '^linter')"
node -e 'process.exit(require(process.argv[1]).scripts.lint==="oxlint"?0:1)' "$O/package.json" \
  && ok "(C) the project's own lint script is kept" || bad "(C) lint script changed"
for g in check-rule-globs check-rule-enforced check-fences-fire; do
  grep -qx -- "- bash scripts/$g.sh # not wired: reads getff's ESLint config, and this project lints with oxlint" <<<"$(section "$O" not-armed)" \
    && ok "(C) $g not-armed: reads getff's ESLint config" \
    || bad "(C) $g line: $(section "$O" not-armed | grep "$g" || echo none; section "$O" armed | grep "$g")"
done
# With P4's registration merged, the plugin goes into the project's oxlint config; no rule is switched on
# while the project's own lint cannot run (P5, place_lint_rules: dependencies not installed here).
grep -q '"name": "rules-as-tests"' "$O/.oxlintrc.json" \
  && ok "(D) getff's lint plugin is registered in the project's oxlint config" \
  || bad "(D) no jsPlugins entry: $(tr '\n' ' ' < "$O/.oxlintrc.json")"
grep -q "getff's lint rules in your oxlint config — not switched on: dependencies are not installed" <<<"$(not_wired "$O")" \
  && ok "(D) NOT wired names why no getff rule is switched on" \
  || bad "(D) summary: $(not_wired "$O" | tr '\n' '|')"

# ── (E) Biome ───────────────────────────────────────────────────────────────────────────────────
B=$(proj '{"name":"b","version":"0.0.0","type":"module","scripts":{"lint":"biome lint ."},"dependencies":{"react":"^19.0.0"},"devDependencies":{"@biomejs/biome":"^2.0.0"}}')
printf '{\n  "formatter": { "enabled": true }\n}\n' > "$B/biome.json"; git -C "$B" add -A; git -C "$B" commit -qm biome
install_into "$B"
[ ! -e "$B/eslint.config.mjs" ] && [ ! -e "$B/.prettierrc.json" ] \
  && ok "(E) Biome project: no getff eslint.config.mjs, no .prettierrc.json" \
  || bad "(E) placed: $(ls "$B"/eslint.config.mjs "$B"/.prettierrc.json 2>/dev/null | tr '\n' ' ')"
grep -qE 'eslint|prettier' <<<"$(steps "$B")" && bad "(E) lint-staged: $(steps "$B" | grep -E 'eslint|prettier' | tr '\n' '|')" \
  || ok "(E) no eslint or prettier step in lint-staged"
# `biome check` also enforces formatting — gated on lint alone it would block a commit on style while
# format:check is recorded not-armed (cold review M6): the lint key runs `biome lint`, formatting is
# its own step gated on format:check.
grep -qx "bash scripts/run-armed.sh --if-armed 'npm run lint' biome lint --no-errors-on-unmatched" <<<"$(steps "$B")" \
  && ! grep -q 'biome check' <<<"$(steps "$B")" \
  && ok "(E) lint-staged runs biome lint (not biome check) while npm run lint is armed" || bad "(E) steps: $(steps "$B" | tr '\n' '|')"
grep -qx "bash scripts/run-armed.sh --if-armed 'npm run format:check' biome format --write --no-errors-on-unmatched --files-ignore-unknown=true" <<<"$(steps "$B")" \
  && ok "(E) biome format runs only while npm run format:check is armed" || bad "(E) no format:check-gated biome format step: $(steps "$B" | tr '\n' '|')"
grep -qx 'linter: biome' <<<"$(block "$B")" && grep -qx 'formatter: biome' <<<"$(block "$B")" \
  && ok "(E) record: linter: biome, formatter: biome" || bad "(E) record: $(block "$B" | grep -E '^(linter|formatter)' | tr '\n' '|')"

# ── (F) paired negative: no linter → getff's ESLint fills the empty slot ────────────────────────
F=$(proj '{"name":"f","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"}}')
install_into "$F"
[ -f "$F/eslint.config.mjs" ] && grep -q "run-armed.sh --if-armed 'npm run lint' eslint --fix" <<<"$(steps "$F")" \
  && ok "(F) no linter: getff's eslint.config.mjs placed, eslint step in lint-staged" \
  || bad "(F) empty slot not filled: $(ls "$F" | tr '\n' ' ')"

# ── (G) tests/setup.ts: withheld for ESLint's sake only ─────────────────────────────────────────
own_ts() { printf '{\n  "compilerOptions": { "strict": true },\n  "include": ["src"]\n}\n' > "$1/tsconfig.json"
  git -C "$1" add -A; git -C "$1" commit -qm tsconfig; }
GO=$(proj '{"name":"go","version":"0.0.0","type":"module","scripts":{"lint":"oxlint"},"dependencies":{"react":"^19.0.0"},"devDependencies":{"oxlint":"^1.20.0"}}')
own_ts "$GO"; install_into "$GO"
[ -f "$GO/tests/setup.ts" ] && ! grep -q 'tests/setup.ts NOT delivered' "$GO/.log" \
  && ok "(G) oxlint, tsconfig without tests/: tests/setup.ts delivered (vitest's setupFiles resolves)" \
  || bad "(G) oxlint project left without tests/setup.ts: $(grep 'tests/setup.ts' "$GO/.log" | head -2 | tr '\n' '|')"
GE=$(proj '{"name":"ge","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"}}')
own_ts "$GE"; install_into "$GE"
[ ! -e "$GE/tests/setup.ts" ] && grep -q 'tests/setup.ts NOT delivered' "$GE/.log" \
  && ok "(G) paired negative: under getff's ESLint the same tsconfig still withholds it" \
  || bad "(G) ESLint project: tests/setup.ts $( [ -e "$GE/tests/setup.ts" ] && echo delivered || echo 'withheld without the note')"

# ── (H) --refresh adds the same scripts the install adds ────────────────────────────────────────
# do_refresh merges the canonical scripts through the same function as 70-deps.sh
# (merge_canonical_scripts), but 40-configs.sh — which sets the linter and formatter slots — does
# not run there: the refresh derives them from the project (project_linter / project_formatter).
# A solution tsconfig keeps `tsc -b` on refresh as on install (P2 G4). A key the project has is kept.
drop_scripts() {  # $1 = project dir, rest = script names to remove from package.json
  local d="$1"; shift
  node -e 'const f=process.argv[1],p=require(f);for(const k of process.argv.slice(2))delete p.scripts[k];require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$d/package.json" "$@"
  git -C "$d" add -A; git -C "$d" commit -qm drop-scripts
}
refresh_into() { ( cd "$1" && bash "$INSTALL" --refresh < /dev/null ) > "$1/.refresh.log" 2>&1; }; rc=$?
[ "$rc" -eq 0 ] || { echo "FAIL: install.sh exited $rc"; exit 1; }
script_of() { node -e 'const p=require(process.argv[1]);console.log((p.scripts||{})[process.argv[2]]||"")' "$1/package.json" "$2"; }
H=$(proj '{"name":"h","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"},"devDependencies":{"oxlint":"^1.20.0"}}')
printf '{\n  "rules": {}\n}\n' > "$H/.oxlintrc.json"
printf '{\n  "files": [],\n  "references": [{ "path": "./tsconfig.app.json" }]\n}\n' > "$H/tsconfig.json"
printf '{ "compilerOptions": { "strict": true }, "include": ["src"] }\n' > "$H/tsconfig.app.json"
git -C "$H" add -A; git -C "$H" commit -qm oxlint
install_into "$H"
drop_scripts "$H" lint lint:fix typecheck validate
refresh_into "$H"; rc=$?
[ "$rc" -eq 0 ] || bad "(H) refresh rc=$rc: $(tail -3 "$H/.refresh.log" | tr '\n' '|')"
[ "$(script_of "$H" lint)" = "oxlint" ] && ok "(H) --refresh: lint follows the project's linter (oxlint)" \
  || bad "(H) --refresh: lint is '$(script_of "$H" lint)'"
[ "$(script_of "$H" lint:fix)" = "oxlint --fix" ] && ok "(H) --refresh: lint:fix is 'oxlint --fix'" \
  || bad "(H) --refresh: lint:fix is '$(script_of "$H" lint:fix)'"
[ "$(script_of "$H" typecheck)" = "tsc -b" ] && ok "(H) --refresh: solution tsconfig → typecheck is 'tsc -b'" \
  || bad "(H) --refresh: typecheck is '$(script_of "$H" typecheck)'"
[ "$(script_of "$H" validate)" = "bash scripts/run-armed.sh validate" ] && ok "(H) --refresh: validate runs the record" \
  || bad "(H) --refresh: validate is '$(script_of "$H" validate)'"
HK=$(proj '{"name":"hk","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"},"devDependencies":{"oxlint":"^1.20.0"}}')
printf '{\n  "rules": {}\n}\n' > "$HK/.oxlintrc.json"; git -C "$HK" add -A; git -C "$HK" commit -qm oxlint
install_into "$HK"
node -e 'const f=process.argv[1],p=require(f);p.scripts.lint="oxlint --deny-warnings src";require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$HK/package.json"
git -C "$HK" add -A; git -C "$HK" commit -qm own-lint
refresh_into "$HK"
[ "$(script_of "$HK" lint)" = "oxlint --deny-warnings src" ] && ok "(H) paired: --refresh keeps the project's own lint script" \
  || bad "(H) paired: lint became '$(script_of "$HK" lint)'"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
