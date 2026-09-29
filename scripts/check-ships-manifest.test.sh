#!/usr/bin/env bash
# check-ships-manifest.test.sh — paired positive/negative fixtures for
# scripts/check-ships-manifest.mjs (Arm A of the ships manifest, one-button point 13).
#
# Every arm builds a throw-away git repo holding one item per kind, writes a manifest that
# marks all of them, applies ONE mutation, and runs the checker with --root.
#   C0      a complete, consistent manifest passes (rc 0) — the fixture itself is clean
#   U1-U6   an unmarked item of each kind fails, naming it (skill, hook, rule, agent, setting, mcp)
#   S1      a row naming an item that no longer exists fails (stale row)
#   F1-F4   malformed rows fail: wrong field count, unknown kind / verdict / installer
#   D1      a duplicated row fails
#   I1-I3   internal: reason must start «internal, because » (>= 20 chars), installer must be `no`,
#           and plugin=yes needs a «plugin copy:» clause
#   P1      ships with no channel needs «pending: »
#   C1      installer=factory without a reason fails (the default-run reason)
#   L1-L2   plugin column disagrees with the plugin tree (claims yes / claims no)
#   T1      a skill's installer disagrees with its setup.d/lib.sh tier
#   N1      a setting row may not claim plugin=yes (the plugin ships no settings file)
#   A1-A5   `ask` settings vs setup.d/session-settings.json: a row the file lacks, a value that
#           drifted from getff's own settings.json, a file key with no `ask` row, an array entry
#           getff does not have, and `ask` on a non-setting all fail; an array subset passes (C0)
#   V0-V2   setup.d/companions.manifest: an unpinned row passes; an npm `@1.2.3` pin and a
#           marketplace `@v2.0` ref each fail (one-button fork on pins = B)
#   R1      the real repo's manifest passes (the live population is fully marked)
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECK="$REPO_ROOT/scripts/check-ships-manifest.mjs"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
TAB=$'\t'

# make_repo DIR — one item per kind, all tracked (the checker enumerates from `git ls-files`).
make_repo() {
  local d="$1"
  mkdir -p "$d/setup.d" "$d/.claude/skills/core-sk" "$d/.claude/skills/env-sk" "$d/skills/root-sk" \
    "$d/.claude/hooks" "$d/.claude/rules" "$d/agents" "$d/plugin/skills/core-sk" "$d/plugin/agents" "$d/plugin/hooks"
  git -C "$d" init -q
  printf 'GETFF_SKILLS_CORE="core-sk"\nGETFF_SKILLS_ENV="env-sk"\nGETFF_SKILLS_FACTORY="none-sk"\n' > "$d/setup.d/lib.sh"
  printf -- '---\nname: x\n---\n' | tee "$d/.claude/skills/core-sk/SKILL.md" "$d/.claude/skills/env-sk/SKILL.md" \
    "$d/skills/root-sk/SKILL.md" "$d/plugin/skills/core-sk/SKILL.md" >/dev/null
  printf '#!/bin/sh\n' | tee "$d/.claude/hooks/h-ship.sh" "$d/.claude/hooks/h-int.sh" >/dev/null
  printf '# r\n' > "$d/.claude/rules/r1.md"
  printf '# a\n' | tee "$d/agents/ag1.md" "$d/plugin/agents/ag1.md" >/dev/null
  printf '{"hooks":{"Stop":[{"hooks":[{"type":"command","command":"\\"${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd\\" h-ship"}]}]}}\n' \
    > "$d/plugin/hooks/hooks.json"
  printf '{"hooks":{},"autoCompactWindow":400000,"env":{"K1":"1"},"permissions":{"deny":["a","b"]}}\n' > "$d/.claude/settings.json"
  printf '{"autoCompactWindow":400000,"permissions":{"deny":["a"]}}\n' > "$d/setup.d/session-settings.json"
  printf '{"mcpServers":{"m1":{"type":"http","url":"https://example.invalid/mcp"}}}\n' > "$d/.mcp.json"
  cat > "$d/setup.d/ships.manifest" <<EOF
# fixture
skill${TAB}core-sk${TAB}ships${TAB}core${TAB}yes${TAB}-
skill${TAB}env-sk${TAB}ships${TAB}env${TAB}no${TAB}-
skill${TAB}root-sk${TAB}ships${TAB}core${TAB}no${TAB}-
hook${TAB}h-ship${TAB}ships${TAB}core${TAB}yes${TAB}-
hook${TAB}h-int${TAB}internal${TAB}no${TAB}no${TAB}internal, because it only means something inside getff itself
rule${TAB}r1${TAB}ships${TAB}no${TAB}no${TAB}pending: ships with the trigger-build corpus later on
agent${TAB}ag1${TAB}ships${TAB}core${TAB}yes${TAB}-
setting${TAB}hooks${TAB}ships${TAB}core${TAB}no${TAB}-
setting${TAB}autoCompactWindow${TAB}ships${TAB}ask${TAB}no${TAB}changes when sessions auto-compact, offered first
setting${TAB}permissions.deny${TAB}ships${TAB}ask${TAB}no${TAB}a subset of getff's own denies, offered first
setting${TAB}env.K1${TAB}internal${TAB}no${TAB}no${TAB}internal, because it names a getff-only knob for tests
mcp${TAB}m1${TAB}ships${TAB}full${TAB}no${TAB}written only under --full, the default run skips it
EOF
  git -C "$d" add -A >/dev/null
}

n=0
# arm <label> <want: pass|fail> <mutation (shell, runs in the repo dir)> [expected output substring]
arm() {
  local label="$1" want="$2" mut="$3" needle="${4-}" d out rc
  n=$((n+1)); d="$TMP/r$n"
  make_repo "$d"
  if ! ( cd "$d" && eval "$mut" && git add -A >/dev/null ) 2>"$TMP/mut.err"; then
    bad "$label — the mutation itself failed: $(tr '\n' '|' < "$TMP/mut.err")"; return 0
  fi
  out=$(node "$CHECK" --root "$d" 2>&1) && rc=0 || rc=$?
  case "$want:$rc" in
    pass:0|fail:1)
      if [ -n "$needle" ] && ! grep -qF -- "$needle" <<<"$out"; then
        bad "$label — rc ok but output lacks «$needle»: $(tr '\n' '|' <<<"$out")"
      else ok "$label"; fi ;;
    *) bad "$label — want $want, rc=$rc: $(tr '\n' '|' <<<"$out")" ;;
  esac
}
# row_sub OLD NEW — replace one manifest line (exact match) in the current repo
row_sub() { python3 - "$1" "$2" <<'PY'
import sys
p = 'setup.d/ships.manifest'; s = open(p).read()
old, new = sys.argv[1].replace('\\t', '\t'), sys.argv[2].replace('\\t', '\t')
assert old in s, old
open(p, 'w').write(s.replace(old, new))
PY
}

echo "── clean"
arm "C0 complete manifest passes" pass ':'

echo "── unmarked items fail, naming the item"
arm "U1 new skill"   fail 'mkdir -p .claude/skills/zz && printf x > .claude/skills/zz/SKILL.md' 'skill zz'
arm "U2 new hook"    fail 'printf x > .claude/hooks/zz.sh' 'hook zz'
arm "U3 new rule"    fail 'printf x > .claude/rules/zz.md' 'rule zz'
arm "U4 new agent"   fail 'printf x > agents/zz.md' 'agent zz'
arm "U5 new setting" fail 'printf '"'"'{"hooks":{},"autoCompactWindow":1,"env":{"K1":"1","K2":"2"}}\n'"'"' > .claude/settings.json' 'setting env.K2'
arm "U6 new mcp"     fail 'printf '"'"'{"mcpServers":{"m1":{},"m2":{}}}\n'"'"' > .mcp.json' 'mcp m2'

echo "── stale, malformed and duplicate rows fail"
arm "S1 stale row"        fail 'git rm -qf .claude/rules/r1.md' 'rule r1'
arm "F1 field count"      fail 'printf "rule\tr2\tships\n" >> setup.d/ships.manifest'
arm "F2 unknown kind"     fail 'row_sub "rule\tr1\tships" "rules\tr1\tships"'
arm "F3 unknown verdict"  fail 'row_sub "rule\tr1\tships" "rule\tr1\tmaybe"'
arm "F4 unknown installer" fail 'row_sub "skill\tenv-sk\tships\tenv" "skill\tenv-sk\tships\tharness"'
arm "D1 duplicate row"    fail 'l=$(grep "^agent${TAB}ag1${TAB}" setup.d/ships.manifest); printf "%s\n" "$l" >> setup.d/ships.manifest' 'agent ag1'

echo "── reasons"
arm "I1 internal without «internal, because»" fail 'row_sub "internal, because it only means" "it only means"' 'hook h-int'
arm "I2 internal with installer core"         fail 'row_sub "hook\th-int\tinternal\tno" "hook\th-int\tinternal\tcore"' 'hook h-int'
arm "I3a internal + plugin=yes, no «plugin copy:»" fail \
  'row_sub "hook\th-ship\tships\tcore\tyes\t-" "hook\th-ship\tinternal\tno\tyes\tinternal, because it only means something inside getff"' 'hook h-ship'
arm "I3b internal + plugin=yes WITH «plugin copy:» passes" pass \
  'row_sub "hook\th-ship\tships\tcore\tyes\t-" "hook\th-ship\tinternal\tno\tyes\tinternal, because it only means something inside getff; plugin copy: removed by the dedup work"'
arm "P1 ships with no channel and no «pending:»" fail 'row_sub "pending: ships with the trigger-build corpus later on" "-"' 'rule r1'
arm "C1 factory without a default-run reason"     fail 'row_sub "skill\tenv-sk\tships\tenv\tno\t-" "skill\tenv-sk\tships\tfactory\tno\t-"' 'skill env-sk'

echo "── facts the checker reads without installing"
arm "L1 plugin=yes but the plugin lacks it" fail 'row_sub "skill\troot-sk\tships\tcore\tno" "skill\troot-sk\tships\tcore\tyes"' 'skill root-sk'
arm "L2 plugin=no but the plugin carries it" fail 'row_sub "agent\tag1\tships\tcore\tyes" "agent\tag1\tships\tcore\tno"' 'agent ag1'
arm "T1 skill tier disagrees with lib.sh"   fail 'row_sub "skill\tenv-sk\tships\tenv" "skill\tenv-sk\tships\tcore"' 'skill env-sk'
arm "N1 setting claims plugin=yes"          fail 'row_sub "setting\thooks\tships\tcore\tno" "setting\thooks\tships\tcore\tyes"' 'setting hooks'

echo "── ask settings vs setup.d/session-settings.json"
arm "A1 ask row the file lacks"          fail 'printf "{\"permissions\":{\"deny\":[\"a\"]}}\n" > setup.d/session-settings.json' 'setting autoCompactWindow'
arm "A2 value drifted from settings.json" fail 'printf "{\"autoCompactWindow\":1,\"permissions\":{\"deny\":[\"a\"]}}\n" > setup.d/session-settings.json' 'setting autoCompactWindow'
arm "A3 file key with no ask row"        fail 'printf "{\"autoCompactWindow\":400000,\"env\":{\"K1\":\"1\"},\"permissions\":{\"deny\":[\"a\"]}}\n" > setup.d/session-settings.json' 'env.K1'
arm "A4 array entry getff does not have" fail 'printf "{\"autoCompactWindow\":400000,\"permissions\":{\"deny\":[\"a\",\"z\"]}}\n" > setup.d/session-settings.json' 'setting permissions.deny'
arm "A5 ask on a non-setting"            fail 'row_sub "rule\tr1\tships\tno" "rule\tr1\tships\task"' 'rule r1'

echo "── no version pin in setup.d/companions.manifest"
CM='printf "# c\nsp\ttrue\tclaude plugin install sp@official --scope user\tcc-plugin\t*\n" > setup.d/companions.manifest'
arm "V0 an unpinned companion row passes" pass "$CM"
arm "V1 an npm pin fails"                 fail "$CM"' && printf "cli1\ttrue\tnpm install -g @x/cli@1.2.3\tcli\t*\n" >> setup.d/companions.manifest' 'cli1 — install_cmd pins a version'
arm "V2 a marketplace ref pin fails"      fail "$CM"' && printf "mk\ttrue\tclaude plugin marketplace add a/b@v2.0\tcc-plugin\t*\n" >> setup.d/companions.manifest' 'mk — install_cmd pins a version'

echo "── the real repo"
out=$(node "$CHECK" --root "$REPO_ROOT" 2>&1) && rc=0 || rc=$?
if [ "$rc" -eq 0 ]; then ok "R1 getff's own manifest marks its whole population"
else bad "R1 getff's own manifest fails: $(tr '\n' '|' <<<"$out")"; fi

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
