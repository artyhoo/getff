#!/usr/bin/env bash
# aif-agent-target.sh — the ONE answer to «which aif agent container, on which docker context».
#
# Why one file: five helpers each carried their own copy of this lookup — a fixed name
# (`aif-handoff-agent-1`) or `docker ps … | grep -i aif | head -1` on the current docker context
# only. Measured 2026-09-30 on the operator's Mac: the aif stack runs on the PC (docker context
# `pc`, container `aif-agent-1`) while the Mac daemon is down, so every copy either failed or
# needed hand-set env at every call. `head -1` has a second defect: with two agent containers it
# silently picks whichever docker lists first. The dispatcher's in-flight guard fixed both in
# PR 1972 (cold-reviewed); this file is that logic, moved here so every caller shares it.
# The doctor owns it because the doctor owns «is the aif runtime reachable»; dispatcher and
# aif-doctor ship together (setup.d/lib.sh GETFF_SKILLS_FACTORY).
#
# Rules, in order:
#   1. Ask the current docker context. Exactly one agent → it (no further scan).
#      Two or more → AMBIGUOUS: never guess.
#   2. None there, and the caller pinned neither DOCKER_CONTEXT nor DOCKER_HOST, and the docker
#      command is a plain binary (not a routing prefix such as «ssh pc docker») → ask every
#      other context from `docker context ls`, each bounded. Exactly one candidate → it, with
#      its context. Two or more → AMBIGUOUS.
#   3. Nothing anywhere → NONE; the caller keeps its own fallback.
# Container names are read from the last column of `docker ps --filter name=agent` (no
# `--format '{{…}}'`: heal.sh routes docker through ssh to hosts whose shell eats the braces).
#
# Two ways to use it:
#   sourced   . aif-agent-target.sh; aif_agent_resolve
#             → return 0 FOUND / 1 AMBIGUOUS / 2 NONE, and sets
#               AIF_AGENT_NAME     the container name (FOUND only)
#               AIF_AGENT_CONTEXT  the docker context it is on; empty = the current one
#               AIF_AGENT_NOTE     one line: what was chosen and what each context answered
#               AIF_AGENT_REASON   one line: why nothing was chosen (AMBIGUOUS / NONE)
#             The caller applies AIF_AGENT_CONTEXT (e.g. `export DOCKER_CONTEXT`); this file
#             never exports anything.
#   executed  bash aif-agent-target.sh
#             → FOUND: prints «<name><TAB><context>» and exits 0; AMBIGUOUS: reason on stderr,
#               exit 1; NONE: note on stderr, exit 2. (harvest.ts calls it this way.)
#
# Env: AIF_AGENT_DOCKER     docker command, word-split on purpose (default: docker)
#      AIF_AGENT_TIMEOUT_S  seconds per docker call during the lookup (default 8). The bound is
#                           per call: a full scan is at most (contexts + 1) x this budget.
#
# Tested by: packages/core/skills/dispatcher/probe-inflight.test.ts (the discovery arms drive
# this file through the probe) and tests/aif-doctor/aif-agent-target.test.sh (executed mode).

# _aat_bounded <secs> <cmd...>: run cmd, print its stdout, kill it after <secs>. Portable
# (macOS has no `timeout`). Output goes through a temp file, never a pipe: killing the docker
# CLI can leave its `ssh` child alive, and a child that still holds a pipe makes the caller's
# $(...) wait for it — the bound would bound nothing (measured in probe-inflight.test.ts arm
# (g): a 1 s budget took 30 s through a pipe). An orphaned child may outlive the call; it
# writes only to a deleted temp file.
_aat_bounded() {
  local secs="$1"; shift
  local out rc=0 pid watchdog
  out=$(mktemp)
  "$@" </dev/null >"$out" 2>/dev/null &
  pid=$!
  ( sleep "$secs"; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 &
  watchdog=$!
  wait "$pid" 2>/dev/null || rc=$?
  kill "$watchdog" 2>/dev/null || true
  # Reap it with stderr closed: bash 3.2 otherwise prints a «Terminated» job notice.
  wait "$watchdog" 2>/dev/null || true
  cat "$out"
  rm -f "$out"
  return "$rc"
}

# _aat_agents_in [context]: every aif agent container one daemon reports, one per line.
# Returns 124 when the bound cut the call (the context was NOT asked), docker's own exit code
# on any other failure, 0 otherwise (an empty list is a real «none here»).
_aat_agents_in() {
  local raw rc=0
  # shellcheck disable=SC2086  # AIF_AGENT_DOCKER may be a routing prefix; its words must split
  if [ -n "${1:-}" ]; then
    raw=$(_aat_bounded "$_aat_timeout" $_aat_docker --context "$1" ps --filter name=agent) || rc=$?
  else
    raw=$(_aat_bounded "$_aat_timeout" $_aat_docker ps --filter name=agent) || rc=$?
  fi
  printf '%s\n' "$raw" | awk 'NF {print $NF}' | grep -i aif || true
  # 143 = killed by the watchdog's SIGTERM.
  [ "$rc" -eq 143 ] && return 124
  return "$rc"
}

# shellcheck disable=SC2034  # AIF_AGENT_* are this file's sourced interface, read by callers
aif_agent_resolve() {
  AIF_AGENT_NAME=""; AIF_AGENT_CONTEXT=""; AIF_AGENT_NOTE=""; AIF_AGENT_REASON=""
  _aat_docker="${AIF_AGENT_DOCKER:-docker}"
  _aat_timeout="${AIF_AGENT_TIMEOUT_S:-8}"
  case "$_aat_timeout" in '' | *[!0-9]* | 0) _aat_timeout=8 ;; esac
  local found ctx current rc n candidates="" outcomes=""

  rc=0; found=$(_aat_agents_in) || rc=$?
  n=$(printf '%s' "$found" | grep -c . || true)
  if [ "$n" -eq 1 ]; then
    AIF_AGENT_NAME="$found"
    AIF_AGENT_NOTE="${found} (discovered on the current docker context)"
    return 0
  elif [ "$n" -gt 1 ]; then
    AIF_AGENT_REASON="ambiguous-agent: $(printf '%s\n' "$found" | paste -sd ' ' -) on the current docker context"
    return 1
  fi

  if [ -n "${DOCKER_CONTEXT:-}" ] || [ -n "${DOCKER_HOST:-}" ]; then
    outcomes="other contexts not scanned: DOCKER_CONTEXT/DOCKER_HOST pinned"
  else
    case "$_aat_docker" in
      *' '*)
        outcomes="other contexts not scanned: docker is reached through «${_aat_docker}»"
        ;;
      *)
        current=$("$_aat_docker" context show 2>/dev/null || true)
        while IFS= read -r ctx; do
          [ -z "$ctx" ] || [ "$ctx" = "$current" ] && continue
          rc=0; found=$(_aat_agents_in "$ctx") || rc=$?
          if [ "$rc" -eq 124 ]; then
            outcomes="${outcomes}${ctx}=timeout "
          elif [ "$rc" -ne 0 ]; then
            outcomes="${outcomes}${ctx}=error "
          elif [ -z "$found" ]; then
            outcomes="${outcomes}${ctx}=none "
          else
            outcomes="${outcomes}${ctx}=found "
            candidates="${candidates}$(printf '%s' "$found" | sed "s|^|${ctx}/|")"$'\n'
          fi
        done < <("$_aat_docker" context ls --format '{{.Name}}' 2>/dev/null || true)
        n=$(printf '%s' "$candidates" | grep -c . || true)
        if [ "$n" -eq 1 ]; then
          ctx="${candidates%%/*}"
          found="${candidates#*/}"; found="${found%$'\n'}"
          AIF_AGENT_NAME="$found"
          AIF_AGENT_CONTEXT="$ctx"
          AIF_AGENT_NOTE="${found} context=${ctx} (discovered; the current context has no aif agent; scanned: ${outcomes% })"
          return 0
        elif [ "$n" -gt 1 ]; then
          AIF_AGENT_REASON="ambiguous-agent: $(printf '%s' "$candidates" | paste -sd ' ' -) across docker contexts"
          return 1
        fi
        outcomes="scanned: ${outcomes% }"
        [ "$outcomes" = "scanned: " ] && outcomes="no other docker context"
        ;;
    esac
  fi
  AIF_AGENT_REASON="no aif agent on the current context; ${outcomes}"
  return 2
}

# Executed (not sourced): print the answer for a non-bash caller.
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  aif_agent_resolve
  rc=$?
  case "$rc" in
    0) printf '%s\t%s\n' "$AIF_AGENT_NAME" "$AIF_AGENT_CONTEXT" ;;
    *) printf '%s\n' "$AIF_AGENT_REASON" >&2 ;;
  esac
  exit "$rc"
fi
