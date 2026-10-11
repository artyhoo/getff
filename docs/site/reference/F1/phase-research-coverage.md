---
title: phase-research-coverage rule
description: The rule that a research claim of absence is a claim to verify — a named checklist of searches, an adversarial pass on every "nothing exists" claim, and a self-review section on every research patch.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/phase-research-coverage.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/13-phase-research-coverage-s17.test.ts
  - .agents/rules/recommendation-laziness-discipline.md
  - docs/site/reference/F1/recommendation-laziness-discipline.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: checklist-item-count, stack: repo, date: 2026-10-11, result: 24-numbered-items }
---

# phase-research-coverage rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-phase-research-coverage plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `phase-research-coverage` |
| kind | rule |
| ships-to | framework |
| description | searching-layer discipline rule — §1 coverage methodology checklist, §2 self-reflection prompts for retros, §3 research-patches/ accumulator format (mirrors AIF /aif-evolve), §4 named anti-patterns for fast pattern-match. |
| source | `.agents/rules/phase-research-coverage.md:14` |
| class | A |
| fires | phase research, prior-art lookups, negative-existence claims. |
| channels | paths:(4) |
<!-- getff:end section=F1-card-phase-research-coverage -->

<!-- vale on -->

## Explanation

The costliest research failures are not wrong answers — they are confident
absences. "No production tool does X" closes a design conversation, routes a project
toward building what already exists, and leaves no trace of the search that (often
barely) preceded it. This [rule](../../terms.md#rule) is the framework's
methodology for not doing that: a numbered checklist of searches that must run
before a coverage claim closes — an own-stack sweep, a category sweep, a
semantic-distance check, an adversarial pass on every negative-existence claim, and
more, each item naming the concrete probe that satisfies it.

The checklist is widely known by a historical name — "the 6-item checklist" — that
no longer matches its size. The name calcified when the list had six items and was
never renamed as items accrued; the rule file carries an explicit naming note
declaring the name an identifier, not a count. The live count of numbered items
across the checklist and its subsections:

```bash
grep -cE "^[0-9]+\. \*\*" .claude/rules/phase-research-coverage.md
```

```text
24
```

Twenty-four. The largest additions came from a verification subsection added after a
pattern of state-claims rotting — "not yet shipped" that had in fact shipped, an
absence asserted from truncated output, a worker's correction adopted without
re-running the cited command. Each of those items is itself a named probe: re-derive
a computed number from its raw inputs, assert absence from a count rather than a
scrolled list, check source history per file before claiming code never existed.

The `class` row is `A`: the companion test ships. Its subject is the rule's
self-review obligation — every research patch must carry a `§1.7` section saying how
the patch's own search could have been the one that missed something — and it guards
its own population:

```bash
grep -nE "^\s*(describe|it)\(" packages/core/principles/13-phase-research-coverage-s17.test.ts | head -4
```

```text
123:describe('Principle 13 — every post-cutoff research patch has a §1.7 self-review section', () => {
124:  it('all non-exempt patch files contain a §1.7 self-review marker', () => {
141:  it('population sentinel: at least 20 patches exist (guards against empty-dir false-pass)', () => {
149:  it('README.md is excluded from the §1.7 requirement', () => {
```

The population sentinel matters: a check over an empty directory passes trivially,
so the test asserts the directory it guards is real.

The `channels` row names `paths:(4)` and nothing else, and that is deliberate — the
rule file carries a delivery-channel note explaining why it has *no* edit-time
injector: its scope includes mid-path wildcard patterns the injector's glob engine
could not express, and the only hook-expressible superset would fire on every edit
in the whole documentation tree. Native read-time scoping alone is the correct
channel here, not a coverage gap.

One checklist item grew into a [rule](../../terms.md#rule) of its own: item 7, the
recommendation self-discipline check, is operationalised by the
[recommendation-laziness-discipline](./recommendation-laziness-discipline.md) sheet
in this family.

What the rule does not do: it cannot make a search *good* — the checklist counts
probes, not insight, and its own file says so. And most of the verification items
are judgment-shaped: no deterministic check reads free prose and detects an absence
claim resting on truncated output. The rule states that gap in its own text rather
than letting a reader assume a gate exists.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-A header naming the companion test: `.claude/rules/phase-research-coverage.md:14`.
- The delivery-channel note (native `paths:` only, no edit-time injector, and why):
  `:21`; the naming note declaring "6-item checklist" a proper name: `:23`.
- The §1 checklist items 1–7: `:29` to `:35` (item 7, the recommendation
  self-discipline check, at `:35`).
- The verification subsection (`§1.11`) and its ten named probes: `:78` heading,
  `:84` to `:93` items; its stated detection gap and the named cold-agent protocol
  that carries what can be carried: `:95`; the incident family behind it: `:97`.
- The reasoned-recommendation subsection (`§1.12`): `:99` to `:108` — including its
  note that mechanical enforcement is blocked until a detector's recall is fixed.
- The self-reflection prompts (`§2`) and the research-patch format (`§3`):
  `:114` to `:122` and `:124` to `:136`.
- The companion test quoted above:
  `packages/core/principles/13-phase-research-coverage-s17.test.ts:123`,
  `:124`, `:141`, `:149`.
- The read-time scope: `:3` to `:7` (`paths:` frontmatter, four patterns).
- The index row grading this rule class `A` with channel `paths:(4)`:
  `.claude/rules/00-rule-index.md:31`.
