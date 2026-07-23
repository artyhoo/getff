#!/usr/bin/env bash
# gh-934 (per-hook audit follow-up) — install.sh must ship the doc-authority-header PostToolUse gate:
# the zero-dep bash REIMPLEMENTATION of the framework-internal check-doc-authority.sh (which delegates
# to tsx + packages/core and is a DEAD no-op in every consumer). This consumer hook enforces the
# doc-authority-header discipline on consumer-authored .claude/rules/*.md + .claude/skills/*/SKILL.md,
# wired NON-DESTRUCTIVELY into the consumer's .claude/settings.json alongside the §1e inject-matching-rule
# PostToolUse hook. Delivery ≠ liveness (#551): the test PROVES the delivered hook FIRES (flags a
# header-less scoped doc with exit 2, passes a compliant one), honours its escape valves, and degrades
# to a once-per-session announced no-op without jq (refined 2026-07-24, aif-parity F1).
#
# ARMS:
#   (A) delivery — hook present + executable
#   (B) settings-merge — PostToolUse has BOTH check-doc-authority-header (matcher Edit|Write|MultiEdit) AND the
#       pre-existing §1e inject-matching-rule (append, not clobber — same event)
#   (C) idempotent — a second install adds no duplicate PostToolUse entry
#   (D) firing (missing) — a scoped .claude/rules/*.md WITHOUT the header → exit 2 + stderr names it
#   (E) compliant — a scoped doc WITH the header (rule + SKILL.md) → exit 0, empty output
#   (F) escape valves — repo opt-out (AIF_DOC_AUTHORITY=0), per-file exempt token (≥20 chars), and a
#       non-scoped path all → exit 0; a <20-char exempt reason still GATES (exit 2)
#   (G1-G3) degrades without dep — jq absent → announced ONCE per session on an in-scope path,
#           silent on repeat + out-of-scope (GH #934 no-per-turn-spam preserved literally)
#   (H) --refresh restores the hook + registration for a brownfield consumer missing it
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934-da SKIP — jq not available (the settings-merge + firing arms need it)"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

# ── Install a consumer ────────────────────────────────────────────────────────
T=$(mktemp -d)
(
  cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934da","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force
) >"$T/.log" 2>&1

H="$T/.claude/hooks"
S="$T/.claude/settings.json"
HOOK="$H/check-doc-authority-header.sh"

# ── ARM (A): delivery ─────────────────────────────────────────────────────────
if [ -x "$HOOK" ]; then ok "(A) check-doc-authority-header.sh shipped + executable"; else bad "(A) check-doc-authority-header.sh missing/not-exec"; fi

# ── ARM (B): non-destructive same-event settings merge ────────────────────────
_post=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
_matcher=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("check-doc-authority-header"))) | .[0].matcher // ""' "$S" 2>/dev/null)
_dah_cmd=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | map(select(test("check-doc-authority-header"))) | .[0] // ""' "$S" 2>/dev/null)
if echo "$_dah_cmd" | grep -q 'check-doc-authority-header' && echo "$_dah_cmd" | grep -q 'CLAUDE_PROJECT_DIR'; then
  ok "(B) PostToolUse has check-doc-authority-header, its own command is \$CLAUDE_PROJECT_DIR-relative"
else
  bad "(B) check-doc-authority-header PostToolUse entry missing/mis-shaped (got: '$_dah_cmd')"
fi
[ "$_matcher" = "Edit|Write|MultiEdit" ] && ok "(B) registered with the Edit|Write|MultiEdit matcher" || bad "(B) wrong matcher (got: '$_matcher')"
if echo "$_post" | grep -q 'inject-matching-rule'; then
  ok "(B) pre-existing §1e inject-matching-rule PostToolUse hook SURVIVED (non-destructive, same event)"
else
  bad "(B) inject-matching-rule hook lost — merge clobbered a sibling on the same event (got: $_post)"
fi

# ── ARM (C): idempotency ──────────────────────────────────────────────────────
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n=$(jq '(.hooks.PostToolUse // []) | map(.hooks[].command) | map(select(test("check-doc-authority-header"))) | length' "$S" 2>/dev/null)
[ "$_n" = 1 ] && ok "(C) idempotent — re-install leaves exactly one check-doc-authority-header entry" || bad "(C) non-idempotent — $_n entries after re-install"

# ── Fixtures: header-less + compliant docs under the consumer's scoped surfaces ─
mkdir -p "$T/.claude/rules" "$T/.claude/skills/g934da-skill"
printf '# A rule with no authority header\n\nBody text only.\n' > "$T/.claude/rules/g934da-missing.md"
printf '# A compliant rule\n\n> **Authoritative for:** the g934da fixture scope.\n\nBody.\n' > "$T/.claude/rules/g934da-ok.md"
printf '# Skill\n\n> **Authoritative for:** the g934da skill fixture.\n\nBody.\n' > "$T/.claude/skills/g934da-skill/SKILL.md"
printf '# Exempt rule\n\n<!-- doc-authority: exempt deliberate headerless fixture for the escape-valve arm -->\n\nBody.\n' > "$T/.claude/rules/g934da-exempt.md"
printf '# Short-reason exempt\n\n<!-- doc-authority: exempt too short -->\n\nBody.\n' > "$T/.claude/rules/g934da-shortexempt.md"
# Fence-strip proof: the ONLY "Authoritative for:" line lives inside a ``` block → it must NOT
# count as a real header (mirrors the TS hasAuthorityHeader stripFencedCodeBlocks step). Must GATE.
printf '# Doc whose header is only an in-fence example\n\n```\n> **Authoritative for:** this is inside a code fence and must not count.\n```\n\nBody.\n' > "$T/.claude/rules/g934da-fenced.md"

_fire() { # $1=rel_path  → prints hook stderr, RETURNS hook exit code
  local rel="$1"
  local payload='{"tool_name":"Write","session_id":"g934da","tool_input":{"file_path":"'"$T/$rel"'"}}'
  printf '%s' "$payload" | CLAUDE_PROJECT_DIR="$T" bash "$HOOK" 2>&1 1>/dev/null
}
_run() { # $1=rel_path [$2=env assignment]  → prints combined out, RETURNS hook exit code
  local rel="$1" envset="${2:-}"
  local payload='{"tool_name":"Write","session_id":"g934da","tool_input":{"file_path":"'"$T/$rel"'"}}'
  printf '%s' "$payload" | env $envset CLAUDE_PROJECT_DIR="$T" bash "$HOOK" 2>&1
}

# ── ARM (D): firing — header-less scoped doc → exit 2 + stderr names it ────────
_err=$(_fire ".claude/rules/g934da-missing.md"); _rc=$?
if [ "$_rc" -eq 2 ] && printf '%s' "$_err" | grep -q 'Authoritative for'; then
  ok "(D) firing: header-less .claude/rules/*.md → exit 2, stderr flags the missing header (delivery→liveness)"
else
  bad "(D) firing: expected exit 2 + message (rc=$_rc err='$(printf '%s' "$_err" | head -c 80)')"
fi
# (D2) fence-strip: a header that exists ONLY inside a ``` block must NOT satisfy the check → GATE.
_err=$(_fire ".claude/rules/g934da-fenced.md"); _rc=$?
if [ "$_rc" -eq 2 ]; then
  ok "(D2) fence-strip: an in-fence example header does NOT count → still gated (exit 2)"
else
  bad "(D2) fence-strip: in-fence header wrongly passed (rc=$_rc) — fenced code not stripped"
fi

# ── ARM (E): compliant docs pass silently (rule + SKILL.md) ───────────────────
_out=$(_run ".claude/rules/g934da-ok.md"); _rc_ok=$?
_out2=$(_run ".claude/skills/g934da-skill/SKILL.md"); _rc_sk=$?
if [ "$_rc_ok" -eq 0 ] && [ -z "$_out" ] && [ "$_rc_sk" -eq 0 ] && [ -z "$_out2" ]; then
  ok "(E) compliant: a rule + a SKILL.md WITH the header → exit 0, empty output"
else
  bad "(E) compliant doc did not pass (rule rc=$_rc_ok out='$_out'; skill rc=$_rc_sk out='$_out2')"
fi

# ── ARM (F): escape valves ────────────────────────────────────────────────────
_out=$(_run ".claude/rules/g934da-missing.md" "AIF_DOC_AUTHORITY=0"); _rc_opt=$?
_out2=$(_run ".claude/rules/g934da-exempt.md"); _rc_ex=$?
_out3=$(_run "src/app.ts"); _rc_ns=$?        # non-scoped path
_err4=$(_fire ".claude/rules/g934da-shortexempt.md"); _rc_short=$?   # <20-char reason still gates
if [ "$_rc_opt" -eq 0 ] && [ -z "$_out" ]; then ok "(F) repo opt-out: AIF_DOC_AUTHORITY=0 → exit 0 even on a header-less doc"; else bad "(F) opt-out failed (rc=$_rc_opt out='$_out')"; fi
if [ "$_rc_ex" -eq 0 ] && [ -z "$_out2" ]; then ok "(F) per-file exempt token (≥20 chars) → exit 0"; else bad "(F) exempt token failed (rc=$_rc_ex out='$_out2')"; fi
if [ "$_rc_ns" -eq 0 ] && [ -z "$_out3" ]; then ok "(F) non-scoped path (src/app.ts) → exit 0, silent"; else bad "(F) non-scoped path not skipped (rc=$_rc_ns out='$_out3')"; fi
if [ "$_rc_short" -eq 2 ]; then ok "(F) exempt token with <20-char reason still GATES (exit 2) — no trivial bypass"; else bad "(F) short-reason exempt wrongly passed (rc=$_rc_short)"; fi

# ── ARM (G): degrades without dep — jq absent → exit 0; announced ONCE per session ─
# Contract refined 2026-07-24 (aif-parity F1): a registered-but-dependency-less gate that
# skips in TOTAL silence is indistinguishable from a passing one — the consumer never learns
# the gate is dead (#warning-nobody-reads; the same defect the aif-parity audit found live
# in the aif container, research-patches/2026-07-24-posttooluse-channel-verification.md).
# GH #934's actual requirement — no per-TURN error-spam — is preserved literally: the notice
# fires at most once per session, and only on an in-scope path. Both halves are asserted.
JQLESS=$(mktemp -d)
for _t in bash sh grep cat tail head cut tr sed printf env dirname basename awk; do
  _p=$(command -v "$_t" 2>/dev/null) && ln -sf "$_p" "$JQLESS/$_t" 2>/dev/null
done
# Session-scoped flag lives under TMPDIR; isolate it so a rerun starts fresh.
G_TMP=$(mktemp -d)
_payload='{"tool_name":"Write","session_id":"g934da","tool_input":{"file_path":"'"$T/.claude/rules/g934da-missing.md"'"}}'
_gout=$(printf '%s' "$_payload" | PATH="$JQLESS" TMPDIR="$G_TMP" CLAUDE_PROJECT_DIR="$T" bash "$HOOK" 2>/dev/null); _grc=$?
if [ "$_grc" -eq 0 ] && printf '%s' "$_gout" | grep -q 'DID NOT RUN'; then
  ok "(G1) degrades LOUDLY once: jq absent + in-scope path → exit 0 + additionalContext saying the check did not run"
else
  bad "(G1) first jq-less edit did not announce the dead gate (rc=$_grc out='$(printf '%s' "$_gout" | head -c 80)')"
fi

# Second edit in the SAME session → silent (this is the "no per-turn error-spam" half).
_gout2=$(printf '%s' "$_payload" | PATH="$JQLESS" TMPDIR="$G_TMP" CLAUDE_PROJECT_DIR="$T" bash "$HOOK" 2>&1); _grc2=$?
if [ "$_grc2" -eq 0 ] && [ -z "$_gout2" ]; then
  ok "(G2) no per-turn spam: a second jq-less edit in the same session → exit 0, no output"
else
  bad "(G2) repeated jq-less edit spammed (rc=$_grc2 out='$(printf '%s' "$_gout2" | head -c 60)')"
fi

# Out-of-scope path in a fresh session → silent even on the first edit.
G_TMP2=$(mktemp -d)
_payload_ns='{"tool_name":"Write","session_id":"g934da-ns","tool_input":{"file_path":"'"$T/src/app.ts"'"}}'
_gout3=$(printf '%s' "$_payload_ns" | PATH="$JQLESS" TMPDIR="$G_TMP2" CLAUDE_PROJECT_DIR="$T" bash "$HOOK" 2>&1); _grc3=$?
if [ "$_grc3" -eq 0 ] && [ -z "$_gout3" ]; then
  ok "(G3) scoped: a jq-less edit OUTSIDE the gate's own paths stays silent"
else
  bad "(G3) out-of-scope jq-less edit was not silent (rc=$_grc3 out='$(printf '%s' "$_gout3" | head -c 60)')"
fi

# ── ARM (H): --refresh restores a brownfield consumer missing the hook ────────
rm -f "$HOOK"
jq '.hooks.PostToolUse |= (map(select((.hooks[].command | test("check-doc-authority-header")) | not)))' \
  "$S" > "$S.tmp" && mv "$S.tmp" "$S"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >"$T/.log3" 2>&1
_post2=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if [ -x "$HOOK" ] && echo "$_post2" | grep -q 'check-doc-authority-header' && echo "$_post2" | grep -q 'inject-matching-rule'; then
  ok "(H) --refresh restores the hook + registration for a brownfield consumer (inject-matching-rule still present)"
else
  bad "(H) --refresh did not restore (post=$_post2, $(ls "$H" 2>/dev/null | tr '\n' ' '))"
fi

rm -rf "$T" "$JQLESS" "$G_TMP" "$G_TMP2"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
