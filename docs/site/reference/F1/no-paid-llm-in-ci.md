---
title: no-paid-llm-in-ci rule
description: The rule that no CI job ever places an API-billed LLM call — semantic checks ship as named agent prompts a session reads, never as usage a workflow bills per run.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/no-paid-llm-in-ci.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/17-no-paid-llm-in-ci.test.ts
  - .claude/hooks/inject-matching-rule.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: usage-scan-assertion, stack: repo, date: 2026-10-11, result: assertion-at-line-79 }
---

# no-paid-llm-in-ci rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-no-paid-llm-in-ci plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `no-paid-llm-in-ci` |
| kind | rule |
| ships-to | framework |
| description | no-paid-LLM-in-CI policy rationale, scope (CI/GH Actions surface), escape-hatch process (explicit operator override per session with rationale), AI-agnostic sub-agent fallback pattern. |
| source | `.agents/rules/no-paid-llm-in-ci.md:15` |
| class | A |
| fires | editing `.github/workflows/**` or `.github/actions/**`. |
| channels | paths:(2), edit-time inject |
<!-- getff:end section=F1-card-no-paid-llm-in-ci -->

<!-- vale on -->

## Explanation

A CI-side LLM call has a cost shape no other dependency has: it bills per invocation,
times every run, on every branch, forever, to the project. The operator set the policy
as a flat refusal — if it is paid per call, it does not ship in CI — and this
[rule](../../terms.md#rule) codifies it. Subscription-bundled use is different and is
explicitly allowed: an agent session working inside its own Claude Code plan, or a
consumer running a review skill in theirs, is not an API-billed call.

The rule covers the CI surface — workflow files, actions, scheduled jobs, and any
script a workflow invokes that would present an API key. When a check genuinely needs
judgment, the rule does not forbid the judgment; it moves it off the billing path.
The alternative it prescribes is the AI-agnostic sub-agent: the check's instructions
live in a named prompt file under `agents/`, and an active session reads and runs it
on its own subscription. Nothing invokes an LLM from CI; several of this framework's
auditor roles are exactly that shape.

The `class` row is `A`: the companion test ships, and it is the card's strongest
row. It scans every workflow file for API-billed usage patterns, and it is
usage-precise rather than mention-counting — this repository's own workflow files
legitimately contain the strings naming what they must never call, so the test
distinguishes use from mention. It also guards against its own false pass: one
assertion requires that at least one workflow file exists to scan, so deleting the
directory cannot turn the scan green. The main assertion names itself:

```bash
grep -n "paid-LLM API usage" packages/core/principles/17-no-paid-llm-in-ci.test.ts
```

```text
79:  it('no .github/workflows/*.yml contains a paid-LLM API usage', () => {
```

The `channels` row names two deliveries. `paths:(2)` is the read-time scope — the two
CI directories — so a session working there loads the rule; `edit-time inject` is the
one-line reminder delivered on a matching edit. Both come from the `paths:` and
`<!-- globs: -->` markers at the top of the rule file, kept identical on purpose.

The escape hatch exists and is narrow: the operator may authorize a paid call for one
specific task, at a stated budget cap, valid until a stated date — per session,
never durable, and never committed as a project change without a separate
maintainer edit to this rule and the project invariant it mirrors.

What the rule does not do: it cannot see a paid call that leaves the repository's CI
entirely — the same job on an external scheduled service, same cost, different
invoice. The rule file names that shape as its own anti-pattern and extends its
written scope to background services tied to the repository, but detection remains a
review-time judgment, not this test's scan.

## Evidence

Checked 2026-10-11 against the working tree this batch was written in.

- The policy and its scope boundary (subscription-bundled use allowed):
  `.claude/rules/no-paid-llm-in-ci.md:22` (`§1`) and `:26` to `:29` (`§2`).
- The escape hatch (per session, budget cap, not durable, committed only by
  maintainer edit): `:39` to `:43`.
- The AI-agnostic sub-agent fallback and its named precedents: `:22` and `:66`.
- The companion test: `packages/core/principles/17-no-paid-llm-in-ci.test.ts:43`
  (the workflows directory it scans), `:75` (the at-least-one-workflow false-pass
  guard), `:79` (the usage assertion quoted above), `:91` (the paired-negative that
  flags an API-key assignment).
- The read-time scope and the injection marker: `:2` to `:4` (`paths:` frontmatter)
  and `:9` (`<!-- globs: -->`), delivered by `.claude/hooks/inject-matching-rule.sh`.
- The index row grading this rule class `A` with channels
  `paths:(2), edit-time inject`: `.claude/rules/00-rule-index.md:29`.
