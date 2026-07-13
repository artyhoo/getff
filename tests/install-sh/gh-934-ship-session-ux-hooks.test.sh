#!/usr/bin/env bash
# gh-934 (batch 2) — install.sh must ship the two consumer-useful session-UX hooks that the
# per-hook audit classified SHIP, wired into .claude/settings.json NON-DESTRUCTIVELY with the
# correct tool matchers, and PROVEN TO FIRE (delivery ≠ liveness — the #551 lesson):
#   • ask-question-reminder.sh   → PreToolUse (matcher AskUserQuestion) — pre-question fork nudge
#   • inject-matching-rule.sh    → PostToolUse (matcher Edit|Write)     — path-scoped rule delivery
#
# ARMS:
#   (A) delivery — both hooks present + executable
#   (B) settings-merge — PreToolUse=ask-question (matcher AskUserQuestion) AND
#       PostToolUse=inject-matching (matcher Edit|Write) registered; a PRE-EXISTING consumer
#       PostToolUse hook AND the §1b deps-hash UserPromptSubmit hook both SURVIVE (append, not clobber)
#   (C) idempotent — a second install adds no duplicate entry for either hook
#   (D) firing (ask-question) — a PreToolUse:AskUserQuestion payload → permissionDecision:"deny" + reason
#   (E) firing (inject-matching) — editing a rule-scoped path → additionalContext carries the rule summary
#   (F) consumer-skip guard — jq absent from PATH → both hooks exit 0, no output (no error-spam)
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934-ux SKIP — jq not available (the settings-merge + firing arms need it)"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

# ── Install a consumer with a PRE-EXISTING PostToolUse hook (the real clobber risk) ───────────
T=$(mktemp -d)
(
  cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934ux","version":"0.0.0"}\n' > package.json \
    && mkdir -p .claude \
    && printf '{\n  "hooks": {\n    "PostToolUse": [\n      {"matcher":"Edit","hooks":[{"type":"command","command":"bash .claude/hooks/consumer-own.sh"}]}\n    ]\n  }\n}\n' > .claude/settings.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force
) >"$T/.log" 2>&1

H="$T/.claude/hooks"
S="$T/.claude/settings.json"

# ── ARM (A): delivery ─────────────────────────────────────────────────────────
if [ -x "$H/ask-question-reminder.sh" ]; then ok "(A) ask-question-reminder.sh shipped + executable"; else bad "(A) ask-question-reminder.sh missing/not-exec"; fi
if [ -x "$H/inject-matching-rule.sh" ]; then ok "(A) inject-matching-rule.sh shipped + executable"; else bad "(A) inject-matching-rule.sh missing/not-exec"; fi

# ── ARM (B): non-destructive settings merge, with matchers ────────────────────
_pre=$(jq -r '(.hooks.PreToolUse // []) | map({m:.matcher, c:(.hooks[].command)}) | tostring' "$S" 2>/dev/null)
_post_cmds=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
_ups=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
# PreToolUse = ask-question-reminder, $CLAUDE_PROJECT_DIR-relative, matcher AskUserQuestion
if echo "$_pre" | grep -q 'ask-question-reminder' && echo "$_pre" | grep -q 'CLAUDE_PROJECT_DIR' && echo "$_pre" | grep -q 'AskUserQuestion'; then
  ok "(B) PreToolUse = ask-question-reminder, matcher=AskUserQuestion, \$CLAUDE_PROJECT_DIR-relative"
else
  bad "(B) PreToolUse ask-question entry missing/mis-shaped (got: $_pre)"
fi
# PostToolUse = inject-matching-rule with matcher Edit|Write
_imr_matcher=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("inject-matching-rule"))) | .[0].matcher // ""' "$S" 2>/dev/null)
if echo "$_post_cmds" | grep -q 'inject-matching-rule' && [ "$_imr_matcher" = "Edit|Write" ]; then
  ok "(B) PostToolUse = inject-matching-rule, matcher=Edit|Write"
else
  bad "(B) PostToolUse inject-matching entry missing/wrong-matcher (matcher='$_imr_matcher', cmds=$_post_cmds)"
fi
# Pre-existing consumer PostToolUse hook SURVIVED (non-destructive within the same event)
if echo "$_post_cmds" | grep -q 'consumer-own'; then
  ok "(B) pre-existing consumer PostToolUse hook SURVIVED the merge (non-destructive, same event)"
else
  bad "(B) consumer-own PostToolUse hook lost — merge clobbered a sibling (got: $_post_cmds)"
fi
# §1b deps-hash UserPromptSubmit hook still present (cross-event non-destructive)
if echo "$_ups" | grep -q 'deps-hash-check'; then
  ok "(B) §1b deps-hash UserPromptSubmit hook still present (cross-event non-destructive)"
else
  bad "(B) deps-hash UserPromptSubmit hook lost (got: $_ups)"
fi

# ── ARM (C): idempotency ──────────────────────────────────────────────────────
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n_pre=$(jq '(.hooks.PreToolUse // []) | map(select(.hooks[].command | test("ask-question-reminder"))) | length' "$S" 2>/dev/null)
_n_post=$(jq '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("inject-matching-rule"))) | length' "$S" 2>/dev/null)
if [ "$_n_pre" = 1 ] && [ "$_n_post" = 1 ]; then
  ok "(C) idempotent — re-install leaves exactly one entry per hook (pre=$_n_pre post=$_n_post)"
else
  bad "(C) non-idempotent — pre=$_n_pre post=$_n_post after re-install"
fi

# ── ARM (D): firing ask-question-reminder ─────────────────────────────────────
# PreToolUse:AskUserQuestion with a fresh session_id (no recency flag) → a challenge (deny).
_sid="g934ux-$$-D"
OUT_AQR=$(printf '{"tool_name":"AskUserQuestion","session_id":"%s"}' "$_sid" \
  | AIF_HOOK_LANG=en bash "$H/ask-question-reminder.sh" 2>/dev/null)
if [ "$(printf '%s' "$OUT_AQR" | jq -r '.hookSpecificOutput.permissionDecision' 2>/dev/null)" = "deny" ] \
   && [ "$(printf '%s' "$OUT_AQR" | jq -r '.hookSpecificOutput.permissionDecisionReason | length' 2>/dev/null)" -gt 0 ]; then
  ok "(D) firing (ask-question): delivered hook emits permissionDecision=deny + a non-empty reason (delivery→liveness)"
else
  bad "(D) firing (ask-question): no deny+reason ($(printf '%s' "$OUT_AQR" | head -c 120))"
fi

# ── ARM (E): firing inject-matching-rule ──────────────────────────────────────
# Seed a consumer rule with a distinctive glob + inject summary, then edit a matching path.
mkdir -p "$T/.claude/rules"
printf '<!-- globs: *.g934ux -->\n<!-- inject: G934UX-RULE-FIRED -->\n# g934ux test rule\n' > "$T/.claude/rules/g934ux-probe.md"
OUT_IMR=$(printf '{"tool_name":"Edit","session_id":"g934ux-%s-E","tool_input":{"file_path":"%s/x.g934ux"}}' "$$" "$T" \
  | bash "$H/inject-matching-rule.sh" 2>/dev/null)
if printf '%s' "$OUT_IMR" | jq -r '.hookSpecificOutput.additionalContext' 2>/dev/null | grep -q 'G934UX-RULE-FIRED'; then
  ok "(E) firing (inject-matching): editing a rule-scoped path injects the rule summary as additionalContext"
else
  bad "(E) firing (inject-matching): no injected summary ($(printf '%s' "$OUT_IMR" | head -c 120))"
fi

# ── ARM (F): consumer-skip guard — jq absent → exit 0, no output (both hooks) ──
JQLESS=$(mktemp -d)
for _t in bash sh grep cat tail head cut tr sed printf env dirname basename xargs date stat touch mkdir; do
  _p=$(command -v "$_t" 2>/dev/null) && ln -sf "$_p" "$JQLESS/$_t" 2>/dev/null
done
_gq_ok=1
for _hook in ask-question-reminder.sh inject-matching-rule.sh; do
  _payload='{"tool_name":"AskUserQuestion","session_id":"gq","tool_input":{"file_path":"/x.g934ux"}}'
  _out=$(printf '%s' "$_payload" | PATH="$JQLESS" bash "$H/$_hook" 2>/dev/null); _rc=$?
  if [ "$_rc" -ne 0 ] || [ -n "$_out" ]; then _gq_ok=0; echo "    ↳ $_hook: rc=$_rc out='$(printf '%s' "$_out" | head -c 60)'"; fi
done
[ "$_gq_ok" = 1 ] && ok "(F) consumer-skip guard: jq absent → both hooks exit 0, no output (no per-turn error-spam)" \
  || bad "(F) guard: a hook did not degrade to rc0+empty without jq"

# ── ARM (G): --refresh re-delivers + re-registers a brownfield consumer missing the #934 hooks ─
# Simulate a consumer installed BEFORE this batch: strip the two hooks + their settings entries
# from the (fully-installed) $T fixture, keeping the pre-existing consumer-own PostToolUse hook and
# deps-hash. --refresh (NOT --force) must restore both hooks + their matcher-scoped registration
# (the refresh-drift class #869/#890 — register via do_refresh, not fresh-install-only).
rm -f "$H/ask-question-reminder.sh" "$H/inject-matching-rule.sh"
jq '.hooks.PreToolUse |= (map(select((.hooks[].command | test("ask-question-reminder")) | not)))
    | .hooks.PostToolUse |= (map(select((.hooks[].command | test("inject-matching-rule")) | not)))' \
  "$S" > "$S.tmp" && mv "$S.tmp" "$S"
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --refresh ) >"$T/.log3" 2>&1
_r_pre=$(jq -r '(.hooks.PreToolUse // []) | map(select(.hooks[].command | test("ask-question-reminder"))) | .[0].matcher // ""' "$S" 2>/dev/null)
_r_post=$(jq -r '(.hooks.PostToolUse // []) | map(select(.hooks[].command | test("inject-matching-rule"))) | .[0].matcher // ""' "$S" 2>/dev/null)
_r_consumer=$(jq -r '(.hooks.PostToolUse // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
if [ -x "$H/ask-question-reminder.sh" ] && [ -x "$H/inject-matching-rule.sh" ] \
   && [ "$_r_pre" = "AskUserQuestion" ] && [ "$_r_post" = "Edit|Write" ] \
   && echo "$_r_consumer" | grep -q 'consumer-own'; then
  ok "(G) --refresh restores both hooks + matcher-registration for a brownfield consumer (pre=$_r_pre post=$_r_post; consumer-own survived)"
else
  bad "(G) --refresh did not restore/register (pre='$_r_pre' post='$_r_post' consumer='$_r_consumer', $(ls "$H" 2>/dev/null | tr '\n' ' '))"
fi

rm -rf "$T" "$JQLESS"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
