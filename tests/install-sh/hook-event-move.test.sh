#!/usr/bin/env bash
# hook-event-move.test.sh — a re-install MOVES a hook getff re-registered on another event.
#
# 2026-09-29: inject-project-digest + inject-output-language moved from UserPromptSubmit (fired
# on every prompt) to SessionStart (once per context). register_cc_hook is add-only, so a
# consumer installed before the move would keep the per-prompt registration NEXT TO the new
# one after a re-install. unregister_cc_hook (setup.d/lib.sh) removes the stale registration;
# this test pins its contract on both JSON back-ends (jq, and node when jq is not on PATH):
#   M1 the stale handler goes, the consumer's own handlers on that event stay
#   M2 a group that shared a handler with ours keeps the other handler
#   M3 an event left empty is deleted, not left as []
#   M4 the unregister + register pair is idempotent (second run: byte-identical file)
#   M5 nothing matches → the file is not rewritten (byte-identical) and nothing is printed
#   M6 the new registration carries the SessionStart matcher
# shellcheck disable=SC2015,SC2016  # ok/bad pairs never fail; the $CLAUDE_PROJECT_DIR commands are literal by design
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

PDG='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-project-digest.sh"'
OLH='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-output-language.sh"'
MATCH='startup|resume|clear|compact'

# The pre-2026-09-29 shape an install left behind, plus the consumer's own hooks.
legacy() {
  jq -n --arg p "$PDG" --arg o "$OLH" '{
    permissions: {allow: ["Bash(ls:*)"]},
    hooks: {
      UserPromptSubmit: [
        {hooks: [{type: "command", command: "consumer-own.sh"}]},
        {hooks: [{type: "command", command: $p}]},
        {hooks: [{type: "command", command: $o}, {type: "command", command: "consumer-shared.sh"}]}
      ],
      SubagentStart: [{hooks: [{type: "command", command: $p}]}]
    }}' > "$1"
}

move() { # settings — the exact sequence setup.d/10-skills.sh §1f + §1h run
  unregister_cc_hook "$1" UserPromptSubmit inject-output-language
  register_cc_hook "$1" SessionStart "$OLH" inject-output-language "$MATCH"
  unregister_cc_hook "$1" UserPromptSubmit inject-project-digest
  register_cc_hook "$1" SessionStart "$PDG" inject-project-digest "$MATCH"
  register_cc_hook "$1" SubagentStart "$PDG" inject-project-digest
}

check_backend() { # label settings
  local l="$1" f="$2" ups
  ups=$(jq -c '[.hooks.UserPromptSubmit[].hooks[].command]' "$f")
  [ "$ups" = '["consumer-own.sh","consumer-shared.sh"]' ] \
    && ok "$l M1+M2: UserPromptSubmit keeps only the consumer's handlers" \
    || bad "$l M1+M2: UserPromptSubmit is $ups"
  [ "$(jq '[.hooks.SessionStart[] | select(.matcher == "'"$MATCH"'") | .hooks[].command] | length' "$f")" = 2 ] \
    && ok "$l M6: both hooks on SessionStart with the $MATCH matcher" \
    || bad "$l M6: SessionStart is $(jq -c '.hooks.SessionStart' "$f")"
  [ "$(jq '.hooks.SubagentStart | length' "$f")" = 1 ] \
    && ok "$l: SubagentStart registration untouched (one group)" \
    || bad "$l: SubagentStart is $(jq -c '.hooks.SubagentStart' "$f")"
  jq -e '.permissions.allow == ["Bash(ls:*)"]' "$f" >/dev/null \
    && ok "$l: non-hook keys kept" || bad "$l: permissions lost"
}

if ! command -v jq >/dev/null 2>&1; then
  echo "  ✗ jq absent — this test reads results through jq"; exit 1
fi

# ── jq back-end ───────────────────────────────────────────────────────────────
T=$(mktemp -d)
legacy "$T/settings.json"
move "$T/settings.json" > "$T/out" 2>&1
check_backend jq "$T/settings.json"
grep -qF 'inject-project-digest removed from UserPromptSubmit' "$T/out" \
  && ok "jq: the move is reported" || bad "jq: no removal line: $(cat "$T/out")"
cp "$T/settings.json" "$T/first"
move "$T/settings.json" > "$T/out2" 2>&1
cmp -s "$T/first" "$T/settings.json" && ok "jq M4: second run leaves the file byte-identical" \
  || bad "jq M4: second run changed the file"

# M3: the only UserPromptSubmit handler is ours → the key goes
jq -n --arg p "$PDG" '{hooks:{UserPromptSubmit:[{hooks:[{type:"command",command:$p}]}]}}' > "$T/only.json"
unregister_cc_hook "$T/only.json" UserPromptSubmit inject-project-digest >/dev/null 2>&1
jq -e '.hooks | has("UserPromptSubmit") | not' "$T/only.json" >/dev/null \
  && ok "jq M3: an emptied event is deleted" || bad "jq M3: $(jq -c . "$T/only.json")"

# M5: nothing to remove → untouched, silent
printf '{ "hooks": {"Stop": [ {"hooks": [{"type":"command","command":"x.sh"}]} ]} }\n' > "$T/none.json"
cp "$T/none.json" "$T/none.orig"
o=$(unregister_cc_hook "$T/none.json" UserPromptSubmit inject-project-digest 2>&1)
cmp -s "$T/none.orig" "$T/none.json" && [ -z "$o" ] \
  && ok "jq M5: no match → file not rewritten, nothing printed" || bad "jq M5: rewritten or printed «$o»"
rm -rf "$T"

# ── node back-end (jq hidden from PATH) ───────────────────────────────────────
if command -v node >/dev/null 2>&1; then
  T=$(mktemp -d); mkdir "$T/bin"
  for t in node mv rm cat; do ln -s "$(command -v "$t")" "$T/bin/$t"; done
  legacy "$T/settings.json"
  ( PATH="$T/bin"; move "$T/settings.json" ) > "$T/out" 2>&1
  check_backend node "$T/settings.json"
  grep -qF 'through node' "$T/out" && ok "node: the node back-end really ran" \
    || bad "node: jq-less path not taken: $(cat "$T/out")"
  cp "$T/settings.json" "$T/first"
  ( PATH="$T/bin"; move "$T/settings.json" ) > /dev/null 2>&1
  cmp -s "$T/first" "$T/settings.json" && ok "node M4: second run leaves the file byte-identical" \
    || bad "node M4: second run changed the file"
  jq -n --arg p "$PDG" '{hooks:{UserPromptSubmit:[{hooks:[{type:"command",command:$p}]}]}}' > "$T/only.json"
  ( PATH="$T/bin"; unregister_cc_hook "$T/only.json" UserPromptSubmit inject-project-digest ) >/dev/null 2>&1
  jq -e '.hooks | has("UserPromptSubmit") | not' "$T/only.json" >/dev/null \
    && ok "node M3: an emptied event is deleted" || bad "node M3: $(jq -c . "$T/only.json")"
  printf '{ "hooks": {"Stop": [ {"hooks": [{"type":"command","command":"x.sh"}]} ]} }\n' > "$T/none.json"
  cp "$T/none.json" "$T/none.orig"
  o=$( PATH="$T/bin"; unregister_cc_hook "$T/none.json" UserPromptSubmit inject-project-digest 2>&1)
  cmp -s "$T/none.orig" "$T/none.json" && [ -z "$o" ] \
    && ok "node M5: no match → file not rewritten, nothing printed" || bad "node M5: rewritten or printed «$o»"
  rm -rf "$T"
else
  bad "node absent — the jq-less back-end could not be exercised"
fi

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
