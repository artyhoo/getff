#!/usr/bin/env bash
# critical-review S4-2 / S4-4 / S4-5 — the installer checked only the exact file name it ships
# (eslint.config.mjs, .lintstagedrc.json, .prettierrc.json). A consumer config under ANY other
# name lost: ESLint picks eslint.config.mjs over their .cjs/.ts, lint-staged and prettier pick
# our file over their package.json key or .prettierrc — their settings silently stopped applying.
# Now the installer keeps a consumer config under any name, places nothing next to it, and lists
# it as not wired in the final summary.
#
# ARMS:
#   (A) foreign_tool_config: every alternate name + the package.json key is detected per tool
#   (B) a devDependency named lint-staged/prettier is NOT a config (paired negative)
#   (C) end-to-end: install.sh keeps eslint.config.cjs / .prettierrc / package.json#lint-staged,
#       places none of ours, and names each under "not wired"
#   (D) paired negative: a fresh repo still gets all three framework configs
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# shellcheck disable=SC1090
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
if ! command -v foreign_tool_config >/dev/null 2>&1; then
  bad "foreign_tool_config not exported from lib.sh"
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 1
fi

# ── (A) detection per tool ──
for pair in eslint:eslint.config.js eslint:eslint.config.cjs eslint:eslint.config.ts eslint:eslint.config.mts \
            lint-staged:.lintstagedrc lint-staged:lint-staged.config.mjs \
            prettier:.prettierrc prettier:prettier.config.cjs prettier:.prettierrc.yaml; do
  kind=${pair%%:*}; name=${pair#*:}
  D=$(mktemp -d); : > "$D/$name"
  [ "$(foreign_tool_config "$D" "$kind")" = "$name" ] && ok "(A) $kind: $name detected" || bad "(A) $kind: $name NOT detected"
  rm -rf "$D"
done
D=$(mktemp -d)
printf '{ "name": "t", "lint-staged": { "*.ts": "tsc" }, "prettier": { "semi": false } }\n' > "$D/package.json"
for k in lint-staged:lint-staged prettier:prettier; do
  kind=${k%%:*}; key=${k#*:}
  [ "$(foreign_tool_config "$D" "$kind")" = "package.json#$key" ] && ok "(A) $kind: package.json#$key detected" || bad "(A) $kind: package.json#$key NOT detected"
done
rm -rf "$D"
D=$(mktemp -d); : > "$D/eslint.config.mjs"; : > "$D/.lintstagedrc.json"; : > "$D/.prettierrc.json"
[ -z "$(foreign_tool_config "$D" eslint)$(foreign_tool_config "$D" lint-staged)$(foreign_tool_config "$D" prettier)" ] \
  && ok "(A) the names we ship are not 'foreign' (copy_safe owns that case)" || bad "(A) a shipped name was reported as foreign"
rm -rf "$D"

# ── (A-legacy) eslintrc-format configs are NOT the consumer's live config: the install pins
#    eslint@^9 (setup.d/70-deps.sh CORE_DEVDEPS), which reads only flat eslint.config.*. Skipping
#    our flat config next to an .eslintrc left ESLint with no config at all, and the placed
#    lint-staged `eslint --fix` then failed every commit (critical-review cold pass, M1) ──
D=$(mktemp -d); : > "$D/.eslintrc.json"
printf '{ "name": "t", "eslintConfig": { "rules": {} } }\n' > "$D/package.json"
[ -z "$(foreign_tool_config "$D" eslint)" ] && ok "(A-legacy) .eslintrc.json / package.json#eslintConfig do not block the flat config" \
  || bad "(A-legacy) a legacy eslintrc config was taken as the live config (got: $(foreign_tool_config "$D" eslint))"
[ "$(legacy_eslint_config "$D")" = ".eslintrc.json" ] && ok "(A-legacy) the legacy config is still named, for the ignored-config note" \
  || bad "(A-legacy) legacy_eslint_config did not name .eslintrc.json (got: $(legacy_eslint_config "$D" 2>&1))"
rm -f "$D/.eslintrc.json"
[ "$(legacy_eslint_config "$D")" = "package.json#eslintConfig" ] && ok "(A-legacy) package.json#eslintConfig is named as legacy" \
  || bad "(A-legacy) package.json#eslintConfig not named as legacy"
rm -rf "$D"

# ── (B) devDependencies are not configs ──
D=$(mktemp -d)
printf '{ "name": "t", "devDependencies": { "lint-staged": "^16.0.0", "prettier": "3.8.3", "eslint": "^9" } }\n' > "$D/package.json"
[ -z "$(foreign_tool_config "$D" lint-staged)$(foreign_tool_config "$D" prettier)$(foreign_tool_config "$D" eslint)" ] \
  && ok "(B) devDependencies named lint-staged/prettier/eslint are not configs" || bad "(B) a devDependency was taken for a config"
rm -rf "$D"

# ── (C) end-to-end keep ──
T=$(mktemp -d); git -C "$T" init -q
printf '{ "name": "t", "version": "0.0.0", "lint-staged": { "*.ts": "tsc --noEmit" } }\n' > "$T/package.json"
printf 'module.exports = [];\n' > "$T/eslint.config.cjs"
printf 'semi: false\n' > "$T/.prettierrc"
_out=$( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server 2>&1 )
[ ! -e "$T/eslint.config.mjs" ] && ok "(C) eslint.config.mjs not placed next to the consumer's eslint.config.cjs" || bad "(C) eslint.config.mjs placed — it overrides the consumer's eslint.config.cjs"
[ ! -e "$T/.lintstagedrc.json" ] && ok "(C) .lintstagedrc.json not placed over package.json#lint-staged" || bad "(C) .lintstagedrc.json placed — it overrides package.json#lint-staged"
[ ! -e "$T/.prettierrc.json" ] && ok "(C) .prettierrc.json not placed next to the consumer's .prettierrc" || bad "(C) .prettierrc.json placed — it overrides the consumer's .prettierrc"
[ "$(cat "$T/eslint.config.cjs")" = "module.exports = [];" ] && ok "(C) the consumer's eslint.config.cjs is byte-unchanged" || bad "(C) the consumer's eslint.config.cjs changed"
_nw=$(echo "$_out" | sed -n '/NOT wired/,$p')
for want in eslint.config.cjs 'package.json#lint-staged' .prettierrc; do
  echo "$_nw" | grep -qF -- "$want" && ok "(C) the not-wired summary names $want" || bad "(C) the not-wired summary does not name $want"
done
rm -rf "$T"

# ── (D) paired negative: fresh repo ──
T=$(mktemp -d); git -C "$T" init -q
printf '{ "name": "t", "version": "0.0.0" }\n' > "$T/package.json"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
{ [ -f "$T/eslint.config.mjs" ] && [ -f "$T/.lintstagedrc.json" ] && [ -f "$T/.prettierrc.json" ]; } \
  && ok "(D) a fresh repo still gets eslint.config.mjs + .lintstagedrc.json + .prettierrc.json" \
  || bad "(D) a fresh repo is missing a framework config"
rm -rf "$T"

# ── (E) end-to-end legacy: an .eslintrc.json repo gets the flat config, and the summary says the
#    legacy file is not read (ESLint 9) rather than letting the consumer's rules vanish silently ──
T=$(mktemp -d); git -C "$T" init -q
printf '{ "name": "t", "version": "0.0.0" }\n' > "$T/package.json"
printf '{ "rules": { "no-console": "error" } }\n' > "$T/.eslintrc.json"
_out=$( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server 2>&1 )
[ -f "$T/eslint.config.mjs" ] && ok "(E) eslint.config.mjs placed next to a legacy .eslintrc.json" || bad "(E) eslint.config.mjs not placed — ESLint 9 would have no config"
echo "$_out" | sed -n '/NOT wired/,$p' | grep -q '\.eslintrc\.json.*ESLint 9' \
  && ok "(E) the summary says .eslintrc.json is not read by ESLint 9" || bad "(E) the summary does not mention the ignored .eslintrc.json"
rm -rf "$T"

# ── (F) monorepo: the per-package lint-staged stub is not dropped next to a package's own
#    lint-staged config (lint-staged picks the closest config; the stub would shadow theirs) ──
T=$(mktemp -d); git -C "$T" init -q
printf '{ "name": "m", "version": "0.0.0", "private": true, "workspaces": ["packages/*"] }\n' > "$T/package.json"
mkdir -p "$T/packages/own-key" "$T/packages/own-file" "$T/packages/plain"
printf '{ "name": "own-key", "lint-staged": { "*.ts": "tsc --noEmit" } }\n' > "$T/packages/own-key/package.json"
printf '{ "name": "own-file" }\n' > "$T/packages/own-file/package.json"
printf 'module.exports = {};\n' > "$T/packages/own-file/.lintstagedrc.js"
printf 'export default [];\n' > "$T/packages/own-file/eslint.config.js"
printf '{ "name": "plain" }\n' > "$T/packages/plain/package.json"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server ) >/dev/null 2>&1
[ ! -e "$T/packages/own-key/.lintstagedrc.json" ] && ok "(F) no stub next to a package's package.json#lint-staged" || bad "(F) stub placed next to package.json#lint-staged"
[ ! -e "$T/packages/own-file/.lintstagedrc.json" ] && ok "(F) no stub next to a package's .lintstagedrc.js" || bad "(F) stub placed next to .lintstagedrc.js"
[ -f "$T/packages/plain/.lintstagedrc.json" ] && ok "(F) a package without its own config still gets the stub" || bad "(F) plain package lost its stub"
[ ! -e "$T/packages/own-file/eslint.config.mjs" ] && ok "(F) no workspace eslint.config.mjs next to a package's own eslint.config.js" || bad "(F) workspace eslint.config.mjs placed over a package's own eslint.config.js"
[ -f "$T/packages/plain/eslint.config.mjs" ] && ok "(F) a package without its own eslint config still gets eslint.config.mjs" || bad "(F) plain package got no eslint.config.mjs"
rm -rf "$T"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
