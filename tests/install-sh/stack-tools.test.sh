#!/usr/bin/env bash
# tests/install-sh/stack-tools.test.sh — circle 2 in a real consumer install (one-button point 7):
# vendor MCP servers for the project's own dependencies, only on the pre-launch yes.
#
# The registries answer from packages/core/install/fixtures/mcp-source-check (live answers recorded
# 2026-09-29), so CI makes no network call. Arms:
#   yes      — GETFF_STACK_TOOLS=1: sentry's server (two ownership signals: GitHub org + npm scope)
#              lands in .mcp.json as an http remote; prisma's (one signal: its homepage domain) is
#              only proposed; look-alikes from other namespaces are neither; tool-decisions.md carries
#              one line per decision with server, owner, version and the matched dependency;
#   no yes   — no vendor server is added and tool-decisions.md gains nothing;
#   dry-run  — the yes under --dry-run writes nothing;
#   rerun    — a second --force install on the yes adds nothing twice and keeps one line per server;
#   getff's  — @playwright/test (getff's own tool, lib.sh getff_dep_names) in package.json gets no
#              server looked up: no @playwright/mcp, one «not looked up» line, sentry still written.
# Every grep reads a file directly: under pipefail a pipe into an early-exiting grep can report 141
# and flip an arm (scripts/check-pipefail-early-exit.mjs).
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v jq >/dev/null 2>&1 || { echo "  ⊝ jq absent — skipped"; echo "PASS=0 FAIL=0"; exit 0; }
[ -f "$REPO_ROOT/packages/core/install/mcp-source-check.bundle.mjs" ] || { bad "the check's bundle is not built"; echo "PASS=$PASS FAIL=$FAIL"; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
: > "$WORK/gitconfig"; export GIT_CONFIG_GLOBAL="$WORK/gitconfig"
export GETFF_MCP_FETCH_FIXTURES="$REPO_ROOT/packages/core/install/fixtures/mcp-source-check"
export GETFF_DEEPWIKI_MACHINE_WIDE=0 GETFF_TODAY=2026-09-29

install_into() { # install_into DIR YES [extra flag]
  mkdir -p "$1"; git -C "$1" init -q
  printf '{"name":"fixture","dependencies":{"react":"^19.0.0","@sentry/react":"^11.0.0","@prisma/client":"^7.0.0"}}\n' > "$1/package.json"
  ( cd "$1" && GETFF_STACK_TOOLS="$2" bash "$REPO_ROOT/install.sh" react-spa --profile core --force ${3:+"$3"} </dev/null ) \
    > "$1.log" 2>&1 || bad "install exited non-zero: $(tail -3 "$1.log" | tr '\n' '|')"
}
servers() { jq -r '.mcpServers | keys | join(",")' "$1/.mcp.json" 2>/dev/null; }
decfile() { echo "$1/.ai-factory/tool-decisions.md"; }

echo "── the pre-launch yes"
Y="$WORK/yes"; install_into "$Y" 1
if jq -e '.mcpServers.sentry == {"type":"http","url":"https://mcp.sentry.dev/mcp"}' "$Y/.mcp.json" >/dev/null 2>&1; then
  ok "sentry's own server (two signals) is in .mcp.json as an http remote"
else bad "no sentry entry: $(servers "$Y")"; fi
if grep -qE '^- io\.prisma/mcp: proposed, not installed — needs a second ownership signal' "$(decfile "$Y")"; then
  ok "prisma's server (one signal) is proposed in tool-decisions.md, not written"
else bad "no proposal line for io.prisma/mcp"; fi
if [ "$(servers "$Y")" = "sentry" ]; then ok "nothing else was added (one-signal servers and look-alikes stay out)"
else bad "unexpected .mcp.json servers: $(servers "$Y")"; fi
if grep -qE '^\| sentry \| MCP \| 2026-09-29 \| .*io\.github\.getsentry/sentry-mcp 0\.42\.0 — owner: GitHub org: .*npm scope: .*matched dependency @sentry/react \|$' "$(decfile "$Y")"; then
  ok "tool-decisions.md: the sentry line names server, owner, version and dependency"
else bad "no C4 line for sentry in tool-decisions.md"; fi
if grep -q 'io.prisma/mcp' "$Y.log"; then ok "the install log reports each decision"; else bad "install log does not report the decisions"; fi

echo "── no yes"
N="$WORK/no"; install_into "$N" ""
if [ -z "$(servers "$N")" ]; then ok "without the yes no vendor server is added"; else bad "servers without the yes: $(servers "$N")"; fi
if grep -q 'getsentry' "$(decfile "$N")"; then bad "tool-decisions.md gained a line without the yes"; else ok "tool-decisions.md gained nothing"; fi
if grep -q 'vendor MCP servers for your dependencies not checked' "$N.log"; then ok "the log says the check was not chosen"
else bad "no «not checked» line in the log"; fi

echo "── the yes under --dry-run"
D="$WORK/dry"; install_into "$D" 1 --dry-run
if [ -f "$D/.mcp.json" ] && jq -e '.mcpServers.sentry' "$D/.mcp.json" >/dev/null 2>&1; then bad "--dry-run wrote a server"
else ok "--dry-run adds no server"; fi
if [ -f "$(decfile "$D")" ] && grep -q 'getsentry' "$(decfile "$D")"; then bad "--dry-run wrote a decision"
else ok "--dry-run writes no decision"; fi
if grep -q '\[dry-run\] ✓ .mcp.json: sentry' "$D.log"; then ok "--dry-run reports what it would add"
else bad "no [dry-run] line: $(grep -i 'mcp' "$D.log" | tail -3 | tr '\n' '|')"; fi

echo "── a second install on the yes"
# --force re-seeds tool-decisions.md from the template while .mcp.json keeps the servers: each
# server must still have exactly one line saying why it is there.
install_into "$Y" 1
for s in io.github.getsentry/sentry-mcp io.prisma/mcp; do
  n=$(grep -c "$s" "$(decfile "$Y")")
  if [ "$n" = 1 ]; then ok "after a --force rerun $s has exactly one line in tool-decisions.md"; else bad "$s has $n lines after a rerun"; fi
done
if [ "$(servers "$Y")" = "sentry" ]; then ok "a rerun adds no server twice"; else bad "servers after a rerun: $(servers "$Y")"; fi

echo "── a rerun with getff's own tools in package.json"
# A getff install with its dependencies leaves @playwright/test in a vite project's package.json, and
# Microsoft publishes a two-signal server for it (GitHub org + the @playwright scope naming it). The
# rerun must not take it for the project's own: 35 passes getff_dep_names as --getff-deps.
PW_FX="$WORK/fx"; cp -R "$GETFF_MCP_FETCH_FIXTURES" "$PW_FX"
printf '%s' '{"name":"@playwright/test","version":"1.56.0","homepage":"https://playwright.dev","repository":{"url":"git+https://github.com/microsoft/playwright.git"}}' \
  > "$PW_FX/registry.npmjs.org__playwright_2ftest_latest.json"
printf '%s' '{"name":"@playwright/mcp","version":"0.0.41","mcpName":"io.github.microsoft/playwright-mcp"}' \
  > "$PW_FX/registry.npmjs.org__playwright_2fmcp_latest.json"
P="$WORK/pw"; mkdir -p "$P"; git -C "$P" init -q
printf '{"name":"fixture","dependencies":{"react":"^19.0.0","@sentry/react":"^11.0.0"},"devDependencies":{"@playwright/test":"^1.56.0","vite":"^7.0.0"}}\n' > "$P/package.json"
( cd "$P" && GETFF_MCP_FETCH_FIXTURES="$PW_FX" GETFF_STACK_TOOLS=1 bash "$REPO_ROOT/install.sh" react-spa --profile core --force </dev/null ) \
  > "$P.log" 2>&1 || bad "install exited non-zero: $(tail -3 "$P.log" | tr '\n' '|')"
if grep -q 'playwright' "$P/.mcp.json" 2>/dev/null; then bad "a server for getff's own @playwright/test was written: $(servers "$P")"
else ok "no MCP server is written for getff's own @playwright/test"; fi
if grep -q "not looked up: @playwright/test.* — getff's own tools" "$P.log"; then ok "the log names getff's own tools as not looked up"
else bad "no «not looked up» line: $(grep -iE 'playwright|not looked' "$P.log" | tail -3 | tr '\n' '|')"; fi
if [ "$(servers "$P")" = "sentry" ]; then ok "the project's own dependencies are still checked (sentry written)"
else bad "servers with getff's tools present: $(servers "$P")"; fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
