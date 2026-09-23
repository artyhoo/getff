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
  - { example: emit-story-instruction, stack: repo, date: 2026-09-21, result: printed }
docs-refresh: deferred — re-verified 2026-09-22, the cited sources changed only in code-comment line-number citations; no source changed its line count, and no line this page cites or quotes was touched; clears at the next gold refresh of this page
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
| description | Use when work is done / a PR was pushed, or when the user asks to recap what was done — «расскажи что сделали», «расскажи историю», story, recap, «по актам». |
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
[skill](../../terms.md#skill) asks for something you can read with pleasure: what you
set out to do, what happened act by act, what is still shaky, and the one thing left
for you to decide.

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

```text
The work is done (a PR was just pushed) — now tell the human the story of this whole session, primarily for them.
You MUST begin the block with exactly the line "## 🎬 The story" — so the human spots it at a glance.

Session goal (from the title / first instruction): "(name it yourself from context)".

Tell it as a story, in plain, engaging language — NOT a dry checklist:
• Open in one sentence — what we set out to do and why, in human terms.
• By acts — the narrative arc of the key moves, named (file / PR / decision): what we did, what went wrong, how we fixed it.
• Explain jargon on the spot — hit a term (egress, caffeinate, Docker) → give a one-line analogy right there.
• Be honest — where it is thinly verified (one run, one case), what you are least sure of, what is still left.
• End on the human — the one thing left for them to decide or do ("one step — your go").
Tone: interesting, like a story; no filler, no self-congratulation; truth over smoothness. If a part does not come out concrete, say so plainly.
```

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

- The description is line 3 of `.claude/skills/story/SKILL.md`. The posture marker is
  line 6. The three steps are lines 19 to 30, and the "must not" list is lines 47 to 53.
- The helper is `.claude/skills/story/helpers/emit-story-prompt.sh`. Line 12 picks the
  language file from `AIF_HOOK_LANG` and line 13 falls back to English.
- The instruction text is the function at line 233 of `.claude/hooks/lang/en.sh`. The
  end-of-session reminder calls the same function:
  `.claude/hooks/end-of-turn-reminder.sh`, line 1361.
- The installer delivers the language files at every depth: `setup.d/10-skills.sh`,
  lines 238 to 253. The skill itself is in the `factory` list at line 65 of
  `setup.d/lib.sh`. The reason it stays there is a product choice recorded at lines 119
  to 123 of `setup.d/10-skills.sh`.
- The skill's "with and without" sections are checked by
  `packages/core/principles/15-skill-paired-negative.test.ts`.
- The card above is built from the `story` entry in `docs/site/reference/B.json`, which
  starts at line 343.
