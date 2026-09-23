#!/usr/bin/env bash
# gh-934 — install.sh must ship the end-of-turn/session-recap Stop hook + its lang pack
# (the companion of the already-shipped /story skill) and wire it into the consumer's
# .claude/settings.json NON-DESTRUCTIVELY. Delivery ≠ liveness (the #551 lesson): the
# test also PROVES the delivered hook FIRES (EN + RU) and degrades safely without jq.
#
# ARMS:
#   (A) delivery — hook + lang/{en,ru,check-parity}.sh present + executable
#   (B) settings-merge — Stop=end-of-turn ($CLAUDE_PROJECT_DIR-relative) AND the pre-existing
#       UserPromptSubmit=deps-hash both present (append, not clobber)
#   (C) idempotent — a second install adds no duplicate Stop entry
#   (D) firing (EN) — a markdown-rich long transcript → decision:"block" + non-empty reason
#   (E) firing (RU) — AIF_HOOK_LANG=ru → decision:"block" + the RU RECAP marker in the reason
#   (E2) firing (RU, story) — a gh pr create tool_use → decision:"block" + the RU STORY marker
#       (pinned separately from (E): the old `Простыми словами|Как это было` OR stayed green
#       through a story-literal change because the recap half matched — sibling-channel
#       false green, plain-words-recap-v2 S4 hazard 1)
#   (F) consumer-skip guard — jq absent from PATH → exit 0, no output (no error-spam)
#   (G) --full arms the recap gate; a plain install leaves it dormant
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip(){ echo "  · $1"; }

command -v jq >/dev/null 2>&1 || { skip "gh-934 SKIP — jq not available (the settings-merge + firing arms need it)"; echo ""; echo "PASS=$PASS FAIL=$FAIL"; exit 0; }

# ── Install a consumer ────────────────────────────────────────────────────────
T=$(mktemp -d)
( cd "$T" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log" 2>&1

H="$T/.claude/hooks"
# ── ARM (A): delivery ─────────────────────────────────────────────────────────
if [ -x "$H/end-of-turn-reminder.sh" ]; then ok "(A) end-of-turn-reminder.sh shipped + executable"; else bad "(A) end-of-turn-reminder.sh missing/not-exec"; fi
_lp_ok=1; for _l in en.sh ru.sh check-parity.sh; do [ -f "$H/lang/$_l" ] || _lp_ok=0; done
[ "$_lp_ok" = 1 ] && ok "(A) lang pack shipped (en.sh + ru.sh + check-parity.sh)" || bad "(A) lang pack incomplete ($(ls "$H/lang" 2>/dev/null | tr '\n' ' '))"

# ── ARM (B): non-destructive settings merge ───────────────────────────────────
S="$T/.claude/settings.json"
_stop=$(jq -r '(.hooks.Stop // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
_ups=$(jq -r '(.hooks.UserPromptSubmit // []) | map(.hooks[].command) | join("|")' "$S" 2>/dev/null)
echo "$_stop" | grep -q 'end-of-turn-reminder' && echo "$_stop" | grep -q 'CLAUDE_PROJECT_DIR' \
  && ok "(B) Stop hook = end-of-turn-reminder, \$CLAUDE_PROJECT_DIR-relative (worktree-safe)" \
  || bad "(B) Stop hook missing / not CLAUDE_PROJECT_DIR-relative (got: $_stop)"
echo "$_ups" | grep -q 'deps-hash-check' \
  && ok "(B) pre-existing UserPromptSubmit=deps-hash SURVIVED the merge (non-destructive)" \
  || bad "(B) deps-hash UserPromptSubmit hook lost — merge clobbered a sibling (got: $_ups)"

# ── ARM (C): idempotency ──────────────────────────────────────────────────────
( cd "$T" && bash "$REPO_ROOT/install.sh" ts-server --force ) >"$T/.log2" 2>&1
_n=$(jq '(.hooks.Stop // []) | map(.hooks[].command) | map(select(test("end-of-turn-reminder"))) | length' "$S" 2>/dev/null)
[ "$_n" = 1 ] && ok "(C) idempotent — re-install leaves exactly one end-of-turn Stop entry" || bad "(C) non-idempotent — $_n end-of-turn Stop entries after re-install"

# ── Firing fixture: compact JSONL (CC uses no-space separators; a spaced fixture
#    would not match the hook's grep) with a markdown-structured >500-char answer. ──
TR="$T/transcript.jsonl"
{
  printf '{"type":"ai-title","aiTitle":"Fix the widget bug"}\n'
  printf '{"type":"user","message":{"content":"fix the bug"}}\n'
  body="## What I did\\n\\n"
  for i in $(seq 1 15); do body="$body- Fixed part $i of the widget render with a regression test.\\n"; done
  printf '{"type":"assistant","message":{"content":[{"type":"text","text":"%s"}]}}\n' "$body"
} > "$TR"

_run_hook() {  # $1 = lang ('' | ru) [$2 = transcript, def $TR] [$3 = session id, def g934]
  local lang="$1" tr="${2:-$TR}" sid="${3:-g934}"
  printf '{"transcript_path":"%s","stop_hook_active":false,"session_id":"%s"}' "$tr" "$sid" \
    | AIF_HOOK_LANG="${lang:-en}" bash "$H/end-of-turn-reminder.sh" 2>/dev/null
}

# ── ARM (D): firing EN ────────────────────────────────────────────────────────
OUT_EN=$(_run_hook "")
if [ "$(printf '%s' "$OUT_EN" | jq -r '.decision' 2>/dev/null)" = "block" ] \
   && [ "$(printf '%s' "$OUT_EN" | jq -r '.reason | length' 2>/dev/null)" -gt 0 ]; then
  ok "(D) firing (EN): delivered hook emits decision=block + a non-empty recap reason (delivery→liveness proven)"
else
  bad "(D) firing (EN): hook did not emit a block+reason ($(printf '%s' "$OUT_EN" | head -c 120))"
fi

# ── ARM (E): firing RU (recap path) ──────────────────────────────────────────
OUT_RU=$(_run_hook ru)
if [ "$(printf '%s' "$OUT_RU" | jq -r '.decision' 2>/dev/null)" = "block" ] \
   && printf '%s' "$OUT_RU" | jq -r '.reason' 2>/dev/null | grep -q 'Простыми словами'; then
  ok "(E) firing (RU): AIF_HOOK_LANG=ru → block + the RU recap marker in the reason (lang pack live)"
else
  bad "(E) firing (RU): no RU-marked block reason ($(printf '%s' "$OUT_RU" | head -c 120))"
fi

# ── ARM (E2): firing RU — story branch, story literal pinned ─────────────────
# The transcript mirrors the unit-tested shape (gh pr create tool_use sets the story
# signal); the reason must carry the STORY marker — only the story literal satisfies
# this arm, so a future story-literal drift cannot hide behind the recap marker again.
TR_STORY="$T/transcript-story.jsonl"
{
  printf '{"type":"ai-title","aiTitle":"Fix the widget bug"}\n'
  printf '{"type":"user","message":{"content":"fix the bug"}}\n'
  printf '{"type":"assistant","message":{"content":[{"type":"text","text":"Открываю PR."},{"type":"tool_use","name":"Bash","input":{"command":"gh pr create --base staging --title x --body y"}}]}}\n'
} > "$TR_STORY"
# The story branch persists a debounce flag keyed on the session id
# (${TMPDIR:-/tmp}/aif-story-<sid>): a hardcoded sid left that flag carrying the still-valid
# signal, so this arm failed on every SECOND warm-host run. Unique sid per run + explicit
# cleanup keeps the arm reproducible.
SID_STORY="g934-story-$$"
OUT_STORY=$(_run_hook ru "$TR_STORY" "$SID_STORY")
rm -f "${TMPDIR:-/tmp}/aif-story-$SID_STORY"
if [ "$(printf '%s' "$OUT_STORY" | jq -r '.decision' 2>/dev/null)" = "block" ] \
   && printf '%s' "$OUT_STORY" | jq -r '.reason' 2>/dev/null | grep -qF 'Что изменилось за сессию'; then
  ok "(E2) firing (RU) story branch: gh pr create → block + the RU story marker (story literal pinned)"
else
  bad "(E2) firing (RU) story branch: no story-marked block reason ($(printf '%s' "$OUT_STORY" | head -c 120))"
fi

# ── ARM (F): consumer-skip guard — jq absent → exit 0, no output ──────────────
JQLESS=$(mktemp -d)
for _t in bash sh grep cat tail head cut tr sed printf env; do
  _p=$(command -v "$_t" 2>/dev/null) && ln -sf "$_p" "$JQLESS/$_t" 2>/dev/null
done
_guard_out=$(printf '{"transcript_path":"%s","stop_hook_active":false}' "$TR" | PATH="$JQLESS" bash "$H/end-of-turn-reminder.sh" 2>/dev/null); _guard_rc=$?
if [ "$_guard_rc" -eq 0 ] && [ -z "$_guard_out" ]; then
  ok "(F) consumer-skip guard: jq absent → exit 0, no output (no per-turn error-spam)"
else
  bad "(F) guard: expected rc0 + empty, got rc=$_guard_rc out='$(printf '%s' "$_guard_out" | head -c 80)'"
fi

# ── (G) --full arms the recap gate; a plain install leaves it dormant ─────────
[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$T/.claude/settings.json")" = "" ] \
  && ok "G1 plain install leaves AIF_RECAP_GATE unset (gate ships dormant)" \
  || bad "G1 plain install armed the gate — R-15 says the rejection ships dormant"

TF=$(mktemp -d)
( cd "$TF" && git init -q && git config user.email t@t && git config user.name t \
    && printf '{"name":"g934f","version":"0.0.0"}\n' > package.json \
    && git add -A && git commit -q -m base \
    && bash "$REPO_ROOT/install.sh" ts-server --force --full ) >"$TF/.log" 2>&1
echo "EXIT=$?" >> "$TF/.log"

grep -q '^EXIT=0$' "$TF/.log" \
  && ok "G0 --full install exited 0" \
  || bad "G0 --full install did NOT exit 0 — G2/G3 below are meaningless (see $TF/.log)"

[ "$(jq -r '.env.AIF_RECAP_GATE // empty' "$TF/.claude/settings.json")" = "1" ] \
  && ok "G2 --full arms AIF_RECAP_GATE=1" \
  || bad "G2 --full did not arm the gate (see $TF/.log)"
jq -e '.hooks.Stop' "$TF/.claude/settings.json" >/dev/null \
  && ok "G3 --full install still registers the Stop hook (the env write did not clobber .hooks)" \
  || bad "G3 --full install lost the Stop hook registration"
rm -rf "$TF"

rm -rf "$T" "$JQLESS"
echo ""; echo "PASS=$PASS FAIL=$FAIL"; [ "$FAIL" -eq 0 ]
