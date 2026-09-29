#!/usr/bin/env bash
# setup.d/05-mcp.sh — MCP companion install layer (S2).
#
# Ported from orphaned setup.sh:289-303 (T3/M2 — setup.sh is dead code; do NOT revive it).
# Gated on FULL ("yes" / --full carrier, install.sh:95+128) so the non-full / snapshot path
# no-ops this layer → byte-identical guarantee preserved (D2).
# Processes kind=mcp manifest rows INSIDE install.sh (before 70-deps) per I1 channel constraint.
#
# Depends on: lib.sh (already in dispatcher scope via install.sh), engine.sh (sourced here)
# @cc-only-rationale: sourced by install.sh dispatcher, not standalone

# Gate: MCP provisioning only runs on the --full / yes pass.
if [ -z "${FULL:-}" ]; then
  return 0 2>/dev/null || true
fi

# ── T1: project MCP servers → .mcp.json (regression L1 restore from setup.sh:289-303) ─────────
# One writer shared with the python lane (lib.sh add_getff_mcp_servers): context7 as an http remote,
# deepwiki as an http remote only when it is not configured machine-wide. Additive merge — never
# clobbers existing .mcpServers entries (brownfield safety, D3 + park-don't-guess contract).
add_getff_mcp_servers "${PROJECT_ROOT}/.mcp.json"

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
