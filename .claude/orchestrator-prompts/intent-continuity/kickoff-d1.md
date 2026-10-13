# Intent continuity — Stage D1 delivery kickoff

> **Authoritative for:** bounded canonical/native/runtime delivery and host-channel acceptance of the already agreed intent-continuity design.
> **NOT authoritative for:** changing product promises, redesigning `/intent`, `/arch` or `/pipeline`, starting execution from this design-only artifact, or publishing the shared WIP.

## Authority and placement

- Work in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`; verify `pwd` and preserve the unrelated WIP. No reset, clean, bulk stage, commit, push, PR or merge.
- Use the approved PRD snapshot `f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a` and agreed design snapshot `31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078` as immutable authority. Re-run `current-decisions.mjs --check-plan-prep` before accepting.
- Read A1/B1 acceptance and C1 evidence under `docs/superpowers/specs/reviews/intent-continuity/`. C1 has independent negative product attempts; do not turn `needs-evidence` into `matches` by technical test success.
- This file has no auto marker. A later `/pipeline` dispatch requires the tracked kickoff to be on `staging`; this in-session work does not dispatch it.

## Outcome and packets

1. Confirm the canonical `/intent` and `/arch` paths reach the approved PRD, agreed spec, class-bound advice, current result-review protocol and operator decision boundaries. Use existing procedures/cards rather than a new advisor registry.
2. Synchronize the runtime vendor copy from reviewed source and verify byte parity after the pinned formatter. Exercise the installed Codex/native card discovery and the reachable hook, direct dispatch, claim/release, `start-reviewed`, answer and manual-packet paths. A host path without a tested intercept stays explicitly unsupported.
3. Bind final evidence to exact source bytes: full host verification, focused and runtime suites, typecheck, formatter/parity, `git diff --check`, read-only selector query, independent code and product reviews. Preserve negative ResultReview attempts and their historical limits.
4. Report the A1 legacy freeze honestly. Its original `taskIds` array is empty. A live old `plan_ready` task was recovered from an unchanged pre-freeze server row through a one-time receipt; no age-only exemption is allowed. Other historical tasks without active-at-freeze proof remain held.

## Acceptance

Apply the active `ai-laziness-traps` rule: T2 requires a wired transition rather than prose, T14 rejects a product `matches` inferred from technical tests, and T19 requires independent review of final bytes.

- Current selected PRD/spec/review authority and changed-revision holds are observed on the reachable effect paths; removing a marker cannot silently select the legacy arm.
- The product-only result ruling is recorded as issued (`matches`, `mismatch`, `needs-evidence` or `needs-operator`), with no upgrade by producer narration. A fresh attempt and old attempt remain separately readable after a change.
- Runtime source and shipped vendor code have identical formatted behavior. Native cards point to canonical procedures and do not fork a second policy.
- The report separates verified host paths from out-of-checkout, external/manual execution, and historical tasks without recoverable freeze evidence.

```bash host-verify
bash scripts/check-ask-files.test.sh
npx vitest run packages/core/skills/intent-current-decisions.test.ts packages/core/skills/intent-ask-advice.test.ts packages/core/skills/intent-result-review.test.ts packages/runtime-bridge/test/result-review-effects.test.ts
npx vitest run packages/runtime-bridge/test
npm run typecheck -w @rules-as-tests-aif/runtime-bridge
node scripts/render-harness-config.mjs --check --only codex
```
