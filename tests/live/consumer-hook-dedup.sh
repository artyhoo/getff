#!/usr/bin/env bash
# consumer-hook-dedup.sh — live check that each getff hook emits once per event in an installed consumer
#
# WHAT: builds a scratch consumer (git init + package.json + `install.sh ts-server`), then drives
# ONE real turn per harness — Claude Code and, where installed, ZCode — that writes two files and
# spawns a subagent. Every hook copy that runs is traced; the report counts, per hook and event,
# how many copies produced output, and fails when:
#   - any hook other than deps-hash-check emitted from two copies for one event (spec D4 keeps
#     deps-hash-check doubled on purpose);
#   - a hook in the MUST_EMIT table below emitted nothing although its event fired
#     (the lost-gate case a yield must never cause);
#   - a UserPromptSubmit event carried the `[output-language]` line other than exactly once (D5).
# Spec: docs/superpowers/specs/2026-09-28-consumer-plugin-hook-dedup-design.md
#   («Live verification before merge»; D3, D5, D6, D12).
#
# NOT RUN IN CI — each harness run is a real model turn on the operator's own subscription
# (.claude/rules/no-paid-llm-in-ci.md). Run by hand, from any checkout of this repo:
#   bash tests/live/consumer-hook-dedup.sh [--harness cc|zcode|all] [--work-dir DIR]
#   bash tests/live/consumer-hook-dedup.sh --zcode-login [--no-browser]  # once, before a ZCode run
#
# HOW A COPY IS TRACED: a `bash` shim goes first on PATH. Both channels reach a hook through
# `bash`: the plugin dispatcher ends in `bash <plugin>/hooks/<name>` (plugin/hooks/run-hook.cmd),
# the project registration is `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh"`. The shim
# records channel, event, payload hash, exit code, stdout and stderr, then hands the same bytes
# on. Hook files and registrations stay byte-identical, so the yield conditions (hash manifest,
# exact registration form) are measured as a consumer has them. A plugin copy that yields exits
# before it calls bash and leaves no record — that is the point.
# The instrument checks itself: a harness run with no traced hook means the shim was not
# reached (a host that rewrites PATH for hooks) and is INCONCLUSIVE, never PASS. On Claude Code
# the trace is also compared with the harness's own hook events (`--include-hook-events`): a
# different count of emitting hooks for an event is INCONCLUSIVE.
#
# ENV:
#   CLAUDE_BIN       Claude Code CLI (default: `claude` on PATH)
#   LIVE_CC_MODEL    optional --model for the Claude Code run
#   ZCODE_BIN        a `zcode` CLI; default `zcode` on PATH, else the CLI bundled in ZCODE_APP
#   ZCODE_APP        default /Applications/ZCode.app (CLI = Contents/Resources/glm/zcode.cjs,
#                    run by the app's own Electron binary with ELECTRON_RUN_AS_NODE=1)
#   ZCODE_LIVE_HOME  the ZCode CLI's own data home (passed as ZCODE_DATA_BASE_DIR; default
#                    ${XDG_STATE_HOME:-~/.local/state}/getff/zcode-live). Its sign-in lives here,
#                    apart from the app's ~/.zcode. ZCODE_LIVE_HOME=$HOME reuses a CLI sign-in
#                    already made in the shared store.
#   LIVE_TIMEOUT     seconds per harness run (default 900)
# ZCode runs against an isolated plugin store (ZCODE_STORAGE_DIR inside the work dir): the
# working-tree plugin is installed there and the operator's own ZCode plugin set is untouched.
# ZCODE SIGN-IN (measured 2026-09-29, CLI 0.16.9 / app 3.14.3): the app provisions its Coding Plan
# key into the runtimes it starts itself; a CLI started from a shell has none and its model
# request dies at «Client signing credential must contain one separator» after SessionStart and
# UserPromptSubmit fired. The CLI's own supported path is `zcode login`: Z.AI OAuth in a browser,
# after which the CLI fetches the account's Coding Plan key and stores it as its standalone
# provider under ZCODE_DATA_BASE_DIR. `--zcode-login` runs exactly that against ZCODE_LIVE_HOME;
# it is the operator's one-time step (a browser sign-in). Without it the ZCode run is
# INCONCLUSIVE and names the command. (A signed-out Claude Code run stops the same way: hooks
# before the model call still fire, the rest do not.)
#
# EXIT: 0 PASS · 1 FAIL · 2 usage/setup error · 3 INCONCLUSIVE (no harness could run, a run did
# not exercise an event it needed, or the tracer was not reached).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLUGIN_DIR="$REPO_ROOT/plugin"
HARNESS=all
WORK=''
LOGIN_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --harness) HARNESS="${2:-}"; shift 2 ;;
    --work-dir) WORK="${2:-}"; shift 2 ;;
    --zcode-login) HARNESS=zcode-login; shift ;;
    --no-browser) LOGIN_ARGS+=(--no-browser); shift ;;
    -h|--help) sed -n '2,57p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$HARNESS" in cc|zcode|all|zcode-login) ;; *) echo "--harness must be cc, zcode or all" >&2; exit 2 ;; esac
for tool in jq git shasum awk; do
  command -v "$tool" >/dev/null 2>&1 || { echo "missing required tool: $tool" >&2; exit 2; }
done
[ -f "$PLUGIN_DIR/hooks/hooks.json" ] || { echo "no plugin at $PLUGIN_DIR" >&2; exit 2; }
[ -n "$WORK" ] || WORK="$(mktemp -d "${TMPDIR:-/tmp}/getff-live-dedup.XXXXXX")"
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd -P)"
LIVE_TIMEOUT="${LIVE_TIMEOUT:-900}"

# Hooks that must produce output at least once, per harness: `<hook> <event> [<file-path suffix>]`.
# A path suffix narrows the row to a PostToolUse on that file (the hook is path-scoped). Why the
# scenario makes each one speak:
#   session-start               SessionStart      plugin-only bootstrap banner
#   inject-output-language      UserPromptSubmit  AIF_HOOK_LANG=ru is set for the run
#   inject-project-digest       UserPromptSubmit  the consumer's digest block is filled below
#   inject-project-digest       SubagentStart     same digest; CC only (ZCode has no SubagentStart)
#   inject-subagent-context     PreToolUse        ZCode's SubagentStart fallback (silent on CC)
#   deps-hash-check             UserPromptSubmit  a fresh consumer has no tool-decision baseline
#   inject-matching-rule        PostToolUse       the turn writes src/probe.ts
#   check-doc-authority-header  PostToolUse       the turn writes .claude/rules/probe-rule.md
#                                                 without an authority header (exit 2)
#   end-of-turn-reminder        Stop              AIF_EOT_SDK_RECAP=1 lifts its sdk-* guard, and the
#                                                 final reply is long structured markdown, the shape
#                                                 that makes it demand a recap (a short reply is silent)
MUST_EMIT_COMMON='session-start SessionStart
inject-output-language UserPromptSubmit
inject-project-digest UserPromptSubmit
deps-hash-check UserPromptSubmit
inject-matching-rule PostToolUse src/probe.ts
check-doc-authority-header PostToolUse .claude/rules/probe-rule.md
end-of-turn-reminder Stop'
MUST_EMIT_CC="$MUST_EMIT_COMMON
inject-project-digest SubagentStart"
MUST_EMIT_ZCODE="$MUST_EMIT_COMMON
inject-subagent-context PreToolUse"
# The one hook allowed to emit from both copies (spec D4: its relative registration never counts).
DOUBLE_OK='deps-hash-check'

PROMPT='This is an automated hook test. Do exactly these steps, in order, then stop:
1. Use the Write tool to create src/probe.ts containing: export const probe = 1;
2. Use the Write tool to create .claude/rules/probe-rule.md containing the line "# Probe rule" and one sentence of your choice. If a hook reports a problem with that file, fix it once.
3. Use the Agent tool (called Task on some hosts) to start ONE subagent with the prompt: Reply with the single word OK. Do not use any tools.
4. Finish with a markdown report: a first line "## Report", then one "- " bullet per step above saying what you did, at least 600 characters in total. If a hook then asks for a recap, give it once.'

REAL_BASH="$(command -v bash)"

# ── shim ────────────────────────────────────────────────────────────────────────────────────
write_shim() {
  local dir="$1"
  mkdir -p "$dir"
  cat >"$dir/bash" <<'SHIM'
#!/bin/sh
# Tracing stand-in for bash (tests/live/consumer-hook-dedup.sh). Writes one record file per hook
# copy that runs, then runs it unchanged. Anything that is not a hook script passes straight
# through. One file per copy, not appends to a shared log: copies for one event run in parallel
# and a record carries the full output, so a shared append could interleave two records.
_chan=''
if [ -z "${GETFF_TRACE_ACTIVE:-}" ] && [ -d "${GETFF_TRACE_DIR:-}" ] && [ $# -ge 1 ]; then
  case "$1" in
    *.claude/hooks/*.sh) _chan=project ;;
    */hooks/*) [ -f "$(dirname "$1")/run-hook.cmd" ] && _chan=plugin ;;
  esac
fi
[ -n "$_chan" ] || exec "$GETFF_TRACE_REAL_BASH" "$@"
_t="$(mktemp -d "${TMPDIR:-/tmp}/getff-trace.XXXXXX")" || exec "$GETFF_TRACE_REAL_BASH" "$@"
_rec="$(mktemp "$GETFF_TRACE_DIR/rec.XXXXXX")" || exec "$GETFF_TRACE_REAL_BASH" "$@"
cat >"$_t/in"
_name="$(basename "$1")"; _name="${_name%.sh}"
_key="$(shasum -a 256 <"$_t/in" | cut -c1-16)"
# Event identity, not payload bytes: two copies of one event count together even when a host
# hands each copy a slightly different payload. Unparseable stdin falls back to the byte hash.
_ekey="$(jq -ce '{s: .session_id, e: .hook_event_name, p: .prompt, t: .tool_use_id,
  a: .stop_hook_active, g: .agent_id, f: .tool_input.file_path, o: .source}' <"$_t/in" 2>/dev/null \
  | shasum -a 256 | cut -c1-16)"
jq -e . <"$_t/in" >/dev/null 2>&1 || _ekey="raw-$_key"
_event="$(jq -r '.hook_event_name // "?"' <"$_t/in" 2>/dev/null)"
_file="$(jq -r '.tool_input.file_path // .tool_input.path // ""' <"$_t/in" 2>/dev/null)"
_record() { # <rc> <finished: true|false>
  jq -nc --arg hook "$_name" --arg channel "$_chan" --arg event "${_event:-?}" --arg file "$_file" \
    --arg key "$_key" --arg ekey "$_ekey" --argjson rc "$1" --argjson finished "$2" --arg path "$3" \
    --rawfile out "$_t/out" --rawfile err "$_t/err" \
    '{hook: $hook, channel: $channel, event: $event, file: $file, key: $key, ekey: $ekey, rc: $rc,
      finished: $finished, path: $path, out: $out, err: $err,
      emitted: (($out | length) > 0 or ($rc != 0 and ($err | length) > 0))}'
}
# A start record first: a copy the host kills mid-run stays visible as unfinished instead of
# looking like a plugin copy that yielded.
: >"$_t/out"; : >"$_t/err"
_record -1 false "$1" >"$_rec" 2>/dev/null
GETFF_TRACE_ACTIVE=1 "$GETFF_TRACE_REAL_BASH" "$@" <"$_t/in" >"$_t/out" 2>"$_t/err"
_rc=$?
_record "$_rc" true "$1" >"$_rec.tmp" 2>/dev/null && mv -f "$_rec.tmp" "$_rec"
cat "$_t/out"
cat "$_t/err" >&2
rm -f "$_t/in" "$_t/out" "$_t/err"; rmdir "$_t" 2>/dev/null
exit "$_rc"
SHIM
  chmod +x "$dir/bash"
}

# ── consumer ────────────────────────────────────────────────────────────────────────────────
make_consumer() {
  local dir="$1" log="$2"
  mkdir -p "$dir"
  git -C "$dir" init -q || return 1
  printf '{"name":"getff-live-consumer","version":"0.0.0","private":true}\n' >"$dir/package.json"
  (cd "$dir" && bash "$REPO_ROOT/install.sh" ts-server </dev/null) >"$log" 2>&1 || return 1
  mkdir -p "$dir/src"
  # Fill the digest block so inject-project-digest has something to inject.
  local sb="$dir/.claude/session-bootstrap.md"
  grep -q '^<!-- digest:start -->$' "$sb" 2>/dev/null || return 1
  awk '{ print } /^<!-- digest:start -->$/ { print "Live dedup probe digest: this consumer exists only for a hook test." }' \
    "$sb" >"$sb.tmp" && mv "$sb.tmp" "$sb" || return 1
  # A consumer rule scoped to src/** so inject-matching-rule has something to inject on the
  # src/probe.ts write (a ts-server install ships no path-scoped rule of its own).
  mkdir -p "$dir/.claude/rules"
  cat >"$dir/.claude/rules/live-probe-src.md" <<'RULE'
# Live probe rule

> **Authoritative for:** the live hook-dedup probe only.

<!-- globs: src/** -->
<!-- inject: live probe rule for files under src/ -->

Files under src/ exist only for the hook-dedup live check.
RULE
}

# ── versions ────────────────────────────────────────────────────────────────────────────────
report_versions() {
  local sha dirty=''
  sha="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo '?')"
  [ -n "$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null)" ] && dirty=' (dirty tree)'
  echo "repo:    $REPO_ROOT @ $sha$dirty"
  echo "plugin:  $(jq -r '.name + " " + .version' "$PLUGIN_DIR/.claude-plugin/plugin.json" 2>/dev/null)"
  echo "os:      $(uname -sr) $(uname -m)"
  echo "date:    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

# ── analysis ────────────────────────────────────────────────────────────────────────────────
# analyze <harness> <trace.jsonl> <must-emit rows> <file listing extra fired events, or ''>
# Prints the table and verdict lines; returns 0 PASS, 1 FAIL, 3 INCONCLUSIVE.
analyze() {
  local harness="$1" trace="$2" must="$3" extra_events="$4"
  if [ ! -s "$trace" ]; then
    echo "[$harness] INCONCLUSIVE: no hook copy was traced — the bash shim was not reached (host rewrote PATH for hooks?) or no hook fired"
    return 3
  fi
  local unfinished
  unfinished="$(jq -rs 'map(select(.finished != true) | "\(.hook)/\(.channel) on \(.event)") | join(", ")' "$trace")"
  if [ -n "$unfinished" ]; then
    echo "[$harness] INCONCLUSIVE instrument: hook copies started but never finished (killed?): $unfinished"
  fi
  local fired
  fired="$( { jq -r '.event' "$trace"; if [ -n "$extra_events" ]; then cat "$extra_events"; fi; } | sort -u)"

  echo "[$harness] per hook and event — events seen, copies run and copies that emitted (max per event), total emissions, emitting channels:"
  jq -rs '
    group_by([.hook, .event, .ekey])
    | map({hook: .[0].hook, event: .[0].event, runs: length,
           emits: (map(select(.emitted)) | length),
           channels: (map(select(.emitted) | .channel) | unique)})
    | group_by([.hook, .event])
    | map({hook: .[0].hook, event: .[0].event, n: length,
           runs: (map(.runs) | max), emits: (map(.emits) | max), total: (map(.emits) | add),
           channels: (map(.channels[]) | unique | join("+"))})
    | sort_by(.event, .hook)[]
    | "  \(.hook | . + (" " * ([30 - length, 1] | max))) \(.event | . + (" " * ([18 - length, 1] | max)))events=\(.n) runs<=\(.runs) emits<=\(.emits) total=\(.total) \(if .channels == "" then "-" else .channels end)"
  ' "$trace"

  local rc=0 line
  [ -n "$unfinished" ] && rc=3

  # 1. Double emission for one event.
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    echo "[$harness] FAIL double emission: $line"
    rc=1
  done < <(jq -rs --arg ok "$DOUBLE_OK" '
    group_by([.hook, .event, .ekey])
    | map(select(.[0].hook != $ok) | select((map(select(.emitted)) | length) > 1))[]
    | "\(.[0].hook) on \(.[0].event)\(if .[0].file != "" then " (" + .[0].file + ")" else "" end): \(map(select(.emitted)) | length) copies emitted (\(map(select(.emitted) | .channel) | join(", ")))"
  ' "$trace")

  # 2. Must-emit rows.
  local hook event suffix fired_here total
  while read -r hook event suffix; do
    [ -n "$hook" ] || continue
    if [ -n "$suffix" ]; then
      fired_here="$(jq -rs --arg e "$event" --arg s "$suffix" \
        'any(.[]; .event == $e and (.file | endswith($s)))' "$trace")"
    elif grep -qxF "$event" <<<"$fired"; then
      fired_here=true
    else
      fired_here=false
    fi
    if [ "$fired_here" != true ]; then
      echo "[$harness] INCONCLUSIVE: $event${suffix:+ on $suffix} never fired, so $hook was not exercised"
      [ "$rc" -eq 0 ] && rc=3
      continue
    fi
    total="$(jq -rs --arg h "$hook" --arg e "$event" --arg s "$suffix" \
      'map(select(.hook == $h and .event == $e and .emitted and ($s == "" or (.file | endswith($s))))) | length' "$trace")"
    case "$total" in
      ''|*[!0-9]*) echo "[$harness] INCONCLUSIVE instrument: could not count $hook on $event"; [ "$rc" -eq 0 ] && rc=3; continue ;;
    esac
    if [ "$total" -eq 0 ]; then
      echo "[$harness] FAIL lost hook: $hook emitted nothing on $event${suffix:+ ($suffix)} although the event fired"
      rc=1
    fi
  done <<<"$must"

  # 3. The language line, exactly once per UserPromptSubmit (grouped by event identity, not by
  #    payload bytes, so a host that sends each hook a slightly different payload cannot split
  #    a doubled line into two single ones).
  if ! jq -e -s 'any(.[]; .event == "UserPromptSubmit")' "$trace" >/dev/null; then
    echo "[$harness] INCONCLUSIVE: no UserPromptSubmit was traced, the language line was not measured"
    [ "$rc" -eq 0 ] && rc=3
  fi
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    echo "[$harness] FAIL output-language: $line"
    rc=1
  done < <(jq -rs '
    map(select(.event == "UserPromptSubmit")) | group_by(.ekey)[]
    | ([.[] | select(.emitted) | .out | [scan("\\[output-language\\]")] | length] | add // 0) as $n
    | select($n != 1)
    | "one UserPromptSubmit carried the [output-language] line \($n) times (from: \([.[] | select(.emitted and (.out | test("\\[output-language\\]"))) | "\(.hook)/\(.channel)"] | join(", ")))"
  ' "$trace")
  return "$rc"
}

# Claude Code only: compare the trace with the harness's own hook events. A hook_response counts
# as emitting under the shim's predicate (stdout, or stderr on a non-zero exit).
cross_check_cc() {
  local stream="$1" trace="$2" events="$3" mismatch=0 ev a b
  if [ ! -s "$events" ]; then
    echo "[cc] INCONCLUSIVE instrument: the stream carries no hook_started events to cross-check against"
    return 1
  fi
  while IFS= read -r ev; do
    [ -n "$ev" ] || continue
    a="$(jq -r --arg e "$ev" 'select(.type == "system" and .subtype == "hook_response" and .hook_event == $e)
      | select(((.stdout // "") | length) > 0 or ((.exit_code // 0) != 0 and ((.stderr // "") | length) > 0)) | 1' \
      "$stream" 2>/dev/null | wc -l | tr -d ' ')"
    b="$(jq -rs --arg e "$ev" 'map(select(.event == $e and .emitted)) | length' "$trace")"
    if [ "$a" != "$b" ]; then
      echo "[cc] INCONCLUSIVE instrument: $ev — the harness reports $a emitting hook(s), the trace has $b"
      mismatch=1
    fi
  done <"$events"
  return "$mismatch"
}

# collect_trace <harness> <record dir> <trace.jsonl> — joins the per-copy records; a record
# that does not parse is an instrument error (INCONCLUSIVE), never silently dropped.
collect_trace() {
  local harness="$1" dir="$2" out="$3" f bad=0
  : >"$out"
  for f in "$dir"/rec.*; do
    [ -f "$f" ] || continue
    case "$f" in *.tmp) continue ;; esac
    if jq -ce . "$f" >>"$out" 2>/dev/null; then :; else
      echo "[$harness] INCONCLUSIVE instrument: unreadable trace record $f"
      bad=1
    fi
  done
  return "$bad"
}

run_with_timeout() {
  if command -v timeout >/dev/null 2>&1; then timeout "$LIVE_TIMEOUT" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then gtimeout "$LIVE_TIMEOUT" "$@"
  else
    # Stock macOS has neither: a watchdog kills the run after LIVE_TIMEOUT seconds.
    "$@" & local pid=$!
    ( sleep "$LIVE_TIMEOUT"; kill -TERM "$pid" 2>/dev/null ) & local dog=$!
    wait "$pid"; local rc=$?
    kill "$dog" 2>/dev/null; wait "$dog" 2>/dev/null
    return "$rc"
  fi
}

# Environment every harness run shares. Hook-affecting variables inherited from the calling
# session are cleared so the run sees what a fresh consumer terminal would.
trace_env() {
  local shim="$1" trace="$2"
  printf '%s\n' "PATH=$shim:$PATH" "GETFF_TRACE_DIR=$trace" "GETFF_TRACE_REAL_BASH=$REAL_BASH" \
    "AIF_HOOK_LANG=ru" "AIF_EOT_SDK_RECAP=1"
}
UNSET_ARGS=(-u CLAUDE_PROJECT_DIR -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD -u GETFF_TRACE_ACTIVE
  -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u AIF_AUTONOMOUS)

# ── Claude Code ─────────────────────────────────────────────────────────────────────────────
run_cc() {
  local d="$WORK/cc" claude_bin="${CLAUDE_BIN:-claude}" ver l
  if ! command -v "$claude_bin" >/dev/null 2>&1; then
    echo "[cc] SKIP: Claude Code CLI not found ($claude_bin)"; return 4
  fi
  ver="$("$claude_bin" --version 2>/dev/null | head -n 1)"
  echo "[cc] harness: Claude Code ${ver:-?} ($(command -v "$claude_bin"))"
  # Not a gate: SessionStart and UserPromptSubmit hooks fire before the model call, so even a
  # signed-out run measures them; the events after it then report INCONCLUSIVE.
  local auth
  auth="$("$claude_bin" auth status 2>/dev/null || true)"
  if jq -e '.loggedIn == false' <<<"$auth" >/dev/null 2>&1; then
    echo "[cc] note: \`$claude_bin auth status\` reports loggedIn=false — only the hooks before the model call can fire"
  fi
  mkdir -p "$d"
  make_consumer "$d/consumer" "$d/install.log" \
    || { echo "[cc] setup error: consumer install failed, see $d/install.log"; return 2; }
  write_shim "$d/shim"
  mkdir -p "$d/trace.d"
  local model_args=() envs=()
  [ -n "${LIVE_CC_MODEL:-}" ] && model_args=(--model "$LIVE_CC_MODEL")
  while IFS= read -r l; do envs+=("$l"); done < <(trace_env "$d/shim" "$d/trace.d")
  (cd "$d/consumer" && run_with_timeout env "${UNSET_ARGS[@]}" "${envs[@]}" \
    "$claude_bin" -p "$PROMPT" --output-format stream-json --verbose --include-hook-events \
    --setting-sources project,local --plugin-dir "$PLUGIN_DIR" \
    --permission-mode acceptEdits --allowedTools "Write Edit Read Agent Task" --max-turns 20 \
    ${model_args[@]+"${model_args[@]}"} </dev/null) >"$d/stream.jsonl" 2>"$d/stderr.log"
  local run_rc=$?
  echo "[cc] run exit=$run_rc · stream $d/stream.jsonl · trace $d/trace.jsonl"
  collect_trace cc "$d/trace.d" "$d/trace.jsonl" || return 3
  if ! jq -e 'select(.type == "result")' "$d/stream.jsonl" >/dev/null 2>&1; then
    echo "[cc] INCONCLUSIVE: the run produced no result event (network or timeout) — see $d/stderr.log"
    return 3
  fi
  jq -r 'select(.type == "result" and .is_error == true) | "[cc] the model turn failed: \(.result | tostring | .[0:200])"' \
    "$d/stream.jsonl" 2>/dev/null
  jq -r 'select(.type == "system" and .subtype == "hook_started") | .hook_event' "$d/stream.jsonl" 2>/dev/null \
    | sort -u >"$d/harness-events.txt"
  local cc_rc=0 xrc=0
  analyze cc "$d/trace.jsonl" "$MUST_EMIT_CC" "$d/harness-events.txt" || cc_rc=$?
  cross_check_cc "$d/stream.jsonl" "$d/trace.jsonl" "$d/harness-events.txt" || xrc=$?
  [ "$xrc" -ne 0 ] && [ "$cc_rc" -eq 0 ] && cc_rc=3
  return "$cc_rc"
}

# ── ZCode ───────────────────────────────────────────────────────────────────────────────────
ZC=()
ZCODE_APP="${ZCODE_APP:-/Applications/ZCode.app}"
ZCODE_LIVE_HOME="${ZCODE_LIVE_HOME:-${XDG_STATE_HOME:-$HOME/.local/state}/getff/zcode-live}"
ZCODE_LOGIN_CMD="bash $REPO_ROOT/tests/live/consumer-hook-dedup.sh --zcode-login"
# resolve_zcode <layout dir>
resolve_zcode() {
  local layout="$1" res="$ZCODE_APP/Contents/Resources"
  if [ -n "${ZCODE_BIN:-}" ]; then ZC=("$ZCODE_BIN"); return 0; fi
  if command -v zcode >/dev/null 2>&1; then ZC=("$(command -v zcode)"); return 0; fi
  if [ -x "$ZCODE_APP/Contents/MacOS/ZCode" ] && [ -f "$res/glm/zcode.cjs" ]; then
    # The bundled CLI looks for its provider config at <entrypoint dir>/provider/zcode-builtin.json
    # (measured in CLI 0.16.9: "无法定位 CLI ZCode Built-in Provider Config"), while the app ships
    # it at Resources/config/provider/. A symlinked entrypoint beside a provider/ dir supplies it
    # without touching the app bundle.
    mkdir -p "$layout/provider"
    ln -sfn "$res/glm/zcode.cjs" "$layout/zcode.cjs"
    ln -sfn "$res/glm/packages" "$layout/packages"
    ln -sfn "$res/glm/.node-bundle-meta.json" "$layout/.node-bundle-meta.json"
    [ -f "$res/config/provider/zcode-builtin.json" ] \
      && ln -sfn "$res/config/provider/zcode-builtin.json" "$layout/provider/zcode-builtin.json"
    ZC=(env ELECTRON_RUN_AS_NODE=1 "$ZCODE_APP/Contents/MacOS/ZCode" "$layout/zcode.cjs")
    return 0
  fi
  return 1
}

run_zcode() {
  local d="$WORK/zcode" ver app_ver='' l
  if ! resolve_zcode "$d/cli"; then
    echo "[zcode] SKIP: no zcode CLI (set ZCODE_BIN, put \`zcode\` on PATH, or install ZCode.app)"; return 4
  fi
  # The CLI keeps its sign-in in <data home>/.zcode/v2/credentials.json (resolveSharedZCodeCredentialsPath).
  if [ ! -s "$ZCODE_LIVE_HOME/.zcode/v2/credentials.json" ]; then
    echo "[zcode] INCONCLUSIVE: the ZCode CLI is not signed in under $ZCODE_LIVE_HOME"
    echo "[zcode]   one-time browser sign-in (operator step): $ZCODE_LOGIN_CMD"
    return 3
  fi
  export ZCODE_DATA_BASE_DIR="$ZCODE_LIVE_HOME"
  mkdir -p "$d/storage" "$d/xdg/getff"
  ver="$(ZCODE_STORAGE_DIR="$d/storage" "${ZC[@]}" version 2>/dev/null | head -n 1)"
  if [ -f "$ZCODE_APP/Contents/Info.plist" ] && command -v plutil >/dev/null 2>&1; then
    app_ver="$(plutil -extract CFBundleShortVersionString raw "$ZCODE_APP/Contents/Info.plist" 2>/dev/null)"
  fi
  echo "[zcode] harness: ZCode CLI ${ver:-?}${app_ver:+ (app $app_ver)}"
  make_consumer "$d/consumer" "$d/install.log" \
    || { echo "[zcode] setup error: consumer install failed, see $d/install.log"; return 2; }
  # The working-tree plugin, installed into the isolated store.
  { ZCODE_STORAGE_DIR="$d/storage" "${ZC[@]}" plugins marketplace add "$REPO_ROOT" \
      && ZCODE_STORAGE_DIR="$d/storage" "${ZC[@]}" plugins install getff@getff; } >"$d/plugin-install.log" 2>&1 \
    || { echo "[zcode] setup error: plugin install failed, see $d/plugin-install.log"; return 2; }
  echo "[zcode] $(grep -m1 'Installed plugin' "$d/plugin-install.log")"
  # ZCode hands plugin hooks no env block; the language pin also rides the file fallback.
  printf 'ru\n' >"$d/xdg/getff/hook-lang"
  write_shim "$d/shim"
  mkdir -p "$d/trace.d"
  local envs=()
  while IFS= read -r l; do envs+=("$l"); done < <(trace_env "$d/shim" "$d/trace.d")
  run_with_timeout env "${UNSET_ARGS[@]}" "${envs[@]}" ZCODE_STORAGE_DIR="$d/storage" XDG_CONFIG_HOME="$d/xdg" \
    "${ZC[@]}" -p "$PROMPT" --cwd "$d/consumer" --mode yolo --json >"$d/output.json" 2>"$d/stderr.log"
  local run_rc=$?
  echo "[zcode] run exit=$run_rc · output $d/output.json · trace $d/trace.jsonl"
  collect_trace zcode "$d/trace.d" "$d/trace.jsonl" || return 3
  if [ "$run_rc" -ne 0 ] && [ ! -s "$d/trace.jsonl" ]; then
    echo "[zcode] INCONCLUSIVE: the run failed before any hook fired — $(grep -m1 -E 'Error|无法|missing' "$d/stderr.log" 2>/dev/null | cut -c1-160)"
    echo "[zcode]   full log: $d/stderr.log"
    return 3
  fi
  if [ "$run_rc" -ne 0 ]; then
    echo "[zcode] the model turn failed: $(grep -m1 -E 'Error|无法|missing' "$d/stderr.log" 2>/dev/null | cut -c1-160)"
    grep -q 'signing credential' "$d/stderr.log" 2>/dev/null \
      && echo "[zcode]   the CLI has no Coding Plan key — sign in again (operator step): $ZCODE_LOGIN_CMD"
  fi
  analyze zcode "$d/trace.jsonl" "$MUST_EMIT_ZCODE" ''
}

# ── main ────────────────────────────────────────────────────────────────────────────────────
if [ "$HARNESS" = zcode-login ]; then
  # The CLI's own sign-in, into ZCODE_LIVE_HOME: prints the authorize URL, opens the browser, and
  # waits for the operator to approve. Nothing is read from or written to the app's ~/.zcode.
  resolve_zcode "$ZCODE_LIVE_HOME/cli" || { echo "no zcode CLI (set ZCODE_BIN or install ZCode.app)" >&2; exit 2; }
  mkdir -p "$ZCODE_LIVE_HOME"
  echo "ZCode CLI sign-in into $ZCODE_LIVE_HOME"
  ZCODE_DATA_BASE_DIR="$ZCODE_LIVE_HOME" "${ZC[@]}" login ${LOGIN_ARGS[@]+"${LOGIN_ARGS[@]}"}
  exit $?
fi
echo "consumer-hook-dedup live check — work dir $WORK"
report_versions
overall=''
record() { # fold one harness result into the overall verdict: FAIL > SETUP > INCONCLUSIVE > PASS
  case "$1" in
    0) [ -n "$overall" ] || overall=0 ;;
    1) overall=1 ;;
    2) [ "$overall" = 1 ] || overall=2 ;;
    3) case "$overall" in 1|2) ;; *) overall=3 ;; esac ;;
    *) : ;; # harness absent: contributes nothing
  esac
  return 0
}
# `case` on the --harness value: it selects a user-requested run, it does not detect a host.
case "$HARNESS" in cc|all)
  run_cc; r=$?; record "$r"
  [ "$r" -eq 0 ] && echo "[cc] PASS" ;;
esac
case "$HARNESS" in zcode|all)
  run_zcode; r=$?; record "$r"
  [ "$r" -eq 0 ] && echo "[zcode] PASS" ;;
esac
case "${overall:-3}" in
  0) echo "RESULT: PASS"; exit 0 ;;
  1) echo "RESULT: FAIL"; exit 1 ;;
  2) echo "RESULT: SETUP ERROR"; exit 2 ;;
  *) echo "RESULT: INCONCLUSIVE — not every required event was exercised end to end; see the lines above"; exit 3 ;;
esac
