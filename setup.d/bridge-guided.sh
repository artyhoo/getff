#!/usr/bin/env bash
# Runtime-bridge guided-detect. Sourceable in lib-only mode (BRIDGE_LIB_ONLY=1).
# Detection keys on /health (works for docker OR native aif-handoff) — never assumes docker.

bridge_health_ok() {
  local url="$1"
  curl -sf "${url}/health" >/dev/null 2>&1
}

# Returns: up | docker | native | absent
bridge_diagnose() {
  local url="$1"
  if bridge_health_ok "$url"; then echo "up"; return 0; fi
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then echo "docker"; return 0; fi
  if command -v aif-handoff >/dev/null 2>&1; then echo "native"; return 0; fi
  echo "absent"
}

# Interactive flow: diagnose → offer matching bring-up → re-poll → report.
# (Calls setup-runtime-bridge.sh for the our-side env/hook/settings.json writes.)
bridge_guided_run() {
  local url="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
  local state; state=$(bridge_diagnose "$url")
  case "$state" in
    up)      printf '  ✓ aif-handoff reachable at %s\n' "$url" ;;
    docker)  printf '  aif-handoff not responding; docker is available. Start it with: docker compose up -d (in your aif-handoff checkout), then re-run.\n' ;;
    native)  printf '  aif-handoff CLI present but not responding — start it, then re-run.\n' ;;
    absent)  printf '  aif-handoff not detected (docker down + no CLI). See docs/runtime-bridge-setup.md for install.\n' ;;
  esac
  # Cross-layer warning (owner GO 2026-07-11): the AIF operator suite (--with-aif-suite/--all)
  # presupposes this runtime — files landed but no runtime means the suite skills dead-end.
  # WITH_AIF_SUITE is in scope when sourced from ./setup; harmless empty otherwise.
  if [ "$state" != "up" ] && [ -n "${WITH_AIF_SUITE:-}" ]; then
    printf '  ⚠ AIF operator suite installed (--with-aif-suite/--all) but the aif-handoff runtime is not reachable — suite skills (pipeline/dispatcher/harvest/…) will dead-end until it is up.\n'
  fi
  # our-side writes are delegated to the existing, tested script:
  if [ "$state" = "up" ]; then
    # Lib is sourced (from ./setup and from tests) → $0 is the caller, not this
    # file. Resolve the framework/consumer root via BASH_SOURCE: this lib lives
    # in setup.d/, so its parent dir is the root. Keeps the call cwd-independent.
    local root; root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    if [ -f "$root/packages/runtime-bridge/scripts/setup-runtime-bridge.sh" ]; then
      bash "$root/packages/runtime-bridge/scripts/setup-runtime-bridge.sh"
    else
      # Consumer install: the script ships with the framework repo, not with
      # install.sh payload. Graceful pointer, not a failure (dual-impl §3).
      printf '  setup-runtime-bridge.sh not present in this checkout (consumer install) — see docs/runtime-bridge-setup.md for manual setup.\n'
      return 0
    fi
  fi
}

if [ "${BRIDGE_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
