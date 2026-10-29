# F12: use fresh squash-preview bases in PR gates

> Authority: task-specific design and verification record; merge-forward policy remains in .claude/rules/git-conflict-merge-forward.md.

Choose Option A: resolve the base in each affected workflow, without changing the shared GitProvider. Validate the event base ref, fetch that branch explicitly, and compute merge-base(fresh base, explicit PR head). Export the git-produced SHA through step output. This keeps the squash-preview diff merge-base → head and excludes unrelated staging commits after merge-forward. Merely-behind branches remain valid; a direct fresh-tip → head diff would falsely report missing newer base files.

## Complete consumer population

Cold sweep found three event-base consumers in two workflows. pr-body-prior-art.yml is the F12 defect. pr-stale-revert.yml's Removal consumers step shares the ordinary PR-diff concern and is fixed in the same patch. Its archaeology step deliberately compares event-base history, documented in collectArchaeology; preserve that exception. rangeGit has one production caller, the prior-art bin, and no hook/plugin twin exists. The workflow resolver establishes a valid ancestor before the provider's existing fallback can be reached. A failure to fetch or find a merge-base makes the job fail closed.

Both workflows pin actions/checkout v4.2.2 by immutable SHA and fetch-depth 0. The prior-art checkout may be a synthetic merge, but calculations use the explicit event head. The stale-revert checkout explicitly uses that head. Inputs pass through quoted environment variables; no shell interpolation of GitHub expressions occurs in executable text. Removal runs after an archaeology failure only when range preparation succeeded.

## Pinned tests, evidence and falsifiers

Both complete workflow pre-images were saved before edits. Tests execute their actual shell steps and shipped bins against real temporary local Git repositories. The fixture pins old event base O, a fresh B containing a foreign 90-line capability and shipped-template removal, and docs-only H merged forward from B. The local origin/staging ref is deliberately stale, so omitting fetch is observable. RED: 8 failed / 4 passed; GREEN: all 12 pass. Controls cover behind docs PRs, genuine capability/trailer enforcement, missing refs, missing head objects and unrelated histories. Cold review independently passes all 12 and finds no actionable security/regression issue. actionlint, offline zizmor and core typecheck pass.

Falsifiers: foreign capability/removal enters the range; a merely-behind docs PR is classified as deletion; a real capability passes without its trailer; an invalid ref/head/history clears the job; event-base archaeology changes. No paid LLM/API is used.

## Delivery state

The temporary approval-service usage error cleared: the current usage tool reports ordinary usage allowed. This atomic change is published on its own staging PR. Regenerate packages/getff/MANIFEST.sha256 after committing the shipped test, because the assembler enumerates tracked files.
