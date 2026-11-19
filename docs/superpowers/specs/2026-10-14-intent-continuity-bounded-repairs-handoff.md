# Intent continuity — bounded repair delivery handoff

> **Authoritative for:** the two local repairs, their verification, and the operator-authorized delivery continuation on 2026-10-14.
> **NOT authoritative for:** changing product intent or architecture, product acceptance, main merge, new spending, or permission/security changes.

## Authority and ownership

The operator explicitly requested: fix the two gaps without an architectural redesign, then hand the work back to the existing session to make it usable for the next real task. This supersedes the reassessment handoff's discussion-only boundary for these two repairs and bounded delivery work. Preserve the approved PRD and agreed specification. No new standalone training task, broad audit ladder, scheduler, admission redesign, or additional operator plan vote.

Destination owner: Codex chat `01a12f1f-e428-7c20-bf36-687111335429` (local), the original intent/spec implementation chat.
Candidate: `/Users/art/.codex/worktrees/intent-continuity-stage/rules-as-tests-aif`, branch `codex/intent-continuity-stage`, base HEAD `41d0373f0031adbfada85cab9ecaff3f2dbb7492`. The app's 8e72 checkout is NOT the candidate. This sending session relinquishes writes after handoff. No GLM session was launched or resumed.

Existing authority/evidence: `2026-10-14-intent-continuity-reassessment-handoff.md` in this directory; its approved PRD/spec links and scope remain applicable. Preserve that pre-existing untracked handoff. Its statement that no repair is authorized is superseded only by the new operator instruction above.

## Repairs present in the working tree

1. `validateSpecReview` derives essential IDs from the digest-verified PRD itself. It supports the two existing brief table forms: an ID table under `Essential promises`, or an ID table with an `Essential` Yes/No column. Backticks/bold are supported and fenced examples ignored. A semantic `matches` must cover every essential; absent/unrecognized inventory holds instead of trusting the reviewer's list. Negative/uncertain reviews may report one problem and do not grant passage. No approved snapshot was edited.
2. Current-match selection considers all live valid objections for the same feature/PRD/spec bytes, independent of corpus ordering. A new full semantic `matches` must carry optional `resolutions: [{attemptId, reason}]` naming every objection and explaining its disposition. Unknown/foreign targets cannot grant passage. New objections hold again. Formatting equivalence cannot resolve disputes and recursively checks its parent. Old attempts stay immutable. Explanations are judged by the advisor; a nonempty string is not a machine proof of semantics.

The API holds with `missing_essential_promise`, `essential_promises_missing`/`essential_promises_invalid`, `spec_resolution_invalid`, or `spec_review_conflict` as applicable. Formatting chains with unresolved parents can retain the general missing-matches hold.

## Verification

- RED: seven initial regression cases failed against original code (omitted essential accepted, unstructured/fenced inventory accepted, three objection outcomes ignored, formatting path remained usable).
- GREEN: `npx vitest run packages/core/skills/intent-spec-continuity.test.ts packages/core/skills/intent-current-decisions.test.ts packages/core/skills/intent-result-review.test.ts packages/core/skills/intent-ask-advice.test.ts packages/runtime-bridge/test/result-review-effects.test.ts` — 5 files, 222 tests passed. New tests cover actual publication/presentation, agreement/plan preparation, explicit resolution, renewed objection, foreign resolution and formatting inheritance.
- `npm run typecheck` — all workspace typechecks passed, exit 0.
- Read-only live `current-decisions.mjs --check-presentation --feature intent-continuity --spec docs/superpowers/specs/2026-10-12-intent-continuity-design.md` — passes at revision 2, existing attempt `33c18f8cd26752334a9f0d61da6e1ae2b9b0aa38e309eff0756a61b63ec5eb23`. Existing approved document chain remains usable.
- `bash scripts/build-getff-dist.sh` and `--check` — pass, 1546 currently tracked payload files. Rebuild after adding the new test to Git: payload enumeration currently omits untracked files.
- Changed shipped-file formatting check and `git diff --check` passed. New test was formatted with Prettier.
- Full workspace tests, new cold review, remote CI, publication and installation were NOT performed in this repair turn. Earlier handoff limitations remain; do not advertise the full feature as installed/accepted.

## Next permitted action

Read and verify this local patch, finish only necessary delivery work, and establish a usable entry path for the next genuine task. Update the on-demand procedure documentation for the supported essential inventory and explicit dispute-resolution field; do not create a new workflow. Run affected required checks, review the bounded diff, and carry existing PR #2102 through its applicable delivery gates under existing authority. Check current remote state before assuming the old conflict still exists. Preserve publication/main-merge boundaries and the prior denied cleanup boundary.

Confirm where the feature is actually available (candidate versus installed/merged), the invocation path, and any remaining concrete blocker. Do not declare readiness solely from helper tests. AC7 remains deferred to the next genuine feature; no synthetic product matches. Treat the third historical approval-record concern as a trust-boundary question, not authority to build signatures or redesign decisions.

No files have been committed or pushed here. The new regression test and this handoff are untracked. Commit only scoped files, preserve other work, regenerate the manifest after staging the intended new test. There is no new review/retry budget; reuse existing evidence and perform bounded affected verification.

## Exact file hashes at transfer

- `.agents/procedures/intent/helpers/check-result-review.mjs` — `60707bfc228fa6ee197da628d053f4aac366c48bde49c06aae6eed503961ba7a`
- `.agents/procedures/intent/helpers/current-decisions.mjs` — `da8d177e952fae26768e30c71bdd35d139c14b0c7b965049081d342ba5df450f`
- `packages/core/skills/intent-spec-continuity.test.ts` — `3f0bca7935c7d65c1bd9a9b1afeaf1376009cf363fcf21a1abb484e720d3d376`
- `packages/core/skills/intent-current-decisions.test.ts` — `a4dde450400bfde83caa651464e5de8640da8d24a3aa2e9fef5b97e2f429bfaa`
- `packages/core/skills/intent-result-review.test.ts` — `615275adff1c0f262434d2fbdcf812dac1a89290890c2d21e54f9812c02b9593`
- `packages/core/skills/intent-ask-advice.test.ts` — `bcebedbddcf74da93315f779e4f0ab1a152b2b1286467cdaaa9d6efc21404ede`
- `packages/getff/MANIFEST.sha256` — `5c1de1e59c593a61ad0f985b3e6a790c63d0299fca67f2188faf031650a40c25`
