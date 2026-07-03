#!/usr/bin/env bash
# cih-s3 F3 + F7 + V — custom-rule glob liveness across project layouts.
#
# THE BUG (F3): the shipped eslint configs scoped R2/R7/R8 to `src/`+DDD globs
# (`src/web/handlers`, `src/application`, …). On a flat Hono server or a pnpm monorepo
# those match ZERO files → the rule is SILENTLY INERT ("armed, checks nothing").
# THE FIX (F3): layout-agnostic globs (`**/handlers/**`, `**/routes/**`, `**/app/api/**`,
#   monorepo `apps/*`/`packages/*` reached via `**/`) so the shields fire on flat, layered,
#   AND monorepo shapes.
# THE FIX (F7): R7/R8 demand infra (Clock/Random, OTel) a fresh skeleton lacks → deferred
#   unless AIF_STRICT_RUNTIME=1. R2 stays unconditional.
# THE BACKSTOP (V, maintainer DN-1 "A+V"): scripts/check-rule-globs.sh FAILS if an ACTIVE
#   rule matches zero source files — the alarm for a layout the broad globs still miss.
#
# SCOPE NOTE (T3, avoid the "0 matches" trap): that a rule FIRES on a `.parse()` is covered
# by the rule's own RuleTester unit test (packages/core/eslint-rules/no-unsafe-zod-parse.test.ts
# `invalid:`). THIS probe proves the orthogonal F3 concern — the globs REACH the right files on
# each layout — via the shipped V-gate (positive: reaches a flat/monorepo handler; negative:
# alarms when a layout is uncovered). A full `eslint .` run needs the consumer toolchain and is
# out of this light harness; the glob-reach + the unit test together cover "the rule is live".
#
# PAIRED-NEGATIVE: every behavioral arm has a neg that flips the V-gate verdict.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

install_into() { # $1 = dir, $2 = stack
  printf '{ "name":"t","version":"0.0.0" }\n' > "$1/package.json"
  ( cd "$1" && git init -q && bash "$REPO_ROOT/install.sh" "$2" --force ) >/dev/null 2>&1
}

# ── ts-server: shipped config is layout-agnostic + R7/R8 opt-in (F3 + F7 structure) ──
T=$(mktemp -d); install_into "$T" ts-server
CFG="$T/eslint.config.mjs"
[ -f "$CFG" ] || bad "ts-server: eslint.config.mjs not installed"

grep -q "RULE_GLOBS" "$CFG" \
  && ok "F3 ts-server: RULE_GLOBS constant shipped" \
  || bad "F3 ts-server: no RULE_GLOBS constant"
grep -qE "'\*\*/handlers/\*\*|'\*\*/routes/\*\*" "$CFG" \
  && ok "F3 ts-server: boundary globs are layout-agnostic (**/handlers, **/routes)" \
  || bad "F3 ts-server: boundary globs are not layout-agnostic"
# the old inert glob (src-anchored web/handlers as the ONLY boundary) must be gone
grep -q "'src/web/handlers/\*\*/\*.{ts,tsx}'" "$CFG" \
  && bad "F3 ts-server: old src/-anchored boundary glob still present (inert on flat/monorepo)" \
  || ok "F3 ts-server: src/-anchored-only boundary glob removed"
grep -q "STRICT_RUNTIME" "$CFG" && grep -q "AIF_STRICT_RUNTIME" "$CFG" \
  && ok "F7 ts-server: R7/R8 gated behind AIF_STRICT_RUNTIME" \
  || bad "F7 ts-server: no AIF_STRICT_RUNTIME gating"

CHK="$T/scripts/check-rule-globs.sh"
[ -x "$CHK" ] || bad "V: scripts/check-rule-globs.sh not shipped/executable"

# ── #507: the V-gate is WIRED, not merely shipped (was advisory-only → silence still shipped) ──
node -e 'const s=require(process.argv[1]).scripts||{}; process.exit((s["check:globs"]&&/check:globs/.test(s.validate||""))?0:1)' "$T/package.json" \
  && ok "#507: check:globs script present AND in the validate chain (gate runs on npm run validate)" \
  || bad "#507: check-rule-globs not wired into validate (silent inertness can still ship)"
grep -q "check-rule-globs.sh" "$T/.github/workflows/ci.yml" \
  && ok "#507: shipped CI runs check-rule-globs.sh (loud at the CI channel)" \
  || bad "#507: shipped CI does NOT run check-rule-globs.sh (gate unwired in CI)"
# NEG (load-bearing): the wiring predicate discriminates — a validate lacking check:globs fails it.
if node -e 'process.exit(/check:globs/.test("npm-run-all2 --parallel typecheck lint test")?0:1)'; then
  bad "#507-neg: predicate matched a validate WITHOUT check:globs → vacuous"
else
  ok "#507-neg: predicate rejects a validate lacking check:globs (non-vacuous)"
fi

# ── F3 behavioral: globs REACH a flat-Hono handler (was zero before the fix) ──
mkdir -p "$T/src/routes"; echo 'export const x = 1;' > "$T/src/routes/users.ts"
( cd "$T" && ESLINT_CONFIG="$CFG" bash "$CHK" ) >/dev/null 2>&1 \
  && ok "F3 behavioral (flat): R2 globs reach src/routes/ handler (V-gate green)" \
  || bad "F3 behavioral (flat): R2 globs do NOT reach a flat handler — still inert"

# ── F3 behavioral: monorepo shape (apps/*/src/handlers) ──
T2=$(mktemp -d); install_into "$T2" ts-server
mkdir -p "$T2/apps/api/src/handlers"; echo 'export const x = 1;' > "$T2/apps/api/src/handlers/h.ts"
( cd "$T2" && ESLINT_CONFIG="$T2/eslint.config.mjs" bash "$T2/scripts/check-rule-globs.sh" ) >/dev/null 2>&1 \
  && ok "F3 behavioral (monorepo): R2 globs reach apps/api/src/handlers (V-gate green)" \
  || bad "F3 behavioral (monorepo): R2 globs do NOT reach a monorepo handler"

# ── F3 NEG (load-bearing): source present but no boundary dir → V-gate alarms ──
# (GH #777) check-rule-globs.sh now PRUNES the vendored framework packages/core/ from the
# user-coverage scan, so the shipped eslint-rules/ no longer masks this arm: a consumer with
# src/index.ts but no handlers/routes/... boundary dir → R2 matches zero USER source → alarms.
T3=$(mktemp -d); install_into "$T3" ts-server
mkdir -p "$T3/src"; echo 'export const x = 1;' > "$T3/src/index.ts"
if ( cd "$T3" && ESLINT_CONFIG="$T3/eslint.config.mjs" bash "$T3/scripts/check-rule-globs.sh" ) >/dev/null 2>&1; then
  bad "F3 NEG: code present but no boundary dir, yet V-gate stayed green → VACUOUS"
else
  ok "F3 NEG: code present, no boundary dir → V-gate alarms (non-vacuous)"
fi

# ── F7: default install does NOT require R7/R8 (deferred); strict mode DOES ──
# Fixture has boundary (src/routes) but no application/ layer → R8 inert.
T4=$(mktemp -d); install_into "$T4" ts-server
mkdir -p "$T4/src/routes"; echo 'export const x = 1;' > "$T4/src/routes/u.ts"
( cd "$T4" && ESLINT_CONFIG="$T4/eslint.config.mjs" bash "$T4/scripts/check-rule-globs.sh" ) >/dev/null 2>&1 \
  && ok "F7 default: R7/R8 not required (deferred) — V-gate green with only boundary code" \
  || bad "F7 default: V-gate failed without AIF_STRICT_RUNTIME → R7/R8 not actually deferred"
# F7 NEG (load-bearing): turning strict ON must newly require R8 (application layer absent → fail)
if ( cd "$T4" && AIF_STRICT_RUNTIME=1 ESLINT_CONFIG="$T4/eslint.config.mjs" bash "$T4/scripts/check-rule-globs.sh" ) >/dev/null 2>&1; then
  bad "F7 NEG: AIF_STRICT_RUNTIME=1 but V-gate stayed green with no application/ layer → toggle inert"
else
  ok "F7 NEG: AIF_STRICT_RUNTIME=1 newly requires R8 (application absent → alarms) — toggle is real"
fi

# ── react-next: same fix on its OWN globs (T-S3-C: not cloned from ts-server) ──
TR=$(mktemp -d); install_into "$TR" react-next
RCFG="$TR/eslint.config.mjs"
grep -q "RULE_GLOBS" "$RCFG" && grep -q "AIF_STRICT_RUNTIME" "$RCFG" \
  && ok "F3/F7 react-next: RULE_GLOBS + AIF_STRICT_RUNTIME present" \
  || bad "F3/F7 react-next: glob/strict fix missing from react config"
grep -qE "'\*\*/app/api/\*\*|'\*\*/actions/\*\*" "$RCFG" \
  && ok "F3 react-next: Next boundary globs are layout-agnostic (**/app/api, **/actions)" \
  || bad "F3 react-next: react boundary globs not layout-agnostic"

# ── #807 multi-stack: no root config → check-rule-globs.sh recurses per workspace ──────────────
# The #793/#796 layout ships per-workspace eslint.config.mjs + NO root config. check:globs must
# recurse into each workspace instead of exit-2'ing on the missing root config. These fixtures are
# built by hand (no install) so each workspace's R2 wiring is deterministic; the gate is run from
# the consumer root via a RELATIVE path (proves the absolute-$SELF re-exec survives `cd`, ⚑M1).
GATE_G="$REPO_ROOT/packages/core/audit-self/check-rule-globs.sh"

# Minimal per-workspace ts-server-style config wiring R2 on a boundary glob (the gate parses
# RULE_GLOBS.boundary then checks its globs reach ≥1 source file).
write_ws_ts_cfg() { # $1=ws-dir
  mkdir -p "$1"
  cat > "$1/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/routes/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
CFG
}

# (pos) ts-server workspace that wires R2 + has a boundary source file → recursed, exit 0.
MS=$(mktemp -d)
printf '{ "name":"mono","private":true }\n' > "$MS/package.json"
write_ws_ts_cfg "$MS/apps/api"; mkdir -p "$MS/apps/api/src/routes"; echo 'export const u=1;' > "$MS/apps/api/src/routes/u.ts"
if ( cd "$MS" && bash "$GATE_G" ) >/tmp/f37ms.$$ 2>&1; then
  ok "#807 (pos): ts-server ws wires R2 + boundary src → check:globs recurses, exit 0 (was exit 2)"
else
  bad "#807 (pos): ts-server ws should pass but gate exited non-zero ($(tr '\n' ';' </tmp/f37ms.$$))"
fi
# Proves recursion happened (not the exit-2 guard) — the per-ws ✓ line is present, the guard msg is not.
! grep -q 'run from the project root' /tmp/f37ms.$$ \
  && ok "#807 (pos): NOT the exit-2 'run from the project root' path (recursed per-ws)" \
  || bad "#807 (pos): hit the exit-2 root-config guard (recursion not reached)"

# (PAIRED-NEGATIVE) a ts-server workspace with a boundary block but the boundary glob reaches NO
# source file → the gate's silent-inertness alarm fires inside the recursion → non-zero.
MSN=$(mktemp -d)
printf '{ "name":"mono","private":true }\n' > "$MSN/package.json"
write_ws_ts_cfg "$MSN/apps/api"
# boundary glob is **/routes/** but we plant source ONLY outside it → R2 matches zero → alarm.
mkdir -p "$MSN/apps/api/src/lib"; echo 'export const u=1;' > "$MSN/apps/api/src/lib/u.ts"
if ( cd "$MSN" && bash "$GATE_G" ) >/tmp/f37msn.$$ 2>&1; then
  bad "#807 NEG: ws boundary reaches zero source but gate PASSED → silent-inertness alarm vacuous"
else
  ok "#807 NEG: ws boundary reaches zero source → gate FAILS inside recursion (alarm non-vacuous)"
fi

# (B2) react-spa workspace — ships a boundary block → recursed, NOT skipped. Fixture wires the
# react-spa boundary glob (**/api/**) and a matching source → the recursion's glob-liveness PASSES.
MSS=$(mktemp -d)
printf '{ "name":"mono","private":true }\n' > "$MSS/package.json"
mkdir -p "$MSS/apps/web/src/api"
cat > "$MSS/apps/web/eslint.config.mjs" <<'CFG'
const RULE_GLOBS = {
  boundary: ['**/api/**/*.{ts,tsx}'],
};
export default [{ files: RULE_GLOBS.boundary, rules: { 'rules-as-tests/no-unsafe-zod-parse': 'error' } }];
CFG
echo 'export const f=1;' > "$MSS/apps/web/src/api/client.ts"
if ( cd "$MSS" && bash "$GATE_G" ) >/tmp/f37mss.$$ 2>&1; then
  ok "#807 (B2): react-spa ws (boundary present, glob reaches src) → recursed + PASSES (not skipped)"
else
  bad "#807 (B2): react-spa ws should pass (boundary reaches src) but gate failed ($(tr '\n' ';' </tmp/f37mss.$$))"
fi
grep -qi 'no RULE_GLOBS.boundary' /tmp/f37mss.$$ \
  && bad "#807 (B2): react-spa ws was SKIPPED as no-boundary — SPA must recurse, not skip (T-807-B)" \
  || ok "#807 (B2): react-spa ws was NOT skipped (it has a boundary block → recursed, per T-807-B)"

# (B2) RN/Expo workspace — ships NO boundary block → skipped, NOT failed.
MSR=$(mktemp -d)
printf '{ "name":"mono","private":true }\n' > "$MSR/package.json"
mkdir -p "$MSR/apps/mobile/src"
# RN configs carry no RULE_GLOBS.boundary block (verified: preset-react-native/templates/*).
cat > "$MSR/apps/mobile/eslint.config.mjs" <<'CFG'
import rnCommon from './eslint.config.rn-common.mjs';
export default [...rnCommon];
CFG
echo 'export const a=1;' > "$MSR/apps/mobile/src/App.ts"
if ( cd "$MSR" && bash "$GATE_G" ) >/tmp/f37msr.$$ 2>&1; then
  ok "#807 (B2): RN/Expo ws (no boundary block) → skipped, gate exits 0 (not failed)"
else
  bad "#807 (B2): RN/Expo ws should skip (no boundary) but gate failed ($(tr '\n' ';' </tmp/f37msr.$$))"
fi
grep -qi 'no RULE_GLOBS.boundary' /tmp/f37msr.$$ \
  && ok "#807 (B2): RN/Expo ws emitted the 'no RULE_GLOBS.boundary — R2 N/A (skipped)' line" \
  || bad "#807 (B2): RN/Expo ws did not emit the skip line (skip-guard not reached)"

rm -f /tmp/f37ms.$$ /tmp/f37msn.$$ /tmp/f37mss.$$ /tmp/f37msr.$$ 2>/dev/null

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
