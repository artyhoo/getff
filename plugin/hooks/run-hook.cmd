: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot wrapper for hook scripts.
REM On Windows: cmd.exe runs the batch portion, which finds and calls bash.
REM On Unix: the shell interprets this as a script (: is a no-op in bash).
REM
REM Hook scripts use extensionless filenames (e.g. "session-start" not
REM "session-start.sh") so Claude Code's Windows auto-detection -- which
REM prepends "bash" to any command containing .sh -- doesn't interfere.
REM
REM Usage: run-hook.cmd <script-name> [args...]
REM Adopted from obra/superpowers (hooks/run-hook.cmd), MIT. SSOT: prior-art ADOPT.

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"

REM Try Git for Windows bash in standard locations
if exist "C:\Program Files\Git\bin\bash.exe" (
    "C:\Program Files\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)
if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
    "C:\Program Files (x86)\Git\bin\bash.exe" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM Try bash on PATH (e.g. user-installed Git Bash, MSYS2, Cygwin)
where bash >nul 2>nul
if %ERRORLEVEL% equ 0 (
    bash "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
    exit /b %ERRORLEVEL%
)

REM No bash found - exit silently rather than error
REM (plugin still works, just without SessionStart context injection)
exit /b 0
CMDBLOCK

# Unix: run the named script directly
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="$1"
shift

# ── AIF_HOOK_LANG file fallback (harness-agnostic pin) ────────────────────────
# CC injects AIF_HOOK_LANG into hook processes from the consumer's settings.json
# `env` block; ZCode injects only template variables for plugin hooks (no env
# mechanism — zcode-guide, hooks/env), and a GUI-launched app never sources the
# shell profile — so on ZCode the pin never reached the hooks and every
# human-facing message silently fell back to English (incident 2026-09-13:
# Russian explanations broken in ZCode while CC was Russian). Fallback: one
# line (e.g. `ru`, LF-terminated) in ${XDG_CONFIG_HOME:-$HOME/.config}/getff/hook-lang.
# The env var always wins when present; malformed content is ignored.
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

# ── Yield to the project's own copy of this hook ──────────────────────────────
# plugin/hooks/hooks.json is rendered from the same harness model as the framework's own
# .claude/settings.json (scripts/render-harness-config.mjs emitPlugin), so a project that
# registers `.claude/hooks/<name>.sh` itself — the framework repo for every twinned hook, or a
# consumer that also ran install.sh — runs the same logic twice per event, and in the framework
# repo the plugin copy is the STALE one: an installed cache refreshes only on a version bump.
# Incident 2026-09-28: every prompt carried the session-bootstrap digest twice, a 4-item and a
# 5-item invariants list side by side, and the output-language line three times. The project
# copy wins; this copy exits 0 without output.
#
# A hook whose output a project hook of another name already carries declares it on one line:
#   # @plugin-yields-to: <hook-name> [<hook-name> ...]
#
# Every condition below keeps a yield from dropping a hook that would then run nowhere:
#   - CC only — ZCode never reads .claude/settings.json
#     (docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md).
#   - The project script must exist, or its registration fires nothing.
#   - Registration means `.hooks[][].hooks[].command`, read with jq: settings.json also names
#     hook scripts inside `permissions` strings. No jq → run (a duplicate beats a lost gate).
#   - Same inputs: the fallback above reaches plugin hooks only, so when it supplied the
#     language pin the project copy is blind to it and the two copies differ → run.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] && [ -z "${_lang_from_file:-}" ] \
  && command -v jq >/dev/null 2>&1; then
  _yield_names="$SCRIPT_NAME $(sed -n 's/^# @plugin-yields-to:[[:space:]]*//p' "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null | head -n 1)"
  for _cfg in "$CLAUDE_PROJECT_DIR/.claude/settings.json" "$CLAUDE_PROJECT_DIR/.claude/settings.local.json"; do
    [ -f "$_cfg" ] || continue
    for _name in $_yield_names; do
      [ -f "$CLAUDE_PROJECT_DIR/.claude/hooks/$_name.sh" ] || continue
      grep -qF ".claude/hooks/$_name.sh" "$_cfg" || continue   # cheap prefilter before jq
      if jq -e --arg p ".claude/hooks/$_name.sh" \
        'any(.hooks[]?[]?.hooks[]?.command? // empty; type == "string" and contains($p))' \
        "$_cfg" >/dev/null 2>&1; then
        exit 0
      fi
    done
  done
fi

exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
