#!/usr/bin/env bash
# Issue #1842: exercise the real installer up to its PM calls using logging package managers.
# This is an argv/placement test, not proof that real registry packages load.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
TMP=$(mktemp -d)
TMP=$(cd "$TMP" && pwd -P)
trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/bin"
for pm in npm pnpm; do
  cat > "$TMP/bin/$pm" <<'PM'
#!/usr/bin/env bash
printf '%s|%s|%s\n' "${0##*/}" "$PWD" "$*" >> "$ISSUE_1842_PM_LOG"
if [ "${0##*/}" = pnpm ] && [ "$*" = '--recursive list --depth -1 --json' ]; then
  [ "${ISSUE_1842_LIST_FAIL:-}" != 1 ] || exit 7
  printf '%s\n' "${ISSUE_1842_MEMBERS:-[]}"
fi
case "$*" in
  *"--filter ./apps/${ISSUE_1842_FAIL_FILTER:-__none__}"*) exit 1 ;;
esac
if [ -n "${ISSUE_1842_FAIL_CWD:-}" ] && [ "$PWD" = "$ISSUE_1842_FAIL_CWD" ] && [ "${1:-}" = add ]; then exit 1; fi
exit 0
PM
  chmod +x "$TMP/bin/$pm"
done
export PATH="$TMP/bin:$PATH"
PASS=0; FAIL=0
ok() { PASS=$((PASS+1)); printf '  ✓ %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  ✗ %s\n' "$1"; }
make_fixture() {
  local dir="$1" root="$2" pm="$3"
  mkdir -p "$dir"
  printf '%s\n' "$root" > "$dir/package.json"
  if [ "$pm" = pnpm ]; then printf 'packages:\n  - "apps/*"\n' > "$dir/pnpm-workspace.yaml"; fi
  git -C "$dir" init -q
}
add_mobile() {
  local dir="$1" flavor="$2"
  mkdir -p "$dir/apps/api" "$dir/apps/mobile"
  printf '{"name":"api","devDependencies":{"typescript":"5.6.0"}}\n' > "$dir/apps/api/package.json"
  if [ "$flavor" = expo ]; then
    printf '{"name":"mobile","dependencies":{"expo":"~52.0.0","react-native":"0.76.0"}}\n' > "$dir/apps/mobile/package.json"
  else
    printf '{"name":"mobile","dependencies":{"react-native":"0.76.0"},"devDependencies":{"eslint-plugin-react-native":"~5.0.0"}}\n' > "$dir/apps/mobile/package.json"
  fi
}
run_installer() {
  local d="$1" stack="${2:-ts-server}" expected_rc="${3:-0}" rc=0
  ISSUE_1842_PM_LOG="$d.pm.log"; export ISSUE_1842_PM_LOG
  : > "$ISSUE_1842_PM_LOG"
  (cd "$d" && FENCES_FIRE_ALLOW_SKIP='Issue 1842 argv-only fixture: package manager is a recording stub' bash "$REPO_ROOT/install.sh" "$stack" --full </dev/null) > "$d.install.log" 2>&1 || rc=$?
  if [ "$rc" -ne "$expected_rc" ]; then
    bad "installer exit for ${d##*/}: expected $expected_rc, got $rc"
    tail -n 20 "$d.install.log"
  fi
}
if [ "${ISSUE_1842_FOCUS:-}" != reification ] && [ "${ISSUE_1842_FOCUS:-}" != literal ]; then
# No workspaces field: real 40-configs discovers apps/*; npm must install at root.
a="$TMP/npm-no-workspaces"
make_fixture "$a" '{"name":"root","version":"1.0.0","private":true}' npm
add_mobile "$a" expo
mkdir -p "$a/apps/spa" "$a/apps/web"
printf '{"name":"spa","dependencies":{"react":"19.0.0"},"devDependencies":{"vite":"6.0.0"}}\n' > "$a/apps/spa/package.json"
printf '{"name":"web","dependencies":{"next":"15.0.0","react":"19.0.0"}}\n' > "$a/apps/web/package.json"
run_installer "$a"
grep -q 'eslint-config-expo' "$a/apps/mobile/eslint.config.mjs" 2>/dev/null && ok 'npm fixture reaches the real Expo config placement' || bad 'npm Expo config not placed'
grep -q -- 'eslint-config-expo' <<< "$(grep -F "npm|$a|install --save-dev" "$a.pm.log")" && ok 'npm without workspaces installs Expo dependency at root' || bad 'npm without workspaces omitted Expo dependency'
grep -q -- '--legacy-peer-deps' <<< "$(grep -F "npm|$a|install --save-dev" "$a.pm.log")" && ok 'npm applies RN peer compatibility when RN is a secondary stack' || bad 'npm secondary RN lacks peer compatibility'
grep -q -- 'eslint-plugin-boundaries' <<< "$(grep -F "npm|$a|install --save-dev" "$a.pm.log")" && ok 'npm unions SPA dependencies' || bad 'npm omitted SPA dependencies'
grep -q -- '@next/eslint-plugin-next' <<< "$(grep -F "npm|$a|install --save-dev" "$a.pm.log")" && ok 'npm unions Next dependencies' || bad 'npm omitted Next dependencies'
count=$(grep -F "npm|$a|install --save-dev" "$a.pm.log" | tr ' ' '\n' | grep -cx jsdom || true)
[ "$count" = 1 ] && ok 'shared stack dependency is included once' || bad "shared dependency occurs $count times"
# Paired negative: a flat ts-server must not receive any RN package or RN peer relaxation.
b="$TMP/npm-flat"
make_fixture "$b" '{"name":"flat","version":"1.0.0","private":true}' npm
run_installer "$b"
grep -q -- 'eslint-config-expo' <<< "$(grep -F "npm|$b|install --save-dev" "$b.pm.log")" && bad 'flat ts-server was given Expo dependencies' || ok 'flat ts-server does not receive Expo dependencies'
grep -q -- '--legacy-peer-deps' <<< "$(grep -F "npm|$b|install --save-dev" "$b.pm.log")" && bad 'flat ts-server unexpectedly relaxed peers' || ok 'flat ts-server keeps strict peer resolution'
# A pnpm workspace needs the RN extras in the mobile workspace itself.
c="$TMP/pnpm-workspace"
make_fixture "$c" '{"name":"root","version":"1.0.0","private":true}' pnpm
add_mobile "$c" bare
ISSUE_1842_MEMBERS=$(printf '[{"path":"%s"},{"path":"%s/apps/mobile"}]' "$c" "$c"); export ISSUE_1842_MEMBERS
run_installer "$c"
grep -q '@react-native/eslint-config' "$c/apps/mobile/eslint.config.mjs" 2>/dev/null && ok 'pnpm fixture reaches bare RN config placement' || bad 'pnpm bare RN config not placed'
grep -q -- '@react-native/eslint-config' <<< "$(grep -F "pnpm|$c/apps/mobile|add -D" "$c.pm.log")" && ok 'pnpm installs RN dependencies from the member directory' || bad 'pnpm omitted mobile workspace-scoped RN dependencies'
if grep -F "pnpm|$c|--recursive list --depth -1 --json" "$c.pm.log" >/dev/null; then ok 'pnpm checks actual workspace membership'; else bad 'pnpm omitted workspace membership check'; fi
if grep -Eq -- '(^| )eslint-plugin-react-native( |$)' <<< "$(grep -F "pnpm|$c/apps/mobile|add -D" "$c.pm.log")"; then
  bad 'pnpm would rewrite a dependency already declared by the workspace'
else
  ok 'pnpm keeps the workspace declared plugin version'
fi
# ESLint loads .js before .mjs: a dormant getff config must not select RN deps.
e="$TMP/npm-owned-js"
make_fixture "$e" '{"name":"root","version":"1.0.0","private":true}' npm
add_mobile "$e" expo
printf 'export default [];\n' > "$e/apps/mobile/eslint.config.js"
cp "$REPO_ROOT/packages/preset-react-native/templates/eslint.config.expo.mjs" "$e/apps/mobile/eslint.config.mjs"
run_installer "$e"
if grep -q -- 'eslint-config-expo' <<< "$(grep -F "npm|$e|install --save-dev" "$e.pm.log")"; then bad 'dormant mjs added Expo dependencies'; else ok 'owned active js suppresses dormant Expo dependencies'; fi
if grep -q -- '--legacy-peer-deps' <<< "$(grep -F "npm|$e|install --save-dev" "$e.pm.log")"; then bad 'dormant mjs relaxed npm peers'; else ok 'owned active js keeps strict npm peers'; fi
# pnpm manifest excludes apps/demo even though the generic resolver detects its preset.
f="$TMP/pnpm-excluded"
make_fixture "$f" '{"name":"root","version":"1.0.0","private":true,"devDependencies":{"eslint-config-expo":"^58.0.0","@react-native/eslint-config":"^0.88.0","@eslint/eslintrc":"^3.0.0","eslint-plugin-react-native":"^5.0.0","eslint-plugin-react-native-a11y":"^3.0.0"}}' pnpm
printf 'packages:\n  - "apps/*"\n  - "!apps/demo"\n' > "$f/pnpm-workspace.yaml"
mkdir -p "$f/apps/demo"
printf '%s\n' '{"name":"demo","dependencies":{"react-native":"0.76.0"}}' > "$f/apps/demo/package.json"
ISSUE_1842_MEMBERS=$(printf '[{"path":"%s"}]' "$f"); ISSUE_1842_FAIL_FILTER=demo; export ISSUE_1842_MEMBERS ISSUE_1842_FAIL_FILTER
run_installer "$f" react-native
if grep -F "pnpm|$f/apps/demo|add " "$f.pm.log" >/dev/null || grep -q -- '--filter ./apps/demo' <<< "$(grep -F 'pnpm|' "$f.pm.log")"; then bad 'pnpm tried to add to an excluded directory'; else ok 'pnpm skips excluded preset directory'; fi
if grep -q -- 'zod@' <<< "$(grep -F "pnpm|$f|add -w" "$f.pm.log")"; then ok 'excluded directory does not block root runtime install'; else bad 'excluded directory blocked root runtime install'; fi
# A real membership discovery error must not be treated as an empty workspace.
g="$TMP/pnpm-list-failure"
make_fixture "$g" '{"name":"root","version":"1.0.0","private":true}' pnpm
add_mobile "$g" bare
ISSUE_1842_LIST_FAIL=1; ISSUE_1842_FAIL_FILTER=__none__; export ISSUE_1842_LIST_FAIL ISSUE_1842_FAIL_FILTER
run_installer "$g" ts-server 1
if grep -q -- 'zod@' <<< "$(grep -F "pnpm|$g|add -w" "$g.pm.log")"; then bad 'pnpm membership failure permitted runtime install'; else ok 'pnpm membership failure stops runtime install'; fi
if grep -q 'dep install incomplete' "$g.install.log"; then ok 'pnpm membership failure reports incomplete install'; else bad 'pnpm membership failure was not reported'; fi
unset ISSUE_1842_LIST_FAIL
ISSUE_1842_MEMBERS='not-json'; export ISSUE_1842_MEMBERS
run_installer "$g" ts-server 1
if grep -q 'cannot validate pnpm workspace membership' "$g.install.log" && ! grep -q -- 'zod@' <<< "$(grep -F "pnpm|$g|add -w" "$g.pm.log")"; then ok 'malformed pnpm membership fails closed'; else bad 'malformed pnpm membership was accepted'; fi
ISSUE_1842_MEMBERS=$(printf '[{"path":"%s"},{"path":"%s/apps/mobile"}]' "$g" "$g"); ISSUE_1842_FAIL_FILTER=mobile; ISSUE_1842_FAIL_CWD="$g/apps/mobile"; export ISSUE_1842_MEMBERS ISSUE_1842_FAIL_FILTER ISSUE_1842_FAIL_CWD
run_installer "$g" ts-server 1
if grep -q 'dep install incomplete' "$g.install.log" && ! grep -q -- 'zod@' <<< "$(grep -F "pnpm|$g|add -w" "$g.pm.log")"; then ok 'failed pnpm member add stops runtime install'; else bad 'failed pnpm member add did not fail closed'; fi
unset ISSUE_1842_LIST_FAIL ISSUE_1842_FAIL_FILTER ISSUE_1842_FAIL_CWD ISSUE_1842_MEMBERS
# A Biome migration may retain the old Expo config without using it.
d="$TMP/biome"
make_fixture "$d" '{"name":"biome-root","version":"1.0.0","private":true,"scripts":{"lint":"biome lint"}}' npm
add_mobile "$d" expo
cp "$REPO_ROOT/packages/preset-react-native/templates/eslint.config.expo.mjs" "$d/apps/mobile/eslint.config.mjs"
run_installer "$d"
biome_dev_install=$(grep -F "npm|$d|install --save-dev" "$d.pm.log")
if [ -n "$biome_dev_install" ] && ! grep -Eq -- 'eslint-config-expo|--legacy-peer-deps' <<<"$biome_dev_install"; then
  ok 'Biome keeps Expo dependencies and peer relaxation out of the root install'
else
  bad 'Biome root install was missing or included Expo dependencies or peer relaxation'
fi
fi
# A literal glob-like directory must never select the similarly named sibling.
if [ "${ISSUE_1842_FOCUS:-}" != reification ]; then
j="$TMP/pnpm-literal-directory"
make_fixture "$j" '{"name":"root","version":"1.0.0","private":true}' pnpm
mkdir -p "$j/apps/mobile*" "$j/apps/mobile"
printf '%s\n' '{"name":"literal-star","dependencies":{"react-native":"0.76.0"}}' > "$j/apps/mobile*/package.json"
printf '%s\n' '{"name":"literal-plain","dependencies":{"react-native":"0.76.0"},"devDependencies":{"eslint-config-expo":"*","@react-native/eslint-config":"*","@eslint/eslintrc":"*","eslint-plugin-react-native":"*","eslint-plugin-react-native-a11y":"*"}}' > "$j/apps/mobile/package.json"
ISSUE_1842_MEMBERS=$(printf '[{"path":"%s"},{"path":"%s/apps/mobile*"},{"path":"%s/apps/mobile"}]' "$j" "$j" "$j"); export ISSUE_1842_MEMBERS
run_installer "$j"
if grep -q -- 'eslint-config-expo' <<< "$(grep -F "pnpm|$j/apps/mobile*|add -D" "$j.pm.log")"; then ok 'pnpm adds to the literal star directory'; else bad 'pnpm did not add from the literal star directory'; fi
if grep -F "pnpm|$j/apps/mobile|add -D" "$j.pm.log" >/dev/null; then bad 'pnpm added to the literal star sibling'; else ok 'pnpm leaves the plain sibling alone'; fi
if grep -q -- '--filter' <<< "$(grep -F 'pnpm|' "$j.pm.log")"; then bad 'pnpm workspace add still uses a glob filter'; else ok 'pnpm member add uses no glob filter'; fi
unset ISSUE_1842_MEMBERS
fi
if [ "${ISSUE_1842_FOCUS:-}" != literal ]; then
# With every dev dependency declared, pnpm must not reify an unchanged workspace.
# Conversely, adding a missing workspace dependency still requires a full link pass.
for scenario in unchanged missing-workspace; do
  h="$TMP/pnpm-$scenario"
  make_fixture "$h" '{"name":"root","version":"1.0.0","private":true}' pnpm
  add_mobile "$h" bare
  node - "$h/package.json" "$h/apps/mobile/package.json" "$scenario" <<'NODE'
const fs = require('fs');
const [rootPath, mobilePath, scenario] = process.argv.slice(2);
const root = JSON.parse(fs.readFileSync(rootPath));
const names = ['eslint','typescript-eslint','@eslint/js','@typescript-eslint/utils','globals','prettier','eslint-config-prettier','@vitest/eslint-plugin','typescript','vitest','@vitest/coverage-v8','@stryker-mutator/core','@stryker-mutator/vitest-runner','@stryker-mutator/typescript-checker','dependency-cruiser','fast-check','glob','ts-morph','tsx','husky','lint-staged','sort-package-json','@types/node'];
root.devDependencies = Object.fromEntries(names.map(name => [name, '*']));
root.dependencies = { zod: '^3.24.0' };
fs.writeFileSync(rootPath, JSON.stringify(root));
const mobile = JSON.parse(fs.readFileSync(mobilePath));
for (const name of ['@react-native/eslint-config','@eslint/eslintrc','eslint-plugin-react-native','eslint-plugin-react-native-a11y']) mobile.devDependencies[name] = '*';
if (scenario === 'unchanged') mobile.devDependencies['eslint-config-expo'] = '*';
fs.writeFileSync(mobilePath, JSON.stringify(mobile));
NODE
  ISSUE_1842_MEMBERS=$(printf '[{"path":"%s"},{"path":"%s/apps/mobile"}]' "$h" "$h"); export ISSUE_1842_MEMBERS
  run_installer "$h"
  if [ "$scenario" = unchanged ]; then
    if grep -F "pnpm|$h|install" "$h.pm.log" >/dev/null; then bad 'pnpm reified workspace with no new dev dependencies'; else ok 'pnpm skips reification when no dev dependencies were added'; fi
    if grep -F "pnpm|$h|add " "$h.pm.log" >/dev/null || grep -F "pnpm|$h/apps/mobile|add " "$h.pm.log" >/dev/null; then bad 'pnpm added an already declared dependency'; else ok 'pnpm skips all adds when root and workspace dependencies are declared'; fi
  else
    if grep -F "pnpm|$h/apps/mobile|add -D" "$h.pm.log" >/dev/null; then ok 'pnpm adds a missing workspace dependency'; else bad 'pnpm omitted a missing workspace dependency'; fi
    if grep -F "pnpm|$h|install" "$h.pm.log" >/dev/null; then ok 'pnpm reifies after a workspace dependency add'; else bad 'pnpm skipped required workspace reification'; fi
  fi
done
unset ISSUE_1842_MEMBERS
fi
printf '\nPASS=%s FAIL=%s\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
