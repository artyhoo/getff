# S1 independent acceptance review

**Spec compliance: NEEDS_CHANGES. Task quality: NEEDS_CHANGES. S1 acceptance: NOT ACCEPTED; preserve the supported results as PARTIAL.**

Reviewed input: `.superpowers/sdd/ci-test-effectiveness/task-1-review-package.txt`, covering `01b25d78b11083fb6e463fdf9de61299aff8972a..8c13d59395297380f5b981eac508f9175bc2e8cb` (two commits). The audited production baseline remains `01b25d78b11083fb6e463fdf9de61299aff8972a`.

Requirements read before the implementer report: `task-1-brief.md`, then `task-1-report.md`, and the binding design `docs/superpowers/specs/2026-11-08-ci-test-effectiveness-design.md` (agreed SHA-256 `77e669ad6113b9674c6b32f92554af1a490e5828127f4c9ebea800f271a83e4a`). Review applies the design's §§4–9 and the task's complete-assessment boundary, not final S2 implementation requirements prematurely. Reviewer rubric: `.agents/rules/reviewer-discipline.md` §6 and `.agents/roles/reviewer-discipline.md` runtime rubric.

Provenance: layer=corpus-measured; whose=judgment-only, not corpus-validated; class=measured null (recorded grade remains the class bar).

## Scope and method

The supplied diff identifies only additions under `docs/ci-test-effectiveness/**`. I read the report and decisions, examined all family, principle and active-job assessment records, and used bounded programmatic queries across the inventory, compressed case/declaration/source records, workflow definitions, discovery results and cost records. I traced the load-bearing D01/D05/D06/D08 controls and restoration records, D02 surviving commands, D03 arithmetic and prerequisites, D04 actual readable policy evidence, D07 routing classifications, the root-cause map and TAK responsibilities. Large captures were queried rather than dumped or treated as proof merely because they parsed.

No Git commands, full suites, full audit, fresh remote probes or fault experiments were run. The existing transport receipt is supplemental integrity evidence only. I did not modify the implementation, index or HEAD; this report is the only output written.

Focused unchanged-source reads addressed named doubts:

- D02 environment/subject equivalence: `packages/core/audit-self/audit-ai-docs.test.ts` root resolution, fixture setup and conditional/tool references, plus `packages/core/vitest.setup.ts`. Its source resolves the framework root and temporary fixtures; no installed `/tmp/fake-consumer-*` subject was found in this focused check. The self-install jobs' extra PyYAML setup did not expose an applicable test dependency in that check.
- D06's retained pre-push witness: `packages/core/hooks/pre-push.ts:977` delegates installed-tool checking to `requireTool`; the sweep defect was not assumed to invalidate that distinct carrier.
- The P50 legacy count: the named ratchet baseline and `tests/install-sh/byte-identical.test.sh` were checked to avoid converting scanner candidates into confirmed defects. This wrapper captures the snapshot pipeline status. No blanket finding about all 326 candidates is made from the count.
- False invocation candidates: the exact echo/example/comment lines in `discipline-self-check.yml` and `workflow-integrity.yml` corroborate the archived workflow bodies and Finding I1.

## Strengths

- The inventory covers a substantial, reconciled population: 736 source candidates, 314 additional support inputs, 6,257 Vitest identities, 54 Python identities, active and shipped workflows, local carriers and manual/generated material. Overlapping declaration/native views and shell labels are explicitly distinguished from executed cases. The Node import failure, external-corpus requirement and recorder hang are preserved instead of becoming an empty pass.
- D01, D05, D06 and D08 have decision-relevant evidence. P41 retains eight passing cases through a reached echo-path fault; actual actionlint rejects the invalid workflow while the sweep swallows its failure; the discipline production bypass changes the frozen negative fixture's verdict without changing the detached sanity verdicts; recorder selection affects termination. The result classifications are appropriately narrow and restoration is recorded.
- D02 preserves the actual installer operations and the same root auditor witness. D03 retains the four suites, runner requirements and aggregate gate. The two projection inputs match the captured successful step durations, and the report correctly calls the 31–39% improvement a latency forecast, not measured savings or reduced compute.
- D04 separates the three actual staging contexts from six source declarations and preserves edited-event semantics. It does not pretend a source-only patch registers branch protection. Actual additional administrative-policy details remain limited.
- The package does not claim every test body or host was dynamically certified. Source, structural, historical, optional and live claims are distinguished. TAK PR2144 remains in flight, attributed receipts remain attributed, and no competing kernel or frozen-evidence edit is introduced.
- Joint-removal hazards, supported-host distinctions, conservative fallback, new recurring cost and the finite independent TAK boundary are stated. The audit's unexpected discovery cost is disclosed. No paid-model CI, production change or permanent audit platform is introduced.

## Critical findings

None.

## Important findings

### I1 — The audit's delivery map counts non-executable mentions as test invocations

**Severity: Important. layer=implementation; whose=reviewer.**

Evidence: `docs/ci-test-effectiveness/inventory.jsonl:100`, `:183` and `:222`; the generating condition in `docs/ci-test-effectiveness/evidence/capture/build-inventory.py:42` adds a CI entrypoint whenever a path occurs anywhere in a step's `run` string.

The first record credits `s17.test.ts` to both the discipline production step and its positive-sanity step. Those references are an echoed example and text inside the fixed PR-body fixture, respectively. The second credits `02-paired-negative-test.test.ts` to the production discipline step because the diagnostic echoes that pathname. The third credits `37-required-context-completeness.test.ts` to workflow-integrity because a comment mentions the test. The exact unchanged corroboration is `.github/workflows/discipline-self-check.yml:156`, `:175`, `:242`, and `.github/workflows/workflow-integrity.yml:78`. None of those four references executes the named suite.

This is the same mention-versus-invocation distinction the audit correctly demonstrates in D01. These three suites also have genuine carriers, so this finding does **not** assert they are currently unwired. It establishes that the claimed complete invocation reconciliation contains false protection witnesses.

**Failure-scenario:** a later no-loss or duplication decision consumes this map and treats a surviving diagnostic/example/comment as delivery of a removed test invocation. The map can then report protection at a workflow/event that never runs the test.

Violated requirements: design §5's actual invocation/item reconciliation and §6's prohibition on promoting structural matches into final conclusions; task acceptance example that a structural source match cannot establish runtime behavior; T15 self-application.

Required correction: remove or classify these entries as non-executing references, reconcile other similarly derived routes against actual command/aggregate reachability, and record the bounded evidence for that distinction. This can use focused source analysis and the existing command records; a new universal parser or broad runtime suite is unnecessary. Re-evaluate any decision relying on a corrected route.

### I2 — Package entrypoint assessments inherit unrelated seven-criterion conclusions

**Severity: Important. layer=implementation; whose=reviewer.**

Evidence: `docs/ci-test-effectiveness/inventory.jsonl:1662` assigns `vitest run ir/` all seven references to `node-canonical`; `:1663` does the same for `vitest run backends/`. That family's relevance and effectiveness concern canonical owner documents and Node helper/installed-root tests (`docs/ci-test-effectiveness/family-assessments.json:975`), and its cost conclusion specifically concerns the `test:canonical` chain. These are not the obligation, oracle or cost rationale of the IR/backend commands.

Likewise, `inventory.jsonl:1674` assigns `tsc --noEmit` all seven references to `test-support`, whose effectiveness is that consumers parse fixed fixtures or call helpers, and whose sufficiency concerns support-artifact presence (`family-assessments.json:1227`). `inventory.jsonl:1649` similarly assigns the executable skill-drift check to that support-artifact family. Across all 56 package scripts, references are selected between only these two families; the repeated applicability text does not supply command-specific conclusions or link each invocation to the relevant assessed population and enforcement boundary.

The underlying source and CI-job assessments contain useful material, and it is reasonable to reuse them. The current links do not perform that reuse: they assert applicability of different conclusions. Recording a command and source reference makes the item inspectable, but leaves the reviewer to perform the missing assessment. `stage-1.md:16` and the complete-package claim at `:6` therefore overstate substantive coverage.

**Failure-scenario:** S1 closes with an IR runner, compiler gate or drift detector recorded as fully assessed even though its referenced effectiveness, duplication and cost judgments concern another mechanism. Distinct invocation behavior or unnecessary repetition can escape the completed-audit gate while all seven reference keys remain valid.

Violated requirements: design §5 and task brief's explicit shared evidence/per-member applicability requirement; “Metadata checks alone do not establish substantive audit completeness.”

Required correction: bind package and aggregate entrypoints to their actual reached family/member assessments and give the invocation-specific conclusions that those assessments cannot cover. Keep setup/generation/support automation distinct from executable validation. Review other uniformly generated invocation references for the same applicability problem. Missing facts must stay unresolved with bounded next actions, and S1 must remain PARTIAL until they are discharged. This does not require seven new essays or fresh performance trials per command.

### I3 — RC5 and RC6 plan repairs but omit the future prevention channel

**Severity: Important. layer=implementation; whose=reviewer.**

Evidence: `docs/ci-test-effectiveness/root-cause-map.json:84` says documenting the D02 survivor and the existing population map suffices; `:91` names the surviving auditor/installer jobs as prospective invocation. `:103` proposes balanced assignment using history, while `:109` names the same three installer jobs. Their conformance entries at `:92` and `:110` verify the particular removal/move, not detection of recurrence of the stated root causes.

The surviving functional tests do not detect someone adding another same-root auditor repeat, and running the three installer jobs does not consume a judgment that a future assignment unnecessarily concentrates the work. The map names neither an applicable demonstrated detector nor a proposed extension to the existing cold-review/disposition path for those economic judgments. The package's prohibition on a new profiler or duplication platform is appropriate; it does not discharge the separate prevention obligation.

**Failure-scenario:** S2 implements exactly these two map rows, preserves all functional cases and passes their stated conformance, yet a later edit reintroduces the same redundant invocation or scheduling imbalance without reaching any mechanism that evaluates and consumes that issue. The campaign would have repaired the incidents while leaving the mandated general prevention absent.

Violated requirements: task brief's proposed principle→existing/extended/new detector map; design §7.1's explicit cold-review channel with structured findings and consumed disposition for non-mechanical relevance/economic judgments, and §8's rejection of policy-only or incident-specific prevention.

Required correction: specify an existing/extended detector or the authoritative existing review channel, its actual future trigger and decision consumer, bounded claim/counterexamples, and how S2 verifies invocation/disablement and cost. State what is merely a one-time repair separately. Implementation remains S2 work; only the complete, actionable prevention proposal is required to accept S1.

## Minor findings

None requiring a separate correction. Formatting and compact prose do not drive this verdict.

## Spec compliance and decision assessment

| Requirement | Review outcome |
| --- | --- |
| Fresh baseline, isolation and source identities | Supported by supplied receipts; no new live certification by this review. |
| Full source/native/generated/disabled accounting | Broad and internally reconciled; no demonstrated missing source category in this review. Actual delivery reconciliation is incomplete because of I1. |
| Seven substantive criteria and justified grouping | Not complete: I2 gives concrete inapplicable inherited conclusions. Presence of keys/references does not close it. |
| Proportional evidence and bounded costs | Strong targeted probes; honest unavailable measurements and forecast boundaries. No blanket dynamic certification observed. |
| Required protection and retained witnesses | D01–D08 generally express useful, bounded contracts. D02/D03 no-loss proposals are supported conditionally on their stated S2 checks. I1 must be corrected before the map can be accepted as a whole. |
| TAK ownership and finite conformance | Correctly separates landed history from PR2144 and defers affected activation to its owner. Fresh reconciliation remains necessary before S2. |
| Root-cause prevention proposal | RC1–RC4/RC7 identify meaningful existing integrations; RC5/RC6 have the gap in I3. |
| Audit self-application and honest completion | Limits and costs are disclosed, but the audit repeats its own diagnosed invocation-matching defect. Full S1 acceptance is withheld. |

This verdict does not require the already-demonstrated product gaps to be repaired during S1. It requires the **audit deliverable** to finish the agreed assessment and prevention planning before the stage boundary. The useful decisions and receipts should be preserved rather than discarded or broadly rerun.

## Cannot Verify / limits

- No optimized hosted run exists in this S1 package. D02 savings are captured historical step costs; D03 is a transfer-of-observed-durations forecast. Actual after-cost, queue behavior and total campaign savings remain for S2.
- No blanket test-body, non-Linux, live AIF/native-host or arbitrary downstream-consumer behavior is certified. Native discovery and source inspection cannot establish those outcomes. This is an appropriate declared limit, not by itself a demand to execute every case.
- Administrative bypass/ruleset details and the effect of future required-context registration are not established by the ordinary branch response. D04 needs its named owner and actual enforcement verification.
- Future TAK acceptance, activation and final conformance delivery are not proved by the open PR or its self-reported receipts. The existing ownership/dependency plan is evidence of coordination intent, not delivered enforcement.
- Controller freshness supplement received during review: staging remains `5fc5f74c3bc3b7b16047f527fc121f02dfe12b4d`, TAK2144 remains open at `7a5b63dc137648bc76a5899ecae4b279063c7e6b`, and new PR2151 proposes principle number 51 for readme-install-claims. I did not independently fetch it. It does not change the pinned S1 subject bytes, but the prospective S2 owner/number collision must be reconciled before touching TAK integration.
- The supplemental archive-transport receipt establishes portability/integrity within its stated scope. It cannot establish criterion applicability, actual execution paths or prevention effectiveness, and it does not resolve I1–I3.

**Final verdict: NEEDS_CHANGES on spec compliance and task quality; S1 remains PARTIAL and is not accepted for progression to S2.** Three Important findings above have concrete failure scenarios; no Critical finding or additional broad experiment is needed to substantiate them.
