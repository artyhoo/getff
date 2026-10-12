---
title: language-discipline rule
description: The rule that a framework's internal machinery is English-only while output addressed to the operator follows their configured language, with a third category — match data — kept bilingual on purpose.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/language-discipline.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/22-internal-english.test.ts
  - .claude/hooks/inject-session-bootstrap.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: english-only-surfaces, stack: repo, date: 2026-10-11, result: describe-line-60 }
docs-refresh: deferred — re-verified 2026-10-12, the cited overview changed only its batch-status paragraph, class-list links and frontmatter sources (the all-30 refresh after the F1b merge); this sheet's only anchor into it, #how-to-read-a-rule-page, is untouched; clears at the next gold refresh of this page
---

# language-discipline rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-language-discipline plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `language-discipline` |
| kind | rule |
| ships-to | framework |
| description | the language-discipline rule — §1 the 3-category model, §2 the human-facing language gate, §3 the keep-list, §4 enforcement channels, §5 anti-patterns, §6 promotion / retirement. |
| source | `.agents/rules/language-discipline.md:17` |
| class | A |
| fires | writing any internal machinery or human-facing output. |
| channels | paths:(5), edit-time inject |
<!-- getff:end section=F1-card-language-discipline -->

<!-- vale on -->

## Explanation

This project's maintainer works in Russian; the framework's machinery — hook
scripts, skill instructions, shell helpers — was once written in a mixture of Russian
and English. A mixed machinery is expensive in a specific way: every AI session
reading a half-translated instruction pays a small tax of ambiguity, and diffs,
searches and reviews each get harder. The [rule](../../terms.md#rule) fixes the
convention in three categories, and the third is the one worth understanding.

Category 1 is internal machinery: comments, logic, instruction prose, commit and
pull-request bodies — English, always. Category 2 is human-facing output — what a
hook or session addresses to the operator — which follows a configured language
variable: set it to `ru` and reports and answers come back in Russian; leave it unset
and everything is English. Two sub-channels deliver that: shell-emitted strings read
from language packs selected by the variable, and model-authored prose, where the
model learns the active language from a line injected at every session start and
writes *all* operator-facing prose in it. The origin incident for this rule was
exactly the partial version of that duty — a pipeline that localized its table
headers but wrote the prose in English.

Category 3 is match data: strings whose job is to *recognize* operator input. A
pattern that detects a Russian deferral phrase must stay Russian — translating it to
English silently breaks recognition of Russian input, with no upside. The rule
carries an explicit keep-list of legitimate Russian for exactly this reason, and the
companion test deliberately does not scan the surfaces where it lives.

The `class` row is `A`: the companion test ships. It is a deterministic Cyrillic scan
over two surfaces — machinery shell scripts with zero tolerance, and skill
instruction bodies after their frontmatter, with an allow list — and it carries a
mutation assertion proving the detector is not vacuous:

```bash
grep -nE "^\s*(describe|it)\(" packages/core/principles/22-internal-english.test.ts | head -4
```

```text
60:describe('Principle 22 — internal machinery is English-only', () => {
61:  it('Surface 1: no Cyrillic in machinery shell scripts (outside lang/ packs)', () => {
76:  it('Surface 2: no Cyrillic in SKILL.md bodies (outside frontmatter + allowlist)', () => {
87:  it('mutation: the Cyrillic detector is not vacuous (anti-tautology)', () => {
```

The `channels` row names `paths:(5), edit-time inject`: the rule loads when working
in the five machinery directories it scopes, and an edit-time injector delivers a
one-line reminder there. The judgment-shaped half — which language prose should be
written in — is delivered by injection at session start, not gated, because no
deterministic check can read intent.

What the rule does not do: it does not translate anything retroactively, and it
cannot make a model *follow* the configured language — the always-on line informs,
a [gate](../../terms.md#gate) scans only the mechanical Cyrillic surfaces. Verbatim
maintainer quotes inside rule files stay Russian by design; the test intentionally
does not scan them.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The 3-category model and the category-3 trap: `.claude/rules/language-discipline.md:22`
  to `:30` (`§1`).
- The two human-facing sub-channels, the plugin-channel fallback pin, and the
  precedence rule: `:32` to `:39` (`§2`).
- The keep-list of legitimate Russian: `:41` to `:43` (`§3`).
- Enforcement channels — the companion test surfaces, the always-on output-language
  line, and the two parity checks: `:45` to `:49` (`§4`).
- The companion test quoted above: `packages/core/principles/22-internal-english.test.ts:60`,
  `:61`, `:76`, `:87`.
- The always-on line injector: `.claude/hooks/inject-session-bootstrap.sh` (the
  output-language line it emits every session start).
- The scope markers: `:2` to `:8` (`paths:` frontmatter, five directories) and `:12`
  (`<!-- globs: -->`, kept identical by convention).
- The index row grading this rule class `A` with channels `paths:(5), edit-time
  inject`: `.claude/rules/00-rule-index.md:27`.
