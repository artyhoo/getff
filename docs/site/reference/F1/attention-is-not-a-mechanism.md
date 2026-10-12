---
title: attention-is-not-a-mechanism rule
description: The rule that a load-bearing check must be a gate or a named cold-agent protocol — a reviewer or a model merely noticing is never the detection layer.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/attention-is-not-a-mechanism.md
  - .agents/rules/00-rule-index.md
  - packages/core/hooks/checks/pr-body-removal-consumers.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: no-companion-test-exists, stack: repo, date: 2026-10-07, result: empty-grep }
---

# attention-is-not-a-mechanism rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-attention-is-not-a-mechanism plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `attention-is-not-a-mechanism` |
| kind | rule |
| ships-to | framework |
| description | the attention-is-not-a-mechanism discipline — §1 the rule (human/AI |
| source | `.agents/rules/attention-is-not-a-mechanism.md:5` |
| class | C |
| fires | designing any load-bearing check (gate vs. bare human/AI attention). |
| channels | always-on core |
<!-- getff:end section=F1-card-attention-is-not-a-mechanism -->

<!-- vale on -->

## Explanation

The card's `description` row is cut off mid-sentence — that is a registry-script
defect (it copies one line of the rule header, and the header wraps there), not a
property of the rule. The full scope the header states: §1 the rule — human or AI
attention may be merge authority, never the detection layer; §2 the anti-patterns;
§3 promotion and retirement.

The rule itself is one sentence. A check that must actually catch a defect has to be
one of two things: a deterministic [gate](../../terms.md#gate) at the earliest
[channel](../../terms.md#channel) that can reach the violation, or a named cold-agent
protocol with structured output. "A reviewer will read the diff" and "the model will
notice" are neither. Attention can still decide — a human or an agent may be the one
who rules on a finding — but it must not be the thing doing the catching. A warning
whose only consumer is someone reading a log fails the same way: either promote it to
an error with an escape reason, or hand it to a named agent audit.

The `class` row is `C` and the rule means it: there is no companion test, and this
page will not pretend otherwise. The command that would find one finds nothing:

```bash
ls packages/core/principles/ | grep -i attention
```

```text
```

(empty — exit status 1, no match)

The rule reaches you as resident text: `always-on core`, loaded into every session at
start. What stands behind it is prose plus the rule's own promotion trigger — after
three documented incidents in six months where a bare-attention check missed a real
defect, the discipline is promoted into audit checklists and reviewer protocols, where
it does become mechanically checkable.

What the rule does not do: it cannot stop you from shipping a hope-as-gate check. It
is a design statute, applied at review time, not a gate. The rule file itself follows
its own counsel — the companion gates it cites in its self-reflexive note (for
example the removal-consumers PR-body check) are deterministic, no-LLM checks.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including this PR's in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The rule sentence and the two allowed forms:
  `.claude/rules/attention-is-not-a-mechanism.md:15` (`§1`) and `:17` (the MUST).
- The two named anti-patterns, `#hope-as-gate` and `#warning-nobody-reads`:
  `:26` to `:29`.
- The promotion trigger (3 documented incidents in 6 months): `:33`.
- Index row grading this rule class `C`, channel `always-on core`:
  `.claude/rules/00-rule-index.md:12`.
- The no-companion-test claim: the `ls | grep` above returns nothing at this base.
- An example of the rule applied, cited in the rule file's own note: the PR-body
  removal-consumers gate is a deterministic check, not reviewer attention —
  `packages/core/hooks/checks/pr-body-removal-consumers.ts` is that check's
  implementation.
