#!/usr/bin/env bash
# @cc-only-rationale: CC-specific Stop hook (session-recap) — a Stop hook only runs INSIDE a
#   Claude Code session, so there is no portable counterpart by nature (the @dual-pair below is
#   the internal en/ru i18n split, not a portability pair). NOW SHIPPED to consumer CC projects
#   (GH #934): companion of the shipped /story skill (SKILL.md SSOT names "the Stop-hook
#   aif_msg_eot_branch_story branch"), delivered by install.sh + do_refresh. Consumer-safe: no
#   framework-internal artefact dependency (the only path refs are comment-citations); degrades
#   to exit 0 when jq or a transcript is absent.
set -euo pipefail

# Consumer-skip guard (GH #934): the hook parses the transcript with jq. Absent jq → no work
# possible → exit 0 silently (never error-spam a consumer's every turn). The framework session
# always has jq; a minimal consumer may not.
command -v jq >/dev/null 2>&1 || exit 0

# Language pack (payload prose). Default en (canonical, public repo); operator sets
# AIF_HOOK_LANG=ru in ~/.claude/settings.json env. Missing pack → en fallback.
# Provides AIF_RECAP_MARKER (the recap heading, used by the guard below AND embedded
# in the messages) + aif_msg_eot_* functions.
# @dual-pair: hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)
_lang_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lang"
_lang_file="${_lang_dir}/${AIF_HOOK_LANG:-en}.sh"
[ -f "$_lang_file" ] || _lang_file="${_lang_dir}/en.sh"
# shellcheck source=/dev/null
. "$_lang_file"

input=$(cat)

stop_hook_active=$(echo "$input" | jq -r '.stop_hook_active // false' 2>/dev/null || echo "false")
if [ "$stop_hook_active" = "true" ]; then
  exit 0
fi

transcript=$(echo "$input" | jq -r '.transcript_path // empty' 2>/dev/null || echo "")
if [ -z "$transcript" ] || [ ! -f "$transcript" ]; then
  exit 0
fi

# Session-goal anchor (deterministic, no LLM). Primary signal: CC's own session
# title (`{"type":"ai-title","aiTitle":...}`) — empirically present even when the
# first user message has no extractable text block. Fallback: head of the first
# user instruction. grep avoids a full-file jq slurp (cheap on large transcripts).
anchor=$(grep '"type":"ai-title"' "$transcript" 2>/dev/null | tail -1 | jq -r '.aiTitle // empty' 2>/dev/null || true)
if [ -z "$anchor" ]; then
  anchor=$(grep -m1 '"type":"user"' "$transcript" 2>/dev/null | jq -r 'if (.message.content|type=="array") then (.message.content[]? | select(.type=="text") | .text) else (.message.content // empty) end' 2>/dev/null | head -1 | tr "\n" " " | cut -c1-120 || true)
fi
[ -z "$anchor" ] && anchor="$(aif_msg_eot_anchor_fallback)"

# Last assistant line. `grep ... | tail -1` (portable: equivalent to BSD `tail -r |
# grep -m1` on macOS, and works on Linux/CI where `tail -r` is unavailable — lets the
# companion test exercise this hook in CI).
last_line=$(grep '"type":"assistant"' "$transcript" 2>/dev/null | tail -1 || true)
if [ -z "$last_line" ]; then
  exit 0
fi

tool_names=$(echo "$last_line" | jq -r '.message.content[]? | select(.type=="tool_use") | .name' 2>/dev/null || true)
has_askuserquestion=false
if echo "$tool_names" | grep -qx 'AskUserQuestion'; then
  has_askuserquestion=true
fi

text=$(echo "$last_line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null || true)
# -- story branch detection: a PR was just created this turn → engaging recap ----
session_id=$(echo "$input" | jq -r '.session_id // "nosession"' 2>/dev/null || echo "nosession")
story_signal=""
_gh=$(echo "$last_line" | jq -r '.message.content[]? | select(.type=="tool_use" and .name=="Bash") | .input.command // empty' 2>/dev/null | grep -c 'gh pr create' || true)
_url=$(printf '%s' "$text" | grep -oE 'github\.com/[^ )]+/pull/[0-9]+' | head -1 || true)
if [ "${_gh:-0}" -gt 0 ] || [ -n "$_url" ]; then
  story_signal="${_url:-pr-created}"
fi
if [ -z "$text" ] && [ "$has_askuserquestion" != "true" ] && [ -z "$story_signal" ]; then
  exit 0
fi

text_length=${#text}

# -- orchestration-mode marker (deterministic; normal mode = marker absent) ----
# In orchestration mode (driving aif-handoff, relaying state every turn) two
# triggers are re-tuned (Bug A regex dropped, recap threshold lowered); normal
# mode is byte-for-byte unchanged. Freshness (mtime within TTL) guards against a
# forgotten marker silently muting a normal session. Spec: docs/superpowers/
# specs/2026-06-01-hook-nudge-orchestration-mode-design.md.
orch_mode=false
marker="${ORCHESTRATION_MODE_MARKER:-${CLAUDE_PROJECT_DIR:-.}/.claude/orchestration-mode}"
ttl="${ORCHESTRATION_MODE_TTL_SECONDS:-21600}"
if [ -f "$marker" ]; then
  marker_now=$(date +%s)
  # GNU-first, BSD-fallback: try `stat -c %Y` (GNU/Linux) before `stat -f %m` (BSD/macOS).
  # The reverse order silently breaks on Linux — GNU `stat -f` is --file-system, so
  # `stat -f %m` EXITS 0 with a garbage value (not mtime), the `||` fallback never fires,
  # and the marker reads as expired → orchestration mode never activates on Linux/CI.
  # BSD `stat -c` fails cleanly (illegal option), so GNU-first degrades correctly on macOS.
  marker_mtime=$(stat -c %Y "$marker" 2>/dev/null || stat -f %m "$marker" 2>/dev/null || echo 0)
  if [ "$(( marker_now - marker_mtime ))" -lt "$ttl" ]; then
    orch_mode=true
  fi
fi

# Already-recapped guard: if the current assistant turn already contains the
# active-language recap marker ($AIF_RECAP_MARKER, sourced from lang/), the recap
# is done — re-firing would re-inject the recap instruction over an existing recap.
# Complements the built-in stop_hook_active guard (hook:7-10) for the case where the
# model proactively recaps in a fresh natural turn (stop_hook_active=false).
if [ -n "$text" ] && printf '%s' "$text" | grep -qF "$AIF_RECAP_MARKER"; then
  exit 0
fi

# Story already told this turn → do not re-inject.
if [ -n "$story_signal" ] && [ -n "$text" ] && printf '%s' "$text" | grep -qF "$AIF_STORY_MARKER"; then
  exit 0
fi
# Debounce by PR: same PR already storied this session → fall through to normal branches.
if [ -n "$story_signal" ]; then
  story_flag="${TMPDIR:-/tmp}/aif-story-${session_id}"
  if [ -f "$story_flag" ] && [ "$(cat "$story_flag" 2>/dev/null || true)" = "$story_signal" ]; then
    story_signal=""
  fi
fi

# Trigger ONLY on (a) a substantial structured answer (a long body) or
# (b) a question. Tool calls alone do NOT trigger — a short "done, fixed X"
# turn with no question needs no recap.
#
# NOTE: the v1 factual-claim scan (numeric / file:line / negative-existence) was
# REMOVED 2026-06-01 (maintainer decision). Measured recall ≈0.43 + precision
# ≈0.20-0.25 (cry-wolf) made it a net-negative sentry — the same class as the
# recommendation-laziness narrow-B stop-scan dropped at FP 84% (#210). Rationale +
# evidence: docs/meta-factory/research-patches/2026-06-01-remove-claim-detector.md.
# The recap (Branch A/C) + question-check (Branch B) survive; the always-on H1
# reminder in inject-session-bootstrap.sh remains the cheap salience layer.
# Recap threshold is lowered in orchestration mode (status turns are short+dense)
# but the markdown-structure gate is KEPT, so unstructured chatter stays silent.
long_text=false
recap_threshold=500
if [ "$orch_mode" = "true" ]; then
  recap_threshold="${ORCHESTRATION_MODE_RECAP_MIN_CHARS:-200}"
fi
if [ "$text_length" -gt "$recap_threshold" ]; then
  if echo "$text" | grep -qE '^#|^- |^\* |\*\*|```|\[[^]]+\]\([^)]+\)'; then
    long_text=true
  fi
fi

# Did the turn end in a question?
asked=false
if [ "$has_askuserquestion" = "true" ]; then
  asked=true
elif [ -n "$text" ]; then
  tail_chunk=$(echo "$text" | tail -c 500)
  if echo "$tail_chunk" | grep -qE '\?[[:space:]]*$'; then
    asked=true
  elif [ "$orch_mode" = "false" ] && echo "$tail_chunk" | grep -qiE "$AIF_EOT_QUESTION_PATTERN"; then
    asked=true
  fi
fi


# -- MAJOR-1 idle-suppression guard -------------------------------------------
# Suppress Branch B (asked=true, long_text=false) ONLY when BOTH hold:
#   (a) Previous assistant turn already produced a "## 🟢" recap block.
#   (b) Current turn text is NOT new -- its first 120 chars appear verbatim in
#       the previous turn text (same question repeated/re-ping after recap).
# A genuinely new question will NOT match (b) because it contains content the
# previous turn never had. Only idle re-pings are suppressed.
# Guard never fires if only one assistant turn exists in the transcript.
# B2 fix: NEVER suppress when text is empty (AskUserQuestion-only turn) or
# has_askuserquestion=true or current_short is empty — a tool-only turn asking a
# NEW question must always fire. Short-circuit BEFORE the grep -qF call.
idle_suppress=false
if [ "$asked" = "true" ] && [ "$long_text" = "false" ]; then
  # B2: if text is empty or it's an AskUserQuestion-only turn, never suppress
  if [ -z "$text" ] || [ "$has_askuserquestion" = "true" ]; then
    idle_suppress=false
  else
    prev_line=$(grep '"type":"assistant"' "$transcript" 2>/dev/null | tail -2 | head -1 || true)
    if [ -n "$prev_line" ] && [ "$prev_line" != "$last_line" ]; then
      prev_text=$(printf '%s' "$prev_line" | jq -r '.message.content[]? | select(.type=="text") | .text' 2>/dev/null || true)
      if printf '%s\n' "${prev_text}" | grep -q '## 🟢'; then
        current_short=$(printf '%s' "$text" | head -c 120 | tr '\n' ' ')
        # B2: if current_short is empty, never suppress (empty grep -qF "" matches anything)
        if [ -n "$current_short" ] && printf '%s\n' "${prev_text}" | grep -qF "${current_short}"; then
          idle_suppress=true
        fi
      fi
    fi
  fi
fi

if [ "$idle_suppress" = "true" ]; then
  exit 0
fi

# -- P-user glance-line (systemMessage field) ---------------------------------
# Shown to the USER in CC UI (not to the model). Format: 🎯 <anchor ≤60 chars>
anchor_short=$(echo "${anchor}" | head -c 60 | tr '\n' ' ')
glance_line="🎯 ${anchor_short}"

# Three branches:
#   Branch C — long answer AND a trailing fork-question: needs BOTH the work
#     recap (+ goal drift verdict) AND the recommendation-first/fork-challenge.
#     A pure long-wins collapse would drop the recommendation nudge exactly when
#     a fork is on the table — the highest-value moment for it.
#     DECISION-1=B (gated): Branch C = whole-session recap, Branch A = lighter per-turn body;
#     maintainer may switch to A by extending the recap to Branch A.
#   Branch A — long substantive answer, no question: lighter per-turn work recap.
#   Branch B — a question with no long answer body: fork-challenge + recommend-first.
#   Neither (short chatter, bare tool call) — stay silent (no reminder).
if [ "$long_text" = "false" ] && [ "$asked" = "false" ] && [ -z "$story_signal" ]; then
  exit 0
fi

if [ -n "$story_signal" ]; then
  reminder=$(aif_msg_eot_branch_story)
  printf '%s' "$story_signal" > "${TMPDIR:-/tmp}/aif-story-${session_id}" 2>/dev/null || true
elif [ "$long_text" = "true" ] && [ "$asked" = "true" ]; then
  # Branch C: whole-session recap + fork-challenge (DECISION-1=B full recap stays here)
  reminder=$(aif_msg_eot_branch_c)
elif [ "$long_text" = "true" ]; then
  # Branch A: lighter per-turn body (DECISION-1=B — whole-session recap stays in Branch C only)
  reminder=$(aif_msg_eot_branch_a)
elif [ "$asked" = "true" ]; then
  # Branch B: bare fork-question, no long body
  reminder=$(aif_msg_eot_branch_b)
fi

# `reason` is the field delivered to the MODEL when decision=block on a Stop hook
# (the agent does not stop and gets one more turn with `reason` injected — so the
# recap instruction MUST go here). `systemMessage` is user-UI only and does NOT
# reach the model. Verified dual-channel 2026-05-21: Claude Code hooks docs (Stop
# decision-control: "reason must be provided for Claude to know how to proceed")
# + WebSearch corroboration; #81's systemMessage-delivery never reached the model.
jq -n --arg msg "$reminder" --arg gl "${glance_line}" '{
  decision: "block",
  reason: $msg,
  systemMessage: $gl
}'
exit 0
