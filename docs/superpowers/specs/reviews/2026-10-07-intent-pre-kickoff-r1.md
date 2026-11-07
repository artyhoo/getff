# Intent workflow — pre-kickoff review

> **Authoritative for:** this review of the revised design, at the content digest below.
> **NOT authoritative for:** product approval, implementation authorization, historical review verdicts, or live semantic efficacy.

- Input: `docs/superpowers/specs/2026-10-07-idea-arch-incremental-design.md`.
- Input SHA-256: `1af90f9e909eac2efbcd67848a09b786455f40d122571bf3282603716bb7789f`.
- Repository HEAD: `e2d48a853f612d91bf509130b6c4b4144e867267`; the input is a working-copy revision, not the HEAD blob.
- Method: full artifact read; recorded-premise review; delegated read-only source verification without delegation of this verdict.
- Operator request: review the named specification and, if sound, write the kickoff. This authorizes preparation of the next artifact; no runtime was launched.

```text
VERDICT: GO
BLOCKER (0)
MAJOR (0)
ESCALATED (0)
MINOR / notes lane (3): execution prerequisites below; no design re-review round.
Next step: author the scoped S1 kickoff and retain S2/S3 as outcome/dependency outlines.
```

## Findings and evidence

1. **Product intent remains above implementation.** Spec:54–73 preserves a product-only brief, isolated understanding and restoration; spec:63 reserves changed acceptance distinctions to the operator. This implements recorded P2/P4/P5 and D-INTENT-CONTEXT rather than silently choosing new preferences.
2. **The first stage is a useful vertical path.** Spec:155–163 requires actual observation, blind deficient-result detection, a dependent hold, repair and recheck. Merely installing a skill or fabricating a mismatch record cannot close S1 (spec:168).
3. **Enforcement claims have explicit bounds.** Spec:118–122 distinguishes semantic omission review from deterministic validation of declared scope; spec:178 covers inherited/standing scope and does not advertise resistance to total record stripping. This is consistent with README:51–64 and rule-enforcement-channel-selection.md:21–24.
4. **Continuation and recovery account for real runtime seams.** `AifHandoffBackend.ts:336–355` stores the kickoff as description while the planner produces a separate plan. `cli/dispatch.ts:171–179` returns on dedup before calling a backend. `AifHandoffBackend.ts:394–396` releases by task ID; `cli/answer.ts:344–345` replaces the plan and unpauses. Spec:126–145 explicitly adds obligations at those seams and does not claim they already exist.
5. **Reuse is accurately limited.** Prior-art #64 (`docs/meta-factory/prior-art-evaluations.md:136`), #201 (:274) and #253 (:326) cover execution/review, advisor strategy and interviewing/domain vocabulary. They do not demonstrate semantic discrimination. Spec:184 preserves that distinction. Advisor design:157–168 allows restoration as a fresh instantiation.
6. **Delivery breadth can follow correctness.** `setup.d/lib.sh:64–65` places arch/pipeline at env depth while `setup.d/55-runtime-bridge-vendor.sh:35–36` reserves the runtime vendor for factory. Spec:159/196 requires S1's own loading dependencies now and env support later without a factory-only dependency.

## Notes carried into the kickoff

- **Read the actual ESLint messages.** `firing-runner.ts:47–69` returns rule IDs, and `firing.test.ts:83–97` tests detection. Those outputs cannot establish diagnostic usefulness. The pilot must capture full Linter messages and a real installed consumer command. `from-node.ts:114` derives the message from the claim; change only the disposable consumer's message, leaving selector/severity/detection unchanged.
- **Review the effective plan before it runs.** Existing claim-before-Phase-minus-one reviews the kickoff, not future planner output. Local upstream source shows a usable candidate: `aif-handoff/packages/shared/src/stateMachine.ts:85–91` supports `start_implementation` with `autoMode:false`. Verify this on the actual destination before relying on it; a source checkout is not deployment evidence.
- **No invented remote atomicity.** The current answer write is unconditional. S1 must hold scoped restarts unless its existing owner path can exclude concurrent writers and bind exact payload/pre-image. Contract-changing automatic resume remains unavailable until S2 proves that prerequisite, as spec:130 requires.

## Falsifiers and verification limits

This GO is wrong if the kickoff allows a removed essential promise to manufacture a match, releases a scoped task before the actual plan review, lets an invalid dependency succeed through dedup/fallback, or declares semantic success without a blind advisor judgment over raw evidence. These conditions are acceptance negatives, not additional product choices.

No implementation or live pilot was reviewed. No production readiness, long-term savings, model equivalence or remote serialization guarantee is asserted. Independent evidence verification found no incorrect direct source citation in the checked set. The existing npm suites are a seed check only; their result is recorded separately below.

### §1.7 Forward-check applied

The review applies the recorded-premise/severity contract from `.claude/rules/reviewer-discipline.md:60`, the goal at `README.md:51`, and the earliest-channel split at `.claude/rules/rule-enforcement-channel-selection.md:21`. No paid CI inference, global setting edit, runtime change or unsupported production claim is introduced.

### §1.7 Backward-check applied

The checked class spans clarification, result review and dependent continuation: arch ideation/exit, advisor restoration, pipeline stage review, dispatcher parks, runtime dispatch/dedup/claim/release/answer, direct manual/fire effects, and env/factory delivery. Existing predecessor-merge and technical/fidelity gates remain separate requirements. Source evidence and limits are listed above; this is not an exhaustive external prior-art search or a live deployment audit.

## Seed validation

Command: `npx vitest run packages/core/backends/npm/from-node.test.ts packages/core/backends/npm/firing.test.ts` on the host. Exit 0; Vitest reported 12 test files / 114 tests passed. This confirms existing seed behavior, not new workflow or semantic efficacy.

## Kickoff cold review and closure

A fresh artifact-only reviewer checked immutable spec/kickoff snapshots. Initial kickoff digest `ba9b657b33d4d68bc3a3c78a356cb1b3d90b3d86f0384ea4fd07c1eff2aa57c6`: REVISE, one MAJOR. Task 1 omitted the local `CLAUDE.md:131` domain-modeling binding while promising direct intent discussion (spec:189). Failure scenario: direct intent either loses its companion or violates the unchanged arch-only prohibition.

**Disposition: FIXED.** The file list and Task 1 now require changing that binding, permitting direct/arch-mediated product discussion and preserving the ordinary-vocabulary exclusion with paired fixtures. The same cold reviewer verified only this delta and returned GO; no other changes to the reviewed kickoff. Final kickoff SHA-256: `ade5500949df9e1390d7d0264b86e58f7aa2d3656e9f1bf0f0202968cdedbcfe`. No mandatory findings remain.

Authoring checks: the kickoff edit-time gate exited 0; host-verify --list extracted the five future commands; the frontier helper returned `FRONTIER: S1`, `BLOCKED: S2(unmet:S1) S3(unmet:S2)`; Markdownlint checked both explicit new files with zero issues; relative-link, whitespace and regular-file checks passed. These are document checks. New implementation suites, destination proof, staging publication and the live semantic pilot have not run.
