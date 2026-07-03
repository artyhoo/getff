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
# R2 scoped wiring (files: ['apps/api/**']) is gated on ts-morph availability in the
# fixture's node_modules — absent in CI/test env → degrade path is asserted instead.
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
echo "▶ §6 Unknown workspace: re-checkable marker emitted, rc=0 (not exit 1)"
# packages/config has no stack signal → 40-configs.sh echoes the re-checkable marker warning
grep -qi "re-checkable\|unknown stack" "$T/.install.log" 2>/dev/null \
  && ok "unknown workspace: re-checkable marker emitted in install log (not silently dropped, rc=0)" \
  || bad "unknown workspace: no re-checkable marker in install log ($(tail -5 "$T/.install.log" 2>/dev/null | tr '\n' '|'))"
# NEG: unknown must NOT cause exit 1 (install_into already asserts rc=0; this NEG proves it's not
# because the unknown path was silently skipped — the warning IS there)

# R2 scoped wiring: ts-morph availability gates the stronger assertion
if [ -f "$T/node_modules/ts-morph/package.json" ]; then
  echo ""
  echo "▶ §6b R2 scoped wiring (ts-morph available) — files: ['apps/api/**'] in config"
  grep -qF "files: ['apps/api/**']" "$T/apps/api/eslint.config.mjs" 2>/dev/null \
    && ok "R2 scoped: apps/api eslint.config.mjs has { files: ['apps/api/**'], rules: { R2 } } block" \
    || bad "R2 scoped: files: ['apps/api/**'] block NOT found in apps/api/eslint.config.mjs"
  # NEG: apps/mobile must NOT have an R2 apps/api-scoped block
  ! grep -qF "files: ['apps/api/**']" "$T/apps/mobile/eslint.config.mjs" 2>/dev/null \
    && ok "neg: apps/mobile does NOT have R2 apps/api-scoped block (R2 is server-only)" \
    || bad "neg: apps/mobile has R2 apps/api-scoped block — R2 incorrectly wired to react-native workspace"
else
  # ts-morph absent → degrade path is correct behavior (not a failure)
  echo "  · ts-morph absent in fixture node_modules — R2 scoped wiring degrades (correct test-env behavior)"
  grep -qi "r2.*per-workspace.*not available\|add R2 manually\|per-workspace.*ts-morph" "$T/.install.log" 2>/dev/null \
    && ok "R2 degrade path: degrade message emitted (manual wiring instruction present)" \
    || bad "R2 degrade path: no degrade message found (log: $(tail -8 "$T/.install.log" 2>/dev/null | tr '\n' '|'))"
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
[ -f "$T/.dependency-cruiser.cjs" ] \
  && ok "§9 arch:check: root .dependency-cruiser.cjs placed in the multi-stack branch (Batch B)" \
  || bad "§9 arch:check: root .dependency-cruiser.cjs NOT placed (arch:check would exit 1)"

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

rm -rf "$T"

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
