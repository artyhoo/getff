#!/usr/bin/env bash
# setup.d/35-stack-tools.sh — vendor MCP servers for the project's own dependencies, on the pre-launch yes.
# Circle 2 of the install (one-button point 7): written only when GETFF_STACK_TOOLS=1. For each
# direct dependency the project itself declared (package.json minus what getff's install added, read
# from the copies 70-deps keeps in .ai-factory/before-getff/) the official MCP registry is asked for
# the servers whose namespace that dependency's owner holds; an http remote that needs nothing from
# the person goes into .mcp.json, the rest — a server that would run on this machine (npx) included —
# are «proposed, not installed» with what they need or the line that adds them, and every decision is one
# line in .ai-factory/tool-decisions.md. Skills are never installed here. Logic + ownership rules:
# packages/core/install/mcp-source-check.ts (run as its prebuilt bundle, plain node).
#
# Sources: lib.sh (already in dispatcher scope); runs after 30-templates (tool-decisions.md seeded)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

if [ "${GETFF_STACK_TOOLS:-}" != "1" ]; then
  echo "  · vendor MCP servers for your dependencies not checked (not chosen in the pre-launch list)"
elif [ ! -f "$PROJECT_ROOT/package.json" ]; then
  echo "  · vendor MCP servers not checked: no package.json (the check reads npm dependencies only)"
elif ! command -v node >/dev/null 2>&1; then
  note_not_wired "vendor MCP servers for the project's dependencies — node is not on PATH, and the check runs on node"
elif [ ! -f "$PKG_ROOT/packages/core/install/mcp-source-check.bundle.mjs" ]; then
  note_not_wired "vendor MCP servers for the project's dependencies — packages/core/install/mcp-source-check.bundle.mjs is not in this getff checkout"
else
  echo "▶ Vendor MCP servers for the project's dependencies → .mcp.json"
  _st_had_mcp=0
  [ -f "$PROJECT_ROOT/.mcp.json" ] && _st_had_mcp=1
  # ${DRY_RUN:+--dry-run} passes the flag only under --dry-run; the check writes nothing then.
  # install.sh runs under set -e + pipefail: a crash of the check is a NOT-wired line, never an abort.
  if ! node "$PKG_ROOT/packages/core/install/mcp-source-check.bundle.mjs" --root "$PROJECT_ROOT" ${DRY_RUN:+--dry-run} 2>&1 \
      | sed 's/^/  /'; then
    note_not_wired "vendor MCP servers for the project's dependencies — the check stopped with an error (its output is above)"
  fi
  if [ "$_st_had_mcp" = 0 ] && [ -f "$PROJECT_ROOT/.mcp.json" ]; then
    note_getff_added ".mcp.json"
  fi
fi
