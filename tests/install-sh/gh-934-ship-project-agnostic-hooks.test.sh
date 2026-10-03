#!/usr/bin/env bash
# gh-934 (batch D) — install.sh must ship the PROJECT-AGNOSTIC adaptations of the maintainer-only
# context hooks, and the lang-pack A fix must land:
#   • inject-project-digest.sh — injects the CONSUMER's OWN anchor (the digest block of THEIR
#     .claude/session-bootstrap.md) into BOTH SessionStart (plain stdout) and SubagentStart
#     (JSON additionalContext). Ships a starter template that is EMPTY → zero-setup no-op by default.
#   • inject-memory-codification.sh — generic write-time "codify durable rules into the repo" nudge
#     (message carries NO framework-internal doc ref).
#   • lang-pack A fix — the shipped en.sh/ru.sh no longer emit the hard `superpowers:brainstorming`
#     nudge / the `#fork-decided-by-silent-action` framework tag.
#
# ARMS:
#   (A) delivery — both hooks + the .claude/session-bootstrap.md template present + hooks executable
#   (B) template ships EMPTY (digest block whitespace-only) → the injector is a zero-setup no-op
#   (C) settings-merge — project-digest on SessionStart (startup|resume|clear|compact) AND SubagentStart,
#       none on UserPromptSubmit; memory-codification on
#       PostToolUse matcher Write; pre-existing deps-hash (UPS) + check-doc-authority-header (PostToolUse) survive
#   (D) idempotent + migration — a re-install over a legacy UserPromptSubmit registration leaves one
#       SessionStart entry and none per prompt
#   (E) firing project-digest (SessionStart) — a filled anchor → plain stdout carries it
#   (F) firing project-digest (SubagentStart) — → JSON additionalContext carries it
#   (G) firing memory-codification — Write to */memory/* → additionalContext + GENERIC message (no framework doc ref)
#   (H) lang-pack A fix delivered — shipped en.sh has "if available", lacks "#fork-decided-by-silent-action"
#   (I) --refresh restores both hooks, migrates a legacy per-prompt registration, AND does NOT clobber
#       a consumer-filled session-bootstrap.md
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934-batch-D SKIP — jq not available"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

T=$(mktemp -d)
( cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934d","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log" 2>&1

H="$T/.claude/hooks"
S="$T/.claude/settings.json"
BF="$T/.claude/session-bootstrap.md"
PDG="$H/inject-project-digest.sh"

# ── ARM (A): delivery ─────────────────────────────────────────────────────────
{ [ -x "$PDG" ] && [ -x "$H/inject-memory-codification.sh" ] && [ -f "$BF" ]; } \
  && ok "(A) inject-project-digest.sh + inject-memory-codification.sh + session-bootstrap.md template shipped" \
  || bad "(A) delivery incomplete (pdg=$([ -x "$PDG" ] && echo y||echo n) mcf=$([ -x "$H/inject-memory-codification.sh" ] && echo y||echo n) tmpl=$([ -f "$BF" ] && echo y||echo n))"

# ── ARM (B): template ships EMPTY → injector no-op ────────────────────────────
_blk=$(awk '/digest:start/{f=1;next} /digest:end/{f=0} f' "$BF" 2>/dev/null | tr -d '[:space:]')
_out=$(printf '{"hook_event_name":"UserPromptSubmit"}' | bash "$PDG" 2>/dev/null); _rc=$?
if [ -z "$_blk" ] && [ "$_rc" -eq 0 ] && [ -z "$_out" ]; then
  ok "(B) template ships EMPTY → injector is a zero-setup no-op (no tokens until filled)"
else
  bad "(B) template not empty / not no-op (block='$_blk' rc=$_rc out='$_out')"
fi

# ── ARM (C): settings-merge with both events + non-destructive ────────────────
MATCH='startup|resume|clear|compact'
LEGACY='bash "$CLAUDE_PROJECT_DIR/.claude/hooks/inject-project-digest.sh"'
_seed_legacy() { jq --arg c "$LEGACY" '.hooks.UserPromptSubmit += [{hooks:[{type:"command",command:$c}]}]' "$S" > "$S.tmp" && mv "$S.tmp" "$S"; }
_ups=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S")
_ss=$(jq -r --arg m "$MATCH" '(.hooks.SessionStart // []) | map(select(.matcher == $m) | .hooks[].command) | join("|")' "$S")
_sas=$(jq -r '(.hooks.SubagentStart // []) | map(.hooks[].command) | join("|")' "$S")
_mcf_m=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("inject-memory-codification"))) | .[0].matcher // ""' "$S")
_post=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S")
grep -q 'inject-project-digest' <<<"$_ss" && grep -q 'inject-project-digest' <<<"$_sas" \
  && ! grep -q 'inject-project-digest' <<<"$_ups" \
  && ok "(C) inject-project-digest registered on SessionStart ($MATCH) + SubagentStart, not per prompt" \
  || bad "(C) project-digest events wrong (ss=$_ss sas=$_sas ups=$_ups)"
[ "$_mcf_m" = "Write" ] && ok "(C) inject-memory-codification registered PostToolUse matcher=Write" || bad "(C) memory-codification matcher wrong ('$_mcf_m')"
{ grep -q 'deps-hash-check' <<<"$_ups" && grep -q 'check-doc-authority-header' <<<"$_post"; } \
  && ok "(C) pre-existing deps-hash (UPS) + check-doc-authority (PostToolUse) SURVIVED the merge" \
  || bad "(C) a sibling hook was clobbered (ups=$_ups post=$_post)"

# ── ARM (D): idempotency + migration of a legacy per-prompt registration ──────
_seed_legacy
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n=$(jq '(.hooks.SessionStart // []) | map(.hooks[].command) | map(select(test("inject-project-digest"))) | length' "$S")
_nu=$(jq '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | map(select(test("inject-project-digest"))) | length' "$S")
{ [ "$_n" = 1 ] && [ "$_nu" = 0 ]; } && ok "(D) re-install over a legacy per-prompt registration → one SessionStart entry, none on UserPromptSubmit" \
  || bad "(D) re-install left SessionStart=$_n UserPromptSubmit=$_nu project-digest entries"

# ── Fill the anchor for firing arms ───────────────────────────────────────────
printf '# x\n<!-- digest:start -->\n[project] G934D demo app.\n<!-- digest:end -->\n' > "$BF"

# ── ARM (E): firing project-digest SessionStart ──────────────────────────────
_e_out=$(printf '{"hook_event_name":"SessionStart","source":"startup"}' | bash "$PDG" 2>/dev/null) && grep -q 'G934D demo app' <<<"$_e_out" \
  && ok "(E) firing (SessionStart): the consumer's filled anchor is injected as plain stdout" \
  || bad "(E) SessionStart did not inject the anchor"

# ── ARM (F): firing project-digest SubagentStart ─────────────────────────────
_sub=$(printf '{"hook_event_name":"SubagentStart"}' | bash "$PDG" 2>/dev/null)
{ [ "$(printf '%s' "$_sub" | jq -r '.hookSpecificOutput.hookEventName' 2>/dev/null)" = "SubagentStart" ] \
  && _ctx=$(printf '%s' "$_sub" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null) && grep -q 'G934D demo app' <<<"$_ctx"; } \
  && ok "(F) firing (SubagentStart): the anchor is delivered as JSON additionalContext to subagents" \
  || bad "(F) SubagentStart did not emit the anchor JSON ($(printf '%s' "$_sub" | head -c 80))"

# ── ARM (G): firing memory-codification, generic message ─────────────────────
# Unique session_id per run: the hook caches "once per session" in $TMPDIR, which persists across
# test invocations — a fixed id would make a 2nd run see the stale cache and silently no-op.
_mcsid="g934d-mc-$$-${RANDOM}"
_mc=$(printf '{"tool_name":"Write","tool_input":{"file_path":"/home/u/.claude/projects/p/memory/x.md"},"session_id":"%s"}' "$_mcsid" | bash "$H/inject-memory-codification.sh" 2>/dev/null)
_mctxt=$(printf '%s' "$_mc" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null || true)
if grep -q 'Memory-codification reminder' <<<"$_mctxt" && ! grep -q 'memory-codification.md' <<<"$_mctxt"; then
  ok "(G) firing (memory-codification): Write to */memory/* → generic reminder (no framework doc ref)"
else
  bad "(G) memory-codification wrong ($(printf '%s' "$_mctxt" | head -c 80))"
fi

# ── ARM (H): lang-pack A fix delivered ────────────────────────────────────────
_en="$H/lang/en.sh"
if grep -q 'if available' "$_en" 2>/dev/null && ! grep -q '#fork-decided-by-silent-action' "$_en" 2>/dev/null; then
  ok "(H) lang-pack A fix shipped: soft 'if available' brainstorm nudge, no #fork-decided-by-silent-action tag"
else
  bad "(H) lang-pack A fix not in the shipped en.sh"
fi

# ── ARM (I): --refresh restores hooks, migrates legacy, preserves a filled anchor ─
rm -f "$PDG" "$H/inject-memory-codification.sh"
jq '.hooks.SessionStart |= (map(select((.hooks[].command | test("inject-project-digest")) | not)))
    | .hooks.SubagentStart |= (map(select((.hooks[].command | test("inject-project-digest")) | not)))' \
  "$S" > "$S.tmp" && mv "$S.tmp" "$S"
_seed_legacy
# BF is already filled (arm E) — refresh must NOT clobber it.
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >"$T/.log3" 2>&1
_ups2=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S")
_ss2=$(jq -r --arg m "$MATCH" '(.hooks.SessionStart // []) | map(select(.matcher == $m) | .hooks[].command) | join("|")' "$S")
_sas2=$(jq -r '(.hooks.SubagentStart // []) | map(.hooks[].command) | join("|")' "$S")
if [ -x "$PDG" ] && [ -x "$H/inject-memory-codification.sh" ] \
   && grep -q 'inject-project-digest' <<<"$_ss2" && grep -q 'inject-project-digest' <<<"$_sas2" \
   && ! grep -q 'inject-project-digest' <<<"$_ups2" \
   && grep -q 'G934D demo app' "$BF"; then
  ok "(I) --refresh restores both hooks + both registrations, drops the legacy per-prompt one, AND preserves the anchor"
else
  bad "(I) refresh failed (pdg=$([ -x "$PDG" ]&&echo y||echo n) ss=$_ss2 ups=$_ups2 anchor-kept=$(grep -q 'G934D demo app' "$BF" && echo y||echo n))"
fi

rm -rf "$T"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
