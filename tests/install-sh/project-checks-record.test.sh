#!/usr/bin/env bash
# project-checks-record.test.sh — P2 §3 + C2/C3/C7 (one-button): the install records how the project
# checks itself, arms only what it ran green, and every channel reads that record.
#   (A) no dependencies installed: the record is in .ai-factory/tool-decisions.md with `stack`,
#       `linter`, and both headers; nothing is armed; every getff check is not-armed with the reason;
#       `validate` goes through scripts/run-armed.sh, which is delivered; lint-staged's eslint and
#       prettier steps go through it too; the installer prints the record's section
#   (B) node_modules present: getff's checks ran at install — a green one is armed, a red one
#       not-armed with its exit code
#   (C) a script the project already had is never run by the install and never armed by it
#   (D) generic: the record says stack generic, both lists empty
#   (E) a second install keeps ONE record block and leaves a neighbour block byte-for-byte
#   (F) `npm run validate` on (A) exits 0: not-armed checks never block
#   (G) --dry-run writes no record
#   (J) --refresh delivers run-armed.sh with a record (every check not-armed, not run yet) when the
#       project has none, and keeps a record already there byte-for-byte
#   (I) the alpha lanes (python, cargo, go) record themselves too, both lists empty (C7)
#   (H) the delivered CI's gate steps go through run-armed.sh (every npm stack's template)
#   (K) the pre-push checks that read the project's own files (check-ci-pins, check-doc-links) are
#       recorded; the measured cowsay project pushes green after the install, saying «not armed»
#   (M) --refresh adds those two to a record from an older getff, not-armed, keeping the rest
#   (N) the generated-rule mutation check (P5's runner) is recorded from the rule generator's own
#       verdict: armed only when GEN_MUT_RC=0, never re-run by the arm pass; its CI step reads the record
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
TMPS=()
cleanup() { [ "${#TMPS[@]}" -gt 0 ] && rm -rf "${TMPS[@]}"; }
trap cleanup EXIT

proj() {  # $1 = package.json body ("" = none)
  local d; d=$(mktemp -d); TMPS+=("$d")
  ( cd "$d" && git init -q && git config user.email t@t && git config user.name t
    [ -n "$1" ] && printf '%s\n' "$1" > package.json
    printf '# x\n' > README.md; git add -A && git commit -q -m base )
  echo "$d"
}
REC() { echo "$1/.ai-factory/tool-decisions.md"; }
block() { awk '/<!-- aif:project-checks:end -->/{f=0} f; /<!-- aif:project-checks:begin -->/{f=1}' "$(REC "$1")"; }
section() { block "$1" | awk -v h="$2:" '/^[a-z-]+:$/{f=($0==h);next} f'; }
script_of() { node -e 'const p=require(process.argv[1]);console.log((p.scripts||{})[process.argv[2]]||"")' "$1/package.json" "$2"; }

SPA='{"name":"s","version":"0.0.0","type":"module","dependencies":{"react":"^19.0.0"}}'

# ── (A) no dependencies installed ───────────────────────────────────────────────────────────────
A=$(proj "$SPA")
outA=$( cd "$A" && bash "$INSTALL" react-spa < /dev/null 2>&1 )
[ "$(grep -c '<!-- aif:project-checks:begin -->' "$(REC "$A")" 2>/dev/null)" = 1 ] \
  && ok "(A) one aif:project-checks block in tool-decisions.md" || bad "(A) block count $(grep -c 'aif:project-checks:begin' "$(REC "$A")" 2>/dev/null)"
grep -qx 'stack: react-spa' <<<"$(block "$A")" && ok "(A) stack: react-spa" || bad "(A) stack line: $(block "$A" | grep '^stack')"
grep -qx 'linter: eslint' <<<"$(block "$A")" && ok "(A) linter: eslint (getff filled the empty slot)" || bad "(A) linter line: $(block "$A" | grep '^linter')"
grep -qx 'armed:' <<<"$(block "$A")" && grep -qx 'not-armed:' <<<"$(block "$A")" && ok "(A) armed: and not-armed: headers present" || bad "(A) headers missing"
# Only the two pre-push checks that need no dependencies can be armed here (see (K)).
[ -z "$(section "$A" armed | grep -v -e '^- bash scripts/check-ci-pins.sh$' -e '^- bash scripts/check-doc-links.sh$')" ] \
  && ok "(A) nothing that needs dependencies is armed without them" || bad "(A) armed: $(section "$A" armed | tr '\n' ';')"
grep -qx -- '- npm run lint # not run at install: dependencies are not installed' <<<"$(section "$A" not-armed)" \
  && ok "(A) npm run lint not-armed, reason: dependencies not installed" || bad "(A) lint line: $(section "$A" not-armed | grep lint | head -1)"
grep -qx -- '- bash scripts/check-rule-globs.sh # not run at install: dependencies are not installed' <<<"$(section "$A" not-armed)" \
  && ok "(A) a scripts/*.sh check is recorded as the bash command" || bad "(A) globs line: $(section "$A" not-armed | grep globs)"
grep -qx -- '- npm test # not run at install: dependencies are not installed' <<<"$(section "$A" not-armed)" \
  && ok "(A) test is recorded as npm test" || bad "(A) test line: $(section "$A" not-armed | grep test)"
[ "$(script_of "$A" validate)" = "bash scripts/run-armed.sh validate" ] && ok "(A) validate runs the record" || bad "(A) validate=$(script_of "$A" validate)"
[ -x "$A/scripts/run-armed.sh" ] && cmp -s "$A/scripts/run-armed.sh" "$REPO_ROOT/packages/core/audit-self/run-armed.sh" \
  && ok "(A) scripts/run-armed.sh delivered" || bad "(A) scripts/run-armed.sh missing or differs"
grep -q "bash scripts/run-armed.sh --if-armed 'npm run lint' eslint --fix" "$A/.lintstagedrc.json" \
  && ok "(A) lint-staged's eslint step follows the record" || bad "(A) lintstagedrc eslint line"
grep -q "bash scripts/run-armed.sh --if-armed 'npm run format:check' prettier --write" "$A/.lintstagedrc.json" \
  && ok "(A) lint-staged's prettier step follows the record" || bad "(A) lintstagedrc prettier line"
grep -q 'How this project checks itself' <<< "$outA" && ok "(A) the installer prints the record" || bad "(A) record not printed"

# ── (H) the delivered CI follows the record ─────────────────────────────────────────────────────
CI="$A/.github/workflows/ci.yml"
if [ -f "$CI" ]; then
  raw=$(grep -En 'run: (npm run (lint|format:check|typecheck|arch:check|test:coverage)|npm test|bash scripts/check-)' "$CI")
  [ -z "$raw" ] && ok "(H) no gate step in ci.yml runs around the record" || bad "(H) raw gate steps: $raw"
  grep -q 'run: bash scripts/run-armed.sh npm run lint' "$CI" && ok "(H) ci.yml lint step goes through run-armed.sh" || bad "(H) no run-armed lint step"
  grep -q "run: bash scripts/run-armed.sh --if-armed 'npm test' npm run test:coverage" "$CI" \
    && ok "(H) coverage runs while npm test is armed" || bad "(H) coverage step"
else
  bad "(H) no .github/workflows/ci.yml delivered"
fi
for t in "$REPO_ROOT/templates/ts-server/github-actions-ci.yml" "$REPO_ROOT"/packages/preset-*/templates/github-actions-ci-ui.yml; do
  raw=$(grep -En 'run: (npm run (lint|format:check|typecheck|arch:check|test:coverage)|npm test|bash scripts/check-)' "$t")
  [ -z "$raw" ] && ok "(H) ${t#"$REPO_ROOT"/}: every gate step reads the record" || bad "(H) ${t#"$REPO_ROOT"/}: $raw"
done

# ── (F) validate never blocks on not-armed checks ───────────────────────────────────────────────
( cd "$A" && npm run validate >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(F) npm run validate exits 0 when nothing is armed" || bad "(F) validate rc=$rc"

# ── (B) node_modules present: the install ran getff's checks ────────────────────────────────────
B=$(proj "$SPA"); mkdir -p "$B/node_modules"
( cd "$B" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
grep -qx -- '- bash scripts/audit-ai-docs.sh' <<<"$(section "$B" armed)" && ok "(B) a check green at install is armed" \
  || bad "(B) audit-ai-docs not armed: armed=[$(section "$B" armed | tr '\n' ';')]"
grep -Eq -- '^- npm run lint # exits [0-9]+ at install' <<<"$(section "$B" not-armed)" && ok "(B) a red check is not-armed with its exit code" \
  || bad "(B) lint line: $(section "$B" not-armed | grep lint | head -1)"

# ── (C) the project's own script is not run, not armed ──────────────────────────────────────────
C=$(proj '{"name":"c","version":"0.0.0","type":"module","scripts":{"lint":"touch ran-own-lint"},"dependencies":{"react":"^19.0.0"}}')
mkdir -p "$C/node_modules"
( cd "$C" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
[ ! -e "$C/ran-own-lint" ] && ok "(C) the install did not run the project's own lint script" || bad "(C) own lint ran"
grep -qx -- '- npm run lint # your own script: the install does not run it; the first validate or push arms it once it exits 0' <<<"$(section "$C" not-armed)" \
  && ok "(C) own lint recorded not-armed with why" || bad "(C) lint line: $(section "$C" not-armed | grep lint | head -1)"

# ── (D) generic ─────────────────────────────────────────────────────────────────────────────────
D=$(proj ""); printf '<project/>\n' > "$D/pom.xml"
( cd "$D" && bash "$INSTALL" -y < /dev/null >/dev/null 2>&1 )
grep -qx 'stack: generic' <<<"$(block "$D")" && ok "(D) generic: stack: generic" || bad "(D) stack line: $(block "$D" | grep '^stack')"
[ -z "$(section "$D" armed)$(section "$D" not-armed)" ] && grep -qx 'armed:' <<<"$(block "$D")" \
  && ok "(D) generic: both lists empty, headers present" || bad "(D) lists: $(block "$D" | tr '\n' ';')"

# ── (I) alpha lanes: the record with both lists empty ───────────────────────────────────────────
for lane in python cargo go; do
  L=$(proj "")
  case "$lane" in
    python) printf '[project]\nname = "x"\nversion = "0.0.0"\n' > "$L/pyproject.toml" ;;
    cargo)  printf '[package]\nname = "x"\nversion = "0.0.0"\n' > "$L/Cargo.toml" ;;
    go)     printf 'module x\n\ngo 1.22\n' > "$L/go.mod" ;;
  esac
  ( cd "$L" && bash "$INSTALL" "$lane" < /dev/null >/dev/null 2>&1 )
  grep -qx "stack: $lane" <<<"$(block "$L")" && grep -qx 'armed:' <<<"$(block "$L")" && grep -qx 'not-armed:' <<<"$(block "$L")" \
    && [ -z "$(section "$L" armed)$(section "$L" not-armed)" ] \
    && ok "(I) $lane lane: record with both lists empty" || bad "(I) $lane lane record: $(block "$L" 2>/dev/null | tr '\n' ';')"
done

# ── (E) second install: one block, neighbour untouched ──────────────────────────────────────────
E=$(proj "$SPA"); mkdir -p "$E/.ai-factory"
printf '# Tool decisions\n\n<!-- GETFF_VERSIONS_BEGIN -->\n| eslint | 9.39.5 |\n<!-- GETFF_VERSIONS_END -->\n' > "$(REC "$E")"
( cd "$E" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
( cd "$E" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
[ "$(grep -c '<!-- aif:project-checks:begin -->' "$(REC "$E")")" = 1 ] && ok "(E) still one block after a second install" \
  || bad "(E) blocks: $(grep -c 'aif:project-checks:begin' "$(REC "$E")")"
grep -Fqx '| eslint | 9.39.5 |' "$(REC "$E")" && grep -Fqx '<!-- GETFF_VERSIONS_END -->' "$(REC "$E")" \
  && ok "(E) the neighbour block is kept" || bad "(E) neighbour block lost"

# ── (J) --refresh: run-armed.sh comes with a record, a record already there is kept ─────────────
# A project installed before the record gets scripts/run-armed.sh from --refresh, and the refreshed
# pre-push hook reads it: with no record every push would stop on «no readable record».
J=$(proj "$SPA")
( cd "$J" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
rm -f "$J/scripts/run-armed.sh"
awk '/<!-- aif:project-checks:begin -->/{f=1} !f; /<!-- aif:project-checks:end -->/{f=0}' "$(REC "$J")" > "$J/.rec" && mv "$J/.rec" "$(REC "$J")"
( cd "$J" && bash "$INSTALL" react-spa --refresh < /dev/null >/dev/null 2>&1 )
[ -x "$J/scripts/run-armed.sh" ] && ok "(J) --refresh delivers scripts/run-armed.sh" || bad "(J) --refresh did not deliver run-armed.sh"
[ "$(grep -c '<!-- aif:project-checks:begin -->' "$(REC "$J")")" = 1 ] && [ -z "$(section "$J" armed)" ] \
  && grep -qx -- '- npm run lint # recorded by --refresh, not run yet: the first validate or push arms it once it exits 0' <<<"$(section "$J" not-armed)" \
  && ok "(J) --refresh on a project with no record writes one: every getff check not-armed, not run yet" \
  || bad "(J) record after --refresh: $(block "$J" 2>/dev/null | tr '\n' ';')"
( cd "$J" && bash scripts/run-armed.sh --probe >/dev/null 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && ok "(J) the refreshed record is readable (the pre-push probe exits 0)" || bad "(J) probe rc=$rc"
cp "$(REC "$A")" "$A/.rec-before"
( cd "$A" && bash "$INSTALL" react-spa --refresh < /dev/null >/dev/null 2>&1 )
cmp -s "$(REC "$A")" "$A/.rec-before" && ok "(J) --refresh keeps a record already there byte-for-byte" \
  || bad "(J) --refresh changed the record: $(diff "$A/.rec-before" "$(REC "$A")" | head -5 | tr '\n' '|')"

# ── (K) the two pre-push checks that read the project's own files are recorded too ───────────────
# scripts/check-ci-pins.sh (unpinned-tool-install) and scripts/check-doc-links.sh (lychee) need no
# dependencies, so the install runs them. Advisor (P6 blocker class), red first with the measured case:
# a project whose own workflow runs `npm install -g cowsay` pushed green before the install and red
# after it; now the check is recorded not-armed and the first push goes through.
if command -v lychee >/dev/null 2>&1; then LINKS_A='- bash scripts/check-doc-links.sh'
else LINKS_A='- bash scripts/check-doc-links.sh # lychee is not installed'; fi
recA=$(block "$A")
grep -qx -- '- bash scripts/check-ci-pins.sh' <<<"$recA" && grep -qx -- "$LINKS_A" <<<"$recA" \
  && ok "(K) a clean project: check-ci-pins armed, check-doc-links «${LINKS_A#- }»" \
  || bad "(K) record: $(block "$A" | grep -E 'ci-pins|doc-links' | tr '\n' ';')"
K=$(proj "$SPA"); BARE=$(mktemp -d); TMPS+=("$BARE"); git init -q --bare "$BARE"
mkdir -p "$K/.github/workflows"
printf 'on: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm install -g cowsay\n' > "$K/.github/workflows/own.yml"
( cd "$K" && git add -A && git commit -qm own && git checkout -qb work && git push -q "$BARE" work ); rc0=$?
( cd "$K" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 && git add -A && git -c core.hooksPath=/dev/null commit -qm getff )
grep -qx -- '- bash scripts/check-ci-pins.sh # exits 1 at install' <<<"$(section "$K" not-armed)" \
  && ok "(K) the project's own unpinned workflow: check-ci-pins recorded not-armed, exits 1 at install" \
  || bad "(K) ci-pins line: $(block "$K" | grep ci-pins)"
( cd "$K" && git push "$BARE" work ) > "$K/.push" 2>&1; rc=$?
[ "$rc0" -eq 0 ] && [ "$rc" -eq 0 ] && grep -qF '· not armed: bash scripts/check-ci-pins.sh — exits 1 at install' "$K/.push" \
  && ok "(K) the push green before the install is green after it, and says «not armed»" \
  || bad "(K) push before rc=$rc0, after rc=$rc: $(grep -E '❌|not armed: bash scripts/check-ci' "$K/.push" | head -3 | tr '\n' '|')"

# ── (M) --refresh adds a check a record from an older getff does not list ───────────────────────
# run-armed runs a command the record does not list, so without this a refreshed hook would run the
# new checks unconditionally on a project whose record predates them.
M=$(proj "$SPA")
( cd "$M" && bash "$INSTALL" react-spa < /dev/null >/dev/null 2>&1 )
grep -v -e 'check-ci-pins' -e 'check-doc-links' -e 'run-generated-rule-mutation' "$(REC "$M")" > "$M/.rec" && mv "$M/.rec" "$(REC "$M")"
( cd "$M" && bash "$INSTALL" react-spa --refresh < /dev/null >/dev/null 2>&1 )
grep -qx -- '- bash scripts/check-ci-pins.sh # recorded by --refresh, not run yet: the first validate or push arms it once it exits 0' <<<"$(section "$M" not-armed)" \
  && grep -qx -- '- bash scripts/check-doc-links.sh # recorded by --refresh, not run yet: the first validate or push arms it once it exits 0' <<<"$(section "$M" not-armed)" \
  && grep -qx -- '- bash scripts/run-generated-rule-mutation.sh # recorded by --refresh, not run yet: the first validate or push arms it once it exits 0' <<<"$(section "$M" not-armed)" \
  && grep -qx -- '- npm run lint # not run at install: dependencies are not installed' <<<"$(section "$M" not-armed)" \
  && ok "(M) --refresh adds the three missing checks not-armed and keeps the other lines" \
  || bad "(M) record after --refresh: $(block "$M" | tr '\n' ';')"

# ── (N) the generated-rule mutation check follows the generator's verdict ─────────────────────────
# P5 (N1, 4ff3c57a475): setup.d/80-rule-bootstrap.sh exports GEN_MUT_RC / GEN_MUT_WHY when it proved
# the generated rules; the arm pass reuses that verdict instead of re-running the runner. Unit arm on
# the lib.sh seam, so it holds whatever sets the variables.
MUT='bash scripts/run-generated-rule-mutation.sh'
why() { env -i PATH="$PATH" "$@" bash -c 'source "$1" >/dev/null 2>&1
  declare -F gen_mut_not_armed_why >/dev/null || { echo "MISSING: gen_mut_not_armed_why"; exit; }; gen_mut_not_armed_why' _ "$REPO_ROOT/setup.d/lib.sh"; }
[ -z "$(why GEN_MUT_RC=0)" ] && ok "(N) GEN_MUT_RC=0 → armed (no reason)" || bad "(N) rc 0 gave a reason: $(why GEN_MUT_RC=0)"
[ "$(why)" = "no generated rules this pass" ] && ok "(N) unset → «no generated rules this pass»" || bad "(N) unset: $(why)"
[ "$(why GEN_MUT_RC=1 'GEN_MUT_WHY=kill rate 40% below the 60% floor')" = "kill rate 40% below the 60% floor" ] \
  && ok "(N) a red verdict records GEN_MUT_WHY" || bad "(N) rc 1: $(why GEN_MUT_RC=1 'GEN_MUT_WHY=kill rate 40% below the 60% floor')"
[ "$(why GEN_MUT_RC=2)" = "exits 2 at install" ] && ok "(N) no GEN_MUT_WHY → «exits N at install»" || bad "(N) rc 2: $(why GEN_MUT_RC=2)"
[ "$(why GEN_MUT_RC=1 "$(printf 'GEN_MUT_WHY=a # b\nsecond line')")" = "a - b" ] \
  && ok "(N) the reason is one line with no « # » (the record's separator)" \
  || bad "(N) unsanitised: $(why GEN_MUT_RC=1 "$(printf 'GEN_MUT_WHY=a # b\nsecond line')" | tr '\n' '|')"
grep -qx -- "- $MUT # no generated rules this pass" <<<"$(section "$A" not-armed)" \
  && ok "(N) an install whose generator did not prove rules records it not-armed" \
  || bad "(N) record line: $(block "$A" | grep generated-rule-mutation)"
for t in "$REPO_ROOT/templates/ts-server/github-actions-ci.yml" "$REPO_ROOT"/packages/preset-*/templates/github-actions-ci-ui.yml; do
  grep -qx "        run: bash scripts/run-armed.sh $MUT" "$t" \
    && ok "(N) ${t#"$REPO_ROOT"/}: the CI step runs it through the record" || bad "(N) ${t#"$REPO_ROOT"/}: no run-armed step for it"
done

# ── (G) --dry-run writes nothing ────────────────────────────────────────────────────────────────
G=$(proj "$SPA")
( cd "$G" && bash "$INSTALL" react-spa --dry-run < /dev/null >/dev/null 2>&1 )
grep -q 'aif:project-checks' "$(REC "$G")" 2>/dev/null && bad "(G) --dry-run wrote the record" || ok "(G) --dry-run writes no record"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
