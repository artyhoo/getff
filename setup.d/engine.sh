#!/usr/bin/env bash
# Companion manifest engine. Sourceable in lib-only mode (ENGINE_LIB_ONLY=1).
# companion_step <name> <detect_cmd> <install_cmd> <kind> <mode>
#   mode: interactive | yes | dry-run
# Principle: detect-first; install only via the companion's own official command; no version pin.
#
# kind values:
#   cc-plugin        — Claude Code plugin (claude plugin install …); post-install wrapper loop
#   external-service — handed off to runtime-bridge guided-detect; install_cmd ignored
#   mcp              — Claude MCP server (claude mcp add …); detect-first; consumed by the
#                      05-mcp layer INSIDE install.sh (before 70-deps), NOT the post-install
#                      wrapper loop (D5/I1 ordering — setup wrapper MUST skip kind=mcp rows).

companion_step() {
  local name="$1" detect_cmd="$2" install_cmd="$3" kind="$4" mode="$5"

  # External services are not plain installs — the caller (setup) routes them to bridge guided-detect.
  if [ "$kind" = "external-service" ]; then
    printf '[%s] external service — handled by runtime-bridge guided-detect\n' "$name"
    return 0
  fi

  # MCP servers require the claude CLI. Fail-soft (graceful skip) when absent.
  if [ "$kind" = "mcp" ] && ! command -v claude >/dev/null 2>&1; then
    printf '  ⊝ claude CLI absent — skipping MCP %s\n' "$name"
    return 0
  fi

  # Scope label for verbose logging (mcp kind only).
  local _scope_label=""
  if [ "$kind" = "mcp" ]; then
    if echo "$install_cmd" | grep -q -- '--scope user'; then
      _scope_label="user-scope (machine-global)"
    else
      _scope_label="project-scope"
    fi
  fi

  if eval "$detect_cmd" >/dev/null 2>&1; then
    if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] detect: present (%s) — skip\n' "$name" "$_scope_label"; fi
    printf '  ⊝ %s already present — skipping\n' "$name"
    return 0
  fi
  if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] detect: absent (%s)\n' "$name" "$_scope_label"; fi

  if [ "$mode" = "dry-run" ]; then
    printf '  [dry-run] would install %s: %s\n' "$name" "$install_cmd"
    return 0
  fi

  local do_it="$mode"
  if [ "$mode" = "interactive" ]; then
    printf '  Install %s? [y/N]: ' "$name"
    read -r ans || ans=""
    case "$ans" in [yY]|[yY][eE][sS]) do_it="yes" ;; *) do_it="no" ;; esac
  fi

  if [ "$do_it" = "yes" ]; then
    if [ "$kind" = "mcp" ]; then
      printf '  [mcp:%s] installing (%s): %s\n' "$name" "$_scope_label" "$install_cmd"
      if [ "$_scope_label" = "user-scope (machine-global)" ]; then
        printf '  ⚠ machine-scope (one-time): %s added to user MCP scope — persists across all projects on this machine\n' "$name"
      fi
    fi
    if eval "$install_cmd"; then
      printf '  ✓ %s installed\n' "$name"
      if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] install: success\n' "$name"; fi
    else
      printf '  ⚠ %s install failed — run manually: %s\n' "$name" "$install_cmd"
      if [ "$kind" = "mcp" ]; then printf '  [mcp:%s] install: failed\n' "$name"; fi
    fi
  else
    printf '  ⊝ %s skipped\n' "$name"
  fi
  # Always 0: a companion is optional by contract (the ⚠ line already says «run manually»).
  # The caller (`setup`, `set -e`) must never die on a companion — before this line the
  # trailing `[ "$kind" = "mcp" ] && printf` made every non-mcp companion return 1 on BOTH
  # branches, so a fresh machine (superpowers absent → install attempted) killed `setup -y`
  # right after «✓ superpowers installed» — or, without the claude CLI, after the ⚠ line
  # (caught by tests/consumer-matrix/getff-dist-cell.sh in CI, PR #1613).
  return 0
}

# Lib-only guard: when sourced for tests, expose the function without parsing the manifest.
if [ "${ENGINE_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
