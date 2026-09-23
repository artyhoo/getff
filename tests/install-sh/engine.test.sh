#!/usr/bin/env bash
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

ENGINE_LIB_ONLY=1 source "$REPO_ROOT/setup.d/engine.sh"

# detect succeeds → skip, never runs install
out=$(companion_step "fake" "true" "echo SHOULD_NOT_RUN" "cc-plugin" "yes")
echo "$out" | grep -q SHOULD_NOT_RUN && bad "ran install despite detect-present" || ok "detect-present → skip"
echo "$out" | grep -qi 'skip' && ok "skip message emitted" || bad "no skip message"

# detect fails + mode=yes → runs install
out=$(companion_step "fake" "false" "echo INSTALLED_OK" "cc-plugin" "yes")
echo "$out" | grep -q INSTALLED_OK && ok "detect-absent + yes → installs" || bad "did not install"

# mode=dry-run → never runs install even when detect fails
# (whole-line match: executed install emits a bare SHOULD_NOT_RUN line; the dry-run
#  message only embeds the command mid-line — deviation from plan, see PR notes)
out=$(companion_step "fake" "false" "echo SHOULD_NOT_RUN" "cc-plugin" "dry-run")
echo "$out" | grep -qx SHOULD_NOT_RUN && bad "dry-run ran install" || ok "dry-run → no install"

# external-service kind → does not run install_cmd (routed elsewhere)
out=$(companion_step "rb" "false" "echo SHOULD_NOT_RUN" "external-service" "yes")
echo "$out" | grep -q SHOULD_NOT_RUN && bad "external-service ran install_cmd" || ok "external-service → not a plain install"


# === return status under `set -e` (the caller `setup` runs with -e; a companion must never kill it) ===
# Regression: the trailing `[ "$kind" = "mcp" ] && printf` made every non-mcp companion return 1
# on both the ✓ and the ⚠ branch → `setup -y` died on a fresh machine (PR #1613 CI, getff-dist cell).
_rc_probe() {  # $1 = install_cmd ; prints the caller-visible outcome under set -e
  bash -c 'set -euo pipefail; ENGINE_LIB_ONLY=1 source "$1/setup.d/engine.sh"; companion_step probe "false" "$2" "cc-plugin" "yes" >/dev/null; echo CALLER_CONTINUES' _ "$REPO_ROOT" "$1" 2>/dev/null
}
_rc_probe "true"  | grep -q CALLER_CONTINUES && ok "cc-plugin install OK → caller under set -e continues (rc 0)"   || bad "cc-plugin install OK → companion_step returned non-zero under set -e"
_rc_probe "false" | grep -q CALLER_CONTINUES && ok "cc-plugin install FAILS → caller under set -e continues (⚠, rc 0)" || bad "cc-plugin install failure killed the set -e caller"
out=$(companion_step "probe" "false" "false" "cc-plugin" "yes")
echo "$out" | grep -q 'install failed — run manually' && ok "install failure still emits the ⚠ run-manually line" || bad "⚠ run-manually line missing on install failure"

# === kind=mcp tests (S2 — engine.sh kind=mcp support) ===

# Create a temporary claude stub so command -v claude succeeds for mcp tests.
_stub_bin=$(mktemp -d)
printf '#!/bin/sh\necho "claude-stub $*"\n' > "$_stub_bin/claude"
chmod +x "$_stub_bin/claude"

# kind=mcp + detect-present → skip (no install_cmd run)
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "true" "echo SHOULD_NOT_RUN" "mcp" "yes")
echo "$out" | grep -q SHOULD_NOT_RUN && bad "kind=mcp ran install despite detect-present" || ok "kind=mcp detect-present → skip"
echo "$out" | grep -qi 'skip' && ok "kind=mcp skip message emitted" || bad "no skip message for kind=mcp detect-present"

# kind=mcp + detect-absent + yes → runs install_cmd
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "false" "echo INSTALLED_MCP" "mcp" "yes")
echo "$out" | grep -q INSTALLED_MCP && ok "kind=mcp detect-absent + yes → installs" || bad "kind=mcp did not install"

# kind=mcp + dry-run → no install even when detect fails
out=$(PATH="$_stub_bin:$PATH" companion_step "ctx7" "false" "echo SHOULD_NOT_RUN" "mcp" "dry-run")
echo "$out" | grep -qx SHOULD_NOT_RUN && bad "kind=mcp dry-run ran install" || ok "kind=mcp dry-run → no install"

# kind=mcp with --scope user in install_cmd → machine-scope label emitted
out=$(GETFF_GLOBAL=1 PATH="$_stub_bin:$PATH" companion_step "deepwiki" "false" "echo --scope user INSTALLED" "mcp" "yes")
echo "$out" | grep -qi 'machine.scope\|machine scope' && ok "kind=mcp --scope user → machine-scope label emitted" || bad "no machine-scope label for user-scope MCP"

# kind=mcp with claude CLI absent → graceful skip (no install, return 0)
_empty_bin=$(mktemp -d)
out=$(PATH="$_empty_bin:/usr/bin:/bin" companion_step "ctx7" "false" "echo SHOULD_NOT_RUN" "mcp" "yes")
echo "$out" | grep -qi 'absent' && ok "claude CLI absent → notice emitted" || bad "no 'absent' notice when claude CLI missing"
echo "$out" | grep -q SHOULD_NOT_RUN && bad "ran install despite claude CLI absent" || ok "no install when claude CLI absent"
rm -rf "$_empty_bin"

# === machine-global installs need --global under -y (critical-review S1-4, operator decision
# 2026-09-23: «-y только в проект»). -y used to be the only consent for user-scope plugin / MCP /
# marketplace adds and `npm install -g`, and INSTALL-FOR-AI.md tells agents to run -y unasked. ===
for _g in "npm install -g @ast-grep/cli" "claude plugin install x@y --scope user" "claude plugin marketplace add a/b && claude plugin install c"; do  # ci-tool-pin: allow fixture strings fed to the classifier, not an install
  out=$(GETFF_GLOBAL="" PATH="$_stub_bin:$PATH" companion_step "g" "false" "echo GLOBAL_RAN # $_g" "cc-plugin" "yes")
  echo "$out" | grep -qx GLOBAL_RAN && bad "-y without --global ran a machine-global install ($_g)" || ok "-y without --global: machine-global install NOT run ($_g)"
  echo "$out" | grep -q -- '--global' && ok "the skip line names --global ($_g)" || bad "the skip line does not say how to allow it ($_g)"
  out=$(GETFF_GLOBAL=1 PATH="$_stub_bin:$PATH" companion_step "g" "false" "echo GLOBAL_RAN # $_g" "cc-plugin" "yes")
  echo "$out" | grep -qx GLOBAL_RAN && ok "GETFF_GLOBAL=1 (--global): machine-global install runs ($_g)" || bad "--global did not allow the machine-global install ($_g)"
done
# paired negative: a project-scoped install still runs under plain -y.
out=$(GETFF_GLOBAL="" companion_step "p" "false" "echo PROJECT_RAN" "cli" "yes")
echo "$out" | grep -qx PROJECT_RAN && ok "-y still runs a project-scoped companion install" || bad "-y no longer runs a project-scoped install"

rm -rf "$_stub_bin"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
