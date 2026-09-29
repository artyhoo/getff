#!/usr/bin/env bash
# tests/install-sh/handoff-group.test.sh — the handoff group in a real consumer install
# (one-button point 13, advisor verdict 10: it ships at env only because this cycle works there).
#
# The cycle a consumer session goes through, each step run through the hook the install wrote:
#   1. Stop       end-of-turn-reminder.sh, armed by the session-settings group's AIF_HANDOFF_GATE
#                 (as Claude Code would pass it from .claude/settings.local.json), blocks a turn in
#                 the band and names .ai-factory/orchestrator-prompts/_handoff-<session>.md;
#   2. the model writes that file;
#   3. PreCompact  precompact-residue.sh writes _residue-<session>.md beside it;
#   4. SessionStart source=compact  inject-handoff-on-compact.sh puts the handoff back.
# Plus: both hooks are registered on those events at env (and absent at core); the per-session
# files are git-ignored through .git/info/exclude; --refresh restores a changed hook.
set -uo pipefail
REPO_ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✓ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
command -v jq >/dev/null 2>&1 || { echo "  ⊝ jq absent — skipped"; echo "PASS=0 FAIL=0"; exit 0; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
# The machine's own git ignore list and ~/.claude/settings.json must not decide any arm.
: > "$WORK/gitconfig"; mkdir -p "$WORK/home/.claude"
export GIT_CONFIG_GLOBAL="$WORK/gitconfig" XDG_CONFIG_HOME="$WORK/xdg"
# Neither may the calling shell's own hook knobs (an operator machine may export
# AIF_HANDOFF_GATE=1 machine-wide): every hook below gets only what the arm passes.
CLEAN=(-u AIF_HANDOFF_GATE -u AIF_CTX_WINDOW -u AIF_RESIDUE_DIR -u AIF_HANDOFF_BAND_PCT -u CLAUDE_CODE_AUTO_COMPACT_WINDOW -u AIF_HANDOFF_MAX_LINES)

install_into() { # install_into DIR PROFILE [consent]
  mkdir -p "$1"; git -C "$1" init -q
  printf '{"name":"fixture","dependencies":{"react":"^19.0.0"}}\n' > "$1/package.json"
  ( cd "$1" && GETFF_SESSION_SETTINGS="${3:-}" bash "$REPO_ROOT/install.sh" react-spa --profile "$2" --force </dev/null ) \
    > "$1.log" 2>&1 || bad "install --profile $2 exited non-zero: $(tail -3 "$1.log" | tr '\n' '|')"
}
registered() { # registered DIR EVENT HOOK [MATCHER]
  jq -e --arg e "$2" --arg h "/hooks/$3.sh" --arg m "${4:-}" \
    '[.hooks[$e][]? | select(($m == "") or (.matcher == $m)) | .hooks[]?.command | select(contains($h))] | length == 1' \
    "$1/.claude/settings.json" >/dev/null 2>&1
}

echo "── core: the group is not installed"
C="$WORK/core"; install_into "$C" core
if [ ! -e "$C/.claude/hooks/precompact-residue.sh" ] && [ ! -e "$C/.claude/hooks/inject-handoff-on-compact.sh" ] \
   && ! registered "$C" PreCompact precompact-residue && ! registered "$C" SessionStart inject-handoff-on-compact; then
  ok "core carries neither hook"
else bad "core carries part of the handoff group"; fi

echo "── env with the pre-launch yes"
D="$WORK/env"; install_into "$D" env 1
registered "$D" PreCompact precompact-residue && ok "precompact-residue is a PreCompact hook" || bad "precompact-residue not registered on PreCompact"
registered "$D" SessionStart inject-handoff-on-compact compact && ok "inject-handoff-on-compact is a SessionStart:compact hook" \
  || bad "inject-handoff-on-compact not registered on SessionStart:compact"
gate=$(jq -r '.env.AIF_HANDOFF_GATE // empty' "$D/.claude/settings.local.json" 2>/dev/null)
[ "$gate" = 1 ] && ok "the yes armed AIF_HANDOFF_GATE in settings.local.json" || bad "AIF_HANDOFF_GATE not in settings.local.json («$gate»)"
jq -e '.env.AIF_HANDOFF_GATE' "$D/.claude/settings.json" >/dev/null 2>&1 \
  && bad "the gate leaked into the committed settings.json" || ok "the committed settings.json does not arm the gate"

T="$WORK/t"; mkdir -p "$T"; TR="$T/transcript.jsonl"
printf '%s\n' \
  '{"type":"user","message":{"role":"user","content":"do the thing"},"isSidechain":false}' \
  '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"working"}],"usage":{"input_tokens":280000,"cache_read_input_tokens":0,"cache_creation_input_tokens":0,"output_tokens":10}},"isSidechain":false}' \
  > "$TR"
# 280000 tokens: in the band only when the gate's floor comes from the group's own
# autoCompactWindow in settings.local.json (400000 × 67% = 268000); the fallback floor is
# 300000, so a gate that skipped settings.local.json stays silent and arm 1 goes red.
hook() { # hook NAME JSON — as Claude Code runs it: project dir set, env from the settings files
  ( cd "$D" && printf '%s' "$2" | env "${CLEAN[@]}" HOME="$WORK/home" TMPDIR="$T" CLAUDE_PROJECT_DIR="$D" AIF_HOOK_LANG=en \
      AIF_HANDOFF_GATE="$gate" bash ".claude/hooks/$1.sh" ) 2>"$T/$1.err"
}
echo "── the cycle"
out=$(hook end-of-turn-reminder "{\"session_id\":\"sess-1\",\"transcript_path\":\"$TR\",\"cwd\":\"$D\",\"stop_hook_active\":false}")
hf="$D/.ai-factory/orchestrator-prompts/_handoff-sess-1.md"
if [ "$(jq -r '.decision // empty' <<<"$out" 2>/dev/null)" = block ] && grep -qF "$hf" <<<"$out"; then
  ok "1 Stop: the gate blocks at the settings.local.json floor and names $(basename "$hf") under .ai-factory/orchestrator-prompts"
else bad "1 Stop: no block naming $hf: $(head -c 400 <<<"$out") stderr=$(head -c 200 "$T/end-of-turn-reminder.err")"; fi
printf '# Handoff\n\n## Next action\n\nmarker-handoff-7f3\n' > "$hf"
hook precompact-residue "{\"session_id\":\"sess-1\",\"transcript_path\":\"$TR\",\"cwd\":\"$D\",\"trigger\":\"auto\"}" >/dev/null
rf="$D/.ai-factory/orchestrator-prompts/_residue-sess-1.md"
[ -s "$rf" ] && grep -q 'Model handoff:.*present' "$rf" && ok "3 PreCompact: the residue is written beside the handoff and sees it" \
  || bad "3 PreCompact: no residue at $rf: $(head -c 200 "$T/precompact-residue.err")"
out=$(hook inject-handoff-on-compact "{\"session_id\":\"sess-1\",\"source\":\"compact\",\"cwd\":\"$D\"}")
ctx=$(jq -r '.hookSpecificOutput.additionalContext // empty' <<<"$out" 2>/dev/null)
grep -q 'marker-handoff-7f3' <<<"$ctx" && grep -qF "$rf" <<<"$ctx" \
  && ok "4 SessionStart:compact: the handoff is back in the session, with the residue pointer" \
  || bad "4 SessionStart:compact: handoff not re-injected: $(head -c 300 <<<"$out")"
left=$(git -C "$D" status --porcelain --untracked-files=all | grep -E '_handoff-|_residue-' || true)
[ -z "$left" ] && ok "the per-session files are git-ignored" || bad "per-session files show in git status: $left"

echo "── the unarmed default: env without the yes"
E="$WORK/env-no"; install_into "$E" env
[ ! -e "$E/.claude/settings.local.json" ] && ok "no yes → nothing arms the gate" || bad "settings.local.json written without the yes"
out=$( cd "$E" && printf '%s' "{\"session_id\":\"sess-2\",\"transcript_path\":\"$TR\",\"cwd\":\"$E\",\"stop_hook_active\":false}" \
  | env "${CLEAN[@]}" HOME="$WORK/home" TMPDIR="$T" CLAUDE_PROJECT_DIR="$E" AIF_HOOK_LANG=en bash .claude/hooks/end-of-turn-reminder.sh 2>/dev/null )
grep -q 'handoff-gate' <<<"$out" && bad "the unarmed gate still blocked: $(head -c 200 <<<"$out")" || ok "unarmed, the Stop hook never raises the handoff gate"

echo "── --refresh"
printf '# locally changed\n' > "$D/.claude/hooks/precompact-residue.sh"
( cd "$D" && bash "$REPO_ROOT/install.sh" react-spa --refresh </dev/null ) > "$WORK/refresh.log" 2>&1
cmp -s "$D/.claude/hooks/precompact-residue.sh" "$REPO_ROOT/.claude/hooks/precompact-residue.sh" \
  && ok "--refresh restores a changed handoff hook on an env consumer" || bad "--refresh left the changed hook: $(tail -3 "$WORK/refresh.log" | tr '\n' '|')"

echo ""
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
