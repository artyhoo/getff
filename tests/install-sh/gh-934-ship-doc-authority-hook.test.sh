#!/usr/bin/env bash
# gh-934 (batch C) — install.sh must ship the zero-dep doc authority-header check hook: the
# consumer port of the maintainer-only check-doc-authority.sh (which needs a tsx bin + the
# framework's own REQUIRED_HEADER_DOCS → a dead no-op in a consumer). This hook flags a
# consumer-authored rule/skill/agent doc that is missing its `> **Authoritative for:**` header —
# the convention the shipped /ai-doc skill teaches. Wired NON-DESTRUCTIVELY into PostToolUse.
# Delivery ≠ liveness (#551): the test PROVES the delivered hook FIRES (flags a header-less doc,
# passes a compliant one, strips code fences, ignores off-policy paths) and degrades without jq.
#
# ARMS:
#   (A) delivery — hook present + executable
#   (B) settings-merge — PostToolUse has check-authority-header (matcher Edit|Write); a pre-existing
#       consumer PostToolUse hook AND the §1e inject-matching-rule both survive (append, not clobber)
#   (C) idempotent — a second install adds no duplicate entry
#   (D) firing — a rule doc WITHOUT the header → FAIL + rc1; WITH the header → rc0 silent
#   (E) fence-strip — a header only INSIDE a ``` code fence does NOT count → FAIL
#   (F) scope — an off-policy path (README.md, a .ts edit) → rc0 silent (not the framework doc list)
#   (G) consumer-skip guard — jq absent → rc0, no output
#   (H) --refresh restores the hook + registration for a brownfield consumer missing it
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934-doc-authority SKIP — jq not available (the settings-merge arms need it)"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

# ── Install a consumer with a PRE-EXISTING PostToolUse hook (the clobber risk) ────────────────
T=$(mktemp -d)
(
  cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934doc","version":"0.0.0"}\n' > package.json \
    && mkdir -p .claude \
    && printf '{\n  "hooks": {\n    "PostToolUse": [\n      {"matcher":"Write","hooks":[{"type":"command","command":"bash .claude/hooks/consumer-own.sh"}]}\n    ]\n  }\n}\n' > .claude/settings.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force
) >"$T/.log" 2>&1

H="$T/.claude/hooks"
S="$T/.claude/settings.json"
HOOK="$H/check-authority-header.sh"

# ── ARM (A): delivery ─────────────────────────────────────────────────────────
if [ -x "$HOOK" ]; then ok "(A) check-authority-header.sh shipped + executable"; else bad "(A) check-authority-header.sh missing/not-exec"; fi

# ── ARM (B): non-destructive PostToolUse merge, with matcher ──────────────────
_matcher=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("check-authority-header"))) | .[0].matcher // ""' "$S" 2>/dev/null)
_post=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if echo "$_post" | grep -q 'check-authority-header' && [ "$_matcher" = "Edit|Write" ] && echo "$_post" | grep -q 'CLAUDE_PROJECT_DIR'; then
  ok "(B) PostToolUse = check-authority-header, matcher=Edit|Write, \$CLAUDE_PROJECT_DIR-relative"
else
  bad "(B) check-authority-header PostToolUse entry missing/wrong (matcher='$_matcher', cmds=$_post)"
fi
echo "$_post" | grep -q 'consumer-own' \
  && ok "(B) pre-existing consumer PostToolUse hook SURVIVED (non-destructive, same event)" \
  || bad "(B) consumer-own hook lost — merge clobbered a sibling (got: $_post)"
echo "$_post" | grep -q 'inject-matching-rule' \
  && ok "(B) the §1e inject-matching-rule PostToolUse hook also present (both #934 PostToolUse hooks coexist)" \
  || bad "(B) inject-matching-rule lost (got: $_post)"

# ── ARM (C): idempotency ──────────────────────────────────────────────────────
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n=$(jq '(.hooks.PostToolUse // []) | map(.hooks[].command) | map(select(test("check-authority-header"))) | length' "$S" 2>/dev/null)
[ "$_n" = 1 ] && ok "(C) idempotent — re-install leaves exactly one check-authority-header entry" || bad "(C) non-idempotent — $_n entries"

# ── Firing helper: run the DELIVERED hook on a crafted path in the consumer tree ──
mkdir -p "$T/.claude/rules" "$T/.claude/skills/probe/references" "$T/.claude/agents" "$T/src"
_fire() { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1" | bash "$HOOK" 2>&1; }
_rc()   { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1" | bash "$HOOK" >/dev/null 2>&1; echo $?; }

# ── ARM (D): firing — missing header FAILs, present header passes ──────────────
printf '# R\n\njust prose, no header\n' > "$T/.claude/rules/nohdr.md"
printf '# R\n\n> **Authoritative for:** the thing\n' > "$T/.claude/rules/hashdr.md"
if [ "$(_rc "$T/.claude/rules/nohdr.md")" = 1 ] && printf '%s' "$(_fire "$T/.claude/rules/nohdr.md")" | grep -q 'missing "> \*\*Authoritative for' \
   && [ "$(_rc "$T/.claude/rules/hashdr.md")" = 0 ]; then
  ok "(D) firing: a header-less rule → FAIL rc1; a compliant rule → rc0 silent (delivery→liveness)"
else
  bad "(D) firing wrong (nohdr rc=$(_rc "$T/.claude/rules/nohdr.md"), hashdr rc=$(_rc "$T/.claude/rules/hashdr.md"))"
fi

# ── ARM (E): fenced header does NOT count ─────────────────────────────────────
printf '# Example\n\n```\n> **Authoritative for:** inside a fence\n```\n' > "$T/.claude/rules/fenced.md"
[ "$(_rc "$T/.claude/rules/fenced.md")" = 1 ] \
  && ok "(E) fence-strip: a header only inside a code fence does NOT satisfy the check → FAIL" \
  || bad "(E) fenced header wrongly accepted (rc=$(_rc "$T/.claude/rules/fenced.md"))"

# ── ARM (F): off-policy paths ignored ─────────────────────────────────────────
printf '# consumer readme, no authority header\n' > "$T/README.md"
_rc_readme=$(_rc "$T/README.md")
_rc_ts=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/src/x.ts"}}' "$T" | bash "$HOOK" >/dev/null 2>&1; echo $?)
if [ "$_rc_readme" = 0 ] && [ "$_rc_ts" = 0 ]; then
  ok "(F) scope: an off-policy doc (README.md) + a non-doc (.ts) → rc0 silent (framework doc list NOT ported)"
else
  bad "(F) off-policy not ignored (README rc=$_rc_readme, .ts rc=$_rc_ts)"
fi

# ── ARM (G): consumer-skip guard — jq absent → rc0, no output ─────────────────
JQLESS=$(mktemp -d)
for _t in bash sh grep cat awk printf dirname env; do _p=$(command -v "$_t" 2>/dev/null) && ln -sf "$_p" "$JQLESS/$_t" 2>/dev/null; done
_gout=$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/.claude/rules/nohdr.md"}}' "$T" | PATH="$JQLESS" bash "$HOOK" 2>/dev/null); _grc=$?
if [ "$_grc" -eq 0 ] && [ -z "$_gout" ]; then
  ok "(G) consumer-skip guard: jq absent → rc0, no output (no per-edit error-spam)"
else
  bad "(G) guard: expected rc0+empty, got rc=$_grc out='$(printf '%s' "$_gout" | head -c 60)'"
fi

# ── ARM (H): --refresh restores a brownfield consumer missing the hook ────────
rm -f "$HOOK"
jq '.hooks.PostToolUse |= (map(select((.hooks[].command | test("check-authority-header")) | not)))' \
  "$S" > "$S.tmp" && mv "$S.tmp" "$S"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >"$T/.log3" 2>&1
_m2=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("check-authority-header"))) | .[0].matcher // ""' "$S" 2>/dev/null)
_post2=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if [ -x "$HOOK" ] && [ "$_m2" = "Edit|Write" ] && echo "$_post2" | grep -q 'consumer-own'; then
  ok "(H) --refresh restores the hook + matcher-registration for a brownfield consumer (consumer-own survived)"
else
  bad "(H) --refresh did not restore (matcher='$_m2', post=$_post2, $(ls "$H" 2>/dev/null | tr '\n' ' '))"
fi

rm -rf "$T" "$JQLESS"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
