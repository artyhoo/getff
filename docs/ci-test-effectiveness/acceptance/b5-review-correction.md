# Task 6 review correction — B5 / D09

Immutable range checked: `960e980e9a60cc5196976339eb1d3754184c8b7b..99faad8d31a51ee1ddc0e62c7eb602374ce6054a`.

Original assertion: the Important finding claimed that `pre-push.consumer-layout.test.ts:1562` changed canonical ast-grep availability from successful spawn (`!spawnSync(...).error`) to successful version status (`.status === 0`), newly skipping the two S5 real-tool controls when canonical `--version` fails.

Verification: read the exact file from both Git objects using `git show`, with numbered lines, and the exact range's file diff using `git diff`. Base line 1565 and head line 1562 are identical:

```ts
spawnSync('ast-grep', ['--version']).status === 0 ||
```

The nearby `hasRuff` expression at lines 1553–1555 uses `!spawnSync(...).error` in both revisions. The original review incorrectly attributed that premise to the canonical ast-grep branch. This was a reading error; the supplied review-package diff already showed the canonical expression as unchanged context.

Decision: WITHDRAW the sole Important finding. There is no canonical-status regression in D09 and no required canonical-premise repair in this batch. The described discrepancy between S5's canonical version-status guard and the runner's canonical command resolution predates this immutable range. It is not evidence of D09 protection loss, was not independently established as a supported-case defect, and does not block this narrowly authorized sg-alias repair. No scope expansion or source change is requested.

Corrected SpecCompliance: PASS for scoped B5 / D09 local acceptance.

Corrected TaskQuality: PASS for scoped B5 / D09 local acceptance.

Critical: none. Important: none. Minor: none. All other strengths, evidence assessments, scope statements and CannotVerify limitations from the initial review are retained. In particular, actual ast-grep parser execution and hosted Node22 after-run remain unverified locally; the two real-tool skips are explicit. This is not campaign E9, hosted or TAK acceptance.

The original review is retained at `task-6-review-initial.md`; this correction supersedes its finding and CHANGES REQUESTED verdicts. No source files were modified, no tests were run, and no full review was repeated. Only the requested immutable Git-object verification and this correction were performed.
