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

# === installed versions: read after install, recorded in tool-decisions.md, never pinned ===
# One-button fork on pins = B (operator log entry 28). Stubs: `claude plugin list --json` answers
# with STUB_SP_VERSION for superpowers; `npm ls -g` answers like npm 10 for @ast-grep/cli.
_vb=$(mktemp -d); _vp=$(mktemp -d); mkdir -p "$_vp/.ai-factory"
cat > "$_vb/claude" <<'EOF'
#!/bin/sh
if [ "$1 $2 $3" = "plugin list --json" ]; then
  printf '[{"id":"other@x","version":"9.9.9"},{"id":"superpowers@claude-plugins-official","version":"%s"}]\n' "${STUB_SP_VERSION:-5.0.7}"
fi
exit 0
EOF
cat > "$_vb/npm" <<'EOF'
#!/bin/sh
[ "$1 $2" = "ls -g" ] && printf '/usr/local/lib\n`-- @ast-grep/cli@0.44.1\n'
exit 0
EOF
chmod +x "$_vb/claude" "$_vb/npm"
_vdec="$_vp/.ai-factory/tool-decisions.md"
printf '## Accepted\n\n| Tool | Type | Accepted | Rationale |\n| mine | MCP | 2026-01-01 | the project'"'"'s own row |\n' > "$_vdec"
_sp="claude plugin install superpowers@claude-plugins-official --scope user"
_vrun() { ( cd "$_vp" && PROJECT_ROOT="$_vp" GETFF_TODAY=2026-09-29 GETFF_GLOBAL=1 PATH="$_vb:$PATH" companion_step "$@" ); }
out=$(_vrun superpowers "true" "$_sp" cc-plugin yes)
grep -qxF '| superpowers | cc-plugin | 5.0.7 | 2026-09-29 | claude plugin list --json |' "$_vdec" \
  && ok "versions: a present plugin's installed version is recorded" || bad "versions: no superpowers row: $(tr '\n' '|' < "$_vdec")"
grep -q 'superpowers version 5.0.7 recorded' <<<"$out" && ok "versions: the report names the version" || bad "versions: no report line: $out"
out=$(STUB_SP_VERSION=5.1.0 _vrun superpowers "false" "$_sp" cc-plugin yes)
[ "$(grep -c '^| superpowers |' "$_vdec")" = 1 ] && grep -q '^| superpowers | cc-plugin | 5.1.0 |' "$_vdec" \
  && ok "versions: after an install the row is replaced, not duplicated" || bad "versions: rows after a second run: $(grep '^| superpowers' "$_vdec" | tr '\n' '|')"
grep -qxF "| mine | MCP | 2026-01-01 | the project's own row |" "$_vdec" && ok "versions: the project's own lines are kept" || bad "versions: the project's own row was lost"
out=$(_vrun ast-grep-cli "true" "npm install -g @ast-grep/cli" cli yes)  # ci-tool-pin: allow test fixture, never executed (detect answers present)
grep -q '^| ast-grep-cli | cli | 0.44.1 | 2026-09-29 | npm ls -g |' "$_vdec" && ok "versions: a global npm CLI's version is recorded" || bad "versions: no ast-grep-cli row"
[ "$(grep -c 'getff:installed-versions:begin' "$_vdec")" = 1 ] && ok "versions: one block for all tools" || bad "versions: the block was added twice"
cp "$_vdec" "$_vp/before"
out=$(_vrun superpowers "true" "$_sp" cc-plugin dry-run)
cmp -s "$_vdec" "$_vp/before" && ok "versions: dry-run records nothing" || bad "versions: dry-run wrote tool-decisions.md"
out=$(_vrun other "true" "claude plugin install nope@nowhere --scope user" cc-plugin yes)
grep -q '^| other | cc-plugin | not read |' "$_vdec" && ok "versions: an unreadable version is recorded as «not read», never guessed" || bad "versions: no «not read» row"
# P2 writes its own marked block into the same file (one-button P2, `aif:project-checks`); either
# order, its lines — even a row that starts like one of ours — stay byte-identical.
_p2='<!-- aif:project-checks:begin -->
## Project checks

| superpowers | a P2 row that only looks like a versions row |
<!-- aif:project-checks:end -->'
for _order in before after; do
  # the first run adds our block; the measured second run goes through the rewrite path over P2's lines
  if [ "$_order" = before ]; then printf '## Accepted\n\n%s\n' "$_p2" > "$_vdec"; _vrun superpowers "true" "$_sp" cc-plugin yes >/dev/null
  else printf '## Accepted\n' > "$_vdec"; _vrun superpowers "true" "$_sp" cc-plugin yes >/dev/null; printf '\n%s\n' "$_p2" >> "$_vdec"; fi
  out=$(STUB_SP_VERSION=5.2.0 _vrun superpowers "true" "$_sp" cc-plugin yes)
  _p2now=$(sed -n '/aif:project-checks:begin/,/aif:project-checks:end/p' "$_vdec")
  [ "$_p2now" = "$_p2" ] && [ "$(grep -c 'getff:installed-versions:begin' "$_vdec")" = 1 ] \
    && sed -n '/getff:installed-versions:begin/,/getff:installed-versions:end/p' "$_vdec" | grep -q '^| superpowers | cc-plugin | 5.2.0 |' \
    && ok "versions: P2's project-checks block $_order ours is kept byte-identical and ours still records" \
    || bad "versions: P2 block $_order ours: $(tr '\n' '|' < "$_vdec")"
done
rm -f "$_vdec"
out=$(_vrun superpowers "true" "$_sp" cc-plugin yes)
[ ! -e "$_vdec" ] && grep -q 'not recorded: .ai-factory/tool-decisions.md is not in this project' <<<"$out" \
  && ok "versions: no tool-decisions.md → the report says so, no file is created" || bad "versions: absent file: $out"
rm -rf "$_vb" "$_vp"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
