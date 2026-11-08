# Original cold semantic review: c2

- Reviewer: native_b9_semantics
- Protocol: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/protocol-277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc.md` (SHA256 `277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc`)
- Base: `c09dbae702a5f653f2839511aa7a40c199060d4c`
- Head: `24b59f7599d2ab7f291de08320449fdd8ed641af`
- Exact changed paths: `.github/workflows/checks.yml`
- Facts: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c2.md` (SHA256 `c3d31f5dafbaeb64e4b8e43b50921b836274ab023e5d0a046b2ec887d9e14dea`)
- Prepared real diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c2.diff` (SHA256 `1ab490b5f6c0144e7d5b5632dbe4bb1d5bdc7355f47e9ea20809808d2ad5db10`)

Citations `facts:N` and `diff:N` refer to one-based lines in those exact supplied artifacts. The full supplied diff, including deleted/added/context lines, was read. These are controlled synthetic fixtures; no current repository subject, historical report, expected-controller file, fixture execution or host was consulted. Supplied unchanged-subject/contract/cost facts are fixed premises. This original report is not a controller-consumed protection-review record. Findings remain unresolved until the controller observes and records a valid disposition. Provenance labels reproduce the protocol's rubric and do not imply corpus or host validation of this review.

## Severity: MAJOR

- Stable ID: C2-TQ-01
- File: `.github/workflows/checks.yml`, four added suite steps in shardB (prepared diff:14-17).
- What I saw: all four independent additions are serialized in B, although A and C have equivalent setup, prerequisites, event/path conditions, required aggregation and available placement capacity (facts:3-6; diff:6-21).
- Why it's a problem: the required critical path becomes 10800/11000 seconds in the two supplied runs while A and C each finish in about 600 seconds. The complete premises establish a cheaper equivalent schedule on the existing jobs, retaining every case, cold condition and before-merge boundary. This is a placement problem, not a reason to remove useful expensive tests.
- Failure-scenario: with all additions left in B, a change must wait around three hours for the required installer shard even though the same work can be placed across existing equivalent jobs with a projected maximum of 4500/4600 seconds. The avoidable modeled critical-path delay is 6300/6400 seconds, delaying merge validation without adding protection.
- Triage: layer=implementation (`corpus-measured`); whose=reviewer (`judgment-only, not corpus-validated`); class=MAJOR (`measured null` for the rubric class axis).
- Class: avoidable blocking execution cost / serial concentration despite an established equivalent placement.
- Evidence: facts:3-6, especially run17/run18 at facts:4-5; diff:6-21.
- Concrete fix: retain all suites and their required delivery, but place suite-1 in A, suite-2 and suite-3 in C, and leave suite-4 in B. Under run17's supplied durations this gives A=3000s, B=4500s, C=4500s; under run18 it gives A=3080s, B=4560s, C=4600s. These are arithmetic projections, not measured-after claims. Verify the resulting actual schedule/status delivery after the controller repairs source.
- Disposition: unresolved. No source change or fresh execution was performed, and no owner deferral was observed.

## Test-Quality Review Basis

1. Relevance: all original and added installer cases remain required before merge. The material risk reviewed here is needless delay in delivering that protection, not the usefulness of the suites.
2. Effectiveness: each addition directly invokes its independent suite; identical prerequisites and unique isolated temp consumers are fixed premises. Moving a command among these jobs preserves the stipulated subject, inputs, lifecycle and aggregation. Full suite assertion source and real host behavior were not provided.
3. Non-theatre: the proposed remedy executes the same cases with the same required boundary; it does not replace them with success records or skip them. No visible added `continue-on-error` or swallowing wrapper exists.
4. Independent oracle: no oracle defect is established; the partial diff does not expose assertions. The cost finding uses two independently supplied run summaries and explicit equivalence premises, not output recomputed by a test under review.
5. Marginal protection/reuse: preserve all unique suite identities. Reuse the existing equivalent jobs instead of adding jobs, removing cases or relaxing the gate.
6. Cost and channel: matched same-source totals are A/B/C=600/10800/600 and 630/11000/610 seconds. Existing 60-second setup is already included, so it is not charged twice in the projections. Rebalancing changes neither the job count nor total stipulated work. Actual queue/transfer variability and post-change wall time remain unmeasured; the finding rests on the established serial critical path and equivalent placement, not a global runtime SLO.
7. Sufficiency: this addresses the demonstrated imbalance while preserving quality and before-merge timing requirements. It does not claim a measured optimal schedule, guaranteed queue reduction or validation of every suite assertion. The controller must carry out repair and verify real delivery; that work was not observed.

History: use only supplied same-source successful run17 and run18 summaries (facts:4-5). Raw trace artifacts are unavailable, and none were sought outside the permitted inputs. These are synthetic fixed premises, not actual project measurements. No additional owner-value premise is needed to propose preserving the exact contract with less avoidable blocking time.

## Two-AI Review Summary

- BLOCKER: 0
- MAJOR: 1
- MINOR: 0
- ESCALATED: 0

## Recommendation

Resolve C2-TQ-01 before controller acceptance, preserving every case and the required before-merge boundary. The suggested schedule requires actual source repair and fresh verification; no fixed disposition is claimed.
