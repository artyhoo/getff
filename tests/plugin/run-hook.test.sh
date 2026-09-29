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
# run_rh <shell> <hook> — dispatch with a clean language environment (no pin, no fallback file).
run_rh() {
  local sh="$1"; shift
  env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$sh" "$TMPD/run-hook.cmd" "$@" 2>/dev/null
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
  OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$TMPD/xdg" "$SH" "$TMPD/run-hook.cmd" __lang_probe__ 2>/dev/null)
  expect "[$SH] Y8 pin from the fallback file only → runs" LANG=ru "$OUT"
  OUT=$(env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$PROJ" \
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
  OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR GETFF_PLUGIN_NO_YIELD=1 CLAUDE_PROJECT_DIR="$PROJ" \
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
done

# Y18. No hooks.json beside the dispatcher → the plugin's own registrations are unknown → run.
NOHJ="$TMPD/nohooksjson"; mkdir -p "$NOHJ"; cp "$RH" "$NOHJ/run-hook.cmd"; cp "$TMPD/__target__" "$NOHJ/"
mkdir -p "$TMPD/.claude-plugin"; printf '{"name":"getff"}\n' > "$TMPD/.claude-plugin/plugin.json"
reset_proj; reg UserPromptSubmit - __target__
OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD CLAUDE_PROJECT_DIR="$PROJ" \
  XDG_CONFIG_HOME="$EMPTY_XDG" bash "$NOHJ/run-hook.cmd" __target__ 2>/dev/null)
expect "Y18 no hooks.json beside the dispatcher → runs" RH_OK "$OUT"

# Y9. Without jq the registry cannot be told apart from permission strings → run, never guess.
NOJQ="$TMPD/nojq-bin"; mkdir -p "$NOJQ"
for t in bash sh dirname head tr grep sed cat env; do
  p=$(command -v "$t") && ln -sf "$p" "$NOJQ/$t"
done
reset_proj; reg UserPromptSubmit - __target__
OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$NOJQ" CLAUDE_PROJECT_DIR="$PROJ" \
  XDG_CONFIG_HOME="$EMPTY_XDG" "$NOJQ/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
expect "Y9 no jq on PATH → runs" RH_OK "$OUT"

# ── C: consumer yield — only to a byte-identical installed copy (spec 2026-09-28 D3) ──
# A consumer ships no plugin. Every C arm after C1 differs from C1 by one input and must run.
mkdir -p "$TMPD/lib" "$PROJ/.claude/hooks/lang"
cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$TMPD/lib/source-hash.sh"
printf 'L=en\n' > "$PROJ/.claude/hooks/lang/en.sh"; printf 'L=ru\n' > "$PROJ/.claude/hooks/lang/ru.sh"
pin_manifest() {   # the plugin was built from exactly the project's current copies
  ( . "$TMPD/lib/source-hash.sh"; H="$PROJ/.claude/hooks"
    printf '%s  %s\n' "$(getff_path_hash "$H" __target__.sh)" __target__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" __deps__.sh)" __deps__.sh
    printf '%s  %s\n' "$(getff_path_hash "$H" lang/)" __deps__.sh:lang/
  ) > "$TMPD/lib/source-sha256.txt"
}
rm -rf "$PROJ/plugin"
for SH in $SHELLS; do
  getff_proj __target__; getff_proj __deps__; pin_manifest
  reset_proj; reg UserPromptSubmit - __target__; reg UserPromptSubmit - __deps__
  expect "[$SH] C1 installed copy byte-identical → yields" "" "$(run_rh "$SH" __target__)"
  expect "[$SH] C1 identical copy and identical lang/ → yields" "" "$(run_rh "$SH" __deps__)"
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
done
# C8. No hashing tool → runs; each tool alone (macOS/Git Bash shapes) → yields. The PATH holds
# every other tool run-hook.cmd and lib/source-hash.sh call.
for have in none sha256sum shasum; do
  B="$TMPD/bin-$have"; mkdir -p "$B"
  for t in bash sh dirname head tr grep sed cat env jq cut sort; do
    p=$(command -v "$t") && ln -sf "$p" "$B/$t"
  done
  if [ "$have" != none ]; then p=$(command -v "$have") || continue; ln -sf "$p" "$B/$have"; fi
  reset_proj; reg UserPromptSubmit - __target__
  OUT=$(env -u AIF_HOOK_LANG -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD PATH="$B" CLAUDE_PROJECT_DIR="$PROJ" \
    XDG_CONFIG_HOME="$EMPTY_XDG" "$B/bash" "$TMPD/run-hook.cmd" __target__ 2>/dev/null)
  if [ "$have" = none ]; then expect "C8 no sha256sum, no shasum → runs" RH_OK "$OUT"
  else expect "C8 only $have on PATH → yields" "" "$OUT"; fi
done

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
  OUT=$(env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$REPO_ROOT" \
    XDG_CONFIG_HOME="$EMPTY_XDG" bash "$STUBS/run-hook.cmd" "$n" </dev/null 2>/dev/null)
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
# except deps-hash-check, whose cwd-relative registration never counts (spec D4).
mkdir -p "$STUBS/lib"; cp "$REPO_ROOT/plugin/hooks/lib/source-hash.sh" "$REPO_ROOT/plugin/hooks/lib/source-sha256.txt" "$STUBS/lib/"
CONS="$TMPD/consumer"; mkdir -p "$CONS/.claude/hooks/lib"
cp -R "$REPO_ROOT/.claude/hooks/lang" "$CONS/.claude/hooks/"
cp "$REPO_ROOT/.claude/hooks/lib/residue-dir.sh" "$CONS/.claude/hooks/lib/"
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
cp "$REPO_ROOT/packages/core/hooks/deps-hash-check.sh" "$CONS/.claude/hooks/deps-hash-check.sh"
creg UserPromptSubmit - "$(sed -n 's/^HOOK_CMD="\(.*\)"$/\1/p' "$REPO_ROOT/setup.d/10-skills.sh")"
silenced=0
for nm in $INSTALLED deps-hash-check; do
  [ -f "$STUBS/$nm" ] || continue
  OUT=$(env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD AIF_HOOK_LANG=ru CLAUDE_PROJECT_DIR="$CONS" \
    XDG_CONFIG_HOME="$EMPTY_XDG" bash "$STUBS/run-hook.cmd" "$nm" </dev/null 2>/dev/null)
  if [ "$nm" = deps-hash-check ]; then expect "CR1 deps-hash-check (cwd-relative registration) still fires" RAN "$OUT"
  elif [ -z "$OUT" ]; then silenced=$((silenced+1))
  else bad "CR1 $nm: the consumer runs an identical copy, yet the plugin copy fired too"; fi
done
[ "$silenced" -ge 6 ] && ok "CR1 $silenced installer hooks silence their plugin copies" \
  || bad "CR1 only $silenced installer hooks silenced (vacuous or broken sweep)"

# R2 (end to end, real hooks): one UserPromptSubmit in the framework repo — the repo's own
# injector plus every plugin UserPromptSubmit hook through the shipped run-hook.cmd — carries the
# digest once, the language line once, the project digest once, and exactly one invariants line.
PROMPT=$( {
  CLAUDE_PROJECT_DIR="$REPO_ROOT" AIF_HOOK_LANG=ru bash "$REPO_ROOT/.claude/hooks/inject-session-bootstrap.sh"
  for n in $(jq -r '.hooks.UserPromptSubmit[].hooks[].command | capture("run-hook\\.cmd\" (?<n>[^ ]+)").n' \
      "$REPO_ROOT/plugin/hooks/hooks.json"); do
    [ "$n" = deps-hash-check ] && continue   # writes a cache file; its yield is covered by R1
    echo '{"hook_event_name":"UserPromptSubmit"}' | env -u ZCODE_PROJECT_DIR -u GETFF_PLUGIN_NO_YIELD \
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
