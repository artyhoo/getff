---
title: arch skill
description: The skill you start with /arch to take a raw idea through a design conversation, two independent reviews of the design, and a clear decision about who builds it.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/skills/arch/SKILL.md
  - .claude/skills/arch/references/grilling.md
  - .claude/skills/arch/references/domain-modeling.md
  - CONTEXT.md
  - setup
  - setup.d/10-skills.sh
  - setup.d/companions.manifest
  - setup.d/lib.sh
  - docs/site/guides/add-design-and-review-skills.md
  - docs/site/reference/B.json
  - docs/site/reference/B.md
  - docs/site/terms.md
  - packages/core/principles/15-skill-paired-negative.test.ts
  - tests/install-sh/baselines/ts-server/greenfield.fingerprint
docs-refresh: deferred — re-verified 2026-09-24, the cited install fingerprint changed only two hash values (the end-of-turn-reminder hook and the refresh baseline) with no line added or removed; lines 42 to 45 this page cites are byte-identical; clears at the next gold refresh of this page
executed:
  - { example: show-arch-invocation-lines, stack: ts-server, date: 2026-09-21, result: printed }
---

# arch skill

## Fact card

What each row means: [how to read a fact card](../B.md#how-to-read-a-fact-card).

<!-- vale off -->
<!-- vale-reason: the description row is the skill's own frontmatter, quoted verbatim, including maintainer jargon and Russian trigger words -->

<!-- getff:begin section=B-card-arch plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `arch` |
| kind | skill |
| ships-to | env: react-native, react-next, react-spa, ts-server |
| description | Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Triggers: /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff, research contour, research-spec, distillate, исследовательский контур. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (superpowers:brainstorming). |
| source | `.claude/skills/arch/SKILL.md:3` |
| invocation | slash-only |
| posture | cc-native-with-fallback |
| operator-twin | .claude/skills/arch/SKILL.md |
<!-- getff:end section=B-card-arch -->

<!-- vale on -->

## Explanation

This is one of the [skills](../B.md) getff installs at the `env`
[depth](../../terms.md#depth). A design that sounds right in conversation can still be
wrong, and the cheapest moment to find out is before anyone writes code. This
[skill](../../terms.md#skill) runs one fixed path from idea to handoff. The design gets
read by two reviewers who never saw your conversation, so they cannot share its blind
spots.

You start it yourself. Type `/arch` and a topic, or `/arch` and the path to a notes file.
The agent never starts it, because the skill file sets `disable-model-invocation: true`.
Run it in a session with the strongest model you have.

The path has three parts, plus an optional research pass before the first one:

1. **Design.** The skill hands the conversation to `superpowers:brainstorming`, a skill
   from the separate superpowers plugin, and changes nothing in it. The resulting design
   document must also carry a table of every decision, each with a note on what would
   prove it wrong.
2. **Two cold reviews.** Two read-only [sub-agents](../../terms.md#sub-agent) receive
   file paths only. One reads from the top: does the design serve the goal? One reads
   from the bottom: do the named files and APIs exist? Each answers `GO`, `REVISE`, or
   `STOP`. The two reports stay side by side and are never merged. After two `REVISE`
   rounds the disagreement comes to you.
3. **Exit.** A tiny change is just made. Work that needs you close by goes on in the
   same session as a written plan. Bulky work becomes a written task brief for a task
   runtime.

The research pass is for ideas in unfamiliar ground. It requires two lines before any
code: what would make the idea fail, and what test would prove it wrong.

To check the two lines that make the skill manual, in a project installed at `env`:

```bash
grep -n '^disable-model-invocation\|^argument-hint' .claude/skills/arch/SKILL.md
```

```text
5:argument-hint: '<topic | path/to/prep-doc.md>'
6:disable-model-invocation: true
```

What the skill does not do: it writes no code and reviews no code. It is part of the
[soft layer](../../terms.md#soft-layer-and-hard-layer), so no [gate](../../terms.md#gate)
checks that a part was run. The file was written for the people who maintain getff, and
its wording shows it. It cites getff's own planning documents, which the installed copy
links on GitHub. The research pass and the task-brief exit expect `aif-handoff`, a
separate task runtime whose connection arrives only at the `factory` depth. Without it,
the skill says the exit falls back to work in the same session. It also leans on outside
plugins that are optional. The `setup` wrapper offers one of them, superpowers, as a
companion. The question pacing came from a second plugin, `mattpocock-skills`. The
installer does not offer that one. Instead the two skills getff uses from it travel
with getff, as copies of their text inside the arch skill's own folder. One paces the
questions. The other pins down what the words of an idea mean: it records them in the
project glossary, `CONTEXT.md`, and writes short decision records. When the plugin is
absent, the agent reads those copies and works the same way. A `core`
install does not include this skill. The guide
[Add the design and review skills](../../guides/add-design-and-review-skills.md) shows
how to get it.

## Evidence

- In `.claude/skills/arch/SKILL.md`: the description is line 3, the manual-only flag is
  line 6, and the fallbacks are line 22. The design part is lines 42 to 55, the research
  pass is lines 56 to 88, the two reviews are lines 89 to 111, and the three exits are
  lines 123 to 127.
- The skill is in `GETFF_SKILLS_ENV`, line 64 of `setup.d/lib.sh`. Lines 164 to 168 of
  `setup.d/10-skills.sh` copy that list at `env` and `factory`, or with `--with-aif-suite`. Lines 79 to 82 there
  say why it sits at `env`.
- The superpowers plugin is an optional companion: line 17 of `setup.d/companions.manifest`.
- The question-pacing plugin is named on line 50 of `.claude/skills/arch/SKILL.md`,
  together with the copy that stands in for it. The copy is
  `.claude/skills/arch/references/grilling.md`; its provenance table is lines 31 to 38,
  and lines 16 to 27 say why the plugin is not offered.
- The word-meaning moves, the four rules `/arch` lays over them and the two upstream parts it
  leaves out are all on line 54 of `.claude/skills/arch/SKILL.md`. Their copy is `.claude/skills/arch/references/domain-modeling.md`, with its provenance table at
  lines 22 to 29 and its two format files beside it.
- The copies ship with the skill: they are listed in
  `tests/install-sh/baselines/ts-server/greenfield.fingerprint`, lines 42 to 45.
  `setup.d/companions.manifest` has no row for the plugin.
- `ships-to` is measured: the skill's file is listed in
  `tests/install-sh/baselines/ts-server/greenfield.fingerprint`, a default install.
- The card is built from `docs/site/reference/B.json`. The "with and without" sections
  are required by `packages/core/principles/15-skill-paired-negative.test.ts`.
