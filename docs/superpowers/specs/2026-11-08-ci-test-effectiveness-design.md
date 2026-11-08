# Minimal sufficient CI and test protection

> **Feature:** `ci-test-effectiveness`
> **Status:** Architecture revision 2 candidate, incorporating recursive prevention. PRD revision 2 is approved; revised specification review and agreement are pending. Revision 1 reviews are historical.
> **Authoritative for:** the proposed audit and improvement method, evidence requirements and acceptance of this campaign.
> **Not authoritative for:** repository goals, current TAK completion, authorization to execute, or changes to unrelated product requirements.

## 1. Context and intended outcome

The operator suspects that the repository checks too much, too often and for too long. The campaign must establish where that suspicion is correct and improve the actual CI/test system. Its objective is **minimal sufficient protection, implemented economically, without loss of protection quality**. It evaluates all CI checks and tests, including metatests and TAK, against all seven criteria in the approved PRD.

Intent inputs: [approved PRD revision 2](snapshots/ci-test-effectiveness/prd-94604da4fd7b685645f6ddb396518a6d97a48a92ca66313d1dcaef19b33357c4.md), its [approval](snapshots/ci-test-effectiveness/prd-revision-2-approval-2026-11-08.json), [operator clarifications](snapshots/ci-test-effectiveness/operator-clarifications-2026-11-08.md), and the [recursive-prevention requirement C5–C6](snapshots/ci-test-effectiveness/operator-meta-enforcement-2026-11-08.md). The snapshot retains its pre-approval draft wording; the later approval record binds those exact bytes. Review of revision 1 does not establish acceptance of this expanded candidate.

There are two execution stages: evidence-backed audit and decisions, then changes based on those decisions. This specification is not an audit finding. No existing check is classified as redundant, inefficient or effective by this document alone.

### Operator premise register

| ID | Recorded premise | Source |
| --- | --- | --- |
| P1 | Efficiency motivates the work: the project may check too much and too slowly. | Approved PRD P1 and P6 |
| P2 | All CI checks and tests receive all seven criteria, individually and as a system. | Approved PRD P2 |
| P3 | Audit and evidence-backed decisions precede implementation and verification. | Approved PRD P3 |
| P4 | TAK and actual branch freshness must be considered without narrowing scope. | Approved PRD P4 and E6–E7 |
| P5 | The current chat prepares design and kickoff; it does not execute the campaign. | Approved PRD P5 |
| P6 | Audit effort must earn its cost; counts and faster green runs alone do not prove success. | Approved PRD motivation and E8 |
| P7 | Simplification must lose no protection quality; proven unnecessary work must be removed. | Operator clarifications C1 |
| P8 | Useful but expensive checks may require a cheaper implementation of the same protection. | Operator clarifications C2 |
| P9 | Root testing principles, metatesting and whole-system efficiency are in scope. | Operator clarifications C3 |
| P10 | Findings must become generalized testing principles and executable prevention integrated with TAK; the same criteria apply recursively to the prevention mechanism. | Operator requirements C5–C6 |

## 2. Approach and alternatives

**Proposed architecture choice:** use a complete inventory linked to protection obligations and actual invocation paths. Assess all seven criteria for every item; share evidence only where the same reasoning actually applies. This choice is the author's implementation proposal under the operator's request to continue /arch, not a previously selected operator detail.

An independent essay and identical experiment sequence for every test would expose local differences but repeat work and obscure cross-job duplication. A workflow-timing-only investigation would be cheaper but cannot settle usefulness, weak oracles or sufficiency. The selected proposal combines a complete item-level denominator with reusable evidence and explicit exceptions. Grouping economizes evidence; it does not exempt members from assessment.

Use the existing runners, manifests, native discovery, Git history, CI records and applicable TAK artifacts. Generalized principles and executable prevention are required deliverables, implemented through the existing enforcement system. A separate audit platform, universal semantic checker, scoring framework or duplicate CI layer is not required.

```mermaid
flowchart LR
    A[Current branch and TAK state] --> B[Complete check and invocation inventory]
    B --> C[Seven criteria and protection map]
    C --> D[Evidence-backed decisions]
    D --> E[Bounded repair and simplification batches]
    E --> G[General principles and reusable metachecks]
    G --> H[Independent conformance and same seven criteria]
    H --> F[Combined protection and cost comparison]
```

This is the proposed execution flow. A–D are stage 1; repairs, generalization, self-application and final comparison are stage 2. Decisions belong to the audit executor; implementation follows the decided scope; independent acceptance examines the resulting changes and evidence rather than the implementer's success claims. The principles govern both product checks and their own metachecks; the diagram's independent conformance boundary avoids treating a self-reported pass as proof.

## 3. Protection and minimality

The unit of protection is a meaningful obligation plus the boundary at which it must be enforced. A check's quality includes the relevant fault classes and boundary cases it detects, valid behavior it admits, applicable configurations/platforms, actual delivery/invocation, and required detection time and blocking consequence. Freeze these claims before optimizing the corresponding checks.

Root testing principles are evaluated directly: meaningful observable contract; independent expected outcomes; discrimination between correct behavior and relevant defects; correct handling of asynchronous work and subprocess failures; real invocation of the claimed artifact; truthful discovery, skips and failures; and an appropriate test level and frequency. Structural, snapshot and parity tests may protect structural contracts; their presence does not establish semantic correctness. Metatests are subject to the same criteria.

There are three dispositions to pursue:

1. **No incremental protection:** remove the unnecessary check, portion or invocation after establishing that nothing required is lost.
2. **Useful protection at disproportionate cost:** redesign its implementation or invocation to deliver the same protection more economically.
3. **Necessary and proportionate:** retain with a concise evidence-backed explanation.

Missing protection is repaired as part of stage 2. A fourth evidence state, **unresolved**, prevents an unsupported change; it is not a permanent exemption or a successful keep verdict. Record the exact missing fact and next bounded action or decision owner.

The loss constraint is strict: no known loss of the defined protection quality may be traded for speed. A small benefit is not zero benefit. For example, retaining detection only in a nightly job does not preserve a before-merge obligation; retaining Linux coverage does not preserve a distinct host-specific contract. Fewer false positives is a quality improvement, provided it does not admit required failure cases.

Relevance determines which obligations are genuinely required; the existence of a test does not make its obligation immutable. A claim that an obligation is obsolete or unnecessary requires evidence from current product requirements and supported use. Changing a standing product goal, supported behavior or governing requirement is a separate explicit decision, never a relabeling performed to make a deletion pass. Purely unnecessary repeated work can be removed within this campaign without inventing a replacement.

Minimality is assessed for the system, including combinations. Two checks that each appear redundant because the other exists cannot both be removed on that reasoning. Retained witnesses and their delivery boundaries must survive the complete proposed batch. Do not claim a mathematical global minimum or universal absence of bugs: acceptance is bounded by the enumerated obligations, considered alternatives and available evidence, with no unresolved known loss hidden inside a green status.

## 4. Fresh execution baseline and TAK integration

At execution start, resolve the actual intended integration branch from current repository conventions and the launch context; verify its live remote state, local divergence and relevant open work. Record the repository identity, base and audited source SHAs, lock/config/toolchain identifiers, environment and observation time. Preserve unrelated WIP; use an isolated execution checkout. An old local remote-tracking ref is not freshness evidence. Unavailable remote/task evidence is an explicit limit, not proof that nothing is in flight.

Read the then-current [TAK design](2026-10-08-test-assurance-kernel-design.md), [umbrella](../../../.claude/orchestrator-prompts/test-assurance-kernel/kickoff.md), stages and evidence. Determine what is planned, running, landed and verified from actual source, task/PR state and evidence, not the document's status sentence. Existing [population](../../test-assurance-kernel/s0/population.json), [workloads](../../test-assurance-kernel/s0/workloads.json) and [manifest](../../test-assurance-kernel/s0/manifest.json) are reusable inputs only after reconciling their revisions and scope.

Create a short responsibility map: obligation/family → TAK work and evidence → this campaign's remaining assessment or change → dependency/owner. All TAK-covered items still receive the seven criteria. Reuse an existing result only if its code, inputs, tools, environment and claimed property apply. A source count is not runner discovery; a design is not delivered behavior.

Do not duplicate an active TAK repair or silently change its stage order, executor constraints or acceptance targets. Wait or coordinate only affected changes; independent assessment can continue. The new campaign does not authorize dispatching or substituting for TAK. Differences between a TAK requirement and a justified removal/optimization are recorded as decisions needing reconciliation before the conflicting change; no silent supersession.

Before each repair batch and final acceptance, compare the current base and relevant TAK changes with the audited baseline. Revalidate affected claims and reconcile inventory additions/deletions. Reuse unaffected evidence with its original provenance. Do not automatically restart the entire audit on every new commit, or silently rebase away an intervening change.

## 5. Full inventory and assessment record

Enumerate tracked test sources and declared entrypoints, then reconcile against available native runner discovery and workflow/job/step invocation. Include shell and Node/Python suites, parameterized cases, generated/shipped tests and templates, fixture examples, scheduled/manual workflows, required/optional gates, skipped/disabled checks and local invocations of the same checks. Classify non-test automation explicitly. A test-shaped fixture is not silently counted as an executed test or omitted from the input population.

Identify each executable check or distinct test case using its path and native identity where available. Group parameterized cases or shared mechanisms only with a member list and a reason their obligation, oracle, delivery and decision evidence are shared. Record exceptions separately. Discovery errors, dynamic names or unsupported runners require explicit reconciliation; they do not justify an empty green population. The inventory records unexecuted cases honestly.

Maintain one linked campaign record using the simplest existing portable format appropriate to the data. Reuse applicable TAK data by reference; do not fork its authoritative status. Minimal logical records are:

- **Item:** stable campaign ID, source/case/member identities, obligation/risk, invocation(s), required boundary, seven-criterion assessment, evidence references, disposition and change dependency.
- **Invocation:** workflow/job/step or local entrypoint, event/path selection, environment, repetition, blocking/skip policy, setup and execution cost, and the items reached.
- **Evidence:** claim tested, exact source/input/environment identifiers, method or command, result, raw record reference and limits. Expected outcomes come from the contract, not the checker being evaluated.
- **Decision:** affected IDs, action and rationale, retained protection, alternatives considered, evidence and unresolved questions, implementation batch, verification and rollback.

All seven assessments must be present for every item, either directly or through a justified family record with explicit item-level applicability. Use reasoned conclusions and evidence, not an aggregate score that can let low cost compensate for ineffective protection. “Unknown” is visible incomplete work, not a passing assessment. A concise evidence reference can discharge a criterion; seven repetitive essays are unnecessary.

## 6. Evidence depth and cost measurement

Begin with available evidence: source and invocation analysis, relevant history and CI results, applicable TAK records, and bounded profiling. Structural scanners surface candidates, not final usefulness verdicts. A family with no flagged syntax still needs its relevance, protection and cost assessed; scanner cleanliness cannot complete the audit.

Use a targeted runtime experiment where the decision depends on actual detection, delivery, false positives or cost. Prefer the existing real entrypoint with a compliant case and a representative violating case; verify the intended diagnostic/status rather than counting any failure as success. For a disputed oracle or checker regression, use a localized reached fault with the relevant suite and expected outcomes held unchanged, followed by restoration. Compilation, network, permission and unrelated timeout failures do not count as successful defect detection.

K1–K7 and Q1–Q6 from TAK supply applicable methods within their stated scope, not a Cartesian experiment requirement for every assertion. For a metatest that is itself the production gate, an independent fixed conformance driver is the trusted boundary. Do not recursively add another permanent metatest for every verifier. Narrow probes run in disposable copies and cannot modify the working baseline or shared runtime configuration.

Measure total cost where a decision depends on it: runner/compute use, setup/download/build time, execution, queueing, developer wall-time, repeated attempts and diagnosis/maintenance work. Report history window and sample size. A failing run is not automatically a false positive; classify product defects, test defects, environmental failures and genuinely flaky results separately. Do not invent a monetary ROI or infer maintenance cost from line counts alone.

Choose representative workloads from the actual event and change classes: documentation-only, ordinary production change, shared/kernel/config change, and broad/unknown-path fallback are initial candidates from TAK, to be reconciled at execution. Separate cold setup, warm execution, hosted CI and host-specific paths; do not substitute local timings for hosted queue delay.

Freeze the selected workload definitions and baseline before changing them. Reuse comparable fresh history where it is sufficient. When new timing trials are needed, start with three matched before/after trials for the affected workload, reporting individual values and median; add at most two when noise prevents the decision, then report uncertainty. Do not run the full matrix for a change whose effect can be established more narrowly. Existing binding TAK targets remain attached to TAK-owned changes; no arbitrary campaign-wide speedup or deletion quota is introduced here.

For each extra experiment, state the unresolved decision it can change and what would be lost by omitting it. Stop once sufficient evidence settles that decision; extend only for a new counterexample, changed relevant inputs or material unresolved uncertainty. A negative result must survive in the record. Audit overhead is recorded separately and included in the final assessment of whether the campaign earned its cost.

## 7. Decision rules and implementation stage

Stage 1 closes with a complete reconciled inventory, all seven criteria addressed, a protection map, measured or explicitly limited cost evidence, and decisions. It does not require an expensive runtime experiment for every item. Unresolved assessment prevents a full audit-complete claim; completed decisions may be preserved, but the two-stage boundary must not be silently replaced by opportunistic repairs during discovery.

Prioritize stage 2 by meaningful burden removed or protection repaired relative to implementation/verification cost. Prefer deletion of proven redundant invocations, removal of repeated setup/compilation, shared immutable reads and simpler checks before introducing complex selection or caching. A more elaborate optimization is justified only if simpler approaches cannot achieve the needed result economically.

Each implementation batch has a coherent decision set, allowed paths, fresh inputs, acceptance evidence and a reversible patch. Before changing a useful check, record its required protection and unchanged comparison cases. Repair ineffective assertions or carriers against real faults; do not alter both the subject and expected result merely to manufacture green. Remove proven unnecessary work rather than leaving it as a permanent recommendation.

Invocation changes must preserve the earliest required detection boundary, legitimate passing cases, supported environments, required gate aggregation and discoverability. If affected-test selection is changed, cover shared config/helpers, dependencies/locks, generated assets, renames/deletions, unknown paths and discovery failure with a conservative fallback. If cache reuse is introduced, bind all inputs necessary to the claimed property and demonstrate invalidation; a branch name or green SHA alone is insufficient.

Verify the batch's combined retained protection, including any other removal that relied on the same witness. Reconcile generated/shipped artifacts and callers when touched. Run appropriate existing required checks for the resulting change. Baseline failures and infrastructure outages remain distinguishable from regressions and cannot be hidden by retries or widened skips. Revert or revise a proposed optimization if a counterexample shows quality or required timing loss.

Generalized executable prevention is mandatory; a separate new gate for every individual finding is not. Group common root causes, extend the existing authoritative principle and TAK mechanism where applicable, and give each implementation a bounded detection claim. Its recurring execution and maintenance cost are part of the decision. No paid LLM is introduced into CI.

### 7.1 Principles become executable prevention

For every demonstrated failure class, record the root cause, the general protection principle, examples beyond the original incident, legitimate counterexamples, the existing authoritative home, and its effective detection channel. Classify it as covered by demonstrated existing enforcement, requiring an extension, or requiring a new narrow mechanism. If it is a one-off configuration correction, still identify the general invariant it restores and whether an existing check already guards it. Do not invent a principle per test file, and do not let a new wording duplicate an existing principle.

The governing principle is: a check must provide independently evidenced, relevant protection through a real invocation; its marginal contribution and implementation cost must justify its place in the combined system. Apply it to ordinary tests, CI jobs, principles, TAK checks and their conformance tests. This is a product obligation, not a claim that one algorithm can decide arbitrary semantic usefulness or optimal cost.

Translate each mechanically decidable part into an executable check using the current principle/TAK/testing infrastructure. Candidate classes include vacuous assertions, ignored subprocess failures, silent empty discovery, disconnected delivery, redundant equivalent invocations and measurable recurring-cost regressions. These are areas to evaluate, not findings about the current repository. Exact duplicate detection must respect source/input identities, environment, trigger, enforcement boundary and legitimate independent purpose; similarly named commands are only candidates. Cost bounds must derive from measured workloads and protected obligations, never arbitrary global durations.

For semantic independence, risk relevance or economically preferable alternatives that cannot be decided mechanically, use the existing cold-review channel with structured findings and a consumed disposition. The existing test-semantic home is [review-sidecar](../../../.agents/roles/review-sidecar.md), with its shipped [aif-review binding](../../../packages/core/templates/shared/skill-context/aif-review/SKILL.md). Its presence does not prove invocation or full coverage of cost/relevance: extend the existing authoritative protocol and binding only where the audit establishes a gap, and demonstrate the actual review/disposition path. The executable layer checks the bounded properties it can establish and that necessary review is invoked and consumed; it must not label a populated record as proof of semantic quality. A warning without a decision consumer is not prevention. Missing or unsupported coverage stays visible and prevents a claim that the class is automatically controlled.

For each claimed detector/channel, run an independently specified corpus through the real entrypoint: defective cases fail for the intended reason and valid companions pass. Include a distinct variant where appropriate so a fix cannot satisfy the principle by recognizing only the original fixture. Disable or narrowly weaken the actual detector or invocation with the corpus and expected outcomes fixed; the independent conformance test must detect that loss. This reuses TAK K1–K7 and Q1–Q6 rather than creating a second conformance system. Evidence must show that the future edit/commit/PR path actually reaches the mechanism; a standalone demonstration disconnected from ordinary work is insufficient.

### 7.2 Recursive self-application with a finite trusted boundary

The new principles and metachecks are members of the same inventory and receive all seven assessments. Apply the supported test-quality detectors to their own governed source population, using narrow documented fixture exclusions. Examine whether their own expected outcomes are independent, failures meaningful, invocations necessary and combined costs proportionate. A mechanism is not exempt because it is about tests.

Do not prove a detector correct solely by asking it to accept itself. Follow TAK's independent conformance contract: reuse its actual driver when delivered and applicable; if it is still pending, resolve that dependency under §4 rather than claiming an existing runtime or building a competing mechanism. Keep fixed, independently reviewed good/bad expectations, representative reached detector faults, real delivery checks and verified restoration. Those expectations and the host/runner behavior they rely on are the explicit trusted boundary. The driver is assessed under the same principles, but no endlessly generated driver-of-driver hierarchy is required. New evidence that the trusted boundary is unsound reopens the affected claim; recursive self-application is not universal mathematical certification.

Route cheap mechanisms to the earliest appropriate existing channel and scope recurring work to affected obligations with conservative fallback. Keep expensive deep sensitivity work in the established TAK lane when that preserves the required detection timing. If a mechanism would introduce disproportionate recurring cost, redesign it before claiming acceptance; do not make mandatory prevention optional, silently weaken its claim, or place a second full audit on every unrelated PR.

## 8. Deliverables and acceptance

Keep the deliverables small: one linked inventory/decision record, portable evidence for load-bearing claims, the implementation changes including authoritative generalized principles and their executable prevention, and a concise before/after report. Extend existing artifacts rather than duplicating TAK's registers. Large logs may use the existing artifact channel with durable references. A new dashboard, service or reporting framework is out of scope by default.

| Acceptance | Required result |
| --- | --- |
| Coverage | Every CI check and test is accounted for across all seven criteria; groups have explicit members and exceptions; additions/deletions are reconciled against the final source. |
| Sufficient protection | Relevant fault and valid-behavior contracts, delivery and required detection timing are explicit; confirmed in-scope gaps are repaired and verified. |
| No loss | Every simplification preserves its required protection and the combined final system has no unresolved known loss or reachable counterexample hidden by green checks. |
| Minimality | Every proven unnecessary check, portion or invocation is removed. Joint removals preserve a retained independent witness where needed. Unresolved candidates are not declared unnecessary. |
| Economical implementation | Useful high-cost checks are examined for cheaper equivalents; supported worthwhile redesigns are implemented. Retentions explain the protection or absence of a supported economical alternative. |
| Cost result | Comparable before/after evidence separates repair overhead from optimization gains and shows the final campaign result, including regressions or uncertainty. No cherry-picked workload, artificial numerical target or reduced denominator. |
| Freshness and TAK | Final claims bind the actual reviewed revision; relevant intervening changes and TAK responsibilities/evidence are reconciled. |
| Generalized prevention | Demonstrated root-cause classes map to authoritative principles and effective existing, extended or new detection. Real good/bad conformance and detector/invocation regressions verify the bounded claims and future work reaches the mechanism. A policy-only appendix or incident-specific patch is insufficient. |
| Recursive quality and efficiency | The prevention mechanisms and conformance tests appear in the inventory, receive all seven criteria, preserve an independent oracle and finite explicit trusted boundary, and justify their recurring cost without duplicating existing TAK enforcement. |
| Honest completion | Independent acceptance can trace decisions to evidence and actual changes. Missing essential assessment, confirmed unfixed gaps, unimplemented supported removals or unresolved quality loss mean PARTIAL/BLOCKED, not DONE. |

Minimal sufficiency does not require proving that no conceivable future optimization exists. Completion means the complete assessed population has defensible dispositions, the supported in-scope improvements are delivered, and no known unnecessary work or protection loss is disguised as success. If no safe useful simplification is found, retain that evidence-backed outcome rather than manufacture deletions; distinguish a valid no-change conclusion from an incomplete investigation.

## 9. Testing seams and independent acceptance

Prefer existing seams: native runner discovery and reports for population; real check entrypoints and fixed compliant/violating fixtures for behavior; actual emitted/installed configuration for delivery; workflow conditions and existing required-result/path-scope tests for invocation; CI run records and matched commands for cost. TAK conformance drivers are reused where their scope and source inputs apply.

The acceptance reviewer examines the complete decision/removal map, root-cause-to-principle-to-detector coverage and raw evidence, reproduces disputed or consequential protection claims at the actual changed boundary, and checks combined removals and self-application. It is not required to repeat every unchanged historical experiment. The campaign's one-time acceptance process is distinct from the bounded recurring prevention it delivers. A clean schema, a completed worker status or another green full-suite run is not a substitute for substantive acceptance.

Host-specific claims require the actual applicable host evidence. A missing host or inaccessible CI history limits the corresponding claim and completion status; it does not authorize a new infrastructure project.

## 10. Decision register and consequences

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D1 | answered | Full CI/test scope and seven criteria; P2. | Any excluded family has no explicit inventory disposition or missing criterion. |
| D2 | answered | Audit and decisions, then implementation; P3. | Discovery changes checks before the audit's decision boundary. |
| D3 | answered | No-loss minimal sufficiency; unnecessary work removed, useful expensive work redesigned; P7–P8. | The final system knowingly loses protection for speed or leaves proven redundant work as optional advice. |
| D4 | answered | TAK is context and part of the assessed system; P4 and P9. | TAK is assumed complete, exempted, duplicated or silently superseded. |
| D5 | answered | Current session is design-only; P5. | These documents trigger execution or product changes. |
| D6 | answered | Author proposal: inventory plus obligation/invocation map; family evidence with individual applicability, §§2–5. | Grouping hides a distinct member's oracle, protection or cost. |
| D7 | answered | Author proposal: proportional evidence depth and existing tools; §§6–9. | Cheap form checks replace needed behavioral evidence, or universal experiments add cost without decision value. |
| D8 | answered | Author proposal: scoped freshness reconciliation and dependency handling; §4. | A stale result supports a changed path, or every unrelated commit forces full repetition. |
| D9 | answered | Generalized principles, executable future detection and recursive self-application are mandatory; P10. | The result only repairs current examples or leaves its own metachecks unevaluated. |
| D10 | answered | Author proposal: extend existing TAK with bounded detection contracts and a finite independent conformance boundary; §§7.1–7.2. | A detector certifies itself circularly, syntax claims universal semantics, or prevention creates an unbounded expensive checking hierarchy. |

Rows D6–D8 and D10 are settled author design choices for review, not prior operator agreement. Numeric repair budgets, actual performance targets, concrete atomic patches and worker allocation depend on the execution baseline and belong in the approved specification's subsequent kickoff decomposition, not invented findings in this design.

Consequences: full scope requires complete accounting; lower investigation cost comes from reuse and proportional depth. No-loss protection constrains simple schedule moves and may rule out tempting speedups. Some checks will be removed, some repaired or reimplemented, and others retained according to evidence. An unavailable fact produces a specific unresolved decision, not automatic permanent retention or speculative deletion.

## Consensus retell

Baseline: none — first retell

| # | Claim | Source |
| --- | --- | --- |
| 1 | Suspected excessive checking motivates an efficiency campaign. | P1 |
| 2 | All CI checks and tests, including TAK and metatests, receive all seven criteria. | P2 + P4 + P9 |
| 3 | The execution kickoff covers evidence-backed audit and subsequent improvements. | P3 |
| 4 | Simplification must preserve protection quality; proven unnecessary work is removed. | P7 |
| 5 | Useful but disproportionately expensive checks should be considered for cheaper implementation. | P8 |
| 6 | The audit itself must be proportionate; the current chat only prepares it. | P5 + P6 |
| 7 | The result must include generalized principles and executable prevention, assessed by the same criteria recursively. | P10 |

### Unconfirmed — author derivations

- The obligation/invocation inventory, grouping conditions and proposed evidence records in §§2–5.
- The investigation, timing, batch-verification and acceptance methods in §§6–9.
- The finite independent conformance boundary and concrete division between mechanically detected properties and named semantic review in §§7.1–7.2.
- Concrete tooling, thresholds and patch decomposition remain dependent on execution evidence; no current repository finding is asserted here.

## 11. Handoff boundary

After exact specification agreement, write an execution kickoff under the repository's existing /arch and pipeline contracts. It must carry the two-stage boundary, these acceptance requirements, the operator clarifications, actual launch prerequisites and TAK coordination constraints. Do not emit dispatch markers or launch work during design. The approved PRD is not approval of this specification; cold review is not operator agreement or authorization to merge/publish.
