---
title: autonomous-loop-continuity rule
description: The rule that an unattended turn does not end while work is still in flight, and that a monitor gone quiet is never read as an all-clear.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/rules/autonomous-loop-continuity.md
  - .claude/rules/00-rule-index.md
  - .claude/hooks/end-of-turn-reminder.sh
  - .claude/hooks/inject-session-bootstrap.sh
  - packages/core/hooks/end-of-turn-reminder.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: f10-arm-and-opt-in-gates, stack: repo, date: 2026-10-07, result: printed }
---

# autonomous-loop-continuity rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-autonomous-loop-continuity plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `autonomous-loop-continuity` |
| kind | rule |
| ships-to | framework |
| description | the autonomous-loop continuity discipline — §1 the stop rule and its mechanism, §2 the wait rule (silence ≠ health), §3 anti-patterns, §4 promotion / retirement. |
| source | `.agents/rules/autonomous-loop-continuity.md:12` |
| class | B |
| fires | unattended turn ending with work in flight. |
| channels | hook, digest |
<!-- getff:end section=F1-card-autonomous-loop-continuity -->

<!-- vale on -->

## Explanation

When a session runs unattended, its weakest moment is the end of a turn. The model
writes a tidy report, the turn stops, and any job still running has nobody waiting
on it. This [rule](../../terms.md#rule) exists because that happened twice in one
day in the getff repository: once with the loop switched off, once with it armed
while every turn still ended on a report. The operator caught both. The rule's
answer is not "try harder" — it is a check placed at the exact moment the failure
happens.

The stop rule says an unattended turn must not end merely because there is
something reportable. The `hook` [channel](../../terms.md#channel) in the card is
the mechanism behind that sentence: a Stop hook arm, active only when the session
sets `AIF_AUTONOMOUS=1`. At the moment the model wants to stop, the arm asks the
task queue whether anything is still in flight. If yes, it answers `block`, and
the turn does not end — the model continues instead. A rule file read at session
start cannot do this, because by the time it matters the model has already decided
to stop.

Here are the two halves of the mechanism in the shipped hooks:

```bash
grep -n "F10 anchor" .claude/hooks/end-of-turn-reminder.sh
grep -n 'AIF_AUTONOMOUS:-0' .claude/hooks/end-of-turn-reminder.sh .claude/hooks/inject-session-bootstrap.sh
```

```text
118:# #F10 anchor — channel token for .claude/rules/autonomous-loop-continuity.md
.claude/hooks/end-of-turn-reminder.sh:164:if [ "${AIF_AUTONOMOUS:-0}" = "1" ]; then
.claude/hooks/inject-session-bootstrap.sh:152:if [ "${AIF_AUTONOMOUS:-0}" = "1" ]; then
```

The first line is the anchor the rule's channel marker points at. The other two
show the opt-in gate in both hooks: without `AIF_AUTONOMOUS=1` nothing changes,
so an interactive session pays nothing.

Three properties make the arm safe rather than clever. It blocks at most once per
stop chain, so it cannot spin. It fails closed — if the queue cannot be reached,
it still blocks, and says so, rather than reading a broken probe as an all-clear.
And it is off by default.

The second half is the wait rule: a monitor that has died and a monitor with
nothing to report look identical. So any wait the loop depends on must use a
bounded waiter that always ends with a verdict — done, timeout, or error — never
a quiet watch. The class row is `B`: the hook half is a real mechanism with
paired self-tests, and the prose half (an always-on reminder block) is delivered
reliably but is honestly labelled prose, not a gate.

What the rule does not do: it cannot stop an interactive session from ending,
and it does not judge whether the remaining work is worth doing — deciding that
is judgment no hook can make. Its own file records one residual gap: a wait with
no timeout can still hang if a socket stays open silently, so the rule tells you
to always pass `--timeout-ms` until that gap is closed.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in.

- The stop rule and its block mechanism: `.claude/rules/autonomous-loop-continuity.md:19`
  (the rule) and `:24` to `:28` (the Stop hook returns `block`, the turn does not end).
- The three safety properties (one block per chain, fail closed, off by default):
  `:36` to `:45`.
- The wait rule and its residual no-watchdog gap: `:49` and `:61` to `:67`.
- The hook arm and its anchor: `.claude/hooks/end-of-turn-reminder.sh:117` names
  the arm, `:118` carries the `#F10` anchor the rule's channel marker points to,
  `:164` is the opt-in gate, and `:215` is the continuation text the model receives.
- The always-on digest arm: `.claude/hooks/inject-session-bootstrap.sh:133`
  (the autonomy block) and `:152` (the same opt-in gate).
- Paired self-tests for the arm ship at
  `packages/core/hooks/end-of-turn-reminder.test.ts`; a count of `test(`/`it(`
  declarations in that file returns 162.
- The index row grading this rule class `B` with channels `hook, digest`:
  `.claude/rules/00-rule-index.md:13`.
