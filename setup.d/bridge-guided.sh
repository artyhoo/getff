#!/usr/bin/env bash
# Runtime-bridge guided-detect. Sourceable in lib-only mode (BRIDGE_LIB_ONLY=1).
# Detection keys on /health (works for docker OR native aif-handoff) — never assumes docker.

bridge_health_ok() {
  local url="$1"
  curl -sf "${url}/health" >/dev/null 2>&1
}

# Returns: up | docker | docker-down | native | absent
#
# `docker-down` (binary installed, daemon not answering) is its own state, not a flavour of
# `absent`: the two have opposite reasons (a stopped daemon vs no docker at all), and a caller
# cannot recover the difference afterwards — re-running `command -v docker && docker info` is
# exactly the test that already failed to produce `docker` (ledger A1-7, PR #1597).
# Ordering note: `native` still wins over `docker-down`, so a machine with the aif-handoff CLI
# and a stopped docker daemon keeps the pre-existing `native` report.
bridge_diagnose() {
  local url="$1"
  if bridge_health_ok "$url"; then echo "up"; return 0; fi
  local has_docker=""
  command -v docker >/dev/null 2>&1 && has_docker=1
  if [ -n "$has_docker" ] && docker info >/dev/null 2>&1; then echo "docker"; return 0; fi
  if command -v aif-handoff >/dev/null 2>&1; then echo "native"; return 0; fi
  if [ -n "$has_docker" ]; then echo "docker-down"; return 0; fi
  echo "absent"
}

# _bridge_not_wired <line> — a runtime-bridge gap with its reason (Q4.7: a gap, never a step).
# Sourced from ./setup, the engine's companion_not_wired is in scope and the line joins ./setup's
# companion summary; sourced alone (a test, a direct call), the fact is printed in place.
_bridge_not_wired() {
  if command -v companion_not_wired >/dev/null 2>&1; then
    companion_not_wired "runtime-bridge — $1"
  else
    printf '  ⚠ NOT wired: runtime-bridge — %s\n' "$1"
  fi
}

# Flow: diagnose → wire when aif-handoff answers → otherwise report what is not wired and why.
# (Calls setup-runtime-bridge.sh for the our-side env/hook/settings.json writes.)
bridge_guided_run() {
  local url="${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}"
  local state; state=$(bridge_diagnose "$url")
  case "$state" in
    up)      printf '  ✓ aif-handoff reachable at %s\n' "$url" ;;
    docker)  printf '  aif-handoff not responding at %s; docker is available.\n' "$url"
             _bridge_not_wired "not wired: aif-handoff does not answer at $url; docker is available, but getff does not start aif-handoff from a checkout it did not make" ;;
    native)  printf '  aif-handoff CLI present but not responding at %s.\n' "$url"
             _bridge_not_wired "not wired: the aif-handoff CLI is installed but does not answer at $url, and getff does not start a service it did not install" ;;
    docker-down) printf '  aif-handoff not responding at %s; the docker daemon is not running.\n' "$url"
             _bridge_not_wired "not wired: aif-handoff does not answer at $url, and the docker daemon is not running — getff does not start the docker daemon" ;;
    absent)  printf '  aif-handoff not detected (no docker, no CLI).\n'
             _bridge_not_wired "not wired: this machine has no docker and no aif-handoff CLI, so there is no aif-handoff to wire to; docs/runtime-bridge-setup.md describes the runtime" ;;
  esac
  # Cross-layer warning (owner GO 2026-07-11): the AIF operator suite (--profile factory, or
  # the legacy --with-aif-suite/--all escape) presupposes this runtime — files landed but no
  # runtime means the suite skills dead-end. Both depth signals must be read: --profile factory
  # is the one that installs the suite today, and checking only the legacy escape meant the
  # modern flag installed the suite and got no warning. PROFILE_DEPTH is in scope when sourced
  # from ./setup, PROFILE when exported by install.sh; harmless empty otherwise.
  if [ "$state" != "up" ] \
    && { [ -n "${WITH_AIF_SUITE:-}" ] || [ "${PROFILE_DEPTH:-${PROFILE:-}}" = "factory" ]; }; then
    printf '  ⚠ AIF operator suite installed (--profile factory / --with-aif-suite / --all) but the aif-handoff runtime is not reachable — suite skills (pipeline/dispatcher/harvest/…) will dead-end until it is up.\n'
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
      # install.sh payload. A NOT-wired fact, not a failure (dual-impl §3, Q4.7).
      _bridge_not_wired "not wired: aif-handoff answers at $url, but the wiring script (setup-runtime-bridge.sh) ships with the getff repository and is not part of this install; docs/runtime-bridge-setup.md describes the wiring"
      return 0
    fi
  fi
}

if [ "${BRIDGE_LIB_ONLY:-}" = "1" ]; then
  return 0 2>/dev/null || true
fi
