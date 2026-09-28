#!/usr/bin/env bash
# Firing test — a hook registered on BOTH channels (the project's .claude/settings.json and the
# getff plugin's hooks.json) must fire ONCE, and a plugin-only consumer must keep every hook.
#
# Why this exists (measured 2026-09-29): Claude Code merges plugin hooks with project hooks and
# runs every matching entry concurrently — there is no cross-source dedup (anthropics/claude-code
# #76297, closed not-planned). In the framework repo, which registers its own hook sources and has
# the plugin enabled, 14 registrations fired twice: the session-bootstrap digest arrived 2x per
# prompt and the [output-language] line 3x (44/44 prompts of transcript d06b5902); the Stop gate
# blocked twice in the same millisecond. The dedup lives in plugin/hooks/run-hook.cmd (the
# plugin's single dispatch point) and is opt-in: the plugin copy yields only when the project
# declares AIF_HOOK_DEDUP=project in its settings env AND registers the same hook for the same
# event+matcher. Without the declaration every plugin copy runs — a session that skipped the
# project's settings also skipped its hooks, so inferring from files on disk would lose hooks.
#
# The simulated dispatcher below mirrors the harness: it collects every entry registered for
# the event (project settings on CC only — ZCode does not run them), filters by matcher, and
# launches them concurrently, like CC does. Counts are taken on the merged output.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

command -v jq >/dev/null 2>&1 || { echo "  ✗ jq required by this test"; exit 1; }

TMPD=$(mktemp -d)
trap 'rm -rf "$TMPD"' EXIT

# ── Plugin fixture: the real plugin/hooks payload (wrapper + twins + hooks.json) ──────────
PLUGIN="$TMPD/plugin"
mkdir -p "$PLUGIN"
cp -R "$REPO_ROOT/plugin/hooks" "$PLUGIN/hooks"
# Probe twins for the mechanics arms. Each reports which channel ran it and a checksum of the raw
# stdin it received (cksum reads the bytes directly, so a lost or added trailing newline shows).
for pr in __probe__ __probe2__; do
  printf '#!/usr/bin/env bash\nprintf "PROBE-RAN plugin sum=%%s\\n" "$(cksum | cut -d" " -f1)"\n' > "$PLUGIN/hooks/$pr"
done
# __probe__ is registered once, with the plugin's usual matcher; __probe2__ twice under one event
# (two matchers, disjoint from __probe__'s so the two never fire together), the shape where a
# project may cover only one of the plugin's entries.
jq '.hooks.PostToolUse += [
      {matcher:"Edit|Write|MultiEdit",hooks:[{type:"command",command:"\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" __probe__"}]},
      {matcher:"NotebookEdit",hooks:[{type:"command",command:"\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" __probe2__"}]},
      {matcher:"Bash",hooks:[{type:"command",command:"\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" __probe2__"}]}]' \
  "$PLUGIN/hooks/hooks.json" > "$TMPD/hj" && mv "$TMPD/hj" "$PLUGIN/hooks/hooks.json"

# ── Project fixture builder ─────────────────────────────────────────────────────────────
# mk_project <dir> <Event;matcher;name>... — writes .claude/settings.json registering each hook
# in the form install.sh and the repo use, copies the hook script from the repo source (probes
# get their own project-side body), and authors a session-bootstrap digest block so
# inject-project-digest has something to inject. A source script that is missing fails the
# fixture loudly: a silent skip would let a scenario pass without the dedup ever being asked.
mk_project() {
  local dir="$1"; shift
  mkdir -p "$dir/.claude/hooks"
  printf '<!-- digest:start -->\nPROJECT-DIGEST-MARK\n<!-- digest:end -->\n' > "$dir/.claude/session-bootstrap.md"
  local settings='{"hooks":{}}' reg ev m n
  for reg in "$@"; do
    IFS=';' read -r ev m n <<<"$reg"
    settings=$(printf '%s' "$settings" | jq --arg ev "$ev" --arg m "$m" \
      --arg c "bash \"\$CLAUDE_PROJECT_DIR/.claude/hooks/$n.sh\"" \
      '.hooks[$ev] += [ (if $m == "" then {} else {matcher:$m} end) + {hooks:[{type:"command",command:$c}]} ]')
    case "$n" in
      __probe*) printf '#!/usr/bin/env bash\ncat >/dev/null; echo "PROBE-RAN project"\n' > "$dir/.claude/hooks/$n.sh" ;;
      *) cp "$REPO_ROOT/.claude/hooks/$n.sh" "$dir/.claude/hooks/$n.sh" || { echo "  ✗ fixture: no source hook $n"; exit 1; } ;;
    esac
  done
  printf '%s\n' "$settings" > "$dir/.claude/settings.json"
}
# set_cmd <dir> <new command> — rewrites every project command (for the path-anchoring arms).
set_cmd() {
  jq --arg c "$2" '(.hooks[][]?.hooks[]?.command) |= $c' "$1/.claude/settings.json" > "$TMPD/sj" \
    && mv "$TMPD/sj" "$1/.claude/settings.json"
}

# fire <project> <event> [tool_name] — prints the merged stdout of every hook the harness would
# run for this event. Knobs (env):
#   DEDUP=project        the project's settings env declares AIF_HOOK_DEDUP=project (default: not declared)
#   PROJECT_CHANNEL=on   CC with the project's settings loaded (default)
#   PROJECT_CHANNEL=off  ZCode: no project settings hooks; the harness sets ZCODE_PROJECT_DIR
#   PROJECT_CHANNEL=unloaded  CC session that did not load the project's settings
#                        (--setting-sources without `project`, an SDK host): no project hooks
#                        and, from the same file, no declaration
#   HLANG=ru|unset       AIF_HOOK_LANG in the environment (default ru)
#   XDG=<dir>            XDG_CONFIG_HOME, for the hook-lang file pin (default: an empty dir)
fire() {
  local proj="$1" ev="$2" tool="${3:-}" project_channel="${PROJECT_CHANNEL:-on}"
  local payload; payload=$(jq -cn --arg ev "$ev" --arg t "$tool" \
    '{session_id:"dedup-test",hook_event_name:$ev,prompt:"hi"} + (if $t == "" then {} else {tool_name:$t,tool_input:{file_path:"/x"}} end)')
  local sel='.hooks[$ev][]? | select((.matcher // "") as $m | $m == "" or $m == "*" or ($t != "" and ($t | test("^(" + $m + ")$")))) | .hooks[]?.command'
  local cmds=() c
  if [ "$project_channel" = on ]; then
    for f in "$proj/.claude/settings.json" "$proj/.claude/settings.local.json"; do
      [ -f "$f" ] || continue
      while IFS= read -r c; do cmds+=("$c"); done < <(jq -r --arg ev "$ev" --arg t "$tool" "$sel" "$f" 2>/dev/null)
    done
  fi
  while IFS= read -r c; do cmds+=("$c"); done < <(jq -r --arg ev "$ev" --arg t "$tool" "$sel" "$PLUGIN/hooks/hooks.json")
  local i=0 envv=(CLAUDE_PROJECT_DIR="$proj" CLAUDE_PLUGIN_ROOT="$PLUGIN" XDG_CONFIG_HOME="${XDG:-$TMPD/xdg-empty}")
  [ "${HLANG:-ru}" = unset ] || envv+=(AIF_HOOK_LANG="${HLANG:-ru}")
  [ "$project_channel" = unloaded ] || { [ -n "${DEDUP:-}" ] && envv+=(AIF_HOOK_DEDUP="$DEDUP"); }
  [ "$project_channel" = off ] && envv+=(ZCODE_PROJECT_DIR="$proj")
  for c in ${cmds[@]+"${cmds[@]}"}; do
    i=$((i+1))
    ( cd "$proj" && printf '%s' "$payload" \
        | env -u ZCODE_PROJECT_DIR -u AIF_HOOK_CHANNEL -u AIF_HOOK_DEDUP -u AIF_HOOK_LANG "${envv[@]}" bash -c "$c" ) \
      > "$TMPD/out.$i" 2>/dev/null &
  done
  wait
  local k; for k in $(seq 1 "$i"); do cat "$TMPD/out.$k"; done
  rm -f "$TMPD"/out.*
}
count() { printf '%s' "$1" | grep -oF -- "$2" | wc -l | tr -d ' '; }
DIGEST='[session-bootstrap digest —'
LANGL='[output-language]'
PMARK='PROJECT-DIGEST-MARK'

echo "S1 — framework-repo shape, declared: project registers inject-session-bootstrap, plugin enabled"
P1="$TMPD/p1"; mk_project "$P1" 'UserPromptSubmit;;inject-session-bootstrap'
OUT=$(DEDUP=project fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "plugin-only inject-project-digest still fires" || bad "project digest x$(count "$OUT" "$PMARK")"

echo "S1b — same project, NOT declared: no plugin copy yields (nothing is inferred from files)"
OUT=$(fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 2 ] && ok "both copies ran (the undeclared default)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"

echo "S1c — declared, but this session did not load the project's settings: every plugin copy runs"
OUT=$(DEDUP=project PROJECT_CHANNEL=unloaded fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once (plugin copy)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"

echo "S2 — plugin-only consumer: no project hooks at all"
P2="$TMPD/p2"; mk_project "$P2"
OUT=$(fire "$P2" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "project digest once" || bad "project digest x$(count "$OUT" "$PMARK")"
OUT=$(fire "$P2" SubagentStart)
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "SubagentStart project digest once" || bad "SubagentStart project digest x$(count "$OUT" "$PMARK")"

echo "S3 — consumer after /getff:install-enforcement (install.sh registrations) + plugin"
P3="$TMPD/p3"; mk_project "$P3" 'UserPromptSubmit;;inject-output-language' 'UserPromptSubmit;;inject-project-digest' 'SubagentStart;;inject-project-digest'
OUT=$(fire "$P3" UserPromptSubmit)
[ "$(count "$OUT" "$PMARK")" = 2 ] && ok "undeclared: the plugin copy keeps running next to the vendored one" || bad "project digest x$(count "$OUT" "$PMARK")"
OUT=$(DEDUP=project fire "$P3" UserPromptSubmit)
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "declared: [output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "declared: project digest once" || bad "project digest x$(count "$OUT" "$PMARK")"
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "plugin bootstrap digest still fires (project does not register it)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
OUT=$(DEDUP=project fire "$P3" SubagentStart)
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "declared: SubagentStart project digest once" || bad "SubagentStart project digest x$(count "$OUT" "$PMARK")"

echo "S4 — ZCode: project settings are not a hook channel there, the plugin must not yield"
OUT=$(DEDUP=project PROJECT_CHANNEL=off fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once (plugin copy kept)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"

echo "S5 — the project registers the hook for a DIFFERENT event: no loss on the other event"
P5="$TMPD/p5"; mk_project "$P5" 'UserPromptSubmit;;inject-project-digest'
OUT=$(DEDUP=project fire "$P5" SubagentStart)
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "plugin SubagentStart arm kept" || bad "SubagentStart project digest x$(count "$OUT" "$PMARK")"

echo "S6 — identical registration of a tool hook: project copy runs, plugin copy yields"
P6="$TMPD/p6"; mk_project "$P6" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
OUT=$(DEDUP=project fire "$P6" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN')" = 1 ] && ok "fires once" || bad "fired x$(count "$OUT" 'PROBE-RAN')"
printf '%s' "$OUT" | grep -qF 'PROBE-RAN project' && ok "the project copy is the one that ran" || bad "project copy did not run: $OUT"

echo "S7 — DIFFERENT matcher: the plugin copy keeps firing where only it matches (no loss)"
P7="$TMPD/p7"; mk_project "$P7" 'PostToolUse;Edit|Write;__probe__'
OUT=$(DEDUP=project fire "$P7" PostToolUse MultiEdit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "MultiEdit reaches the plugin copy" || bad "MultiEdit output: $OUT"
# stdin passthrough: the plugin copy that did NOT yield must receive the payload byte-exact.
WANT=$(printf '%s' "$(jq -cn '{session_id:"dedup-test",hook_event_name:"PostToolUse",prompt:"hi",tool_name:"MultiEdit",tool_input:{file_path:"/x"}}')" | cksum | cut -d' ' -f1)
printf '%s' "$OUT" | grep -qF "sum=$WANT" && ok "stdin reaches the dispatched script byte-exact" || bad "stdin checksum mismatch: $OUT (want $WANT)"

echo "S8 — registration names a script that does not exist: the plugin copy keeps firing"
P8="$TMPD/p8"; mk_project "$P8" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
rm -f "$P8/.claude/hooks/__probe__.sh"
OUT=$(DEDUP=project fire "$P8" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S9 — unparseable project settings (brownfield) are treated as no registration"
P9="$TMPD/p9"; mk_project "$P9"
printf '# Existing settings\n.claude/hooks/__probe__.sh\n' > "$P9/.claude/settings.json"
printf '#!/usr/bin/env bash\necho unused\n' > "$P9/.claude/hooks/__probe__.sh"
OUT=$(DEDUP=project fire "$P9" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S10 — no jq on PATH: dedup cannot parse, so it fails open (nothing is lost)"
NOJQ="$TMPD/nojq-bin"; mkdir -p "$NOJQ"
for t in bash cat grep head tr cksum cut mktemp rm dirname sed awk env printf; do
  p=$(command -v "$t" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$NOJQ/$t"
done
OUT=$(cd "$P6" && printf '{"hook_event_name":"PostToolUse","tool_name":"Edit"}' | env -u ZCODE_PROJECT_DIR PATH="$NOJQ" \
  AIF_HOOK_DEDUP=project CLAUDE_PROJECT_DIR="$P6" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$PLUGIN/hooks/run-hook.cmd" __probe__ 2>/dev/null)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran without jq" || bad "output: '$OUT'"

echo "S11 — language pinned ONLY in the hook-lang file: the line survives (only the wrapper reads it)"
XDGP="$TMPD/xdg-pin"; mkdir -p "$XDGP/getff"; printf 'ru\n' > "$XDGP/getff/hook-lang"
OUT=$(DEDUP=project HLANG=unset XDG="$XDGP" fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
P11="$TMPD/p11"; mk_project "$P11" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
OUT=$(DEDUP=project HLANG=unset XDG="$XDGP" fire "$P11" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "file pin in effect: the plugin copy is not deduplicated" || bad "output: $OUT"

echo "S12 — the project entry carries an \`if\` condition: it may not run, so the plugin copy is kept"
P12="$TMPD/p12"; mk_project "$P12" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
jq '(.hooks.PostToolUse[0].hooks[0]) += {"if":"Edit(src/**)"}' "$P12/.claude/settings.json" > "$TMPD/sj" && mv "$TMPD/sj" "$P12/.claude/settings.json"
OUT=$(DEDUP=project fire "$P12" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S13 — the project entry is async: it cannot stand in for a synchronous plugin copy"
P13="$TMPD/p13"; mk_project "$P13" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
jq '(.hooks.PostToolUse[0].hooks[0]) += {"async":true}' "$P13/.claude/settings.json" > "$TMPD/sj" && mv "$TMPD/sj" "$P13/.claude/settings.json"
OUT=$(DEDUP=project fire "$P13" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S14 — the plugin registers the hook under two matchers, the project covers one: no loss"
P14="$TMPD/p14"; mk_project "$P14" 'PostToolUse;NotebookEdit;__probe2__'
OUT=$(DEDUP=project fire "$P14" PostToolUse Bash)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "Bash reaches the plugin copy" || bad "output: $OUT"

echo "S15 — a covering command must run THIS project's script"
P15="$TMPD/p15"; mk_project "$P15" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
for c in 'bash .claude/hooks/__probe__.sh.disabled' 'bash "$HOME/.claude/hooks/__probe__.sh"' 'bash ../other/.claude/hooks/__probe__.sh'; do
  set_cmd "$P15" "$c"
  OUT=$(DEDUP=project fire "$P15" PostToolUse Edit)
  [ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "not covering: $c" || bad "$c → $OUT"
done
for c in 'bash .claude/hooks/__probe__.sh' "bash $P15/.claude/hooks/__probe__.sh" 'bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/__probe__.sh"'; do
  set_cmd "$P15" "$c"
  OUT=$(DEDUP=project fire "$P15" PostToolUse Edit)
  [ "$(count "$OUT" 'PROBE-RAN')" = 1 ] && printf '%s' "$OUT" | grep -qF 'PROBE-RAN project' \
    && ok "covering: ${c/$P15/<project>}" || bad "${c/$P15/<project>} → $OUT"
done

echo "S16 — matcher \"*\" in the project equals the plugin's empty matcher"
P16="$TMPD/p16"; mk_project "$P16" 'UserPromptSubmit;*;inject-session-bootstrap'
OUT=$(DEDUP=project fire "$P16" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"

echo "S17 — a registration in settings.local.json covers the plugin copy too"
P17="$TMPD/p17"; mk_project "$P17" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
mv "$P17/.claude/settings.json" "$P17/.claude/settings.local.json"; printf '{}\n' > "$P17/.claude/settings.json"
OUT=$(DEDUP=project fire "$P17" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN')" = 1 ] && printf '%s' "$OUT" | grep -qF 'PROBE-RAN project' && ok "fires once, project copy" || bad "output: $OUT"

echo "S18 — the wrapper parses under a POSIX shell (it has no shebang; the caller's shell runs it)"
if command -v dash >/dev/null 2>&1; then
  dash -n "$REPO_ROOT/plugin/hooks/run-hook.cmd" 2>/dev/null && ok "dash -n passes" || bad "dash -n fails: $(dash -n "$REPO_ROOT/plugin/hooks/run-hook.cmd" 2>&1)"
else
  echo "  - SKIP: no dash on this host (CI runners have it)"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
