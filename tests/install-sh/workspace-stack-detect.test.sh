#!/usr/bin/env bash
# workspace-stack-detect.test.sh — per-workspace stack detection for multi-stack monorepos
# (§13.5, multi-stack-monorepo I-2 Layer 1 — DETECTION ONLY). The two new helpers live in
# setup.d/lib.sh (SSOT — layer-units.test.sh §4 guard forbids defining them in a numbered layer):
#
#   _workspace_pkg_dirs [root]        — enumerate workspace package dirs (those WITH a package.json)
#                                       under the 5-dir convention (apps packages services libs
#                                       modules — same set as setup.d/70-deps.sh:43), node-free, no
#                                       yq/pnpm/turbo dependency. Echoes one relative dir per line.
#   _detect_stacks_per_workspace [root] — walk each workspace dir × _detect_stack_from_pkg <dir> →
#                                       echo `dir<TAB>stack` per workspace (mirrors the 15-companions
#                                       DETECTED_STACK echo). A per-workspace `unknown` is a
#                                       re-checkable marker kept in the map, NOT dropped, NOT exit 1.
#
# T-MSM-A (kickoff §3): root-only detection silently drops the secondary stack (a pnpm monorepo's
# root package.json often has neither react-native nor next) — the #780 bug at the detection layer.
# Counter, proven below: detection walks PER-WORKSPACE; the paired-negative shows root-only detect
# drops apps/mobile's react-native that the per-workspace walk recovers.
#
# PAIRED-NEGATIVE (principle-02 non-vacuity, arch-target-monorepo.test.sh style): every property has
# an arm whose flip would fail — proving the assertions are load-bearing, not tautological.
#
# Layer-2 (on-disk marker / per-workspace `applies-to`/`files:` emission) is OUT OF SCOPE here.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
INSTALL_SH="$REPO_ROOT/install.sh"
TAB=$'\t'
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# ws_run <fixture_dir> <shell-snippet> — source install.sh in lib-only mode with PROJECT_ROOT=cwd
# set to the fixture (install.sh:56 `PROJECT_ROOT="$(pwd)"`), then run the snippet. Mirrors the
# stack-autodetect.test.sh harness. Helpers are exposed because lib.sh is sourced before the
# INSTALL_SH_LIB_ONLY guard (install.sh:61/68). set -euo pipefail is active (install.sh:52).
ws_run() {
  local dir="$1" snippet="$2"
  ( cd "$dir" && INSTALL_SH_LIB_ONLY=1 bash -c 'source "'"$INSTALL_SH"'"; '"$snippet" 2>/dev/null )
}

# ── Fixture monorepo (timeliner shape): per-workspace package.json, multi-stack ───────────────
# Root package.json carries ONLY typescript → root-only detect = ts-server, which DROPS the Expo
# app (the T-MSM-A trap). apps/api → ts-server (Hono), apps/mobile → react-native (Expo),
# packages/config → unknown (no stack signal), apps/docs → NOT a package (no package.json).
T=$(mktemp -d)
printf '{ "name": "timeliner-mono", "private": true, "devDependencies": { "typescript": "5.6.0" } }\n' > "$T/package.json"
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > "$T/pnpm-workspace.yaml"
mkdir -p "$T/apps/api"     && printf '{ "name": "api", "dependencies": { "hono": "4.0.0" }, "devDependencies": { "typescript": "5.6.0" } }\n' > "$T/apps/api/package.json"
mkdir -p "$T/apps/mobile"  && printf '{ "name": "mobile", "dependencies": { "expo": "~52.0.0", "react-native": "0.76.0", "react": "19.0.0" } }\n' > "$T/apps/mobile/package.json"
mkdir -p "$T/packages/config" && printf '{ "name": "config", "version": "0.0.0" }\n' > "$T/packages/config/package.json"
mkdir -p "$T/apps/docs"    # NO package.json on purpose

echo "▶ UNIT: _workspace_pkg_dirs enumerates workspace package dirs (5-dir convention, node-free)"
DIRS=$(ws_run "$T" '_workspace_pkg_dirs')
printf '%s\n' "$DIRS" | grep -qx 'apps/api'        && ok "lists apps/api"        || bad "apps/api missing from ($DIRS)"
printf '%s\n' "$DIRS" | grep -qx 'apps/mobile'     && ok "lists apps/mobile"     || bad "apps/mobile missing from ($DIRS)"
printf '%s\n' "$DIRS" | grep -qx 'packages/config' && ok "lists packages/config" || bad "packages/config missing from ($DIRS)"
# NEG (load-bearing): a child dir WITHOUT package.json is NOT a workspace package.
if printf '%s\n' "$DIRS" | grep -qx 'apps/docs'; then
  bad "neg: apps/docs (no package.json) was enumerated → reader fabricates non-packages"
else
  ok "neg: apps/docs (no package.json) NOT enumerated → reader requires package.json"
fi

echo ""
echo "▶ UNIT: _detect_stacks_per_workspace → {dir<TAB>stack} map (T-MSM-A: neither stack dropped)"
MAP=$(ws_run "$T" '_detect_stacks_per_workspace')
printf '%s\n' "$MAP" | grep -qxF "apps/api${TAB}ts-server"       && ok "apps/api → ts-server"                                        || bad "apps/api→ts-server missing ($MAP)"
printf '%s\n' "$MAP" | grep -qxF "apps/mobile${TAB}react-native" && ok "apps/mobile → react-native (secondary stack NOT dropped — #780 nuance)" || bad "apps/mobile→react-native missing ($MAP)"

echo ""
echo "▶ NEG (T-MSM-A core): root-only detection DROPS the secondary stack — per-workspace walk is load-bearing"
ROOT_ONLY=$(ws_run "$T" '_detect_stack_from_pkg')
if [ "$ROOT_ONLY" = "react-native" ]; then
  bad "neg: root-only detect returned react-native — fixture cannot prove per-workspace value"
else
  ok "neg: root-only detect = '$ROOT_ONLY' (drops apps/mobile react-native) → root-only is insufficient"
fi
printf '%s\n' "$MAP" | grep -q 'react-native' \
  && ok "neg-pair: per-workspace map recovers the react-native root-only dropped" \
  || bad "neg-pair: per-workspace map also lacks react-native — walk adds nothing"

echo ""
echo "▶ per-workspace 'unknown' → re-checkable marker (kept in map, NOT dropped, NOT exit 1)"
printf '%s\n' "$MAP" | grep -qxF "packages/config${TAB}unknown" \
  && ok "packages/config (no stack signal) → 'unknown' marker kept (re-checkable)" \
  || bad "packages/config not mapped to 'unknown' ($MAP)"
# NEG (load-bearing): the unknown workspace must NOT be silently assigned a concrete stack.
if printf '%s\n' "$MAP" | grep -qE "packages/config${TAB}(ts-server|react-next|react-spa|react-native)"; then
  bad "neg: packages/config silently assigned a concrete stack (false detect)"
else
  ok "neg: packages/config not silently assigned a concrete stack (honest 'unknown')"
fi

echo ""
echo "▶ non-vacuity: a flat (non-monorepo) repo yields an EMPTY per-workspace map"
F=$(mktemp -d); printf '{ "dependencies": { "next": "15.0.0" } }\n' > "$F/package.json"
FLATMAP=$(ws_run "$F" '_detect_stacks_per_workspace')
[ -z "$FLATMAP" ] \
  && ok "flat repo → empty per-workspace map (walk does not fabricate workspaces)" \
  || bad "flat repo produced a non-empty map ($FLATMAP) — walk fabricates entries"
rm -rf "$F"

echo ""
echo "▶ back-compat: _detect_stack_from_pkg signal logic unchanged (no-arg + parameterized)"
# no-arg still reads $PROJECT_ROOT (= cwd) — the I-1 / 15-companions call contract.
NOARG=$(ws_run "$T/apps/mobile" '_detect_stack_from_pkg')
[ "$NOARG" = "react-native" ] \
  && ok "no-arg reads \$PROJECT_ROOT (cwd apps/mobile → react-native)" \
  || bad "no-arg back-compat broken: expected react-native, got '$NOARG'"
# explicit dir arg reads <dir>/package.json.
ARG=$(ws_run "$T" '_detect_stack_from_pkg "'"$T/apps/api"'"')
[ "$ARG" = "ts-server" ] \
  && ok "arg form reads <dir>/package.json (apps/api → ts-server)" \
  || bad "arg form broken: expected ts-server, got '$ARG'"
# NEG (load-bearing): with cwd=root (ts-server) the arg form must reflect the ARG dir, not the root.
ARGNEG=$(ws_run "$T" '_detect_stack_from_pkg "'"$T/apps/mobile"'"')
if [ "$ARGNEG" = "ts-server" ]; then
  bad "neg: arg form returned root's ts-server — arg ignored, not parameterized"
else
  ok "neg: arg form ('$ARGNEG') reflects the ARG dir not \$PROJECT_ROOT root → truly parameterized"
fi

echo ""
echo "▶ fixture install rc=0 (lib.sh with the new defs sources + dispatches clean under set -euo pipefail)"
( cd "$T" && git init -q && bash "$INSTALL_SH" ts-server --dry-run ) >/dev/null 2>&1; rc=$?
[ "$rc" -eq 0 ] \
  && ok "fixture monorepo install (ts-server --dry-run) exits 0" \
  || bad "fixture install exited $rc — lib.sh regression"

rm -rf "$T"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
