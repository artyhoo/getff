#!/bin/sh
# Shared hook language pin: explicit non-empty env wins; validated first file line falls back.
# Sourced by plugin wrappers and contributor adapters; quiet and compatible with POSIX shells.
_lang_from_file=''
if [ -z "${AIF_HOOK_LANG:-}" ]; then
  _lang_cfg="${XDG_CONFIG_HOME:-$HOME/.config}/getff/hook-lang"
  if [ -f "$_lang_cfg" ]; then
    _lang_val="$(head -n 1 "$_lang_cfg" 2>/dev/null | tr -d '[:space:]' || true)"
    if printf '%s' "$_lang_val" | grep -qE '^[a-z]{2}(-[A-Za-z0-9]{2,8})?$'; then
      AIF_HOOK_LANG="$_lang_val"
      export AIF_HOOK_LANG
      _lang_from_file=1
    fi
  fi
fi
