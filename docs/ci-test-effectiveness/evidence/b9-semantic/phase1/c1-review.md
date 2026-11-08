# Original cold semantic review: c1

- Reviewer: native_b9_semantics
- Protocol: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/protocol-277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc.md` (SHA256 `277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc`)
- Base: `f053bc8db6c4ec640d9f01bef3997c04adc91cf4`
- Head: `788a5d512b543ad561998a6ec2ad6c6c3f31eda3`
- Exact changed paths: `.github/workflows/checks.yml`
- Facts: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c1.md` (SHA256 `edc338019b604a0e3514e911d66d8e2718863976582126440d7e23731002c55d`)
- Prepared real diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c1.diff` (SHA256 `26005f9991dddd0385bf22ba42b83d02658d5392ac85aef3bb348a5a4435271e`)

Citations `facts:N` and `diff:N` refer to one-based lines in those exact supplied artifacts. The full supplied diff, including deleted/added/context lines, was read. These are controlled synthetic fixtures; no current repository subject, historical report, expected-controller file, fixture execution or host was consulted. Supplied unchanged-subject/contract/cost facts are fixed premises. This original report is not a controller-consumed protection-review record. Findings remain unresolved until the controller observes and records a valid disposition. Provenance labels reproduce the protocol's rubric and do not imply corpus or host validation of this review.

## Severity: MINOR

- Stable ID: C1-TQ-01
- File: `.github/workflows/checks.yml`, added `npm --prefix packages/core run test:release-index` step (prepared diff:14).
- What I saw: the new site-metadata step reaches exactly the release-index test and fixture/config already run by the retained required release-index job. Source, tools, environment, filters and merge boundary are identical (facts:3,14; diff:9,14).
- Why it's a problem: the renderer changes only dist/site, which this test cannot read. Running the same protection again adds two seconds of runner/required-job execution without testing renderer output or another contract. This is zero marginal contribution, not a tautological oracle.
- Failure-scenario: every affected required run pays for a second identical release-index evaluation, while a defect confined to rendered site output cannot become detectable through that evaluation. Removing the addition preserves all stated release-index detection and timing obligations.
- Triage: layer=implementation (`corpus-measured`); whose=reviewer (`judgment-only, not corpus-validated`); class=MINOR (`measured null` for the rubric class axis).
- Class: redundancy / zero marginal protection; minor recurring execution inefficiency.
- Evidence: facts:3,14; diff:9,13-14.
- Concrete fix: remove the appended invocation, retaining the required release-index job. A genuinely different site-output contract would need its own defect-sensitive witness, but none is required or claimed by this change.
- Disposition: unresolved. No source repair, controller consumption or owner deferral was observed.

## Test-Quality Review Basis

1. Relevance: release-index schema validation before merge is the stated risk; the retained job serves it.
2. Effectiveness: both commands resolve to the same actual test/fixtures by fixed premise. The added direct run shows no failure suppression. Independent assertion source and host execution are not supplied.
3. Non-theatre: the test itself is not shown to be fake; placement after the renderer supplies no additional observation of renderer output.
4. Independent oracle: no oracle defect is established. The finding concerns repeated evaluation, not expected values copied from the SUT.
5. Marginal protection/reuse: the retained required job covers every case with identical inputs and boundary. The complete affected facts explicitly exclude any distinct install, platform or timing contract.
6. Cost and channel: each invocation costs the supplied two seconds and both jobs are required. The inefficiency is small, so MINOR is proportionate; no queue or wall-clock measurement is invented.
7. Sufficiency: removing this addition preserves the stated schema protection. This report does not assess the unchanged test's exhaustive schema coverage, renderer correctness, or actual host status configuration.

History: no separately identified matched CI-history traces supplied. The two-second command cost is a fixed premise, not a measured trace inspected here. Bounded owner decision proposed: use the established equivalent retained check and remove the duplicate; no new benchmark or acceptance decision is necessary to establish equivalence within this fixture. This is advice, not observed owner acceptance.

## Two-AI Review Summary

- BLOCKER: 0
- MAJOR: 0
- MINOR: 1
- ESCALATED: 0

## Recommendation

Resolve C1-TQ-01 before controller acceptance under the protocol's unresolved-material-finding rule. No repair or consumed disposition is claimed.
