#!/usr/bin/env bash
# S3 acceptance — the using-getff bootstrap + shippable skills.
# spec: docs/superpowers/specs/2026-06-22-cc-plugin-packaging-design.md §3 (#4, ADAPT)
#
# Asserts:
#   (1) session-start (via run-hook.cmd) exits 0 and prints a non-empty bootstrap
#   (2) the bootstrap names the using-getff skill (the auto-trigger pointer)
#   (3) the bootstrap encodes the instruction-priority ladder (CLAUDE.md/AGENTS.md win)
#   (4) the bootstrap states the honest soft/hard boundary (install-enforcement) — T16
#   (5) every plugin/skills/*/SKILL.md has valid frontmatter (name: + description:)
#   (6) hooks.json wires SessionStart→session-start and the target file exists
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PLUGIN="$REPO_ROOT/plugin"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }

# --- session-start behaviour (invoked exactly as hooks.json does) -----------
OUT=$(env CLAUDE_PLUGIN_ROOT="$PLUGIN" bash "$PLUGIN/hooks/run-hook.cmd" session-start 2>/dev/null); rc=$?
[ "$rc" -eq 0 ] && ok "session-start exits 0" || bad "session-start exit=$rc"
[ -n "$OUT" ] && ok "session-start prints non-empty bootstrap" || bad "session-start printed nothing"
printf '%s' "$OUT" | grep -q 'using-getff' && ok "bootstrap names using-getff" || bad "bootstrap does not name the skill"
printf '%s' "$OUT" | grep -Eq 'CLAUDE\.md|AGENTS\.md' && ok "bootstrap encodes instruction-priority ladder" || bad "bootstrap omits the instruction ladder"
printf '%s' "$OUT" | grep -q 'install-enforcement' && ok "bootstrap states the soft/hard boundary (T16)" || bad "bootstrap omits the honest hard-layer boundary"

# --- skill frontmatter ------------------------------------------------------
shopt -s nullglob
skill_count=0
for sk in "$PLUGIN"/skills/*/SKILL.md; do
  skill_count=$((skill_count+1))
  rel=${sk#"$REPO_ROOT/"}
  # frontmatter must open on line 1 with --- and contain name: + description:
  first=$(head -1 "$sk")
  fm=$(awk 'NR==1&&/^---/{f=1;next} f&&/^---/{exit} f{print}' "$sk")
  if [ "$first" = "---" ] && printf '%s' "$fm" | grep -q '^name:' && printf '%s' "$fm" | grep -q '^description:'; then
    ok "$rel has valid frontmatter (name+description)"
  else
    bad "$rel missing/invalid frontmatter"
  fi
done
[ "$skill_count" -ge 2 ] && ok "ships ≥2 skills (using-getff + getff)" || bad "expected ≥2 shipped skills, found $skill_count"

# --- hooks.json wiring ------------------------------------------------------
HJ="$PLUGIN/hooks/hooks.json"
if python3 -c "import json;json.load(open('$HJ'))" 2>/dev/null; then
  has=$(python3 -c "
import json
d=json.load(open('$HJ'))
ss=d.get('hooks',{}).get('SessionStart',[])
import re
print('yes' if any('session-start' in h.get('command','') for b in ss for h in b.get('hooks',[])) else 'no')
" 2>/dev/null)
  [ "$has" = "yes" ] && ok "hooks.json wires SessionStart→session-start" || bad "hooks.json missing SessionStart→session-start"
  [ -f "$PLUGIN/hooks/session-start" ] && ok "session-start target exists" || bad "session-start file missing"
else
  bad "hooks.json invalid JSON"
fi

echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
