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
# Resolve root via BASH_SOURCE (cwd-independent — mirrors bridge-guided.sh:259).
_aif_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=setup.d/bridge-guided.sh
source "$_aif_root/setup.d/bridge-guided.sh"
# --- companion_not_wired / companion_not_wired_summary (engine.sh, lib-only) ---
# This helper runs after 99-finalize printed the install's NOT-wired summary, as its own process,
# so a gap here goes to a summary of its own (Q4.7: a gap with its reason, never a step).
# shellcheck source=setup.d/engine.sh
ENGINE_LIB_ONLY=1 source "$_aif_root/setup.d/engine.sh"

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

# --- Gating inputs (ledger A1-3, PR #1597) ---------------------------------
# This helper runs as a SEPARATE `bash` process, so install.sh's own DRY_RUN / FULL shell
# variables are invisible here unless exported. install.sh exports the two facts below; a
# helper invoked by hand defaults to "interactive, for real".
#   GETFF_DRY_RUN=--dry-run   preview only — probe nothing, clone nothing, write nothing.
#                             install.sh gates the spawn as well; this is the child-side
#                             half of the same gate, so a direct invocation is inert too.
#   GETFF_NONINTERACTIVE=1    the -y / --full / --all path. `setup` documents it as never
#                             prompting, so the helper auto-declines instead of blocking on
#                             `read -r` (which, at a TTY, hangs the documented one-click run).
#   AIF_GUIDED_INSTALL=1|0    explicit consent / refusal. This is the opt-in that lets a
#                             non-interactive run install rather than degrade.
GETFF_DRY_RUN="${GETFF_DRY_RUN:-}"
GETFF_NONINTERACTIVE="${GETFF_NONINTERACTIVE:-}"
AIF_GUIDED_INSTALL="${AIF_GUIDED_INSTALL:-}"

_log() { printf '[aif-handoff-guided-install] %s\n' "$*" >&2; }

# _aif_handoff_record_version — the aif-handoff version this machine runs, read from its checkout
# (`git describe`: the tag, or tag+commits+sha) and recorded in the project's
# .ai-factory/tool-decisions.md (engine.sh companion_record_version). The clone is not pinned (one-button
# fork on pins = B, operator log entry 28): it tracks upstream, and the record says what was there.
# A running aif-handoff with no checkout at AIF_HANDOFF_CHECKOUT is recorded as «not read».
# The row is committed with the project, so a checkout under HOME (the default ~/code/aif-handoff)
# is written home-relative: the person's home path never lands in the repository.
_aif_handoff_record_version() {
  local v="" where="$AIF_HANDOFF_CHECKOUT"
  if [ -d "$AIF_HANDOFF_CHECKOUT/.git" ]; then
    v=$(git -C "$AIF_HANDOFF_CHECKOUT" describe --tags --always 2>/dev/null || true)
  fi
  # shellcheck disable=SC2088  # a literal «~» is the point: the recorded text, never expanded
  case "$where" in "$HOME"/*) where="~/${where#"$HOME"/}" ;; esac
  companion_record_version aif-handoff external-service "${v:-not read}" "git describe in $where"
}

# _aif_handoff_record_failure <reason> — one audit-log line per failed bring-up step.
# Every failure branch routes through here so no step can fail without leaving a trace
# (the A1-4 class: a `set -e` abort past the logging is indistinguishable from success).
_aif_handoff_record_failure() {
  _log "AIF_HANDOFF: $1"
  printf '[%s] AIF_HANDOFF: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
}

# _aif_handoff_resolve_consent — decide install-vs-degrade, never blocking a documented
# non-interactive run. Sets $_AIF_CONSENT to yes|no (a global, not stdout: the [y/N] prompt
# has to reach the user's terminal, and command substitution would swallow it).
_AIF_CONSENT=""
_AIF_WHY=""
_aif_handoff_resolve_consent() {
  _AIF_CONSENT="no"
  _AIF_WHY="not installed: the guided install was declined (AIF_GUIDED_INSTALL=$AIF_GUIDED_INSTALL)"
  case "$AIF_GUIDED_INSTALL" in
    1|y|Y|yes|YES|true)
      _AIF_CONSENT="yes"
      _log "consent=explicit opt-in (AIF_GUIDED_INSTALL=$AIF_GUIDED_INSTALL)"
      return 0
      ;;
    0|n|N|no|NO|false)
      _log "consent=explicit opt-out (AIF_GUIDED_INSTALL=$AIF_GUIDED_INSTALL)"
      return 0
      ;;
  esac
  if [ "$GETFF_NONINTERACTIVE" = "1" ]; then
    printf '  Non-interactive run (-y / --full / --all) — declining the guided install rather than blocking on a prompt.\n'
    _AIF_WHY="not installed: the guided install clones a repository and starts containers, and a non-interactive run does that only with AIF_GUIDED_INSTALL=1"
    _log "consent=auto-decline (GETFF_NONINTERACTIVE=1 — the never-prompt contract in ./setup)"
    return 0
  fi
  printf '  Clone aif-handoff + docker compose up -d? [y/N]: '
  local ans=""
  read -r ans || ans=""
  case "$ans" in
    [yY]|[yY][eE][sS]) _AIF_CONSENT="yes" ;;
    *) _AIF_WHY="not installed: the guided install was declined at the prompt" ;;
  esac
}

# ---------------------------------------------------------------------------
# aif_handoff_guided_install — the interactive flow.
# States (reuse bridge_diagnose taxonomy): up | docker | docker-down | native | absent
# ---------------------------------------------------------------------------
aif_handoff_guided_install() {
  local state
  # A1-3: under --dry-run the run must be observably inert. `99-finalize` has already
  # printed "Nothing was written" by the time this helper is reached, so a probe, a clone,
  # a `docker compose up -d` or an audit-log line here would each make that banner a lie.
  if [ "$GETFF_DRY_RUN" = "--dry-run" ]; then
    printf '  [dry-run] would probe aif-handoff at %s\n' "$AIF_URL"
    printf '  [dry-run] would, only on explicit consent, clone %s into %s and run `docker compose up -d`\n' "$AIF_HANDOFF_REPO_URL" "$AIF_HANDOFF_CHECKOUT"
    printf '  [dry-run] nothing cloned, no containers started, no audit-log line written\n'
    _log "dry-run: guided install skipped (no side effects)"
    return 0
  fi
  state=$(bridge_diagnose "$AIF_URL")
  _log "diagnose: state=$state at $AIF_URL"

  case "$state" in
    up)
      # Detect-first per companion-install-principle.md §1: running aif → no re-install prompt.
      printf '  ✓ aif-handoff already running at %s\n' "$AIF_URL"
      _log "state=up: no-op (detect-first — companion-install-principle.md §1)"
      _aif_handoff_record_version
      return 0
      ;;
    docker)
      # Docker present, aif not responding → offer consented guided install.
      printf '  aif-handoff not responding; docker is available.\n'
      _aif_handoff_resolve_consent
      if [ "$_AIF_CONSENT" != "yes" ]; then
        _log "consent=no: declining guided install"
        _aif_handoff_degrade "$_AIF_WHY"
        return 0
      fi
      _log "consent=yes: cloning $AIF_HANDOFF_REPO_URL → $AIF_HANDOFF_CHECKOUT"
      # A1-4: these two pipelines carried no `|| …` under `set -euo pipefail`, so a failed
      # clone or compose killed the helper at that line — past the degrade notice, past the
      # audit-log line, past the health wait — while install.sh's `|| true` still reported
      # the install as fine. Both now route through the same degrade path as a decline.
      if [ -d "$AIF_HANDOFF_CHECKOUT" ]; then
        _log "checkout exists at $AIF_HANDOFF_CHECKOUT — pulling latest"
        git -C "$AIF_HANDOFF_CHECKOUT" pull --ff-only 2>&1 | sed 's/^/    /' >&2 || true
      elif ! git clone "$AIF_HANDOFF_REPO_URL" "$AIF_HANDOFF_CHECKOUT" 2>&1 | sed 's/^/    /' >&2; then
        printf '  ⚠ git clone of %s failed\n' "$AIF_HANDOFF_REPO_URL" >&2
        _aif_handoff_record_failure "failed git-clone"
        _aif_handoff_degrade "not installed: git clone of $AIF_HANDOFF_REPO_URL failed (its output is above)"
        return 0
      fi
      # Docker compose v2 is the 2026 default (compose v1 is docker-compose, deprecated).
      _log "docker compose up -d in $AIF_HANDOFF_CHECKOUT"
      if ! (cd "$AIF_HANDOFF_CHECKOUT" && docker compose up -d) 2>&1 | sed 's/^/    /' >&2; then
        printf '  ⚠ docker compose up -d failed in %s\n' "$AIF_HANDOFF_CHECKOUT" >&2
        _aif_handoff_record_failure "failed docker-compose-up"
        _aif_handoff_degrade "not running: docker compose up -d failed in $AIF_HANDOFF_CHECKOUT (its output is above)"
        return 0
      fi
      # Wait for health (max ~30s — mirrors setup-runtime-bridge.sh health-wait pattern).
      _log "waiting for aif-handoff health (max 30s)"
      local i=0
      while [ "$i" -lt 30 ]; do
        if bridge_health_ok "$AIF_URL"; then
          printf '  ✓ aif-handoff up at %s\n' "$AIF_URL"
          _log "state=up after docker compose; re-probe green"
          _aif_handoff_record_version
          printf '[%s] AIF_HANDOFF: up\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
          return 0
        fi
        sleep 1
        i=$((i + 1))
      done
      printf '  ⚠ aif-handoff failed to come up in 30s\n' >&2
      _aif_handoff_record_failure "failed docker-compose-timeout"
      _aif_handoff_degrade "not running: docker compose up -d succeeded in $AIF_HANDOFF_CHECKOUT, but $AIF_URL did not answer /health within 30s"
      return 0
      ;;
    native)
      # aif CLI present, not responding → a NOT-wired fact (no auto-start: getff did not install it).
      printf '  aif-handoff CLI present but not responding.\n'
      _log "state=native: not started by getff, no auto-install"
      _aif_handoff_degrade "not running: the aif-handoff CLI is installed but does not answer at $AIF_URL, and getff does not start a service it did not install"
      return 0
      ;;
    docker-down)
      # A1-7: docker is installed, the daemon is not running. This used to live inside the
      # `absent` arm behind `command -v docker && docker info` — the very test whose failure
      # produced `absent`, so the branch was unreachable and this user was told to INSTALL
      # docker. bridge_diagnose now reports the two apart.
      printf '  aif-handoff not detected. Docker binary present but the daemon is not running.\n'
      _log "state=docker-down: degrade to env-level"
      _aif_handoff_degrade "not installed: the guided install runs it in docker, and the docker daemon is not running — getff does not start the docker daemon"
      return 0
      ;;
    absent)
      # No docker binary and no CLI → nothing to offer; degrade with the reason.
      printf '  aif-handoff not detected (no docker, no CLI).\n'
      _log "state=absent: degrade to env-level"
      _aif_handoff_degrade "not installed: the guided install runs it in docker, and this machine has no docker and no aif-handoff CLI, and getff installs neither"
      return 0
      ;;
    *)
      printf '  ⚠ aif-handoff diagnose returned unknown state: %s\n' "$state" >&2
      _aif_handoff_degrade "not installed: its diagnose returned an unknown state ($state)"
      return 0
      ;;
  esac
}

# ---------------------------------------------------------------------------
# _aif_handoff_degrade <reason> — the consented env-level fall-through (spec §4 A1).
# This is a DESIGNED SUCCESS PATH (kickoff §6 T-BDU-B): the companion decline → env IS designed;
# it is NOT the same as the one-button flow degrading to manual which IS a MISS. The reason goes
# to this helper's own NOT-wired summary (Q4.7) — a fact, never a «start / install / re-run» step.
# ---------------------------------------------------------------------------
_aif_handoff_degrade() {
  printf '  aif-handoff is not running here — factory profile degrades to env-level\n'
  printf '  (multi-model contour placeholders only, no aif runtime).\n'
  companion_not_wired "aif-handoff — $1"
  companion_not_wired_summary
  _log "degrade: factory → env-level (designed success — spec §4 A1, T-BDU-B)"
  printf '[%s] AIF_HANDOFF: degrade env-level\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$AIF_INSTALL_LOG" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# aif_handoff_offer — the read-only probe behind the pre-launch list's aif line (one-button
# point 8). The heavy install (a clone plus docker containers) is offered as its own line ONLY
# when bridge_diagnose says `docker`: docker runs and aif-handoff does not answer. It prints ONE
# TAB-separated line and changes nothing (no clone, no compose, no audit-log line, no prompt):
#   offer<TAB><the line to show><TAB>AIF_GUIDED_INSTALL=1   — a «yes» becomes that variable on
#                                                             the `./setup --all` command
#   skip<TAB><why it is not offered><TAB>-                    — shown in the report, not asked
# ---------------------------------------------------------------------------
aif_handoff_offer() {
  local state
  state=$(bridge_diagnose "$AIF_URL")
  case "$state" in
    docker) printf 'offer\taif-handoff (heavy: clones a repository, starts docker containers)\tAIF_GUIDED_INSTALL=1\n' ;;
    up) printf 'skip\talready running at %s\t-\n' "$AIF_URL" ;;
    docker-down) printf 'skip\tnot installed: docker is not running\t-\n' ;;
    native) printf 'skip\tthe aif-handoff CLI is installed but does not answer at %s; getff does not start a service it did not install\t-\n' "$AIF_URL" ;;
    absent) printf 'skip\tnot offered: the guided install runs aif-handoff in docker, and this machine has no docker\t-\n' ;;
    *) printf 'skip\tnot offered: its diagnose returned an unknown state (%s)\t-\n' "$state" ;;
  esac
}

# ---------------------------------------------------------------------------
# Entry point — invoked from install.sh under PROFILE=factory; `--offer` is the pre-launch probe.
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--offer" ]; then
  aif_handoff_offer
else
  aif_handoff_guided_install
fi
