#!/usr/bin/env bash
# multi-stack-monorepo.test.sh — §13.5 I-2 L2 timeliner acceptance + no-regression
# (Tasks 6 + 7 of the per-workspace scoping primitive implementation).
#
# §1 Per-workspace eslint.config.mjs placement (40-configs.sh loop)
# §2 Per-workspace eslint-rules-local stubs (3-level re-export path)
# §3 No root eslint.config.mjs in multi-stack mode (secondary stack NOT dropped #780)
# §4 ts-server template content in apps/api (correct stack, no cross-contamination)
# §5 react-native/expo template content in apps/mobile (secondary retained)
# §6 Unknown workspace: re-checkable marker emitted, rc=0 (not exit 1)
# §7 No-regression: flat single-stack ts-server repo unchanged vs I-1 baseline
# §8 No-regression: flat react-native repo unchanged
#
# §6a R2 without ts-morph (the default install): no manual step, no line for getff's own template
# §6b R2 with ts-morph: the real wirer adds R2 to the consumer's workspace config, scoped by the
#     boundary globs under that workspace — no dir-prefixed files: glob (scoping is by placement)
# §6c R2 without ts-morph: the consumer's own workspace config with boundary code is a NOT wired line
# PAIRED-NEGATIVE on every load-bearing assertion (per arch-target-monorepo.test.sh pattern).

set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# install_into <dir> <stack>: runs install.sh --force, captures rc.
# </dev/null answers "N" to every interactive prompt (dev-dep install, etc.).
install_into() {
  local dir="$1" stack="$2"
  ( cd "$dir" && git init -q && bash "$INSTALL_SH" "$stack" --force </dev/null ) \
    >"$dir/.install.log" 2>&1
  local rc=$?
  [ "$rc" = "0" ] || bad "install rc=$rc (non-zero — tail: $(tail -3 "$dir/.install.log" | tr '\n' '|'))"
  return 0
}

# ══════════════════════════════════════════════════════════════════════════════════════════
# §1–§6 Timeliner fixture: ts-server (apps/api) + react-native/expo (apps/mobile)
# Timeliner shape: pnpm monorepo, root has only typescript (T-MSM-A trap: root-only detect
# drops apps/mobile react-native; per-workspace walk recovers it).
# ══════════════════════════════════════════════════════════════════════════════════════════

T=$(mktemp -d)

# Root: only typescript (pnpm monorepo root — no per-workspace stack signal here)
printf '{ "name": "timeliner-mono", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/package.json"
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > "$T/pnpm-workspace.yaml"

# apps/api: ts-server (Hono) — triggers ts-server template + eslint-rules-local stub
mkdir -p "$T/apps/api"
printf '{ "name": "@timeliner/api", "dependencies": { "hono": "4.0.0" }, "devDependencies": { "typescript": "5.6.0" } }\n' \
  > "$T/apps/api/package.json"

# apps/mobile: react-native with expo — triggers expo template (has "expo" dep key)
mkdir -p "$T/apps/mobile"
printf '{ "name": "@timeliner/mobile", "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0", "react": "18.3.0" } }\n' \
  > "$T/apps/mobile/package.json"

# packages/config: no stack signal → 'unknown' path (re-checkable marker, not exit 1)
mkdir -p "$T/packages/config"
printf '{ "name": "@timeliner/config", "version": "0.0.0" }\n' > "$T/packages/config/package.json"

install_into "$T" ts-server

echo "▶ §1 Per-workspace preset placement — correct stack per workspace, secondary NOT dropped"
[ -f "$T/apps/api/eslint.config.mjs" ] \
  && ok "apps/api/eslint.config.mjs placed (ts-server preset)" \
  || bad "apps/api/eslint.config.mjs NOT placed"
[ -f "$T/apps/mobile/eslint.config.mjs" ] \
  && ok "apps/mobile/eslint.config.mjs placed (react-native/expo preset — secondary retained, #780)" \
  || bad "apps/mobile/eslint.config.mjs NOT placed — secondary stack silently dropped (#780)"

echo ""
echo "▶ §2 Per-workspace eslint-rules-local stubs (2-level-deep workspaces → 3 '../' to root)"
[ -f "$T/apps/api/eslint-rules-local/index.mjs" ] \
  && ok "apps/api/eslint-rules-local/index.mjs stub created" \
  || bad "apps/api/eslint-rules-local/index.mjs NOT created"
[ -f "$T/apps/mobile/eslint-rules-local/index.mjs" ] \
  && ok "apps/mobile/eslint-rules-local/index.mjs stub created" \
  || bad "apps/mobile/eslint-rules-local/index.mjs NOT created"
# Stub must re-export from ../../../eslint-rules-local/index.mjs (3 '../' for container/name depth)
grep -q '../../../eslint-rules-local/index.mjs' "$T/apps/api/eslint-rules-local/index.mjs" 2>/dev/null \
  && ok "apps/api stub: re-exports via '../../../' (3 levels = container/name depth)" \
  || bad "apps/api stub has wrong path ($(cat "$T/apps/api/eslint-rules-local/index.mjs" 2>/dev/null | tr '\n' '|'))"
grep -q '../../../eslint-rules-local/index.mjs' "$T/apps/mobile/eslint-rules-local/index.mjs" 2>/dev/null \
  && ok "apps/mobile stub: re-exports via '../../../' (3 levels)" \
  || bad "apps/mobile stub has wrong path ($(cat "$T/apps/mobile/eslint-rules-local/index.mjs" 2>/dev/null | tr '\n' '|'))"
# NEG: stub must NOT point to root directly (../eslint-rules-local would go too far up)
! grep -q '"../../eslint-rules-local/index.mjs"' "$T/apps/api/eslint-rules-local/index.mjs" 2>/dev/null \
  && ok "neg: stub does NOT use 2-level path (would overshoot into parent of project root)" \
  || bad "neg: stub uses 2-level path — wrong depth for container/name workspace"

echo ""
echo "▶ §3 No root eslint.config.mjs in multi-stack mode (per-workspace only)"
! [ -f "$T/eslint.config.mjs" ] \
  && ok "No root eslint.config.mjs — multi-stack path does not place a global config" \
  || bad "Root eslint.config.mjs placed — would shadow per-workspace configs (regression)"

echo ""
echo "▶ §4 ts-server template content in apps/api (no cross-stack contamination)"
# ts-server template has "server-side TypeScript" comment
grep -q 'server-side TypeScript\|typescript-eslint\|tsconfigRootDir' "$T/apps/api/eslint.config.mjs" 2>/dev/null \
  && ok "apps/api has ts-server template content (tsconfigRootDir, typescript-eslint present)" \
  || bad "apps/api eslint.config.mjs lacks ts-server markers (head: $(head -4 "$T/apps/api/eslint.config.mjs" 2>/dev/null | tr '\n' '|'))"
# NEG: apps/api must NOT have expo/react-native PLUGIN content (comments mentioning react-native
# for reference purposes are OK — test for actual plugin imports/usage)
! grep -qi 'eslint-config-expo\|expo/flat\|import.*react-native\|eslint-plugin-react-native' "$T/apps/api/eslint.config.mjs" 2>/dev/null \
  && ok "neg: apps/api does NOT contain react-native plugin imports (no stack cross-contamination)" \
  || bad "neg: apps/api has react-native plugin imports — stacks are cross-contaminated"
# eslint-rules-local import uses relative path from workspace dir (the stub we just created)
grep -q "from './eslint-rules-local/index.mjs'" "$T/apps/api/eslint.config.mjs" 2>/dev/null \
  && ok "apps/api: eslint.config.mjs imports ./eslint-rules-local/index.mjs (resolved by stub)" \
  || bad "apps/api: eslint-rules-local import path not found in config"

echo ""
echo "▶ §5 react-native/expo template in apps/mobile (secondary NOT dropped, #780 nuance)"
# expo template has "eslint-config-expo" or "Expo" marker
grep -qi 'expo\|react-native\|React Native' "$T/apps/mobile/eslint.config.mjs" 2>/dev/null \
  && ok "apps/mobile has react-native/expo template content (secondary stack retained)" \
  || bad "apps/mobile eslint.config.mjs lacks react-native markers — secondary stack dropped! (head: $(head -4 "$T/apps/mobile/eslint.config.mjs" 2>/dev/null | tr '\n' '|'))"
# NEG: apps/mobile must NOT have ts-server content
! grep -q 'server-side TypeScript' "$T/apps/mobile/eslint.config.mjs" 2>/dev/null \
  && ok "neg: apps/mobile does NOT contain ts-server content (no cross-contamination)" \
  || bad "neg: apps/mobile has ts-server content — stacks are cross-contaminated"

echo ""
echo "▶ §6 Signal-free workspace inherits the explicit stack arg (P0.3: no stranded config gap), rc=0"
# packages/config has no stack signal. Pre-P0.3 the multi-stack branch IGNORED the explicit
# `./setup ts-server` arg and stranded it as 'unknown' → no eslint config → lint DoS on that package.
# Under the P0.3 precedence (own signal > explicit arg > root signal > unknown) the signal-free
# workspace inherits the explicit ts-server arg, so it IS configured (and the install stays rc=0).
[ -f "$T/packages/config/eslint.config.mjs" ] \
  && ok "packages/config inherits ts-server via the explicit arg (signal-free workspace not stranded)" \
  || bad "packages/config got NO eslint config — signal-free workspace stranded (P0.3 regression)"
grep -qF 'packages/config → ts-server preset (explicit stack arg)' "$T/.install.log" 2>/dev/null \
  && ok "install output shows WHY: packages/config → ts-server (explicit stack arg provenance)" \
  || bad "no explicit-arg provenance for packages/config ($(grep -i 'packages/config' "$T/.install.log" 2>/dev/null | tr '\n' '|'))"
# NEG (load-bearing): the pre-P0.3 40-configs 'no eslint config placed' stranding marker for
# packages/config must be GONE — proving the explicit arg is honored, not silently skipped.
! grep -qi 'packages/config: unknown stack.*no eslint config placed' "$T/.install.log" 2>/dev/null \
  && ok "neg: packages/config no longer stranded config-less (explicit arg honored, not skipped)" \
  || bad "neg: packages/config still stranded 'no eslint config placed' despite explicit arg (P0.3 unfixed)"

# R2 without ts-morph (the fixture's node_modules never holds it: install_into declines the dev-dep
# step) → the pass cannot run. Operator decision Q4.7 (2026-09-28): what it would have changed is a
# «NOT wired» summary line with the reason, never a manual step. apps/api holds getff's ts-server
# template, which already names R2, so there is nothing to list for it. The pass running for real is §6b.
echo ""
echo "▶ §6a R2 without ts-morph — no manual step, no NOT wired line for getff's own template"
[ ! -e "$T/node_modules/ts-morph/package.json" ] \
  && ok "§6a premise: no ts-morph in the fixture's node_modules (the R2 pass cannot run)" \
  || bad "§6a premise: ts-morph is in the fixture's node_modules — §6a no longer tests the no-ts-morph path"
grep -qE '^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/api' "$T/.install.log" 2>/dev/null \
  && bad "R2 without ts-morph: apps/api is in the NOT wired summary, yet its template already names R2" \
  || ok "R2 without ts-morph: no NOT wired line for apps/api (getff's template already names R2)"
grep -qiE 'R2.*(manually|by hand)|add R2 ' "$T/.install.log" 2>/dev/null \
  && bad "R2 without ts-morph: the log hands the consumer a manual R2 step ($(grep -iE 'R2.*(manually|by hand)|add R2 ' "$T/.install.log" | head -1))" \
  || ok "R2 without ts-morph: no manual R2 step in the log (Q4.7)"

# own_mono <dir> — a pnpm monorepo whose four workspaces each hold the consumer's own eslint config
# (no R2 in it) and HTTP boundary code: apps/api ts-server, apps/web react-next, apps/spa react-spa,
# apps/mobile react-native (its preset ships no R2).
own_mono() {
  printf '{ "name": "own-mono", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' > "$1/package.json"
  printf 'packages:\n  - "apps/*"\n' > "$1/pnpm-workspace.yaml"
  mkdir -p "$1/apps/api/src/routes" "$1/apps/web/app/api/users" "$1/apps/spa/src/api" "$1/apps/mobile/src/routes"
  printf '{ "name": "@own/api", "dependencies": { "hono": "4.0.0" }, "devDependencies": { "typescript": "5.6.0" } }\n' > "$1/apps/api/package.json"
  printf '{ "name": "@own/web", "dependencies": { "next": "15.0.0", "react": "19.0.0" }, "devDependencies": { "typescript": "5.6.0" } }\n' > "$1/apps/web/package.json"
  printf '{ "name": "@own/spa", "dependencies": { "react": "19.0.0" }, "devDependencies": { "typescript": "5.6.0", "vite": "6.0.0" } }\n' > "$1/apps/spa/package.json"
  printf '{ "name": "@own/mobile", "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0", "react": "18.3.0" } }\n' > "$1/apps/mobile/package.json"
  for _w in api web spa mobile; do
    printf "export default [{ rules: { 'no-console': 'warn' } }];\n" > "$1/apps/$_w/eslint.config.mjs"
  done
  printf 'export const users = (req: { body: unknown }) => schema.parse(req.body);\n' > "$1/apps/api/src/routes/users.ts"
  printf 'export const POST = async (req: Request) => schema.parse(await req.json());\n' > "$1/apps/web/app/api/users/route.ts"
  printf 'export const getUser = async () => schema.parse(await (await fetch("/api/user")).json());\n' > "$1/apps/spa/src/api/client.ts"
  printf 'export const users = (req: { body: unknown }) => schema.parse(req.body);\n' > "$1/apps/mobile/src/routes/users.ts"
}

# §6c the positive half of the arm above, in a real install: a workspace config the consumer owns,
# with HTTP boundary code under it, and no ts-morph → the NOT wired summary names it with the
# ts-morph / --full reason — for a ts-server (apps/api), a react-next (apps/web) and a react-spa
# (apps/spa) workspace, whose getff presets all carry R2 on boundary code; not for the react-native
# one (apps/mobile), whose preset ships no R2. No --force, so 40-configs keeps the consumer's files.
echo ""
echo "▶ §6c R2 without ts-morph: the consumer's own workspace config with boundary code is a NOT wired line"
O=$(mktemp -d); own_mono "$O"
( cd "$O" && git init -q && bash "$INSTALL_SH" ts-server </dev/null ) > "$O/.install.log" 2>&1 \
  || bad "§6c install rc non-zero (tail: $(tail -3 "$O/.install.log" | tr '\n' '|'))"
if [ -f "$O/node_modules/ts-morph/package.json" ]; then
  echo "  · SKIP §6c — ts-morph is in the fixture's node_modules, so the pass runs instead"
else
  for _w in api web spa; do
    grep -qE "^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/$_w/eslint.config.mjs — .*ts-morph.*--full" "$O/.install.log" \
      && ok "§6c: apps/$_w (your config, boundary code) is a NOT wired line naming ts-morph and --full" \
      || bad "§6c: no NOT wired line for apps/$_w naming ts-morph / --full (summary: $(grep -E '^      - ' "$O/.install.log" | tr '\n' '|'))"
  done
  grep -qE '^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/mobile' "$O/.install.log" \
    && bad "neg §6c: apps/mobile (react-native) is listed for R2 — its preset ships no R2" \
    || ok "neg §6c: apps/mobile (react-native) is not listed for R2"
fi
rm -rf "$O"

# §6b the pass running for real (it replaces an arm that asserted a files: ['apps/api/**'] block the
# install stopped emitting with --scope, and that ran only when the fixture's node_modules held
# ts-morph — never in CI). The pass checks for ts-morph by its package.json in the project and then
# runs `npx --no-install tsx <wirer>`, which loads ts-morph from the project's node_modules
# (wire-eslint-r2.ts resolves it from cwd). So the fixture's node_modules/ts-morph is a symlink to
# the framework's (installed in the install-sh-c job), and a stand-in npx on PATH routes that one
# call to the framework's tsx: the real wirer edits the consumer's configs. Stand-in npm/pnpm/yarn
# refuse any install, so none can run through the symlink. Expected: R2 in each ts-server,
# react-next and react-spa workspace config, scoped by the boundary globs found under that workspace
# — never by a dir-prefixed files: glob, which inside a workspace-local config resolves against that
# config's own directory ('apps/api/**' → apps/api/apps/api/**, nothing; 99-finalize.sh R2
# per-workspace block). The react-native config stays as it was.
echo ""
echo "▶ §6b R2 with ts-morph: the real wirer adds R2 to the consumer's workspace configs, scoped by boundary globs"
# The framework's install: packages/core's own node_modules, or the root one, where the job's
# workspace `npm install` hoists tsx and ts-morph (audit-self.yml, install-sh-c) — both from one dir.
NM_SRC=""
for _nm in "$REPO_ROOT/packages/core/node_modules" "$REPO_ROOT/node_modules"; do
  [ -f "$_nm/ts-morph/package.json" ] && [ -x "$_nm/.bin/tsx" ] && NM_SRC="$_nm" && break
done
if [ -z "$NM_SRC" ]; then
  if [ -n "${CI:-}" ]; then
    bad "§6b: tsx + ts-morph are not installed under packages/core or the repo root — the arm cannot run in CI"
  else
    echo "  · SKIP §6b — tsx + ts-morph not installed (npm ci --prefix packages/core)"
  fi
else
  CORE_TSX="$NM_SRC/.bin/tsx"
  P=$(mktemp -d); own_mono "$P"
  mkdir -p "$P/node_modules"
  ln -s "$NM_SRC/ts-morph" "$P/node_modules/ts-morph"
  cp "$P/apps/mobile/eslint.config.mjs" "$P/.mobile-before.mjs"
  SHIM=$(mktemp -d)
  cat > "$SHIM/npx" << EOF
#!/usr/bin/env bash
if [ "\${1:-}" = --no-install ] && [ "\${2:-}" = tsx ]; then shift 2; exec "$CORE_TSX" "\$@"; fi
echo "stand-in npx: not routed: \$*" >&2; exit 127
EOF
  for _pm in npm pnpm yarn; do
    _real=$(command -v "$_pm" 2>/dev/null || true)
    cat > "$SHIM/$_pm" << EOF
#!/usr/bin/env bash
all="\$*"
refuse() { echo "stand-in $_pm: refusing '\$all' — the fixture's node_modules/ts-morph is a symlink" >&2; exit 127; }
[ "$_pm" = yarn ] && [ "\$#" -eq 0 ] && refuse
for a in "\$@"; do case "\$a" in
  i|install|ci|add|prune|remove|rm|uninstall|update|up|upgrade|dedupe|rebuild|link) refuse ;; esac; done
[ -n "$_real" ] && exec "$_real" "\$@"; exit 127
EOF
  done
  chmod +x "$SHIM/npx" "$SHIM/npm" "$SHIM/pnpm" "$SHIM/yarn"
  ( cd "$P" && git init -q && PATH="$SHIM:$PATH" bash "$INSTALL_SH" ts-server </dev/null ) > "$P/.install.log" 2>&1 \
    || bad "§6b install rc non-zero (tail: $(tail -3 "$P/.install.log" | tr '\n' '|'))"
  # <workspace>:<a boundary glob detect finds under it>
  for _wg in "api:**/routes/**" "web:**/app/api/**" "spa:**/api/**"; do
    _w="${_wg%%:*}"; _g="${_wg#*:}"; _c="$P/apps/$_w/eslint.config.mjs"
    grep -qF "files: RULE_GLOBS.boundary" "$_c" && grep -qF "'rules-as-tests/no-unsafe-zod-parse': 'error'" "$_c" \
      && grep -qF "'$_g/*.{ts,tsx}'" "$_c" \
      && ok "§6b: apps/$_w (your config) gets R2 on files: RULE_GLOBS.boundary, which lists '$_g'" \
      || bad "§6b: apps/$_w lacks R2 on RULE_GLOBS.boundary listing '$_g' (config: $(tr '\n' '|' < "$_c"); log: $(grep -E 'R2' "$P/.install.log" | tr '\n' '|'))"
    grep -qE "['\"](\./)?apps/" "$_c" \
      && bad "neg §6b: apps/$_w has a dir-prefixed glob — it resolves against apps/$_w itself and matches nothing ($(grep -E "['\"](\./)?apps/" "$_c" | tr '\n' '|'))" \
      || ok "neg §6b: apps/$_w has no dir-prefixed glob (scoping is by config placement)"
  done
  cmp -s "$P/.mobile-before.mjs" "$P/apps/mobile/eslint.config.mjs" \
    && ok "neg §6b: apps/mobile (react-native) config is left as it was (its preset ships no R2)" \
    || bad "neg §6b: apps/mobile (react-native) config was changed ($(tr '\n' '|' < "$P/apps/mobile/eslint.config.mjs"))"
  grep -qE '^      - R2 \(rules-as-tests/no-unsafe-zod-parse\) in apps/' "$P/.install.log" \
    && bad "§6b: R2 landed, yet the NOT wired summary lists an apps/ config ($(grep -E '^      - R2' "$P/.install.log" | tr '\n' '|'))" \
    || ok "§6b: no R2 line in the NOT wired summary once the pass ran"
  rm -rf "$P" "$SHIM"
fi

# ══════════════════════════════════════════════════════════════════════════════════════════
# §9 #807: the 4 root-anchored validate gates must not exit-2/RED on a no-root-config monorepo.
# The #793/#796 multi-stack restructure ships per-workspace configs + NO root eslint.config.mjs,
# but check:globs/check:enforced guard `[ -f "$CFG" ] || exit 2` BEFORE their shadow logic, and
# the multi-stack branch never placed .dependency-cruiser.cjs nor listed the per-ws configs in
# .prettierignore. Deps-free env (install_into answers N to the dep prompt → no eslint/prettier/
# depcruise): check:globs + check:enforced are dependency-free bash → exit-code assertions; arch/
# format are verified by PLACEMENT (file exists / in .prettierignore), not by running their tools.
# ══════════════════════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §9 #807: root-anchored validate gates on a no-root-config multi-stack monorepo"
# Plant a boundary source file under the ts-server workspace so check:globs exercises the real
# glob-liveness path (recurse → CFG found → R2 globs reach apps/api/src/routes) — not the trivial
# "no .ts source yet → skip". apps/mobile (Expo, no RULE_GLOBS.boundary) is the skip case.
mkdir -p "$T/apps/api/src/routes"
printf 'export const u = 1;\n' > "$T/apps/api/src/routes/users.ts"

# check:globs — recurses per-workspace (no root config), exits 0 instead of the exit-2 guard.
GLOBS_OUT=$( cd "$T" && bash scripts/check-rule-globs.sh 2>&1 ); GLOBS_RC=$?
[ "$GLOBS_RC" -eq 0 ] \
  && ok "§9 check:globs: exits 0 on no-root-config monorepo (was exit 2 — recursion fix)" \
  || bad "§9 check:globs: exit $GLOBS_RC (expected 0) — out: $(printf '%s' "$GLOBS_OUT" | tr '\n' '|')"
# PAIRED-NEGATIVE: the exit-2 "run from the project root" path must NOT be what we hit (proves we
# recursed into the per-workspace configs, not silently swallowed the guard).
! printf '%s' "$GLOBS_OUT" | grep -q 'not found (run from the project root)' \
  && ok "§9 neg check:globs: NOT the exit-2 'run from the project root' path (recursed per-ws)" \
  || bad "§9 neg check:globs: still hit the exit-2 root-config guard (recursion not reached)"

# check:enforced — same guard; eslint absent → each per-ws sub-invocation SKIPs → exit 0.
ENF_OUT=$( cd "$T" && bash scripts/check-rule-enforced.sh 2>&1 ); ENF_RC=$?
[ "$ENF_RC" -eq 0 ] \
  && ok "§9 check:enforced: exits 0 on no-root-config monorepo (was exit 2; eslint absent → SKIP)" \
  || bad "§9 check:enforced: exit $ENF_RC (expected 0) — out: $(printf '%s' "$ENF_OUT" | tr '\n' '|')"
! printf '%s' "$ENF_OUT" | grep -q 'not found (run from the project root)' \
  && ok "§9 neg check:enforced: NOT the exit-2 root-config guard path (recursed per-ws)" \
  || bad "§9 neg check:enforced: still hit the exit-2 root-config guard (recursion not reached)"

# arch:check (Batch B) — verified by PLACEMENT (deps-free: cannot run depcruise). Root config
# must be placed by the multi-stack branch (it only placed per-ws eslint before).
[ -f "$T/.dependency-cruiser.mjs" ] \
  && ok "§9 arch:check: root .dependency-cruiser.mjs placed in the multi-stack branch (Batch B)" \
  || bad "§9 arch:check: root .dependency-cruiser.mjs NOT placed (arch:check would exit 1)"

# format:check (Batch C) — verified by PLACEMENT (deps-free: cannot run prettier). The
# fresh-shipped per-workspace configs must be in the managed .prettierignore block.
grep -q 'apps/api/eslint.config.mjs' "$T/.prettierignore" 2>/dev/null \
  && ok "§9 format:check: apps/api/eslint.config.mjs in managed .prettierignore (Batch C)" \
  || bad "§9 format:check: apps/api/eslint.config.mjs NOT in .prettierignore ($(grep -c . "$T/.prettierignore" 2>/dev/null) lines)"
grep -q 'apps/mobile/eslint.config.mjs' "$T/.prettierignore" 2>/dev/null \
  && ok "§9 format:check: apps/mobile/eslint.config.mjs in managed .prettierignore (Batch C)" \
  || bad "§9 format:check: apps/mobile/eslint.config.mjs NOT in .prettierignore"
# PAIRED-NEGATIVE: all per-ws configs here are shipped-fresh (greenfield install) → they SHOULD
# appear. A consumer-authored (SKIPPED) config would NOT be added — covered in f15-prettierignore.

# ══════════════════════════════════════════════════════════════════════════════════════════
# §10 CI-orphan truth on a monorepo with NO workflow (defect seen 2026-09-28 on getff#1889):
# the multi-stack branch places no ci.yml, yet 60-ci.sh claimed «a pre-existing CI workflow was
# kept» and gave every gate the reason «the workflow is your own» — over an EMPTY workflows dir.
# ══════════════════════════════════════════════════════════════════════════════════════════
echo ""
echo "▶ §10 CI-orphan lines tell the truth when the monorepo has no workflow at all"
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
_wf_count=$(find "$T/.github/workflows" -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | wc -l | tr -d ' ')
[ "$_wf_count" = "0" ] \
  && ok "§10 precondition: the multi-stack install left .github/workflows/ without a workflow file" \
  || bad "§10 precondition: $_wf_count workflow file(s) present — the fixture no longer exercises the empty case"
grep -q "pre-existing CI workflow was kept" "$T/.install.log" \
  && bad "§10: install claims a pre-existing CI workflow was kept, but none exists" \
  || ok "§10: no «pre-existing CI workflow was kept» claim over an empty workflows dir"
grep -q "the workflow is your own" "$T/.install.log" \
  && bad "§10: NOT-wired reason says «the workflow is your own», but there is no workflow" \
  || ok "§10: no «the workflow is your own» reason over an empty workflows dir"
# The summary line itself (not the WARN header, which shares the phrase) carries the true reason.
grep -qE '^ +- CI gate .* runs in no CI job .*: no workflow exists under \.github/workflows/ — getff places its ci\.yml only in a repo with no workspace packages' "$T/.install.log" \
  && ok "§10: each gate's NOT-wired line says no workflow exists and why getff placed none" \
  || bad "§10: no NOT-wired line gives the no-workflow reason (saw: $(grep 'CI gate' "$T/.install.log" | head -1))"
_ms=$(manual_step_lines "$T/.install.log")
[ -z "$_ms" ] \
  && ok "§10: no printed line asks for a manual step (Q4.7)" \
  || bad "§10: a printed line asks for a manual step: $(printf '%s\n' "$_ms" | head -2 | tr '\n' '|')"

rm -rf "$T"

# §10 PAIRED-NEGATIVE: the same monorepo shape WITH its own workflow keeps the «your own» reason.
T10=$(mktemp -d)
printf '{ "name": "mono-own-ci", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' > "$T10/package.json"
printf 'packages:\n  - "apps/*"\n' > "$T10/pnpm-workspace.yaml"
mkdir -p "$T10/apps/api" "$T10/.github/workflows"
printf '{ "name": "@m/api", "dependencies": { "hono": "4.0.0" }, "devDependencies": { "typescript": "5.6.0" } }\n' > "$T10/apps/api/package.json"
printf 'name: CI\non: push\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n' > "$T10/.github/workflows/ci.yml"
install_into "$T10" ts-server
grep -q "the workflow is your own" "$T10/.install.log" \
  && ok "§10 neg: a monorepo with its own workflow still gets «the workflow is your own»" \
  || bad "§10 neg: own-workflow monorepo lost the «your own» reason (saw: $(grep 'CI gate' "$T10/.install.log" | head -1))"
grep -q "no workflow exists under" "$T10/.install.log" \
  && bad "§10 neg: own-workflow monorepo told «no workflow exists»" \
  || ok "§10 neg: own-workflow monorepo is not told that no workflow exists"
rm -rf "$T10"

# §10b A SINGLE-stack monorepo with no workflow, installed with --wire-ci: the reason must not call
# it multi-stack (the ci.yml skip keys on workspace packages, not on stack count), and there is
# nothing to wire into — no yq prompt, no yq install offer, no wire attempt, no file written.
T11=$(mktemp -d)
printf '{ "name": "mono-one-stack", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' > "$T11/package.json"
printf 'packages:\n  - "apps/*"\n' > "$T11/pnpm-workspace.yaml"
mkdir -p "$T11/apps/api" "$T11/apps/worker"
printf '{ "name": "@m/api", "dependencies": { "hono": "4.0.0" } }\n' > "$T11/apps/api/package.json"
printf '{ "name": "@m/worker", "dependencies": { "hono": "4.0.0" } }\n' > "$T11/apps/worker/package.json"
( cd "$T11" && git init -q && bash "$INSTALL_SH" ts-server --force --wire-ci </dev/null ) >"$T11/.install.log" 2>&1 \
  || bad "§10b: install rc=$? (tail: $(tail -3 "$T11/.install.log" | tr '\n' '|'))"
grep "CI gate" "$T11/.install.log" | grep -qi "multi-stack" \
  && bad "§10b: a single-stack monorepo's NOT-wired reason calls it multi-stack" \
  || ok "§10b: the NOT-wired reason does not call a single-stack monorepo multi-stack"
grep -qE '^ +- CI gate .* runs in no CI job .*this repo has workspace packages there' "$T11/.install.log" \
  && ok "§10b: the reason names the true condition — workspace packages" \
  || bad "§10b: no workspace-packages reason (saw: $(grep 'CI gate' "$T11/.install.log" | head -1))"
grep -qE "Auto-wire|--wire-ci: found no job|'yq' is not installed|auto-wired" "$T11/.install.log" \
  && bad "§10b: --wire-ci still tried to wire gates into a workflow that does not exist: $(grep -E "Auto-wire|--wire-ci|yq" "$T11/.install.log" | head -1)" \
  || ok "§10b: --wire-ci makes no wire attempt when no workflow exists"
_wf11=$(find "$T11/.github/workflows" -type f 2>/dev/null | wc -l | tr -d ' ')
[ "$_wf11" = "0" ] \
  && ok "§10b: .github/workflows/ still holds no file after --wire-ci" \
  || bad "§10b: --wire-ci wrote $_wf11 file(s) into .github/workflows/"
_ms11=$(manual_step_lines "$T11/.install.log")
[ -z "$_ms11" ] \
  && ok "§10b: no printed line asks for a manual step (Q4.7)" \
  || bad "§10b: a printed line asks for a manual step: $(printf '%s\n' "$_ms11" | head -2 | tr '\n' '|')"
rm -rf "$T11"

# ══════════════════════════════════════════════════════════════════════════════════════════
# §7 No-regression: flat single-stack ts-server repo unchanged vs I-1 baseline
# ══════════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "▶ §7 No-regression: flat ts-server repo — root eslint.config.mjs placed, no per-workspace loop"
F=$(mktemp -d)
printf '{ "name": "flat-api", "version": "0.0.0", "dependencies": { "hono": "4.0.0" } }\n' \
  > "$F/package.json"
install_into "$F" ts-server

[ -f "$F/eslint.config.mjs" ] \
  && ok "flat ts-server: root eslint.config.mjs placed (single-stack behavior unchanged)" \
  || bad "flat ts-server: root eslint.config.mjs NOT placed — regression vs I-1 baseline!"
# NEG: flat repo must NOT trigger per-workspace placement (no apps/api/eslint.config.mjs)
! [ -f "$F/apps/api/eslint.config.mjs" ] \
  && ok "neg: flat repo: no per-workspace apps/api/eslint.config.mjs (multi-stack path not triggered)" \
  || bad "neg: flat repo triggered multi-stack placement — multi-stack detection regression"
# §9 #807 no-regression: flat path has a ROOT eslint.config.mjs → the recursion guard must NOT fire;
# check:globs behaves exactly as before (root config found, globs reach the boundary → exit 0).
mkdir -p "$F/src/routes"
printf 'export const u = 1;\n' > "$F/src/routes/users.ts"
FLAT_OUT=$( cd "$F" && bash scripts/check-rule-globs.sh 2>&1 ); FLAT_RC=$?
[ "$FLAT_RC" -eq 0 ] \
  && ok "§9 no-regression: flat ts-server check:globs still exits 0 (root config, no recursion)" \
  || bad "§9 no-regression: flat ts-server check:globs exit $FLAT_RC — out: $(printf '%s' "$FLAT_OUT" | tr '\n' '|')"
rm -rf "$F"

# ══════════════════════════════════════════════════════════════════════════════════════════
# §8 No-regression: flat react-native repo unchanged
# ══════════════════════════════════════════════════════════════════════════════════════════

echo ""
echo "▶ §8 No-regression: flat react-native repo — root eslint.config.mjs placed, no per-workspace"
RN=$(mktemp -d)
printf '{ "name": "flat-mobile", "version": "0.0.0", "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0" } }\n' \
  > "$RN/package.json"
install_into "$RN" react-native

[ -f "$RN/eslint.config.mjs" ] \
  && ok "flat react-native: root eslint.config.mjs placed (single-stack behavior unchanged)" \
  || bad "flat react-native: root eslint.config.mjs NOT placed — regression vs baseline!"
# NEG: flat repo must NOT trigger per-workspace placement
! [ -d "$RN/apps" ] \
  && ok "neg: flat react-native: no apps/ dir created (multi-stack path not triggered)" \
  || bad "neg: flat react-native triggered multi-stack path — regression"
rm -rf "$RN"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
