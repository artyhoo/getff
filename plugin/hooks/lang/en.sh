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

# Fallback value for the session-goal anchor when extraction fails.
aif_msg_eot_anchor_fallback() {
  printf '%s' '(session goal not extractable — state it yourself)'
}

# PreToolUse:AskUserQuestion — pre-question fork-challenge (no interpolation;
# quoted heredoc because the body contains backticks).
aif_msg_question_challenge() {
  cat <<'EOF'
Stop — you are about to ask a question. First check the question itself, primarily for your own sake.
1. Is this a real fork — or are you offloading a decision you could make yourself? If one option is clearly better on the merits (by the session's goals and the project's discipline) — do NOT ask: do it and say what you did.
2. If it is a real fork — lead with YOUR reasoned recommendation first: "I recommend <option>, because <reason against the goals and trade-offs>", then the alternatives briefly. The human decides.
3. In plain words: what exactly are we deciding and why does it block — on a concrete example, not a restatement of the question text.
4. If this is a DESIGN/STRATEGY fork (not a quick A/B over facts) — run a structured brainstorm (e.g. the `superpowers:brainstorming` skill, if available) instead of a bare card: explore → recommend with arguments, then ask. A bare card on a design fork reads as "AI punted".
If all of this is already done in your answer — just ask the question again: the repeat is not blocked.
EOF
}

# Stop hook — Branch C: long answer AND trailing fork-question.
aif_msg_eot_branch_c() {
  cat <<EOF
Stop. This is both a long answer AND a trailing fork-question — you need both a recap of the work and a check of the question. Primarily for your own sake.
You MUST begin the block with exactly the line "${AIF_RECAP_MARKER}" — so the human spots it at a glance.
(If you cannot say it simply, concretely and as a whole — what/why/how → you have not fully understood it yourself; this is a diagnostic, not a report.)

Session goal (from the session title / first instruction): "${anchor}".

First 2 lines — so a human with no context gets it at a glance:
• What the session is doing AS A WHOLE — in one phrase (not "what I just edited").
• Whether it is on goal — pick ONE: ON GOAL / DRIFTED INTO <topic> (and why) / DELIBERATELY PIVOTED to <topic> (and what for). Not "seems on goal".

Then — about the WHOLE session, NOT the last turn:
• Why we are doing this — the overall goal in your own words (not a restatement of the title): which task we are closing and why it matters.
• What is done toward that goal — CUMULATIVELY, step by step with names (file/PR/decision): everything significant across the session, not just the last change.
• What is ahead — EVERYTHING left until the goal, point by point: not one next step but the whole tail. If near the end — say so.
• What you are least sure of — one thing to re-check (or honestly "none").
• Where the session contradicts itself — name the gap between the stated goal and what actually came out, or the spot where the work undermines its own premise (like "a project against doc-bloat that itself bloated into doc-bloat"). This is "documents lie; tests don't" turned on the recap itself. No real gap — skip it: forced irony is worse than none.

On the question:
1. Is this a real fork — or am I offloading a decision I could make myself? One option clearly better on the merits (by the session's goals and discipline) → do NOT ask: do it and say what you did.
2. If it is a real fork — lead with MY reasoned recommendation first: "I recommend <option>, because <reason against the goals and trade-offs>". Then the alternatives briefly. The human decides.
If any point does not come out concrete → say so plainly, do not pad with water.
EOF
}

# Stop hook — Branch A: long substantive answer, no question (lighter per-turn recap).
aif_msg_eot_branch_a() {
  cat <<EOF
Stop. Before you finish — a recap in plain words, primarily for your own sake.
You MUST begin the block with exactly the line "${AIF_RECAP_MARKER}" — so the human spots it at a glance.
(If you cannot say it simply, concretely and as a whole — what/why/how → you have not fully understood it yourself; this is a diagnostic, not a report.)

Session goal (from the session title / first instruction): "${anchor}".

First 2 lines — so a human with no context gets it at a glance:
• What I am doing right now — in one phrase, in plain language.
• Whether I am on goal — pick ONE: ON GOAL / DRIFTED INTO <topic> (and why) / DELIBERATELY PIVOTED to <topic> (and what for). Not "seems on goal".

Then for your own sake, point by point, with names (file/function/decision), no water:
• What I just did — the concrete change, not a restatement of the task.
• Non-trivial decisions — "chose X over Y because Z", or honestly "there were none".
• What I am least sure of — name ONE thing worth re-checking.
• The next step and why it is next.
• If in this turn you recommended something, or said "you decide" / "waiting for your call" / "PR is ready, awaiting your click" — check yourself: were the alternatives really weighed, or did you take the first that came to mind? If there is a clearly better option on the merits (by goals and discipline) — do NOT offload, do it and say what you did. Handing off a decision = reserved for real forks.
• The inverse: did you in this turn decide a fork SILENTLY — by a direct action/command/dispatch, without surfacing it as a question? If it is ambiguous (no clearly better option by the project's measures) — that is a silently-decided fork: surface it NOW via AskUserQuestion, do not leave it silently decided. The operator must see both open and closed forks.
If any point does not come out concrete → say so plainly, do not pad with water.
EOF
}

# Stop hook — Branch B: a question with no long answer body (fork-challenge).
aif_msg_eot_branch_b() {
  cat <<EOF
You stopped on a question. Before you wait — check the question itself, primarily for your own sake.
You MUST begin the block with exactly the line "${AIF_RECAP_MARKER}".

Session goal: "${anchor}".

1. Is this a real fork — or am I offloading a decision I could make myself? If one option is clearly better on the merits (by the session's goals and the project's discipline) — do NOT ask: do it and say what you did. Reserve the question for forks where you honestly cannot pick on the measures.
2. If it is a real fork — lead with MY reasoned recommendation first: "I recommend <option>, because <reason against the goals and trade-offs>". Then the alternatives briefly. The human decides.
3. In plain words: what exactly are we deciding and why does it block — on a simple example, not a restatement of the question text.
If the crux of the choice cannot be explained simply → the question itself is imprecisely framed: say so.
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
