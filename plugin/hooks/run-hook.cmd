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
      _lang_from_file=1
    fi
  fi
fi

# ── Plugin-channel marker ─────────────────────────────────────────────────────
# Tells the dispatched hook it runs as the plugin twin, not as the project's own copy.
# inject-session-bootstrap reads it: this channel also ships inject-output-language, so the
# twin leaves the [output-language] line to that hook instead of injecting it a second time.
AIF_HOOK_CHANNEL=plugin
export AIF_HOOK_CHANNEL

# ── Project-channel dedup — opt-in, Claude Code only ──────────────────────────
# Claude Code merges plugin hooks with the project's own hooks and runs every matching
# entry concurrently; it does not deduplicate across the two sources
# (anthropics/claude-code#76297, closed not-planned). Measured 2026-09-29 in the framework
# repo, which registers its own hook sources AND has the plugin enabled: 14 registrations
# fired twice (the bootstrap digest 2x and [output-language] 3x per prompt, the Stop gate
# blocked twice).
#
# The dedup runs only when the project DECLARES it owns these hooks: AIF_HOOK_DEDUP=project in
# the `env` block of its own .claude/settings.json. The declaration lives in the same file as
# the project's hook registrations, so a session that did not load that file (--setting-sources
# without `project`, an Agent SDK host without settingSources "project") has no declaration
# either, and every plugin copy runs. Inferring "the project copy will run" from files on disk
# is unsound — those same sessions skip the project hooks while the files are still there — so
# there is no undeclared mode.
#
# Rule: this plugin copy exits silently when the project's settings register THIS hook —
# .claude/hooks/<name>.sh exists, and a command entry with no `if` and no `async` runs it — for
# the same event with the same matcher as EVERY plugin entry that dispatches this hook.
# Kept running in every other case (fail-open, the worst case is the old duplicate):
#   - ZCode (ZCODE_PROJECT_DIR set): it runs no project hooks, this entry is the only one;
#   - AIF_HOOK_LANG came from the hook-lang file above: only this wrapper reads that file, so
#     the project copy would run without the language and the two copies are not equivalent;
#   - no jq, stdin is a terminal, no event in the payload, unparseable settings, a different
#     matcher, or a covering script that does not exist.
# Residual, accepted with the declaration: a managed strictPluginOnlyCustomization policy blocks
# a project's settings hooks but not its settings env; a project declaring the dedup under such
# a policy loses these hooks. Consumers whose .claude/hooks copies are vendored by install.sh
# should not declare it — the vendored copy only changes on --refresh, the plugin copy is newer.
# POSIX sh only in this block (no arrays): a non-bash caller must still dispatch.
# Windows: the batch block above calls the script directly and never reaches this block.
_dd_proj="${CLAUDE_PROJECT_DIR:-}"
if [ "${AIF_HOOK_DEDUP:-}" = project ] && [ -n "$_dd_proj" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] \
   && [ -z "${_lang_from_file:-}" ] && [ ! -t 0 ] && [ -f "${SCRIPT_DIR}/hooks.json" ] \
   && command -v jq >/dev/null 2>&1; then
  # inject-session-bootstrap carries the [output-language] line when it runs on the project
  # channel, so a project that registers it already covers inject-output-language.
  case "$SCRIPT_NAME" in
    inject-output-language) _dd_cands="inject-output-language inject-session-bootstrap" ;;
    *) _dd_cands="$SCRIPT_NAME" ;;
  esac
  # Only names whose script exists can cover this hook; jq below matches against these alone.
  _dd_names=""
  for _dd_n in $_dd_cands; do
    [ -f "$_dd_proj/.claude/hooks/$_dd_n.sh" ] && _dd_names="${_dd_names:+$_dd_names }$_dd_n"
  done
  # Cheap prefilter (no stdin read, no jq): a settings file names one of those scripts.
  _dd_hit=""; _dd_f1=""; _dd_f2=""
  [ -f "$_dd_proj/.claude/settings.json" ] && _dd_f1="$_dd_proj/.claude/settings.json"
  [ -f "$_dd_proj/.claude/settings.local.json" ] && _dd_f2="$_dd_proj/.claude/settings.local.json"
  for _dd_n in $_dd_names; do
    for _dd_s in "$_dd_f1" "$_dd_f2"; do
      [ -n "$_dd_s" ] && grep -qF ".claude/hooks/$_dd_n.sh" "$_dd_s" 2>/dev/null && _dd_hit=1
    done
  done
  if [ -n "$_dd_hit" ] && _dd_in="$(mktemp "${TMPDIR:-/tmp}/getff-hook-in.XXXXXX" 2>/dev/null)"; then
    # The buffered payload can hold a prompt or Write contents: never leave it behind.
    trap 'rm -f "$_dd_in"' EXIT
    trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
    # The event name is only in the payload: buffer stdin so the script still receives it whole.
    # If the write fails, stdin is already consumed and the buffer is all that is left — hand it
    # on, but decide nothing from a possibly truncated payload.
    _dd_ev=""
    if cat > "$_dd_in"; then
      _dd_ev="$(jq -r '.hook_event_name // empty' "$_dd_in" 2>/dev/null || true)"
    fi
    _dd_skip=""
    # Commands are compared after spelling the project directory one way ($CLAUDE_PROJECT_DIR);
    # a covering path is then relative or under it, bounded by a quote, a space, or the end.
    if [ -n "$_dd_ev" ] && jq -n -e --arg ev "$_dd_ev" --arg self "$SCRIPT_NAME" --arg names "$_dd_names" \
         --arg proj "$_dd_proj" --slurpfile plugin "${SCRIPT_DIR}/hooks.json" '
        def matcher: (.matcher // "") | if . == "*" then "" else . end;
        def norm: split($proj) | join("$CLAUDE_PROJECT_DIR")
          | split("${CLAUDE_PROJECT_DIR}") | join("$CLAUDE_PROJECT_DIR");
        def covering: ((.type // "command") == "command") and (has("if") | not) and ((.async // false) | not);
        [ $plugin[0].hooks[$ev][]?
          | select(any(.hooks[]?; (.command // "") | test("run-hook\\.cmd\"? +" + $self + "( |$)")))
          | matcher ] as $mine
        | [ inputs as $doc | ($names | split(" ")[]) as $n
            | ("(^|[\\s\"\u0027])(\\$CLAUDE_PROJECT_DIR/)?\\.claude/hooks/" + $n + "\\.sh($|[\\s\"\u0027])") as $re
            | $doc.hooks[$ev][]?
            | select(any(.hooks[]?; covering and ((.command // "") | norm | test($re))))
            | matcher ] as $theirs
        | ($mine | length) > 0 and all($mine[]; . as $m | any($theirs[]; . == $m))
      ' ${_dd_f1:+"$_dd_f1"} ${_dd_f2:+"$_dd_f2"} >/dev/null 2>&1; then
      _dd_skip=1
    fi
    exec 3<"$_dd_in"
    rm -f "$_dd_in"
    trap - EXIT HUP INT TERM
    [ -n "$_dd_skip" ] && exit 0
    exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@" <&3 3<&-
  fi
fi

exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
