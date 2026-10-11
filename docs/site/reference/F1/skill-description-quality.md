---
title: skill-description-quality rule
description: The rule that a skill's description is routing-load-bearing — it must distinguish the skill from its peers and name a concrete trigger — with a quality gate deliberately deferred until wrong-skill routing incidents prove a test would not be theatre.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/skill-description-quality.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/48-skill-description-budget.test.ts
  - packages/core/principles/14-skill-drift-detection.test.ts
  - packages/core/principles/15-skill-paired-negative.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: description-tests-present, stack: repo, date: 2026-10-11, result: budget-pair-only }
---

# skill-description-quality rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-skill-description-quality plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `skill-description-quality` |
| kind | rule |
| ships-to | framework |
| description | SKILL.md `description` field quality discipline — §1 the problem and evidence, §2 the deferred discipline and its rationale, §3 promotion criterion (≥3 misrouting incidents / 6 months), §4 §1.7 self-reflexive note, §5 see-also. |
| source | `.agents/rules/skill-description-quality.md:15` |
| class | C |
| fires | authoring/updating any SKILL.md `description` field. |
| channels | paths:(2), edit-time inject |
<!-- getff:end section=F1-card-skill-description-quality -->

<!-- vale on -->

## Explanation

When an agent decides which skill to load, it routes primarily on one line: the
`description` field at the top of the skill's definition file. That line is not
metadata — it is the router's input. The measured evidence this
[rule](../../terms.md#rule) cites: hide the skill bodies, route on descriptions
alone, and task-routing accuracy drops by 31 to 44 percentage points. A vague
description does not fail loudly; it silently sends tasks to the wrong skill, or to
no skill at all.

The rule states what quality means — the description must distinguish the skill
from its peers in the registry, and the trigger section must enumerate at least one
concrete phrase or condition under which the skill applies — and then does
something rarer: it declines to build the gate, in writing. Deferred per a
recorded decision, the reasoning is that no wrong-skill routing incident had been recorded,
and a structural proxy (a minimum length, a non-empty trigger) would pass even for
low-quality descriptions that are merely long — the shape-of-diligence failure the
framework names discipline theatre. The expectations are enforced at review time,
not by a [gate](../../terms.md#gate), and the rule's own text says exactly that.

What does exist around this rule is worth naming precisely, because the
neighboring tests look tempting to over-claim. Two principles check structural
presence: frontmatter fields exist and have not drifted, and paired-negative blocks
are present — a description reading `"Helper"` passes both. The principles
directory also carries a budget test that landed after this rule's deferral:

```bash
ls packages/core/principles/ | grep "description"
```

```text
48-skill-description-budget.test.ts
48-skill-description-budget.ts
```

Principle 48 bounds the field's size. It does not judge whether a description
distinguishes the skill from its peers — the semantic question this rule owns —
and the rule's quality concern stays open alongside it. Naming the boundary here is
the point: nothing in the tree currently decides distinctiveness, which is exactly
what the Class-C row discloses.

The promotion criterion is incident-driven and specific: three documented
wrong-skill routing incidents in six months, each with evidence tracing the routing failure
to description quality — and the eventual test must be semantic (curated
positive/negative description examples per skill), never a structural proxy.

What the rule does not do: it cannot make routing unambiguous — no check reads a
description and scores distinctiveness; review time carries the whole discipline.
And it applies forward, at authoring time; existing skills are not retroactively
invalidated.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-C header with the deferral decision and its date:
  `.claude/rules/skill-description-quality.md:13`.
- The origin (the SkillRouter finding, recorded but never codified): `:18`.
- `§1` the problem and the measured evidence: `:20` to `:26` — routing on the
  description field at `:22`, the 31–44pp drop at `:24`, principles 14/15 being
  structural-only at `:26`.
- `§2` the deferred discipline: `:28` to `:42` — the three deferral reasons at
  `:32` to `:34`, the author expectations at `:36` to `:40`, and the "enforced at
  review time, not by a gate" line at `:42`.
- `§3` the promotion criterion and the semantic-not-structural requirement:
  `:44` to `:50`.
- The structural neighbors the rule names:
  `packages/core/principles/14-skill-drift-detection.test.ts`,
  `packages/core/principles/15-skill-paired-negative.test.ts` (both
  referenced from `:16`).
- The budget pair the grep above finds:
  `packages/core/principles/48-skill-description-budget.test.ts:86` (suite),
  `:101` (extractor describe) — a size budget, not a quality judge.
- The scope markers: `:3` to `:6` (`paths:` frontmatter), `:8` (`<!-- globs: -->`),
  `:9` (`<!-- inject: -->`).
- The index row grading this rule class `C` with channels `paths:(2), edit-time
  inject`: `.claude/rules/00-rule-index.md:37`.
