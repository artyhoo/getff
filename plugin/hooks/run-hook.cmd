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

# ── Plugin-channel marker ─────────────────────────────────────────────────────
# Tells the dispatched hook it runs as the plugin twin, not as the project's own copy.
# inject-session-bootstrap reads it: this channel also ships inject-output-language, so the
# twin leaves the [output-language] line to that hook instead of injecting it a second time.
# lib/hook-live.sh reads it too: the twin must not mark itself live (spec D12).
AIF_HOOK_CHANNEL=plugin
export AIF_HOOK_CHANNEL

# ── Yield to the plugin's own source checkout ─────────────────────────────────
# plugin/hooks/hooks.json is rendered from the same harness model as the framework's own
# .claude/settings.json (scripts/render-harness-config.mjs emitPlugin), so in the framework's
# source checkout every twinned hook ran twice per event, and the plugin copy is the STALE one
# there: an installed cache refreshes only on a version bump. Incident 2026-09-28: every prompt
# carried the session-bootstrap digest twice, a 4-item and a 5-item invariants list side by side,
# and the output-language line three times. There the project copy wins; this copy exits 0
# without output.
#
# A yield must never drop a hook that then runs nowhere, and must never hand an event to an
# older copy, so every condition below leans to running. A duplicate costs context; a lost gate
# costs the gate.
#   - Two modes. SOURCE: the project ships this plugin (plugin/.claude-plugin/plugin.json names the
#     same plugin as ../.claude-plugin/plugin.json) and this hook (plugin/hooks/<name>); there
#     .claude/hooks/<name>.sh is the source this copy was generated from. CONSUMER: anywhere else,
#     the installed copy was frozen at install (setup.d/10-skills.sh copy_safe) and may be older,
#     newer or edited, so it counts only when it and every file it declares on
#     `# @plugin-yield-deps:` hash to lib/source-sha256.txt — the bytes this plugin was built from
#     (lib/source-hash.sh; spec docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md).
#     No manifest, no entry, no hashing tool or any mismatch → run. Identical files still do not
#     prove the project copy fires (settings sources, managed policy, a timeout that kills it), so
#     a consumer yield also needs proof of life: the project copy's prelude
#     (.claude/hooks/lib/hook-live.sh) marks each event it starts, and this copy yields only after
#     claiming a fresh marker for the same payload (lib/live-claim.sh; spec D12). No marker within
#     ~300 ms, no session_id, a stale, foreign or untrusted marker, a lost race, or a "timeout" in
#     any settings file naming the project copy → run.
#   - Claude Code only: ZCode never reads .claude/settings.json
#     (docs/meta-factory/research-patches/2026-07-04-zcode-harness-visibility.md).
#   - Same inputs: the language fallback above reaches plugin hooks only; when it supplied the
#     pin, the project copy is blind to it and the two copies differ.
#   - This file cannot see which setting sources the host loaded (an SDK `settingSources` list,
#     `--setting-sources`) or a managed policy that blocks project hooks (`allowManagedHooksOnly`).
#     GETFF_PLUGIN_NO_YIELD=1 forces this copy to run on such a host.
#   - Only .claude/settings.json counts. settings.local.json is a separate setting source that a
#     host can leave out, so a registration there may never fire.
#   - Only while the session sits at the project root: after EnterWorktree or /cd, Claude Code
#     takes project settings from the new directory only (no parent fallback) but keeps
#     CLAUDE_PROJECT_DIR at the start root. Only the payload's `cwd` follows the session, and a
#     Bash cd moves it too, so a cwd in a subdirectory cannot tell a Bash cd (settings kept) from
#     /cd (settings gone) and runs. A missing or unreadable cwd runs. The payload is read into
#     memory, never to disk, and handed on unchanged (a raw NUL byte, which JSON never carries, is
#     dropped). Known limit: on this path the hook runs as a child, so a signal sent to this
#     launcher's pid alone no longer reaches it.
#   - Registration means a `.hooks` handler read with jq (settings.json also names hook scripts
#     inside `permissions` strings), so no jq means run. The handler must be exactly
#     {"type":"command","command":"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh\""}, the
#     installer's form, optionally with a statusMessage. Any other command form or field (`if`,
#     `async`, `timeout`, `shell`) can change when the project copy runs, whether it starts at
#     all, or where its output goes.
#   - Every (event, matcher) pair the plugin registers this hook on must be registered by the
#     project with the identical matcher ("" and "*" are equal). A narrower or missing pair
#     leaves an event only this copy would catch, e.g. a worktree on a branch from before the
#     plugin widened a matcher or added an event. Needs hooks.json beside this file; a plugin
#     registration that passes extra arguments never counts as covered.
#   - The hook must be getff's: this file declares itself the plugin copy of
#     `.claude/hooks/<name>.sh` (the generator's AUTO-GENERATED line or a manual twin's
#     `Plugin twin of` line), and the project script carries getff's `# <name>.sh — ` header
#     on line 2 plus a delivery marker. A plugin-only hook never silences this copy.
# A hook whose output a project hook of another name already carries declares that on one line;
# the same checks then run against the named hook:
#   # @plugin-yields-to: <hook-name> [<hook-name> ...]
# Settings are read on every event. Claude Code's file watcher normally reloads hook
# registrations when settings.json changes; right after a branch switch the two can briefly
# disagree. The Windows batch branch above calls bash on the hook directly and does not yield.
_yield_mode=''
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -z "${ZCODE_PROJECT_DIR:-}" ] && [ -z "${_lang_from_file:-}" ] \
  && [ -z "${GETFF_PLUGIN_NO_YIELD:-}" ] && [ -f "${SCRIPT_DIR}/hooks.json" ] \
  && [ -f "${SCRIPT_DIR}/../.claude-plugin/plugin.json" ] \
  && [ -f "$CLAUDE_PROJECT_DIR/.claude/settings.json" ] && command -v jq >/dev/null 2>&1; then
  if [ -f "$CLAUDE_PROJECT_DIR/plugin/.claude-plugin/plugin.json" ] \
    && jq -e -n --slurpfile pm "${SCRIPT_DIR}/../.claude-plugin/plugin.json" \
      --slurpfile sm "$CLAUDE_PROJECT_DIR/plugin/.claude-plugin/plugin.json" \
      '([$pm, $sm] | all(length == 1)) and ($pm[0].name | type == "string" and length > 0)
        and $pm[0].name == $sm[0].name' >/dev/null 2>&1; then
    _yield_mode=source
  elif [ -f "${SCRIPT_DIR}/lib/source-sha256.txt" ] && [ -r "${SCRIPT_DIR}/lib/source-hash.sh" ] \
    && command . "${SCRIPT_DIR}/lib/source-hash.sh"; then
    # `-r` (not `-f`) keeps an unreadable lib out of the `.` attempt: macOS's native /bin/sh kills
    # the whole invocation on `.`'s "Permission denied" even wrapped in `command`, unlike
    # bash/dash. `command` strips `.`'s special-builtin status for the remaining case — a syntax
    # error in an otherwise-readable lib, which under plain `.` kills dash with rc=2 — turning it
    # into an ordinary non-zero return here instead. Either way a corrupt or unreadable lib falls
    # through to the plain `exec bash` path below.
    _yield_mode=consumer
  fi
fi
if [ -n "$_yield_mode" ]; then
  _yield_names=''
  case "$SCRIPT_NAME" in
    ''|*[!A-Za-z0-9_-]*) : ;;
    *)
      if [ "$_yield_mode" = consumer ] || [ -f "$CLAUDE_PROJECT_DIR/plugin/hooks/$SCRIPT_NAME" ]; then
        grep -qE "^# (AUTO-GENERATED from|Plugin twin of) \.claude/hooks/${SCRIPT_NAME}\.sh" \
          "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null && _yield_names="$SCRIPT_NAME"
        _yield_names="$_yield_names $(sed -n 's/^# @plugin-yields-to:[[:space:]]*//p' \
          "${SCRIPT_DIR}/${SCRIPT_NAME}" 2>/dev/null | head -n 1)"
      fi
      ;;
  esac
  # noglob covers only the list expansion below (an unquoted `$_yield_names` word-splits into
  # names that must not also undergo pathname expansion); the loop body turns it back off right
  # away, because a declared directory is later hashed through a glob (getff_path_hash) that
  # `set -f` would turn into a literal. lib/live-claim.sh's marker scan below globs too.
  _yield_hit=''; _yield_target=''
  set -f
  for _name in $_yield_names; do
    set +f
    case "$_name" in ''|*[!A-Za-z0-9_-]*) continue ;; esac
    _proj_hook="$CLAUDE_PROJECT_DIR/.claude/hooks/$_name.sh"
    [ -f "$_proj_hook" ] || continue
    sed -n 2p "$_proj_hook" | grep -qF "# $_name.sh — " || continue
    grep -qE '^# @(cc-only-rationale|dual-pair)' "$_proj_hook" || continue
    if [ "$_yield_mode" = consumer ]; then
      getff_closure_matches "${SCRIPT_DIR}/lib/source-sha256.txt" "$CLAUDE_PROJECT_DIR/.claude/hooks" "$_name" \
        || continue
    fi
    if jq -e -n --arg n "$SCRIPT_NAME" --arg t "$_name" \
      --slurpfile p "${SCRIPT_DIR}/hooks.json" --slurpfile s "$CLAUDE_PROJECT_DIR/.claude/settings.json" '
        def pairs(f): [(.hooks // {}) | to_entries[] | .key as $e | (.value | arrays)[] | objects
          | select(any((.hooks | arrays)[]; type == "object" and f))
          | [$e, (if (.matcher // "") == "*" then "" else (.matcher // "") end)]] | unique;
        ([$p, $s] | all(length == 1))
        and (($p[0] | pairs((.command // "") | tostring | test("run-hook\\.cmd\"? +" + $n + "$"))) as $need
          | ($s[0] | pairs(.type == "command" and ((keys - ["type", "command", "statusMessage"]) | length) == 0
              and .command == ("bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/" + $t + ".sh\""))) as $have
          | ($need | length) > 0 and all($need[]; . as $x | any($have[]; . == $x)))' >/dev/null 2>&1; then
      _yield_hit=1; _yield_target="$_name"; break
    fi
  done
  set +f
  if [ -n "$_yield_hit" ] && [ ! -t 0 ]; then
    # The trailing x keeps the payload's final newlines through the command substitution.
    _rh_in="$(cat 2>/dev/null; printf x)"; _rh_in="${_rh_in%x}"
    _rh_d="$(printf '%s' "$_rh_in" | jq -r '.cwd // empty' 2>/dev/null || true)"
    # A cwd or project root that cannot be entered resolves to "" and keeps this copy running.
    [ -n "$_rh_d" ] && _rh_d="$(cd "$_rh_d" 2>/dev/null && pwd -P)"
    _rh_root="$(cd "$CLAUDE_PROJECT_DIR" 2>/dev/null && pwd -P)"
    if [ -n "$_rh_d" ] && [ "$_rh_d" = "$_rh_root" ]; then
      # Source mode: the project copy IS the source this copy was generated from — yield (#1879).
      [ "$_yield_mode" = source ] && exit 0
      # Consumer mode (spec D12): files cannot show that Claude Code loaded the project's settings
      # (`--setting-sources`, an SDK host without "project", a managed policy), so yield only after
      # claiming the liveness marker the project copy's prelude (.claude/hooks/lib/hook-live.sh)
      # wrote for THIS event. A `@plugin-yields-to` hit claims the target's marker. The lib is
      # sourced fail-open, exactly like lib/source-hash.sh above; missing or corrupt → run.
      if [ -r "${SCRIPT_DIR}/lib/live-claim.sh" ] && command . "${SCRIPT_DIR}/lib/live-claim.sh" \
        && getff_live_claim "$_yield_target" "$_rh_in"; then
        exit 0
      fi
    fi
    printf '%s' "$_rh_in" | bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
    exit $?
  fi
fi

exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
