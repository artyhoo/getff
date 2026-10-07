---
title: dual-implementation-discipline rule
description: The rule that every Claude Code-native artefact either has a portable counterpart on the other harnesses this framework ships to, or records a deliberate, written reason why not.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .claude/rules/dual-implementation-discipline.md
  - .claude/rules/00-rule-index.md
  - tests/agnosticism/probes/channel-coverage.sh
  - tests/agnosticism/probes/brand-detection.sh
  - .claude/hooks/check-hook-marker.sh
  - agents/dual-channel-drift-auditor.md
  - tests/agnosticism/harness-self.test.sh
  - packages/core/principles/21-agnosticism-conformance.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: surface-8-coverage-probe, stack: repo, date: 2026-10-07, result: 34-rows-exit0 }
---

# dual-implementation-discipline rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-dual-implementation-discipline plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `dual-implementation-discipline` |
| kind | rule |
| ships-to | framework |
| description | dual-implementation discipline rule — §1 problem, §2 triggers + non-triggers, §3 audience triage, §4 detection mechanism, §5 drift check, §6 CC-bias mitigation, §7 single source of truth, §8 anti-patterns, §9 promotion / retirement, §10 see also. |
| source | `.claude/rules/dual-implementation-discipline.md:16` |
| class | A |
| fires | shipping a new CC-native hook + choosing its delivery channel(s). |
| channels | paths:(3), edit-time inject |
<!-- getff:end section=F1-card-dual-implementation-discipline -->

<!-- vale on -->

## Explanation

This framework is developed on one AI coding harness but shipped to consumers
who may run another. The failure mode that follows is quiet: each new artefact
takes the path of least resistance — a hook only one harness can fire, a config
file only one harness reads — and the shipped product silently stops working
for everyone else. This [rule](../../terms.md#rule) makes the choice explicit
at the moment it is made. Every CC-native artefact must carry one of two
written markers: `@dual-pair` naming its portable counterpart, or
`@cc-only-rationale` stating why a counterpart is deliberately absent. The
rule's origin is a maintainer's framing, quoted in its own file: use the
native features when they exist — but record that you chose to.

The markers are checked at two levels, and the class row is `A` because both
are executable. At edit time, a hook inspects any Claude Code hook script you
touch and rejects it if it carries neither marker. Across the population, a
CI probe walks every tracked hook script, resolves each `@dual-pair` anchor to
a real counterpart file, and fails on a dangling anchor. Run by hand, that
probe prints one line per artefact — 34 rows at this base:

```bash
bash tests/agnosticism/probes/channel-coverage.sh
```

```text
channel-coverage	.claude/hooks/worktree-setup.sh	dual-pair 'worktree-create-setup' resolves → scripts/create-worktree.sh (§5)	0	PORTABLE
channel-coverage	.claude/hooks/lib/skill-index.sh	cc-only-rationale declared (§6 deliberate choice)	0	PORTABLE
```

Every row ends `PORTABLE` — not because every artefact has a twin, but because
every artefact has a *recorded answer*: a resolved counterpart anchor, or a
deliberate choice with a reason.

The rule's more interesting half is what it refuses to do. Its own header
records that an earlier sketch tried to gate "is this artefact actually CC
biased?" — a semantic question — mechanically, measured the detector's
precision at 38%, and demoted that check to a named cold audit agent instead.
Brand-name detection is a different matter and *is* gated: a probe checks that
no shipped artefact greps for the harness's own name to change behaviour.
Semantic drift between a hook and its twin — same anchor, diverging logic —
stays with the cold agent, by measurement rather than by hope. That split is
the rule teaching its own lesson twice: [gate](../../terms.md#gate) the
mechanically detectable, name an auditor for the judgment-shaped rest.

Delivery here is framework-wide — the rule's globs cover hooks, agents, and
skills. The rule file itself lives in this repository's rule set, but the
artefacts it governs ship: hooks and skill-context files installed into
consumer projects carry the same markers, so the channel intent travels with
the artefact. The companion CI principle test runs the probe surfaces in CI; a
harness-self test proves each surface catches a seeded violation, so the
probes are shown to discriminate rather than merely to pass.

What the rule does not do: the markers record intent — `@dual-pair` does not
guarantee the counterpart stays in sync (that is the cold agent's sweep, run
at audit time, not continuously), and `@cc-only-rationale` does not expire. A
reason written once stays written; nothing re-asks whether it is still true.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in.

- The rule text: `.claude/rules/dual-implementation-discipline.md` — delivery
  globs at `:9`, the injection summary at `:10`, the class-`A` header naming
  every enforcement surface at `:14`, the origin framing at `:19`.
- Problem statement §1 at `:25`; triggers and non-triggers §2 at `:39`;
  audience triage §3 at `:59`.
- The capability-check-not-brand-name detection principle: §4 at `:105`.
- The deterministic drift check (anchor resolution): §5 at `:124`.
- The CC-bias mitigation and the edit-time marker gate: §6 at `:156`.
- The edit-time gate itself: `.claude/hooks/check-hook-marker.sh` — the live
  `@cc-only-rationale` example at `:5` to `:8`, the two-marker grammar at
  `:14` to `:17`, and the exit-2 channel rationale at `:25` to `:27`.
- The population probe: `tests/agnosticism/probes/channel-coverage.sh` —
  Surface 8 header at `:2`, marker grep at `:50`, anchor extraction at `:56`
  (output above: 34 rows, exit 0 at this base). Gated in CI by
  `packages/core/principles/21-agnosticism-conformance.test.ts`.
- The gated brand-detection probe: `tests/agnosticism/probes/brand-detection.sh`
  (Surface 10); seeded-break paired-negatives in
  `tests/agnosticism/harness-self.test.sh`.
- The named cold agent for the semantic anti-patterns:
  `agents/dual-channel-drift-auditor.md` — its un-gateability (38% precision)
  is recorded in the rule's §8 at `:191` onwards and its §9 promotion history
  at `:209`.
- The index row grading this rule class `A` with channels
  `paths:(3), edit-time inject`: `.claude/rules/00-rule-index.md:21`.
