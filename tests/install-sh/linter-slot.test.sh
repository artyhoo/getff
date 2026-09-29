#!/usr/bin/env bash
# linter-slot.test.sh — P2 G5 / K4 (one-button, operator log entry 28 fork 1 = A: getff adapts to the
# project's linter). A project that lints with oxlint or Biome keeps its linter as the only one:
#   (A) oxlint: no getff eslint.config.mjs, no ESLint packages among the dev-dependencies getff adds
#   (B) oxlint: lint-staged's lint step runs oxlint (through the record), never eslint
#   (C) oxlint: the record says `linter: oxlint`; the gates that read an ESLint config are not-armed
#       with that reason; the project's own `lint` script is kept
#   (D) oxlint: getff's rules are named under NOT wired while no oxlint plugin registration exists
#       (P4's oxlint_register_jsplugin — absent on this branch)
#   (E) Biome: no getff ESLint config, no .prettierrc.json, lint-staged runs `biome check`, no
#       prettier step; the record says `linter: biome`, `formatter: biome`
#   (F) paired negative: a project with no linter still gets getff's eslint.config.mjs and the
#       eslint step in lint-staged
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
install_into() { ( cd "$1" && bash "$INSTALL" react-spa < /dev/null ) > "$1/.log" 2>&1; }
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
steps "$O" | grep -q 'eslint' && bad "(B) lint-staged still runs eslint: $(steps "$O" | grep eslint)" \
  || ok "(B) no eslint step in lint-staged"
steps "$O" | grep -qx "bash scripts/run-armed.sh --if-armed 'npm run lint' oxlint" \
  && ok "(B) lint-staged runs oxlint while npm run lint is armed" || bad "(B) steps: $(steps "$O" | tr '\n' '|')"
block "$O" | grep -qx 'linter: oxlint' && ok "(C) record: linter: oxlint" || bad "(C) linter line: $(block "$O" | grep '^linter')"
node -e 'process.exit(require(process.argv[1]).scripts.lint==="oxlint"?0:1)' "$O/package.json" \
  && ok "(C) the project's own lint script is kept" || bad "(C) lint script changed"
for g in check-rule-globs check-rule-enforced check-fences-fire; do
  section "$O" not-armed | grep -qx -- "- bash scripts/$g.sh # reads getff's ESLint config, and this project lints with oxlint" \
    && ok "(C) $g not-armed: reads getff's ESLint config" \
    || bad "(C) $g line: $(section "$O" not-armed | grep "$g" || echo none; section "$O" armed | grep "$g")"
done
not_wired "$O" | grep -q "getff lint plugin in oxlint" \
  && ok "(D) NOT wired names getff's rules for oxlint (no plugin registration on this branch)" \
  || bad "(D) summary: $(not_wired "$O" | tr '\n' '|')"

# ── (E) Biome ───────────────────────────────────────────────────────────────────────────────────
B=$(proj '{"name":"b","version":"0.0.0","type":"module","scripts":{"lint":"biome lint ."},"dependencies":{"react":"^19.0.0"},"devDependencies":{"@biomejs/biome":"^2.0.0"}}')
printf '{\n  "formatter": { "enabled": true }\n}\n' > "$B/biome.json"; git -C "$B" add -A; git -C "$B" commit -qm biome
install_into "$B"
[ ! -e "$B/eslint.config.mjs" ] && [ ! -e "$B/.prettierrc.json" ] \
  && ok "(E) Biome project: no getff eslint.config.mjs, no .prettierrc.json" \
  || bad "(E) placed: $(ls "$B"/eslint.config.mjs "$B"/.prettierrc.json 2>/dev/null | tr '\n' ' ')"
steps "$B" | grep -qE 'eslint|prettier' && bad "(E) lint-staged: $(steps "$B" | grep -E 'eslint|prettier' | tr '\n' '|')" \
  || ok "(E) no eslint or prettier step in lint-staged"
steps "$B" | grep -qx "bash scripts/run-armed.sh --if-armed 'npm run lint' biome check --no-errors-on-unmatched" \
  && ok "(E) lint-staged runs biome check while npm run lint is armed" || bad "(E) steps: $(steps "$B" | tr '\n' '|')"
block "$B" | grep -qx 'linter: biome' && block "$B" | grep -qx 'formatter: biome' \
  && ok "(E) record: linter: biome, formatter: biome" || bad "(E) record: $(block "$B" | grep -E '^(linter|formatter)' | tr '\n' '|')"

# ── (F) paired negative: no linter → getff's ESLint fills the empty slot ────────────────────────
F=$(proj '{"name":"f","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"}}')
install_into "$F"
[ -f "$F/eslint.config.mjs" ] && steps "$F" | grep -q "run-armed.sh --if-armed 'npm run lint' eslint --fix" \
  && ok "(F) no linter: getff's eslint.config.mjs placed, eslint step in lint-staged" \
  || bad "(F) empty slot not filled: $(ls "$F" | tr '\n' ' ')"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
