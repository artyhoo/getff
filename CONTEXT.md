# CONTEXT — project glossary

> **Authoritative for:** the project term list — what each term means, the operator's raw
> words for it (`_Operator says_:`), and which owner doc a term points at. Consumers: the
> `/wait-what` skill (operator-invoked) and the glossary hooks — `glossary-inject.sh`
> injects `"<raw word>" = <term>: <definition>` on a matching prompt, and the Stop hook
> counts the inline `term (explanation)` form; the learning counters live in the residue dir.
> **NOT authoritative for:** role and dispatch-channel definitions (Orchestrator / Worker /
> Reviewer, Mode A / Mode B) — the owner doc
> [glossary.md](.claude/skills/orchestrator/references/glossary.md) owns those, so this file
> carries only a gist + link for them; the Tier 0/1/2 routing criteria live in
> [tier-home.md](packages/core/templates/shared/tier-home.md). Upstream's «challenge the
> user against the glossary» rule is NOT adopted: the agent answers with the term plus its
> inline explanation and never corrects the operator's word (ADAPT, plain-words-recap-v2
> R-4 — the superseded ADOPT row is D-H11 in the harmonization spec).

## Land

**Land**: merge a finished branch or PR into its base branch — for an agent session that is
`staging` (an agent merges its own green PR); promoting `staging` → `main` is a separate
maintainer-owned step with its own hard rules.

_Operator says_: «приземлить», «приземли».

_Avoid_: «merge to main» as an agent action — the promote step is not an agent's call.

## Env tier

**Env tier**: the task-tier routing (Tier 0/1/2) that decides which model plans a piece of
work and whether the pipeline runs at all; the criteria live in
[tier-home.md](packages/core/templates/shared/tier-home.md).

_Operator says_: «энв-тир».

## Vendor

**Vendor**: copy a subset of upstream code into this repo's tree instead of adding a
dependency. A vendor copy is still a capability decision and rides the same consult gate —
byte-identity with an already-tracked blob is the only form that rides free.

_Operator says_: «вендорить».

## Chips

**Chips**: the token/quota units an agent session spends. «Да, чип на aif-диспатч» is an
approval to spend them on a dispatch.

_Operator says_: «чипы», «чип».

## Depth

**Depth**: how many levels of delegation may be nested — the hard limit is depth 2
(Orchestrator → Worker, and a Worker never spawns Workers). The role definitions live in
the owner doc: [Three roles](.claude/skills/orchestrator/references/glossary.md#three-roles).

_Operator says_: «глубина».

## Red

**Red**: a gate or test failing (GREEN = passing). A RED is a finding to triage, not noise —
prove it against the pristine baseline before attributing it to a diff.

_Operator says_: «красное».

## Harvest

**Harvest**: take a finished aif-agent branch and egress it into a PR after acceptance; the
[harvest skill](.claude/skills/harvest/SKILL.md) owns the flow and is operator-invoked.

_Operator says_: harvest.

## Egress

**Egress**: any outbound path from a session to the outside world — git push, `gh`, npm,
API calls. Container seats run on a measured egress map, and the
[egress rule](.claude/rules/egress-no-api-bypass.md) owns the no-API-bypass discipline.

_Operator says_: egress.

## Handoff

**Handoff**: the coordinator flow that hands a prepared worktree, branch and task to an
autonomous agent session (`HANDOFF_MODE=1`). A handoff session never switches branches and
never rebases or force-pushes.

_Operator says_: handoff.
