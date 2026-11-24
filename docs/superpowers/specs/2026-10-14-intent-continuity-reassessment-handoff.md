---
type: handoff
project: rules-as-tests-aif
updated: 2026-10-14T12:34:30+03:00
session: intent-continuity-implementation-review
branch: codex/intent-continuity-stage
status: active
---

# Handoff — intent continuity implementation reassessment

> **Authoritative for:** the review state, operator clarification, implementation inventory and evidence pointers captured on 2026-10-14.
> **NOT authoritative for:** changing product intent, replacing the agreed specification, accepting implementation, or authorizing execution/publication. The linked approval and agreement records retain their respective authority.

## Goal

Reassess whether the implemented `/intent` continuity workflow serves the operator's actual need with proportionate complexity. The need is to formulate a clear idea, preserve its purpose through specification and implementation, consult the appropriate document-bound advisor, and recover settled meaning after session loss. The next session should discuss whether the current architecture is too formal or restrictive before committing to repairs or simplification.

The latest operator request is to write this implementation recap, assessment, concerns and current specification for consideration in a separate session. It authorizes this document only. Do not start implementation, resume GLM, push, or merge from this handoff.

### Latest clarification

The operator said the implementation may be too rigid and formal: they primarily want the idea not to be lost during execution, alongside forming it at the beginning and the previously discussed lifecycle. They do not want a strict mechanism that creates more problems than it solves. This clarification does not silently cancel any previously essential promise or authorize removing particular safeguards.

The motivating example remains design-time drift: documentation-driven generation of stack-specific rules and tests repeatedly became ready-made stack templates because that was easier. The one-button installer is an example for judging preserved meaning, not an installer task within this feature.

### Read first

1. This handoff, especially the assessment, qualifications and next steps.
2. [Approved PRD snapshot](snapshots/intent-continuity/f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a.md) and [exact product approval](2026-10-12-intent-continuity-approval.md).
3. [Exact agreed specification](snapshots/intent-continuity/design-31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078.md) and [written-spec agreement](2026-10-12-intent-continuity-spec-agreement.md).
4. The implementation paths and acceptance records listed below, on demand.

The complete current specification already exists in the linked immutable snapshot; it is not paraphrased or replaced by this recap. Verified on this handoff's date: the readable `2026-10-12-intent-continuity-design.md` and the agreed snapshot both hash to `31000fc2b2bd0fc2c98f7315ec011660be9767a7e5be9cbfdc306fa334bbd078`. The PRD snapshot hashes to `f1a42d1c375b9f4b96dc662da714ed9abf54885fa93716b847d65d0cd7a7ee2a`.

The specification's original header still says agreement is pending. That is historical text in the frozen bytes; the separate agreement record documents the later operator agreement. Do not rewrite the snapshot or treat its header as current delivery status.

## Work completed

### Intended workflow

- `/intent` owns a narrative PRD: what is being built, why, and the finished experience. Seven promises IC-P1 through IC-P7 are essential to the complete feature.
- `/arch` discusses the specification with the operator. A separate fresh intent advisor compares the candidate with the approved PRD before it is offered for agreement, including when the author reports no doubt.
- After agreement, kickoff and plan preparation are autonomous. Both existing launch routes remain valid: authorized automatic dispatch or the operator's manual `/pipeline` launch.
- Questions route directly by class. Task advice uses the kickoff/plan, architecture advice uses the specification, and intent advice uses the PRD. Document dependency is not a compulsory chain of advisor calls.
- Roles recover from documents and decisions; continuously alive sessions and complete chat history are unnecessary.
- Independent product-result review remains distinct from code review. Old evidence remains inspectable, but changed relevant inputs require renewed applicability checks.

### Implementation as it currently exists

| Component            | Current behavior                                                                                                                                                                                                                                                   | Main source                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Current decisions    | Stores per-feature current PRD approval and spec agreement outside the candidate kickoff. Uses repository identity, conditional revision updates, a writer lock and atomic publication; preserves superseded decisions.                                            | `.agents/procedures/intent/helpers/current-decisions.mjs`                                                            |
| Specification review | Validates a distinct review record, publishes a content-addressed immutable attempt, and exposes presentation/plan-preparation checks. Formatting equivalence can bind a reviewed spec to new bytes through a bounded review chain.                                | `check-result-review.mjs`, `publish-spec-review.mjs`, `current-decisions.mjs`                                        |
| `/arch` integration  | Canonical instructions require a fresh artifact-only review, `--check-presentation` before offering the spec, a recorded exact agreement, and `--check-plan-prep` before preparing executable work.                                                                | `.agents/procedures/arch/references/{ideation,exit-and-escalation}.md`                                               |
| Advisor routing      | Extends the existing ask mailbox with target responsibility, feature/task identity, primary document, decisions and return address. Validates answer/journal bindings and document-restored responsibility. Task preparation/acceptance fetches the live AIF task. | `.agents/procedures/intent/helpers/ask-advice.mjs`, `.agents/checks/check-ask-files.sh`                              |
| Result review        | Publishes write-once result attempts and checks exact content references, current PRD and observed revision when a result ruling is used. Product meaning is judged by an advisor, not inferred by the validator.                                                  | `.agents/procedures/intent/helpers/{publish-result-review,check-result-review}.mjs`                                  |
| Runtime admission    | Distinguishes frozen legacy artifacts/tasks from adopted work. New work cannot become legacy merely by deleting its scope marker. Uses standing task receipts and a bounded recovery route for provably pre-freeze tasks.                                          | `packages/runtime-bridge/src/resultReview.ts`, `src/cli/recover-legacy-task.ts`                                      |
| Runtime effects      | Rechecks authority at supported dispatch, claim/release, manual packet, `/fire`, reviewed implementation start and answer-driven resume/restart boundaries. A scoped AIF task waits for a reviewed plan before implementation.                                     | `AifHandoffBackend.ts`, `AifFireBackend.ts`, `ManualBackend.ts`, `src/cli/{dispatch,claim,start-reviewed,answer}.ts` |
| Delivery             | Native cards refer to canonical procedures; runtime changes are mirrored into the shipped vendor tree and distribution manifest.                                                                                                                                   | `packages/runtime-bridge/vendor/src`, `packages/getff/MANIFEST.sha256`                                               |

These changes reuse existing skills, mailbox and runtime transports. They also introduce a substantial additional state/validation layer. Against the locally available `origin/staging`, the branch diff reported 94 files, 12,260 insertions and 283 deletions. This includes tests, review records, snapshots, derived files and vendor copies; it is not 12,260 lines of new production logic. The inspected helper/runtime files total about 5,002 lines, some predating this change.

### Assessment communicated to the operator

The implemented structure has useful properties: exact versions of decisions, direct role routing, document restoration, historical evidence and rechecks at reachable effects. It is not merely an instruction to be more attentive.

However, the reviewer judged that the balance may have shifted too far toward permission/state machinery relative to the motivating semantic problem. Missing or mismatched local records can hold work, while a formally valid review can still omit a central product promise. The resulting recommendation was to reconsider the architecture before automatically repairing every gate defect in place.

This is an architectural assessment, not an experimentally demonstrated claim that the workflow creates more cost than value. File count alone does not establish overengineering. No normal end-to-end feature has yet supplied consultation cost, operator-correction frequency, false-hold rate or recovery-effort measurements.

### Review concerns carried forward

The previous interactive review issued `VERDICT: REVISE` and graded the following three concerns MAJOR. They were found by source inspection, not by new dedicated reproductions. The next session must validate materiality and the existing trust boundary before treating the proposed remedies as settled requirements.

1. **Essential-promise coverage is not mechanically checked for spec review.** `validateSpecReview()` requires at least one promise and coherent comparisons for the listed promises, but does not compare that list with all essential promises of the approved PRD. A reviewer could omit IC-P1, mark another promise supported, and produce a structurally accepted `matches`. Inspect `check-result-review.mjs:1000–1097` and `current-decisions.mjs:435–445`. This matters directly to the motivating omission problem. Qualification: the agreed design deliberately assigns meaning to the semantic advisor; requiring a reliable complete promise population is a design question, not proof that a schema checker can establish meaning.
2. **Conflicting spec attempts do not invalidate an existing positive attempt.** `findMatchesAttempt()` searches for any live `matches` binding the PRD/spec and returns it. It does not resolve a later valid `mismatch` or `needs-*` about the same bytes; the corpus is sorted by content hash, not decision order. Scenario: one review says matches, another finds a lost promise, but presentation/plan preparation can still pass using the first. Inspect `current-decisions.mjs:395–445` and `publish-spec-review.mjs:51–69`. The design says conflicting evidence holds. A resolution/supersession rule must be considered without assuming that the newest opinion is always right or that a historical negative forever blocks a corrected review.
3. **Approval/agreement references are digest-checked without interpreting the referenced decision record.** `validatePrdReceipt()` trusts supplied `decision`, `approver` and digest bindings; `validateSpecReceipt()` trusts supplied `decision` and nonempty `operatorEvidence`. Both resolve referenced files, but do not verify that those files actually record approval/agreement of the same feature and bytes. An accidentally unrelated record can therefore accompany a valid-shaped advance. Inspect `current-decisions.mjs:312–376` against design section 6. Qualification: a trusted local recorder is an explicitly stated implementation assumption; arbitrary hostile local writers are not the acceptance target. Determine whether the receipt itself is intended as the authoritative normalized decision and how genuine authorization is established by the recorder. Do not silently turn this into a security/signature system.

Additional recorded limitation: answer-driven resume/restart reads and validates a task, then performs unconditional remote writes/events. It is not an atomic remote compare-and-swap transaction. Concurrent task changes can occur between the read and effect. This was previously disclosed as a watch item; no new race reproduction or severity reassessment was performed in this review.

## Failed approaches

- Repeated bounded repairs hardened selector locks, symlink handling, historical replay and expected-revision propagation. They fixed reproduced defects, but do not independently demonstrate semantic intent preservation or justify the total architecture.
- A synthetic/extra training task was rejected as too costly by the operator. Live AC7 is deliberately deferred to the next genuine feature; do not manufacture a product `matches` from fixtures.
- Blindly fixing the three latest findings was not started. The operator instead raised proportionality of the whole implementation and requested a separate design discussion.
- A historical mandatory relay through all advisor owners and a mandatory extra launch vote were superseded. Do not revive either as a simplification side effect.

## Current state

### Workspace and delivery

- Verified `pwd`: `/Users/art/.codex/worktrees/intent-continuity-stage/rules-as-tests-aif`.
- Candidate branch: `codex/intent-continuity-stage`.
- Reviewed local HEAD: `41d0373f0031adbfada85cab9ecaff3f2dbb7492`.
- Before writing this handoff the candidate working tree was clean and two commits ahead of its remote. Those commits are `ac7fb4f6e63` (test fixture type) and `41d0373f003` (manifest refresh).
- [PR #2102](https://github.com/artyhoo/getff/pull/2102) is open against `staging`. Live read on 2026-10-14 returned remote head `6336aa81014ffbdcd6ab940500b295357ad2b15b`, base `640a347efe34a6f110119c265ef5dbd5a2df724d`, and `mergeStateStatus: DIRTY`.
- No push or merge was performed in this review/handoff work. After this write, the new handoff is an untracked documentation file unless a later authorized action records it.
- The implementation was developed in `/Users/art/.codex/worktrees/0166/rules-as-tests-aif`, preserving large unrelated WIP, then extracted to this staging candidate. The app default `/Users/art/.codex/worktrees/8e72/rules-as-tests-aif` is not the reviewed candidate. Preserve all unrelated work; no reset/clean/bulk staging.
- GLM session `2b27b41e-b0cb-4ae6-9b69-841f5c3fd70c` was stopped before review. Do not resume a stale worker. Older blocked session `3201f56f-139f-4a34-9951-b18995da9946` is not an active implementation owner.

### Verification and its limits

Read-only mechanical verification on the reviewed HEAD reported:

- C1 host verification: 4/4 passed. Focused helper/ask checks: 213 tests passed; ask shell check, arch retell and Codex harness render checks passed.
- D1 host verification: 5/5 passed. Runtime-bridge: 556 passed, 1 skipped. Runtime-bridge and workspace typechecks completed without error.
- Formatting/vendor parity and distribution manifest checks passed; manifest covered 1,546 files. Branch diff whitespace check passed.
- Full workspace tests were interrupted before a final aggregate. Failures observed first: principle 44 kickoff-name resolution, pipeline `repo-root-anchor` r7, and dispatcher `probe-inflight` f/g. The run also reported `gh unavailable`. These results do not establish a green full suite or establish every failure as a candidate regression.
- Remote PR checks are on the older remote head. Earlier read showed a failed `ci-success`; do not substitute local targeted success for remote delivery readiness. Refresh live CI in the next session if needed.
- A pre-push blocker involved an ignored `kickoff-c.md` symlink to the coordination home, which fails the kickoff naming rule. A previous delete request was denied by automatic approval review. Do not bypass the denial or delete an external target as cleanup.

Product acceptance is distinct: published C1 attempts currently say `needs-evidence`. Full AC7 has no independently justified positive real-result ruling followed by invalidation after a relevant change. The operator moved that demonstration to the next genuine feature; this is a recorded deferral, not a reason to run a costly standalone training exercise.

A1's fresh Codex companion-skill probe was read-only/non-interactive. It demonstrated bounded routing predicates, not a full operator dialogue and writable `/arch` lifecycle. Some earlier A1 probe outputs live under `/Users/art/.claude/jobs/edbd9d66/tmp/`; their existence must be rechecked before relying on them across host cleanup.

## Next steps

1. Reconcile live branch/HEAD/working tree with this handoff, then discuss proportionality using the approved PRD and exact agreed spec. The priority is deciding whether the extra authority/admission machinery is justified by concrete failure scenarios.
2. Classify each component as necessary for an existing essential promise, useful but deferrable, or removable duplication. For every proposed removal, state what concrete failure becomes possible and how the remaining workflow handles it. Do not equate fewer files with a better solution.
3. Validate the three source-review concerns and their trust assumptions. Keep core semantic coverage, contradictory-review handling and genuine decision authority visible even if their implementation becomes simpler.
4. Compare bounded alternatives: retain the present architecture with targeted repairs; simplify document/review state while preserving required transitions; or stage a smaller supported route and explicitly defer broader enforcement. These alternatives are discussion inputs, not an approved redesign.
5. Use `/arch` only when preparing a revised design. Present material changes to responsibilities, authority and review transitions for operator discussion before implementation. Update exact agreement only after that discussion.

The previous recommendation to pause merging and consider simplification is preserved as a recommendation. No revised architecture, removal list, repair plan or implementation launch was agreed in this handoff turn.

## Files affected

Created by this handoff turn:

- `docs/superpowers/specs/2026-10-14-intent-continuity-reassessment-handoff.md` — this file only.

Primary authority and current specification:

- `docs/superpowers/specs/2026-10-12-intent-continuity-idea.md` and its `f1a42d1c...` snapshot.
- `docs/superpowers/specs/2026-10-12-intent-continuity-approval.md`.
- `docs/superpowers/specs/2026-10-12-intent-continuity-design.md` and its `design-31000fc2...` snapshot.
- `docs/superpowers/specs/2026-10-12-intent-continuity-spec-agreement.md`.

Implementation and acceptance inventory:

- `.agents/procedures/intent/helpers/{current-decisions,ask-advice,check-result-review,publish-spec-review,publish-result-review}.mjs`.
- `.agents/procedures/intent/references/{product-brief,result-review}.md`.
- `.agents/procedures/arch/references/{ideation,exit-and-escalation}.md`.
- `.agents/procedures/dispatcher/references/parks.md`, `.agents/checks/check-ask-files.sh`.
- `packages/runtime-bridge/src/resultReview.ts`, backend files and CLI paths listed in the component table; corresponding `vendor/src` copies.
- `.claude/orchestrator-prompts/intent-continuity/kickoff-{a1,b1,c1,d1}.md`.
- [A1 acceptance](reviews/intent-continuity/a1-acceptance.md), [B1 acceptance](reviews/intent-continuity/b1-acceptance.md), [C/D acceptance](reviews/intent-continuity/c-d-acceptance.md).
- `docs/superpowers/specs/reviews/intent-continuity/c1-evidence/` — result attempts and bounded observations.
- [Earlier cumulative handoff](2026-10-12-intent-continuity-handoff.md) — useful historical decisions, but some delivery-status paragraphs predate the staging PR.

The root `HANDOFF.md` concerns another task, `skills-standards-repair`. It was deliberately preserved; this task-specific handoff must be passed explicitly to the new session. No `CLAUDE.md` rehydration instruction was added.

## Key decisions

- Operator: idea describes what and why; specification describes how. Both are discussed with the operator.
- Operator: each advisor has its own primary document; route questions by class. No mandatory relay or permanently alive sessions.
- Operator: kickoff/plan preparation and in-scope implementation/review/repair are autonomous after spec agreement. Both existing launch routes are accepted; no extra internal-plan vote.
- Operator: changing the idea requires consent. Material replacement of agreed architecture returns to spec discussion; routine implementation details do not.
- Operator: reuse the existing factory and quality rules. Do not replace generated stack practices with static templates, build a new factory, or silently drop the complete lifecycle.
- Operator: use the next genuine feature for deferred live AC7 evidence instead of a separate expensive exercise.
- Reviewer: current technical foundation has useful mechanisms, but the claimed semantic protection and the proportionality of the state layer need reconsideration. This assessment does not authorize a redesign.
- Operator, latest: prepare this handoff and current spec for another session to consider whether the implementation is too rigid. No implementation changes requested in this turn.

## Gotchas / open questions

- Speak Russian with the operator. Keep repository artifacts and machinery in English.
- Recheck `pwd` first. Work from the staging candidate for this review; do not infer the candidate from app-default or skill-picker paths.
- Mandatory spec-to-intent review remains a product requirement. Simplification must not quietly revert to checking only when the author happens to ask.
- Byte identity, actual agreement, reviewer independence and semantic correctness are different claims. Hashes do not prove preserved meaning; declarations do not prove actual isolation.
- The agreed spec accepts procedural checkpoints on hosts without interception and explicitly does not claim confinement of arbitrary noncompliant agents. Do not grade those acknowledged limits as newly discovered bugs.
- Trusted local recording is a declared boundary. Decide what the normal recorder must verify without introducing an unsolicited adversarial security architecture.
- Every changed byte currently affects exact reference binding. Whether bounded formatting equivalence and normal repairs impose reasonable effort remains unmeasured.
- Missing local coordination state can hold work. Determine whether that is useful protection, disproportionate friction, or a deployment/configuration issue on the intended route; no false-hold-rate evidence exists yet.
- Restoring approved meaning from documents should not force the operator to repeat discovery. The latest concern must not trigger a complete re-interview of settled product goals.
- Resume prompt for the new session: read this handoff and the linked exact PRD/spec, verify live state, then discuss implementation proportionality and the review concerns. Do not repair, remove, launch, push or merge before that discussion establishes the next scope.
