#!/usr/bin/env bash
# oxlint-register-jsplugin.test.sh — getff's lint plugin is registered in a project's own oxlint
# config without breaking it (one-button chain, part P4; operator log entry 26 point 12).
#
# oxlint loads ESLint-format plugins through `jsPlugins` in its config. The helper
# oxlint_register_jsplugin (setup.d/lib.sh) takes the config path and the plugin barrel as INPUT —
# which linter the project uses is recorded elsewhere — and merges one `jsPlugins` entry into the
# project's file. Switching rules on is a separate decision that is still open («whose setup wins»
# when getff's rules turn a project's own commands red), so rules are written only when
# GETFF_ENABLE_PLUGIN_RULES=1, and never over a setting the project already has.
#
# Arms:
#   M  merge into an existing .oxlintrc.json: the entry is added, every other key is kept, and the
#      rules passed in are NOT written while the switch is off;
#   I  a second run changes nothing (byte-identical) and says the plugin is already registered;
#   P  the project's own jsPlugins entries are kept beside getff's;
#   A  no config file: nothing is created, and the NOT-wired list says why;
#   J  a config that is not a JSON object: left as it was, and the NOT-wired list says why;
#   T  an oxlint.config.ts: code, left as it was, and the NOT-wired list says why;
#   S  a config in a workspace directory: the specifier is relative to that directory;
#   R  switch on: getff's rules are added, and a rule the project already set keeps its value — at the
#      top level or inside an `overrides` entry; switching on after an earlier registration still adds them;
#   N  a jsPlugins key that is not a list: left as it was, and the NOT-wired line names that cause;
#   C  an oxlint config written as CommonJS (.cjs): code, left as it was.
set -uo pipefail

REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0
FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# shellcheck source=/dev/null
INSTALL_SH_LIB_ONLY=1 source "${OXLINT_LIB_UNDER_TEST:-$REPO_ROOT/setup.d/lib.sh}"
NOT_WIRED=()
PROJECT_ROOT="$WORK/proj"
mkdir -p "$PROJECT_ROOT/eslint-rules-local"
BARREL="$PROJECT_ROOT/eslint-rules-local/index.mjs"
: > "$BARREL"
RULES='{"rules-as-tests/no-unsafe-zod-parse":"error","no-empty":"error"}'

jq_or_node() { node -e "const o=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(JSON.stringify(($2)(o)))" "$1"; }

echo "M: merge into an existing .oxlintrc.json"
CFG="$PROJECT_ROOT/.oxlintrc.json"
cat > "$CFG" <<'EOF'
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "rules": { "react/rules-of-hooks": "error", "no-empty": "off" }
}
EOF
out=$(oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES")
[ "$(jq_or_node "$CFG" 'o=>o.jsPlugins')" = '[{"name":"rules-as-tests","specifier":"./eslint-rules-local/index.mjs"}]' ] \
  && ok "M1: the jsPlugins entry points at ./eslint-rules-local/index.mjs" || bad "M1: jsPlugins = $(jq_or_node "$CFG" 'o=>o.jsPlugins')"
[ "$(jq_or_node "$CFG" 'o=>[o.$schema,o.plugins,o.rules]')" = '["./node_modules/oxlint/configuration_schema.json",["react","typescript","oxc"],{"react/rules-of-hooks":"error","no-empty":"off"}]' ] \
  && ok "M2: \$schema, plugins and rules are kept exactly, no rule written while the switch is off" \
  || bad "M2: kept keys changed: $(jq_or_node "$CFG" 'o=>[o.$schema,o.plugins,o.rules]')"
grep -q '✓' <<<"$out" && ok "M3: the output reports the registration" || bad "M3: output: $out"

echo "I: a second run changes nothing"
before=$(cat "$CFG")
out=$(oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES")
[ "$(cat "$CFG")" = "$before" ] && ok "I1: byte-identical after a second run" || bad "I1: the file changed on re-run"
grep -q 'already registered' <<<"$out" && ok "I2: the output says already registered" || bad "I2: output: $out"

echo "P: the project's own jsPlugins entries are kept"
printf '{ "jsPlugins": ["eslint-plugin-foo", { "name": "bar", "specifier": "./bar.mjs" }] }\n' > "$CFG"
oxlint_register_jsplugin "$CFG" "$BARREL" >/dev/null
[ "$(jq_or_node "$CFG" 'o=>o.jsPlugins')" = '["eslint-plugin-foo",{"name":"bar","specifier":"./bar.mjs"},{"name":"rules-as-tests","specifier":"./eslint-rules-local/index.mjs"}]' ] \
  && ok "P1: both project entries kept, getff's appended" || bad "P1: jsPlugins = $(jq_or_node "$CFG" 'o=>o.jsPlugins')"

echo "A: no config file"
NOT_WIRED=()
oxlint_register_jsplugin "$PROJECT_ROOT/missing/.oxlintrc.json" "$BARREL" >/dev/null
[ ! -e "$PROJECT_ROOT/missing/.oxlintrc.json" ] && ok "A1: no file created" || bad "A1: a config was created"
grep -q 'no oxlint config' <<<"$(printf '%s\n' "${NOT_WIRED[@]-}")" \
  && ok "A2: NOT-wired line names the missing config" || bad "A2: NOT_WIRED = ${NOT_WIRED[*]-}"

echo "J: a config that is not a JSON object"
NOT_WIRED=()
printf '{\n  // comments are allowed by oxlint\n  "rules": {}\n}\n' > "$CFG"
before=$(cat "$CFG")
oxlint_register_jsplugin "$CFG" "$BARREL" >/dev/null
[ "$(cat "$CFG")" = "$before" ] && ok "J1: left as it was" || bad "J1: the file changed"
[ "${#NOT_WIRED[@]}" -eq 1 ] && grep -q 'not a plain JSON object' <<<"${NOT_WIRED[0]}" \
  && ok "J2: one NOT-wired line naming the cause" || bad "J2: NOT_WIRED = ${NOT_WIRED[*]-}"

echo "T: an oxlint.config.ts"
NOT_WIRED=()
TS="$PROJECT_ROOT/oxlint.config.ts"
printf 'export default { rules: {} };\n' > "$TS"
before=$(cat "$TS")
oxlint_register_jsplugin "$TS" "$BARREL" >/dev/null
[ "$(cat "$TS")" = "$before" ] && ok "T1: left as it was" || bad "T1: the file changed"
grep -q 'oxlint.config.ts' <<<"$(printf '%s\n' "${NOT_WIRED[@]-}")" \
  && ok "T2: NOT-wired line names the file" || bad "T2: NOT_WIRED = ${NOT_WIRED[*]-}"

echo "S: a config in a workspace directory"
mkdir -p "$PROJECT_ROOT/apps/web"
WCFG="$PROJECT_ROOT/apps/web/.oxlintrc.json"
printf '{}\n' > "$WCFG"
oxlint_register_jsplugin "$WCFG" "$BARREL" >/dev/null
[ "$(jq_or_node "$WCFG" 'o=>o.jsPlugins[0].specifier')" = '"../../eslint-rules-local/index.mjs"' ] \
  && ok "S1: specifier relative to apps/web" || bad "S1: specifier = $(jq_or_node "$WCFG" 'o=>o.jsPlugins[0].specifier')"

echo "R: switch on"
printf '{ "rules": { "no-empty": "off" } }\n' > "$CFG"
GETFF_ENABLE_PLUGIN_RULES=1 oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES" >/dev/null
[ "$(jq_or_node "$CFG" 'o=>o.rules')" = '{"no-empty":"off","rules-as-tests/no-unsafe-zod-parse":"error"}' ] \
  && ok "R1: getff's rule added, the project's no-empty kept off" || bad "R1: rules = $(jq_or_node "$CFG" 'o=>o.rules')"

echo "R: a rule set only inside overrides keeps the project's setting"
printf '{ "overrides": [ { "files": ["*.ts"], "rules": { "rules-as-tests/no-unsafe-zod-parse": "off" } } ] }\n' > "$CFG"
GETFF_ENABLE_PLUGIN_RULES=1 oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES" >/dev/null
[ "$(jq_or_node "$CFG" 'o=>o.rules')" = '{"no-empty":"error"}' ] \
  && ok "R2: the overridden rule is not added at the top level" || bad "R2: rules = $(jq_or_node "$CFG" 'o=>o.rules')"

echo "R: switching on after an earlier registration still adds the rules"
printf '{}\n' > "$CFG"
oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES" >/dev/null
out=$(GETFF_ENABLE_PLUGIN_RULES=1 oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES")
[ "$(jq_or_node "$CFG" 'o=>[o.jsPlugins.length,o.rules]')" = '[1,{"rules-as-tests/no-unsafe-zod-parse":"error","no-empty":"error"}]' ] \
  && grep -q '✓' <<<"$out" && ok "R3: rules added, the entry not duplicated, reported as a change" \
  || bad "R3: $(jq_or_node "$CFG" 'o=>[o.jsPlugins,o.rules]') / $out"
# The first run already said «registered»: this one names what it changed, the rules (P5 R1 printed
# «already registered» and then «registered» for the same file).
if grep -q "getff's lint rules switched on in" <<<"$out" && ! grep -q 'plugin registered' <<<"$out"; then
  ok "R3: the output names the rules it switched on, not a second registration"
else
  bad "R3: the output does not name the rules switched on: $out"
fi
out=$(GETFF_ENABLE_PLUGIN_RULES=1 oxlint_register_jsplugin "$CFG" "$BARREL" "$RULES")
if [ -z "$out" ]; then
  ok "R3: a repeat that adds no rule prints nothing (never a second «registered»)"
else
  bad "R3: a repeat says: $out"
fi

echo "N: a jsPlugins key that is not a list"
NOT_WIRED=()
printf '{ "jsPlugins": "eslint-plugin-foo" }\n' > "$CFG"
before=$(cat "$CFG")
oxlint_register_jsplugin "$CFG" "$BARREL" >/dev/null
[ "$(cat "$CFG")" = "$before" ] && ok "N1: left as it was" || bad "N1: the file changed to $(cat "$CFG")"
grep -q 'jsPlugins is not a list' <<<"$(printf '%s\n' "${NOT_WIRED[@]-}")" \
  && ok "N2: NOT-wired line names the cause" || bad "N2: NOT_WIRED = ${NOT_WIRED[*]-}"

echo "C: an oxlint config written as CommonJS"
NOT_WIRED=()
CJS="$PROJECT_ROOT/oxlint.config.cjs"
printf 'module.exports = { rules: {} };\n' > "$CJS"
before=$(cat "$CJS")
oxlint_register_jsplugin "$CJS" "$BARREL" >/dev/null
[ "$(cat "$CJS")" = "$before" ] && [ "${#NOT_WIRED[@]}" -eq 1 ] && grep -q 'config is code' <<<"${NOT_WIRED[0]}" \
  && ok "C1: left as it was, the NOT-wired line says the config is code" || bad "C1: $(cat "$CJS") / ${NOT_WIRED[*]-}"

echo ""
echo "oxlint-register-jsplugin: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
