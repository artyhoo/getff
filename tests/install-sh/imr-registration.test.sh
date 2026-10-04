#!/usr/bin/env bash
# imr-registration.test.sh — register_imr_hooks (setup.d/lib.sh) wires inject-matching-rule's
# three arms and WIDENS an install made before them (trigger build, slice 1).
#
# Before slice 1 an install registered the hook once on PostToolUse, with the matcher "Edit|Write"
# (2752282c083, 2026-07-13) or later "Edit|Write|MultiEdit". register_cc_hook is add-only and
# idempotent per event, so a re-install alone would keep that matcher and the Read arm would never
# fire. Contract pinned here, on BOTH back-ends (jq, then node with jq hidden from PATH):
#   W1 either legacy matcher is widened IN PLACE to "…|Read": one entry of ours stays, its other
#      fields (a handler `timeout`) are kept, the consumer's own PostToolUse handlers stay
#   W2 PreToolUse "Bash" and SessionStart "compact" are registered
#   W3 a second run is byte-identical (idempotent)
#   W4 a fresh project (no settings file) gets all three
#   W5 a matcher of ours that is not a legacy one getff wrote — one naming Read, a catch-all
#      (`*`, `""`, `.*`) or none at all — is the consumer's choice and is left exactly as it was
#   W6 a consumer handler sharing our legacy group keeps the legacy matcher; ours moves to its
#      own group with the widened matcher
#   W7 a null group, a non-string command, or a prompt-type handler (no command) neither breaks
#      the widening nor the per-event idempotence, and jq and node write the same JSON
# shellcheck disable=SC2015,SC2016  # ok/bad pairs never fail; the $CLAUDE_PROJECT_DIR commands are literal by design
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

PKG_ROOT="$REPO_ROOT"; PROJECT_ROOT="$REPO_ROOT"; FORCE=""; DRY_RUN=""; UPSTREAM_BLOB_URL=""
SKIPPED=()
INSTALL_SH_LIB_ONLY=1 source "$REPO_ROOT/setup.d/lib.sh"

# jq builds the fixtures and reads the results on both passes; only the call under test hides it.
command -v jq >/dev/null 2>&1 || { echo "SKIP: jq not on PATH (fixtures and assertions use it)"; exit 0; }

IMR='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-matching-rule.sh"'
NEW='Edit|Write|MultiEdit|Read'
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir "$T/bin"
for t in node mv rm cat; do command -v "$t" >/dev/null && ln -s "$(command -v "$t")" "$T/bin/$t"; done

ours() { # settings event → the matchers of our entries on that event, one JSON array
  jq -c --arg e "$2" '[(.hooks[$e] // [])[] | objects
    | select(any(.hooks[]? | objects; .command | strings | test("inject-matching-rule\\.sh"))) | .matcher]' "$1"
}
one_group() { # file matcher-json → settings with one PostToolUse group of ours (timeout 7)
  jq -n --arg c "$IMR" --argjson m "$2" '{hooks: {PostToolUse: [
    ({hooks: [{type: "command", command: $c, timeout: 7}]} + (if $m == null then {} else {matcher: $m} end))
  ]}}' > "$1"
}

suite() { # backend
  local be="$1" f m
  if [ "$be" = node ]; then run() { ( PATH="$T/bin"; register_imr_hooks "$1" ); }
  else run() { register_imr_hooks "$1"; }; fi
  echo "── $be back-end ──"

  for m in 'Edit|Write|MultiEdit' 'Edit|Write'; do
    f="$T/$be-legacy-${#m}.json"
    jq -n --arg c "$IMR" --arg m "$m" '{hooks: {PostToolUse: [
      {matcher: "Edit|Write", hooks: [{type: "command", command: "consumer-own.sh"}]},
      {matcher: $m, hooks: [{type: "command", command: $c, timeout: 7}]}
    ]}}' > "$f"
    run "$f" > "$T/out" 2>&1
    [ "$(ours "$f" PostToolUse)" = "[\"$NEW\"]" ] \
      && ok "$be W1 ($m): one PostToolUse entry of ours, matcher $NEW" \
      || bad "$be W1 ($m): ours on PostToolUse = $(ours "$f" PostToolUse); $(cat "$T/out")"
    [ "$(jq '[.hooks.PostToolUse[].hooks[] | select(.command | test("inject-matching-rule")) | .timeout] == [7]' "$f")" = true ] \
      && ok "$be W1 ($m): the handler's timeout is kept" || bad "$be W1 ($m): $(jq -c .hooks.PostToolUse "$f")"
    [ "$(jq -c '[.hooks.PostToolUse[] | select(.hooks[0].command == "consumer-own.sh") | .matcher]' "$f")" = '["Edit|Write"]' ] \
      && ok "$be W1 ($m): the consumer's own PostToolUse group stays as it was" || bad "$be W1 ($m): consumer group changed"
    [ "$(ours "$f" PreToolUse)" = '["Bash"]' ] && [ "$(ours "$f" SessionStart)" = '["compact"]' ] \
      && ok "$be W2 ($m): PreToolUse:Bash + SessionStart:compact registered" \
      || bad "$be W2 ($m): PreToolUse $(ours "$f" PreToolUse), SessionStart $(ours "$f" SessionStart)"
    cp "$f" "$T/once.json"
    run "$f" >/dev/null 2>&1
    cmp -s "$T/once.json" "$f" && ok "$be W3 ($m): second run byte-identical" || bad "$be W3 ($m): second run changed the file"
  done
  if [ "$be" = node ]; then
    grep -qF 'through node' "$T/out" && ok "node: the node back-end really ran" || bad "node: jq-less path not taken: $(cat "$T/out")"
  fi

  f="$T/$be-fresh.json"
  run "$f" >/dev/null 2>&1
  [ "$(ours "$f" PostToolUse)" = "[\"$NEW\"]" ] && [ "$(ours "$f" PreToolUse)" = '["Bash"]' ] \
    && [ "$(ours "$f" SessionStart)" = '["compact"]' ] \
    && ok "$be W4: all three registered" || bad "$be W4: $(jq -c .hooks "$f" 2>&1)"

  for m in '"Edit|Write|MultiEdit|Read|NotebookEdit"' '"*"' '""' '".*"' 'null'; do
    f="$T/$be-keep.json"
    one_group "$f" "$m"
    run "$f" >/dev/null 2>&1
    [ "$(jq -c '.hooks.PostToolUse' "$f")" = "$(one_group "$T/expect.json" "$m"; jq -c '.hooks.PostToolUse' "$T/expect.json")" ] \
      && ok "$be W5: matcher $m left exactly as it was" || bad "$be W5 ($m): $(jq -c .hooks.PostToolUse "$f")"
  done

  f="$T/$be-shared.json"
  jq -n --arg c "$IMR" '{hooks: {PostToolUse: [
    {matcher: "Edit|Write|MultiEdit", hooks: [{type: "command", command: "consumer-own.sh"},
                                              {type: "command", command: $c, timeout: 7}]}
  ]}}' > "$f"
  run "$f" >/dev/null 2>&1
  [ "$(jq -c '[.hooks.PostToolUse[] | {m: .matcher, c: [.hooks[] | .command | sub(".*/"; "")]}]' "$f")" \
      = '[{"m":"Edit|Write|MultiEdit","c":["consumer-own.sh"]},{"m":"'"$NEW"'","c":["inject-matching-rule.sh\""]}]' ] \
    && ok "$be W6: consumer keeps the legacy group, ours moves to its own widened group" \
    || bad "$be W6: $(jq -c .hooks.PostToolUse "$f")"

  # W7 (cold review round 2): shapes Claude Code accepts or tolerates — a null group, a handler
  # whose command is not a string, a prompt-type handler with no command at all.
  local n=0 k
  for k in null '{"matcher": "Write", "hooks": [{"type": "prompt", "prompt": "x"}]}' \
           '{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": 5}]}'; do
    n=$((n + 1)); f="$T/$be-odd-$n.json"
    jq -n --arg c "$IMR" --argjson k "$k" '{hooks: {PostToolUse: [$k,
      {matcher: "Edit|Write", hooks: [{type: "command", command: $c}]}], PreToolUse: [$k]}}' > "$f"
    run "$f" > "$T/out" 2>&1
    [ "$(ours "$f" PostToolUse)" = "[\"$NEW\"]" ] && [ "$(ours "$f" PreToolUse)" = '["Bash"]' ] \
      && ! grep -q 'NOT' "$T/out" \
      && ok "$be W7.$n: widened once, registered once, no false warning" \
      || bad "$be W7.$n: PostToolUse $(ours "$f" PostToolUse), PreToolUse $(ours "$f" PreToolUse); $(cat "$T/out")"
    cp "$f" "$T/once.json"; run "$f" >/dev/null 2>&1
    cmp -s "$T/once.json" "$f" && ok "$be W7.$n: second run byte-identical" || bad "$be W7.$n: second run changed the file"
  done
}

suite jq
if [ -e "$T/bin/node" ]; then
  suite node
  for n in 1 2 3; do
    cmp -s "$T/jq-odd-$n.json" "$T/node-odd-$n.json" && ok "W7.$n: jq and node write the same JSON" \
      || bad "W7.$n: jq $(jq -c . "$T/jq-odd-$n.json") vs node $(jq -c . "$T/node-odd-$n.json")"
  done
else
  echo "SKIP: node not on PATH — the jq-less back-end is not exercised"
fi

# ── L: every installer lane registers the loader through register_imr_hooks ──────────────
# The python lane (setup.d/45-python.sh) never runs 10-skills.sh, so it carries its own copy of
# the loader's registration; a bare register_cc_hook there wires only the edit arm.
#   L1 no installer file registers inject-matching-rule except register_imr_hooks' own body
#   L2 a fresh `install.sh python` wires all three arms
#   L3 `install.sh python --refresh` over a pre-slice-1 python install widens it and adds the rest
echo "── installer lanes ──"
_l1=$(grep -nE 'register_cc_hook[^#]*inject-matching-rule' "$REPO_ROOT"/setup.d/*.sh "$REPO_ROOT/install.sh" \
  | grep -v "^$REPO_ROOT/setup.d/lib.sh:.*\"\$cmd\" \"inject-matching-rule\"")
[ -z "$_l1" ] && ok "L1 no lane registers inject-matching-rule outside register_imr_hooks" \
  || bad "L1 bare register_cc_hook for inject-matching-rule: $_l1"

P="$T/py"; mkdir "$P"
( cd "$P" && git init -q && printf '[project]\nname = "x"\nversion = "0.1"\n' > pyproject.toml \
  && git add -A && git -c user.email=t@t -c user.name=t commit -qm init ) >/dev/null 2>&1
( cd "$P" && bash "$REPO_ROOT/install.sh" python ) > "$T/py.log" 2>&1
_arms() { printf '%s %s %s' "$(ours "$1" PostToolUse)" "$(ours "$1" PreToolUse)" "$(ours "$1" SessionStart)"; }
_want="[\"$NEW\"] [\"Bash\"] [\"compact\"]"
[ "$(_arms "$P/.claude/settings.json")" = "$_want" ] && ok "L2 fresh python install wires all three arms" \
  || bad "L2 fresh python install: got '$(_arms "$P/.claude/settings.json")', want '$_want' (log: $T/py.log)"

jq --arg re 'inject-matching-rule' '
  def mine: any(.hooks[]?; .command | test($re));
  .hooks.PreToolUse = ((.hooks.PreToolUse // []) | map(select(mine | not)))
  | .hooks.SessionStart = ((.hooks.SessionStart // []) | map(select(mine | not)))
  | .hooks.PostToolUse = ((.hooks.PostToolUse // []) | map(if mine then .matcher = "Edit|Write|MultiEdit" else . end))' \
  "$P/.claude/settings.json" > "$P/s.tmp" && mv "$P/s.tmp" "$P/.claude/settings.json"
( cd "$P" && bash "$REPO_ROOT/install.sh" python --refresh ) > "$T/py2.log" 2>&1
[ "$(_arms "$P/.claude/settings.json")" = "$_want" ] && ok "L3 python --refresh widens a pre-slice install to all three arms" \
  || bad "L3 python --refresh: got '$(_arms "$P/.claude/settings.json")', want '$_want' (log: $T/py2.log)"

echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
