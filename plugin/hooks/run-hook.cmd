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
REM Plugin-channel marker for the dispatched hook (see the Unix block below).
set "AIF_HOOK_CHANNEL=plugin"

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
if [ -z "${AIF_HOOK_LANG:-}" ]; then
  _lang_cfg="${XDG_CONFIG_HOME:-$HOME/.config}/getff/hook-lang"
  if [ -f "$_lang_cfg" ]; then
    _lang_val="$(head -n 1 "$_lang_cfg" 2>/dev/null | tr -d '[:space:]' || true)"
    if printf '%s' "$_lang_val" | grep -qE '^[a-z]{2}(-[A-Za-z0-9]{2,8})?$'; then
      AIF_HOOK_LANG="$_lang_val"
      export AIF_HOOK_LANG
    fi
  fi
fi

# ── Plugin-channel marker ─────────────────────────────────────────────────────
# Tells the dispatched hook it runs as the plugin twin, not as the project's own copy.
# inject-session-bootstrap reads it: this channel also ships inject-output-language, so the
# twin leaves the [output-language] line to that hook instead of injecting it a second time.
AIF_HOOK_CHANNEL=plugin
export AIF_HOOK_CHANNEL

# ── Project-channel dedup (Claude Code only) ──────────────────────────────────
# Claude Code merges plugin hooks with the project's own hooks and runs every matching
# entry concurrently; it does not deduplicate across the two sources
# (anthropics/claude-code#76297, closed not-planned). Measured 2026-09-29: in the framework
# repo 14 registrations fired twice (the bootstrap digest 2x and [output-language] 3x per
# prompt, the Stop gate blocked twice), and install.sh gives a plugin consumer the same
# doubling for the 9 hooks it registers.
#
# Rule: when the project registers THIS hook — .claude/hooks/<name>.sh exists and
# .claude/settings.json or settings.local.json lists it — for the same event with the same
# matcher as this plugin entry, the project copy runs and this one exits silently. The project
# copy wins because the project controls it and refreshes it; the plugin cache can be older.
# Skipped on ZCode: it does not run .claude/settings.json hooks, so this entry is the only one.
# Fail-open by construction: no jq, no event in the payload, unparseable settings, or a
# different matcher → no skip. The worst case is the old duplicate, never a lost hook.
# Windows: the batch block above calls the script directly and never reaches this block.
_dd_proj="${CLAUDE_PROJECT_DIR:-}"
if [ -n "$_dd_proj" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] && [ -f "${SCRIPT_DIR}/hooks.json" ] \
   && command -v jq >/dev/null 2>&1; then
  # inject-session-bootstrap carries the [output-language] line when it runs on the project
  # channel, so a project that registers it already covers inject-output-language.
  case "$SCRIPT_NAME" in
    inject-output-language) _dd_names="inject-output-language inject-session-bootstrap" ;;
    *) _dd_names="$SCRIPT_NAME" ;;
  esac
  # Cheap prefilter (no stdin read, no jq): a covering script exists and a settings file names it.
  _dd_hit=""; _dd_files=()
  for _dd_s in "$_dd_proj/.claude/settings.json" "$_dd_proj/.claude/settings.local.json"; do
    [ -f "$_dd_s" ] || continue
    for _dd_n in $_dd_names; do
      if [ -f "$_dd_proj/.claude/hooks/$_dd_n.sh" ] && grep -qF ".claude/hooks/$_dd_n.sh" "$_dd_s" 2>/dev/null; then
        _dd_hit=1
      fi
    done
    _dd_files+=("$_dd_s")
  done
  if [ -n "$_dd_hit" ] && _dd_in="$(mktemp "${TMPDIR:-/tmp}/getff-hook-in.XXXXXX" 2>/dev/null)"; then
    # The event name is only in the payload: buffer stdin so the script still receives it whole.
    cat > "$_dd_in"
    _dd_ev="$(jq -r '.hook_event_name // empty' "$_dd_in" 2>/dev/null || true)"
    _dd_skip=""
    if [ -n "$_dd_ev" ] && jq -n -e --arg ev "$_dd_ev" --arg self "$SCRIPT_NAME" --arg names "$_dd_names" \
         --slurpfile plugin "${SCRIPT_DIR}/hooks.json" '
        def matcher: (.matcher // "") | if . == "*" then "" else . end;
        def matchers($doc; $re): [ $doc.hooks[$ev][]? | select(any(.hooks[]?; (.command // "") | test($re))) | matcher ];
        matchers($plugin[0]; "run-hook\\.cmd\"? +" + $self + "( |$)") as $mine
        | [ inputs as $doc | ($names | split(" ")[]) as $n
            | matchers($doc; "(^|[^A-Za-z0-9_.-])\\.claude/hooks/" + $n + "\\.sh($|[^A-Za-z0-9_])")[] ] as $theirs
        | any($mine[]; . as $m | any($theirs[]; . == $m))
      ' "${_dd_files[@]}" >/dev/null 2>&1; then
      _dd_skip=1
    fi
    exec 3<"$_dd_in"
    rm -f "$_dd_in"
    [ -n "$_dd_skip" ] && exit 0
    exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@" <&3 3<&-
  fi
fi

exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
