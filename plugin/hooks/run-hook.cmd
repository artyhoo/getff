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
# A yield must never drop a hook that then runs nowhere, so every condition below leans to
# running — a duplicate costs context, a lost gate costs the gate:
#   - Claude Code only: ZCode never reads .claude/settings.json
#     (docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md).
#   - Same inputs: the language fallback above reaches plugin hooks only; when it supplied the
#     pin, the project copy is blind to it and the two copies differ.
#   - GETFF_PLUGIN_NO_YIELD=1 forces this copy to run, for hosts that load the plugin but not
#     the project's settings (an SDK `settingSources` list or `--setting-sources` without
#     `project`); this file cannot see which sources the host loaded.
#   - Only .claude/settings.json counts. settings.local.json is a separate setting source that
#     SDK hosts leave out by default, so a registration there may never fire.
#   - Registration means a `.hooks` entry read with jq — settings.json also names hook scripts
#     inside `permissions` strings — so no jq means run. The command must be exactly
#     `[bash|sh] "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"` with no `if` condition: a
#     relative path, a redirect or `|| true` changes what runs or where its output goes.
#   - Every (event, matcher) pair the plugin registers this hook on must be registered by the
#     project with the identical matcher ("" and "*" are equal). A narrower or missing pair
#     leaves an event only this copy would catch, e.g. a worktree on a branch from before the
#     plugin widened a matcher or added an event. Needs hooks.json beside this file.
#   - The hook must be getff's: this file declares itself the plugin copy of
#     `.claude/hooks/<name>.sh` (the generator's AUTO-GENERATED line or a manual twin's
#     `Plugin twin of` line), and the project script carries getff's `# <name>.sh — ` header
#     on line 2 plus a delivery marker. A plugin-only hook or a project's own same-named
#     script never silences this copy.
# A hook whose output a project hook of another name already carries declares that on one line;
# the same checks then run against the named hook:
#   # @plugin-yields-to: <hook-name> [<hook-name> ...]
# Settings are read on every event; Claude Code's file watcher reloads hook registrations when
# settings.json changes, so this read and the running session agree. The Windows batch branch
# above calls bash on the hook directly and does not yield.
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] && [ -z "${_lang_from_file:-}" ] \
  && [ -z "${GETFF_PLUGIN_NO_YIELD:-}" ] && [ -f "${SCRIPT_DIR}/hooks.json" ] \
  && [ -f "$CLAUDE_PROJECT_DIR/.claude/settings.json" ] && command -v jq >/dev/null 2>&1; then
  _yield_names=''
  case "$SCRIPT_NAME" in
    ''|*[!A-Za-z0-9_-]*) : ;;
    *)
      grep -qE "^# (AUTO-GENERATED from|Plugin twin of) \.claude/hooks/${SCRIPT_NAME}\.sh" \
        "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null && _yield_names="$SCRIPT_NAME"
      _yield_names="$_yield_names $(sed -n 's/^# @plugin-yields-to:[[:space:]]*//p' \
        "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null | head -n 1)"
      ;;
  esac
  set -f
  for _name in $_yield_names; do
    case "$_name" in ''|*[!A-Za-z0-9_-]*) continue ;; esac
    _proj_hook="$CLAUDE_PROJECT_DIR/.claude/hooks/$_name.sh"
    [ -f "$_proj_hook" ] || continue
    sed -n 2p "$_proj_hook" | grep -qF "# $_name.sh — " || continue
    grep -qE '^# @(cc-only-rationale|dual-pair)' "$_proj_hook" || continue
    if jq -e -n --arg n "$SCRIPT_NAME" --arg t "$_name" \
      --slurpfile p "${SCRIPT_DIR}/hooks.json" --slurpfile s "$CLAUDE_PROJECT_DIR/.claude/settings.json" '
        def pairs(f): [(.hooks // {}) | to_entries[] | .key as $e | .value[]?
          | select(any(.hooks[]?; f))
          | [$e, (if (.matcher // "") == "*" then "" else (.matcher // "") end)]] | unique;
        ($p[0] | pairs((.command? // "") | tostring | test("run-hook\\.cmd\"? +" + $n + "$"))) as $need
        | ($s[0] | pairs(((.command? // "") | tostring
            | test("^((ba)?sh +)?\"?\\$\\{?CLAUDE_PROJECT_DIR\\}?/\\.claude/hooks/" + $t + "\\.sh\"?$"))
            and (has("if") | not))) as $have
        | ($need | length) > 0 and all($need[]; . as $x | any($have[]; . == $x))' >/dev/null 2>&1; then
      exit 0
    fi
  done
  set +f
fi

exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
