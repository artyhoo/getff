#!/usr/bin/env bash
# aif-handoff-guided-install.sh — consented guided INSTALL for the aif-handoff companion
# (beta-delivery-ux S4, spec §4 A1). UPGRADES the S1 detect+instruct declaration to a
# consented guided INSTALL: official repo, docker compose, detect-first; decline → graceful
# env-level degradation.
#
# Sourced/invoked from install.sh under PROFILE=factory (parallel to how bridge-guided.sh's
# bridge_guided_run is invoked from the setup wrapper). Mirrors the bridge-guided.sh shape:
# detection reuses bridge_diagnose (single source of truth — dual-implementation-discipline.md §7);
# the interactive flow offers install on consent; decline is a first-class designed-success path.
#
# The helper IS invoked from install.sh, NOT from engine.sh. The companions.manifest row stays
# kind=external-service (engine.sh prints + returns 0 at :18-21); the actual handling routes
# through this helper, exactly like the runtime-bridge row precedent (companions.manifest:18).
set -euo pipefail

# --- Source bridge-guided.sh for bridge_diagnose / bridge_health_ok (SSOT — §7) ---
# Resolve root via BASH_SOURCE (cwd-independent — mirrors bridge-guided.sh:41).
_aif_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=setup.d/bridge-guided.sh
source "$_aif_root/setup.d/bridge-guided.sh"

# --- Constants ---
AIF_URL="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
# Official aif-handoff repo URL. Default upstream per §7d.2 host-side verification
# (gh api repos/sst-aif/aif-handoff → 404; repos/lee-to/aif-handoff → 200, 2026-08-09).
# Env-overridable for consumers who mirror to a different remote.
AIF_HANDOFF_REPO_URL="${AIF_HANDOFF_REPO_URL:-https://github.com/lee-to/aif-handoff.git}"
# Checkout path — mirrors the operator's ~/code/aif-handoff convention.
AIF_HANDOFF_CHECKOUT="${AIF_HANDOFF_CHECKOUT:-$HOME/code/aif-handoff}"
# Install audit log (mirror the setup.d/ python/cargo lane audit trail pattern).
AIF_INSTALL_LOG="${AIF_INSTALL_LOG:-$HOME/.getff-factory-install.log}"

_log() { printf '[aif-handoff-guided-install] %s\n' "$*" >&2; }

# ---------------------------------------------------------------------------
# aif_handoff_guided_install — the interactive flow.
# States (reuse bridge_diagnose taxonomy): up | docker | native | absent
# ---------------------------------------------------------------------------
aif_handoff_guided_install() {
  local state
  state=$(bridge_diagnose "$AIF_URL")
  _log "diagnose: state=$state at $AIF_URL"

  case "$state" in
    up)
      # Detect-first per companion-install-principle.md §1: running aif → no re-install prompt.
      printf '  ✓ aif-handoff already running at %s\n' "$AIF_URL"
      _log "state=up: no-op (detect-first — companion-install-principle.md §1)"
      return 0
      ;;
    docker)
      # Docker present, aif not responding → offer consented guided install.
      printf '  aif-handoff not responding; docker is available.\n'
      printf '  Clone aif-handoff + docker compose up -d? [y/N]: '
      local ans=""
      read -r ans || ans=""
      case "$ans" in
        [yY]|[yY][eE][sS])
          _log "consent=yes: cloning $AIF_HANDOFF_REPO_URL → $AIF_HANDOFF_CHECKOUT"
          if [ -d "$AIF_HANDOFF_CHECKOUT" ]; then
            _log "checkout exists at $AIF_HANDOFF_CHECKOUT — pulling latest"
            git -C "$AIF_HANDOFF_CHECKOUT" pull --ff-only 2>&1 | sed 's/^/    /' >&2 || true
          else
            git clone "$AIF_HANDOFF_REPO_URL" "$AIF_HANDOFF_CHECKOUT" 2>&1 | sed 's/^/    /' >&2
          fi
          # Docker compose v2 is the 2026 default (compose v1 is docker-compose, deprecated).
          _log "docker compose up -d in $AIF_HANDOFF_CHECKOUT"
          (cd "$AIF_HANDOFF_CHECKOUT" && docker compose up -d) 2>&1 | sed 's/^/    /' >&2
          # Wait for health (max ~30s — mirrors setup-runtime-bridge.sh health-wait pattern).
          _log "waiting for aif-handoff health (max 30s)"
          local i=0
          while [ "$i" -lt 30 ]; do
            if bridge_health_ok "$AIF_URL"; then
              printf '  ✓ aif-handoff up at %s\n' "$AIF_URL"
              _log "state=up after docker compose; re-probe green"
              printf '[%s] AIF_HANDOFF: up\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
              return 0
            fi
            sleep 1
            i=$((i + 1))
          done
          printf '  ⚠ aif-handoff failed to come up in 30s\n' >&2
          _log "AIF_HANDOFF: failed docker-compose-timeout"
          printf '[%s] AIF_HANDOFF: failed docker-compose-timeout\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
          _aif_handoff_degrade
          return 0
          ;;
        *)
          _log "consent=no: declining guided install"
          _aif_handoff_degrade
          return 0
          ;;
      esac
      ;;
    native)
      # aif CLI present, not responding → instruct start (no auto-install).
      printf '  aif-handoff CLI present but not responding.\n'
      printf '  Start it manually (e.g. `aif-handoff serve`), then re-run with --profile factory.\n'
      _log "state=native: instruct start, no auto-install"
      _aif_handoff_degrade
      return 0
      ;;
    absent)
      # No docker, no CLI → offer the docker-compose path if docker appears installable;
      # otherwise degrade. The offer is consented (never forced — companion-install-principle.md §1).
      if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
        # docker daemon not running but binary exists — treat as docker state (retry offer).
        printf '  aif-handoff not detected. Docker binary present but daemon down.\n'
        printf '  Start docker, then re-run with --profile factory for guided install.\n'
      else
        printf '  aif-handoff not detected (docker down + no CLI).\n'
        printf '  Install docker, then re-run with --profile factory for guided install.\n'
      fi
      _log "state=absent: degrade to env-level"
      _aif_handoff_degrade
      return 0
      ;;
    *)
      printf '  ⚠ aif-handoff diagnose returned unknown state: %s\n' "$state" >&2
      _aif_handoff_degrade
      return 0
      ;;
  esac
}

# ---------------------------------------------------------------------------
# _aif_handoff_degrade — the consented env-level fall-through (spec §4 A1).
# This is a DESIGNED SUCCESS PATH (kickoff §6 T-BDU-B): the companion decline → env IS designed;
# it is NOT the same as the one-button flow degrading to manual which IS a MISS.
# ---------------------------------------------------------------------------
_aif_handoff_degrade() {
  printf '  aif-handoff not installed — factory profile degrades to env-level\n'
  printf '  (multi-model contour placeholders only, no aif runtime).\n'
  printf '  Re-run with --profile factory after aif-handoff is up to enable the full contour.\n'
  _log "degrade: factory → env-level (designed success — spec §4 A1, T-BDU-B)"
  printf '[%s] AIF_HANDOFF: degrade env-level\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Entry point — invoked from install.sh under PROFILE=factory.
# ---------------------------------------------------------------------------
aif_handoff_guided_install
