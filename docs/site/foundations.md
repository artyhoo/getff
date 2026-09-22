---
title: Foundations
description: The ideas getff is built on, what was taken from each, what the project measured for itself, and what it has not measured.
kind: face-page
sources:
  - .claude/rules/ai-laziness-traps.md
  - .claude/rules/attention-is-not-a-mechanism.md
  - .claude/rules/build-first-reuse-default.md
  - .claude/rules/doc-authority-hierarchy.md
  - .claude/rules/no-paid-llm-in-ci.md
  - .claude/rules/rule-enforcement-channel-selection.md
  - CLAUDE.md
  - LICENSE.md
  - README.md
  - docs/meta-factory/principles-as-tests.md
  - docs/meta-factory/prior-art-evaluations.md
  - docs/site/index.md
  - docs/meta-factory/research-patches/2026-05-21-instruction-compliance-empirical.md
  - docs/meta-factory/research-patches/2026-05-25-defer-reflex-detection.md
  - docs/meta-factory/research-patches/2026-08-09-context-degradation-calibration.md
  - docs/meta-factory/research-patches/README.md
  - docs/meta-factory/self-application.md
  - docs/site/ai-agents.md
  - docs/site/face-facts.json
  - docs/site/how-it-works.md
  - docs/site/quick-start.md
  - docs/site/terms.md
  - packages/core/principles/17-no-paid-llm-in-ci.test.ts
  - skills/getff/SKILL.md
  - skills/getff/references/ai-traps.md
  - skills/getff/references/checks-map.md
  - skills/getff/references/overview.md
docs-refresh: deferred — re-verified 2026-09-22, the cited register gained rows 284-287 and a dated note on row 283, and CLAUDE.md gained one skill-routing line for domain-modeling; counts are renderer-owned and no prose here depends on either; clears at the next gold refresh of this page
next: ai-agents.md
---

# Foundations

This page says what getff stands on. It names each borrowed idea and what was changed.
It reports what the project measured for itself, including a result that did not go its
way. It ends with what nobody has measured yet.

You do not need this page to use getff. Read it when you want to judge whether the
method is sound before you trust it with your repository.

## The thesis

The getff [skill](terms.md#skill) opens with one line: documents lie; tests don't. A written
[convention](terms.md#convention) can be wrong for months and nothing happens. A test
that is wrong fails.

The [project goal](../../README.md#why-this-exists) follows from that. Every [rule](terms.md#rule) that
governs a codebase should be an executable [artifact](terms.md#artifact) that fails when
the rule is broken. It should fail at the earliest [channel](terms.md#channel) that can
see the problem.

"CI last" is a consequence of the goal, not a slogan. A rule protects you only when
someone sees it fail. The later it fails, the more likely the author has moved on. With
an AI agent the author is often gone within minutes. So the useful place for a failure
is while the agent still has the file open, and CI is the net under everything else.

## Lineage

None of the parts are new. The README names nine sources under
[Inspirations & sources](../../README.md#inspirations--sources). Six of them have a full
citation in the references that ship with the getff skill. Each of those says what was
taken and what was changed.

| Source | Taken | Changed | Citation |
|---|---|---|---|
| Gojko Adzic, *Specification by Example* (2011) | Behavior written as concrete input and expected-output pairs, not prose. | No natural-language layer such as Gherkin. The examples live in code-level tests. Literal expected values also stop an agent from asserting whatever the code returns today. | [overview.md](../../skills/getff/references/overview.md) |
| Cyrille Martraire, *Living Documentation* (2019) | Documentation as a continuously checked byproduct. Anything that can drift silently is replaced by something that executes. | The scope narrows from business knowledge to the files an agent and a developer read. Each one is enforced by a test, not by a writing habit. | [overview.md](../../skills/getff/references/overview.md) |
| Charity Majors, "Observability 2.0" | Production earns its own enforcement layer. | The concern moves from telemetry tooling to rules. A production check that fails feeds the same rule set, not an alert queue. | [overview.md](../../skills/getff/references/overview.md) |
| Senko Rašić, "Code Reviews in the age of AI" (2026) | A second AI reviews work in a context that never saw how it was made. | The scope is narrow on purpose: tests and rules that assert nothing. It is paired with deterministic checks and never carries enforcement alone. | [ai-traps.md](../../skills/getff/references/ai-traps.md) |
| Consumer-driven contracts (Pact) | Contract tests between services, run in CI. | Used as one kind of integration rule, not as the center of the method. | [overview.md](../../skills/getff/references/overview.md) |
| Negative test pairs | Every passing case ships with a paired case that must fail. | Used as a cheap stand-in for mutation testing where a full mutation run costs too much. | [ai-traps.md](../../skills/getff/references/ai-traps.md) |

Three sources are named in the README and have no fuller citation yet. They are the
"Rules as Tests" five-layer principle, Larry Smith's shift-left testing (2001), and the
documentation-drift practice from the project's own `ai-docs` skill. The shift-left axis
is drawn in [checks-map.md](../../skills/getff/references/checks-map.md), without the
attribution. The Pact entry above names the tool and not Ian Robinson, who the README
credits. We list these gaps here so that the table does not look more complete than it is.

## Why AI agents specifically

The project started from its own sessions, not from the literature.

**An instruction is not a force.** The project built a mechanism that reminds an agent,
mid-session, to check a factual claim before making it. Then it tested whether the
mechanism changes behavior. The
[pilot](../../docs/meta-factory/research-patches/2026-05-21-instruction-compliance-empirical.md)
scored 266 real sessions and 1537 turns that contained a claim. The null hypothesis was
that the mechanism makes no difference. The pilot could not reject it. The treatment
side had almost no data, and the one controlled arm knew it was being tested.

The pilot did establish two smaller things. Agents already grounded about three claims
in four with no mechanism at all, so there was little room to improve. Claims that
something does *not* exist were the weakest class: 27 such claims, 44% grounded. That is
too few to conclude from, and the patch says so.

The project took a rule from this, not a victory. A load-bearing check must be a
deterministic [gate](terms.md#gate) or a named review protocol with structured output.
"Someone will notice" is not a mechanism. The rule is
[attention-is-not-a-mechanism.md](../../.claude/rules/attention-is-not-a-mechanism.md).

**Agents degrade inside a long session.** A
[calibration study](../../docs/meta-factory/research-patches/2026-08-09-context-degradation-calibration.md)
collected the evidence for how agent judgment drops as the context fills. It was audited
twice, and its own second revision withdrew two of its claims.

**Agents defer under load.** The same "I will do it later" pattern came back three times
in the project's sessions. Each time a written note about the previous incident was
loaded. That is the origin of the
[defer-reflex patch](../../docs/meta-factory/research-patches/2026-05-25-defer-reflex-detection.md):
text the agent can recall did not stop the behavior.

**The working form is a catalogue.** Twenty-one recurring shortcuts are written down
with a trigger and a counter each, T1 to T21, in
[ai-laziness-traps.md](../../.claude/rules/ai-laziness-traps.md). Examples: sampling
three files and calling a category clean, or describing what a check would find without
running it. The consumer-facing version is
[ai-traps.md](../../skills/getff/references/ai-traps.md).

The research patches also cite outside work. This count is derived from the repository,
not typed:

<!-- getff:begin section=face-academic-sources plan=scripts/render-face-facts.mjs -->
| What | Count | Where |
|---|---|---|
| Distinct DOI and arXiv links cited | 44 | `docs/` and `skills/getff/references/` |
<!-- getff:end section=face-academic-sources -->

## How the project keeps itself honest

**It runs on itself.** The getff repository is held to its own rules. The model is a
compiler that compiles itself: if the method cannot survive its own repository, it should
not be sold to yours. The project treats this as a quality signal and not as its goal.
See [self-application.md](../../docs/meta-factory/self-application.md).

**Build or reuse is decided on the record.** Before a commit adds a new capability, the
author checks a register of tools already evaluated, and cites the row in the commit
message. A pre-push hook rejects the commit without that line. The rule is in
[CLAUDE.md](../../CLAUDE.md) and the register is
[prior-art-evaluations.md](../../docs/meta-factory/prior-art-evaluations.md).

**Every gap becomes a file.** When a session finds that a document and the code
disagree, it writes a research patch: one file per gap, kept as a record. The
[index](../../docs/meta-factory/research-patches/README.md) lists them.

**Principles are tests.**
[principles-as-tests.md](../../docs/meta-factory/principles-as-tests.md) explains the
pattern. The tests live in `packages/core/principles/`.

<!-- getff:begin section=face-counts plan=scripts/render-face-facts.mjs -->
| What | Count | Where |
|---|---|---|
| Tests that enforce the project's own principles | 50 | `packages/core/principles/` |
| Build-or-reuse decisions on record | 282 | `docs/meta-factory/prior-art-evaluations.md` |
| Research patches, one per gap found | 272 | `docs/meta-factory/research-patches/` |
| Design specs | 87 | `docs/superpowers/specs/` |
<!-- getff:end section=face-counts -->

## Why so and not otherwise

| Decision | Rejected alternative | Evidence |
|---|---|---|
| Every gate is a deterministic program. No paid AI model runs in CI. | An AI judge in the pipeline. It costs money on every run and can answer differently twice. | [no-paid-llm-in-ci.md](../../.claude/rules/no-paid-llm-in-ci.md), enforced by `packages/core/principles/17-no-paid-llm-in-ci.test.ts` |
| A rule fails at the earliest channel that can see it. | One gate in CI. | [rule-enforcement-channel-selection.md](../../.claude/rules/rule-enforcement-channel-selection.md) |
| Rules run in the tools you already have. | A getff runtime or server. | [build-first-reuse-default.md](../../.claude/rules/build-first-reuse-default.md) |
| A document states what it is the authority for, and a check reads that. | Prose that any other file may contradict. | [doc-authority-hierarchy.md](../../.claude/rules/doc-authority-hierarchy.md) |
| Source-available license that becomes Apache 2.0 after two years. | Open source from day one, or closed for good. | [LICENSE.md](../../LICENSE.md) |
| One fact has one home. Pages render numbers from it. | Typing a number into each page. | `docs/site/face-facts.json`, the source of the two tables above |

## What is measured and what is not

- **The pilots are small.** The instruction pilot could not reject its null hypothesis.
  Its controlled arm had five subjects and knew it was a test.
- **Usefulness on a live project is not measured.** The project has evidence that rules
  [fire](terms.md#fire), that installs work, and that its own repository stays consistent. It has no
  measurement that a team using getff ships fewer convention breaks. Treat that as open.
- **[Stack](terms.md#stack) labels follow field experience.** Beta, alpha, early, and experimental are
  judgments from real installs, not scores from a test matrix. The
  [Introduction](index.md#honest-status) says what each label means.
- **The lineage table is incomplete.** Three of nine sources have no full citation yet.

## Reading list

- [prior-art-evaluations.md](../../docs/meta-factory/prior-art-evaluations.md): every
  tool the project evaluated, with a verdict and a reason to look again.
- [Research patches index](../../docs/meta-factory/research-patches/README.md): the gaps,
  one file each.
- [principles-as-tests.md](../../docs/meta-factory/principles-as-tests.md): how a
  principle becomes a test.
- Design specs: the folder `docs/superpowers/specs/` in the repository.
- The references that ship with the skill:
  [overview.md](../../skills/getff/references/overview.md),
  [checks-map.md](../../skills/getff/references/checks-map.md), and
  [ai-traps.md](../../skills/getff/references/ai-traps.md).
- [How it works](how-it-works.md), for the mechanism in three pictures.

Next: [Use getff with your AI agent](ai-agents.md).
