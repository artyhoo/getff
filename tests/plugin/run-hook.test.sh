#!/usr/bin/env bash
# S1 acceptance — run-hook.cmd Unix path: dispatches a named sibling script; non-zero on missing arg.
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §3 (#3, ADOPT-audited per T13)
#
# AUDIT FINDING (T13): superpowers' run-hook.cmd guards the missing-arg case only in its
# Windows batch block (`if "%~1"=="" ... exit /b 1`). On the Unix path there is no explicit
# guard — an empty name makes `exec bash "${SCRIPT_DIR}/"` fail with a NON-ZERO (not == 1)
# code. The contract we assert on Unix is therefore "non-zero", not "exactly 1".
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
RH="$REPO_ROOT/plugin/hooks/run-hook.cmd"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# Isolated copy so the plugin payload is never polluted by the test.
TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT
cp "$RH" "$TMPD/run-hook.cmd"
printf 'echo RH_OK\n' > "$TMPD/__target__"

# Missing arg → non-zero exit (guard is Windows-only; Unix fails on the empty dispatch).
bash "$TMPD/run-hook.cmd" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "missing script name exits non-zero (rc=$rc)" || bad "missing-arg returned 0"

# Dispatch a named sibling script.
OUT=$(bash "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
[ "$OUT" = "RH_OK" ] && ok "dispatches named sibling script" || bad "dispatch output was '$OUT'"

# ── AIF_HOOK_LANG file fallback (incident 2026-09-13: pin never reached ZCode hooks) ──
# Target prints the resolved language so the arms assert what the dispatched hook SEES.
printf 'echo "LANG=${AIF_HOOK_LANG:-unset}"\n' > "$TMPD/__lang_probe__"
CFG="$TMPD/home/.config/getff"
mkdir -p "$CFG"

# 1. Env var present → wins, file not consulted.
OUT=$(AIF_HOOK_LANG=de HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=de" ] && ok "env var wins over file" || bad "env precedence broken: '$OUT'"

# 2. Env unset + file says ru → fallback applies (the ZCode GUI-launch case).
printf 'ru\n' > "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=ru" ] && ok "file fallback applies when env unset" || bad "fallback not applied: '$OUT'"

# 3. Env unset + no file → stays unset (English zero-setup default unchanged).
rm "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=unset" ] && ok "no file, no env → unset (default en path)" || bad "unexpected injection: '$OUT'"

# 4. Malformed file content → ignored, stays unset.
printf 'ru123!!\n' > "$CFG/hook-lang"
OUT=$(env -u AIF_HOOK_LANG -u XDG_CONFIG_HOME HOME="$TMPD/home" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=unset" ] && ok "malformed file ignored" || bad "malformed accepted: '$OUT'"

# 5. XDG_CONFIG_HOME honored.
mkdir -p "$TMPD/xdg/getff"; printf 'ru\n' > "$TMPD/xdg/getff/hook-lang"
OUT=$(env -u AIF_HOOK_LANG HOME="$TMPD/home" XDG_CONFIG_HOME="$TMPD/xdg" bash "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
[ "$OUT" = "LANG=ru" ] && ok "XDG_CONFIG_HOME path honored" || bad "XDG ignored: '$OUT'"

# ── Yield to the project's own registration (incident 2026-09-28) ──────────────
# In the framework repo every plugin hook that .claude/settings.json also registers ran twice per
# event: the session-bootstrap digest reached each prompt twice (a 4-item and a 5-item invariants
# list side by side — the installed plugin lagged staging) and the output-language line three
# times. A plugin hook must stay silent when the project runs its own copy, and must keep running
# in every case where that copy would not fire or would not see the same inputs.
# Arms run under bash, sh AND dash when present: CC executes run-hook.cmd, which has no shebang,
# through the hook shell — dash on Linux runners — so the yield block must be POSIX. macOS `sh`
# is bash in POSIX mode and would not catch a bashism; `/bin/dash` ships on macOS and does.
PROJ="$TMPD/proj"
mkdir -p "$PROJ/.claude/hooks"
printf 'echo PROJECT_COPY\n' > "$PROJ/.claude/hooks/__target__.sh"
printf 'echo PROJECT_COPY\n' > "$PROJ/.claude/hooks/__other__.sh"
printf 'echo PROJECT_COPY\n' > "$PROJ/.claude/hooks/__lang_probe__.sh"
EMPTY_XDG="$TMPD/empty-xdg"; mkdir -p "$EMPTY_XDG"
# settings(<file>, <hook-name>) — register <hook-name> on UserPromptSubmit, CC's settings shape.
settings() {
  printf '{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"bash \\"$CLAUDE_PROJECT_DIR/.claude/hooks/%s.sh\\""}]}]}}\n' "$2" > "$1"
}
reset_proj() { rm -f "$PROJ/.claude/settings.json" "$PROJ/.claude/settings.local.json"; }
# run_rh <shell> <hook> — dispatch with a clean language environment (no pin, no fallback file).
run_rh() {
  local sh="$1"; shift
  env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$EMPTY_XDG" \
    "$sh" "$TMPD/run-hook.cmd" "$@" 2>/dev/null
}

SHELLS="bash sh"; command -v dash >/dev/null 2>&1 && SHELLS="$SHELLS dash"
for SH in $SHELLS; do
  # Y1. The project registers the same hook → the plugin copy is silent and exits 0.
  reset_proj; settings "$PROJ/.claude/settings.json" __target__
  OUT=$(run_rh "$SH" __target__); rc=$?
  [ -z "$OUT" ] && [ "$rc" -eq 0 ] && ok "[$SH] Y1 project registers the hook → plugin copy yields" \
    || bad "[$SH] Y1 plugin copy still ran beside the project copy: '$OUT' rc=$rc"

  # Y2. settings.local.json is a project registration too.
  reset_proj; settings "$PROJ/.claude/settings.local.json" __target__
  OUT=$(run_rh "$SH" __target__)
  [ -z "$OUT" ] && ok "[$SH] Y2 registration in settings.local.json → yields" \
    || bad "[$SH] Y2 settings.local.json registration ignored: '$OUT'"

  # Y3. The hook path inside a permissions string is NOT a registration → keep running.
  reset_proj
  printf '{"permissions":{"allow":["Bash(bash \\"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh\\")"]}}\n' \
    > "$PROJ/.claude/settings.json"
  OUT=$(run_rh "$SH" __target__)
  [ "$OUT" = "RH_OK" ] && ok "[$SH] Y3 permission string is not a registration → runs" \
    || bad "[$SH] Y3 yielded on a permission string: '$OUT'"

  # Y4. Registered but the project's script is missing → nothing would run, so the plugin runs.
  reset_proj; settings "$PROJ/.claude/settings.json" __ghost__
  printf 'echo RH_GHOST\n' > "$TMPD/__ghost__"
  OUT=$(run_rh "$SH" __ghost__)
  [ "$OUT" = "RH_GHOST" ] && ok "[$SH] Y4 registered but project script absent → runs" \
    || bad "[$SH] Y4 yielded to a project script that does not exist: '$OUT'"

  # Y5. ZCode never reads .claude/settings.json → no yield there.
  reset_proj; settings "$PROJ/.claude/settings.json" __target__
  OUT=$(env -u AIF_HOOK_LANG CLAUDE_PROJECT_DIR="$PROJ" ZCODE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$EMPTY_XDG" \
    "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  [ "$OUT" = "RH_OK" ] && ok "[$SH] Y5 ZCode session → runs" || bad "[$SH] Y5 yielded under ZCode: '$OUT'"

  # Y6. No project dir → runs.
  OUT=$(env -u AIF_HOOK_LANG -u CLAUDE_PROJECT_DIR -u ZCODE_PROJECT_DIR XDG_CONFIG_HOME="$EMPTY_XDG" \
    "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  [ "$OUT" = "RH_OK" ] && ok "[$SH] Y6 no CLAUDE_PROJECT_DIR → runs" || bad "[$SH] Y6 output '$OUT'"

  # Y7. `# @plugin-yields-to: <name>` — yields when the project registers a hook that already
  # carries this one's output; runs when it does not.
  printf '# @plugin-yields-to: __other__\necho RH_MARKED\n' > "$TMPD/__marked__"
  reset_proj; settings "$PROJ/.claude/settings.json" __other__
  OUT=$(run_rh "$SH" __marked__)
  [ -z "$OUT" ] && ok "[$SH] Y7 @plugin-yields-to target registered → yields" \
    || bad "[$SH] Y7 marker ignored: '$OUT'"
  reset_proj
  OUT=$(run_rh "$SH" __marked__)
  [ "$OUT" = "RH_MARKED" ] && ok "[$SH] Y7 @plugin-yields-to target not registered → runs" \
    || bad "[$SH] Y7 yielded with nothing registered: '$OUT'"

  # Y8. The language fallback feeds plugin hooks only. When it supplies the pin, the project copy
  # cannot see it, so the two copies differ → the plugin copy runs. With the pin in the harness
  # env both copies see it → yield.
  reset_proj; settings "$PROJ/.claude/settings.json" __lang_probe__
  printf 'ru\n' > "$TMPD/xdg/getff/hook-lang"
  OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$TMPD/xdg" \
    "$SH" "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
  [ "$OUT" = "LANG=ru" ] && ok "[$SH] Y8 pin from the fallback file only → runs (project copy is blind to it)" \
    || bad "[$SH] Y8 fallback-only pin: '$OUT'"
  OUT=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$TMPD/xdg" \
    "$SH" "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
  [ -z "$OUT" ] && ok "[$SH] Y8 pin in the harness env → yields" || bad "[$SH] Y8 env pin: '$OUT'"
done

# Y9. Without jq the registry cannot be told apart from permission strings → run, never guess.
NOJQ="$TMPD/nojq-bin"; mkdir -p "$NOJQ"
for t in bash sh dirname head tr grep sed cat env; do
  p=$(command -v "$t") && ln -sf "$p" "$NOJQ/$t"
done
reset_proj; settings "$PROJ/.claude/settings.json" __target__
OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR PATH="$NOJQ" CLAUDE_PROJECT_DIR="$PROJ" \
  XDG_CONFIG_HOME="$EMPTY_XDG" "$NOJQ/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
[ "$OUT" = "RH_OK" ] && ok "Y9 no jq on PATH → runs" || bad "Y9 yielded without jq: '$OUT'"

# ── Real tree: the framework repo's own settings.json against the shipped plugin/hooks ─────────
# R1 (class sweep, stubs — no real hook executes): every plugin hook that the repo registers as
# `.claude/hooks/<name>.sh` must yield; the plugin-only hooks the repo does not run must still fire.
STUBS="$TMPD/stubs"; mkdir -p "$STUBS"; cp "$RH" "$STUBS/run-hook.cmd"
PLUGIN_NAMES=$(jq -r '[.hooks[][].hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n] | unique[]' \
  "$REPO_ROOT/plugin/hooks/hooks.json")
PROJECT_NAMES=$(jq -r '[.hooks[][].hooks[].command | capture("\\.claude/hooks/(?<n>[^ ]+)\\.sh").n] | unique[]' \
  "$REPO_ROOT/.claude/settings.json")
yielded=0
for n in $PLUGIN_NAMES; do
  # The stub carries the real twin's @plugin-yields-to line, so markers are tested as shipped.
  { grep -m1 '^# @plugin-yields-to:' "$REPO_ROOT/plugin/hooks/$n" 2>/dev/null; echo "echo RAN"; } > "$STUBS/$n"
  OUT=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$REPO_ROOT" XDG_CONFIG_HOME="$EMPTY_XDG" \
    bash "$STUBS/run-hook.cmd" "$n" </dev/null 2>/dev/null)
  if printf '%s\n' "$PROJECT_NAMES" | grep -qx "$n"; then
    [ -z "$OUT" ] && yielded=$((yielded+1)) || bad "R1 $n: the repo runs its own copy, the plugin copy fired too"
  fi
done
[ "$yielded" -ge 10 ] && ok "R1 $yielded plugin hooks shared with .claude/settings.json all yield" \
  || bad "R1 only $yielded shared hooks yielded (vacuous or broken sweep)"
for n in inject-project-digest session-start warn-subagent-report-zcode check-doc-authority-header; do
  OUT=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$REPO_ROOT" XDG_CONFIG_HOME="$EMPTY_XDG" \
    bash "$STUBS/run-hook.cmd" "$n" </dev/null 2>/dev/null)
  [ "$OUT" = "RAN" ] && ok "R1 $n (plugin-only) still fires" || bad "R1 $n (plugin-only) was silenced: '$OUT'"
done
OUT=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$REPO_ROOT" XDG_CONFIG_HOME="$EMPTY_XDG" \
  bash "$STUBS/run-hook.cmd" inject-output-language </dev/null 2>/dev/null)
[ -z "$OUT" ] && ok "R1 inject-output-language yields to the repo's session-bootstrap digest" \
  || bad "R1 inject-output-language fired beside the digest that already carries its line"

# R2 (end to end, real hooks): one UserPromptSubmit in the framework repo — the repo's own
# injector plus every plugin UserPromptSubmit hook through the shipped run-hook.cmd — carries the
# digest once, the language line once, the project digest once, and the invariants line is the
# repo's current one (README renders five; the stale 0.3.2 plugin carried four).
PROMPT=$( {
  CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=ru bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh"
  for n in $(jq -r '.hooks.UserPromptSubmit[].hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n' \
      "$REPO_ROOT/plugin/hooks/hooks.json"); do
    [ "$n" = deps-hash-check ] && continue   # writes a cache file; its yield is covered by R1
    echo '{"hook_event_name":"UserPromptSubmit"}' | env -u ZCODE_PROJECT_DIR CLAUDE_PROJECT_DIR="$REPO_ROOT" \
      AIF_HOOK_LANG=ru XDG_CONFIG_HOME="$EMPTY_XDG" bash "$RH" "$n"
  done
} 2>/dev/null )
c_digest=$(printf '%s\n' "$PROMPT" | grep -c '^\[session-bootstrap digest')
c_lang=$(printf '%s\n' "$PROMPT" | grep -c '^\[output-language\]')
c_proj=$(printf '%s\n' "$PROMPT" | grep -c '^Project: ')
[ "$c_digest" -eq 1 ] && ok "R2 session-bootstrap digest injected once" || bad "R2 digest injected $c_digest times"
[ "$c_lang" -eq 1 ] && ok "R2 output-language line injected once" || bad "R2 output-language injected $c_lang times"
[ "$c_proj" -eq 1 ] && ok "R2 project digest (plugin-only hook) still injected once" \
  || bad "R2 project digest injected $c_proj times"
printf '%s\n' "$PROMPT" | grep '^Invariants:' | grep -q '(5) ' \
  && ok "R2 the one invariants line is the repo's five-item render" || bad "R2 invariants line is not the repo's render"

# R3 (the premise of inject-output-language's @plugin-yields-to): the digest carries the SAME
# language line the yielding hook would have emitted — otherwise the yield changes the prompt.
for L in ru de; do
  own=$(AIF_HOOK_LANG=$L bash "$REPO_ROOT/.claude/hooks/inject-output-language.sh" 2>/dev/null)
  twin=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=$L bash "$REPO_ROOT/plugin/hooks/inject-output-language" 2>/dev/null)
  in_digest=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=$L bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh" 2>/dev/null \
    | grep '^\[output-language\]')
  [ -n "$own" ] && [ "$own" = "$in_digest" ] && [ "$twin" = "$in_digest" ] \
    && ok "R3 [$L] the digest carries inject-output-language's exact line" \
    || bad "R3 [$L] language lines differ: hook='$own' twin='$twin' digest='$in_digest'"
done

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
