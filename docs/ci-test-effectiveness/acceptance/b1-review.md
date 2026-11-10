# B1 independent spec and quality review

SpecCompliance: PASS
TaskQuality: APPROVED

Reviewed task: S2 B1 / D06 / RC2 only. Reviewed range: `35bb1a22fb1809e78408881583285a5fe470d5de..f7aab8b0f9510cc4a8addc7e7aa0f2b636e2ce93`.

This verdict accepts the scoped repair and its bounded protection evidence. It does not accept S2, E9, generalized campaign prevention, TAK runtime delivery, or other batches.

## Review basis and method

Read the B1 kickoff first, implementer report, and supplied `task-2-review-package.txt` containing commit/stat/full-context diff. Used the package as the primary changed-file source, including source/test hunks, evidence collectors, batch/inventory records, and recorded outputs. Read binding design §§7–9, especially §§7.1–7.2; S2 coordinator scope; project goal/bootstrap and applicable reviewer discipline. Implementer conclusions were checked against the changes and evidence rather than accepted from their status report.

No Git commands, tests, benchmark collectors, weakening experiments, installs, or unrelated suites were rerun. The supplied evidence answered the behavioral questions; there was no concrete unresolved runtime doubt justifying another approximately eight-second harness run. A read-only extraction of the package counted outcomes and compared the retained ordinary assertion sequences. Focused unchanged-source inspection checked one named risk: whether injecting the extracted row actually reaches the normal status/log/display branch and whether the claimed hosted harness carrier exists. The existing runner captures eval status, persists output, distinguishes WARN-SKIP, prints failure diagnostics, and fails the sweep; the workflow invokes this harness at `.github/workflows/audit-self.yml:796`.

No production, test, index, HEAD, frozen evidence or approved artifact was edited by this review. Only this requested local review report was written. No subagents were used.

## Spec compliance

- Exact patch scope: package lists two permitted shell files, B1 batch JSON, the new S2 inventory supplement and permitted `evidence/b1-*` artifacts. No source-contract, hosted/prepush, global-setting, approved-history or S1 baseline changes appear in the reviewed diff. The separate implementer report is expressly requested local coordination output.
- Production repair: `scripts/run-local-ci-sweep.sh:435` separates `command -v` from checker execution with `if/else`. An installed checker nonzero is the row status; only unavailability emits the existing warning. The existing generic runner owns final exit normalization, diagnostic storage/display and WARN-SKIP classification.
- Actual row: `scripts/run-local-ci-sweep.test.sh:75` reads the delivered `--list-gates` output, checks that exactly one actionlint row exists, and feeds that unchanged row to a disposable copy of the sweep. The regression does not reconstruct the repaired predicate or assert source text.
- Fixed controls: test block beginning `scripts/run-local-ci-sweep.test.sh:71` holds exit0/1/42 expectations, explicit absence, valid real workflow, invalid root key, and distinct invalid expression expectations. Exit1/42 and both real rejections assert status, FAIL verdict, archived diagnostic, and displayed diagnostic. The missing-tool PATH preserves Bash/core utilities and checks explicit WARN-SKIP plus absence of PASS.
- Meaningful RED/GREEN: `b1-red.txt` records precisely 12 intended failures: rejecting controls falsely exit0, lack FAIL, and omit displayed diagnostics. Positive/absence and archived-diagnostic companions pass. GREEN and final restoration contain 229 passing assertions, including all 25 new B1 assertions.
- Reached weakening and independent conformance: `b1-conformance.py:13` obtains the actual old source from the fixed input revision; lines 27–30 run old source/held tests, repaired source/the same held tests, and old source/detector removed against a fixed expected rejection. `b1-conformance.json` binds source/test hashes and actual statuses. Old source returns1 for the intended failures, repaired source returns0, and disabled detector returns0 while held expected1 rejects the false green. This is a bounded audit collector, not another recurring platform.
- Restoration: `b1-restoration.txt` passes with the same held test hash used for weakening. `b1-final.txt` records a passing live final harness after the disposable experiments. Ordinary passing assertion sequences match between GREEN, restoration and final outputs. Detector-disable removes exactly the B1 block and leaves 204 existing passing checks.
- Native destination: host JSON records syntax-command exit0, real repository workflow actionlint exit0, Linux x86_64 and actionlint1.7.7. Final harness evidence includes the real controls, so the native result is not an absence skip.
- Evidence and costs: batch JSON names decisions, exact files, source hashes, commands/statuses, evidence refs, cases, rollback and final-commit recording responsibility. Workload fixes the cases and timing method. Three matched valid-row trials retain individual timings and medians. The small negative median delta is explicitly not a speedup claim. The separate approximately 0.375-second illustrative protection-overhead measurement is identified as one paired sample with uncertainty. Raw artifacts are supplied as tracked diff additions with portable repository paths and normalized disposable paths.
- Limits: TAK Q4/P52/verification-driver delivery remains pending and does not become an invented installed runtime. This task does not claim campaign completion. Real semantic controls visibly skip when actionlint is unavailable; unconditional synthetic status and absence protection remains. The brief expressly permits bounded one-shot detector-disable evidence while TAK is pending.

## Quality assessment and seven criteria

The three supplement records were assessed on substance, not the presence of seven keys. Their prose repeats a shared rationale, but the actual controls and one-shot code support the bounded claims.

| Criterion | Independent assessment |
| --- | --- |
| Relevance | Each addition addresses installed rejection being incorrectly classified as absence. The status controls isolate transport, real workflows confirm actual checker rejection, and held conformance challenges loss of that protection. |
| Effectiveness | Fixed bad inputs traverse the delivered row and real sweep. The old source fails only the intended 12 assertions; repair restores all 229. Detector removal demonstrates the recurring detector's marginal contribution. |
| Theatre | Assertions check externally observable exit status, verdict, retained diagnostic and displayed diagnostic; invocation alone cannot satisfy the tests. The script examines and rejects the disabled-detector false green. |
| Tautology | Expected outcomes derive from status fixtures and valid/invalid workflow semantics. Reading the actual row supplies the subject, not the expected answer. Held tests remain byte-identical between old and repaired source. The outer expected bad-source status is fixed. |
| Duplication | Existing generic runner tests did not exercise this actual production row. Stub and real-tool cases cover complementary status transport and semantic rejection. Hosted/prepush witnesses are preserved. One-shot fault collection adds no recurring CI layer. |
| Cost effectiveness | The one-line production change adds no routine tool invocation. The small added workload uses the existing harness and disposable fixtures. Measured overhead is separated from row timing; no unsupported optimization or dollar claim appears. Audit collectors do not run in routine CI. |
| Sufficiency | The evidence is sufficient for the exact B1 status/absence/diagnostic contract on the measured destination. The driver, host, utilities, actionlint and externally reviewed expectations are an explicit finite boundary. Combined source-and-oracle edits can evade this detector; this is disclosed rather than misrepresented as universal prevention. |

The new regression block preserves the existing assertion population and gives useful complementary positive and absence controls. The short Bash structure is proportionate to the bug and avoids modifying generic aggregation or introducing another analyzer/dependency. The conformance collector's terminal assertions check reached bad-source and restoration statuses plus the disabled-detector false green; its recorded raw assertions establish the intended failure reasons rather than treating any process failure as meaningful evidence.

General RC2 invariant and actual carrier are recorded. The task does not pretend that an incident-level repair alone delivers the later common authoritative principle/review integration. This is consistent with the exact B1 brief and pending dependency boundary, while the binding design continues to govern campaign acceptance.

## Findings

Critical: none.

Important: none.

Minor: none requiring action.

No concrete in-scope failure scenario or quality loss was found. Zero findings is based on the changed behavior, fixed controls, reached faults, preserved existing checks and bounded claims, not the JSON shape or implementer verdict.

## CannotVerify and retained limits

- Normal hook execution and the pre-edit chronological freezing of the workload are reported by the implementer; the package cannot independently prove process history. The supplied commit/diff and matching fixed expectations support review of the delivered result. No hook-bypass mechanism appears in the patch.
- This review did not freshly execute Linux commands; host/runtime conclusions rely on the supplied raw recorded outputs and inspected code. The package shows the exact real controls ran successfully, and the old-source failure reasons are specific.
- No Darwin semantic verification or hosted real-actionlint provisioning/run is established. The existing hosted harness invocation is present; semantic controls can skip there, explicitly. These are disclosed bounds, not positive certifications.
- Accepted S1/controller state, origin/staging reconciliation, final integration-commit recording, and pending TAK owner/driver integration are controller responsibilities outside this B1 review. They remain necessary for later campaign claims.
- Signals/timeouts, execution-permission races after availability lookup, optional shellcheck coupling, underlying host/tool corruption and simultaneous edits to source and fixed oracle are not independently certified by these fixtures. No claim here extends to those cases.

Provenance: reviewer rubric layer is corpus-measured; whose is judgment-only, not corpus-validated; class rubric is a measured null, so severity follows concrete recorded requirements and failure scenarios. No graded finding required escalation or a strategy choice.
