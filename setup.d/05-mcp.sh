#!/usr/bin/env bash
# setup.d/05-mcp.sh — MCP companion install layer (S2).
#
# Ported from orphaned setup.sh:289-303 (T3/M2 — setup.sh is dead code; do NOT revive it).
# Gated on FULL ("yes" / --full carrier, install.sh:56+63) so the non-full / snapshot path
# no-ops this layer → byte-identical guarantee preserved (D2).
# Processes kind=mcp manifest rows INSIDE install.sh (before 70-deps) per I1 channel constraint.
#
# Depends on: lib.sh (already in dispatcher scope via install.sh), engine.sh (sourced here)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# Gate: MCP provisioning only runs on the --full / yes pass.
if [ -z "${FULL:-}" ]; then
  return 0 2>/dev/null || true
fi

# ── T1: context7 → .mcp.json (regression L1 restore from setup.sh:289-303) ──────────────────
# Ported shape from orphaned setup.sh:289-303. Additive jq merge — never clobbers existing
# .mcpServers entries (brownfield safety, D3 + park-don't-guess contract).
_05mcp_json="${PROJECT_ROOT}/.mcp.json"
_05mcp_skip_context7=0
if [ -f "$_05mcp_json" ] && grep -q '"context7"' "$_05mcp_json" 2>/dev/null && [ -z "${FORCE:-}" ]; then
  _05mcp_skip_context7=1
fi

if [ "$_05mcp_skip_context7" = "1" ]; then
  printf '  [05-mcp] context7 already in .mcp.json — skipping (use --force to refresh)\n'
elif [ -n "${DRY_RUN:-}" ]; then
  printf '  [dry-run] would: add context7 to .mcp.json (%s)\n' "$_05mcp_json"
else
  if command -v jq >/dev/null 2>&1; then
    if [ -f "$_05mcp_json" ]; then
      # Brownfield: additive merge — only sets the context7 key; all other .mcpServers entries preserved.
      # ledger A1-9 (the A1-8 class): `jq … > tmp && mv` under an UNCONDITIONAL ✓ reported success
      # over a failed rewrite — the consumer kept the old .mcp.json, a half-written .mcp.json.tmp was
      # left in their tree, and rc stayed 0. `set -e` does not catch it (a failing left-hand side of an
      # && list is exempt), so the honest report needs an explicit if/else.
      if jq '.mcpServers["context7"] = {"command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"]}' \
        "$_05mcp_json" > "$_05mcp_json.tmp" && mv "$_05mcp_json.tmp" "$_05mcp_json"; then
        printf '  ✓ [05-mcp] context7 added/updated in existing .mcp.json\n'
      else
        rm -f "$_05mcp_json.tmp" 2>/dev/null || true
        printf '  ⚠ [05-mcp] jq rewrite of %s failed — file left unchanged, context7 NOT added\n' "$_05mcp_json" >&2
      fi
    else
      # Greenfield: create minimal .mcp.json with exact shape from setup.sh:289-303.
      printf '{"mcpServers":{"context7":{"command":"npx","args":["-y","@upstash/context7-mcp@latest"]}}}\n' \
        > "$_05mcp_json"
      printf '  ✓ [05-mcp] .mcp.json created with context7\n'
    fi
    printf '  [05-mcp] path: %s\n' "$_05mcp_json"
  else
    printf '  ⚠ [05-mcp] jq not found — add context7 to .mcp.json manually:\n'
    printf '    "mcpServers": { "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"] } }\n'
  fi
fi

# ── T2: kind=mcp manifest rows — detect-first claude mcp add (I1: before 70-deps) ────────────
# Source engine.sh (full, not ENGINE_LIB_ONLY) to get companion_step in scope.
# shellcheck source=setup.d/engine.sh
source "$PKG_ROOT/setup.d/engine.sh"

_05mcp_mode="yes"
[ -n "${DRY_RUN:-}" ] && _05mcp_mode="dry-run"

_05mcp_row_count=0
while IFS=$'\t' read -r _05mcp_name _05mcp_detect _05mcp_install _05mcp_kind _05mcp_stacks; do
  case "$_05mcp_name" in ''|\#*) continue ;; esac
  [ "$_05mcp_kind" = "mcp" ] || continue
  : "${_05mcp_stacks:-}"  # stacks column (S3 5-col format) read but unused here — stack filtering lives in 15-companions-stack.sh
  _05mcp_row_count=$((_05mcp_row_count + 1))
  printf '  [05-mcp] processing kind=mcp row #%d: %s\n' "$_05mcp_row_count" "$_05mcp_name"
  companion_step "$_05mcp_name" "$_05mcp_detect" "$_05mcp_install" "$_05mcp_kind" "$_05mcp_mode"
done < "$PKG_ROOT/setup.d/companions.manifest"

printf '  [05-mcp] processed %d kind=mcp manifest row(s)\n' "$_05mcp_row_count"
