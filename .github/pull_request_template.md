## Summary

<one-paragraph what + why>

## Changes

<bullet list of substantive changes>

## Prior-art consult

- [ ] Capability commits in this PR carry a `Prior-art:` trailer (or `skipped — <≥20 chars rationale>` for hook-flagged commits that aren't real capability additions). See [CONTRIBUTING.md «Build-vs-reuse + `Prior-art:` trailer convention»](../CONTRIBUTING.md).
- [ ] If a new capability area surfaced during this PR: a new entry was added to [docs/meta-factory/prior-art-evaluations.md](../docs/meta-factory/prior-art-evaluations.md) in the same commit as the capability artifact, with `Verdict` / `Rationale` / `Trigger to revisit`.
- [ ] If existing entries matched: their `Last reviewed` date was updated in the same commit (`git log -p` on the SSOT confirms the touch).
- [ ] context7 queries (≥3 phrasings) for new capability areas were run and the results cited in the relevant commit body or research file.

## Test plan

- [ ] §1.7-свод lands in squash-body (`gh pr merge --squash --body "$(gh pr view <N> --json body -q .body)"`)
- [ ] `npm test --workspace=@rules-as-tests/core --run` green
- [ ] `make self-audit` green
- [ ] `npm run --prefix packages/core test:principles` green (principle 08 enforces SSOT citations on phase research files)
- [ ] If hook code touched: `bash tests/hooks/prior-art-trailer-hook.test.sh` green
- [ ] Manual smoke per change <list specific scenarios>

## Provenance

<stage PRs: kickoff/spec path · base SHA · substrate (aif task <id> + bridge-profile <name> | in-session) · models per stage · fidelity Round. Non-stage PRs: n/a>

<!-- Filling this in marks the PR as a stage PR: `FIDELITY: skipped` is then rejected and a
real verdict is required. Leave the placeholder or write `n/a` for non-stage PRs. -->

## Review findings

<stage PRs: factory review outcome + cold code-review summary (+ plan spot-check during the D1 calibration window). Non-stage PRs: n/a>

<!-- Stage PRs also carry the round-1 seat's `### Watch-list` sub-block here, pasted unedited,
plus one `Round N: <id> CLEAN | REINTRODUCED | N/A` line per follow-up round. Format + field set:
.claude/orchestrator-prompts/arch-v2-context-pipeline/watch-list.md §3. It is what a fresh cold
seat is handed instead of a resumed transcript (.claude/rules/cold-seat-economy.md §3). -->

## Fidelity verdict

FIDELITY: skipped — <fill>

<!-- The default above FAILS the pr-body-fidelity gate on purpose (<20 chars).
Non-stage PR: complete the rationale (>=20 chars), e.g. "docs-only change, no kickoff applies".
Stage PR: replace with the agents/fidelity-auditor.md output block:
FIDELITY: GO / Basis: <path> / Round: <n> / Audited-SHA: <PR head sha> / Evidence: <file.ext:N>
Single-block invariant: exactly ONE `## Fidelity verdict` section with exactly ONE FIDELITY:
line — a rework round REPLACES this block, it never appends below it (round history goes in
`## Review findings`). Evidence must sit on a line other than `Basis:`. Tokens are case-sensitive. -->

## Parked questions

<stage PRs: each parked question + resolution, or `none`. Non-stage PRs: n/a>

## §1.7 Self-discipline check (REQUIRED if PR touches discipline-bearing files)

> **DEFAULT:** mechanical maintenance — fill the Skipped line below. Replace with Forward+Backward H3 sections only if you are introducing or extending a discipline rule. See HTML comment for full guidance.

### §1.7 Skipped: <one-line reason ≥60 chars on same line>

<!--
INSTEAD of the Skipped line above, IF this PR introduces or extends a discipline rule (.claude/rules/**, packages/core/principles/**, EXECUTION-PLAN.md, prior-art-evaluations.md, CLAUDE.md, shipped templates), DELETE the Skipped line and use BOTH H3 sections:

### §1.7 Forward-check applied
<body ≥40 non-whitespace chars enumerating which existing disciplines were checked, with file:line citations per discipline — substance arm requires ≥1 file:line ref>

### §1.7 Backward-check applied
<body ≥40 non-whitespace chars enumerating the sweep of existing artefacts under the new rule's scope, with file:line citations per sweep>

The Skipped line above is the DEFAULT for mechanical maintenance (file split, cross-ref redirect, list extension, typo fix in rule text). Substantive rule introduction requires the Forward+Backward pair.

Reference: .claude/rules/phase-research-coverage.md §1.7
Skill:     .claude/skills/self-reflection/SKILL.md
-->
