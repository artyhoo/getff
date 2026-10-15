---
title: egress-no-api-bypass rule
description: The rule that a finished agent branch lands through the host's real git push — the channel that runs the pre-push gate — and the server-side API route is a break-glass path, never the default.
kind: reference-sheet
generator: scripts/render-reference.mjs
sources:
  - .agents/rules/egress-no-api-bypass.md
  - .agents/rules/00-rule-index.md
  - .agents/procedures/harvest/SKILL.md
  - .agents/procedures/dispatcher/helpers/harvest-via-api.sh
  - scripts/run-local-ci-sweep.sh
  - setup.d/lib.sh
  - setup.d/10-skills.sh
  - docs/site/reference/B.json
  - docs/site/reference/F1.json
  - docs/site/reference/F1.md
  - docs/site/terms.md
executed:
  - { example: api-vs-push-census, stack: repo, date: 2026-10-07, result: 9-api-0-push }
docs-refresh: deferred — re-verified 2026-10-12, the cited local CI sweep script changed only one comment citation renumber; the sweep gate table and egress contract this sheet maps are untouched; the overview's 2026-10-12 all-30 refresh (status paragraph, class-list links, frontmatter sources only) is also re-verified — this sheet's sole #how-to-read-a-rule-page anchor into it is untouched; clears at the next gold refresh of this page
---

# egress-no-api-bypass rule

## Fact card

What each row means: [how to read a rule page](../F1.md#how-to-read-a-rule-page).

<!-- vale off -->
<!-- vale-reason: the card quotes the rule file's own header text verbatim, in the rule file's voice rather than this site's -->

<!-- getff:begin section=F1-card-egress-no-api-bypass plan=scripts/render-reference.mjs -->
| Field | Value |
|---|---|
| name | `egress-no-api-bypass` |
| kind | rule |
| ships-to | framework |
| description | the egress channel-preference rule — §1 the two channels (host-push default / API break-glass), §2 trigger, §3 mechanism + why the container cannot push, §4 promotion / retirement, §5 §1.7 self-reflexive note. |
| source | `.agents/rules/egress-no-api-bypass.md:7` |
| class | B |
| fires | harvesting/egressing a finished aif-agent branch to a PR. |
| channels | skill-embed |
<!-- getff:end section=F1-card-egress-no-api-bypass -->

<!-- vale on -->

## Explanation

When an AI agent finishes work in its container, that work has to leave the
container and become a pull request. There are two roads out. The normal road:
bring the commits to the host machine and run `git push` there, which fires the
repository's real pre-push [gate](../../terms.md#gate) before the PR exists.
The emergency road: create the commit and the branch directly through the
hosting platform's API — which never touches the local hook, because the
commit simply appears server-side, already landed.

This [rule](../../terms.md#rule) exists because the emergency road was once
the documented default. The harvest procedure's own text prescribed API-landing
as the standard egress, on the reasoning that a container is a runtime, not a
push environment. The operator flagged the flaw: the project's whole discipline
stack is "every rule fails at the earliest reachable channel", and an API-land
silently deletes the pre-push channel from the pipeline. The rule inverts the
default — host-push always, API only when the host transport itself is dead,
and even then not as a free pass: the local CI-equivalent sweep becomes the
mandatory substitute for the skipped hook, plus a clobber check against the
live remote tree.

The rule's file grounds the "why" in measurements. A script-transport census
of the API path, re-run at this base:

```bash
grep -c "gh api" .claude/skills/dispatcher/helpers/harvest-via-api.sh
```

```text
9
```

Nine API calls build the commit and the ref entirely server-side — and a grep
for `git push` in the same script finds one hit, a comment line: the script's
own break-glass rationale, stating that it exists for the case where the git
transport to the host is dropped while the API endpoint stays reachable. The
container's inability to push is also deliberate,
and the rule argues it should stay that way: the network block is at the TCP
layer (verified from inside the container), the pre-push toolchain is absent
there anyway, and an autonomous agent in a sandbox that could push to the repository
would widen the trust boundary, not close a gap.

The [channel](../../terms.md#channel) row is a single `skill-embed`: the rule
is carried into the harvest skill's egress section, where an agent chooses
a push channel. That carrier is live: its egress heading carries the named
anchor. The rule file itself is framework-only. Its harvest carrier is a
portable factory-tier skill, installed into consumer projects selected for
`PROFILE=factory` or the legacy `--with-aif-suite` route. Those two delivery
scopes should be read separately.

The `class` row is `B` — a compensating mechanism without a test. The rule's
own header is precise about why: no branch-scoped CI run can assert "this
branch was landed through the host hook rather than the API", because the
landing method leaves no trace in the resulting commit. The promotion path is
named: a preflight check that requires a recorded host-transport-failure probe
before any API-land is tolerated, built when the first "API used while the
host was alive" incident appears.

What the rule does not do: nothing blocks an API-land today, so the discipline
is a written preference plus the harvest skill's labelled break-glass block —
not an enforced gate. And it deliberately does not govern CI tool installs; a
sibling rule in this family owns that surface.

## Evidence

Checked 2026-10-07 against the working tree this batch was written in; citations, counts and captured outputs re-verified 2026-10-10 against the merge-forward tree. Pins re-verified 2026-10-12 at the universal-integration branch head: the range's rule/test/workflow edits (including the in-body citation renumber) shifted no pin cited on this page — every pin was re-read at the current base and still shows the quoted content.

- The rule text: `.claude/rules/egress-no-api-bypass.md` — the skill-embed
  channel marker at `:3`, the class-`B` rationale at `:5`, the two-channel
  statement at `:7`, and the 2026-06-27 origin (the harvest skill defaulting
  to API-land) at `:10`.
- Channel A (host pull, `git pull --rebase` onto live staging, host push — runs
  the real pre-push hook): `:14` to `:22`, with "earliest reachable channel" at `:22`.
- Channel B (API as break-glass only, with the mandatory `run-local-ci-sweep.sh`
  gate-substitute and clobber check): `:24` to `:26`.
- Why the container cannot push (TCP-level network block, missing pre-push
  toolchain, deliberate trust boundary): `:34` to `:38`; the rule-sets-preference,
  skill-owns-steps split at `:40`.
- The census above: `.claude/skills/dispatcher/helpers/harvest-via-api.sh` —
  9 `gh api` occurrences, and the only `git push` match is `:8`, inside the
  break-glass rationale comment at `:7` to `:9` (both greps run at this base).
- The live skill carrier: `.agents/procedures/harvest/SKILL.md:40` — the
  egress heading carrying the `#egress` anchor; the sweep section at `:57`.
- Harvest delivery: `docs/site/reference/B.json:161` to `:175` grades it
  factory-tier; `setup.d/lib.sh:65` includes it in `GETFF_SKILLS_FACTORY`;
  `setup.d/10-skills.sh:170` to `:181` copies the suite and its sweep script.
  `setup.d/lib.sh:2741` to `:2752` names the consumer skill destination.
- The gate-substitute the break-glass path mandates:
  `scripts/run-local-ci-sweep.sh`.
- The promotion trigger and retirement criteria: `:44` and `:45`.
- The index row grading this rule class `B` with channels `skill-embed`:
  `.claude/rules/00-rule-index.md:23`.
