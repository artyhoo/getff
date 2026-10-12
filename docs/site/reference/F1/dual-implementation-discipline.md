---
title: dual-implementation-discipline rule
description: The rule that every Claude Code-native artifact either has a portable counterpart on the other harnesses this framework ships to, or records a deliberate, written reason why not.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/dual-implementation-discipline.md
  - .agents/rules/00-rule-index.md
  - tests/agnosticism/probes/channel-coverage.sh
  - tests/agnosticism/probes/brand-detection.sh
  - .agents/hooks/check-hook-marker.sh
  - .agents/roles/dual-channel-drift-auditor.md
  - tests/agnosticism/harness-self.test.sh
  - packages/core/principles/21-agnosticism-conformance.test.ts
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: surface-8-coverage-probe, stack: repo, date: 2026-10-10, result: 69-rows-exit0 }
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
| source | `.agents/rules/dual-implementation-discipline.md:19` |
| class | A |
| fires | shipping a new CC-native hook + choosing its delivery channel(s). |
| channels | paths:(6), edit-time inject |
<!-- getff:end section=F1-card-dual-implementation-discipline -->

<!-- vale on -->

## Explanation

This framework is developed on one AI coding harness but shipped to consumers
who may run another. The failure mode that follows is quiet: each new artifact
takes the path of least resistance — a hook only one harness can fire, a config
file only one harness reads — and the shipped product silently stops working
for everyone else. This [rule](../../terms.md#rule) makes the choice explicit
at the moment it is made. Every CC-native artifact must carry one of two
written markers: `@dual-pair` naming its portable counterpart, or
`@cc-only-rationale` stating why a counterpart is deliberately absent. The
rule's origin is a framing by the maintainer, quoted in its own file: use the
native features when they exist — but record that you chose to.

The markers are checked at two levels, and the class row is `A` because both
are executable. At edit time, a hook inspects any Claude Code hook script you
touch and rejects it if it carries neither marker. Across the population, a
CI probe walks every tracked hook script, resolves each `@dual-pair` anchor to
a real counterpart file, and fails on a dangling anchor. Run by hand, that
probe prints one line per artifact — 69 rows at this base, one per tracked
hook script in each of the two trees. Filtered to one hook's pair of rows:

```bash
bash tests/agnosticism/probes/channel-coverage.sh | grep 'worktree-setup'
```

```text
channel-coverage	.agents/hooks/worktree-setup.sh	dual-pair 'worktree-create-setup' resolves → scripts/create-worktree.sh (§5)	0	PORTABLE
channel-coverage	.claude/hooks/worktree-setup.sh	dual-pair 'worktree-create-setup' resolves → scripts/create-worktree.sh (§5)	0	PORTABLE
```

Every row ends `PORTABLE` — not because every artifact has a twin, but because
every artifact has a *recorded answer*: a resolved counterpart anchor, or a
deliberate choice with a reason.

The rule's more interesting half is what it refuses to do. Its own header
records that an earlier sketch tried to gate "is this artifact actually CC
biased?" — a semantic question — mechanically, measured the detector's
precision at 38%, and demoted that check to a named cold audit agent instead.
Brand-name detection is a different matter and *is* gated: a probe checks that
no shipped artifact greps for the harness's own name to change behaviour.
Semantic drift between a hook and its twin — same anchor, diverging logic —
stays with the cold agent, by measurement rather than by hope. That split is
the rule teaching its own lesson twice: [gate](../../terms.md#gate) the
mechanically detectable, name an auditor for the judgment-shaped rest.

Delivery here is framework-wide — the rule's globs cover hooks, agents, and
skills. The rule file itself lives in this repository's rule set, but the
artifacts it governs ship: hooks and skill-context files installed into
consumer projects carry the same markers, so the channel intent travels with
the artifact. The companion CI principle test runs the probe surfaces in CI; a
harness-self test proves each surface catches a seeded violation, so the
probes are shown to discriminate rather than merely to pass.

What the rule does not do: the markers record intent — `@dual-pair` does not
guarantee the counterpart stays in sync (that is the cold agent's sweep, run
at audit time, not continuously), and `@cc-only-rationale` does not expire. A
reason written once stays written; nothing re-asks whether it is still true.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The rule text: `.claude/rules/dual-implementation-discipline.md` — delivery
  globs at `:12`, the injection summary at `:13`, the class-`A` header naming
  every enforcement surface at `:17`, the origin framing at `:22`.
- Problem statement §1 at `:28`; triggers and non-triggers §2 at `:42`;
  audience triage §3 at `:62`.
- The capability-check-not-brand-name detection principle: §4 at `:108`.
- The deterministic drift check (anchor resolution): §5 at `:127`.
- The CC-bias mitigation and the edit-time marker gate: §6 at `:159`.
- The edit-time gate itself: `.claude/hooks/check-hook-marker.sh` — the live
  `@cc-only-rationale` example at `:4` to `:8`, the two-marker grammar at
  `:10` to `:12`, and the exit-2 channel rationale at `:21` to `:24`.
- The population probe: `tests/agnosticism/probes/channel-coverage.sh` —
  Surface 8 header at `:2`, marker grep at `:50`, anchor extraction at `:56`
  (output above filtered to one hook's two rows; the full probe prints 69
  rows, exit 0, at this base). Gated in CI by
  `packages/core/principles/21-agnosticism-conformance.test.ts`.
- The gated brand-detection probe: `tests/agnosticism/probes/brand-detection.sh`
  (Surface 10); seeded-break paired-negatives in
  `tests/agnosticism/harness-self.test.sh`.
- The named cold agent for the semantic anti-patterns:
  `.agents/roles/dual-channel-drift-auditor.md` — its un-gateability (38% precision)
  is recorded in the rule's §8 from `:194` onward and its §9 promotion history
  at `:212`.
- The index row grading this rule class `A` with channels
  `paths:(6), edit-time inject`: `.claude/rules/00-rule-index.md:21`.
