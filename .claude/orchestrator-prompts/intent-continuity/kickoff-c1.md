# Intent continuity — Stage C1 execution kickoff

> **Authoritative for:** bounded Stage C result-continuity execution and acceptance evidence.
> **NOT authoritative for:** changing the approved PRD or operator-agreed architecture, publishing shared WIP, or claiming arbitrary external execution is intercepted.

## 0. Authority and workspace

- Feature ID: `intent-continuity`. Approved PRD snapshot SHA-256 `f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a`; agreed design snapshot SHA-256 `31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078`. Read those exact artifacts and design §§4, 7–9 before work.
- A1 and B1 are locally accepted; read `docs/superpowers/specs/reviews/intent-continuity/{a1,b1}-acceptance.md`. Stage B1's ask routing is an input, not a substitute for result evidence.
- Work in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`; verify `pwd`. The checkout has approximately 397 pre-existing status entries. Preserve all unrelated WIP. No reset, clean, bulk stage, commit, push, PR or merge.
- Before any effect work, run the current selector's `--check-plan-prep --feature intent-continuity --spec <agreed snapshot>` and hold on exit 2. Do not treat an old passing record as current approval.
- This kickoff has no `bridge: auto` marker. The operator requested continued in-session implementation; no extra plan approval is required.

## 1. Outcome

On one existing factory route, an observed result gets an independently recorded intent ruling. A matching attempt can be used only while its selected PRD, observed-input revision and relevant source/evidence refs are current. A relevant change preserves the old attempt as history, holds dependent expansion, and permits scoped repair followed by a fresh attempt. An operator-approved PRD or agreed-spec change does not silently resume an unchanged task. Existing autonomous in-scope review/test/repair remains intact; `contract-revision` and `product-decision` require actual renewed authority rather than reclassifying as `within-contract`.

## 2. Interfaces and work packets

1. **Current result check:** extend `.agents/procedures/intent/helpers/check-result-review.mjs` additively. Keep its existing `--request` legacy contract. A current-use mode requires an owner-selected current PRD ref, current observed revision and published attempt path, then reuses the existing ref/attempt validator. It must reject stale result evidence while retaining the immutable attempt. Add paired tests for stale brief/revision and an unaffected feature.
2. **Effect currency:** reuse the selector's independently selected current PRD, agreed spec and current `matches` attempt at adopted dispatch, claim release, `start-reviewed`, answer-driven resume and reachable auto-marker hook/CLI routes. Bind the kickoff/task payload to exact current identities. Missing/foreign/stale evidence holds before side effects. Freeze-based legacy classification remains unchanged; removing an adopted marker must not let new work fall through. Inventory any route whose payload or host cannot be intercepted and report it unsupported.
3. **Change and repair:** use the existing result-review attempt format and repair/expand modes. Preserve historical attempts; select the new one only after publication and review. Demonstrate one real observed output and a fresh artifact-only intent ruling; technical test success alone is not a product match.
4. **Review and evidence:** tests use disposable fixtures and no paid LLM in CI. Run host verification, focused runtime and helper tests, negative/anti-tautology probes and an independent cold review of final bytes. Record commands, outcomes, held paths and unsupported channels under `docs/superpowers/specs/reviews/intent-continuity/`.

## 3. Scope and acceptance

- AC5: unchanged kickoff/PlanReview holds after PRD or spec supersession at every reachable adopted effect. Design-only kickoff writes no auto marker and does not dispatch.
- AC7: current observed result is compared independently with PRD; relevant changed inputs invalidate its current use; old attempt stays inspectable; repair is allowed; expansion waits for a fresh match.
- AC8: an operator-approved new PRD and exact agreed spec can establish new authority; previous agreement/answer cannot resume a changed task by itself.
- AC9: frozen legacy and unrelated WIP continue under their old contract; unknown/new work cannot self-declare legacy by deleting a marker.
- The stage is not accepted from helper-unit tests alone. Exercise at least one actual runtime effect boundary and report any unsupported manual/external path rather than claiming universal interception.

```bash host-verify
bash scripts/check-ask-files.test.sh
npx vitest run packages/core/skills/intent-current-decisions.test.ts packages/core/skills/intent-ask-advice.test.ts packages/core/skills/intent-result-review.test.ts packages/runtime-bridge/test/result-review-effects.test.ts
node scripts/check-arch-retell.mjs docs/superpowers/specs/snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md
node scripts/render-harness-config.mjs --check --only codex
```

## 4. Quality and handoff

Use test-first slices, the existing project rules and review/test-quality gates. Active AI-laziness traps: T2 (a helper green is not a wired effect), T3 (report actual commands and outputs), T5 (preserve WIP), T10 (enumerate reachable effect paths), T11/T16 (reuse the incumbent validator and bridge), T14 (hash/schema passes do not prove product meaning), T15 (self-test the result path), T19 (cold review final bytes), T20 (read live owner state before verdict). A failed current-authority or result check holds the affected branch, not permission to weaken the PRD/spec or bypass a review. Stage D owns canonical/native/vendor delivery breadth after Stage C acceptance.
