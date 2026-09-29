#!/usr/bin/env bash
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"

# detect succeeds → skip, never runs install
out=$(companion_step "fake" "true" "echo SHOULD_NOT_RUN" "cc-plugin" "yes")
grep -q SHOULD_NOT_RUN <<<"$out" && bad "ran install despite detect-present" || ok "detect-present → skip"
grep -qi 'skip' <<<"$out" && ok "skip message emitted" || bad "no skip message"

# detect fails + mode=yes → runs install
out=$(companion_step "fake" "false" "echo INSTALLED_OK" "cc-plugin" "yes")
grep -q INSTALLED_OK <<<"$out" && ok "detect-absent + yes → installs" || bad "did not install"

# mode=dry-run → never runs install even when detect fails
# (whole-line match: executed install emits a bare SHOULD_NOT_RUN line; the dry-run
#  message only embeds the command mid-line — deviation from plan, see PR notes)
out=$(companion_step "fake" "false" "echo SHOULD_NOT_RUN" "cc-plugin" "dry-run")
grep -qx SHOULD_NOT_RUN <<<"$out" && bad "dry-run ran install" || ok "dry-run → no install"

# external-service kind → does not run install_cmd (routed elsewhere)
out=$(companion_step "rb" "false" "echo SHOULD_NOT_RUN" "external-service" "yes")
grep -q SHOULD_NOT_RUN <<<"$out" && bad "external-service ran install_cmd" || ok "external-service → not a plain install"


# === return status under `set -e` (the caller `setup` runs with -e; a companion must never kill it) ===
# Regression: the trailing `[ "$kind" = "mcp" ] && printf` made every non-mcp companion return 1
# on both the ✓ and the ⚠ branch → `setup -y` died on a fresh machine (PR #1613 CI, getff-dist cell).
_rc_probe() {  # $1 = install_cmd ; prints the caller-visible outcome under set -e
  bash -c 'set -euo pipefail; ENGINE_LIB_ONLY=1 source "$1/setup.d/engine.sh"; companion_step probe "false" "$2" "cc-plugin" "yes" >/dev/null; echo CALLER_CONTINUES' _ "$REPO_ROOT" "$1" 2>/dev/null
}
grep -q CALLER_CONTINUES <<<"$(_rc_probe "true")"  && ok "cc-plugin install OK → caller under set -e continues (rc 0)"   || bad "cc-plugin install OK → companion_step returned non-zero under set -e"
grep -q CALLER_CONTINUES <<<"$(_rc_probe "false")" && ok "cc-plugin install FAILS → caller under set -e continues (⚠, rc 0)" || bad "cc-plugin install failure killed the set -e caller"
out=$(companion_step "probe" "false" "false" "cc-plugin" "yes")
grep -q 'install failed — .* exited non-zero' <<<"$out" && ok "install failure still emits the ⚠ install-failed line" || bad "⚠ install-failed line missing on install failure"
grep -qiE 'manually|yourself' <<<"$out" && bad "install failure hands back a manual step" || ok "install failure names no manual step"

# === kind=mcp tests (S2 — engine.sh kind=mcp support) ===

# Create a temporary claude stub so command -v claude succeeds for mcp tests.
_stub_bin=$(mktemp -d)
printf '#!/bin/sh\necho "claude-stub $*"\n' > "$_stub_bin/claude"
chmod +x "$_stub_bin/claude"

# kind=mcp + detect-present → skip (no install_cmd run)
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "true" "echo SHOULD_NOT_RUN" "mcp" "yes")
grep -q SHOULD_NOT_RUN <<<"$out" && bad "kind=mcp ran install despite detect-present" || ok "kind=mcp detect-present → skip"
grep -qi 'skip' <<<"$out" && ok "kind=mcp skip message emitted" || bad "no skip message for kind=mcp detect-present"

# kind=mcp + detect-absent + yes → runs install_cmd
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "false" "echo INSTALLED_MCP" "mcp" "yes")
grep -q INSTALLED_MCP <<<"$out" && ok "kind=mcp detect-absent + yes → installs" || bad "kind=mcp did not install"

# kind=mcp + dry-run → no install even when detect fails
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "false" "echo SHOULD_NOT_RUN" "mcp" "dry-run")
grep -qx SHOULD_NOT_RUN <<<"$out" && bad "kind=mcp dry-run ran install" || ok "kind=mcp dry-run → no install"

# kind=mcp with --scope user in install_cmd → machine-scope label emitted
out=$(GETFF_GLOBAL=1 PATH="$_stub_bin:$PATH" companion_step "deepwiki" "false" "echo --scope user INSTALLED" "mcp" "yes")
grep -qi 'machine.scope\|machine scope' <<<"$out" && ok "kind=mcp --scope user → machine-scope label emitted" || bad "no machine-scope label for user-scope MCP"

# kind=mcp with claude CLI absent → graceful skip (no install, return 0)
_empty_bin=$(mktemp -d)
out=$(PATH="$_empty_bin:/usr/bin:/bin" companion_step "ctx7" "false" "echo SHOULD_NOT_RUN" "mcp" "yes")
grep -qi 'absent' <<<"$out" && ok "claude CLI absent → notice emitted" || bad "no 'absent' notice when claude CLI missing"
grep -q SHOULD_NOT_RUN <<<"$out" && bad "ran install despite claude CLI absent" || ok "no install when claude CLI absent"
rm -rf "$_empty_bin"

# === machine-global installs need --global under -y (critical-review S1-4, operator decision
# 2026-09-23: «-y только в проект»). -y used to be the only consent for user-scope plugin / MCP /
# marketplace adds and `npm install -g`, and INSTALL-FOR-AI.md tells agents to run -y unasked. ===
for _g in "npm install -g @ast-grep/cli" "claude plugin install x@y --scope user" "claude plugin marketplace add a/b && claude plugin install c"; do  # ci-tool-pin: allow fixture strings fed to the classifier, not an install
  out=$(GETFF_GLOBAL="" PATH="$_stub_bin:$PATH" companion_step "g" "false" "echo GLOBAL_RAN # $_g" "cc-plugin" "yes")
  grep -qx GLOBAL_RAN <<<"$out" && bad "-y without --global ran a machine-global install ($_g)" || ok "-y without --global: machine-global install NOT run ($_g)"
  grep -q -- '--global' <<<"$out" && ok "the skip line names --global ($_g)" || bad "the skip line does not say how to allow it ($_g)"
  out=$(GETFF_GLOBAL=1 PATH="$_stub_bin:$PATH" companion_step "g" "false" "echo GLOBAL_RAN # $_g" "cc-plugin" "yes")
  grep -qx GLOBAL_RAN <<<"$out" && ok "GETFF_GLOBAL=1 (--global): machine-global install runs ($_g)" || bad "--global did not allow the machine-global install ($_g)"
done
# paired negative: a project-scoped install still runs under plain -y.
out=$(GETFF_GLOBAL="" companion_step "p" "false" "echo PROJECT_RAN" "cli" "yes")
grep -qx PROJECT_RAN <<<"$out" && ok "-y still runs a project-scoped companion install" || bad "-y no longer runs a project-scoped install"

rm -rf "$_stub_bin"

# === ./setup's companion gaps reach a NOT-wired summary (Q4.7) ===
# ./setup runs install.sh as its own process — that run prints its summary and exits — and then
# sources only engine.sh, so a note_not_wired() call from companion_step found no function and
# its gap was lost. engine.sh now keeps the gaps itself and prints them after the companions.
# shellcheck source=tests/install-sh/lib/manual-step.sh
. "$REPO_ROOT/tests/install-sh/lib/manual-step.sh"
_cs_out=$(bash -c 'set -euo pipefail; unset GETFF_GLOBAL; ENGINE_LIB_ONLY=1 source "$1/setup.d/engine.sh"
  companion_step globaltool "false" "npm install -g globaltool" "cc-plugin" "yes"   # ci-tool-pin: allow test fixture, never executed (-y without --global skips it)
  companion_step brokentool "false" "false" "cc-plugin" "yes"
  companion_not_wired_summary' _ "$REPO_ROOT" 2>&1)
_cs_log=$(mktemp); printf '%s\n' "$_cs_out" > "$_cs_log"
_cs_sum=$(awk '/NOT wired/{on=1; next} on' "$_cs_log")
grep -q 'globaltool — not installed: .*machine-global' <<<"$_cs_sum" \
  && ok "companions: a machine-global skip under -y is a NOT-wired line with its reason" \
  || bad "companions: no NOT-wired line for the machine-global skip: $(printf '%s' "$_cs_out" | tr '\n' '|')"
grep -q 'brokentool — not installed: .*failed' <<<"$_cs_sum" \
  && ok "companions: a failed install is a NOT-wired line with its reason" \
  || bad "companions: no NOT-wired line for the failed install"
asks_by_hand "$_cs_log" && bad "companions: the output hands back a step: $(manual_step_lines "$_cs_log" | head -2 | tr '\n' '|')" \
  || ok "companions: the output hands back no step"
_cs_none=$(bash -c 'ENGINE_LIB_ONLY=1 source "$1/setup.d/engine.sh"; companion_not_wired_summary' _ "$REPO_ROOT" 2>&1)
[ -z "$_cs_none" ] && ok "companions: no gaps → no summary" || bad "companions: an empty summary printed: $_cs_none"
grep -qE '^[[:space:]]*companion_not_wired_summary' "$REPO_ROOT/setup" \
  && ok "setup prints the companion NOT-wired summary" || bad "setup never calls companion_not_wired_summary"
rm -f "$_cs_log"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
