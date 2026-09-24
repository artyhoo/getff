---
title: story skill
description: The skill that makes your agent close a session with a plain-language story of what happened, instead of a dense status checklist.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/story/SKILL.md
  - .claude/skills/story/helpers/emit-story-prompt.sh
  - .claude/hooks/lang/en.sh
  - .claude/hooks/end-of-turn-reminder.sh
  - setup.d/10-skills.sh
  - setup.d/lib.sh
  - packages/core/principles/15-skill-paired-negative.test.ts
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
executed:
  - { example: emit-story-instruction, stack: repo, date: 2026-09-23, result: printed }
docs-refresh: deferred — re-verified 2026-09-24, the only change to the cited setup.d/10-skills.sh in this range swaps two in-comment pointers (arch/SKILL.md line 94 becomes the «Effort-worthiness» paragraph name) with the line count unchanged, so every line number this page cites still holds; clears at the next gold refresh of this page
---

# story skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including its Russian wake phrases -->

<!-- getff:begin section=B-card-story plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `story` |
| kind | skill |
| ships-to | no lane (no-lane) |
| description | Use when work is done / a PR was pushed, or when the user asks to recap what was done — «расскажи что сделали», «расскажи историю», «что изменилось за сессию», story, recap. |
| source | `.claude/skills/story/SKILL.md:3` |
| invocation | auto |
| posture | cc-native-with-fallback |
| operator-twin | .claude/skills/story/SKILL.md |
<!-- getff:end section=B-card-story -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `factory`
[depth](../../terms.md#depth). After a long agent session you often get a dense status
list that was written for the agent's own bookkeeping. This
[skill](../../terms.md#skill) asks for something you can read with pleasure: why the
work was done, what is different now, what was decided and by whom, what is still
shaky, and the one thing left for you to decide.

The agent picks the skill up by itself. Its description wakes it when work is done, when
a pull request was pushed, or when you ask for a recap. You can also type `/story`.

The card says `ships-to: no lane`. What is true: the skill installs when you pass
`--profile factory` or `--with-aif-suite`. The [family overview](../B.md) explains why
the card reads otherwise.

Inside, the skill is three short steps. The agent runs a small helper script that prints
the story instruction, tells the story as that instruction says, and keeps the
instruction's language. The text lives in one language file, which the installer
delivers at every depth. An end-of-session reminder reads the same file, so the two
never drift apart. English is the default. Set `AIF_HOOK_LANG=ru` for Russian.

Here is the helper, run from the getff repository itself:

```bash
AIF_HOOK_LANG=en bash .claude/skills/story/helpers/emit-story-prompt.sh
```

<!-- vale off -->
<!-- vale-reason: the block below is the helper's own printed output, pasted verbatim, Russian offloading words included -->

```text
The work is done (a PR was just pushed) — now tell the human what this whole session changed, primarily for them.
You MUST begin the block with exactly the line "## 🎬 What changed this session" — so the human spots it at a glance.

Session goal (from the title / first instruction): "(name it yourself from context)".

The same five-section recap as every turn, session-scale — one block, in this order:
1. **Why all this was.** — always, one sentence: what this was for, in human terms.
2. **What is different now.** — per change: before, after, what it gives the operator; no chronology.
3. **What was decided and by whom.** — one line each, and who decided (you / me).
4. **What I am least sure about.** — where it is thinly verified (one run, one case), what is still left.
5. **Next.** — always, and exactly two lines; the second one ends the block:
   Me: <what I am doing>
   From you: <one of four>
   — nothing (<what you would check, if you want to>)
   — waiting on: <what, from whom>
   — decide: <A> or <B>
   — do by hand: <one action>
Nothing else ever follows "From you:". The words
"проверь|ознакомься|убедись|посмотри|check that|review the|make sure|take a look" are not work for the human — they are offloading your own.
Outside the sections, how to write:
• Short sentences, at most 25 words. Split a long one in two instead of chaining clauses with colons, dashes and parentheses. Bad: "The test failed — the assert expected the old text (fixed it), green now". Good: "The test failed: the assert expected the old text. I fixed it. The test is green."
• One idea per sentence. Bad: "Fixed X, but CI is red because of Y". Good: "Fixed X. CI is red: Y."
• Write a CONTEXT.md term bare, as the glossary spells it, and never replace it with a paraphrase. Say jargon that is not in the glossary in plain words. Bad: "did a merge-forward". Good: "merged fresh staging into the branch".
Tone: plain and concrete; no filler, no self-congratulation; truth over smoothness. If a part does not come out concrete, say so plainly.
```

<!-- vale on -->

That output is what the agent reads. What you see afterwards is a block that starts
with the marker line it names. The card's `posture` row says the skill leans on two
[Claude Code](../../terms.md#claude-code) features: running a script from inside a
skill, and the end-of-session reminder. In another agent you run the helper by hand, as
above, and ask for the story yourself.

What the skill does not do: it checks nothing and blocks nothing. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer). The story is the agent's own
account of its work, so treat it as a readable summary, not as proof. The instruction
asks the agent to name what is thinly verified, but nothing tests that it did.

## Evidence

- The description is line 3 of `.claude/skills/story/SKILL.md`, and carries the
  «что изменилось за сессию» session-recap trigger among its match data. The posture
  marker is line 6. The three steps are lines 19 to 31, and the "must not" list is
  lines 48 to 54.
- The helper is `.claude/skills/story/helpers/emit-story-prompt.sh`. Line 12 picks the
  language file from `AIF_HOOK_LANG` and line 13 falls back to English.
- The instruction text is the story branch at line 271 of `.claude/hooks/lang/en.sh`,
  which renders the shared recap sections from line 81 in session scope. The
  end-of-session reminder calls the same branch:
  `.claude/hooks/end-of-turn-reminder.sh`, line 1348.
- The installer delivers the language files at every depth: `setup.d/10-skills.sh`,
  lines 238 to 253. The skill itself is in the `factory` list at line 65 of
  `setup.d/lib.sh`. Why it stays there, a product choice rather than a blocker fix, is
  recorded at lines 119 to 123 of `setup.d/10-skills.sh`.
- The skill's "with and without" sections are checked by
  `packages/core/principles/15-skill-paired-negative.test.ts`.
- The card above is built from the `story` entry in `docs/site/reference/B.json`, which
  starts at line 342.
