---
title: ask-question-reminder hook
description: The moment your agent is about to ask you a question, this hook denies it once and hands back a fork-challenge — is this a real fork, or a decision you are handing over?
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/hooks/ask-question-reminder.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/hooks/lang/en.sh
  - .claude/rules/zcode-parity-doctrine.md
  - .claude/settings.json
  - docs/site/reference/D.json
  - docs/site/reference/D.md
  - docs/site/terms.md
  - plugin/hooks/hooks.json
  - setup.d/10-skills.sh
executed:
  - { example: ask-question-reminder-challenge-denies-the-first-question, stack: repo, date: 2026-09-25, result: printed }
  - { example: ask-question-reminder-retry-passes-silently, stack: repo, date: 2026-09-25, result: silent }
  - { example: ask-question-reminder-ignores-other-tools, stack: repo, date: 2026-09-25, result: silent }
docs-refresh: deferred — re-verified 2026-09-25, page authored from the cited sources at this pin; clears at the next refresh of this page
---

# ask-question-reminder hook

## Fact card

What each row means: [how to read a fact card](../D.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the card quotes the hook's own header line and registration JSON verbatim -->

<!-- getff:begin section=D-card-ask-question-reminder plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `ask-question-reminder` |
| kind | hook |
| ships-to | framework: react-native, react-next, react-spa, ts-server |
| description | PreToolUse:AskUserQuestion hook — pre-question fork-challenge nudge (consumer-safe session UX) |
| source | `.claude/hooks/ask-question-reminder.sh:2` |
| event | `["PreToolUse"]` |
| matcher | `["AskUserQuestion"]` |
| delivery | `["@dual-pair:hook-lang-i18n (spec: docs/superpowers/specs/2026-06-01-hook-lang-i18n-design.md)","@cc-only-rationale","plugin"]` |
<!-- getff:end section=D-card-ask-question-reminder -->

<!-- vale on -->

## Explanation

A question costs your attention, so the framework treats asking as an action worth
challenging once. When your agent reaches for the question buttons, this hook denies
the call one time and returns the challenge in the denial's reason: is this a real
fork? Did you brainstorm the design space first? Is the recommendation card written
*before* the buttons? The very next attempt goes through — the point was never to
stop the question, only to make the model look at it.

Here is the challenge, captured live (the reason text is the English language pack's
`aif_msg_question_challenge`; shown cut short where the card grammar it embeds
begins):

```bash
printf '%s' '{"tool_name":"AskUserQuestion","session_id":"docs-demo-aqr-1"}' \
  | bash .claude/hooks/ask-question-reminder.sh
```

```text
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Stop — you are about to ask a question. Check the question itself first, mostly for your own sake.\n1. Is this a real fork, or are you handing over a decision you can make yourself? …"
  }
}
```

Note the shape, because it is unlike the PostToolUse gates in this family: the exit
code is 0, and the refusal rides *inside* the JSON as `permissionDecision: "deny"`.
That is the PreToolUse contract — a documented one, which is exactly why the check
lives here. The hook's header records the measurement behind the placement (lines
15-20): a [Stop](../../terms.md#channel) event does not reliably fire when a turn
ends in a question, so the end-of-turn recap never reached the model at the one
moment it mattered. The two hooks are companions — end of turn gets the recap;
the moment before a question gets this challenge (lines 11-14).

The retry passes, silently:

```bash
printf '%s' '{"tool_name":"AskUserQuestion","session_id":"docs-demo-aqr-1"}' \
  | bash .claude/hooks/ask-question-reminder.sh
```

```text
(nothing — exit 0)
```

So does anything that is not a question at all — the hook re-checks the tool name
even though the registration already narrows it (lines 57-61):

```bash
printf '%s' '{"tool_name":"Bash","session_id":"docs-demo-aqr-3"}' \
  | bash .claude/hooks/ask-question-reminder.sh
```

```text
(nothing — exit 0)
```

The one-question-one-challenge behaviour is a small state machine, not a counter
(lines 63-91): the challenge writes a `challenged` flag for the session; the next
attempt consumes it into `passed`; questions within 45 seconds of a pass count as
the same question moment and go through; a challenge older than ten minutes is an
abandoned moment and gets re-challenged. The header (lines 22-37) records why the
guard is count-based rather than time-based — a measured 45-second window was too
short for a regenerated question card and denied the same retry four times.

Delivery, per the card: your install copies the hook and registers it
(`setup.d/10-skills.sh:318-326`), which is why the ships-to row names real stacks;
the framework registers it too (`.claude/settings.json:85` matcher, command at line
89) as does the plugin registry (`plugin/hooks/hooks.json:43`). The challenge text
speaks your language when the operator sets `AIF_HOOK_LANG=ru` — the `@dual-pair`
marker on this hook anchors the English/Russian language-pack pair, not a
portability twin (lines 3-5). And if `jq` is missing on a minimal consumer box, the
hook exits 0 silently by design (lines 40-43): error-spamming every question a
consumer's agent ever asks would be worse than a missing nudge.

## Evidence

- `.claude/hooks/ask-question-reminder.sh:2` is the header the card's description
  row quotes: `# ask-question-reminder.sh — PreToolUse:AskUserQuestion hook — pre-question fork-challenge nudge (consumer-safe session UX)`.
  Lines 3-9 carry the `@cc-only-rationale` marker and the consumer-safe note (GH
  #934).
- The deny emit is lines 99-105 — `permissionDecision: "deny"` with the challenge
  as `permissionDecisionReason`, exit 0; the dual-channel verification of that
  contract is recorded at lines 18-20.
- Two-state guard: `window=45` and `challenge_ttl=600` at lines 65-66; the
  challenged branch (lines 82-87) writes `passed` and exits 0; the passed branch's
  45-second recency window is lines 88-90; the fresh challenge write is line 95.
- Loop safety reasoning: header lines 22-37 — «No deny loop by construction: every
  deny (re)writes a fresh "challenged" state»; the measured 4-consecutive-denies
  incident that killed the pure time window is lines 25-28.
- Tool-name re-check: lines 56-61, with the defensive rationale in the comment.
- Language pack: lines 45-52 — `${AIF_HOOK_LANG:-en}` with a hard English fallback;
  the challenge text lives in `.claude/hooks/lang/en.sh` (`aif_msg_question_challenge`
  at line 60, `AIF_RECAP_MARKER` at line 16).
- jq-absent posture: lines 40-43 — silent exit 0, «never error-spam a consumer's
  every AskUserQuestion».
- Registration: `.claude/settings.json:85` reads `"matcher": "AskUserQuestion"`
  with the command at line 89; plugin registration at `plugin/hooks/hooks.json:43`;
  consumer install copies the file and registers it at `setup.d/10-skills.sh:318-326`.
- ZCode: the parity census row 2 (`.claude/rules/zcode-parity-doctrine.md` §2)
  classifies this hook `parity` — the PreToolUse event and the AskUserQuestion
  matcher both exist there.
