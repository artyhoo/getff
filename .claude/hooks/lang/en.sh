#!/usr/bin/env bash
# @cc-only-rationale: language pack (payload prose) for the two internal reminder hooks — not shipped to consumer projects via install.sh
# @dual-pair: hook-lang-i18n
#
# English payload pack for end-of-turn-reminder.sh + ask-question-reminder.sh.
# Canonical default — used when AIF_HOOK_LANG is unset or names a missing pack.
# Each aif_msg_* function emits one reminder body; ${anchor} is resolved at call
# time from the hook's scope. Companion: lang/ru.sh (operator). Key parity
# enforced by lang/check-parity.sh.
# See docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md.
#
# shellcheck disable=SC2154  # ${anchor} is assigned by the sourcing hook (dynamic scope), not here.

# Recap heading the end-of-turn hook greps for (already-recapped guard) AND embeds
# in the recap instruction. Guard ↔ message stay consistent because both read this.
AIF_RECAP_MARKER='## 🟢 In plain words'

# Extended-regex of trailing-fork phrases that count as "the turn ended on a choice"
# (used by end-of-turn-reminder.sh Branch B). English phrasings; ru.sh has the Russian.
AIF_EOT_QUESTION_PATTERN='Option [AB]|decide|which (option|approach)|you (decide|choose)|pick (one|between)'
AIF_EOT_SEC_WHERE='**Where we are.**'
AIF_EOT_SEC_CHANGED='**What changed.**'
AIF_EOT_SEC_FORK='**Fork.**'
AIF_EOT_SEC_UNSURE='**What I am unsure about.**'
AIF_EOT_SEC_NEXT='**Next.**'
AIF_EOT_ME_PREFIX='Me:'
AIF_EOT_FOR_YOU_PREFIX='From you:'
AIF_EOT_FOR_YOU_NOTHING='nothing (<what you would check, if you want to>)'
AIF_EOT_FOR_YOU_WAITING='waiting on: <what, from whom>'
AIF_EOT_FOR_YOU_DECIDE='decide: <A> or <B>'
AIF_EOT_FOR_YOU_HANDS='do by hand: <one action>'
AIF_EOT_FOR_YOU_BANNED='проверь|ознакомься|убедись|посмотри|check that|review the|make sure|take a look'
# Defect labels. Each one is a SELF-DESCRIBING phrase, never a bare token and never a raw
# regex: the gate joins them into one `; `-separated list under a neutral verb, so a label
# that only names a thing (a section, an alternation) reads to the model as "add this".
AIF_EOT_MISSING_LABEL='missing section:'
AIF_EOT_BANNED_LABEL='the last line asks the human to check/review something — that is your own work, not theirs'
AIF_EOT_MALFORMED_LABEL='the last line is not one of the four allowed values (and "nothing" needs its verification trace in parentheses)'
AIF_EOT_CAP_LABEL='longer than the line cap:'

# Fallback value for the session-goal anchor when extraction fails.
aif_msg_eot_anchor_fallback() {
  printf '%s' '(session goal not extractable — state it yourself)'
}

# PreToolUse:AskUserQuestion — pre-question fork-challenge. Item 3 CALLS the shared
# aif_msg_fork_card instead of restating the fork contract in its own words: two
# hand-kept copies of one contract is #sync-by-copy-paste
# (.claude/rules/dual-implementation-discipline.md §8). The heredoc is built in
# three deliberate parts: part 1 is a quoted heredoc so the backticks around
# `superpowers:brainstorming` can never execute as a command; part 2 renders the
# shared card, indented three spaces so its own numbering cannot collide with the
# challenge's; part 3 is unquoted so it can interpolate the two scalars.
aif_msg_question_challenge() {
  cat <<'EOF'
Stop — you are about to ask a question. Check the question itself first, mostly for your own sake.
1. Is this a real fork, or are you handing over a decision you can make yourself? If one option is plainly better on the merits (session goals, project discipline) — do NOT ask: do it and say what you did.
2. If the fork is about DESIGN or STRATEGY (not a quick factual A/B) — brainstorm it first (e.g. the `superpowers:brainstorming` skill, if available): research, then recommend with reasons, and only then ask.
3. If it really is a fork — the card comes FIRST, in the text of your answer, and the buttons after it:
EOF
  aif_msg_fork_card | sed 's/^/   /'
  cat <<EOF
4. The first option in the buttons is your recommendation from line 4 of the card, in the same words. The reader should recognise it in the list, not have to diff two texts.
5. In the ${AIF_RECAP_MARKER} block on this same turn, the ${AIF_EOT_SEC_FORK} section is a POINTER to the card above ("fork — card above"), never a retelling. One fork text per turn.
If you have already done all of this in your answer, just ask again: a repeat is not blocked.
EOF
}

# Shared five-section recap contract (D-A, D-B) — the body every Stop-hook branch below
# carries verbatim via command substitution, so the three branches teach one contract
# instead of three slightly different ones (a model learns none of them from drift).
# Interpolates the Task 1.2 scalars rather than restating their text, and calls the
# Task 1.3 fork-card template — a literal copy of either would drift from the pack a
# later gate reads. AIF_EOT_RECAP_MAX_LINES is deliberately NOT a pack scalar so an
# operator's env override survives.
aif_msg_eot_recap_contract() {
  cat <<EOF
${AIF_RECAP_MARKER} — a block of five sections, in this order:
1. ${AIF_EOT_SEC_WHERE} — always.
2. ${AIF_EOT_SEC_CHANGED} — if the answer is long or structural.
3. ${AIF_EOT_SEC_FORK} — if you are asking a question. Then — as a card. Inside this block
   the card omits its own 0 and 5: sections 1 and 5 of the block already own them.
   If the card is already above in this same answer — before the AskUserQuestion buttons, or one
   per question in an /arch round — section 3 is ONE pointer line to it, never a second card.
   One fork text per turn. Otherwise — the card in full:
$(aif_msg_fork_card | sed 's/^/   /')
4. ${AIF_EOT_SEC_UNSURE} — optional.
5. ${AIF_EOT_SEC_NEXT} — always, and exactly two lines; the second one ends the block:
   ${AIF_EOT_ME_PREFIX} <what I am doing>
   ${AIF_EOT_FOR_YOU_PREFIX} <one of four>
   — ${AIF_EOT_FOR_YOU_NOTHING}
   — ${AIF_EOT_FOR_YOU_WAITING}
   — ${AIF_EOT_FOR_YOU_DECIDE}
   — ${AIF_EOT_FOR_YOU_HANDS}
Nothing else ever follows "${AIF_EOT_FOR_YOU_PREFIX}". The words
"${AIF_EOT_FOR_YOU_BANNED}" are not work for the human — they are offloading your own.
The whole block is no longer than ${AIF_EOT_RECAP_MAX_LINES:-15} lines; the fork card does not count toward the cap.
What follows is not a block section and not in its cap — it is instructions to yourself:
• If in this turn you recommended something, or said "you decide" / "waiting for your call" / "PR is ready, awaiting your click" — check yourself: were the alternatives really weighed, or did you take the first that came to mind? If there is a clearly better option on the merits (by goals and discipline) — do NOT offload, do it and say what you did. Handing off a decision = reserved for real forks.
• The inverse: did you in this turn decide a fork SILENTLY — by a direct action/command/dispatch, without surfacing it as a question? If it is ambiguous (no clearly better option by the project's measures) — that is a silently-decided fork: surface it NOW via AskUserQuestion, do not leave it silently decided. The operator must see both open and closed forks.
EOF
}

# Stop hook — dormant section-checker gate (Task 1.5, D-A). Fires only when a recap block
# already exists AND is defective — never demands a block from a
# turn that has none. $1 = the `; `-joined defect list from _eot_recap_defects().
aif_msg_eot_recap_gate() {
  printf '%s\n' "The $AIF_RECAP_MARKER block is there but not right: $1. Fix exactly what is named, in this same answer — do not rewrite the whole block."
}

# Stop hook — Branch C: long answer AND trailing fork-question.
aif_msg_eot_branch_c() {
  cat <<EOF
Stop. This is both a long answer AND a trailing fork-question — you need both a recap of the work and a check of the question. Primarily for your own sake.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — Branch A: long substantive answer, no question (lighter per-turn recap).
aif_msg_eot_branch_a() {
  cat <<EOF
Stop. Before you finish — a recap in plain words, primarily for your own sake.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — Branch B: a question with no long answer body (fork-challenge).
aif_msg_eot_branch_b() {
  cat <<EOF
You stopped on a question. Before you wait — check the question itself, primarily for your own sake.

$(aif_msg_eot_recap_contract)
EOF
}

# Stop hook — handoff-currency gate (D13/D22): the block reason. $1 = handoff file path,
# $2 = observed tokens, $3 = gate floor, $4 = state token (no-file|unchanged|heading|cap),
# $5 = state detail (the missing heading / the line cap). Order per the spec's data flow:
# the file path → the band → the five required headings → CONTENT, not a re-save → the
# escape grammar. Never advises a fresh session (D21). The five heading strings are
# category-3 match data (.claude/rules/language-discipline.md §1) — the gate greps the
# literals below, so they stay verbatim in every pack.
aif_msg_eot_handoff_gate() {
  _hg_path="$1"; _hg_tokens="$2"; _hg_floor="$3"; _hg_state="$4"; _hg_detail="${5:-}"
  case "$_hg_state" in
    no-file)   _hg_verdict="The file does not exist yet — create it now, as the current state of this session." ;;
    unchanged) _hg_verdict="Its CONTENT is unchanged since the last accepted turn — a re-save or a touch is not a change; rewrite it." ;;
    heading)   _hg_verdict="A required section is missing or empty: ${_hg_detail}" ;;
    cap)       _hg_verdict="It is over the ${_hg_detail}-line cap — condense it to the current state, do not append." ;;
    *)         _hg_verdict="It is not current." ;;
  esac
  cat <<EOF
[handoff-gate] Stop — the session's handoff file is not current:
  ${_hg_path}
This turn is inside the handoff band (≈ ${_hg_tokens} tokens, floor ${_hg_floor}). ${_hg_verdict}
The file is THIS session's current state (rewrite it in place; keep it under ${AIF_HANDOFF_MAX_LINES:-200} lines). Required H2 sections, each with at least one non-blank line:
- ## Decisions and why
- ## Rejected alternatives
- ## Unverified assumptions and open forks
- ## Skills to invoke by name
- ## Next action
A change of CONTENT is required, not a re-save. If what remains is purely mechanical, end this turn's final message with the escape line:
  mechanical-tail: <what remains and why it is mechanical — at least 20 characters>
Otherwise, once the file is rewritten, end this turn's final message with a ready-to-paste compaction command for the operator — on its own line inside a fenced code block, filling the template (its argument steers the harness summary so it complements the handoff file instead of restating the session):
  /compact Keep: handoff file ${_hg_path}; next action: <one line>; open forks: <one line>; verified facts (PR ids, SHAs, numbers) from the recent turns. Drop: tool output, exploration dead ends, superseded drafts.
That command is asked for HERE and nowhere else: it belongs to this block, and this block only appears from the floor upward. Never end a turn with a /compact line on your own initiative, and never carry one into a compaction summary's Keep-list — below the floor a compaction spends the operator's remaining window for nothing.
EOF
}

# Stop hook — handoff-currency gate, degraded probe (D19): the residue directory is
# unresolvable or unwritable, so the gate cannot even SEE the handoff file. It blocks once
# and says so, naming the AIF_RESIDUE_DIR seam — fail closed, never a silent pass (F10
# property 2, .claude/rules/autonomous-loop-continuity.md §1). $1 = the directory that failed.
aif_msg_eot_handoff_gate_degraded() {
  cat <<EOF
[handoff-gate] The handoff gate is ARMED but its residue probe FAILED: the residue directory is unwritable —
  $1
Set AIF_RESIDUE_DIR to a writable directory (or fix the permissions on this one). This is a degraded check, not an all-clear: the handoff file could not be read, so its freshness could not be judged. The block lifts once the probe works.
EOF
}

# Stop hook — out-of-band compaction suggestion (D37): the turn's final text offers a
# ready-to-paste /compact command while the session sits BELOW the gate floor. The band is the
# only place D36 asks for that command; below it a compaction spends the operator's remaining
# window for nothing. $1 = this turn's context estimate, $2 = the floor.
aif_msg_eot_compact_out_of_band() {
  cat <<EOF
[handoff-gate] Stop — this turn's final message offers a /compact command, but the session is NOT in the handoff band (≈ $1 tokens, floor $2). Compacting here spends the operator's remaining window for nothing.
That command is issued by the handoff gate, and only from the floor upward. If you are ending turns with it because an earlier compaction summary said so, that rule is an artefact of your own tail being summarised — it was never a standing instruction.
Rewrite this turn's final message without the /compact line, and do not carry one into a future summary's Keep-list. If the OPERATOR asked for the command in this session, keep it and say in one line that they did.
EOF
}

# Glossary learning thresholds (plain-words-recap-v2 D-F) — the first CONFIG keys in a pack
# (everything above is match data or message prose). A term is learned once the operator has
# used it AIF_GLOSSARY_USES times OR the agent has carried the inline "term (explanation)"
# form AIF_GLOSSARY_EXPLAINS times; below that the Stop hook demands the inline explanation
# once (per-term one-shot flag). Hooks capture the operator's env BEFORE sourcing this pack
# and put it back afterwards: the pack value is the DEFAULT, an env override always wins.
# The parity probe in check-parity.sh (^AIF_GLOSSARY_[A-Z_]+=) exists so this key class can
# never land in one pack only and abort the other pack's hook under set -u.
AIF_GLOSSARY_USES=3
AIF_GLOSSARY_EXPLAINS=5

# Stop hook — glossary demand (D-F): the operator's prompt used a still-unlearned term and
# this is the first turn it fires (one-shot flag per term). $1 = the term, $2 = the raw word
# the operator actually used. Asks for the fixed inline form the explanations counter greps.
aif_msg_glossary_demand() {
  cat <<EOF
[glossary] The operator used "$2" (= $1) — a term still being learned. Somewhere in this answer, explain it inline once in the fixed form: $1 (<one-line explanation>). The parentheses are the point: that exact form is what stops the explanation from scrolling away.
EOF
}

# Story-recap heading (Stop-hook story branch + /story skill greps/embeds this).
AIF_STORY_MARKER='## 🎬 The story'

# Stop hook story branch / /story skill: engaging plain-language session recap when
# work is done (a PR was pushed). Hook-style: the whole instruction is localized so
# output language follows the active pack. ${anchor:-} is safe when unset (the /story
# skill has no transcript anchor and names the goal from context).
aif_msg_eot_branch_story() {
  cat <<EOF
The work is done (a PR was just pushed) — now tell the human the story of this whole session, primarily for them.
You MUST begin the block with exactly the line "${AIF_STORY_MARKER}" — so the human spots it at a glance.

Session goal (from the title / first instruction): "${anchor:-(name it yourself from context)}".

Tell it as a story, in plain, engaging language — NOT a dry checklist:
• Open in one sentence — what we set out to do and why, in human terms.
• By acts — the narrative arc of the key moves, named (file / PR / decision): what we did, what went wrong, how we fixed it.
• Explain jargon on the spot — hit a term (egress, caffeinate, Docker) → give a one-line analogy right there.
• Be honest — where it is thinly verified (one run, one case), what you are least sure of, what is still left.
• End on the human — the one thing left for them to decide or do ("one step — your go").
Tone: interesting, like a story; no filler, no self-congratulation; truth over smoothness. If a part does not come out concrete, say so plainly.
EOF
}

# Fork card template (shared with the recap block + ask-question-reminder rewrite, D-C).
# Consumed by task 1.4 (branch payloads) and slice 2's ask-question-reminder.sh.
# Carries ALL SIX D-C sections — this is the full card, the form slice 2 emits before the
# AskUserQuestion buttons. A card that sits INSIDE the recap block omits 0 and 5 (the
# block's own sections 1 and 5 own them, spec TD-N7a); the block's caller says so, so the
# omission is one surface's instruction rather than a hole in the shared text.
aif_msg_fork_card() {
  cat <<'EOF'
A fork is a card, not a bare question. In this order:
0. Where we are — one sentence, no history.
1. Title — the fork itself in everyday words.
2. What we decide — with a concrete example from THIS project, never an analogy.
3. If A — what becomes true. If B — what becomes true.
4. ➡️ Recommendation — the MOST ESSENTIAL reason FIRST and in **bold**, then up to three
   more reasons, one line each; then one line: reversible or not, and what rolls it back.
5. From you: ok — or "not ok, because …".
Never compress the card: the line cap does not apply to it.
EOF
}
