#!/usr/bin/env bash
# Firing test — a hook registered on BOTH channels (the project's .claude/settings.json and the
# getff plugin's hooks.json) must fire ONCE, and a plugin-only consumer must keep every hook.
#
# Why this exists (measured 2026-09-29): Claude Code merges plugin hooks with project hooks and
# runs every matching entry concurrently — there is no cross-source dedup (anthropics/claude-code
# #76297, closed not-planned). In the operator's own sessions 14 registrations fired twice: the
# session-bootstrap digest arrived 2x per prompt and the [output-language] line 3x (44/44
# prompts of transcript d06b5902); the Stop gate blocked twice in the same millisecond. A
# consumer who runs /getff:install-enforcement gets the same doubling for the 9 hooks install.sh
# registers. The dedup lives in plugin/hooks/run-hook.cmd (the plugin's single dispatch point):
# the plugin copy yields when the project registers the same hook for the same event+matcher.
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
# A probe twin for the mechanics arms (stdin passthrough, matcher, missing script). It reports
# which channel ran it and a checksum of the stdin it received.
cat > "$PLUGIN/hooks/__probe__" <<'EOF'
#!/usr/bin/env bash
IN=$(cat); printf 'PROBE-RAN plugin sum=%s\n' "$(printf '%s' "$IN" | cksum | cut -d' ' -f1)"
EOF
# Register the probe in the sandbox hooks.json on PostToolUse with the plugin's usual matcher.
jq '.hooks.PostToolUse += [{matcher:"Edit|Write|MultiEdit",hooks:[{type:"command",command:"\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\" __probe__"}]}]' \
  "$PLUGIN/hooks/hooks.json" > "$TMPD/hj" && mv "$TMPD/hj" "$PLUGIN/hooks/hooks.json"

# ── Project fixture builder ─────────────────────────────────────────────────────────────
# mk_project <dir> <Event;matcher;name>... — writes .claude/settings.json registering each hook
# in the form install.sh and the repo use, copies the hook script from the repo source (the
# probe gets its own project-side body), and authors a session-bootstrap digest block so
# inject-project-digest has something to inject.
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
    if [ "$n" = "__probe__" ]; then
      printf '#!/usr/bin/env bash\ncat >/dev/null; echo "PROBE-RAN project"\n' > "$dir/.claude/hooks/$n.sh"
    elif [ -f "$REPO_ROOT/.claude/hooks/$n.sh" ]; then
      cp "$REPO_ROOT/.claude/hooks/$n.sh" "$dir/.claude/hooks/$n.sh"
    fi
  done
  printf '%s\n' "$settings" > "$dir/.claude/settings.json"
}

# fire <project> <event> [tool_name] — prints the merged stdout of every hook the harness would
# run for this event. HARNESS=zcode (env) drops the project channel and sets ZCODE_PROJECT_DIR.
fire() {
  local proj="$1" ev="$2" tool="${3:-}" harness="${HARNESS:-cc}"
  local payload; payload=$(jq -cn --arg ev "$ev" --arg t "$tool" \
    '{session_id:"dedup-test",hook_event_name:$ev,prompt:"hi"} + (if $t == "" then {} else {tool_name:$t,tool_input:{file_path:"/x"}} end)')
  local sel='.hooks[$ev][]? | select((.matcher // "") as $m | $m == "" or $m == "*" or ($t != "" and ($t | test("^(" + $m + ")$")))) | .hooks[]?.command'
  local cmds=() c
  if [ "$harness" = "cc" ]; then
    for f in "$proj/.claude/settings.json" "$proj/.claude/settings.local.json"; do
      [ -f "$f" ] || continue
      while IFS= read -r c; do cmds+=("$c"); done < <(jq -r --arg ev "$ev" --arg t "$tool" "$sel" "$f" 2>/dev/null)
    done
  fi
  while IFS= read -r c; do cmds+=("$c"); done < <(jq -r --arg ev "$ev" --arg t "$tool" "$sel" "$PLUGIN/hooks/hooks.json")
  local i=0 envv=(CLAUDE_PROJECT_DIR="$proj" CLAUDE_PLUGIN_ROOT="$PLUGIN" AIF_HOOK_LANG=ru)
  [ "$harness" = "zcode" ] && envv+=(ZCODE_PROJECT_DIR="$proj")
  for c in ${cmds[@]+"${cmds[@]}"}; do
    i=$((i+1))
    ( cd "$proj" && printf '%s' "$payload" | env -u ZCODE_PROJECT_DIR -u AIF_HOOK_CHANNEL "${envv[@]}" bash -c "$c" ) \
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

echo "S1 — operator shape: project registers inject-session-bootstrap, plugin enabled"
P1="$TMPD/p1"; mk_project "$P1" 'UserPromptSubmit;;inject-session-bootstrap'
OUT=$(fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "plugin-only inject-project-digest still fires" || bad "project digest x$(count "$OUT" "$PMARK")"

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
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "project digest once" || bad "project digest x$(count "$OUT" "$PMARK")"
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "plugin bootstrap digest still fires (project does not register it)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
OUT=$(fire "$P3" SubagentStart)
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "SubagentStart project digest once" || bad "SubagentStart project digest x$(count "$OUT" "$PMARK")"

echo "S4 — ZCode: project settings are not a hook channel there, the plugin must not yield"
OUT=$(HARNESS=zcode fire "$P1" UserPromptSubmit)
[ "$(count "$OUT" "$DIGEST")" = 1 ] && ok "bootstrap digest once (plugin copy kept)" || bad "bootstrap digest x$(count "$OUT" "$DIGEST")"
[ "$(count "$OUT" "$LANGL")" = 1 ] && ok "[output-language] once" || bad "[output-language] x$(count "$OUT" "$LANGL")"

echo "S5 — the project registers the hook for a DIFFERENT event: no loss on the other event"
P5="$TMPD/p5"; mk_project "$P5" 'UserPromptSubmit;;inject-project-digest'
OUT=$(fire "$P5" SubagentStart)
[ "$(count "$OUT" "$PMARK")" = 1 ] && ok "plugin SubagentStart arm kept" || bad "SubagentStart project digest x$(count "$OUT" "$PMARK")"

echo "S6 — identical registration of a tool hook: project copy runs, plugin copy yields"
P6="$TMPD/p6"; mk_project "$P6" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
OUT=$(fire "$P6" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN')" = 1 ] && ok "fires once" || bad "fired x$(count "$OUT" 'PROBE-RAN')"
printf '%s' "$OUT" | grep -qF 'PROBE-RAN project' && ok "the project copy is the one that ran" || bad "project copy did not run: $OUT"

echo "S7 — DIFFERENT matcher: the plugin copy keeps firing where only it matches (no loss)"
P7="$TMPD/p7"; mk_project "$P7" 'PostToolUse;Edit|Write;__probe__'
OUT=$(fire "$P7" PostToolUse MultiEdit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "MultiEdit reaches the plugin copy" || bad "MultiEdit output: $OUT"
# stdin passthrough: the plugin copy that did NOT yield must receive the payload byte-exact.
WANT=$(jq -cn '{session_id:"dedup-test",hook_event_name:"PostToolUse",prompt:"hi",tool_name:"MultiEdit",tool_input:{file_path:"/x"}}' | tr -d '\n' | cksum | cut -d' ' -f1)
printf '%s' "$OUT" | grep -qF "sum=$WANT" && ok "stdin reaches the dispatched script byte-exact" || bad "stdin checksum mismatch: $OUT (want $WANT)"

echo "S8 — registration names a script that does not exist: the plugin copy keeps firing"
P8="$TMPD/p8"; mk_project "$P8" 'PostToolUse;Edit|Write|MultiEdit;__probe__'
rm -f "$P8/.claude/hooks/__probe__.sh"
OUT=$(fire "$P8" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S9 — unparseable project settings (brownfield) are treated as no registration"
P9="$TMPD/p9"; mk_project "$P9"
printf '# Existing settings\n.claude/hooks/__probe__.sh\n' > "$P9/.claude/settings.json"
printf '#!/usr/bin/env bash\necho unused\n' > "$P9/.claude/hooks/__probe__.sh"
OUT=$(fire "$P9" PostToolUse Edit)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran" || bad "output: $OUT"

echo "S10 — no jq on PATH: dedup cannot parse, so it fails open (nothing is lost)"
NOJQ="$TMPD/nojq-bin"; mkdir -p "$NOJQ"
for t in bash cat grep head tr cksum cut mktemp rm dirname sed awk env printf; do
  p=$(command -v "$t" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$NOJQ/$t"
done
OUT=$(cd "$P6" && printf '{"hook_event_name":"PostToolUse","tool_name":"Edit"}' | env -u ZCODE_PROJECT_DIR PATH="$NOJQ" \
  CLAUDE_PROJECT_DIR="$P6" CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$PLUGIN/hooks/run-hook.cmd" __probe__ 2>/dev/null)
[ "$(count "$OUT" 'PROBE-RAN plugin')" = 1 ] && ok "plugin copy ran without jq" || bad "output: '$OUT'"

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
