# S1 scoped re-review — fix round 1/5

**Overall verdict: APPROVE the scoped correction. I1, I2 and I3 are ADDRESSED. No new blocking breakage found in the fix diff.** The prior independent review's three S1 blockers are closed; the controller can record S1 acceptance. This is not S2 implementation or final campaign acceptance.

Reviewed range: `8c13d59395297380f5b981eac508f9175bc2e8cb..9098d3c5abc5409de0f138fcf5d0b8375fed3b68`, using `.superpowers/sdd/ci-test-effectiveness/task-1-fix-1-review-package.txt` and the appended implementer report. The original brief, agreed specification and review findings remain the yardstick. Review is limited to I1–I3 and new breakage in these corrections; it does not reopen the full audit.

Spec compliance for the corrections: **PASS**. Task quality for the corrections: **PASS**.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## I1 — ADDRESSED

The four erroneous links are explicitly classified as nonexecuting mentions in `docs/ci-test-effectiveness/evidence/invocation-reconciliation.json:155`, `:168`, `:235` and `:248`: two echoed diagnostics, the fixed heredoc citation and the workflow comment. They are absent from the corresponding source delivery arrays in `inventory.jsonl:100`, `:183` and `:222`. The real principles/hooks package carriers remain.

The correction is broader than deleting four strings: the ledger accounts for all 293 source-path/active-step pairs, retaining 289 command-argument pairs; package CI routes are separately recorded at `invocation-reconciliation.json:5281`, and all 736 resolved source routes at `:9510`. The former broad job-level inference is replaced with concrete package filters, child-script closure and named CI steps. The canonical-regeneration source now uses its dedicated acceptance carrier. `evidence/capture/build-inventory.py:26` consumes the reviewed ledger instead of reconstructing invocation claims from substring presence.

I inspected the classification mechanism and bounded command evidence, not just the counts. `evidence/capture/reconcile-review-1.py:13` identifies the four rejected pairs; `:20` requires an actual supported interpreter/runner command line for the remaining pairs. Its claim is limited to this frozen source, with surrounding conditions retained; it does not claim a universal shell parser or dynamic execution. The two pairs with multiple textual occurrences distinguish actual runner arguments from presence guards and diagnostic echoes.

No D02/D03 surviving direct command is removed by this correction. The original D01–D08 decisions and settled fault receipts are unchanged. The original failure scenario—using these diagnostics/comments as surviving execution witnesses—is closed.

## I2 — ADDRESSED

The previously mismatched examples now have relevant, source-bound judgments:

- `invocation-assessments.json:1723`: `test:ir` reaches the two IR sources, 28 collected native identities, `core-ir` member criteria, its cwd and Vitest configuration.
- `invocation-assessments.json:1776`: `test:backends` reaches the 26 backend sources, 248 collected identities and `core-backends` member criteria.
- `invocation-assessments.json:2556`: core `tsc --noEmit` has a compiler contract and records actual include/exclude/compiler options; it no longer inherits fixture-presence conclusions.
- `invocation-assessments.json:3`: skill drift has its scanner input, error/warning distinction and source entrypoint, rather than a support-artifact assessment.

`invocation-criteria.json:1` supplies invocation-level reasoning by actual role: test, compile, drift, producer, scan, advisory, native and hook. Test rows additionally bind all seven member-family criteria through their reached populations. This is justified reuse: the invocation contract covers runner/configuration/timing and the linked member families cover the tested obligations and oracles. It no longer substitutes the unrelated canonical Node chain's rationale for IR/backend work.

All 56 package commands and the 196 related local/aggregate carriers are covered by the correction. Package recursion and explicit delegates are recorded; empty React Native/SPA selections and tool/live conditions remain explicit. The compiler configuration and core/runtime Vitest includes were checked narrowly against the claims being changed. No new dynamic pass or zero-cost assumption is introduced.

I also checked two potentially fragile new local-loop population claims against the exact command regexes and comment handling: `script-selftests` selects 59 sources and `plugin-aifdoctor-selftests` selects 19, with no missing or extra recorded sources. These local loops genuinely execute the derived list; the assessment correctly distinguishes that fact from a claim that every matching workflow mention is itself a CI invocation.

The original failure scenario—seven valid links to conclusions about the wrong mechanism—is closed for the corrected invocation records.

## I3 — ADDRESSED

RC5 (`root-cause-map.json:78`) and RC6 (`:129`) now specify an actionable S2 prevention proposal rather than treating surviving functional tests as economic recurrence detection.

Their `preventionProposal` blocks at `:95` and `:147` name the existing portable review-sidecar owner, current dispatch/disposition path, and existing required fidelity consumer. They explicitly say the current checker does not yet consume this economics contract. The proposals include:

- Relevant carrier/population diff triggers and conservative rename/deletion/unknown handling (`:101`, `:153`).
- Scoped, head-bound structured findings or an explicit no-material-finding result, with witnesses, cost evidence/unknowns and responsible disposition.
- A decision consumer that blocks unresolved material findings and rejects absent/stale/duplicate scoped records (`:117`, `:169`).
- Actual fidelity CLI/event conformance, trigger/checker disablement, and held duplicate/imbalance versus legitimate-distinction cases (`:118`, `:170`).
- Bounded review/history cost, no extra review seat by default, no paid-model CI, and coordination with prospective sidecar/TAK ownership.

The semantic judgment and mechanical completeness/binding claims are appropriately separated. The proposed consumer cannot certify perfect economic judgment, and the text does not claim that it can. The old per-decision conformance remains relevant to D02/D03 while the new proposal supplies the missing future channel. Implementing and verifying that channel remains S2 work, as required by this review's scope.

## Covering evidence and new-breakage check

I read the 16-file fix diff, the new assessment/reconciliation records, the one-shot capture/check changes and the saved verification receipts. Bounded Python queries of the supplied diff found 631 changed inventory rows, no added/deleted item IDs, and only the intended changed fields: 378 delivery records, 379 cost-route copies, and 252 criteria/applicability/assessment-reference records. No unrelated source-family judgment or decision rewrite appeared in that inventory delta. The diff remains confined to `docs/ci-test-effectiveness/**`.

The saved `evidence/review-1-validation.json` reports PASS with every named check true and 107 preserved files compared; `evidence/package-validation.json` reports PASS, 44 checks and no errors. The transport receipt at `/workspace/scratch/ci-test-transport/verification.json` reports PASS for tree `1b8712ddeaf1bd405ff43d52b26ecf07c2861ec2`, extracted from the correction commit, with 129 indexed files, 19 compressed originals, 19,275 structured references, 1,080 source hashes, 14 Markdown links, 2,121 inventory records and 21,196 member records, and no errors. These receipts support consistency and transport; the substantive conclusions above come from inspecting the corrected command/population/criterion/prevention relationships.

Nonblocking reporting note: the appended implementer report says “22 checks”; the saved correction receipt actually contains **21** named checks, all true. This is a count discrepancy in the handoff text, not a missing substantive check established by this review, and does not warrant another round.

No Git commands, full suites, new fault probes, capture regeneration or verification scripts that write artifacts were run. Review commands only read the package, records and focused source/configuration inputs, plus computed bounded comparisons. This report is the only file written. No new Critical or Important finding is raised; no out-of-scope observation extends the loop.

## Limits

The original declared host, administrative-policy, forecast-cost and prospective TAK/sidecar ownership limits remain unchanged. I did not refetch remote state or certify new runtime behavior. RC5/RC6 prevention has been reviewed as an S2 proposal, not as delivered protection. Its actual future invocation, consumed judgment, disablement behavior and cost must be verified during S2 under the existing acceptance contract.

**Final: I1 ADDRESSED; I2 ADDRESSED; I3 ADDRESSED. APPROVE scoped fix round 1.**
