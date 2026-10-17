#!/usr/bin/env bash
# hook-live.sh — liveness marker for the project copy of a shared hook
# @cc-only-rationale: support library of the project copies of getff's shared hooks — it defines
#   no hook itself; it only proves to the plugin copy (plugin/hooks/run-hook.cmd, consumer mode)
#   that the project copy started for an event. Never shipped in the plugin.
# Spec: docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md D12.
#
# The plugin copy of the same hook yields only after claiming the marker this writes
# (plugin/hooks/lib/live-claim.sh), so a host that never loads project settings loses no hook.
#
# Contract (both sides must agree byte for byte):
#   base   ${TMPDIR:-/tmp}/getff-hook-live.<uid>   mode 700 (no group/other write), owned by us,
#                                                  not a symlink
#   dir    <base>/<session_id>                     same trust
#   marker <dir>/<key>.<epoch-seconds>.<pid>       empty file
#   key    sha256 of "<hook-name>\n" followed by the payload bytes exactly as received
#          (read through a command substitution with a trailing sentinel, so trailing newlines
#          survive; a raw NUL byte, which JSON never carries, is dropped on both sides).
# <uid> is `id -u` on both sides: dash, the hook shell on Linux, has no $UID.
#
# Never fails the hook, even under `set -euo pipefail`: every step runs inside a function called
# in an `||` list (errexit off), each command guards itself, and any error writes no marker. The
# payload is held in memory, never written to disk; stdin is re-opened from a pipe, so the hook
# afterwards reads the same payload from the start.

# stdin → lowercase hex sha256; non-zero without a tool.
_getff_live_sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else return 1; fi
}

# _getff_live_trusted <dir> — a directory we own, that is not a symlink, and that neither group
# nor others can write. Same test as the plugin side (plugin/hooks/lib/live-claim.sh), so a
# directory one side refuses the other refuses too.
_getff_live_trusted() {
  local m
  [ ! -L "$1" ] && [ -d "$1" ] && [ -O "$1" ] || return 1
  m="$(ls -ld "$1" 2>/dev/null)" || return 1
  case "$m" in ?????w*|????????w*|'') return 1 ;; esac
  return 0
}

# _getff_live_mark <hook-name> <payload> — write the marker; any failure writes nothing.
_getff_live_mark() {
  local sid key uid base dir now
  command -v jq >/dev/null 2>&1 || return 1
  sid="$(printf '%s' "$2" | jq -r '.session_id // empty' 2>/dev/null)" || return 1
  case "$sid" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
  key="$({ printf '%s\n' "$1"; printf '%s' "$2"; } | _getff_live_sha)" || return 1
  case "$key" in *[!0-9a-f]*) return 1 ;; esac
  [ "${#key}" -eq 64 ] || return 1
  uid="$(id -u 2>/dev/null)" || return 1
  case "$uid" in ''|*[!0-9]*) return 1 ;; esac
  now="$(date +%s 2>/dev/null)" || return 1
  case "$now" in ''|*[!0-9]*) return 1 ;; esac
  base="${TMPDIR:-/tmp}/getff-hook-live.$uid"
  dir="$base/$sid"
  [ -d "$base" ] || mkdir -m 700 "$base" 2>/dev/null || true
  _getff_live_trusted "$base" || return 1
  [ -d "$dir" ] || mkdir -m 700 "$dir" 2>/dev/null || true
  _getff_live_trusted "$dir" || return 1
  { : > "$dir/$key.$now.$$"; } 2>/dev/null || return 1
  # Prune this session's markers (claimed or not) older than 60 s, and session directories left
  # empty for an hour. Best effort: a failed prune never unmarks this run.
  find "$dir" -type f -mmin +1 -exec rm -f {} + >/dev/null 2>&1 || true
  find "$base" -mindepth 1 -maxdepth 1 -type d -empty -mmin +60 -exec rmdir {} + >/dev/null 2>&1 || true
  return 0
}

# getff_hook_live <hook-name> — call once, before the hook reads stdin. Always returns 0; stdin
# is afterwards the same payload, readable from the start.
getff_hook_live() {
  local in
  [ "${AIF_HOOK_CHANNEL:-}" = plugin ] && return 0   # the plugin twin never marks itself
  [ -n "${ZCODE_PROJECT_DIR:-}" ] && return 0        # D6: nothing on ZCode ever claims
  [ -t 0 ] && return 0                               # no payload to key on
  # Read the whole payload into memory. The sentinel keeps trailing newlines.
  in="$(cat 2>/dev/null; printf x)" || return 0
  in="${in%x}"
  # Re-open stdin FIRST, so a later failure can never cost the hook its payload. A pipe, not a
  # temp file: the payload never touches disk, and an unwritable TMPDIR cannot break it.
  # The group scopes the stderr silencing: a bare `exec 0< … 2>/dev/null` would redirect the
  # hook's own stderr for the rest of its run (exec applies every redirection to the shell).
  { exec 0< <(printf '%s' "$in" 2>/dev/null); } 2>/dev/null || return 0
  _getff_live_mark "$1" "$in" >/dev/null 2>&1 || true
  return 0
}
