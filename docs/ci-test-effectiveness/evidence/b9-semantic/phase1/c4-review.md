# Original cold semantic review: c4

- Reviewer: native_b9_semantics
- Protocol: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/protocol-277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc.md` (SHA256 `277796610de20a555acd7d5c7d0b2918928152fc2a9f7cb8d29666842a74a9fc`)
- Base: `425ab2880f4282ce7a4be1c665a7e2050ea74f0a`
- Head: `8eb048c67a28f463e3a100ad558bc85797a9d111`
- Exact changed paths: `.github/workflows/checks.yml`
- Facts: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c4.md` (SHA256 `f19390fe09c5a78064ca558fa73448b64372f1b279edb5d8d08826851f34b01e`)
- Prepared real diff: `/workspace/getff-native/.superpowers/sdd/ci-test-effectiveness/semantic-corpus/inputs/c4.diff` (SHA256 `22dc5b547129380c848763823c5f62c7f182f266883fbd3715376bef3728bf7c`)

Citations `facts:N` and `diff:N` refer to one-based lines in those exact supplied artifacts. The full supplied diff, including deleted/added/context lines, was read. These are controlled synthetic fixtures; no current repository subject, historical report, expected-controller file, fixture execution or host was consulted. Supplied unchanged-subject/contract/cost facts are fixed premises. This original report is not a controller-consumed protection-review record. Findings remain unresolved until the controller observes and records a valid disposition. Provenance labels reproduce the protocol's rubric and do not imply corpus or host validation of this review.

## Test-Quality Review

No material finding in this bounded addition. The confirmed cold-only installer failure and explicit before-merge requirement make the new invocation relevant; the retained warm checks cannot cover the empty executable/package-cache state. The three stacks have distinct outcomes, so neither repeated-looking setup nor their combined duration establishes redundancy.

Seven-criterion assessment:

1. Relevance: the supported cold install must yield a valid first commit and reject planted violations before merge; the supplied incident establishes a concrete missed failure (facts:3).
2. Effectiveness: the actual locked installer, empty caches, successful first-commit assertion, violation companion and cleanup checks are fixed premises. The diff adds the real shell test to the existing pull-request job (diff:6-13). This is a direct run without a visible failure-suppression wrapper. Full runner internals and host status delivery were not provided or executed.
3. Non-theatre: the stipulated subject is the actual uncached installation, with resulting behavior checked, rather than a declaration of coverage. The added command targets that subject (diff:13; facts:3).
4. Independent oracle: valid first commit, rejected planted violation and clean cleanup are externally specified outcomes. Warm-state success is not substituted for cold behavior. Assertion source itself is outside the partial fixture.
5. Marginal protection/reuse: this adds the missing empty-cache witness, retains warm probes, and reuses the existing Linux installer job. No equivalent cold suite or available same-environment shard is supplied; all stacks have unique dependency/config results (facts:3).
6. Cost and channel: the two supplied same-source timing summaries are 1680s and 1710s, with 80% required uncached transfer. This is a substantial before-merge cost, but no cheaper sound equivalent is established. Removing stacks, mocking transfers, adding a job or moving the check to nightly would not be a justified remedy on these premises. No arbitrary speed target is imposed.
7. Sufficiency: the added witness covers the supplied cold-only risk. The review does not independently validate the claimed test implementation, real registry behavior, branch protection or actual project timings. Those are fixture premises or unavailable host evidence, not reasons to invent a finding.

History: two supplied matched timing summaries at facts:3; raw CI trace artifacts are not supplied. These are synthetic fixed premises, not measurements observed by this reviewer. Any deployment outside this fixture requires the controller to confirm host delivery and the owner's real before-merge requirement; no owner acceptance is claimed here.

## Two-AI Review Summary

- 0 material issues found within the supplied scope.

## Recommendation

APPROVE the bounded change on the supplied premises. This is not project/host acceptance.
