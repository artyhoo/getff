# live-claim.sh — plugin side of the liveness protocol. POSIX sh (dash-clean, no `local`).
# Spec: docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md D12.
# Sourced by run-hook.cmd in consumer mode only, fail-open (`[ -r lib ] && command . lib`): a
# missing or corrupt copy of this file means the plugin copy runs. The marker is written by the
# project copy's .claude/hooks/lib/hook-live.sh, which never ships in the plugin; the contract
# (base dir, key, marker name) is stated there and must stay byte-compatible with this file.
#
# Every doubt resolves to RUN: no session_id, no jq, no hashing tool, no `id`/`date`, a stale,
# future, foreign or untrusted marker, a failed rename, a custom timeout on the project entry —
# each returns non-zero and the caller runs its copy. A duplicate costs context; a lost gate
# costs the gate.

# stdin → lowercase hex sha256; non-zero without a tool.
_getff_live_sha() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else return 1; fi
}

# getff_live_key_of <hook-name> — the key for the payload on stdin: sha256 of "<hook-name>\n"
# followed by the payload bytes. Prints 64 hex chars; non-zero otherwise.
getff_live_key_of() {
  _lk_k=$({ printf '%s\n' "$1"; cat; } | _getff_live_sha) || return 1
  case "$_lk_k" in *[!0-9a-f]*) return 1 ;; esac
  [ "${#_lk_k}" -eq 64 ] || return 1
  printf '%s\n' "$_lk_k"
}

# getff_live_key <hook-name> <payload-file> — the same key for a payload held in a file.
getff_live_key() {
  getff_live_key_of "$1" < "$2"
}

# _getff_live_trusted <dir> — a directory this user owns, that is not a symlink, and that neither
# group nor others can write (a loose mode lets another user plant a marker). `-O` is outside
# POSIX but dash, bash and busybox ash implement it; a shell without it fails the test, and a
# failed test means the plugin copy runs. The mode comes from `ls -ld` (POSIX output format:
# group-write is character 6, other-write character 9); no output also fails the test.
_getff_live_trusted() {
  # shellcheck disable=SC3067
  [ ! -L "$1" ] && [ -d "$1" ] && [ -O "$1" ] || return 1
  _lt_m=$(ls -ld "$1" 2>/dev/null) || return 1
  case "$_lt_m" in ?????w*|????????w*|'') return 1 ;; esac
  return 0
}

# getff_live_custom_timeout <hook-name> — 0 when a settings file carries a "timeout" on a hook
# handler whose command names the project copy `.claude/hooks/<hook-name>.sh` (Claude Code may
# kill that copy after this one yielded), or when a settings file exists but cannot be read.
# With jq and a file that parses, only handler objects under `.hooks` count — a permissions
# string such as "Bash(bash .claude/hooks/<name>.sh)" next to an unrelated "timeout" does not.
# Without jq, or for a file jq cannot parse, the coarse test applies: the file names the hook
# and contains "timeout" anywhere. Either way a doubt means timeout-set, so the copy runs.
# Mirrors _hc_custom_timeout (hook-claim.sh on the stopped parallel design), narrowed by jq.
getff_live_custom_timeout() {
  for _lt_f in "${CLAUDE_PROJECT_DIR:-/nonexistent}/.claude/settings.json" \
    "${CLAUDE_PROJECT_DIR:-/nonexistent}/.claude/settings.local.json" \
    "${CLAUDE_CONFIG_DIR:-${HOME:-/nonexistent}/.claude}/settings.json" \
    "/Library/Application Support/ClaudeCode/managed-settings.json" \
    "/etc/claude-code/managed-settings.json"; do
    [ -e "$_lt_f" ] || continue
    [ -r "$_lt_f" ] || return 0
    grep -qF ".claude/hooks/$1.sh" "$_lt_f" 2>/dev/null || continue
    if command -v jq >/dev/null 2>&1; then
      _lt_r=$(jq -r --arg p ".claude/hooks/$1.sh" '
        [(.hooks // {}) | .. | objects
          | select((.command | type) == "string" and (.command | contains($p)) and has("timeout"))]
        | length > 0' "$_lt_f" 2>/dev/null) || _lt_r=''
      case "$_lt_r" in
        true) return 0 ;;
        false) continue ;;
      esac
    fi
    grep -qF '"timeout"' "$_lt_f" 2>/dev/null && return 0
  done
  return 1
}

# getff_live_claim <hook-name> <payload> — 0 only after this process renamed a fresh, trusted
# marker the project copy wrote for this exact event. Waits at most ~300 ms for one, and never
# past one second of wall clock.
getff_live_claim() {
  case "$1" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
  getff_live_custom_timeout "$1" && return 1
  command -v jq >/dev/null 2>&1 || return 1
  _lc_sid=$(printf '%s' "$2" | jq -r '.session_id // empty' 2>/dev/null) || return 1
  case "$_lc_sid" in ''|*[!A-Za-z0-9_-]*) return 1 ;; esac
  _lc_key=$(printf '%s' "$2" | getff_live_key_of "$1") || return 1
  _lc_uid=$(id -u 2>/dev/null) || return 1
  case "$_lc_uid" in ''|*[!0-9]*) return 1 ;; esac
  _lc_base="${TMPDIR:-/tmp}/getff-hook-live.$_lc_uid"
  _lc_dir="$_lc_base/$_lc_sid"
  _lc_start=$(date +%s 2>/dev/null) || return 1
  case "$_lc_start" in ''|*[!0-9]*) return 1 ;; esac
  _lc_try=0
  while :; do
    _lc_now=$(date +%s 2>/dev/null) || return 1
    case "$_lc_now" in ''|*[!0-9]*) return 1 ;; esac
    # Trust is re-checked on every pass: the directories may appear while this copy waits.
    if _getff_live_trusted "$_lc_base" && _getff_live_trusted "$_lc_dir"; then
      for _lc_f in "$_lc_dir/$_lc_key".*; do
        [ -f "$_lc_f" ] && [ ! -L "$_lc_f" ] || continue
        _lc_ts=${_lc_f#"$_lc_dir/$_lc_key".}; _lc_ts=${_lc_ts%%.*}
        case "$_lc_ts" in ''|*[!0-9]*) continue ;; esac
        # Fresh = at most 5 s old by the wall clock, and not from the future.
        [ "$_lc_ts" -le "$_lc_now" ] && [ $((_lc_now - _lc_ts)) -le 5 ] || continue
        # rename(2) within one directory: when two plugin copies race for one marker, exactly
        # one mv succeeds and the other fails on the vanished source.
        if mv "$_lc_f" "$_lc_dir/claimed.$_lc_key.$_lc_ts.$$" 2>/dev/null; then
          rm -f "$_lc_dir/claimed.$_lc_key.$_lc_ts.$$" 2>/dev/null
          return 0
        fi
      done
    fi
    _lc_try=$((_lc_try + 1))
    [ "$_lc_try" -le 6 ] || return 1
    [ $((_lc_now - _lc_start)) -le 1 ] || return 1
    sleep 0.05 2>/dev/null || return 1
  done
}
