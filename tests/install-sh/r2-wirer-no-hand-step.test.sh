#!/usr/bin/env bash
# r2-wirer-no-hand-step.test.sh — operator decision Q4.7 (2026-09-28) on the R2 wirer path: the install
# never asks the consumer to edit an ESLint config by hand. What it cannot wire is named in the «NOT
# wired» summary with its reason. The standalone wire-eslint-r2 CLI keeps its snippet for a human who
# runs it directly; the install passes --install and gets a «  · not wired: <what> — <why>» line.
#
# A manual step has more than one spelling here, so the predicate (MANUAL below) covers each one the
# wirer has printed: «Add manually» (unrecognised export), «Add to <config>» plus the snippet's
# `import customRules from` line (generateDegradedSnippet), and «by hand» (the pre-Q4.7 not-wired text).
#
#   F1  a getff-placed per-package config (the Layer-2 pass, ts-morph present) on an install WITHOUT
#       --full: R2 is written into it — getff placed the file, so the write needs no --full consent —
#       ESLint still loads it, and the output carries no manual step. Before: no --yes → the
#       non-interactive wirer printed the «Add to <config>» snippet and left R2 out.
#   F2  the same config in an export shape the wirer cannot append to: no manual step, and the NOT
#       wired summary names the config with the wirer's reason.
#   F3  a config getff placed on an EARLIER install (the refresh-baseline manifest holds its hash) that
#       the consumer has edited since: its bytes are the consumer's, so R2 goes in the own-config way —
#       insertions only, scoped to the boundary code, the original kept — never the AST re-print that
#       drops the consumer's comments and adds an unscoped R2 block.
#   F4  the wirer crashes with no output → the NOT wired summary still names the config.
#   F6  paired with F3: the manifest's hash still matches the file → getff's own branch (--install, not
#       --own-config), so F3's route is the edit, not the manifest.
#   F5  the wirer reports R2 wired AND a part it could not add → that part still reaches the summary.
#   W1  wirer CLI, --install, ts-morph not in the consumer's node_modules → one not-wired line, no snippet.
#   W2  wirer CLI, --install --yes, ESLint not resolvable → the probe cannot confirm the write, so it is
#       undone and named as not wired with the probe verdict, no snippet; the file is as it was.
#   W3  wirer CLI, --install without --yes (not interactive) → not-wired line, no snippet, no write.
#   W4  the config reached through a symlinked directory → the line names it by its path in the
#       project, not by a ../ walk out of the real directory.
#   H1  paired, the other audience: the same unrecognised config WITHOUT --install still prints the
#       snippet a human can act on.
#
# The real wirer runs on a real ts-morph + ESLint (node_modules linked read-only, never installed into).
# Without them the arms SKIP locally and FAIL under CI, where a skip would prove nothing.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WIRER="$REPO_ROOT/packages/core/install/wire-eslint-r2.ts"
FINALIZE="$REPO_ROOT/setup.d/99-finalize.sh"
MANUAL='manually|by hand|Add to |import customRules from'

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "✗ $1"; }
manual_lines() { printf '%s\n' "$1" | grep -iE "$MANUAL" | head -3 | tr '\n' '|'; }

NM_SRC=""
for _nm in "$REPO_ROOT/packages/core/node_modules" "$REPO_ROOT/node_modules"; do
  [ -f "$_nm/eslint/package.json" ] && [ -f "$_nm/ts-morph/package.json" ] && [ -x "$_nm/.bin/tsx" ] \
    && NM_SRC="$_nm" && break
done
if ! command -v node >/dev/null 2>&1 || [ -z "$NM_SRC" ]; then
  if [ -n "${CI:-}" ]; then
    bad "node + eslint + ts-morph + tsx are not installed under packages/core or the repo root — the arms cannot run in CI"
  else
    echo "· SKIP — node/eslint/ts-morph/tsx not installed (run npm ci --prefix packages/core)"
  fi
  echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]; exit
fi
TSX="$NM_SRC/.bin/tsx"

# The physical path: the wirer's ESLint probe hands ESLint an absolute path, and through a symlinked
# temp dir (macOS /var → /private/var) ESLint ignores it as outside its base path — a false «ok».
WORK=$(cd "$(mktemp -d)" && pwd -P)
trap 'rm -rf "$WORK"' EXIT

RECOGNISED="export default [{ rules: { 'no-console': 'warn' } }];"
UNRECOGNISED="export default { rules: { 'no-console': 'warn' } };"
# F1's config lints TypeScript, as a ts-server package config does: the wirer's probe checks a .ts file,
# and a config matching none leaves the probe nothing to check.
TS_CONFIG="import tsParser from '@typescript-eslint/parser';
export default [{ files: ['**/*.ts'], languageOptions: { parser: tsParser } }, { rules: { 'no-console': 'warn' } }];"

# ─── F1/F2: the install's Layer-2 pass (99-finalize.sh) on a getff-placed per-package config ───
# make_project <name> <per-package config body> — getff placed both configs (this run staged them),
# a stub rules-as-tests barrel, node_modules linked read-only.
make_project() {
  local p="$WORK/$1"
  mkdir -p "$p/apps/api" "$p/eslint-rules-local"
  printf '{"name":"%s","version":"0.0.0","type":"module"}\n' "$1" > "$p/package.json"
  printf 'export default [];\n' > "$p/eslint.config.mjs"
  printf '%s\n' "$2" > "$p/apps/api/eslint.config.mjs"
  printf "export default { rules: { 'no-unsafe-zod-parse': { create: () => ({}) } } };\n" > "$p/eslint-rules-local/index.mjs"
  ln -s "$NM_SRC" "$p/node_modules"
  echo "$p"
}

# Stub package root: the real R2 wirer (it imports node built-ins only, so a single-file copy is whole),
# the real boundary detector the own-config branch reads, and a no-op synth bundle, so only the R2
# pass under test runs.
PKG="$WORK/pkg"
mkdir -p "$PKG/packages/core/install" "$PKG/packages/core/audit-self"
cp "$WIRER" "$PKG/packages/core/install/"
cp "$REPO_ROOT/packages/core/audit-self/detect-r2-boundary.sh" "$PKG/packages/core/audit-self/"
printf 'console.log("stub synth");\n' > "$PKG/packages/core/install/synth-and-wire.bundle.mjs"

DRIVER="$WORK/driver.sh"
cat > "$DRIVER" << 'EOF'
set -o pipefail
FULL=""; DRY_RUN=""; STACK="ts-server"; _r2_verdict="boundary-present"
SKIPPED=(); NOT_WIRED=(); DEVDEPS=(placeholder-dev); RUNTIME_DEPS=(placeholder-rt)
_detect_stacks_per_workspace() { :; }
ignore_shipped_configs() { :; }
detect_pm() { echo npm; }
warn_preset_staleness() { :; }
reassert_husky_shields() { :; }
# `npx --no-install tsx <wirer> <args>` → the repo's tsx, with the wirer's arguments recorded; with
# NPX_STUB_OUT set, a stand-in wirer that prints it (printf %b) and returns NPX_STUB_RC.
npx() {
  shift 2; printf '%s\n' "$*" >> "$ARGS_LOG"
  if [ -n "${NPX_STUB_OUT+x}" ]; then printf '%b' "$NPX_STUB_OUT"; return "${NPX_STUB_RC:-0}"; fi
  "$TSX" "$@"
}
source "$REPO_ROOT/setup.d/lib.sh"
# This run staged apps/api's config (getff placed it now), unless API_FROM_MANIFEST says an earlier
# install did — then only the project's refresh-baseline manifest records it.
REFRESH_BASELINE_STAGED=("$PROJECT_ROOT/eslint.config.mjs")
[ -n "${API_FROM_MANIFEST:-}" ] || REFRESH_BASELINE_STAGED+=("$PROJECT_ROOT/apps/api/eslint.config.mjs")
source "$FINALIZE"
EOF

# run_finalize <project> [VAR=value…] → output in $F_OUT, the wirer's recorded arguments in $F_ARGS
run_finalize() {
  local p="$1" log="$WORK/$(basename "$1").args"
  shift
  : > "$log"
  F_OUT=$(env -u CI REPO_ROOT="$REPO_ROOT" PROJECT_ROOT="$p" PKG_ROOT="$PKG" FINALIZE="$FINALIZE" \
    TSX="$TSX" ARGS_LOG="$log" "$@" bash "$DRIVER" < /dev/null 2>&1)
  F_ARGS=$(cat "$log")
}
h256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{print $1}'; }
# summary_has <extended regex after the «      - » prefix> — the NOT wired summary holds that entry
summary_has() { grep -qE "^      - $1" <<<"$F_OUT"; }

F1=$(make_project f1 "$TS_CONFIG")
run_finalize "$F1"
printf 'export const x = 1;\n' > "$F1/apps/api/probe.ts"
(cd "$F1/apps/api" && node "$NM_SRC/eslint/bin/eslint.js" probe.ts >/dev/null 2>&1); lint_rc=$?
if [ -z "$F_ARGS" ]; then
  bad "F1: the Layer-2 pass never ran the R2 wirer, so F1 proves nothing (tail: $(printf '%s\n' "$F_OUT" | tail -4 | tr '\n' '|'))"
elif grep -q 'rules-as-tests/no-unsafe-zod-parse' "$F1/apps/api/eslint.config.mjs" && [ "$lint_rc" -ne 2 ] \
     && ! grep -qiE "$MANUAL" <<<"$F_OUT" && ! summary_has 'R2 '; then
  ok "F1: getff's own per-package config is wired on an install without --full (ESLint loads it, rc=$lint_rc), no manual step, nothing in NOT wired"
else
  bad "F1: expected R2 in apps/api/eslint.config.mjs, ESLint loading it, no manual step and no NOT wired entry (eslint rc=$lint_rc; wirer args: $(printf '%s' "$F_ARGS" | tr '\n' '|'); manual: $(manual_lines "$F_OUT"); summary: $(printf '%s\n' "$F_OUT" | grep -E '^      - ' | tr '\n' '|'))"
fi

F2=$(make_project f2 "$UNRECOGNISED")
run_finalize "$F2"
if [ -z "$F_ARGS" ]; then
  bad "F2: the Layer-2 pass never ran the R2 wirer, so F2 proves nothing"
elif grep -qE '^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/api/eslint.config.mjs — .+' <<<"$F_OUT" \
     && ! grep -qiE "$MANUAL" <<<"$F_OUT" \
     && [ "$(cat "$F2/apps/api/eslint.config.mjs")" = "$UNRECOGNISED" ]; then
  ok "F2: an export the wirer cannot append to → NOT wired names the config with its reason, no manual step"
else
  bad "F2: expected a NOT wired line for apps/api/eslint.config.mjs and no manual step (manual: $(manual_lines "$F_OUT"); summary: $(printf '%s\n' "$F_OUT" | grep -E '^      - ' | tr '\n' '|'))"
fi

EDITED="import tsParser from '@typescript-eslint/parser';
export default [
  // team note: the parser entry stays first
  { files: ['**/*.ts'], languageOptions: { parser: tsParser } },
  { rules: { 'no-console': 'warn' } },
];"
F3=$(make_project f3 "$EDITED")
mkdir -p "$F3/apps/api/routes" "$F3/.ai-factory"
printf 'export const users = (body: unknown) => body;\n' > "$F3/apps/api/routes/users.ts"
printf '%s\n' "$TS_CONFIG" > "$WORK/f3-as-placed.mjs"
printf '{"apps/api/eslint.config.mjs":"%s"}\n' "$(h256 "$WORK/f3-as-placed.mjs")" > "$F3/.ai-factory/refresh-baseline.json"
run_finalize "$F3" API_FROM_MANIFEST=1
f3_cfg=$(cat "$F3/apps/api/eslint.config.mjs")
if [ -z "$F_ARGS" ]; then
  bad "F3: the Layer-2 pass never ran the R2 wirer, so F3 proves nothing (tail: $(printf '%s\n' "$F_OUT" | tail -4 | tr '\n' '|'))"
elif grep -q 'team note: the parser entry stays first' <<<"$f3_cfg" \
     && grep -qE "\{ ?files: RULE_GLOBS\.boundary, plugins: \{[^}]*\}, rules: \{ ?'rules-as-tests/no-unsafe-zod-parse'" \
          <<<"$(printf '%s\n' "$f3_cfg" | tr -d '\n')" \
     && grep -rqF 'team note: the parser entry stays first' "$F3/.ai-factory/before-getff" 2>/dev/null \
     && ! grep -qiE "$MANUAL" <<<"$F_OUT"; then
  ok "F3: a getff-placed config the consumer edited since gets R2 by insertions, scoped to the boundary, its original kept"
else
  bad "F3: expected the consumer's comment kept, R2 scoped to RULE_GLOBS.boundary and the original under .ai-factory/before-getff/ (wirer args: $(printf '%s' "$F_ARGS" | tr '\n' '|'); config: $(printf '%s' "$f3_cfg" | tr '\n' ' '))"
fi

F6=$(make_project f6 "$TS_CONFIG")
mkdir -p "$F6/.ai-factory"
printf '{"apps/api/eslint.config.mjs":"%s"}\n' "$(h256 "$F6/apps/api/eslint.config.mjs")" > "$F6/.ai-factory/refresh-baseline.json"
run_finalize "$F6" API_FROM_MANIFEST=1
if grep -q -- '--yes --install' <<<"$F_ARGS" && ! grep -q -- '--own-config' <<<"$F_ARGS" \
   && grep -q 'rules-as-tests/no-unsafe-zod-parse' "$F6/apps/api/eslint.config.mjs"; then
  ok "F6: paired — a manifest-recorded config with its bytes unchanged is still getff's own and gets R2"
else
  bad "F6: an unedited manifest-recorded config left getff's own branch (wirer args: $(printf '%s' "$F_ARGS" | tr '\n' '|'))"
fi

F4=$(make_project f4 "$TS_CONFIG")
run_finalize "$F4" NPX_STUB_OUT= NPX_STUB_RC=1
summary_has 'R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/api/eslint.config.mjs — the R2 wirer did not add it' \
  && ok "F4: a wirer that crashes without a word still leaves the config named in NOT wired" \
  || bad "F4: a silent wirer crash dropped out of the NOT wired summary (summary: $(printf '%s\n' "$F_OUT" | grep -E '^      - ' | tr '\n' '|'))"

F5=$(make_project f5 "$TS_CONFIG")
run_finalize "$F5" 'NPX_STUB_OUT=✓ R2 wired into apps/api/eslint.config.mjs\n  · not wired: RULE_GLOBS in apps/api/eslint.config.mjs — the stub could not add it\n'
summary_has 'RULE_GLOBS in apps/api/eslint.config.mjs — the stub could not add it' \
  && ok "F5: a part the wirer could not add reaches NOT wired even when R2 itself landed" \
  || bad "F5: a not-wired part printed next to «✓ R2 wired» was dropped (summary: $(printf '%s\n' "$F_OUT" | grep -E '^      - ' | tr '\n' '|'))"

# ─── W1-W3, H1: the wirer CLI itself ─────────────────────────────────────────
# run_wirer <dir> <args…> → output in $W_OUT, rc in $W_RC (cwd = the consumer, as the install runs it)
run_wirer() {
  local d="$1"; shift
  W_OUT=$(cd "$d" && "$TSX" "$WIRER" "$@" < /dev/null 2>&1)
  W_RC=$?
}
# not_wired_only <arm> <what the reason must mention>
not_wired_only() {
  if [ "$W_RC" -eq 0 ] && grep -qE "^  · not wired: R2 .* — .*$2" <<<"$W_OUT" \
     && ! grep -qiE "$MANUAL" <<<"$W_OUT"; then
    ok "$1: one «not wired» line naming $2, no manual step"
  else
    bad "$1: expected rc 0 + a «  · not wired: R2 … — …$2» line + no manual step, got rc=$W_RC (manual: $(manual_lines "$W_OUT"); out: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
  fi
}

W1="$WORK/w1"; mkdir -p "$W1"
printf '%s\n' "$RECOGNISED" > "$W1/eslint.config.mjs"
run_wirer "$W1" --path eslint.config.mjs --yes --install
not_wired_only W1 'ts-morph'

# W2/W3: ts-morph present, ESLint not resolvable from the consumer.
W2="$WORK/w2"; mkdir -p "$W2/node_modules"
ln -s "$NM_SRC/ts-morph" "$W2/node_modules/ts-morph"
printf '{"name":"w2","version":"0.0.0","type":"module"}\n' > "$W2/package.json"
printf '%s\n' "$RECOGNISED" > "$W2/eslint.config.mjs"
run_wirer "$W2" --path eslint.config.mjs --yes --install
not_wired_only W2 'unavailable'
[ "$(cat "$W2/eslint.config.mjs")" = "$RECOGNISED" ] \
  && ok "W2: the unconfirmed write was undone — the config is as it was" \
  || bad "W2: the config was left changed: $(tr '\n' ' ' < "$W2/eslint.config.mjs")"

run_wirer "$W2" --path eslint.config.mjs --install
not_wired_only W3 '--yes'
[ "$(cat "$W2/eslint.config.mjs")" = "$RECOGNISED" ] \
  && ok "W3: nothing written without --yes" \
  || bad "W3: the config was changed without --yes"

printf '%s\n' "$UNRECOGNISED" > "$W2/eslint.config.mjs"
ln -s "$W2" "$WORK/w2-alias"
run_wirer "$W2" --path "$WORK/w2-alias/eslint.config.mjs" --yes --install
if grep -qE '^  · not wired: R2 \(rules-as-tests/no-unsafe-zod-parse\) in eslint.config.mjs — ' <<<"$W_OUT"; then
  ok "W4: a config reached through a symlink is named by its path in the project, not by a ../ walk"
else
  bad "W4: the not-wired line names the config by a path the consumer cannot read (out: $(printf '%s\n' "$W_OUT" | grep 'not wired' | head -1))"
fi

run_wirer "$W2" --path eslint.config.mjs --yes
if grep -q 'Add manually' <<<"$W_OUT" && ! grep -q '· not wired: ' <<<"$W_OUT"; then
  ok "H1: paired — a human running the CLI without --install still gets the snippet to act on"
else
  bad "H1: the standalone CLI lost its human snippet (out: $(printf '%s\n' "$W_OUT" | tail -3 | tr '\n' '|'))"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
