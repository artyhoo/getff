#!/usr/bin/env bash
# critical-review S5-9 (interim, operator decision 2026-09-23) — setup.d/80-rule-bootstrap.sh ran
# the generator as `( … ) || true`: when it could not run at all (the published getff package
# ships none of the generator's dependencies — tsx, ajv) the consumer's research produced no rule
# and the install said nothing. The step must now say the generation FAILED and list it under the
# final «NOT wired» summary; it still never aborts the install.
#
# ARMS:
#   (A) generator exits non-zero → loud FAILED line + one NOT_WIRED entry, layer returns 0
#   (B) paired negative: generator exits 0 → no FAILED line, NOT_WIRED stays empty
#   (C) how the generator is started (N14, critical-review S5-9): plain `node` on the prebuilt
#       packages/core/install/rule-bootstrap-cli.bundle.mjs, from the PROJECT root — never npx/tsx,
#       which needed the getff clone's own node_modules (a clone has none). The project root is
#       the cwd so the bundle loads the project's own eslint + parser and eslint-rules-local/.
#   (D) P2 G6: the generator REJECTED the research plan (exit 3, reason on stderr) → the NOT wired
#       line says «research plan rejected» and carries the generator's first reason line, so the
#       report names why no rule was generated instead of only an exit code.
#   (E) P5 A2: the generator KEPT some entries and DROPPED others (exit 0, one «dropped research
#       entry <id> — <reason>» stderr line each) → one NOT wired line per dropped entry, naming the
#       entry and its reason; no FAILED / REJECTED line (the other entries were generated).
#   (F) P5 B: the research lines the rule table reads land in RESEARCH_EXTRA for the project-checks
#       record — each dropped entry with the gate's reason and each research-only entry, both from
#       the generator's read-only --check-plan (no new record file); paired negative: no research
#       file → no research line
#   (G) a plan the gate rejects whole records one research-rejected line with the reason, nothing else
#   (H) P5 A5: stack «generic» keeps its NOT wired line and records every research entry as
#       research-only with the generic reason; paired negative: no research file → no research line
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

run_layer() {  # $1 = generator exit, $2 = optional stderr line, $3 = stack; prints the layer's output
  local rc="$1" msg="${2:-}" stack="${3:-ts-server}" W
  W=$(mktemp -d)
  mkdir -p "$W/pkg/packages/core/install" "$W/proj/.ai-factory/rules-research" "$W/bin"
  : > "$W/pkg/packages/core/install/rule-bootstrap-cli.bundle.mjs"
  if [ -z "${NO_RESEARCH:-}" ]; then
    echo '{}' > "$W/proj/.ai-factory/rules-research/$stack.research.json"
    echo '{}' > "$W/proj/.ai-factory/rules-research/$stack.selection.json"
  fi
  # Stub `node` and `npx`: each reports how it was started, the generator stand-in exits $rc; the
  # read-only --check-plan call prints $CHECK_JSON (the plan gate's answer) and exits 0.
  # The project has ESLint (P5 A3 installs a toolchain only when it does not); the node stub is the
  # generator only for the bundle, real node for anything else (the step's require.resolve probe).
  mkdir -p "$W/proj/node_modules/eslint"; echo 'module.exports={}' > "$W/proj/node_modules/eslint/index.js"
  printf '#!/bin/sh\ncase "$1" in *rule-bootstrap-cli.bundle.mjs) ;; *) exec "%s" "$@" ;; esac\ncase "$*" in *--check-plan*) [ -z "$CHECK_ERR" ] || echo "$CHECK_ERR" >&2; printf "%%s\\n" "$CHECK_JSON"; exit "${CHECK_RC:-0}" ;; esac\necho "stub generator: node cwd=$PWD args=$*"\n[ -n "%s" ] && echo "%s" >&2\nexit %s\n' "$(command -v node)" "$msg" "$msg" "$rc" > "$W/bin/node"; chmod +x "$W/bin/node"
  printf '#!/bin/sh\necho "stub generator: npx cwd=$PWD args=$*"\nexit %s\n' "$rc" > "$W/bin/npx"; chmod +x "$W/bin/npx"
  (
    PATH="$W/bin:$PATH"; FULL=--full; DRY_RUN=""; STACK=$stack
    PKG_ROOT="$W/pkg"; PROJECT_ROOT="$W/proj"; NOT_WIRED=()
    _none='{"kept":[],"dropped":[],"researchOnly":[]}'
    export CHECK_JSON="${CHECK_JSON:-$_none}" CHECK_RC="${CHECK_RC:-0}" CHECK_ERR="${CHECK_ERR:-}"
    # shellcheck disable=SC1090
    INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    # shellcheck disable=SC1090
    source "$REPO_ROOT/setup.d/80-rule-bootstrap.sh"; echo "LAYER_RC=$?"
    echo "NOT_WIRED_COUNT=${#NOT_WIRED[@]}"
    [ "${#NOT_WIRED[@]}" -gt 0 ] && printf 'NOT_WIRED: %s\n' "${NOT_WIRED[@]}"
    echo "RESEARCH_EXTRA_COUNT=${#RESEARCH_EXTRA[@]}"
    [ "${#RESEARCH_EXTRA[@]}" -gt 0 ] && printf 'RESEARCH_EXTRA: %s\n' "${RESEARCH_EXTRA[@]}"
  ) 2>&1
  rm -rf "$W"
}

_out=$(run_layer 1)
grep -q 'LAYER_RC=0' <<<"$_out" && ok "(A) the layer still returns 0 (never aborts the install)" || bad "(A) the layer did not return 0 (got: $_out)"
grep -q 'FAILED' <<<"$_out" && ok "(A) a loud FAILED line names the failed generation" || bad "(A) no FAILED line (got: $_out)"
grep -q 'NOT_WIRED_COUNT=1' <<<"$_out" && ok "(A) the failure is listed under NOT wired" || bad "(A) NOT_WIRED not recorded (got: $_out)"
grep -q 'NOT_WIRED: .*rules-research' <<<"$_out" && ok "(A) the NOT wired line names the research the rules came from" || bad "(A) NOT wired line lacks the research path"

_out=$(run_layer 0)
grep -q 'FAILED' <<<"$_out" && bad "(B) FAILED printed for a successful generation" || ok "(B) a successful generation prints no FAILED line"
grep -q 'NOT_WIRED_COUNT=0' <<<"$_out" && ok "(B) a successful generation records nothing as not wired" || bad "(B) NOT_WIRED recorded on success (got: $_out)"

grep -q 'stub generator: npx' <<<"$_out" && bad "(C) the generator was started through npx (needs the clone's node_modules)" || ok "(C) the generator is not started through npx/tsx"
grep -Eq 'stub generator: node cwd=[^ ]*/proj args=[^ ]*/pkg/packages/core/install/rule-bootstrap-cli\.bundle\.mjs --consumer-root [^ ]*/proj ' <<<"$_out" \
  && ok "(C) plain node runs the prebuilt bundle from the project root" \
  || bad "(C) expected 'node <pkg>/…/rule-bootstrap-cli.bundle.mjs --consumer-root <proj>' from cwd <proj> (got: $_out)"

_out=$(run_layer 3 '[rule-bootstrap] live research artefact invalid or unreadable — Invalid ResearchPlan: data must have required property framework')
grep -q 'LAYER_RC=0' <<<"$_out" && ok "(D) a rejected plan still returns 0 from the layer" || bad "(D) the layer did not return 0 (got: $_out)"
grep -q 'NOT_WIRED: .*research plan rejected: Invalid ResearchPlan: data must have required property framework' <<<"$_out" \
  && ok "(D) the NOT wired line names the rejection and its reason" \
  || bad "(D) expected 'research plan rejected: <reason>' in NOT wired (got: $_out)"

_drops='[rule-bootstrap] dropped research entry vite-env-via-import-meta — FF2005: unknown allowlistKey: vite
[rule-bootstrap] dropped research entry broken-summary — FF1001: must be string (at /patterns/2/summary)'
_out=$(run_layer 0 "$_drops")
grep -q 'NOT_WIRED_COUNT=2' <<<"$_out" && ok "(E) one NOT wired line per dropped entry" || bad "(E) expected 2 NOT wired lines (got: $_out)"
grep -q 'NOT_WIRED: generated rule for research entry vite-env-via-import-meta — dropped: FF2005: unknown allowlistKey: vite; the other entries were generated' <<<"$_out" \
  && ok "(E) the line names the entry and the gate's reason" \
  || bad "(E) expected 'generated rule for research entry <id> — dropped: <reason>' (got: $_out)"
grep -Eq 'FAILED|REJECTED' <<<"$_out" && bad "(E) a partial drop printed FAILED/REJECTED" || ok "(E) a partial drop is not reported as a failed or rejected plan"

_check='{"kept":["react-keys-stable"],"dropped":[{"id":"vite-env-via-import-meta","reason":"FF2005: unknown allowlistKey: vite"}],"researchOnly":["react-keys-stable"]}'
_out=$(CHECK_JSON="$_check" run_layer 0 '[rule-bootstrap] dropped research entry vite-env-via-import-meta — FF2005: unknown allowlistKey: vite')
grep -qx 'RESEARCH_EXTRA: research-dropped: vite-env-via-import-meta — FF2005: unknown allowlistKey: vite' <<<"$_out" \
  && ok "(F) a dropped entry is recorded with the gate's reason" || bad "(F) no research-dropped line (got: $_out)"
grep -qx 'RESEARCH_EXTRA: research-only: react-keys-stable' <<<"$_out" \
  && ok "(F) a research-only entry is recorded" || bad "(F) no research-only line (got: $_out)"
grep -q 'RESEARCH_EXTRA_COUNT=2' <<<"$_out" && ok "(F) exactly those two lines" || bad "(F) expected 2 research lines (got: $_out)"
_out=$(NO_RESEARCH=1 CHECK_JSON="$_check" run_layer 0)
grep -q 'RESEARCH_EXTRA_COUNT=0' <<<"$_out" && ok "(F) no research file records no research line (paired negative)" || bad "(F) research lines without a research file (got: $_out)"

_why='Invalid ResearchPlan: data must have required property framework'
_out=$(CHECK_RC=3 CHECK_JSON='' CHECK_ERR="[rule-bootstrap] research plan rejected — $_why" run_layer 3 "[rule-bootstrap] live research artefact invalid or unreadable — $_why")
grep -qx "RESEARCH_EXTRA: research-rejected: $_why" <<<"$_out" \
  && ok "(G) a rejected plan is recorded with its reason" || bad "(G) no research-rejected line (got: $_out)"
grep -q 'RESEARCH_EXTRA_COUNT=1' <<<"$_out" && ok "(G) and nothing else" || bad "(G) expected 1 research line (got: $_out)"

_out=$(CHECK_JSON='{"kept":["go-errors-wrapped"],"dropped":[],"researchOnly":["go-errors-wrapped"]}' run_layer 0 '' generic)
grep -q "NOT_WIRED: generated rules — not run: the rule generator writes ESLint rules, and stack «generic» has no ESLint getff placed" <<<"$_out" \
  && ok "(H) generic keeps its NOT wired line" || bad "(H) generic NOT wired line missing (got: $_out)"
grep -qx "RESEARCH_EXTRA: research-only: go-errors-wrapped — stack generic: no rule generator lane for this project's toolchain" <<<"$_out" \
  && ok "(H) each generic research entry is recorded with the generic reason" || bad "(H) no generic research-only line (got: $_out)"
grep -q 'stub generator: node' <<<"$_out" && bad "(H) the generator ran on generic" || ok "(H) the generator does not run on generic"
_out=$(NO_RESEARCH=1 run_layer 0 '' generic)
grep -q 'RESEARCH_EXTRA_COUNT=0' <<<"$_out" && ok "(H) generic without a research file records no research line (paired negative)" || bad "(H) research lines without a file (got: $_out)"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
