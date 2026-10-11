---
title: source-before-shape rule
description: The rule that an authoritative source is read before an artifact's shape is committed — grep for reuse overlap before writing a new skill, quote the spec before scoping a dispatch — never author from recall.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/source-before-shape.md
  - .agents/rules/00-rule-index.md
  - .claude/hooks/inject-matching-rule.sh
  - agents/capability-reuse-auditor.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: injector-cache-and-auditor, stack: repo, date: 2026-10-11, result: first-time-guard-line-352 }
---

# source-before-shape rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-source-before-shape plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `source-before-shape` |
| kind | rule |
| ships-to | framework |
| description | the **edit-time delivery layer** for source-before-shape discipline — §1 the PRIORITY-CHECK, §2 trigger / non-triggers, §3 mechanism + its honest limitations, §4 the `#authoring-from-internal-state` anti-pattern family, §5 promotion / retirement, §6 §1.7 self-reflexive note. |
| source | `.agents/rules/source-before-shape.md:17` |
| class | B |
| fires | creating a new SKILL.md/agent/module, or authoring a dispatch/kickoff. |
| channels | paths:(5), edit-time inject |
<!-- getff:end section=F1-card-source-before-shape -->

<!-- vale on -->

## Explanation

The most expensive authoring mistakes share one shape: the artifact was committed
to a design before the authoritative source was read. This
[rule](../../terms.md#rule) exists because the shape recurred. In one session, a
new skill re-described an execution loop an upstream skill already owned — while
its prior-art trailer said the right thing, so the presence check passed and the
body reinvented anyway; and a launch prompt was scoped from recollection when the
spec's own chain said otherwise. Both underlying disciplines already existed. What
was missing was delivery at the moment of authoring, so the rule adds exactly that:
before an action commits to a shape, read the source first, as an input that drives
the shape — not afterward, as a trailer that blesses it.

Two surfaces get the discipline. The reuse surface: creating a new skill, agent, or
module requires grepping the prior-art register and the existing skills for overlap
before the body is written — an existing analog makes the new body a thin adapter
that defers to it, or the commit must justify building with a verdict that matches
what the body actually does. The scope surface: scoping a dispatch or kickoff
requires quoting the spec's own lines first; a scope stated from recollection is
provisional until the source is quoted.

The card's `class` row is `B`, and the mechanism is two layers. Layer A is an
edit-time injection — write under the scoped paths and the injector surfaces the
one-line reminder, once per session. Layer B is a named overlap-auditor agent for
the semantic pass a one-liner cannot do, run before handoff. The rule's most
valuable section is its honest-limitations list, and its headline admission is
verified against the injector's own cache logic — the injection is spent on the
first matching edit of a session, whatever that edit is, so a routine fix to an
existing skill disarms the reminder for the real new-capability write that follows:

```bash
grep -n "once per" .claude/hooks/inject-matching-rule.sh
ls agents/ | grep capability
```

```text
352:  first_time "$entry" || continue   # once per (session_id, agent_id) per card
capability-reuse-auditor.md
```

The rule draws the consequence itself: by that mechanism, Layer A would not have
fired on its own origin incident — which is why the auditor layer, the digest
pointer, and the push-time presence check carry the discipline alongside it, and
why the frequently-edited core directory is deliberately left out of the injection
scope entirely rather than pretending coverage.

What the rule does not do: it cannot reach prompts composed inline in a conversation
that are never written to a file — no edit, no injection — and it cannot make an
author read; it surfaces the check one step earlier than any push-time gate can and
hands the judgment to a named second layer.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The Class-B header naming both layers and the judgment ceiling:
  `.claude/rules/source-before-shape.md:15`.
- The origin: two same-family incidents plus the operator-confirmed recurrence:
  `:20` to `:24`.
- `§1` the priority check and both surfaces: `:26` to `:33` (the read-first
  statement at `:28`, reuse surface at `:30`, scope surface at `:31`,
  input-to-the-shape at `:33`).
- `§2` triggers and non-triggers: `:35` to `:42`.
- `§3` the two layers and the honest limitations: `:44` to `:55` — Layer A at
  `:46`, Layer B at `:48`, the spent-before-creation admission (with its live
  verification and the would-not-have-fired-on-the-origin-incident conclusion) at
  `:52`, the core-directory exclusion at `:53`, inline prompts at `:54`, the
  benign false-positive at `:55`.
- `§4` the anti-pattern family: `:57` to `:62`.
- `§5` the promotion criterion and the incident counter: `:64` to `:68`.
- The injector cache line quoted above: `.claude/hooks/inject-matching-rule.sh:352`;
  Layer B the grep confirms: `agents/capability-reuse-auditor.md`.
- The scope markers: `:2` to `:8` (`paths:` frontmatter, five patterns), `:12`
  (`<!-- globs: -->`), `:13` (`<!-- inject: -->`).
- The index row grading this rule class `B` with channels `paths:(5), edit-time
  inject`: `.claude/rules/00-rule-index.md:38`.
