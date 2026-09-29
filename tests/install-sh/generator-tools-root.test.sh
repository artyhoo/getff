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
#   (F) paired negative: the project HAS ESLint → no toolchain install, no GETFF_TOOLS_ROOT
#   (G) --dry-run lists the toolchain install as one «would:» line (the tool list the one
#       pre-launch question quotes)
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
for _cand in "$REPO_ROOT" "$(cd "$REPO_ROOT/../.." 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)"; do
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
run_step() {  # $1 = npm exit code, $2 = "has-eslint" to plant ESLint in the project, $3 = DRY_RUN value; extra env via caller
  local nrc="$1" has="${2:-}" dry="${3:-}" P
  P=$(mktemp -d "$W/step.XXXX")
  mkdir -p "$P/pkg/packages/core/install" "$P/proj/.ai-factory/rules-research" "$P/bin"
  : > "$P/pkg/packages/core/install/rule-bootstrap-cli.bundle.mjs"
  echo '{}' > "$P/proj/package.json"
  echo '{}' > "$P/proj/.ai-factory/rules-research/react-spa.research.json"
  echo '{}' > "$P/proj/.ai-factory/rules-research/react-spa.selection.json"
  [ "$has" = has-eslint ] && mkdir -p "$P/proj/node_modules/eslint" && echo '{"name":"eslint","version":"9.0.0"}' > "$P/proj/node_modules/eslint/package.json" && echo 'module.exports={}' > "$P/proj/node_modules/eslint/index.js"
  # npm stub: records its args, creates <prefix>/node_modules/eslint on success.
  cat > "$P/bin/npm" <<EOF
#!/bin/sh
echo "stub npm: \$*" >> "$P/npm.log"
[ $nrc -ne 0 ] && { echo "npm error code E404" >&2; exit $nrc; }
while [ \$# -gt 0 ]; do [ "\$1" = --prefix ] && { mkdir -p "\$2/node_modules/eslint"; echo '{"version":"9.39.9"}' > "\$2/node_modules/eslint/package.json"; }; shift; done
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

echo "▶ (F) paired negative: the project has ESLint"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg3"; run_step 0 has-eslint)
grep -q 'stub npm' <<<"$_out" && bad "(F) a toolchain was installed although the project has ESLint" || ok "(F) no toolchain install"
grep -q 'stub generator: GETFF_TOOLS_ROOT=unset' <<<"$_out" && ok "(F) the generator runs on the project's own ESLint" || bad "(F) GETFF_TOOLS_ROOT set (got: $(grep 'stub generator' <<<"$_out"))"

echo "▶ (G) --dry-run"
_out=$(unset GETFF_GLOBAL; export XDG_CACHE_HOME="$W/xdg4"; run_step 0 "" --dry-run)
grep -q "would: install getff's rule-generator toolchain (eslint@^9 typescript-eslint typescript) outside the project" <<<"$_out" \
  && ok "(G) the dry run lists the toolchain install" || bad "(G) no «would: install getff's rule-generator toolchain» line"
grep -q 'stub npm' <<<"$_out" && bad "(G) the dry run ran npm" || ok "(G) the dry run installs nothing"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
