# source-hash.sh — sha256 of a getff hook and of the files it reads beside itself. POSIX sh.
# Sourced by plugin/hooks/run-hook.cmd (the consumer yield) and scripts/plugin-source-hashes.sh (the
# manifest writer): one implementation, so a hash written at build time and a hash computed at run
# time cannot disagree. Spec: docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md.

# stdin → lowercase hex sha256. Non-zero when neither sha256sum nor shasum exists.
getff_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 | cut -d' ' -f1
  else
    return 1
  fi
}

# getff_path_hash <hooks-dir> <rel> — hash of one file, or of a directory (<rel> ends in /) as the
# LC_ALL=C-sorted "<sha256>  <name>" listing of the regular files directly in it, so an added file
# changes the hash too. Non-zero when the path is missing, leaves <hooks-dir>, or no tool exists.
getff_path_hash() {
  case "$2" in ''|/*|*..*) return 1 ;; esac
  printf '' | getff_sha256 >/dev/null || return 1
  case "$2" in
    */)
      [ -d "$1/$2" ] || return 1
      for _gsh_f in "$1/$2"*; do
        [ -f "$_gsh_f" ] || continue
        printf '%s  %s\n' "$(getff_sha256 < "$_gsh_f")" "${_gsh_f##*/}"
      done | LC_ALL=C sort | getff_sha256
      ;;
    *)
      [ -f "$1/$2" ] || return 1
      getff_sha256 < "$1/$2"
      ;;
  esac
}

# getff_closure_matches <manifest> <hooks-dir> <name> — 0 only when <manifest> holds a "<name>.sh"
# line and every "<name>.sh" / "<name>.sh:<rel>" line equals the hash of that path under
# <hooks-dir>. Anything missing or unreadable is a mismatch: the caller then runs its copy.
getff_closure_matches() {
  [ -f "$1" ] || return 1
  _gsh_main=''
  while IFS= read -r _gsh_line || [ -n "$_gsh_line" ]; do
    _gsh_want=${_gsh_line%%  *}
    _gsh_key=${_gsh_line#*  }
    case "$_gsh_key" in
      "$3.sh") _gsh_rel="$3.sh"; _gsh_main=1 ;;
      "$3.sh:"*) _gsh_rel=${_gsh_key#"$3.sh:"} ;;
      *) continue ;;
    esac
    _gsh_got=$(getff_path_hash "$2" "$_gsh_rel") || return 1
    [ "$_gsh_got" = "$_gsh_want" ] || return 1
  done < "$1"
  [ -n "$_gsh_main" ]
}
