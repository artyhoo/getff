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

# Isolated copy so the plugin payload is never polluted by the test. Laid out as a plugin root
# (hooks/ next to .claude-plugin/) because the yield reads the plugin's own manifest.
TMPROOT=$(mktemp -d)
trap 'rm -rf "$TMPROOT"' EXIT
TMPD="$TMPROOT/hooks"; mkdir -p "$TMPD"
cp "$RH" "$TMPD/run-hook.cmd"
printf '# AUTO-GENERATED from .claude/hooks/__target__.sh\necho RH_OK\n' > "$TMPD/__target__"

# Missing arg → non-zero exit (guard is Windows-only; Unix fails on the empty dispatch).
bash "$TMPD/run-hook.cmd" >/dev/null 2>&1; rc=$?
[ "$rc" -ne 0 ] && ok "missing script name exits non-zero (rc=$rc)" || bad "missing-arg returned 0"

# Dispatch a named sibling script.
OUT=$(bash "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
[ "$OUT" = "RH_OK" ] && ok "dispatches named sibling script" || bad "dispatch output was '$OUT'"

# ── AIF_HOOK_LANG file fallback (incident 2026-09-13: pin never reached ZCode hooks) ──
# Target prints the resolved language so the arms assert what the dispatched hook SEES.
printf '# AUTO-GENERATED from .claude/hooks/__lang_probe__.sh\necho "LANG=${AIF_HOOK_LANG:-unset}"\n' > "$TMPD/__lang_probe__"
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
# times. A plugin hook must stay silent when the plugin's own source checkout runs its copy, and
# must keep running everywhere else: in a consumer project (its copy was frozen at install and may
# be older), and wherever the project's copy would not fire on the same events or would not see
# the same inputs.
# Arms run under bash, sh AND dash when present: CC executes run-hook.cmd, which has no shebang,
# through the hook shell — dash on Linux runners — so the yield block must be POSIX. macOS `sh`
# is bash in POSIX mode and would not catch a bashism; `/bin/dash` ships on macOS and does.
PROJ="$TMPD/proj"
mkdir -p "$PROJ/.claude/hooks"
EMPTY_XDG="$TMPD/empty-xdg"; mkdir -p "$EMPTY_XDG"
PLUGIN_CMD='\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\"'
# The plugin's registrations, next to the dispatcher as in a real plugin. __wide__ carries a
# three-tool matcher, __multi__ two events — the shapes a project registration can fall short of.
# __flagged__ is registered only with an extra argument the project copy would never receive.
cat > "$TMPD/hooks.json" <<EOF
{"hooks":{
  "UserPromptSubmit":[{"hooks":[
    {"type":"command","command":"$PLUGIN_CMD __target__"},
    {"type":"command","command":"$PLUGIN_CMD __lang_probe__"},
    {"type":"command","command":"$PLUGIN_CMD __ghost__"},
    {"type":"command","command":"$PLUGIN_CMD __marked__"},
    {"type":"command","command":"$PLUGIN_CMD __plugin_only__"},
    {"type":"command","command":"$PLUGIN_CMD __flagged__ --flag"}]}],
  "PostToolUse":[
    {"matcher":"Edit|Write|MultiEdit","hooks":[{"type":"command","command":"$PLUGIN_CMD __wide__"}]},
    {"matcher":"Write","hooks":[{"type":"command","command":"$PLUGIN_CMD __multi__"}]}],
  "PostToolUseFailure":[
    {"matcher":"Write","hooks":[{"type":"command","command":"$PLUGIN_CMD __multi__"}]}]
}}
EOF
jq -e . "$TMPD/hooks.json" >/dev/null || bad "fixture hooks.json is not valid JSON"
for n in __ghost__ __wide__ __multi__ __plugin_only__ __flagged__; do
  printf '# AUTO-GENERATED from .claude/hooks/%s.sh\necho RH_OK\n' "$n" > "$TMPD/$n"
done
# The plugin's manifest, and the project as the plugin's source checkout: it ships the same
# plugin (same manifest name) with every fixture hook under plugin/hooks/.
mkdir -p "$TMPROOT/.claude-plugin"; printf '{"name":"getff"}\n' > "$TMPROOT/.claude-plugin/plugin.json"
src_checkout() {
  rm -rf "$PROJ/plugin"; mkdir -p "$PROJ/plugin/.claude-plugin" "$PROJ/plugin/hooks"
  printf '{"name":"getff"}\n' > "$PROJ/plugin/.claude-plugin/plugin.json"
  for n in __target__ __lang_probe__ __ghost__ __marked__ __plugin_only__ __flagged__ __wide__ __multi__; do
    : > "$PROJ/plugin/hooks/$n"
  done
}
src_checkout
# A plugin-only hook (session-start's shape) names no .claude/hooks source: never yields by name.
printf '# plugin-only hook\necho RH_OK\n' > "$TMPD/__plugin_only__"
printf '# @plugin-yields-to: __other__\necho RH_MARKED\n' > "$TMPD/__marked__"

# getff_proj <name> — the project's copy of a getff hook: the `# <name>.sh — ` header on line 2 and
# a delivery marker, as every .claude/hooks/*.sh carries (check-hook-marker).
getff_proj() {
  printf '#!/usr/bin/env bash\n# %s.sh — test hook\n# @cc-only-rationale: test fixture\necho PROJECT_COPY\n' "$1" \
    > "$PROJ/.claude/hooks/$1.sh"
}
for n in __target__ __other__ __lang_probe__ __wide__ __multi__ __plugin_only__ __flagged__; do getff_proj "$n"; done
reset_proj() { rm -f "$PROJ/.claude/settings.json" "$PROJ/.claude/settings.local.json"; }
# reg <event> <matcher|-> <hook-name> [<command>] — append a CC-shaped registration to settings.json.
reg() {
  local f="$PROJ/.claude/settings.json" cmd="${4:-bash \"\$CLAUDE_PROJECT_DIR/.claude/hooks/$3.sh\"}"
  [ -f "$f" ] || echo '{}' > "$f"
  jq --arg e "$1" --arg m "$2" --arg c "$cmd" \
    '.hooks[$e] += [(if $m == "-" then {} else {matcher: $m} end) + {hooks: [{type: "command", command: $c}]}]' \
    "$f" > "$f.tmp" && mv "$f.tmp" "$f"
}
# payload [<cwd>] — the JSON Claude Code writes to a hook's stdin; `cwd` is the session's directory.
payload() { jq -nc --arg cwd "${1-$PROJ}" '{session_id: "s1", hook_event_name: "UserPromptSubmit", cwd: $cwd}'; }
HOOKTMP="$TMPROOT/hooktmp"; mkdir -p "$HOOKTMP"
# run_rh <shell> <hook> — dispatch with a clean language environment (no pin, no fallback file),
# fed the payload in $RH_IN (default: cwd at the project root, as in a session started there).
run_rh() {
  local sh="$1"; shift
  printf '%s' "${RH_IN-$(payload)}" | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD \
    CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" "$sh" "$TMPD/run-hook.cmd" "$@" 2>/dev/null
}
# expect <label> <want> <got> — want "" means the plugin copy yielded (silent).
expect() {
  if [ "$3" = "$2" ]; then ok "$1"; else bad "$1 — got '$3'"; fi
}

SHELLS="bash sh"; command -v dash >/dev/null 2>&1 && SHELLS="$SHELLS dash"
for SH in $SHELLS; do
  # Y1. The project registers the same hook on the same event → silent, exit 0.
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] Y1 project registers the hook → plugin copy yields" "" "$OUT"
  [ "$rc" -eq 0 ] || bad "[$SH] Y1 yield exited $rc"

  # Y2. settings.local.json does not count: SDK hosts and --setting-sources can leave it out. A
  # settings.json holding only an unrelated hook is present, so its absence is not what runs it.
  reset_proj; reg UserPromptSubmit - __target__; mv "$PROJ/.claude/settings.json" "$PROJ/.claude/settings.local.json"
  reg UserPromptSubmit - __other__
  expect "[$SH] Y2 registration only in settings.local.json → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y3. The hook path inside a permissions string is NOT a registration.
  reset_proj
  printf '{"permissions":{"allow":["Bash(bash \\"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh\\")"]}}\n' \
    > "$PROJ/.claude/settings.json"
  expect "[$SH] Y3 permission string is not a registration → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y4. Registered but the project's script is missing → nothing would run.
  reset_proj; reg UserPromptSubmit - __ghost__
  expect "[$SH] Y4 registered but project script absent → runs" RH_OK "$(run_rh "$SH" __ghost__)"

  # Y5. ZCode never reads .claude/settings.json.
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(env -u AIF_HOOK_LANG -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" ZCODE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] Y5 ZCode session → runs" RH_OK "$OUT"

  # Y6. No project dir.
  OUT=$(env -u AIF_HOOK_LANG -u CLAUDE_PROJECT_DIR -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] Y6 no CLAUDE_PROJECT_DIR → runs" RH_OK "$OUT"

  # Y7. `# @plugin-yields-to: <name>` — yields when the project runs the named hook on this hook's
  # events; a settings.json that registers only an unrelated hook keeps it running.
  reset_proj; reg UserPromptSubmit - __other__
  expect "[$SH] Y7 @plugin-yields-to target registered → yields" "" "$(run_rh "$SH" __marked__)"
  reset_proj; reg UserPromptSubmit - __target__
  expect "[$SH] Y7 @plugin-yields-to target not registered → runs" RH_MARKED "$(run_rh "$SH" __marked__)"

  # Y8. The language fallback feeds plugin hooks only; when it supplies the pin the project copy is
  # blind to it → run. With the pin in the harness env both copies see it → yield.
  reset_proj; reg UserPromptSubmit - __lang_probe__
  printf 'ru\n' > "$TMPD/xdg/getff/hook-lang"
  OUT=$(payload | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$TMPD/xdg" "$SH" "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
  expect "[$SH] Y8 pin from the fallback file only → runs" LANG=ru "$OUT"
  OUT=$(payload | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$TMPD/xdg" "$SH" "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
  expect "[$SH] Y8 pin in the harness env → yields" "" "$OUT"

  # Y10. A narrower project matcher leaves MultiEdit to the plugin copy → run (a consumer installed
  # before the matcher widened keeps the old one: register_cc_hook never rewrites it).
  reset_proj; reg PostToolUse "Edit|Write" __wide__
  expect "[$SH] Y10 project matcher narrower than the plugin's → runs" RH_OK "$(run_rh "$SH" __wide__)"
  reset_proj; reg PostToolUse "Edit|Write|MultiEdit" __wide__
  expect "[$SH] Y10 same matcher → yields" "" "$(run_rh "$SH" __wide__)"

  # Y11. The plugin registers two events; the project covers one → run (a worktree on a branch from
  # before an event was added).
  reset_proj; reg PostToolUse Write __multi__
  expect "[$SH] Y11 project misses one of the plugin's events → runs" RH_OK "$(run_rh "$SH" __multi__)"
  reg PostToolUseFailure Write __multi__
  expect "[$SH] Y11 every plugin event covered → yields" "" "$(run_rh "$SH" __multi__)"

  # Y12. A plugin-only hook never yields by its own name, whatever the project registers.
  reset_proj; reg UserPromptSubmit - __plugin_only__
  expect "[$SH] Y12 plugin-only hook with a same-named project hook → runs" RH_OK "$(run_rh "$SH" __plugin_only__)"

  # Y13. A project script that shares the name but is not getff's copy → run. getff's copy needs
  # BOTH the line-2 header and a delivery marker; each half is checked on its own.
  reset_proj; reg UserPromptSubmit - __target__
  printf '#!/usr/bin/env bash\n# my own hook\necho MINE\n' > "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] Y13 same-named foreign project script → runs" RH_OK "$(run_rh "$SH" __target__)"
  printf '#!/usr/bin/env bash\n# __target__.sh — my own hook\necho MINE\n' > "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] Y13 getff-style header but no delivery marker → runs" RH_OK "$(run_rh "$SH" __target__)"
  printf '#!/usr/bin/env bash\n# my own hook\n# @dual-pair: elsewhere\necho MINE\n' > "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] Y13 delivery marker but no getff header on line 2 → runs" RH_OK "$(run_rh "$SH" __target__)"
  getff_proj __target__

  # Y14. A registration that throws the project copy's output away, or runs it after another
  # command, does not carry the hook.
  reset_proj; reg UserPromptSubmit - __target__ 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh" >/dev/null 2>&1 || true'
  expect "[$SH] Y14 command discards the project copy's output → runs" RH_OK "$(run_rh "$SH" __target__)"
  reset_proj; reg UserPromptSubmit - __target__ 'cd /nonexistent && bash "$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh"'
  expect "[$SH] Y14 command runs the project copy after another command → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y15. A cwd-relative command may resolve elsewhere than the checked path → run.
  reset_proj; reg UserPromptSubmit - __target__ 'bash .claude/hooks/__target__.sh'
  expect "[$SH] Y15 cwd-relative command → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y16. GETFF_PLUGIN_NO_YIELD=1 forces the plugin copy to run (hosts that load fewer setting sources).
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(payload | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR GETFF_PLUGIN_NO_YIELD=1 CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] Y16 GETFF_PLUGIN_NO_YIELD=1 → runs" RH_OK "$OUT"

  # Y17. A conditional project registration (`if`) fires on a subset of calls → run.
  reset_proj; reg UserPromptSubmit - __target__
  jq '.hooks.UserPromptSubmit[0].hooks[0].if = "Bash(git *)"' "$PROJ/.claude/settings.json" > "$TMPD/s.tmp" \
    && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.json"
  expect "[$SH] Y17 conditional project registration → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y19. Only the plugin's own source checkout yields. A consumer project's copy was frozen at
  # install (setup.d/10-skills.sh copy_safe) and may be older than this one → run.
  reset_proj; reg UserPromptSubmit - __target__; rm -rf "$PROJ/plugin"
  expect "[$SH] Y19 consumer project (ships no plugin) → runs" RH_OK "$(run_rh "$SH" __target__)"
  src_checkout; printf '{"name":"other-plugin"}\n' > "$PROJ/plugin/.claude-plugin/plugin.json"
  expect "[$SH] Y19 project ships a different plugin → runs" RH_OK "$(run_rh "$SH" __target__)"
  src_checkout; rm "$PROJ/plugin/hooks/__target__"
  expect "[$SH] Y19 project's plugin tree lacks this hook → runs" RH_OK "$(run_rh "$SH" __target__)"
  src_checkout
  expect "[$SH] Y19 source checkout → yields" "" "$(run_rh "$SH" __target__)"

  # Y20. A handler field that changes when or how the project copy runs → run. Only
  # statusMessage (the spinner text) leaves execution unchanged.
  for field in '.async = true' '.timeout = 1' '.type = "prompt"' 'del(.type)' '.shell = "powershell"'; do
    reset_proj; reg UserPromptSubmit - __target__
    jq ".hooks.UserPromptSubmit[0].hooks[0] |= ($field)" "$PROJ/.claude/settings.json" > "$TMPD/s.tmp" \
      && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.json"
    expect "[$SH] Y20 project handler with $field → runs" RH_OK "$(run_rh "$SH" __target__)"
  done
  reset_proj; reg UserPromptSubmit - __target__
  jq '.hooks.UserPromptSubmit[0].hooks[0].statusMessage = "loading"' "$PROJ/.claude/settings.json" > "$TMPD/s.tmp" \
    && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.json"
  expect "[$SH] Y20 project handler with only a statusMessage → yields" "" "$(run_rh "$SH" __target__)"

  # Y21. Only the installer's exact command form counts. Another form can fail to start the project
  # copy (no quotes around a path with a space, no bash for a 644 script, sh = dash on Linux).
  for c in 'bash $CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh' \
    '"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh"' \
    'sh "$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh"' \
    'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh' \
    'bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/__target__.sh"'; do
    reset_proj; reg UserPromptSubmit - __target__ "$c"
    expect "[$SH] Y21 command $c → runs" RH_OK "$(run_rh "$SH" __target__)"
  done

  # Y22. The plugin registers this hook only with an extra argument the project copy never gets.
  reset_proj; reg UserPromptSubmit - __flagged__
  expect "[$SH] Y22 plugin registration carries an extra argument → runs" RH_OK "$(run_rh "$SH" __flagged__)"

  # Y23. A "*" matcher and an absent one mean the same thing.
  reset_proj; reg UserPromptSubmit '*' __target__
  expect "[$SH] Y23 project matcher \"*\" equals the plugin's absent matcher → yields" "" "$(run_rh "$SH" __target__)"

  # Y24. Shapes Claude Code does not read as a registration → run.
  reset_proj
  printf '{"hooks":{"UserPromptSubmit":{"entry":{"hooks":[{"type":"command","command":"bash \\"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh\\""}]}}}}\n' \
    > "$PROJ/.claude/settings.json"
  expect "[$SH] Y24 event entries keyed in an object, not a list → runs" RH_OK "$(run_rh "$SH" __target__)"
  reset_proj; reg UserPromptSubmit - __target__; printf '{}\n' >> "$PROJ/.claude/settings.json"
  expect "[$SH] Y24 settings.json holds two JSON values → runs" RH_OK "$(run_rh "$SH" __target__)"

  # Y25. Two manifests without a name do not name the same plugin.
  reset_proj; reg UserPromptSubmit - __target__
  printf '{}\n' > "$PROJ/plugin/.claude-plugin/plugin.json"; printf '{}\n' > "$TMPROOT/.claude-plugin/plugin.json"
  expect "[$SH] Y25 neither manifest names a plugin → runs" RH_OK "$(run_rh "$SH" __target__)"
  printf '{"name":"getff"}\n' > "$TMPROOT/.claude-plugin/plugin.json"; src_checkout

  # Y26. The session's directory decides whose settings Claude Code runs. After EnterWorktree or
  # /cd it runs only the new directory's settings, with no fallback to a parent directory, while
  # CLAUDE_PROJECT_DIR stays at the start root. Only the payload's `cwd` follows the session, and
  # a Bash cd moves it too. A cwd in a subdirectory cannot tell a Bash cd (project settings kept)
  # from /cd (project settings gone), so only the project root itself yields.
  reset_proj; reg UserPromptSubmit - __target__
  mkdir -p "$PROJ/src/deep" "$PROJ/.claude/worktrees/wt/.claude" "$TMPROOT/elsewhere"
  printf 'gitdir: /nonexistent\n' > "$PROJ/.claude/worktrees/wt/.git"
  echo '{}' > "$PROJ/.claude/worktrees/wt/.claude/settings.json"
  ln -s "$PROJ" "$TMPROOT/link-to-root"; ln -s "$PROJ/src" "$TMPROOT/elsewhere/link-to-src"
  expect "[$SH] Y26 cwd at the project root → yields" "" "$(RH_IN=$(payload "$PROJ") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd at the project root through a symlink → yields" "" \
    "$(RH_IN=$(payload "$TMPROOT/link-to-root") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd in a subdirectory (/cd there, or a Bash cd) → runs" RH_OK \
    "$(RH_IN=$(payload "$PROJ/src/deep") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd in a worktree of the project (EnterWorktree) → runs" RH_OK \
    "$(RH_IN=$(payload "$PROJ/.claude/worktrees/wt") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd outside the project → runs" RH_OK "$(RH_IN=$(payload "$TMPROOT/elsewhere") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd outside the project, linked to a subdirectory → runs" RH_OK \
    "$(RH_IN=$(payload "$TMPROOT/elsewhere/link-to-src") run_rh "$SH" __target__)"
  expect "[$SH] Y26 cwd that does not exist → runs" RH_OK "$(RH_IN=$(payload "$PROJ/gone") run_rh "$SH" __target__)"
  expect "[$SH] Y26 payload without a cwd → runs" RH_OK "$(RH_IN='{"hook_event_name":"UserPromptSubmit"}' run_rh "$SH" __target__)"
  expect "[$SH] Y26 payload that is not an object → runs" RH_OK "$(RH_IN='[]' run_rh "$SH" __target__)"
  expect "[$SH] Y26 two payloads, both at the root → runs" RH_OK "$(RH_IN="$(payload) $(payload)" run_rh "$SH" __target__)"
  expect "[$SH] Y26 no payload at all → runs" RH_OK "$(RH_IN='' run_rh "$SH" __target__)"

  # Y27. When the cwd check keeps this copy running, the hook still receives the whole payload,
  # byte for byte, trailing newlines included, and nothing is written to disk on the way.
  cp "$TMPD/__target__" "$TMPD/__target__.keep"
  printf '# AUTO-GENERATED from .claude/hooks/__target__.sh\ncksum\n' > "$TMPD/__target__"
  IN="$(payload "$TMPROOT/elsewhere"; printf 'second line\n\nx')"; IN="${IN%x}"
  expect "[$SH] Y27 the running copy reads the payload byte for byte" "$(printf '%s' "$IN" | cksum)" \
    "$(RH_IN=$IN run_rh "$SH" __target__)"
  # Y28. The running copy's exit code reaches Claude Code unchanged (2 is its blocking code).
  printf '# AUTO-GENERATED from .claude/hooks/__target__.sh\ncat >/dev/null; exit 2\n' > "$TMPD/__target__"
  RH_IN=$(payload "$TMPROOT/elsewhere") run_rh "$SH" __target__ >/dev/null; rc=$?
  expect "[$SH] Y28 the running copy's exit code 2 is kept" 2 "$rc"
  mv "$TMPD/__target__.keep" "$TMPD/__target__"
  rm -rf "$PROJ/src" "$PROJ/.claude/worktrees" "$TMPROOT/elsewhere" "$TMPROOT/link-to-root"
done
left=$(find "$HOOKTMP" -type f | wc -l | tr -d ' ')
expect "Y27 nothing written to TMPDIR" 0 "$left"

# Y18. No hooks.json beside the dispatcher → the plugin's own registrations are unknown → run.
NOHJ="$TMPD/nohooksjson"; mkdir -p "$NOHJ"; cp "$RH" "$NOHJ/run-hook.cmd"; cp "$TMPD/__target__" "$NOHJ/"
mkdir -p "$TMPD/.claude-plugin"; printf '{"name":"getff"}\n' > "$TMPD/.claude-plugin/plugin.json"
reset_proj; reg UserPromptSubmit - __target__
OUT=$(payload | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
  XDG_CONFIG_HOME="$EMPTY_XDG" bash "$NOHJ/run-hook.cmd" __target__ 2>/dev/null)
expect "Y18 no hooks.json beside the dispatcher → runs" RH_OK "$OUT"

# Y9. Without jq the registry cannot be told apart from permission strings → run, never guess.
NOJQ="$TMPD/nojq-bin"; mkdir -p "$NOJQ"
for t in bash sh dirname head tr grep sed cat env; do
  p=$(command -v "$t") && ln -sf "$p" "$NOJQ/$t"
done
reset_proj; reg UserPromptSubmit - __target__
OUT=$(payload | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$NOJQ" CLAUDE_PROJECT_DIR="$PROJ" \
  XDG_CONFIG_HOME="$EMPTY_XDG" "$NOJQ/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
expect "Y9 no jq on PATH → runs" RH_OK "$OUT"

# ── Real tree: the framework repo's own settings.json against the shipped plugin/hooks ─────────
# R1 (class sweep, stubs — no real hook executes): every plugin hook the repo registers as
# `.claude/hooks/<name>.sh` must yield; every other plugin hook must still fire, except those whose
# @plugin-yields-to target the repo registers. Stubs carry the real file's comment lines, so the
# source declaration and markers are tested as shipped; the real hooks.json and manifest sit beside
# them, as in an installed plugin.
STUBS="$TMPD/stubs"; mkdir -p "$STUBS"; cp "$RH" "$STUBS/run-hook.cmd"; cp "$REPO_ROOT/plugin/hooks/hooks.json" "$STUBS/"
cp "$REPO_ROOT/plugin/.claude-plugin/plugin.json" "$TMPD/.claude-plugin/plugin.json"
PLUGIN_NAMES=$(jq -r '[.hooks[][].hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n] | unique[]' \
  "$REPO_ROOT/plugin/hooks/hooks.json")
PROJECT_NAMES=$(jq -r '[.hooks[][].hooks[].command | capture("\\.claude/hooks/(?<n>[^ ]+)\\.sh").n] | unique[]' \
  "$REPO_ROOT/.claude/settings.json")
yielded=0; still=0
for n in $PLUGIN_NAMES; do
  { grep '^#' "$REPO_ROOT/plugin/hooks/$n"; echo "echo RAN"; } > "$STUBS/$n"
  OUT=$(payload "$REPO_ROOT" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru \
    CLAUDE_PROJECT_DIR="$REPO_ROOT" XDG_CONFIG_HOME="$EMPTY_XDG" bash "$STUBS/run-hook.cmd" "$n" 2>/dev/null)
  target=$(sed -n 's/^# @plugin-yields-to:[[:space:]]*//p' "$REPO_ROOT/plugin/hooks/$n" | head -n 1)
  if printf '%s\n' "$PROJECT_NAMES" | grep -qx "$n"; then
    [ -z "$OUT" ] && yielded=$((yielded+1)) || bad "R1 $n: the repo runs its own copy, the plugin copy fired too"
  elif [ -n "$target" ] && printf '%s\n' "$PROJECT_NAMES" | grep -qx "$target"; then
    expect "R1 $n yields to the repo's $target (@plugin-yields-to)" "" "$OUT"
  else
    [ "$OUT" = "RAN" ] && still=$((still+1)) || bad "R1 $n: the repo does not run it, yet the plugin copy was silenced"
  fi
done
[ "$yielded" -ge 10 ] && ok "R1 $yielded plugin hooks shared with .claude/settings.json all yield" \
  || bad "R1 only $yielded shared hooks yielded (vacuous or broken sweep)"
[ "$still" -ge 3 ] && ok "R1 $still plugin hooks the repo does not run all still fire" \
  || bad "R1 only $still plugin-only hooks checked (vacuous sweep)"

# R2 (end to end, real hooks): one session start in the framework repo — the repo's own
# injector plus every plugin SessionStart hook whose matcher covers `startup`, through the shipped
# run-hook.cmd — carries the digest once, the language line once, the project digest once, and
# exactly one invariants line. All three injectors fire on SessionStart, none per prompt.
PROMPT=$( {
  CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=ru bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh"
  for n in $(jq -r '.hooks.SessionStart[] | select((.matcher // "startup") | split("|") | index("startup"))
      | .hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n' "$REPO_ROOT/plugin/hooks/hooks.json"); do
    payload "$REPO_ROOT" | jq -c '.hook_event_name = "SessionStart" | .source = "startup"' \
      | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD \
      CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=ru XDG_CONFIG_HOME="$EMPTY_XDG" bash "$RH" "$n"
  done
} 2>/dev/null )
c_digest=$(printf '%s\n' "$PROMPT" | grep -c '^\[session-bootstrap digest')
c_lang=$(printf '%s\n' "$PROMPT" | grep -c '^\[output-language\]')
c_proj=$(printf '%s\n' "$PROMPT" | grep -c '^Project: ')
c_inv=$(printf '%s\n' "$PROMPT" | grep -c '^Invariants:')
expect "R2 session-bootstrap digest injected once" 1 "$c_digest"
expect "R2 output-language line injected once" 1 "$c_lang"
expect "R2 project digest (plugin-only hook) still injected once" 1 "$c_proj"
expect "R2 exactly one invariants line reaches the prompt" 1 "$c_inv"

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
