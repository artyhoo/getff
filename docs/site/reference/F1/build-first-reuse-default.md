---
title: build-first-reuse-default rule
description: The rule that turns every build-or-reuse fork into a recorded verdict with a default — use what exists, and earn a build with a search that proves the gap.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/build-first-reuse-default.md
  - .agents/rules/00-rule-index.md
  - packages/core/principles/11-build-first-reuse-default.test.ts
  - CLAUDE.md
  - docs/meta-factory/prior-art-evaluations.md
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: ssot-verdict-census, stack: repo, date: 2026-10-10, result: 54-verdicts }
docs-refresh: deferred — re-verified 2026-10-12, the cited CLAUDE.md changed only its domain-vocabulary bullet gaining the intent product-session route; the build-vs-reuse consult gates this sheet maps are untouched; clears at the next gold refresh of this page
---

# build-first-reuse-default rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-build-first-reuse-default plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `build-first-reuse-default` |
| kind | rule |
| ships-to | framework |
| description | project-wide macro-level scope discipline; relationship to upstream tools, frameworks, and ecosystems; default verdict for new capability proposals; the consumer map owed before dropping or slimming an established artefact (§3.1); the scope of fresh prior-art re-verification at PR-authoring / orchestration time (§3.2). |
| source | `.agents/rules/build-first-reuse-default.md:22` |
| class | A |
| fires | capability commit/proposal; shipped-file removal. |
| channels | paths:(10), edit-time inject |
<!-- getff:end section=F1-card-build-first-reuse-default -->

<!-- vale on -->

## Explanation

Every new capability starts with a fork: build it, or use the thing that already
exists. Left to instinct, the fork resolves by mood — and a project that always
builds ends up maintaining everything itself. This [rule](../../terms.md#rule)
makes the fork a recorded verdict instead. Every capability proposal resolves into
one of seven named verdicts, from `ADOPT` (use the upstream tool as it is) through
`ADAPT` and `REFERENCE` to `BUILD` and `REJECT`, and the default is the cheap side:
`ADOPT` or `REFERENCE`. `BUILD` has to be earned by a search that proves no
production-grade upstream solves the problem.

The verdicts are not decoration. The team keeps a register of prior-art decisions
(`docs/meta-factory/prior-art-evaluations.md`), and every entry records one. Counted
in the getff repository, the register looks like this:

```bash
grep -oE '\*\*(ADOPT VOCABULARY|ADOPT|ADAPT|REFERENCE|KEEP NARROW|BUILD|REJECT)\*\*' docs/meta-factory/prior-art-evaluations.md | sort | uniq -c | sort -rn | sed -E 's/^ +//'
```

```text
14 **REFERENCE**
14 **ADAPT**
11 **BUILD**
5 **REJECT**
5 **ADOPT VOCABULARY**
4 **ADOPT**
1 **KEEP NARROW**
```

Fifty-four recorded verdicts, and the reuse side of the ledger outweighs the builds.
That is the rule working: a build happens when the search says the gap is real.

The rule also splits one question people tend to merge. A tool can be right for the
maintainer, on their own machine, and wrong to install into every consumer's project — so each
verdict is reached twice, on an **operator axis** (what the team builds with) and a
**shipped axis** (what the product carries), and the answers may legitimately differ.
Before either axis, one more check: does the harness you already run ship the
capability natively? The rule file records an incident where a survey of companion
tools missed that the editor the team already uses had grown the exact feature being
shopped for.

The `class` row is `A`: an executable test ships with the rule, and it does real
work. It keeps a set of the seven verdict names from the rule's own table, watches
the register for a verdict keyword outside that set, and fails when the two drift
apart. The search the rule demands before a `BUILD` verdict is spelled out in its
§3: a repository-level question tool and a web search, each run with at least three
phrasings — with one deliberate exclusion the rule argues for in a caveat: a library
documentation lookup is the wrong instrument for "does a production framework exist
for this problem".

What the rule does not do: it cannot run the search for you, and it does not decide
the verdict — matching a problem class to an upstream tool stays a judgment call the
verdict text has to argue. A second, narrower rule (the one the repository's own
contributing guide carries as a per-commit gate) handles the paperwork per commit;
this rule works one level up, catching the drift that accumulates when many
individually-fine commits compose into a parallel rebuild of something that already
exists.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The seven-verdict table opens at `.claude/rules/build-first-reuse-default.md:39`
  (the `ADOPT` row); the default sentence is `:47`.
- Own-stack-first and the operator/shipped axes: `:53` and `:55`.
- The §3 search layers: `:72` (mechanism), `:78` (repository question tool, ≥3
  phrasings), `:79` (web search, ≥3 phrasings), and `:83` (the caveat excluding
  library-docs queries from that list).
- The companion test: `packages/core/principles/11-build-first-reuse-default.test.ts`;
  the verdict-name set starts at `:72`, with the calibration note that extends it
  when the register records a new keyword at `:47` to `:50`. Shipped with the rule
  per `:117` of the rule file.
- The per-commit gate this rule complements: `CLAUDE.md:12` ("Build-vs-reuse
  invariant").
- The register the census counted:
  `docs/meta-factory/prior-art-evaluations.md` — the `grep` above returns 54 verdict
  occurrences at this base.
- The `paths:(10)` delivery scope is the rule file's frontmatter globs
  (`.claude/rules/build-first-reuse-default.md:2` to `:12`); the index row grading
  this rule class `A` with channels `paths:(10), edit-time inject` is
  `.claude/rules/00-rule-index.md:14`.
