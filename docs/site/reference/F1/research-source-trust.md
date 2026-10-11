---
title: research-source-trust rule
description: The rule that a research source is trusted through named tiers — curated builtin hosts, a direct dependency's own metadata, or a human-acked file — everything else fails closed, and extending trust is a data change, never a code change.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/research-source-trust.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/30-research-source-trust.test.ts
  - packages/core/research/allowlist-resolver.ts
  - .ai-factory/research-allowlist.json
  - .claude/skills/rule-research/SKILL.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: trust-discipline-suite, stack: repo, date: 2026-10-11, result: describe-line-97 }
---

# research-source-trust rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-research-source-trust plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `research-source-trust` |
| kind | rule |
| ships-to | framework |
| description | the trust-tier discipline for rule-research provenance — §1 the tier model (pointer, not a copy), §2 the §4.5 re-tightening trigger, §3 anti-patterns, §4 ecosystem-prefix parsing (shipped in S4), §5 promotion / retirement. |
| source | `.agents/rules/research-source-trust.md:16` |
| class | A |
| fires | authoring a rule-research provenance entry / resolving allowed sources. |
| channels | paths:(2), edit-time inject, skill-embed |
<!-- getff:end section=F1-card-research-source-trust -->

<!-- vale on -->

## Explanation

When the framework's agents research how to build something, they read the web.
Which hosts may they trust? The wrong answer — anything that sounds official — lets
a poisoned documentation page steer a design. This [rule](../../terms.md#rule)
answers with a three-tier model, and its shape is worth reading even outside this
project, because each tier prices trust differently.

Tier 0 is a curated builtin list of known documentation hosts. Tier 1 derives
automatically from a direct dependency's own package metadata: if you already
install a package, its self-declared home page is a strictly smaller grant than the
code you just ran — but the trust is scope-locked to that package, and hosts shared
by many tenants are ineligible, so one dependency cannot vouch for a whole platform.
Tier 2 is the explicit escape: a human adds a host to a JSON ack file — created
on first grant, committed and reviewed from then on. A provenance URL is
authorized by the first tier that matches it.
Anything else fails closed — there is no fallback to "looks legitimate".

The rule file itself is a pointer, not a copy: the full tier architecture and its
threat model live in the design record it cites, and the rule deliberately refuses
to duplicate them. What the rule *owns* is one binding trigger with no analogy in
ordinary dependency management: if the project ever ships a flow where research
output generates code, Tier 1's automatic trust must downgrade to Tier 2's explicit
human ack for that flow — because the blast radius of a poisoned source changes
class when it can emit arbitrary code. The rule names the condition, quotes the
design record verbatim, and calls implementing the flow without the downgrade a
violation rather than an oversight.

The `class` row is `A`: the companion test ships, store-wide, and it carries a
paired-negative section proving its invariants are non-vacuous:

```bash
grep -nE "describe\(" packages/core/principles/30-research-source-trust.test.ts | head -2
```

```text
97:describe('Principle 30 — research-source trust discipline (S3, store-wide)', () => {
183:  describe('paired negative — invariant (b) is non-vacuous', () => {
```

The `channels` row names three deliveries: read-time loading when working in the
research code and the ack file (`paths:(2)`), an edit-time reminder on the same
scope, and a skill-embed channel — the rule-research skill's own instructions carry
the discipline at the moment a research run is scoped.

The anti-patterns are the two ways trust erodes in practice: granting it by *name
similarity* ("it's basically the same ecosystem") rather than by the resolver's
scope check, and extending it by editing framework source instead of the data
surface — a code change to the curated list is precisely what the tier model
replaced, and the rule names it the violation even when the edit is convenient.

What the rule does not do: it does not judge *content* — a tiered host can still
publish something wrong; the tiers bound who can speak, not whether they are right.
And Tier 1's automation is conditional by design: the downgrade trigger above is the
rule's own admission that the tier's trust is calibrated to a threat model, not
permanent.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The tier model, pointer-not-copy, and the one-line fail-closed summary:
  `.claude/rules/research-source-trust.md:21` to `:29` (`§1`).
- The binding re-tightening trigger with its verbatim design-record quote:
  `:31` to `:37` (`§2`).
- The anti-patterns (`#trust-by-name-not-scope`, `#allowlist-as-code-not-data`):
  `:39` to `:42` (`§3`).
- The shipped ecosystem-prefix parsing (non-package-manager sources parse
  fail-closed): `:44` to `:46` (`§4`).
- The adversarial-review defence-in-depth record (documented acceptances with
  harden-criteria, coded guards with paired-negatives): `:48` to `:62` (`§5`).
- The companion test quoted above:
  `packages/core/principles/30-research-source-trust.test.ts:97` (suite),
  `:183` (paired negative).
- The implementation the rule points at:
  `packages/core/research/allowlist-resolver.ts` (`resolveAllowedSources` +
  `validateProvenance`).
- The Tier-2 data surface: `.ai-factory/research-allowlist.json` — not yet
  created in the framework repo at this pin; the resolver treats a missing file
  as an empty map, so the rule is live before the first ack lands
  (`allowlist-resolver.ts:69`, `:75`).
- The scope markers: `:3` to `:6` (`paths:` frontmatter), `:8` (`<!-- globs: -->`),
  and the skill-embed channel declaration at `:10` —
  `.claude/skills/rule-research/SKILL.md`.
- The index row grading this rule class `A` with channels `paths:(2), edit-time
  inject, skill-embed`: `.claude/rules/00-rule-index.md:33`.
