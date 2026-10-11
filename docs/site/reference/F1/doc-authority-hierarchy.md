---
title: doc-authority-hierarchy rule
description: The rule that gives every canonical document a declared scope — what it is authoritative for, what it is not — so an agent resolving a disagreement knows which document wins.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/doc-authority-hierarchy.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/09-doc-authority-hierarchy.ts
  - packages/core/principles/09-doc-authority-hierarchy.test.ts
  - packages/core/principles/09-doc-authority-hierarchy.bin.ts
  - .agents/checks/cited-spec-addenda.sh
  - scripts/cited-spec-addenda.test.sh
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: authority-header-cli, stack: repo, date: 2026-10-07, result: ok-2-paths }
---

# doc-authority-hierarchy rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-doc-authority-hierarchy plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `doc-authority-hierarchy` |
| kind | rule |
| ships-to | framework |
| description | doc-authority-hierarchy discipline rule — §2 doc categorisation, §3 header format spec, §4 five anti-patterns + §4.1 supersession clause (premise change amends the declaring artefact), §5 folder-level authority pattern, §6 promotion / demotion / retirement triggers. |
| source | `.agents/rules/doc-authority-hierarchy.md:20` |
| class | A |
| fires | creating/editing any canonical or shipped consumer-facing doc. |
| channels | paths:(7), edit-time inject |
<!-- getff:end section=F1-card-doc-authority-hierarchy -->

<!-- vale on -->

## Explanation

An AI agent reading a repository cannot tell, from the text alone, which of two
contradicting documents is the one to obey. The incident that produced this
[rule](../../terms.md#rule) was exactly that: a planning document quietly
re-stated the project's goal, the drift went uncaught for months because every
code-level discipline was green, and reviewers pattern-matched the planning
document's language instead of the goal document's. The fix is a header
contract: every canonical document states, right at the top, what it is
**authoritative for** and what it is explicitly **not** authoritative for — and
the two lines point at each other's boundaries. Rule files add one more field,
`Class`, grading whether the discipline ships as an executable test.

Enforcement is the strongest grade in this family, `A`: a companion test ships
with the rule and checks that every required document carries the header. Two
design details make that test more than a checklist. First, it combines a
static list with dynamic enumeration — a new rule, agent, or skill is covered
the moment it lands, with no list edit, because the enumerators sweep the
directories by pattern. Second, the check is runnable by hand, not only in CI:

```bash
node --experimental-strip-types packages/core/principles/09-doc-authority-hierarchy.bin.ts .claude/rules/egress-no-api-bypass.md .claude/rules/coordinator-seat-delegation.md
```

```text
OK  2 required path(s) checked — all have Authoritative-for header
```

Both pages in this very batch pass. The check is also wired at the earliest
[channel](../../terms.md#channel): reading or editing a covered document
injects a one-paragraph reminder of the header contract, so an author meets
the requirement before the file is written rather than after CI fails.

The rule's sharpest section is about supersession. When a premise changes — a
decision recorded in a merged document is overturned — the temptation is to
write the correction in the new place only, leaving the old document standing
with its authority intact. The rule names that pattern an anti-pattern and
states the counter: find the document an auditor would cite to justify the
current shape, and amend *that* document in place, with a dated addendum whose
heading says what it does. A repo script turns the auditor's half of that
clause into a command: given the artifact a verdict cites, it reports every
later commit to that artifact and every amendment-shaped heading in today's
file, so an auditor reading only the cited line cannot silently bless a
decision that was withdrawn after the citation was written.

What the rule does not do: it verifies that a header *exists* and names a
scope, not that the scope statement is *true* — a document can declare
authority it does not deserve, and only a reader (or a cold review) catches
that. And the header is about document scope, not importance: a doc can be
authoritative for a tiny surface and still outrank a broader doc on that
surface. The folder-level pattern in §5 records the convention for whole
directories whose files share one authority.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree.

- The rule text: `.claude/rules/doc-authority-hierarchy.md` — delivery globs
  at `:13`, the edit-time injection summary at `:14`, class `A` at `:18`, the
  header contract at `:20`, and the 2026-05-09 origin incident at `:23`.
- Doc categorisation and the required-for lists: §2 at `:46`; the two
  dynamic-enforcement notes (skills covered the moment they land, 2026-07-02;
  flat rule/agent docs, 2026-07-03) at `:59` and `:61`.
- The header format spec: §3 at `:74`, with the field template at `:84` to
  `:85`.
- The five anti-patterns: §4 at `:107`; `#superseded-intent-left-standing` at
  `:113`; the §4.1 supersession clause at `:115` (amend the artifact an
  auditor would cite, with a dated `Addendum`/`withdraws`/`supersedes`
  heading).
- The companion test and its module: the header regex at
  `packages/core/principles/09-doc-authority-hierarchy.ts:15`, the static
  required list at `:28`, the dynamic path patterns at `:181`, the skill-doc
  enumerator at `:231`; vitest suite `09-doc-authority-hierarchy.test.ts`;
  the CLI shim `09-doc-authority-hierarchy.bin.ts` (output above).
- The supersession auditor: `.agents/checks/cited-spec-addenda.sh` — purpose and
  incident at `:3` to `:11`, usage at `:12`, exit contract (0 CLEAN / 2
  AMENDED / 3 INCONCLUSIVE) at `:25` to `:27`; companion test
  `scripts/cited-spec-addenda.test.sh`.
- The index row grading this rule class `A` with channels
  `paths:(7), edit-time inject`: `.claude/rules/00-rule-index.md:20`.
