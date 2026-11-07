#!/usr/bin/env bash
# generator-tools-root.test.sh — the rule generator runs on a project with no ESLint (P5 A3).
#
# P2 K4 installs no ESLint on an oxlint or Biome project, and the prebuilt generator bundle loaded
# ESLint only from the project (or the clone's own node_modules, which a published getff clone
# does not have): measured, it died with «'eslint' is not installed in <project> … Install it (npm
# install --save-dev eslint typescript-eslint)» — no rule from research on the first rung, plus a
# manual step. Now the bundle also looks in GETFF_TOOLS_ROOT/node_modules, a getff-owned toolchain
# OUTSIDE the project, and setup.d/80-rule-bootstrap.sh provisions it when the project has none.
#
# ARMS:
#   (A) bundle, no ESLint anywhere reachable → exit ≠ 0; the message names BOTH places it looked
#       and asks no human to install anything
#   (B) bundle + GETFF_TOOLS_ROOT pointing at a real ESLint toolchain → exit 0, mode synthesis,
#       and the project gains no node_modules (fork 1 = A: the project is not touched)
#   (C) 80-rule-bootstrap.sh on a project with no ESLint: npm installs the toolchain OUTSIDE the
#       project (ranges, no pins), the generator runs with GETFF_TOOLS_ROOT set to it; without
#       --global the directory is a temp dir removed at the end
#   (D) with GETFF_GLOBAL=1 the toolchain goes to ${XDG_CACHE_HOME}/getff/generator-tools and stays
#   (E) npm fails → one NOT wired line naming the toolchain and npm's first line; the generator
#       is not run
#   (F) paired negative: the project has every module the generator loads, with ESLint 9 → no
#       toolchain install, no GETFF_TOOLS_ROOT
#   (G) --dry-run lists the toolchain install as one «would:» line (the tool list the one
#       pre-launch question quotes)
#   (H) the project has eslint but no @typescript-eslint/parser (P6 F1) → the toolchain is installed
#   (I) every module resolves but ESLint is 10 → the toolchain is installed (wrong major ≠ present)
#   (J) bundle: with GETFF_TOOLS_ROOT set, a project module the generator cannot run with is not
#       mixed into the toolchain
#   (K) parity: the step's probe names every module the bundle loads from the project
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT

# A getff clone as a consumer gets it: the tracked packages/ tree with no node_modules.
mkdir -p "$W/clone"
( cd "$REPO_ROOT" && tar --exclude node_modules -cf - packages ) | tar -xf - -C "$W/clone"
BUNDLE="$W/clone/packages/core/install/rule-bootstrap-cli.bundle.mjs"
FIX="$REPO_ROOT/packages/core/synthesizer/fixtures"
mkdir -p "$W/proj"; echo '{"name":"proj","private":true}' > "$W/proj/package.json"

# A real ESLint toolchain the test can point at: the repo's own dev install.
TOOLS=""
for _cand in "${GETFF_TEST_TOOLS_ROOT:-}" "$REPO_ROOT" "$(cd "$REPO_ROOT/../.." 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)"; do
  [ -n "$_cand" ] && [ -f "$_cand/node_modules/eslint/package.json" ] && [ -f "$_cand/node_modules/typescript-eslint/package.json" ] && { TOOLS="$_cand"; break; }
done

gen() { ( cd "$W/proj" && node "$BUNDLE" --consumer-root "$W/proj" \
  --from-research "$FIX/no-head-element.research.json" --from-selection "$FIX/no-head-element.selection.json" ) ; }

echo "▶ (A) no ESLint reachable"
_out=$(unset GETFF_TOOLS_ROOT; export NODE_PATH=; gen 2>&1); _rc=$?
[ "$_rc" -ne 0 ] && ok "(A) the generator exits non-zero" || bad "(A) expected non-zero exit (got 0)"
grep -Eq "not found in the project \([^)]*/proj\)" <<<"$_out" && grep -q 'GETFF_TOOLS_ROOT' <<<"$_out" \
  && ok "(A) the message names the project and the getff toolchain" || bad "(A) message does not name both places (got: $(grep getff: <<<"$_out" | head -1))"
grep -qi 'npm install' <<<"$_out" && bad "(A) the message still tells a human to npm install" || ok "(A) no install instruction for a human"

echo "▶ (B) toolchain outside the project"
if [ -z "$TOOLS" ]; then
  bad "(B) no ESLint toolchain in the repo's node_modules — run the repo's npm ci first (never skipped)"
else
  _out=$(export GETFF_TOOLS_ROOT="$TOOLS" NODE_PATH=; gen 2>&1); _rc=$?
  [ "$_rc" -eq 0 ] && ok "(B) the generator exits 0 with GETFF_TOOLS_ROOT" || bad "(B) exit $_rc (got: $(tail -3 <<<"$_out"))"
  grep -q '"mode": "synthesis"' <<<"$_out" && ok "(B) mode synthesis" || bad "(B) not a synthesis run"
  [ ! -e "$W/proj/node_modules" ] && ok "(B) the project got no node_modules" || bad "(B) the project gained node_modules"
fi

# ── the setup step, with stub npm/node ───────────────────────────────────────────────────────
# plant_mod <root> <name> <version>: a resolvable stand-in package under <root>/node_modules.
plant_mod() {
  local d="$1/node_modules/$2"
  mkdir -p "$d"
  printf '{"name":"%s","version":"%s","main":"index.js"}\n' "$2" "$3" > "$d/package.json"
  echo 'module.exports={}' > "$d/index.js"
  [ "$2" != eslint ] || echo 'module.exports={}' > "$d/use-at-your-own-risk.js"
}
# plant_toolchain <root> <eslint version>: every module the generator bundle loads from a project.
plant_toolchain() {
  plant_mod "$1" eslint "$2"; plant_mod "$1" typescript-eslint 8.71.0
  plant_mod "$1" @typescript-eslint/parser 8.71.0; plant_mod "$1" @typescript-eslint/utils 8.71.0
  plant_mod "$1" typescript 5.9.3
  plant_mod "$1" ts-morph 28.0.0; echo 'module.exports={SyntaxKind:{SourceFile:307},Project:function(){this.createSourceFile=function(){return {getKind:function(){return 307},getExportAssignments:function(){return [{}]}}}}}' > "$1/node_modules/ts-morph/index.js"
  plant_mod "$1" tsx 4.23.0
  mkdir -p "$1/node_modules/.bin"; printf '#!/bin/sh\nexit 0\n' > "$1/node_modules/.bin/tsx"; chmod +x "$1/node_modules/.bin/tsx"
}
run_step() {  # $1 = npm exit code, $2 = what the project has (""|has-eslint|full9|full10), $3 = DRY_RUN value; extra env via caller
  local nrc="$1" has="${2:-}" dry="${3:-}" P
  P=$(mktemp -d "$W/step.XXXX")
  mkdir -p "$P/pkg/packages/core/install" "$P/proj/.ai-factory/rules-research" "$P/bin"
  : > "$P/pkg/packages/core/install/rule-bootstrap-cli.bundle.mjs"
  echo '{"scripts":{"lint":"oxlint ."}}' > "$P/proj/package.json"
  echo '{}' > "$P/proj/.ai-factory/rules-research/react-spa.research.json"
  echo '{}' > "$P/proj/.ai-factory/rules-research/react-spa.selection.json"
  case "$has" in
    has-eslint) plant_mod "$P/proj" eslint 9.0.0 ;;               # eslint alone (P6 F1: pulled in by @typescript-eslint/utils)
    full9) plant_toolchain "$P/proj" 9.39.9 ;;                   # everything the generator loads, the major getff installs
    broken-tsx) plant_toolchain "$P/proj" 9.39.9; printf '#!/bin/sh\nexit 17\n' > "$P/proj/node_modules/.bin/tsx" ;;
    full9-arrow) plant_toolchain "$P/proj" 9.39.9; echo 'exports.Project=()=>({});exports.SyntaxKind={};' > "$P/proj/node_modules/ts-morph/index.js" ;;
    full10) plant_toolchain "$P/proj" 10.11.0 ;;                 # everything, but an ESLint major getff does not install
  esac
  plant_toolchain "$P/installed" 9.39.9
  [ "$has" != bad-editor-cache ] || echo 'exports.Project=()=>({});exports.SyntaxKind={};' > "$P/installed/node_modules/ts-morph/index.js"
  local copy_tools="cp -R \"$P/installed/node_modules/.\" \"\$2/node_modules/\""
  [ "$has" != bad-cache ] || copy_tools=:
  # npm stand-in tests provisioning branches only; real runtime tests below never use it.
  cat > "$P/bin/npm" <<EOF
#!/bin/sh
echo "stub npm: \$*" >> "$P/npm.log"
[ $nrc -ne 0 ] && { echo "npm error code E404" >&2; exit $nrc; }
while [ \$# -gt 0 ]; do [ "\$1" = --prefix ] && { mkdir -p "\$2/node_modules/eslint"; echo '{"version":"9.39.9"}' > "\$2/node_modules/eslint/package.json"; $copy_tools; }; shift; done
exit 0
EOF
  # node stub: the generator stand-in reports GETFF_TOOLS_ROOT; real node for anything else.
  local realnode; realnode=$(command -v node)
  cat > "$P/bin/node" <<EOF
#!/bin/sh
case "\$1" in *rule-bootstrap-cli.bundle.mjs) echo "stub generator: GETFF_TOOLS_ROOT=\${GETFF_TOOLS_ROOT:-unset}"; [ -n "\${GETFF_TOOLS_ROOT:-}" ] && [ -d "\$GETFF_TOOLS_ROOT/node_modules/eslint" ] && echo "stub generator: tools present"; exit 0 ;; esac
exec "$realnode" "\$@"
EOF
  chmod +x "$P/bin/npm" "$P/bin/node"
  (
    PATH="$P/bin:$PATH"; FULL=--full; DRY_RUN="$dry"; STACK=react-spa
    PKG_ROOT="$P/pkg"; PROJECT_ROOT="$P/proj"; NOT_WIRED=()
    # shellcheck disable=SC1090
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    # the record helper (engine.sh on the joined tree): print the row's read-from column
    companion_record_version() { echo "RECORD: $1 $2 read-from=$4"; }
    # shellcheck disable=SC1090
    source "$REPO_ROOT/setup.d/80-rule-bootstrap.sh"; echo "LAYER_RC=$?"
    echo "NOT_WIRED_COUNT=${#NOT_WIRED[@]}"
    [ "${#NOT_WIRED[@]}" -gt 0 ] && printf 'NOT_WIRED: %s\n' "${NOT_WIRED[@]}"
  ) 2>&1
  echo "NPM_LOG:"; cat "$P/npm.log" 2>/dev/null
  [ -e "$P/proj/node_modules/.bin" ] && echo "PROJECT_TOUCHED"
}

echo "▶ (C) step, no ESLint in the project, no --global"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg"; run_step 0)
grep -Eq 'stub npm: install --prefix [^ ]+ .*eslint@\^9' <<<"$_out" && ok "(C) npm installs eslint@^9 with --prefix (a range, not a pin)" || bad "(C) expected 'npm install --prefix <dir> … eslint@^9' (got: $(grep 'stub npm' <<<"$_out"))"
_dir=$(sed -n 's/.*stub npm: install --prefix \([^ ]*\) .*/\1/p' <<<"$_out" | head -1)
case "$_dir" in "$W"/step.*/proj*) bad "(C) the toolchain was installed inside the project ($_dir)";; *) ok "(C) the toolchain directory is outside the project";; esac
grep -q "stub generator: GETFF_TOOLS_ROOT=$_dir" <<<"$_out" && grep -q 'stub generator: tools present' <<<"$_out" \
  && ok "(C) the generator ran with GETFF_TOOLS_ROOT = that directory" || bad "(C) generator not pointed at the toolchain (got: $(grep 'stub generator' <<<"$_out"))"
[ -n "$_dir" ] && [ ! -e "$_dir" ] && ok "(C) without --global the temp toolchain is removed at the end" || bad "(C) temp toolchain left behind: $_dir"
grep -q 'PROJECT_TOUCHED' <<<"$_out" && bad "(C) the project gained node_modules/.bin" || ok "(C) the project's node_modules untouched"

echo "▶ (D) step with GETFF_GLOBAL=1"
_out=$(export GETFF_GLOBAL=1 XDG_CACHE_HOME="$W/xdg"; run_step 0)
grep -q "stub npm: install --prefix $W/xdg/getff/generator-tools " <<<"$_out" && ok "(D) --global installs into \$XDG_CACHE_HOME/getff/generator-tools" || bad "(D) wrong prefix (got: $(grep 'stub npm' <<<"$_out"))"
[ -d "$W/xdg/getff/generator-tools/node_modules/eslint" ] && ok "(D) the cached toolchain stays for the next run" || bad "(D) the cached toolchain was removed"

echo "▶ (E) npm fails"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg2"; run_step 1)
grep -q 'NOT_WIRED_COUNT=1' <<<"$_out" && ok "(E) one NOT wired line" || bad "(E) expected 1 NOT wired line (got: $(grep NOT_WIRED <<<"$_out"))"
grep -q "NOT_WIRED: generated rules — the generator's ESLint toolchain could not be installed: npm error code E404" <<<"$_out" \
  && ok "(E) the line names the toolchain and npm's first line" || bad "(E) NOT wired line lacks npm's reason"
grep -q 'stub generator' <<<"$_out" && bad "(E) the generator ran without its toolchain" || ok "(E) the generator is not run"
grep -q 'LAYER_RC=0' <<<"$_out" && ok "(E) the layer still returns 0" || bad "(E) layer rc ≠ 0"

echo "▶ (F) paired negative: the project has every module the generator loads, ESLint 9"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg3"; run_step 0 full9)
grep -q 'stub npm' <<<"$_out" && bad "(F) a toolchain was installed although the project has the generator's toolchain" || ok "(F) no toolchain install"
grep -q 'stub generator: GETFF_TOOLS_ROOT=unset' <<<"$_out" && ok "(F) the generator runs on the project's own ESLint" || bad "(F) GETFF_TOOLS_ROOT set (got: $(grep 'stub generator' <<<"$_out"))"

# P6 F1 (2026-09-30, create-vite react-ts): getff's own @typescript-eslint/utils pulled eslint 10 into
# the project with no parser; a probe that asked only for `eslint` skipped the toolchain and the
# generator died on the missing '@typescript-eslint/parser' — 0 of 6 researched rules.
echo "▶ (H) the project has eslint but not the parser → the toolchain is installed"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg5"; run_step 0 has-eslint)
grep -Eq 'stub npm: install --prefix [^ ]+ .*eslint@\^9' <<<"$_out" && ok "(H) npm installs the toolchain" || bad "(H) no toolchain install (got: $(grep -E 'stub npm|80-rule-bootstrap' <<<"$_out" | head -3))"
grep -q 'stub generator: tools present' <<<"$_out" && ok "(H) the generator runs on the toolchain" || bad "(H) generator not pointed at the toolchain (got: $(grep 'stub generator' <<<"$_out"))"
grep -q "'@typescript-eslint/parser' does not resolve" <<<"$_out" && ok "(H) the install line names the missing module" || bad "(H) the reason does not name the parser (got: $(grep '80-rule-bootstrap' <<<"$_out" | head -2))"
# (M) P6 run 2 N1: the push-time mutation check needs the same parser, so a project that has node_modules
# keeps the toolchain in node_modules/.cache (skipped by git, linters, prettier, tsc, test runners), not a temp dir.
_dir=$(sed -n 's/.*stub npm: install --prefix \([^ ]*\) .*/\1/p' <<<"$_out" | head -1)
case "$_dir" in "$W"/step.*/proj/node_modules/.cache/getff/generator-tools) ok "(M) the toolchain goes to the project's node_modules/.cache/getff/generator-tools";;
  *) bad "(M) expected <proj>/node_modules/.cache/getff/generator-tools (got: $_dir)";; esac
[ -n "$_dir" ] && [ -d "$_dir/node_modules/eslint" ] && ok "(M) it stays after the step, for the push-time check" || bad "(M) the toolchain was removed: $_dir"
[ -f "$_dir/.complete" ] && ok "(M) a finished install leaves the completion marker the push-time check trusts" || bad "(M) no .complete marker in $_dir"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg7"; run_step 1 has-eslint)
_dir=$(sed -n 's/.*stub npm: install --prefix \([^ ]*\) .*/\1/p' <<<"$_out" | head -1)
[ -n "$_dir" ] && [ ! -f "$_dir/.complete" ] && ok "(M) a failed install leaves no completion marker" || bad "(M) marker after a failed npm (dir: $_dir)"
[ "$(cat "${_dir%/node_modules/.cache/getff/generator-tools}/package.json" 2>/dev/null)" = '{"scripts":{"lint":"oxlint ."}}' ] && ok "(M) the project's package.json is unchanged" || bad "(M) package.json changed"

# (N) P6 run 4 N11: the record (.ai-factory/tool-decisions.md) is committed, and its generator-tool rows
# carried this machine's absolute path to the toolchain. A toolchain inside the project is recorded
# relative to the project root; one outside it (the user cache under --global) has no project-relative path.
echo "▶ (N) the record names the toolchain relative to the project"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg8"; run_step 0 has-eslint)
grep -q '^RECORD: eslint generator-tool read-from=node_modules/.cache/getff/generator-tools/node_modules/eslint/package.json$' <<<"$_out" \
  && ok "(N) the eslint row reads node_modules/.cache/getff/generator-tools/node_modules/eslint/package.json" \
  || bad "(N) expected a project-relative read-from (got: $(grep '^RECORD: eslint' <<<"$_out"))"
grep -q "^RECORD: .*read-from=$W" <<<"$_out" && bad "(N) a row still carries the machine path $W" || ok "(N) no row carries the machine path"
_out=$(export GETFF_GLOBAL=1 XDG_CACHE_HOME="$W/xdg9"; run_step 0 "")
grep -q "^RECORD: eslint generator-tool read-from=$W/xdg9/getff/generator-tools/node_modules/eslint/package.json$" <<<"$_out" \
  && ok "(N) paired: a toolchain outside the project keeps its full path" \
  || bad "(N) the --global row lost its path (got: $(grep '^RECORD: eslint' <<<"$_out"))"

echo "▶ (I) every module resolves, but ESLint 10 → the toolchain is installed (wrong major is not «present»)"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg6"; run_step 0 full10)
grep -Eq 'stub npm: install --prefix [^ ]+ .*eslint@\^9' <<<"$_out" && ok "(I) npm installs the toolchain" || bad "(I) no toolchain install (got: $(grep -E 'stub npm|80-rule-bootstrap' <<<"$_out" | head -3))"
grep -q 'eslint 10.11.0 is not 9.x' <<<"$_out" && ok "(I) the install line names the version and the major it needs" || bad "(I) the reason does not name the version (got: $(grep '80-rule-bootstrap' <<<"$_out" | head -2))"

echo "▶ (J) bundle: GETFF_TOOLS_ROOT wins over a project ESLint the generator cannot run with"
if [ -z "$TOOLS" ]; then
  bad "(J) no ESLint toolchain in the repo's node_modules — run the repo's npm ci first (never skipped)"
else
  rm -rf "$W/proj/node_modules"; plant_mod "$W/proj" eslint 10.11.0   # resolves, but is no ESLint the generator can load
  _out=$(export GETFF_TOOLS_ROOT="$TOOLS" NODE_PATH=; gen 2>&1); _rc=$?
  [ "$_rc" -eq 0 ] && grep -q '"mode": "synthesis"' <<<"$_out" && ok "(J) the whole toolchain comes from GETFF_TOOLS_ROOT (exit 0, synthesis)" \
    || bad "(J) exit $_rc — the project's module was mixed in (got: $(tail -3 <<<"$_out"))"
  rm -rf "$W/proj/node_modules"
fi

echo "▶ (K) the step's probe asks for every module the bundle loads from the project"
_ids=$(node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");const b=s.slice(s.indexOf("name: '"'"'rule generator'"'"'"));const i=b.indexOf("fromProject:");const f=b.slice(i,b.indexOf("],",i));console.log([...f.matchAll(/id: '"'"'([^'"'"']+)'"'"'/g)].map(m=>m[1]).join(" "))' "$REPO_ROOT/scripts/build-runtime-bundles.mjs")
[ -n "$_ids" ] || bad "(K) no fromProject ids read from scripts/build-runtime-bundles.mjs"
for _id in $_ids; do
  grep -q "\['$_id'" "$REPO_ROOT/setup.d/80-rule-bootstrap.sh" && ok "(K) probe asks for $_id" || bad "(K) the probe in setup.d/80-rule-bootstrap.sh does not ask for $_id"
done

echo "▶ (L) the mutation runner provisions the same toolchain the step installs"
_pk() { grep -E "^$1=\(" "$2" | head -1 | sed -E "s/^$1=\((.*)\).*/\1/"; }
_step_pkgs=$(_pk _rb_tool_pkgs "$REPO_ROOT/setup.d/80-rule-bootstrap.sh")
_run_pkgs=$(_pk GEN_TOOL_PKGS "$REPO_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh")
[ -n "${_step_pkgs}" ] && [ "${_step_pkgs}" = "${_run_pkgs}" ] && ok "(L) both install: ${_step_pkgs}" \
  || bad "(L) step installs «${_step_pkgs}», the runner provisions «${_run_pkgs}»"
grep -q 'node_modules/.cache/getff/generator-tools' "$REPO_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh" \
  && grep -q 'node_modules/.cache/getff/generator-tools' "$REPO_ROOT/setup.d/80-rule-bootstrap.sh" \
  && ok "(L) both use node_modules/.cache/getff/generator-tools" || bad "(L) the step and the runner keep the toolchain in different places"

echo "▶ (G) --dry-run"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg4"; run_step 0 "" --dry-run)
grep -q "would: install getff's rule-generator toolchain (eslint@^9 typescript-eslint typescript tsx ts-morph), no package.json key, into " <<<"$_out" \
  && ok "(G) the dry run lists the toolchain install" || bad "(G) no «would: install getff's rule-generator toolchain» line"
grep -q 'stub npm' <<<"$_out" && bad "(G) the dry run ran npm" || ok "(G) the dry run installs nothing"

# (P/Q) Real runtime regressions: no project tsx/ts-morph, complete persistent cache.
# The cache uses actual installed libraries; no executable/module stand-ins in these arms.
echo "▶ (P) installed non-git mutation resolves tsx from its persistent cache"
_P="$W/runtime consumer with spaces"
mkdir -p "$_P/scripts" "$_P/node_modules/.cache/getff/generator-tools" "$_P/.ai-factory/synthesizer-output"
printf '%s' '{"name":"runtime-consumer","private":true}' > "$_P/package.json"
cp "$REPO_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh" "$_P/scripts/"
cat > "$_P/.ai-factory/synthesizer-output/rules-manifest-additions.json" <<'JSON'
{"G1":{"check":{"type":"declarative","selector":"ThrowStatement > CallExpression[callee.name='error']"},"negative-test":{"input":["import { error } from '@sveltejs/kit'; function page(): never { throw error(404, 'missing'); }"]}}}
JSON
if [ -n "$TOOLS" ] && [ -x "$TOOLS/node_modules/.bin/tsx" ] && [ -f "$TOOLS/node_modules/ts-morph/package.json" ]; then
  ln -s "$TOOLS/node_modules" "$_P/node_modules/.cache/getff/generator-tools/node_modules"
  : > "$_P/node_modules/.cache/getff/generator-tools/.complete"
  _before=$(shasum -a 256 "$_P/package.json")
  # Bound this owned fixture away from an incidental enclosing Git checkout.
  env -u GIT_DIR -u GIT_WORK_TREE GIT_CEILING_DIRECTORIES="$W" git -C "$_P" rev-parse --show-toplevel >/dev/null 2>&1 \
    && bad "(P) fixture unexpectedly has a Git root" || ok "(P) fixture is genuinely non-git"
  mkdir -p "$_P/nested cwd with spaces"
  _out=$(cd "$_P/nested cwd with spaces" && env -u GETFF_TOOLS_ROOT -u GIT_DIR -u GIT_WORK_TREE \
    GIT_CEILING_DIRECTORIES="$W" bash ../scripts/run-generated-rule-mutation.sh 2>&1); _rc=$?
  [ "$_rc" -eq 0 ] && grep -Eq 'overall: kill=[1-9][0-9]*/[1-9][0-9]* .*skipped=0 floor=60%' <<<"$_out" \
    && ok "(P) real TS selector mutations execute without project tsx" || bad "(P) exit $_rc: $(tail -3 <<<"$_out")"
  [ "$(shasum -a 256 "$_P/package.json")" = "$_before" ] && ok "(P) original manifest stays byte-identical" || bad "(P) manifest changed"
  # A valid unrelated cwd manifest must not hide a missing installed-project manifest.
  _manifest="$_P/.ai-factory/synthesizer-output/rules-manifest-additions.json"
  _wrong="$W/unrelated project with spaces"
  mkdir -p "$_wrong/.ai-factory/synthesizer-output"
  printf '{}\n' > "$_wrong/.ai-factory/synthesizer-output/rules-manifest-additions.json"
  mv "$_manifest" "$_manifest.saved"
  _out=$(cd "$_wrong" && env -u GETFF_TOOLS_ROOT -u GIT_DIR -u GIT_WORK_TREE \
    GIT_CEILING_DIRECTORIES="$W" bash "$_P/scripts/run-generated-rule-mutation.sh" 2>&1); _rc=$?
  [ "$_rc" -eq 2 ] && grep -Fq "manifest not found: $_manifest" <<<"$_out" \
    && ok "(P) wrong cwd cannot substitute its manifest" || bad "(P) wrong-root/missing-manifest exit $_rc: $_out"
  mv "$_manifest.saved" "$_manifest"
  echo "▶ (Q) own-config AST editor resolves from validated cache without leaking NODE_PATH"
  _out=$(
    PROJECT_ROOT="$_P"; PKG_ROOT="$REPO_ROOT"; NODE_PATH=keep-user-value
    source "$REPO_ROOT/setup.d/eslint-wire.sh"
    _ts_morph_available || exit 1
    [ "$NODE_PATH" = keep-user-value ] || exit 2
    [ "$_GETFF_TS_MORPH_NODE_PATH" = "$_P/node_modules/.cache/getff/generator-tools/node_modules" ] || exit 3
    cd "$_P"
    NODE_PATH="$_GETFF_TS_MORPH_NODE_PATH" node --input-type=module - <<'JS'
import {createRequire} from 'node:module';import {resolve} from 'node:path';
const p=createRequire(resolve(process.cwd(),'package.json')).resolve('ts-morph');
const m=await import(p);if(typeof m.Project!=='function')process.exit(1);console.log('REAL_AST_EDITOR_LOADED');
JS
  ); _rc=$?
  [ "$_rc" -eq 0 ] && grep -q REAL_AST_EDITOR_LOADED <<<"$_out" && ok "(Q) real cache-backed AST resolver with child-only NODE_PATH" || bad "(Q) exit $_rc: $_out"
else
  bad "(P/Q) real ESLint/parser/tsx/ts-morph toolchain required, never skipped"
fi

echo "▶ (R) npm success with incomplete tools is not a completion marker"
_out=$(unset GETFF_GLOBAL; run_step 0 bad-cache); _rc=$?
_dir=$(sed -n 's/.*stub npm: install --prefix \([^ ]*\) .*/\1/p' <<<"$_out" | head -1)
[ -n "$_dir" ] && [ ! -f "$_dir/.complete" ] && grep -q 'toolchain.*not usable' <<<"$_out" \
  && ok "(R) incomplete successful npm output is rejected, never marked complete" || bad "(R) incomplete tools accepted: $_out"

echo "▶ (S) an executable but broken tsx is not a usable project toolchain"
_out=$(unset GETFF_GLOBAL; run_step 0 broken-tsx)
grep -q 'stub npm: install --prefix' <<<"$_out" && grep -q 'tsx.*not usable' <<<"$_out" \
  && ok "(S) failing runtime binary triggers owned-cache provisioning" || bad "(S) broken runtime binary accepted"

echo "▶ (T) a hanging mutation tsx probe is bounded and rejected"
_T="$W/hanging-tools"
mkdir -p "$_T/.bin"
cat > "$_T/.bin/tsx" <<'JS'
#!/usr/bin/env node
setInterval(() => {}, 1000);
JS
chmod +x "$_T/.bin/tsx"
# Exercise the runner's actual admission function, not a duplicate probe.
_func=$(sed -n '/^_has_set() {/,/^NM_SRC=/p' "$REPO_ROOT/packages/core/synthesizer/run-generated-rule-mutation.sh" | sed '$d')
_out=$(GETFF_PROBE_FUNCTION="$_func" GETFF_PROBE_ROOT="$_T" node - <<'JS'
const {spawnSync}=require('node:child_process');
const r=spawnSync('bash',['-c',process.env.GETFF_PROBE_FUNCTION+'\n_has_set "$GETFF_PROBE_ROOT"'],{env:process.env,stdio:'ignore',timeout:15000});
if(r.error || r.status!==1)process.exit(1);
JS
); _rc=$?
[ "$_rc" -eq 0 ] && ok "(T) hanging binary rejected within bounded admission" || bad "(T) runtime admission hangs past budget"

echo "▶ (U) actual core callers reject invalid selection and use validated cache"
_out=$(GETFF_TEST_TOOLS_ROOT="$TOOLS" GETFF_CONTROL_SCRATCH="$W/" node --input-type=module - "$REPO_ROOT/packages/core/install/wire-eslint-r2.ts" <<'JS'
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {pathToFileURL} from 'node:url';
const modulePath=process.argv[2];const tools=process.env.GETFF_TEST_TOOLS_ROOT||'/Users/art/code/rules-as-tests-aif';
const core=await import(pathToFileURL(resolve(modulePath)).href);
const w=mkdtempSync(join(process.env.GETFF_CONTROL_SCRATCH||tmpdir(),'getff-core-controls-'));
const oldCwd=process.cwd(),oldSelector=process.env.GETFF_AST_TOOLS_ROOT,oldNodePath=process.env.NODE_PATH;
let pass=0,fail=0;
const check=(v,name,detail='')=>{console.log(`${v?'PASS':'FAIL'} ${name} ${detail}`);v?pass++:fail++;};
const project=join(w,'project');mkdirSync(join(project,'node_modules'),{recursive:true});writeFileSync(join(project,'package.json'),'{}');process.chdir(project);
const plain='export default [{ rules: {} }];\n';const r2=core.R2_RULE_ID;
const comment=`// '${r2}' is documentation only\n${plain}`;
const ncomment=`// 'no-console' is documentation only\n${plain}`;
const both=async(root,label,source=comment,nsource=ncomment)=>{process.env.GETFF_AST_TOOLS_ROOT=root;const a=await core.wireConfigSource(source);const b=await core.wireNRules(nsource,{'no-console':'error'});check(a.status==='degrade'&&a.modified===source,`${label} wireConfigSource`,a.status);check(b.status==='degrade'&&b.modified===nsource,`${label} wireNRules`,b.status);};
try{
 await both(join(w,'absent'),'invalid explicit comment-only');
 for(const selector of [undefined,'']){if(selector===undefined)delete process.env.GETFF_AST_TOOLS_ROOT;else process.env.GETFF_AST_TOOLS_ROOT=selector;const a=await core.wireConfigSource(comment),b=await core.wireNRules(ncomment,{'no-console':'error'});check(a.status==='already-wired'&&b.status==='already-wired',`legacy ${selector===undefined?'no':'empty'} selector`);}
 const valid=join(w,'valid-cache');mkdirSync(valid);writeFileSync(join(valid,'.complete'),'');symlinkSync(join(tools,'node_modules'),join(valid,'node_modules'),'dir');
 mkdirSync(join(project,'node_modules','ts-morph'));writeFileSync(join(project,'node_modules','ts-morph','package.json'),'{"name":"ts-morph","main":"index.js"}');writeFileSync(join(project,'node_modules','ts-morph','index.js'),'exports.Project=()=>({});exports.SyntaxKind={};');
 process.env.GETFF_AST_TOOLS_ROOT=valid;const a=await core.wireConfigSource(plain),b=await core.wireNRules(plain,{'no-console':'error'}),c=await core.wireOwnConfig(plain,{ignores:['scripts/owned-tool.bundle.mjs']});check(a.status==='wired','invalid local -> valid cache normal',a.status);check(b.status==='wired','invalid local -> valid cache synthesized',b.status);check(c.status==='wired','invalid local -> valid cache own config',c.status);
 const symlinkRoot=join(w,'symlink-root');symlinkSync(valid,symlinkRoot,'dir');process.env.GETFF_AST_TOOLS_ROOT=symlinkRoot;check((await core.wireNRules(plain,{'no-console':'error'})).status==='wired','legitimate symlink root');
 const unusable=join(w,'unusable-cache');mkdirSync(join(unusable,'node_modules','ts-morph'),{recursive:true});writeFileSync(join(unusable,'.complete'),'');writeFileSync(join(unusable,'node_modules','ts-morph','package.json'),'{"main":"index.js"}');for(const [name,code] of [['arrow','exports.Project=()=>({});exports.SyntaxKind={};'],['throwing','exports.Project=function(){throw new Error("bad editor")};exports.SyntaxKind={};'],['nonfunctional','exports.Project=function(){};exports.SyntaxKind={};']]){const candidate=join(w,'unusable-'+name);mkdirSync(join(candidate,'node_modules','ts-morph'),{recursive:true});writeFileSync(join(candidate,'.complete'),'');writeFileSync(join(candidate,'node_modules','ts-morph','package.json'),'{"main":"index.js"}');writeFileSync(join(candidate,'node_modules','ts-morph','index.js'),code);await both(candidate,`unusable ${name} selected editor`);const own=await core.wireOwnConfig(plain,{ignores:['probe.js']});check(own.status==='degrade'&&own.modified===plain,`unusable ${name} selected editor own-config`,own.status);}

 // Ancestor contains a valid editor, selected completed child root is empty.
 rmSync(join(project,'node_modules','ts-morph'),{recursive:true});symlinkSync(join(tools,'node_modules','ts-morph'),join(project,'node_modules','ts-morph'),'dir');
 const empty=join(project,'node_modules','.cache','getff','empty');mkdirSync(join(empty,'node_modules'),{recursive:true});writeFileSync(join(empty,'.complete'),'');await both(empty,'ancestor editor bleed');
 const outside=join(w,'outside-entry');mkdirSync(join(outside,'node_modules'),{recursive:true});writeFileSync(join(outside,'.complete'),'');symlinkSync(join(tools,'node_modules','ts-morph'),join(outside,'node_modules','ts-morph'),'dir');await both(outside,'outside entry symlink');
 delete process.env.GETFF_AST_TOOLS_ROOT;check((await core.wireNRules(plain,{'no-console':'error'})).status==='wired','valid local no-selector transform');
}finally{process.chdir(oldCwd);if(oldSelector===undefined)delete process.env.GETFF_AST_TOOLS_ROOT;else process.env.GETFF_AST_TOOLS_ROOT=oldSelector;if(oldNodePath===undefined)delete process.env.NODE_PATH;else process.env.NODE_PATH=oldNodePath;rmSync(w,{recursive:true,force:true});}
console.log(`PASS=${pass} FAIL=${fail}`);process.exitCode=fail?1:0;
JS
); _rc=$?
[ "$_rc" -eq 0 ] && ok "(U) actual core selection/comment/symlink/legacy controls" || bad "(U) exit $_rc: $_out"

echo "▶ (V) invalid local AST module selects owned cache only for wirer children"
mkdir -p "$_P/node_modules/ts-morph"
printf '{"name":"ts-morph","main":"index.js"}' > "$_P/node_modules/ts-morph/package.json"
printf 'exports.Project=()=>({});exports.SyntaxKind={};' > "$_P/node_modules/ts-morph/index.js"
_out=$(
  PROJECT_ROOT="$_P"; NODE_PATH=keep-user-value; GETFF_AST_TOOLS_ROOT=keep-user-selector
  source "$REPO_ROOT/setup.d/eslint-wire.sh"
  _ts_morph_available || exit 1
  [ "$NODE_PATH" = keep-user-value ] && [ "$GETFF_AST_TOOLS_ROOT" = keep-user-selector ] || exit 2
  [ "$_GETFF_AST_TOOLS_ROOT" = "$_P/node_modules/.cache/getff/generator-tools" ] || exit 3
); _rc=$?
[ "$_rc" -eq 0 ] && ok "(V) selected cache bypasses broken project and preserves caller environment" || bad "(V) cache selection/caller environment failed: $_rc"

echo "▶ (W) complete other tools plus nonconstructible local editor provisions owned cache"
_out=$(unset GETFF_GLOBAL; run_step 0 full9-arrow)
grep -q 'stub npm: install --prefix' <<<"$_out" && grep -q 'ts-morph AST editor is not usable' <<<"$_out" \
  && ok "(W) nonconstructible project editor triggers owned provisioning" || bad "(W) bad Project skipped provisioning"
echo "▶ (X) npm success with nonconstructible cached editor is not complete"
_out=$(unset GETFF_GLOBAL; run_step 0 bad-editor-cache)
_dir=$(sed -n 's/.*stub npm: install --prefix \([^ ]*\) .*/\1/p' <<<"$_out" | head -1)
[ -n "$_dir" ] && [ ! -f "$_dir/.complete" ] && grep -q 'toolchain.*not usable' <<<"$_out" \
  && ok "(X) nonconstructible installed cache remains unmarked" || bad "(X) bad cached Project was marked complete"

echo "▶ (Y) managed and workspace wiring callers select the completed editor cache"
for _layout in managed workspace; do
  _Y="$W/caller $_layout with spaces"
  mkdir -p "$_Y/node_modules/.cache/getff/generator-tools" "$_Y/.ai-factory/synthesizer-output"
  printf '{"name":"caller","private":true,"workspaces":["apps/*"]}\n' > "$_Y/package.json"
  ln -s "$TOOLS/node_modules" "$_Y/node_modules/.cache/getff/generator-tools/node_modules"
  : > "$_Y/node_modules/.cache/getff/generator-tools/.complete"
  if [ "$_layout" = managed ]; then
    _cfg="$_Y/eslint.config.mjs"
  else
    mkdir -p "$_Y/apps/api"
    printf '{"name":"api","dependencies":{"hono":"^4.0.0"},"devDependencies":{"typescript":"^5.4.0"}}\n' > "$_Y/apps/api/package.json"
    _cfg="$_Y/apps/api/eslint.config.mjs"
  fi
  printf 'export default [];\n' > "$_cfg"
  printf '{"no-alert":"error"}\n' > "$_Y/.ai-factory/synthesizer-output/eslint-rules-snippet.json"
  _out=$(
    unset GETFF_TOOLS_ROOT GETFF_AST_TOOLS_ROOT NODE_PATH
    PROJECT_ROOT="$_Y"; PKG_ROOT="$REPO_ROOT"; DRY_RUN=""; STACK=ts-server; SKIPPED=(); GETFF_ADDED_TO=()
    source "$REPO_ROOT/setup.d/lib.sh"
    if [ "$_layout" = managed ]; then refresh_baseline_stage "$_cfg"; fi
    source "$REPO_ROOT/setup.d/eslint-wire.sh"
    eslint_wire_synth
    [ "$_GETFF_AST_TOOLS_ROOT" = "$_Y/node_modules/.cache/getff/generator-tools" ] || exit 1
    grep -Eq "['\"]no-alert['\"][[:space:]]*:" "$_cfg" || exit 2
    [ -z "${GETFF_AST_TOOLS_ROOT+x}" ] && [ -z "${NODE_PATH+x}" ] || exit 3
    GETFF_TEST_LINT_CFG="$_cfg" GETFF_TEST_LINT_TOOLS="$TOOLS" node --input-type=module - <<'JS'
import {createRequire} from 'node:module';import {resolve,dirname,join} from 'node:path';import {realpathSync} from 'node:fs';
const {ESLint}=createRequire(resolve(process.env.GETFF_TEST_LINT_TOOLS,'package.json'))('eslint');
const cfg=realpathSync(process.env.GETFF_TEST_LINT_CFG),cwd=dirname(cfg),filePath=join(cwd,'probe.js');
const lint=new ESLint({cwd,overrideConfigFile:cfg});
const bad=await lint.lintText('alert(1);\n',{filePath});
if(!bad[0].messages.some(m=>m.ruleId==='no-alert'))throw new Error('wired rule did not fire');
const good=await lint.lintText('export const value = 1;\n',{filePath});
if(good[0].messages.some(m=>m.ruleId==='no-alert'))throw new Error('wired rule overfired');
JS
  ); _rc=$?
  [ "$_rc" -eq 0 ] && ok "(Y) $_layout real wirer selects cache without caller overrides" || bad "(Y) $_layout exit $_rc: $_out"
done

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
