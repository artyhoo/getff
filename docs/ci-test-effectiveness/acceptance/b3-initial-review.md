# B3 independent spec and quality review

Reviewed base `9baa971338598082e4b261703cde1d1a2989b094` through head `6e429b0966837541693eb743e54a3402d8695d8c`, using the supplied full review package as the changed-file view. Authority: canonical kickoff-s2c and agreed design §§7–9. Scope is D08/RC3 and the manual-husky D07 member, not campaign/E9/TAK acceptance.

**SpecCompliance: REVISE. TaskQuality: REVISE.** One Important fixture-coverage defect prevents accepting the claimed complete two-hook adverse corpus. The production extraction and most delivery/evidence work are sound within their stated limits. One Minor inventory correction is also needed. No Critical findings.

## Important I1 — fixture helper overwrites the hook under test

Location: `tests/hooks/test-enforce-husky-presence.sh:21` (interaction with lines 28–35).

`valid()` runs `for hook in pre-commit pre-push` without declaring `hook` local. Bash functions share this variable with the outer adverse-case loop. Consequently, `valid "$dir"` leaves the caller's `hook` equal to `pre-push` before its `rm`, `chmod`, or stub write. Even the first iteration's `missing-pre-commit` directory has its **pre-push** removed; all six adverse invocations test pre-push, with the same nonexec/stub directories reused in the second iteration.

This is visible in existing runtime evidence, not merely a hypothetical language concern: `docs/ci-test-effectiveness/evidence/b3-host-3.txt:1`–`:6` lists missing/non-executable/stub **pre-push twice**, with no pre-commit counterpart. The held-checker log likewise reports a missing-pre-commit directory with a missing pre-push expectation. The claimed both-hooks × three-invalid-shapes coverage in `docs/ci-test-effectiveness/inventory-s2.jsonl:10`, the report and self-review is therefore false.

The workflow-command test independently covers a missing pre-commit when the hook directory is absent, but does not cover a non-executable or stub pre-commit. A weakening limited to accepting those first-hook shapes can escape this corpus. The existing success-stub fault affects both hooks and cannot establish the omitted coverage. This violates kickoff-s2c's fixed missing/non-executable/stub controls and its no-silent-waiver requirement for a newly demonstrated in-scope false green.

Required correction: make the fixture-construction loop variable local (or otherwise independent of the outer subject), preserve the six distinct adverse cases, and refresh affected manual/core/held receipts and claims. Confirm actual pre-commit and pre-push paths in the resulting six diagnostics; a bounded first-hook-only weakening is an appropriate check of this specific hole. No broad-suite repetition is requested by this review.

## Minor M1 — final inventory delivery still says 16 cases

Location: `docs/ci-test-effectiveness/inventory-s2.jsonl:9` (`B3-ci-oracles.delivery`).

The delivery string says `hooks/**/*.test.ts ->16 cases`, while its members/effectiveness fields and final receipt identify 17. Update that current-delivery description to 17. Keep historical 16-case timing/verification receipts labeled as historical rather than rewriting them.

## Strengths and satisfied boundaries

- Discipline extraction retains the actual production grammar: 40-character section threshold, both citation directions, and 60-character Skip. The sole disclosed echo-pipeline→here-string change retains its regex and is correctly classified as normal-hook-required transport work. The unsupported sourced ~195 KB diagnostic is not used as public runtime RED; the supported 116,079-byte environment companion passes both versions. The load-bearing RED is the detached-oracle bypass, which is meaningful.
- The recurring test parses the actual workflow, executes its command, and fixes required context, PR_BODY expression, four PR events including edited, and non-main guard independently of the checker. Both detached sanity jobs are removed together; their invalid/valid bodies survive in actual-command controls with distinct grammar variants. No copied predicate remains in those controls.
- The husky production predicate remains a bounded presence/executable/marker check, with a disposable-directory seam. Its workflow invocation, missing/valid controls and safe manual entry are real. The wrapper never writes checkout `.husky`; recorded byte/mode equality supports that narrow claim. I1 concerns omitted fixture coverage, not a demonstrated production-checker regression or checkout mutation.
- The actual local-sweep row calls the helper, covers direct inputs, and preserves the existing selection structure. Captured valid/missing-prepush outcomes and unchanged reverse-coverage row-deletion failure support delivery. The existing PAYLOAD adds only the direct husky helper; the normal generator/manifest diff and archive receipt show the expected helper/core-test/sweep closure.
- Five held bypasses reach markers, fail assertions with the recurring corpus hash fixed, and restore to 17 passing controls. These establish their particular sensitivities; they do not override I1's omitted branch. New mechanisms have all seven criterion fields, named real carriers or one-shot commands, and finite independently reviewable expectations. No competing TAK runtime or generic platform is introduced.
- B2's previously misidentified conformance delivery is corrected to its actual one-shot Python command, with the other prior fields retained in the diff. This satisfies the earlier B2 M1 correction.
- Cost evidence separates local two-body trials, isolated conformance startup, verification overhead and historical removed-job elapsed time. The repeated collector is disclosed; no measured hosted net saving is claimed. Added checkout and pending hosted measurements remain visible.

## Named baseline replay risk: traced, not inferred from archive completeness

`docs/ci-test-effectiveness/evidence/b3-baseline-replay.py:7`–`:11` extracts tracked bytes and links existing dependencies without creating root `.git`. An archive is not generally equivalent to a Git checkout. For the **selected cases**, bounded source tracing does not establish a root-Git dependency that invalidates the recorded comparisons:

- Consumer S5 builds its own Git repository in `packages/core/hooks/pre-push.consumer-layout.test.ts:181`–`:234`, copies the production source into it, and runs the material section there. The selected `hasAstGrep` capability probe at lines 1563–1565 depends on PATH/tool behavior. The captured util-linux `sg scan --help` success and subsequent scan failure substantiate the specific identity-probe problem independently of archive-root Git metadata.
- Hydration creates a fresh Git repository/worktree and installs `scripts/link-coordination.sh` as a symlink at that fixture's own script path (`packages/core/hooks/worktree-setup-hydration.test.ts:99`–`:160`). Both callers invoke that fixture path. The helper computes `SELF_REPO` from `dirname "${BASH_SOURCE[0]}"` at `scripts/link-coordination.sh:118`, without resolving the script symlink to the source archive. Its Git-common-dir comparison therefore uses the fixture repository and fixture worktree, not the archive root. Missing root `.git` alone is not a demonstrated explanation for these three repeated assertion failures.
- The selected glossary case pins `CLAUDE_PROJECT_DIR` to the source root and `AIF_RESIDUE_DIR` to its disposable counter directory (`packages/core/hooks/glossary-counters.test.ts:881` onward). The inject hook reads tracked CONTEXT/language data; the residue override bypasses the Git-derived coordination-home branch. Its focused pass does not establish an equal-load timing baseline.

Thus I do not raise a blanket invalid-baseline finding solely because root `.git` is absent. This trace supports only these selected paths and comparisons, not universal runtime-input closure. The existing reports' three hydration assertion reproductions do not independently diagnose their full root cause.

## CannotVerify / retained acceptance limits

- Full recurring hook suite remains RED: 3 files / 5 failures. The selected S5/hydration baseline receipts do not make that suite green. Glossary's full-load timeout versus focused baseline pass remains causally unresolved. Root has not waived these campaign failures, and this review does not do so.
- No final whole-suite run after the transport companion, hosted CI/net-cost measurement, other-host runtime result, or campaign E9/generalized TAK acceptance is established here. The final scoped 17-case receipt supports only its selected controls.
- The husky marker check does not certify hook execution; the discipline checker does not certify citation truth or prose substance. Joint oracle/subject edits and runner behavior remain finite trust boundaries.
- I did not rerun Git commands, suites, mutation drivers, baseline replays or timing probes. The review relied on package source/evidence, with bounded unchanged-source reads only to resolve the controller's named Git-runtime doubt. The new I1 defect is already demonstrated by source and captured output; another replay would add no diagnostic value before correction.

Return to the implementer/controller for I1 and M1. Re-review the changed fixture and refreshed affected evidence before B3 acceptance; keep broader campaign failures and pending owners separate and open.
