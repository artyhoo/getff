#!/usr/bin/env bash
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

BRIDGE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/bridge-guided.sh"

# Health check keys on the URL responding, not on docker. Use a curl stub.
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }
export -f curl
bridge_health_ok "http://localhost:3009" && ok "health ok → reachable (docker-agnostic)" || bad "health check failed"

curl() { return 1; }  # nothing responds
export -f curl
bridge_health_ok "http://localhost:3009" && bad "health ok despite no response" || ok "no response → not reachable"

# diagnose returns 'up' when health ok
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }
export -f curl
[ "$(bridge_diagnose http://localhost:3009)" = "up" ] && ok "diagnose=up when reachable" || bad "diagnose not up"

# --- S5 cases: state=up delegation resolves root via BASH_SOURCE, degrades ---
# --- gracefully on consumer checkouts (no packages/runtime-bridge present). ---
# NOTE: these re-source a COPY of the lib (redefines its functions), so they
# must stay AFTER the 3 cases above.

# Paired-negative (consumer: script absent): source a copy of the lib from a
# temp root that has NO packages/ tree → state=up must NOT hard-fail and return 0; its
# NOT-wired line states the fact and names no doc to go and read (Q4.7).
TMP_NEG=$(mktemp -d)
mkdir -p "$TMP_NEG/setup.d"
cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$TMP_NEG/setup.d/"
BRIDGE_LIB_ONLY=1 source "$TMP_NEG/setup.d/bridge-guided.sh"
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }
export -f curl
out=$(bridge_guided_run); rc=$?
[ "$rc" -eq 0 ] && ok "consumer (script absent): state=up returns 0, no hard fail" || bad "consumer (script absent): rc=$rc"
case "$out" in *".md"*) bad "consumer (script absent): the output points at a doc: $out" ;; *) ok "consumer (script absent): no doc pointer in the output" ;; esac
case "$out" in *"reachable at"*) ok "consumer (script absent): state=up branch taken (reachable line present)" ;; *) bad "consumer (script absent): state=up branch not taken: $out" ;; esac
rm -rf "$TMP_NEG"

# Positive (framework repo: script present, and the project being set up IS that repo): a
# temp root WITH a stubbed packages/runtime-bridge/scripts/setup-runtime-bridge.sh → executes it
# by absolute path. The wizard wires the repository it ships in, so it runs only there.
TMP_POS=$(mktemp -d)
mkdir -p "$TMP_POS/setup.d" "$TMP_POS/packages/runtime-bridge/scripts"
cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$TMP_POS/setup.d/"
echo 'echo "STUB-BRIDGE-SETUP-RAN"' > "$TMP_POS/packages/runtime-bridge/scripts/setup-runtime-bridge.sh"
BRIDGE_LIB_ONLY=1 source "$TMP_POS/setup.d/bridge-guided.sh"
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }
export -f curl
out=$(cd "$TMP_POS" && bridge_guided_run); rc=$?
[ "$rc" -eq 0 ] && ok "framework (script present): state=up returns 0" || bad "framework (script present): rc=$rc"
case "$out" in *"STUB-BRIDGE-SETUP-RAN"*) ok "framework (script present): setup-runtime-bridge.sh executed when the project is the getff repository" ;; *) bad "framework (script present): stub not executed: $out" ;; esac
# Negative (the npm package, or a getff clone used as the installer): the script ships next to
# the lib, but the project being set up is somewhere else. Run there, the wizard would write the
# hook and settings.json into the package and print its paste-it-yourself steps, so it must not
# run; the gap is a NOT-wired fact.
TMP_CONS=$(mktemp -d)
out=$(cd "$TMP_CONS" && bridge_guided_run); rc=$?
[ "$rc" -eq 0 ] && ok "installed package (project elsewhere): state=up returns 0" || bad "installed package (project elsewhere): rc=$rc"
case "$out" in *"STUB-BRIDGE-SETUP-RAN"*) bad "installed package (project elsewhere): the wizard ran against the package, not the project: $out" ;; *) ok "installed package (project elsewhere): the wizard does not run" ;; esac
case "$out" in *"NOT wired"*"setup-runtime-bridge.sh"*"wires only the getff repository"*) ok "installed package (project elsewhere): a NOT-wired fact names why" ;; *) bad "installed package (project elsewhere): no NOT-wired fact: $out" ;; esac
rm -rf "$TMP_POS" "$TMP_CONS"

# --- Suite/runtime cross-layer warning (owner GO 2026-07-11) ---
# Run against a temp-root COPY with a stubbed setup-runtime-bridge.sh (TMP_POS pattern above)
# so the state=up arm never executes the real bridge-setup script.
TMP_WARN=$(mktemp -d)
mkdir -p "$TMP_WARN/setup.d" "$TMP_WARN/packages/runtime-bridge/scripts"
cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$TMP_WARN/setup.d/"
echo 'echo "STUB-BRIDGE-SETUP-RAN"' > "$TMP_WARN/packages/runtime-bridge/scripts/setup-runtime-bridge.sh"
BRIDGE_LIB_ONLY=1 source "$TMP_WARN/setup.d/bridge-guided.sh"
# Positive: runtime not reachable + WITH_AIF_SUITE set → warning line present.
curl() { return 1; }  # nothing responds → state != up (docker|native|absent, machine-dependent)
export -f curl
out=$(WITH_AIF_SUITE="--with-aif-suite" bridge_guided_run)
case "$out" in *"suite skills"*"dead-end"*) ok "suite flag + runtime down → cross-layer warning shown" ;; *) bad "suite flag + runtime down: warning missing: $out" ;; esac
# Paired-negative 1: no suite flag → no warning.
out=$(WITH_AIF_SUITE="" bridge_guided_run)
case "$out" in *"dead-end"*) bad "no suite flag: warning leaked: $out" ;; *) ok "no suite flag + runtime down → no warning (consumer path unchanged)" ;; esac
# Paired-negative 2: suite flag + runtime UP → no warning.
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }
export -f curl
out=$(WITH_AIF_SUITE="--with-aif-suite" bridge_guided_run)
case "$out" in *"dead-end"*) bad "suite flag + runtime up: warning misfired: $out" ;; *) ok "suite flag + runtime up → no warning" ;; esac
# --profile factory is the flag that installs the suite TODAY; --with-aif-suite is the legacy
# escape that routes through it. Reading only the escape meant the modern flag installed the
# suite and got no warning. Both depth variables must work: PROFILE_DEPTH when sourced from
# ./setup, PROFILE when install.sh exported it.
curl() { return 1; }  # nothing responds again
export -f curl
out=$(PROFILE_DEPTH="factory" bridge_guided_run)
case "$out" in *"suite skills"*"dead-end"*) ok "--profile factory (wrapper) + runtime down → warning shown" ;; *) bad "--profile factory: warning missing: $out" ;; esac
out=$(PROFILE="factory" bridge_guided_run)
case "$out" in *"suite skills"*"dead-end"*) ok "PROFILE=factory (install.sh export) + runtime down → warning shown" ;; *) bad "PROFILE=factory: warning missing: $out" ;; esac
# Paired-negative 3: a shallower profile must NOT warn — otherwise the depth half is constant-true.
out=$(PROFILE_DEPTH="env" bridge_guided_run)
case "$out" in *"dead-end"*) bad "--profile env: warning leaked: $out" ;; *) ok "--profile env + runtime down → no warning" ;; esac
rm -rf "$TMP_WARN"

# --- A1-7 (ledger #1597): docker-down is its OWN state ------------------------
# `absent` used to mean two different machines: no docker at all, and docker installed
# with the daemon stopped. The helper's absent arm then re-ran bridge_diagnose's own
# `command -v docker && docker info` test to tell them apart — a test that has already
# failed by the time `absent` is returned, so the "daemon down" guidance was unreachable.
BRIDGE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/bridge-guided.sh"
curl() { return 1; }; export -f curl        # nothing responds → never state=up

# binary present, daemon refusing → docker-down (NOT absent)
docker() { return 1; }; export -f docker
[ "$(bridge_diagnose http://localhost:3009)" = "docker-down" ] && ok "diagnose=docker-down when the binary is present but the daemon is down" || bad "diagnose=$(bridge_diagnose http://localhost:3009) for binary-present/daemon-down (want docker-down)"
case "$(bridge_guided_run)" in *"daemon"*) ok "guided_run has a docker-down arm (daemon named in the guidance)" ;; *) bad "guided_run printed no docker-down guidance: $(bridge_guided_run)" ;; esac

# paired-negative 1: daemon answering → docker (unchanged)
docker() { return 0; }; export -f docker
[ "$(bridge_diagnose http://localhost:3009)" = "docker" ] && ok "neg: diagnose=docker when the daemon answers" || bad "neg: diagnose=$(bridge_diagnose http://localhost:3009) when the daemon answers"

# paired-negative 2: no docker binary at all → absent (unchanged). PATH is emptied so
# `command -v docker` genuinely finds nothing; bridge_diagnose calls no external command.
unset -f docker
[ "$(PATH=/nonexistent-getff-probe bridge_diagnose http://localhost:3009)" = "absent" ] && ok "neg: diagnose=absent when no docker binary exists" || bad "neg: diagnose=$(PATH=/nonexistent-getff-probe bridge_diagnose http://localhost:3009) with no docker binary"

# --- Q4.7 (operator directive 2026-09-28): no state hands the reader a manual step -------------
# Each not-up state is a NOT-wired line with its reason — in ./setup's companion summary when the
# engine is sourced (companion_not_wired), else printed in place — never «start it / start docker /
# install / see <doc> for manual setup / then re-run».
# shellcheck source=tests/install-sh/lib/manual-step.sh
source "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
QLOG=$(mktemp)
q47() {  # q47 <state-label> <regex> [PATH] — run with the engine sourced, as ./setup does
  local out
  # The PATH override applies to the run only (bridge_diagnose's `command -v`), never to the
  # asserts below — a grep that is not on PATH would pass every negative.
  out=$(ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; [ -n "${3:-}" ] && PATH="$3"; bridge_guided_run; companion_not_wired_summary)
  printf '%s\n' "$out" > "$QLOG"
  if grep -qE "$2" <<<"$(printf '%s\n' "$out" | grep -E '^ +- runtime-bridge — ')"; then ok "Q4.7 $1: NOT-wired line says why ($2)"
  else bad "Q4.7 $1: no runtime-bridge NOT-wired line matching /$2/: $out"; fi
  if asks_by_hand "$QLOG"; then bad "Q4.7 $1: hands back a manual step: $(manual_step_lines "$QLOG" | head -2 | tr '\n' '|')"
  else ok "Q4.7 $1: no manual step"; fi
}
BRIDGE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/bridge-guided.sh"
curl() { return 1; }; export -f curl
docker() { return 0; }; export -f docker
q47 docker "does not answer.*docker"
docker() { return 1; }; export -f docker
q47 docker-down "docker daemon is not running"
unset -f docker
TMP_NATIVE=$(mktemp -d); printf '#!/bin/sh\nexit 0\n' > "$TMP_NATIVE/aif-handoff"; chmod +x "$TMP_NATIVE/aif-handoff"
q47 native "CLI is installed but does not answer" "$TMP_NATIVE"
q47 absent "no docker and no aif-handoff CLI" /nonexistent-getff-probe
case "$(cat "$QLOG")" in *".md"*) bad "Q4.7 absent: the NOT-wired line points at a doc: $(grep -F '.md' "$QLOG" | head -1)" ;; *) ok "Q4.7 absent: no doc pointer" ;; esac
rm -rf "$TMP_NATIVE"
# consumer checkout, aif-handoff up, no setup-runtime-bridge.sh → a NOT-wired line, no «manual setup»
TMP_Q=$(mktemp -d); mkdir -p "$TMP_Q/setup.d"; cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$TMP_Q/setup.d/"
BRIDGE_LIB_ONLY=1 source "$TMP_Q/setup.d/bridge-guided.sh"
curl() { case "$*" in *"/health"*) return 0 ;; *) return 1 ;; esac; }; export -f curl
q47 consumer-up "setup-runtime-bridge\.sh.*wires only the getff repository"
case "$(cat "$QLOG")" in *".md"*) bad "Q4.7 consumer-up: the NOT-wired line points at a doc: $(grep -F '.md' "$QLOG" | head -1)" ;; *) ok "Q4.7 consumer-up: no doc pointer" ;; esac
# without the engine (the lib sourced alone) the same fact is printed in place
out=$(bridge_guided_run); printf '%s\n' "$out" > "$QLOG"
case "$out" in *"NOT wired"*"setup-runtime-bridge.sh"*) ok "Q4.7 consumer-up (no engine): the NOT-wired fact is printed in place" ;; *) bad "Q4.7 consumer-up (no engine): no in-place NOT-wired line: $out" ;; esac
asks_by_hand "$QLOG" && bad "Q4.7 consumer-up (no engine): hands back a manual step: $(manual_step_lines "$QLOG" | head -1)" || ok "Q4.7 consumer-up (no engine): no manual step"
rm -rf "$TMP_Q" "$QLOG"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
