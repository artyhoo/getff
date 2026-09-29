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

# ── H: plugin/hooks/lib/source-hash.sh (spec 2026-09-28 D1-D2) ──────────────────
HD="$TMPROOT/hash"; mkdir -p "$HD/lang"
printf 'a\n' > "$HD/h.sh"; printf 'en\n' > "$HD/lang/en.sh"; printf 'ru\n' > "$HD/lang/ru.sh"
for SH in bash sh $(command -v dash >/dev/null 2>&1 && echo dash); do
  hash_of() { "$SH" -c '. "$1"; getff_path_hash "$2" "$3"' _ "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$HD" "$1"; }
  f1=$(hash_of h.sh); d1=$(hash_of lang/)
  [ "${#f1}" -eq 64 ] && ok "[$SH] H1 file hash is 64 hex chars" || bad "[$SH] H1 got '$f1'"
  printf 'de\n' > "$HD/lang/de.sh"; d2=$(hash_of lang/); rm "$HD/lang/de.sh"
  [ -n "$d1" ] && [ "$d1" != "$d2" ] && ok "[$SH] H2 an added file changes the directory hash" || bad "[$SH] H2 '$d1' '$d2'"
  [ "$(hash_of lang/)" = "$d1" ] && ok "[$SH] H3 directory hash is stable" || bad "[$SH] H3 unstable"
  hash_of ../x >/dev/null 2>&1 && bad "[$SH] H4 '..' accepted" || ok "[$SH] H4 '..' refused"
  hash_of missing.sh >/dev/null 2>&1 && bad "[$SH] H5 missing file hashed" || ok "[$SH] H5 missing file refused"
  printf '%s  h.sh\n%s  h.sh:lang/\n' "$f1" "$d1" > "$HD/m.txt"
  match() { "$SH" -c '. "$1"; getff_closure_matches "$2" "$3" "$4"' _ "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$HD/m.txt" "$HD" "$1"; }
  match h && ok "[$SH] H6 identical closure matches" || bad "[$SH] H6 no match"
  printf 'b\n' > "$HD/h.sh"; match h && bad "[$SH] H7 changed file matched" || ok "[$SH] H7 changed file refused"
  printf 'a\n' > "$HD/h.sh"; match other && bad "[$SH] H8 absent name matched" || ok "[$SH] H8 absent name refused"
  printf '%s  h.sh:lang/\n' "$d1" > "$HD/m.txt"; match h && bad "[$SH] H9 no main line matched" || ok "[$SH] H9 main line required"
  hash_of /abs >/dev/null 2>&1 && bad "[$SH] H10 absolute rel accepted" || ok "[$SH] H10 absolute rel refused"
  "$SH" -c '. "$1"; getff_closure_matches "$2" "$3" "$4"' _ "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" \
    "$HD/no-such-manifest.txt" "$HD" h >/dev/null 2>&1 \
    && bad "[$SH] H11 missing manifest file matched" || ok "[$SH] H11 missing manifest file refused"
done

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
# The consumer liveness claim (spec D12 H1) scans the user-level settings for a hook timeout; an
# empty CLAUDE_CONFIG_DIR keeps the machine running the suite out of every arm.
EMPTY_CFG="$TMPD/empty-cfg"; mkdir -p "$EMPTY_CFG"
PLUGIN_CMD='\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\"'
# The plugin's registrations, next to the dispatcher as in a real plugin. __wide__ carries a
# three-tool matcher, __multi__ two events — the shapes a project registration can fall short of.
# __flagged__ is registered only with an extra argument the project copy would never receive.
cat > "$TMPD/hooks.json" <<EOF
{"hooks":{
  "UserPromptSubmit":[{"hooks":[
    {"type":"command","command":"$PLUGIN_CMD __target__"},
    {"type":"command","command":"$PLUGIN_CMD __deps__"},
    {"type":"command","command":"$PLUGIN_CMD __lang_probe__"},
    {"type":"command","command":"$PLUGIN_CMD __ghost__"},
    {"type":"command","command":"$PLUGIN_CMD __marked__"},
    {"type":"command","command":"$PLUGIN_CMD __plugin_only__"},
    {"type":"command","command":"$PLUGIN_CMD __cyield__"},
    {"type":"command","command":"$PLUGIN_CMD __flagged__ --flag"}]}],
  "PostToolUse":[
    {"matcher":"Edit|Write|MultiEdit","hooks":[{"type":"command","command":"$PLUGIN_CMD __wide__"}]},
    {"matcher":"Write","hooks":[{"type":"command","command":"$PLUGIN_CMD __multi__"}]}],
  "PostToolUseFailure":[
    {"matcher":"Write","hooks":[{"type":"command","command":"$PLUGIN_CMD __multi__"}]}]
}}
EOF
jq -e . "$TMPD/hooks.json" >/dev/null || bad "fixture hooks.json is not valid JSON"
for n in __ghost__ __wide__ __multi__ __plugin_only__ __flagged__ __deps__; do
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
    CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
    "$sh" "$TMPD/run-hook.cmd" "$@" 2>/dev/null
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

  # Y19. Only the plugin's own source checkout yields by name alone, and no source-hash manifest
  # beside the dispatcher → a consumer keeps both copies (see C1-C8).
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

# ── C: consumer yield — only to a byte-identical installed copy (spec 2026-09-28 D3) ──
# A consumer ships no plugin. Every C arm after C1 differs from C1 by one input and must run.
mkdir -p "$TMPD/lib" "$PROJ/.claude/hooks/lang"
cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$TMPD/lib/source-hash.sh"
cp "$REPO_ROOT/plugin/hooks/lib/live-claim.sh" "$TMPD/lib/live-claim.sh"
printf 'L=en\n' > "$PROJ/.claude/hooks/lang/en.sh"; printf 'L=ru\n' > "$PROJ/.claude/hooks/lang/ru.sh"
pin_manifest() {   # the plugin was built from exactly the project's current copies
  ( . "$TMPD/lib/source-hash.sh"; H="$PROJ/.claude/hooks"
    printf '%s  %s\n' "$(getff_path_hash "$H" __target__.sh)" __target__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" __deps__.sh)" __deps__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" lang/)" __deps__.sh:lang/
  ) > "$TMPD/lib/source-sha256.txt"
}
# Under D12 a consumer yield also needs proof that the project copy started for THIS event: the
# marker its prelude (.claude/hooks/lib/hook-live.sh) writes. Every C arm that expects a yield
# plants that marker first; every arm that expects a run needs none.
LIVE="$HOOKTMP/getff-hook-live.$(id -u)"
# plant <hook-name> [<age-seconds>] [<payload>] — the marker the project copy's prelude writes for
# <payload> (default: the payload run_rh feeds), keyed by the plugin lib's own key function.
plant() {
  local p="${3-$(payload)}" sid k d
  sid=$(printf '%s' "$p" | jq -r '.session_id')
  k=$(printf '%s' "$p" | bash -c '. "$1"; getff_live_key_of "$2"' _ "$REPO_ROOT/plugin/hooks/lib/live-claim.sh" "$1") \
    || { bad "plant: no key for $1"; return 1; }
  d="$LIVE/$sid"
  [ -d "$LIVE" ] || mkdir -m 700 "$LIVE"; [ -d "$d" ] || mkdir -m 700 "$d"
  # The last field is the writer's pid; two real project runs never share one, so two plants must not.
  : > "$d/$k.$(( $(date +%s) - ${2:-0} )).$$$RANDOM"
}
rm -rf "$PROJ/plugin"
for SH in $SHELLS; do
  rm -rf "$LIVE"
  getff_proj __target__; getff_proj __deps__; pin_manifest
  reset_proj; reg UserPromptSubmit - __target__; reg UserPromptSubmit - __deps__
  plant __target__
  expect "[$SH] C1 installed copy byte-identical → yields" "" "$(run_rh "$SH" __target__)"
  plant __deps__
  expect "[$SH] C1 identical copy and identical lang/ → yields" "" "$(run_rh "$SH" __deps__)"
  # C-cwd (Task 2 amendment A4): C1 inputs and a planted marker, but the session sits elsewhere.
  mkdir -p "$TMPROOT/elsewhere2"
  plant __target__ 0 "$(payload "$TMPROOT/elsewhere2")"
  expect "[$SH] C-cwd C1 inputs + marker, payload cwd outside the project → runs" RH_OK \
    "$(RH_IN=$(payload "$TMPROOT/elsewhere2") run_rh "$SH" __target__)"
  rm -rf "$LIVE"
  printf 'echo EDITED\n' >> "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] C2 installed copy differs (older/newer/edited) → runs" RH_OK "$(run_rh "$SH" __target__)"
  getff_proj __target__
  printf 'L=RU\n' > "$PROJ/.claude/hooks/lang/ru.sh"
  expect "[$SH] C3 dependency content differs → runs" RH_OK "$(run_rh "$SH" __deps__)"
  printf 'L=ru\n' > "$PROJ/.claude/hooks/lang/ru.sh"; printf 'L=de\n' > "$PROJ/.claude/hooks/lang/de.sh"
  expect "[$SH] C3 extra file in a declared directory → runs" RH_OK "$(run_rh "$SH" __deps__)"
  rm -f "$PROJ/.claude/hooks/lang/de.sh"; mv "$PROJ/.claude/hooks/lang" "$TMPD/lang.bak"
  expect "[$SH] C3 declared directory missing → runs" RH_OK "$(run_rh "$SH" __deps__)"
  mv "$TMPD/lang.bak" "$PROJ/.claude/hooks/lang"
  plant __deps__
  expect "[$SH] C3 restored → yields again" "" "$(run_rh "$SH" __deps__)"
  grep -v '  __target__\.sh$' "$TMPD/lib/source-sha256.txt" > "$TMPD/m.tmp"; mv "$TMPD/m.tmp" "$TMPD/lib/source-sha256.txt"
  expect "[$SH] C4 hook absent from the manifest → runs" RH_OK "$(run_rh "$SH" __target__)"
  pin_manifest; printf '0000  __target__.sh:../../x\n' >> "$TMPD/lib/source-sha256.txt"
  expect "[$SH] C5 manifest path escaping .claude/hooks → runs" RH_OK "$(run_rh "$SH" __target__)"
  pin_manifest
  reset_proj; reg UserPromptSubmit - __target__ 'bash .claude/hooks/__target__.sh'
  expect "[$SH] C6 cwd-relative registration (deps-hash-check form) → runs" RH_OK "$(run_rh "$SH" __target__)"
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(env -u AIF_HOOK_LANG -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" ZCODE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] C7 ZCode never yields to a project copy → runs" RH_OK "$OUT"

  # C9 (Important 1): a corrupt or unreadable lib/source-hash.sh must fail OPEN — the dispatcher
  # reaches the plain `exec bash` path (hook runs, rc 0), not a shell death from `.`'s
  # special-builtin syntax-error handling under dash.
  cp "$TMPD/lib/source-hash.sh" "$TMPD/lib/source-hash.sh.orig"
  printf 'if [ x\n' > "$TMPD/lib/source-hash.sh"   # truncated/garbled: syntax error
  OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] C9 corrupt lib/source-hash.sh (syntax error) → runs" RH_OK "$OUT"
  [ "$rc" -eq 0 ] || bad "[$SH] C9 corrupt lib/source-hash.sh: rc=$rc (expected 0, dispatcher must not die)"
  cp "$TMPD/lib/source-hash.sh.orig" "$TMPD/lib/source-hash.sh"; chmod 000 "$TMPD/lib/source-hash.sh"
  OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] C9 unreadable lib/source-hash.sh (mode 000) → runs" RH_OK "$OUT"
  [ "$rc" -eq 0 ] || bad "[$SH] C9 unreadable lib/source-hash.sh: rc=$rc (expected 0)"
  chmod 644 "$TMPD/lib/source-hash.sh"; rm -f "$TMPD/lib/source-hash.sh.orig"

  # C10 (Minor 1): consumer-mode `# @plugin-yields-to: <target>` — yields only when the TARGET's
  # installed copy is byte-identical per the manifest and registered in exact form; runs when the
  # target's installed copy has been edited.
  printf '# @plugin-yields-to: __target__\necho RH_CYIELD\n' > "$TMPD/__cyield__"
  # D-yt: a @plugin-yields-to hit claims the TARGET's marker; the dispatcher's own name does not count.
  rm -rf "$LIVE"; plant __cyield__
  expect "[$SH] D-yt @plugin-yields-to hit, only the dispatcher's own marker → runs" RH_CYIELD "$(run_rh "$SH" __cyield__)"
  rm -rf "$LIVE"; plant __target__
  expect "[$SH] C10 @plugin-yields-to target byte-identical & registered → yields" "" "$(run_rh "$SH" __cyield__)"
  printf 'echo EDITED\n' >> "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] C10 @plugin-yields-to target's installed copy edited → runs" RH_CYIELD "$(run_rh "$SH" __cyield__)"
  getff_proj __target__

  # C11 (Minor 2): a project that ships a plugin under a DIFFERENT name still falls through to
  # consumer mode (the source-mode name check fails, the elif branch evaluates normally).
  mkdir -p "$PROJ/plugin/.claude-plugin"
  printf '{"name":"other-plugin"}\n' > "$PROJ/plugin/.claude-plugin/plugin.json"
  plant __target__
  expect "[$SH] C11 foreign-named project plugin, identical installed copy → yields" "" "$(run_rh "$SH" __target__)"
  printf 'echo EDITED\n' >> "$PROJ/.claude/hooks/__target__.sh"
  expect "[$SH] C11 foreign-named project plugin, edited installed copy → runs" RH_OK "$(run_rh "$SH" __target__)"
  getff_proj __target__
  rm -rf "$PROJ/plugin" "$LIVE"
done

# ── D: liveness — a consumer yield needs a claimed marker for THIS event (spec D12) ────────────
# Fixture = C1 inputs (identical copy, exact registration, cwd at the root). Each arm varies one
# input of the marker protocol; only a fresh, trusted, same-event, same-session marker yields.
payload_sid() { jq -nc --arg cwd "$PROJ" --arg s "$1" '{session_id: $s, hook_event_name: "UserPromptSubmit", cwd: $cwd}'; }
for SH in $SHELLS; do
  getff_proj __target__; getff_proj __deps__; pin_manifest; reset_proj; reg UserPromptSubmit - __target__
  rm -rf "$LIVE"
  expect "[$SH] D1 conditions hold, no marker (project settings not loaded) → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __target__ 30
  expect "[$SH] D2 stale marker (30 s by its epoch) → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __target__ -30
  expect "[$SH] D2 marker from the future → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __other__
  expect "[$SH] D3 marker of another hook → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __target__ 0 "$(payload_sid s1 | jq -c '.prompt = "other event"')"
  expect "[$SH] D3 marker of another event (same hook, other payload) → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __target__
  expect "[$SH] D4 fresh marker → yields" "" "$(run_rh "$SH" __target__)"
  expect "[$SH] D5 the marker is claimed once; a second dispatch → runs" RH_OK "$(run_rh "$SH" __target__)"
  plant __target__; plant __target__
  expect "[$SH] D5 two markers (a Stop that fires twice) → first dispatch yields" "" "$(run_rh "$SH" __target__)"
  expect "[$SH] D5 two markers → second dispatch yields too" "" "$(run_rh "$SH" __target__)"
  expect "[$SH] D5 two markers → a third dispatch runs" RH_OK "$(run_rh "$SH" __target__)"
  rm -rf "$LIVE"; plant __target__ 0 "$(payload_sid s-other)"
  expect "[$SH] D6 marker from another session → runs" RH_OK "$(run_rh "$SH" __target__)"
  # D7. Each marker sits exactly where an unchecked session_id would resolve — the base itself for
  # a missing id, $HOOKTMP/s1 for "../s1" — keyed on the dispatched payload, so only the session-id
  # check stands between the arm and a yield (mutation-checked: deleting it turns both arms red).
  rm -rf "$LIVE"; mkdir -m 700 "$LIVE"; rm -rf "$HOOKTMP/s1"; mkdir -m 700 "$HOOKTMP/s1"
  p7=$(jq -nc --arg cwd "$PROJ" '{hook_event_name: "UserPromptSubmit", cwd: $cwd}')
  k=$(printf '%s' "$p7" | bash -c '. "$1"; getff_live_key_of __target__' _ "$REPO_ROOT/plugin/hooks/lib/live-claim.sh")
  : > "$LIVE/$k.$(date +%s).7$$"
  expect "[$SH] D7 payload without session_id (marker in the base dir) → runs" RH_OK "$(RH_IN=$p7 run_rh "$SH" __target__)"
  p7=$(payload_sid '../s1')
  k=$(printf '%s' "$p7" | bash -c '. "$1"; getff_live_key_of __target__' _ "$REPO_ROOT/plugin/hooks/lib/live-claim.sh")
  : > "$HOOKTMP/s1/$k.$(date +%s).7$$"
  expect "[$SH] D7 unsafe session_id ../s1 (marker at base/../s1) → runs" RH_OK "$(RH_IN=$p7 run_rh "$SH" __target__)"
  rm -rf "$HOOKTMP/s1" "$LIVE"

  # H1. A "timeout" in any settings file that names the project copy → the project copy may be
  # killed after this copy yielded → run. Paired: the same file without a timeout → yields.
  rm -rf "$LIVE"
  printf '{"hooks":{"UserPromptSubmit":[{"hooks":[{"type":"command","command":"bash \\"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh\\""}]}]}}\n' \
    > "$PROJ/.claude/settings.local.json"
  plant __target__
  expect "[$SH] D-timeout paired: settings.local.json names the hook, no timeout → yields" "" "$(run_rh "$SH" __target__)"
  jq '.hooks.UserPromptSubmit[0].hooks[0].timeout = 5' "$PROJ/.claude/settings.local.json" > "$TMPD/s.tmp" \
    && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.local.json"
  plant __target__
  expect "[$SH] D-timeout settings.local.json entry with \"timeout\": 5 → runs" RH_OK "$(run_rh "$SH" __target__)"
  # Final-review M-2: any field beyond type/command/statusMessage (async, if, shell, ...) on a
  # handler naming the project copy changes how that copy runs, exactly as run-hook.cmd's own
  # registration check treats settings.json → runs.
  for _fld in '.async = true' '.if = "Bash(git *)"' '.shell = "powershell"'; do
    jq "del(.hooks.UserPromptSubmit[0].hooks[0].timeout) | .hooks.UserPromptSubmit[0].hooks[0] |= ($_fld)" \
      "$PROJ/.claude/settings.local.json" > "$TMPD/s.tmp" && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.local.json"
    rm -rf "$LIVE"; plant __target__
    expect "[$SH] D-extra-field settings.local.json entry with ${_fld%% =*} → runs" RH_OK "$(run_rh "$SH" __target__)"
    jq "del(.hooks.UserPromptSubmit[0].hooks[0]${_fld%% =*})" "$PROJ/.claude/settings.local.json" > "$TMPD/s.tmp" \
      && mv "$TMPD/s.tmp" "$PROJ/.claude/settings.local.json"
  done
  # With jq, only a handler under .hooks that names the hook AND carries the timeout counts.
  printf '{"permissions":{"allow":["Bash(bash .claude/hooks/__target__.sh)"]},"statusLine":{"timeout":5},"hooks":{}}\n' \
    > "$PROJ/.claude/settings.local.json"; rm -rf "$LIVE"; plant __target__
  expect "[$SH] D-timeout hook named outside .hooks, \"timeout\" in another field → yields" "" "$(run_rh "$SH" __target__)"
  printf '{"hooks": ".claude/hooks/__target__.sh", "timeout": 5, \n' > "$PROJ/.claude/settings.local.json"
  rm -rf "$LIVE"; plant __target__
  expect "[$SH] D-timeout unparseable file naming the hook with a \"timeout\" → runs (coarse test)" RH_OK "$(run_rh "$SH" __target__)"
  jq -n '{hooks:{UserPromptSubmit:[{hooks:[{type:"command",command:"bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/__target__.sh\"",timeout:5}]}]}}' \
    > "$PROJ/.claude/settings.local.json"
  chmod 000 "$PROJ/.claude/settings.local.json"; rm -rf "$LIVE"; plant __target__
  expect "[$SH] D-timeout unreadable settings.local.json → runs" RH_OK "$(run_rh "$SH" __target__)"
  chmod 644 "$PROJ/.claude/settings.local.json"; mkdir -p "$TMPD/ucfg"; mv "$PROJ/.claude/settings.local.json" "$TMPD/ucfg/settings.json"
  rm -rf "$LIVE"; plant __target__
  OUT=$(printf '%s' "$(payload)" | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$TMPD/ucfg" "$SH" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  expect "[$SH] D-timeout user settings (CLAUDE_CONFIG_DIR) entry with a timeout → runs" RH_OK "$OUT"
  rm -rf "$TMPD/ucfg" "$LIVE"

  # H3. Markers count only inside directories this user owns that are not symlinks.
  mkdir -p "$TMPD/foreign"; ln -s "$TMPD/foreign" "$LIVE"; mkdir -m 700 "$TMPD/foreign/s1"
  k=$(printf '%s' "$(payload)" | bash -c '. "$1"; getff_live_key_of __target__' _ "$REPO_ROOT/plugin/hooks/lib/live-claim.sh")
  : > "$TMPD/foreign/s1/$k.$(date +%s).1"
  expect "[$SH] D-foreign symlinked base directory holding a fresh marker → runs" RH_OK "$(run_rh "$SH" __target__)"
  rm -f "$LIVE"; rm -rf "$TMPD/foreign"
  mkdir -m 700 "$LIVE"; mkdir -p "$TMPD/foreign-s1"; ln -s "$TMPD/foreign-s1" "$LIVE/s1"
  : > "$TMPD/foreign-s1/$k.$(date +%s).1"
  expect "[$SH] D-foreign symlinked session directory holding a fresh marker → runs" RH_OK "$(run_rh "$SH" __target__)"
  rm -rf "$LIVE" "$TMPD/foreign-s1"
  # A base or session dir that group or others can write lets another user plant a marker.
  for m in 770 707; do
    plant __target__; chmod "$m" "$LIVE"
    expect "[$SH] D-loose base directory mode $m holding a fresh marker → runs" RH_OK "$(run_rh "$SH" __target__)"
    rm -rf "$LIVE"; plant __target__; chmod "$m" "$LIVE/s1"
    expect "[$SH] D-loose session directory mode $m holding a fresh marker → runs" RH_OK "$(run_rh "$SH" __target__)"
    rm -rf "$LIVE"
  done

  # R6. lib/live-claim.sh is sourced fail-open: missing, corrupt or unreadable → runs, rc 0.
  cp "$TMPD/lib/live-claim.sh" "$TMPD/live-claim.keep"
  rm -f "$TMPD/lib/live-claim.sh"; plant __target__; OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] D-lib missing lib/live-claim.sh → runs" RH_OK "$OUT"; expect "[$SH] D-lib missing lib rc" 0 "$rc"
  printf 'getff_live_claim() { return 0; }\nif [ x\n' > "$TMPD/lib/live-claim.sh"; OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] D-lib corrupt lib/live-claim.sh (syntax error after a yes-sayer) → runs" RH_OK "$OUT"
  expect "[$SH] D-lib corrupt lib rc" 0 "$rc"
  cp "$TMPD/live-claim.keep" "$TMPD/lib/live-claim.sh"; chmod 000 "$TMPD/lib/live-claim.sh"; OUT=$(run_rh "$SH" __target__); rc=$?
  expect "[$SH] D-lib unreadable lib/live-claim.sh → runs" RH_OK "$OUT"; expect "[$SH] D-lib unreadable lib rc" 0 "$rc"
  chmod 644 "$TMPD/lib/live-claim.sh"; rm -f "$TMPD/live-claim.keep" "$LIVE"/s1/*
  expect "[$SH] D-lib restored lib, fresh marker → yields again" "" "$( plant __target__; run_rh "$SH" __target__ )"
  rm -rf "$LIVE"
done
# D-race. Two plugin copies, one marker → exactly one yields.
plant __target__
run_rh bash __target__ > "$TMPD/ra" & run_rh bash __target__ > "$TMPD/rb" & wait
[ "$(cat "$TMPD/ra" "$TMPD/rb" | grep -c RH_OK)" = 1 ] && ok "D-race two plugin copies, one marker → exactly one yields" \
  || bad "D-race got A='$(cat "$TMPD/ra")' B='$(cat "$TMPD/rb")'"
rm -rf "$LIVE"
# D-wait. No marker costs at most the bounded wait. Worst case by the code: the claim loop stops
# once `date +%s` reads two past its start second (<2 s), plus the dispatcher work before the wait
# and the hook itself, plus one second of integer rounding on t0/t1 — so ≤4 s, the D-clock bound.
t0=$(date +%s); run_rh bash __target__ >/dev/null; t1=$(date +%s)
[ $((t1 - t0)) -le 4 ] && ok "D-wait no marker costs ≤4 s ($((t1 - t0)) s)" || bad "D-wait took $((t1 - t0)) s"
# D-late. A marker that lands while the plugin copy waits is still claimed.
( sleep 0.1; plant __target__ ) & OUT=$(run_rh bash __target__); wait
expect "D-late marker written 100 ms into the wait → yields" "" "$OUT"
rm -rf "$LIVE"
# D-clock (H4). The wait is bounded by the wall clock, not by counting sleeps: with every sleep
# stretched to 1 s, a missing marker costs ≤3 s of wait (+ startup + rounding, bound 6), not 7+.
SHIM="$TMPD/slow-sleep"; mkdir -p "$SHIM"; printf '#!/bin/sh\nexec %s 1\n' "$(command -v sleep)" > "$SHIM/sleep"; chmod +x "$SHIM/sleep"
t0=$(date +%s)
OUT=$(printf '%s' "$(payload)" | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$SHIM:$PATH" \
  CLAUDE_PROJECT_DIR="$PROJ" XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
  bash "$TMPD/run-hook.cmd" __target__ 2>/dev/null); t1=$(date +%s)
[ "$OUT" = RH_OK ] && [ $((t1 - t0)) -le 6 ] && ok "D-clock slow sleep: wait ends by wall clock ($((t1 - t0)) s) → runs" \
  || bad "D-clock took $((t1 - t0)) s, out='$OUT'"

# C8. No hashing tool → runs; each tool alone (macOS/Git Bash shapes) → yields. The PATH holds
# every other tool run-hook.cmd and lib/source-hash.sh call. A missing sha256sum/shasum binary on
# the test machine must not let the arm pass without running at least one hashing-tool shape: it
# is recorded (SKIP line) and the closing assertion fails if neither shape ever ran.
ran_shapes=0
for have in none sha256sum shasum; do
  B="$TMPD/bin-$have"; mkdir -p "$B"
  for t in bash sh dirname head tr grep sed cat env jq cut sort date mv id rm sleep ls; do
    p=$(command -v "$t") && ln -sf "$p" "$B/$t"
  done
  if [ "$have" != none ]; then
    if ! p=$(command -v "$have"); then
      echo "  SKIP [$have] not installed on this machine — C8 shape not exercised"
      continue
    fi
    ln -sf "$p" "$B/$have"
  fi
  reset_proj; reg UserPromptSubmit - __target__; plant __target__
  # printf, not a bare `payload |`: the marker key covers the payload byte for byte, and jq's
  # trailing newline would be one byte more than what plant keyed.
  OUT=$(printf '%s' "$(payload)" | env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$B" CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
    "$B/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  rm -rf "$LIVE"
  if [ "$have" = none ]; then expect "C8 no sha256sum, no shasum → runs" RH_OK "$OUT"
  else
    expect "C8 only $have on PATH → yields" "" "$OUT"
    ran_shapes=$((ran_shapes+1))
  fi
done
[ "$ran_shapes" -ge 1 ] && ok "C8 at least one hashing-tool shape exercised ($ran_shapes/2)" \
  || bad "C8 neither sha256sum nor shasum available on this machine — arm passed vacuously"

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

# CR1 (real tree, consumer): the installer's hooks, copied from their installer sources and registered in
# the installer's own command forms (read from setup.d/10-skills.sh), silence their plugin copies —
# except deps-hash-check, whose cwd-relative registration never counts (spec D4). Since D12 a
# consumer yield also needs the project copy to have started for the same event, so each installed
# hook first RUNS for real with the payload (its prelude marks), then its plugin stub is dispatched.
mkdir -p "$STUBS/lib"; cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$REPO_ROOT/plugin/hooks/lib/source-sha256.txt" \
  "$REPO_ROOT/plugin/hooks/lib/live-claim.sh" "$STUBS/lib/"
CONS="$TMPD/consumer"; mkdir -p "$CONS/.claude/hooks/lib"
cp -R "$REPO_ROOT/.claude/hooks/lang" "$CONS/.claude/hooks/"
cp "$REPO_ROOT/.claude/hooks/lib/residue-dir.sh" "$REPO_ROOT/.claude/hooks/lib/hook-live.sh" "$CONS/.claude/hooks/lib/"
echo '{}' > "$CONS/.claude/settings.json"
creg() {   # creg <event> <matcher|-> <command>
  jq --arg e "$1" --arg m "$2" --arg c "$3" \
    '.hooks[$e] += [(if $m == "-" then {} else {matcher: $m} end) + {hooks: [{type: "command", command: $c}]}]' \
    "$CONS/.claude/settings.json" > "$TMPD/c.tmp" && mv "$TMPD/c.tmp" "$CONS/.claude/settings.json"
}
INSTALLED=''
while IFS='|' read -r ev cmd nm mt; do
  cp "$REPO_ROOT/.claude/hooks/$nm.sh" "$CONS/.claude/hooks/$nm.sh"
  case " $INSTALLED " in *" $nm "*) : ;; *) INSTALLED="$INSTALLED $nm" ;; esac   # one hook, several events
  creg "$ev" "${mt:--}" "$cmd"
done < <(sed -nE "s/.*register_cc_hook \"\\\$SETTINGS\" \"([A-Za-z]+)\" '([^']+)' \"([a-z0-9-]+)\"( \"([^\"]+)\")?.*/\1|\2|\3|\5/p" \
  "$REPO_ROOT/setup.d/10-skills.sh")
# The loader registers through register_imr_hooks (setup.d/lib.sh, three events), not a literal
# register_cc_hook line the parse above can read: run the real function on the consumer, so the
# sweep still counts the loader.
if grep -qE '^[[:space:]]*register_imr_hooks "\$SETTINGS"' "$REPO_ROOT/setup.d/10-skills.sh"; then
  cp "$REPO_ROOT/.claude/hooks/inject-matching-rule.sh" "$CONS/.claude/hooks/inject-matching-rule.sh"
  case " $INSTALLED " in *" inject-matching-rule "*) : ;; *) INSTALLED="$INSTALLED inject-matching-rule" ;; esac
  ( INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"
    register_imr_hooks "$CONS/.claude/settings.json" ) >/dev/null
fi
cp "$REPO_ROOT/packages/core/hooks/deps-hash-check.sh" "$CONS/.claude/hooks/deps-hash-check.sh"
creg UserPromptSubmit - "$(sed -n 's/^HOOK_CMD="\(.*\)"$/\1/p' "$REPO_ROOT/setup.d/10-skills.sh")"
# Strict: every hook `register_cc_hook` actually installed must be checked and must silence — a
# missing stub for an installer hook is a FAIL, not a skip (a stub disappearing from plugin/hooks/
# must not quietly shrink the population this sweep asserts over).
silenced=0; expected=0; rm -rf "$LIVE"
for nm in $INSTALLED; do
  expected=$((expected+1))
  if [ ! -f "$STUBS/$nm" ]; then
    bad "CR1 $nm: installed by setup.d/10-skills.sh but no plugin/hooks/$nm stub exists"
    continue
  fi
  # The consumer's real installed copy, as Claude Code would run it for this event.
  payload "$CONS" | env -u ZCODE_PROJECT_DIR -u AIF_HOOK_CHANNEL AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" bash "$CONS/.claude/hooks/$nm.sh" >/dev/null 2>&1
  OUT=$(payload "$CONS" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
    bash "$STUBS/run-hook.cmd" "$nm" 2>/dev/null)
  if [ -z "$OUT" ]; then silenced=$((silenced+1))
  else bad "CR1 $nm: the consumer runs an identical copy, yet the plugin copy fired too"; fi
done
if [ -f "$STUBS/deps-hash-check" ]; then
  OUT=$(payload "$CONS" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
    bash "$STUBS/run-hook.cmd" deps-hash-check 2>/dev/null)
  expect "CR1 deps-hash-check (cwd-relative registration) still fires" RAN "$OUT"
else
  bad "CR1 deps-hash-check: no plugin/hooks/deps-hash-check stub exists"
fi
[ "$expected" -gt 0 ] && [ "$silenced" -eq "$expected" ] \
  && ok "CR1 all $silenced installed hooks silence their plugin copies" \
  || bad "CR1 only $silenced of $expected installed hooks silenced (must equal $expected)"
[ "$expected" -ge 7 ] && ok "CR1 hard floor: $expected installer hooks checked (≥7)" \
  || bad "CR1 only $expected installer hooks checked (floor is 7 — sweep shrank)"
# CR2 (the D12 half of CR1): the same consumer, but the project copies never ran for this event
# (a host that did not load project settings) → every plugin copy fires.
rm -rf "$LIVE"; fired=0
for nm in $INSTALLED; do
  [ -f "$STUBS/$nm" ] || continue
  OUT=$(payload "$CONS" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" \
    bash "$STUBS/run-hook.cmd" "$nm" 2>/dev/null)
  if [ "$OUT" = RAN ]; then fired=$((fired+1)); else bad "CR2 $nm: no project run for this event, yet the plugin copy stayed silent"; fi
done
[ "$fired" -eq "$expected" ] && ok "CR2 project copies never ran → all $fired plugin copies fire" \
  || bad "CR2 only $fired of $expected plugin copies fired"

# CR3 (spec §Tests, real tree): one session start carries the output-language line exactly once
# — in the CR1 consumer (installed copies run first and mark, then every plugin SessionStart hook
# whose matcher covers `startup` runs through the SHIPPED run-hook.cmd), in a plugin-only project
# under Claude Code, and in a plugin-only project under ZCode. The per-part arms (C/D arms, arm (j))
# cannot see a composition that drops the line or doubles it; this count can. The line moved from
# UserPromptSubmit to SessionStart with #1925, so the sweep follows the event the injectors use.
# Counts occurrences, not line starts: on ZCode the adapter wraps the text in JSON additionalContext.
lang_lines() { grep -o '\[output-language\]' | wc -l | tr -d ' '; }
ss_payload() { payload "$1" | jq -c '.hook_event_name = "SessionStart" | .source = "startup"'; }
plugin_ss() { jq -r '.hooks.SessionStart[] | select((.matcher // "startup") | split("|") | index("startup"))
    | .hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n' "$REPO_ROOT/plugin/hooks/hooks.json"; }
cons_ss() { jq -r '.hooks.SessionStart[] | select((.matcher // "startup") | split("|") | index("startup"))
    | .hooks[].command | capture("\\.claude/hooks/(?<n>[a-z-]+)\\.sh").n' "$CONS/.claude/settings.json"; }
plugin_ss | grep -qx inject-output-language && cons_ss | grep -qx inject-output-language \
  && ok "CR3 sweep floor: inject-output-language is a startup SessionStart hook on both sides ($(plugin_ss | grep -c .) plugin, $(cons_ss | grep -c .) consumer)" \
  || bad "CR3 vacuous sweep: inject-output-language missing from plugin=[$(plugin_ss | tr '\n' ' ')] or consumer=[$(cons_ss | tr '\n' ' ')]"
rm -rf "$LIVE"
N=$( {
  for nm in $(cons_ss); do
    ss_payload "$CONS" | env -u ZCODE_PROJECT_DIR -u AIF_HOOK_CHANNEL AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
      TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" bash "$CONS/.claude/hooks/$nm.sh"
  done
  for n in $(plugin_ss); do
    ss_payload "$CONS" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
      XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" bash "$RH" "$n"
  done; } 2>/dev/null | lang_lines )
expect "CR3 consumer with installer + plugin: output-language line once" 1 "$N"
PONLY="$TMPD/plugin-only"; mkdir -p "$PONLY"; rm -rf "$LIVE"
N=$(for n in $(plugin_ss); do
  ss_payload "$PONLY" | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$PONLY" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" bash "$RH" "$n"
  done 2>/dev/null | lang_lines)
expect "CR3 plugin-only project (Claude Code): output-language line once" 1 "$N"
N=$(for n in $(plugin_ss); do
  ss_payload "$PONLY" | env -u CLAUDE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru ZCODE_PROJECT_DIR="$PONLY" \
    XDG_CONFIG_HOME="$EMPTY_XDG" TMPDIR="$HOOKTMP" CLAUDE_CONFIG_DIR="$EMPTY_CFG" bash "$RH" "$n"
  done 2>/dev/null | lang_lines)
expect "CR3 plugin-only project (ZCode): output-language line once" 1 "$N"

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
  own=$(AIF_HOOK_LANG=$L bash "$REPO_ROOT/.claude/hooks/inject-output-language.sh" </dev/null 2>/dev/null)   # the D12 prelude reads stdin
  twin=$(env -u ZCODE_PROJECT_DIR AIF_HOOK_LANG=$L bash "$REPO_ROOT/plugin/hooks/inject-output-language" 2>/dev/null)
  in_digest=$(CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=$L bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh" 2>/dev/null \
    | grep '^\[output-language\]')
  [ -n "$own" ] && [ "$own" = "$in_digest" ] && [ "$twin" = "$in_digest" ] \
    && ok "R3 [$L] the digest carries inject-output-language's exact line" \
    || bad "R3 [$L] language lines differ: hook='$own' twin='$twin' digest='$in_digest'"
done

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
