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
case "$out" in *"NOT wired"*"dispatch hook"*"profile factory"*) ok "installed package (project elsewhere): a NOT-wired fact names why" ;; *) bad "installed package (project elsewhere): no NOT-wired fact: $out" ;; esac
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
QLOG=$(mktemp); QDIR=$(mktemp -d)
q47() {  # q47 <state-label> <regex> [PATH] — run with the engine sourced, as ./setup does
  local out
  # The PATH override applies to the run only (bridge_diagnose's `command -v`), never to the
  # asserts below — a grep that is not on PATH would pass every negative.
  # Run from an empty project: this repository's own root carries the dispatch hook, which would
  # send the consumer-up case down the wiring path instead of the no-hook fact.
  out=$(cd "$QDIR" && ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; [ -n "${3:-}" ] && PATH="$3"; bridge_guided_run; companion_not_wired_summary)
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
q47 consumer-up "dispatch hook.*profile factory"
case "$(cat "$QLOG")" in *".md"*) bad "Q4.7 consumer-up: the NOT-wired line points at a doc: $(grep -F '.md' "$QLOG" | head -1)" ;; *) ok "Q4.7 consumer-up: no doc pointer" ;; esac
# without the engine (the lib sourced alone) the same fact is printed in place
out=$(cd "$QDIR" && bridge_guided_run); printf '%s\n' "$out" > "$QLOG"
case "$out" in *"NOT wired"*"dispatch hook"*"profile factory"*) ok "Q4.7 consumer-up (no engine): the NOT-wired fact is printed in place" ;; *) bad "Q4.7 consumer-up (no engine): no in-place NOT-wired line: $out" ;; esac
asks_by_hand "$QLOG" && bad "Q4.7 consumer-up (no engine): hands back a manual step: $(manual_step_lines "$QLOG" | head -1)" || ok "Q4.7 consumer-up (no engine): no manual step"
rm -rf "$TMP_Q" "$QLOG" "$QDIR"

# --- Consumer wiring (Q4.7): the install wires the project it installs into ------------------
# bridge_wire_project <dir> <url> reads aif-handoff's GET /projects, picks the ONE project whose
# rootPath is <dir>, and writes RUNTIME_BRIDGE_AIF_URL + RUNTIME_BRIDGE_AIF_PROJECT_ID into
# <dir>/.claude/settings.local.json `env` — the machine-local scope (a URL and a project id are this
# machine's aif-handoff, not the team's), never a shell rc and never the shared, usually committed
# settings.json. Anything it cannot decide
# (no match, two matches, no /projects, no dispatch hook) is a NOT-wired line with its reason.
QLOG=$(mktemp)
BRIDGE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/bridge-guided.sh"
W=$(mktemp -d); W=$(cd "$W" && pwd -P)
wproj() {  # wproj <name> — a project with the dispatch hook delivered (a factory install)
  mkdir -p "$W/$1/.claude/hooks"; printf '#!/bin/sh\n' > "$W/$1/.claude/hooks/runtime-bridge-dispatch.sh"
  printf '%s' "$W/$1"
}
AIF_PROJECTS='[]'
curl() {
  case "$*" in
    *"/health"*) return 0 ;;
    *"/projects"*) [ "$AIF_PROJECTS" = "FAIL" ] && return 7; printf '%s' "$AIF_PROJECTS" ;;
    *) return 1 ;;
  esac
}
export -f curl
wire() {  # wire <dir> — run with the engine sourced, as ./setup does; output → $QLOG
  ( ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; bridge_wire_project "$1" http://aif.test:3009; companion_not_wired_summary ) > "$QLOG" 2>&1
}
senv() { jq -r --arg k "$2" '.env[$k] // empty' "$1/.claude/settings.local.json" 2>/dev/null; }
senvj() { jq -r --arg k "$2" '.env[$k] // empty' "$1/.claude/settings.json" 2>/dev/null; }
nomanual() { asks_by_hand "$QLOG" && bad "$1: hands back a manual step: $(manual_step_lines "$QLOG" | head -1)" || ok "$1: no manual step"; }

# W1 one project whose rootPath is this project → both env keys written, nothing NOT wired
P=$(wproj one); git -C "$P" init -q
AIF_PROJECTS="[{\"id\":\"p-one\",\"name\":\"one\",\"rootPath\":\"$P\"},{\"id\":\"p-else\",\"name\":\"x\",\"rootPath\":\"/home/www/else\"}]"
wire "$P"
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-one" ] && ok "W1: the matching aif project id is written to the project's settings env" || bad "W1: RUNTIME_BRIDGE_AIF_PROJECT_ID=$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID): $(cat "$QLOG")"
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_URL)" = "http://aif.test:3009" ] && ok "W1: the aif url is written to the project's settings env" || bad "W1: RUNTIME_BRIDGE_AIF_URL=$(senv "$P" RUNTIME_BRIDGE_AIF_URL)"
[ -z "$(senvj "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W1: the shared settings.json carries no machine-local id" || bad "W1: the aif project id leaked into the shared settings.json"
git -C "$P" check-ignore -q .claude/settings.local.json && ok "W1: settings.local.json is git-ignored in the project" || bad "W1: settings.local.json is not git-ignored — git would pick up a machine-local id"
[ -z "$(git -C "$P" status --porcelain -- .gitignore)" ] && ok "W1: the project's own .gitignore is not edited" || bad "W1: the project's .gitignore was edited"
grep -q 'NOT wired\|^ *- runtime-bridge' "$QLOG" && bad "W1: a NOT-wired line although the project was wired: $(cat "$QLOG")" || ok "W1: no NOT-wired line"
nomanual W1
# idempotent: a second run keeps one value and says so
wire "$P"
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-one" ] && ok "W1: a second run keeps the id" || bad "W1: second run changed the id"
grep -q 'already points at aif-handoff project p-one' "$QLOG" && ok "W1: a second run says the project is already wired" || bad "W1: second run: $(cat "$QLOG")"
# aif-handoff moved: the same project at a new url → the url is updated, the id kept
( ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; bridge_wire_project "$P" http://aif.moved:4000; companion_not_wired_summary ) > "$QLOG" 2>&1
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_URL)" = "http://aif.moved:4000" ] && ok "W1: a moved aif-handoff url is updated on re-run" || bad "W1: url after move=$(senv "$P" RUNTIME_BRIDGE_AIF_URL): $(cat "$QLOG")"

# W2 the project's shared settings.json already has hooks and a different id → both kept
P=$(wproj kept)
printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"x"}]}]},"env":{"RUNTIME_BRIDGE_AIF_PROJECT_ID":"chosen"}}\n' > "$P/.claude/settings.json"
AIF_PROJECTS="[{\"id\":\"p-kept\",\"name\":\"k\",\"rootPath\":\"$P\"}]"
wire "$P"
[ "$(senvj "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "chosen" ] && [ -z "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W2: an id the project already set is kept, nothing written over it" || bad "W2: the project's own id was overridden: shared=$(senvj "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID) local=$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)"
[ "$(jq -r '.hooks.Stop[0].hooks[0].command' "$P/.claude/settings.json")" = "x" ] && ok "W2: the project's other settings survive" || bad "W2: settings.json lost its hooks"
nomanual W2

# W3 docker aif-handoff: every rootPath is a container path → NOT wired, nothing written
P=$(wproj docker)
AIF_PROJECTS='[{"id":"a","name":"docker","rootPath":"/home/www/docker"},{"id":"b","name":"b","rootPath":"/home/www/b"}]'
wire "$P"
[ -z "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W3: no id written when no rootPath matches (no guess by name)" || bad "W3: an id was guessed: $(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)"
grep -E '^ +- runtime-bridge — ' "$QLOG" | grep -q "none of the 2 projects.*$P" && ok "W3: the NOT-wired line says no project has this path" || bad "W3: no NOT-wired line naming the unmatched path: $(cat "$QLOG")"
nomanual W3

# W4 two projects share the rootPath → NOT wired (ambiguous), nothing written
P=$(wproj twice)
AIF_PROJECTS="[{\"id\":\"a\",\"name\":\"a\",\"rootPath\":\"$P\"},{\"id\":\"b\",\"name\":\"b\",\"rootPath\":\"$P\"}]"
wire "$P"
[ -z "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W4: no id written when two projects match" || bad "W4: an id was picked among two"
grep -E '^ +- runtime-bridge — ' "$QLOG" | grep -q '2 aif-handoff projects' && ok "W4: the NOT-wired line names the ambiguity" || bad "W4: no ambiguity line: $(cat "$QLOG")"
nomanual W4

# W5 /projects does not answer → NOT wired
P=$(wproj noproj); AIF_PROJECTS=FAIL
wire "$P"
grep -E '^ +- runtime-bridge — ' "$QLOG" | grep -q '/projects' && ok "W5: an unreadable /projects is a NOT-wired line" || bad "W5: $(cat "$QLOG")"
nomanual W5

# W6 no dispatch hook in the project (not a factory install) → NOT wired, nothing written
mkdir -p "$W/nohook"; P="$W/nohook"
AIF_PROJECTS="[{\"id\":\"p\",\"name\":\"n\",\"rootPath\":\"$P\"}]"
wire "$P"
[ ! -f "$P/.claude/settings.json" ] && [ ! -f "$P/.claude/settings.local.json" ] && ok "W6: no settings file written without the dispatch hook" || bad "W6: settings written for a project with no hook"
grep -E '^ +- runtime-bridge — ' "$QLOG" | grep -q 'profile factory.*with-aif-suite' && ok "W6: the NOT-wired line names both ways the hook ships" || bad "W6: $(cat "$QLOG")"
nomanual W6

# W7 without jq the same write goes through node
P=$(wproj nojq)
AIF_PROJECTS="[{\"id\":\"p-nojq\",\"name\":\"n\",\"rootPath\":\"$P\"}]"
NOJQ="$W/bin"; mkdir -p "$NOJQ"
for t in node mkdir mv rm cat dirname grep sed tr printf; do _p=$(command -v "$t" 2>/dev/null) && [ -x "$_p" ] && ln -sf "$_p" "$NOJQ/$t"; done
( PATH="$NOJQ"; ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; bridge_wire_project "$P" http://aif.test:3009; companion_not_wired_summary ) > "$QLOG" 2>&1
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-nojq" ] && ok "W7: without jq the id is written through node" || bad "W7: $(cat "$QLOG")"
# W7c a matching project with no id: neither path writes a made-up id (node printed «undefined»)
P=$(wproj noid)
AIF_PROJECTS="[{\"name\":\"n\",\"rootPath\":\"$P\"}]"
( PATH="$NOJQ"; ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; bridge_wire_project "$P" http://aif.test:3009; companion_not_wired_summary ) > "$QLOG" 2>&1
[ -z "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W7c: node writes no id for a project that has none" || bad "W7c (node): id=$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)"
wire "$P"
[ -z "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" ] && ok "W7c: jq writes no id for a project that has none" || bad "W7c (jq): id=$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)"
# W7d an `env` that is not an object is left alone (node spread a string into keys)
P=$(wproj badenv); printf '{"env":"str"}\n' > "$P/.claude/settings.local.json"
AIF_PROJECTS="[{\"id\":\"p-bad\",\"name\":\"n\",\"rootPath\":\"$P\"}]"
( PATH="$NOJQ"; ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"; bridge_wire_project "$P" http://aif.test:3009; companion_not_wired_summary ) > "$QLOG" 2>&1
[ "$(cat "$P/.claude/settings.local.json")" = '{"env":"str"}' ] && ok "W7d: node leaves a non-object env untouched" || bad "W7d: $(cat "$P/.claude/settings.local.json")"
grep -E '^ +- runtime-bridge — ' "$QLOG" | grep -q 'could not be written' && ok "W7d: the unwritable env is a NOT-wired line" || bad "W7d: $(cat "$QLOG")"

# W7b aif-handoff stores rootPath as typed: a symlinked spelling of the project matches too
P=$(wproj real); ln -s "$P" "$W/link"
AIF_PROJECTS="[{\"id\":\"p-link\",\"name\":\"l\",\"rootPath\":\"$W/link\"}]"
wire "$W/link"
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-link" ] && ok "W7b: a rootPath spelled through a symlink matches" || bad "W7b: $(cat "$QLOG")"

# W8 bridge_guided_run from an installed getff (project elsewhere) wires that project
TMP_C=$(mktemp -d); mkdir -p "$TMP_C/setup.d"; cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$REPO_ROOT/setup.d/lib.sh" "$TMP_C/setup.d/"
BRIDGE_LIB_ONLY=1 source "$TMP_C/setup.d/bridge-guided.sh"
P=$(wproj guided)
AIF_PROJECTS="[{\"id\":\"p-guided\",\"name\":\"g\",\"rootPath\":\"$P\"}]"
( cd "$P" && RUNTIME_BRIDGE_AIF_URL=http://aif.test:3009 bridge_guided_run ) > "$QLOG" 2>&1
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-guided" ] && ok "W8: ./setup's bridge step wires the project it runs in" || bad "W8: $(cat "$QLOG")"
# the hook this project got from an earlier install may be unregistered: ./setup registers it
# too, so its ✓ never stands on a hook Claude Code does not run
jq -e '.hooks.PostToolUse | map(.hooks[].command) | any(test("runtime-bridge-dispatch"))' "$P/.claude/settings.json" >/dev/null 2>&1 \
  && ok "W8: ./setup's bridge step registers the delivered dispatch hook" || bad "W8: the hook is not registered: $(cat "$QLOG")"
nomanual W8
# W8b the project's logical (symlinked) path is what aif-handoff stored → the guided arm matches it
P=$(wproj guidedreal); ln -s "$P" "$W/guidedlink"
AIF_PROJECTS="[{\"id\":\"p-glink\",\"name\":\"g\",\"rootPath\":\"$W/guidedlink\"}]"
( cd "$W/guidedlink" && RUNTIME_BRIDGE_AIF_URL=http://aif.test:3009 bridge_guided_run ) > "$QLOG" 2>&1
[ "$(senv "$P" RUNTIME_BRIDGE_AIF_PROJECT_ID)" = "p-glink" ] && ok "W8b: the guided arm matches the symlinked spelling" || bad "W8b: $(cat "$QLOG")"
rm -rf "$TMP_C"

# W9 the getff repository itself, non-interactive without --global: its wizard writes the shell
# rc, so it does not run, and the gap is a NOT-wired fact.
TMP_S=$(mktemp -d); mkdir -p "$TMP_S/setup.d" "$TMP_S/packages/runtime-bridge/scripts"
cp "$REPO_ROOT/setup.d/bridge-guided.sh" "$TMP_S/setup.d/"
echo 'echo "STUB-BRIDGE-SETUP-RAN"' > "$TMP_S/packages/runtime-bridge/scripts/setup-runtime-bridge.sh"
BRIDGE_LIB_ONLY=1 source "$TMP_S/setup.d/bridge-guided.sh"
out=$(cd "$TMP_S" && MODE=yes GETFF_GLOBAL="" bridge_guided_run)
case "$out" in *"STUB-BRIDGE-SETUP-RAN"*) bad "W9: the shell-rc wizard ran without --global" ;; *) ok "W9: without --global the shell-rc wizard does not run" ;; esac
case "$out" in *"NOT wired"*"shell rc"*"--global"*) ok "W9: a NOT-wired fact names the shell rc and --global" ;; *) bad "W9: $out" ;; esac
out=$(cd "$TMP_S" && MODE=yes GETFF_GLOBAL=1 bridge_guided_run)
case "$out" in *"STUB-BRIDGE-SETUP-RAN"*) ok "W9: with --global the wizard runs" ;; *) bad "W9 (--global): $out" ;; esac
rm -rf "$TMP_S" "$W"

# --- The getff repository's own wizard (setup-runtime-bridge.sh) states facts, and finishes ------
# It runs only in the getff repository, where the hook it copies IS the tracked
# .claude/hooks/runtime-bridge-dispatch.sh — so the copy is onto itself. A temp tree with that
# layout; every answer path must exit 0 and hand back no manual step.
unset -f curl
WZ=$(mktemp -d)
mkdir -p "$WZ/r/packages/runtime-bridge/scripts" "$WZ/r/.claude/hooks"
cp "$REPO_ROOT/packages/runtime-bridge/scripts/setup-runtime-bridge.sh" "$WZ/r/packages/runtime-bridge/scripts/"
cp "$REPO_ROOT/.claude/hooks/runtime-bridge-dispatch.sh" "$WZ/r/.claude/hooks/"
wizard() {  # wizard <label> <answers> [flag] — answers on stdin, one per prompt
  local rc=0
  printf '%s\n' "$2" | SHELL_RC="$WZ/rc" RUNTIME_BRIDGE_AIF_URL=http://127.0.0.1:9 \
    bash "$WZ/r/packages/runtime-bridge/scripts/setup-runtime-bridge.sh" ${3:+"$3"} > "$QLOG" 2>&1 || rc=$?
  [ "$rc" -eq 0 ] && ok "wizard $1: exits 0" || bad "wizard $1: rc=$rc: $(tail -2 "$QLOG" | tr '\n' '|')"
  nomanual "wizard $1"
}
wizard "yes + write" $'y\np-wz\n\n'
grep -q 'RUNTIME_BRIDGE_AIF_PROJECT_ID=p-wz' "$WZ/rc" && ok "wizard yes: the project id is in the shell rc" || bad "wizard yes: rc file: $(cat "$WZ/rc" 2>/dev/null)"
jq -e '.hooks.PostToolUse | map(.hooks[].command) | any(test("runtime-bridge-dispatch"))' "$WZ/r/.claude/settings.json" >/dev/null 2>&1 \
  && ok "wizard yes: the PostToolUse entry is written" || bad "wizard yes: no PostToolUse entry in settings.json"
wizard "yes again (rc block present)" $'y\np-wz\n\n'
[ "$(grep -c 'added by setup-runtime-bridge.sh' "$WZ/rc")" -eq 1 ] && ok "wizard again: the rc block is appended once" || bad "wizard again: rc block duplicated"
wizard "yes + declined write" $'y\n\n\nn'
grep -q 'NOT written.*declined' "$QLOG" && ok "wizard declined: a NOT-written fact with the reason" || bad "wizard declined: $(cat "$QLOG")"
wizard "yes + --no-write-settings" $'y\n\n' --no-write-settings
grep -q 'NOT written.*--no-write-settings' "$QLOG" && ok "wizard --no-write-settings: a NOT-written fact with the reason" || bad "wizard --no-write-settings: $(cat "$QLOG")"
wizard "no" 'n'
rm -rf "$WZ" "$QLOG"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
