# CI and test effectiveness product brief

> **Feature:** `ci-test-effectiveness`
> **Status:** Revision 2 draft for `/intent` → `/arch`. Revision 1 was approved and preserved in an immutable snapshot. This revision incorporates the operator's subsequent recursive-prevention requirement; approval of these revised bytes has not yet been recorded.
> **Date:** 2026-11-08
> **Authoritative for:** the proposed outcome, scope and acceptance expectations of this audit-and-improvement campaign.
> **Not authoritative for:** repository goals, TAK implementation status, execution authorization or the architecture of the eventual solution.

## Motivation and intended experience

The repository maintainer suspects that the project now checks too much, too often and for too long. Accumulated tests, CI jobs and checks may consume more time and attention than their protection justifies. This is the reason for the campaign, not an incidental performance concern.

The maintainer wants to understand which checks earn their cost and then improve the actual system: remove avoidable work, reduce waiting and maintenance, repair misleading or ineffective checks, and address material gaps. The result should make normal development easier while retaining protection that matters to the repository's purpose. The suspicion of excess is a hypothesis to investigate, not permission to declare checks useless before examining them.

Success is justified decisions followed by verified improvements and reusable prevention. Generalize demonstrated failure classes into testing principles and executable checks within the existing TAK/metatest system, so future changes encounter detection without requiring the same full audit again. Apply the same seven criteria to those principles and checks themselves. Fewer tests, shorter CI, higher coverage, more detected issues, or more green jobs are not sufficient success criteria by themselves. The audit's own effort and the recurring cost of prevention must also justify their expected benefit.

## Operator premise register

| ID | Recorded meaning | Operator source in this chat |
| --- | --- | --- |
| P1 | Efficiency is the goal; assess the repository's CI and tests. | “цель эффективность”; “CI и тесты” |
| P2 | Evaluate all CI checks and all tests against all stated criteria, not only tautology. | “Просто помимо TAK нужно все проверить по остальным критериям все” |
| P3 | Deliver both evidence-backed decisions and subsequent repairs. | “kickoff - не просто аудит но и исправление после аудита”; “два этапа: сначала доказательные решения, затем изменения на их основе.” |
| P4 | Account for TAK work and the freshness of the repository branch. | “Там еще TAK реализуется ... нужно будет учесть при аудите и вообще актуальность и свежесть ветки репозитория” |
| P5 | Current work is intent/specification/kickoff preparation; do not execute the audit in this chat. | “Сам не проверяй это лишь идея /intent для /arch - цель написать спецификацию и затем кикоф для исполнения” |
| P6 | Suspected excessive checking and long feedback times motivate the campaign. | “наш проект стал слишком много и долго все проверять возможно уже переборщил - поэтому я и захотел провести этот аудит” |
| P7 | Generalize the findings into principles and executable prevention through TAK/metatesting; apply the same criteria to the prevention checks themselves. | [Recorded operator requirements C5–C6](snapshots/ci-test-effectiveness/operator-meta-enforcement-2026-11-08.md) |

## Scope and the seven criteria

The population is all CI checks and all tests in this repository, including those introduced or changed by TAK. Consider both individual checks and their combined behavior. Include invocation paths outside CI where they affect the same tests' repetition, cost or actual enforcement. Unrelated organizational processes are outside this campaign.

| Criterion | Question the audit must answer |
| --- | --- |
| Relevance | What real defect or risk does this check cover, and how material is it? |
| Effectiveness | Can it detect that defect? What examples or other evidence establish its ability and limits? |
| Theatre | Can it pass while the claimed result is broken? Does its output actually affect a decision or enforcement outcome? |
| Tautology | Is the expected result independent of the implementation's decision logic, or does the test simply reproduce or agree with it? |
| Duplication | What information or necessary protection does it add beyond other tests, jobs or repeated invocations? |
| Cost effectiveness | Do execution, setup, waiting, maintenance, false alarms and interruptions justify the benefit? Are its frequency, selected scope and blocking status necessary? |
| Sufficiency | Which significant risks remain untested, and what is checked without a justified need? |

Frequency, scope and blocking status are explicit decisions, not incidental configuration details. Duplication is evaluated across the whole developer-to-CI path, not just within one test file or workflow. A structural check is judged against its real structural obligation; it must not be credited with behavioral assurance it does not provide.

## Essential promises

| ID | Promise | Scenario and observable outcome | Failure case | Permitted deferral |
| --- | --- | --- | --- | --- |
| E1 | Complete scope and honest assessment | All CI checks and tests appear in a reconciled inventory; every item is covered by the seven criteria, individually or through an explicitly justified family assessment. Uncertainty and unexamined behavior remain visible. | A convenient sample, a filename census, or only TAK-related tests is presented as the complete audit. | None for the inventory or criterion coverage. Unavailable evidence may remain explicitly unresolved, never silently certified. |
| E2 | Decisions are based on meaningful evidence | For each retain, improve, combine, relocate or remove decision, the report identifies the risk, incremental value, evidence, cost and consequences. Relocation includes timing, frequency, scope and blocking role. | Checks are retained because they exist, deleted because they are slow, or declared useful because their own suites are green. | Evidence depth is proportional to the decision's consequences; uncertainty must limit the decision. |
| E3 | The system's total burden is assessed | The audit examines repeated work, setup, critical-path delay, queueing and false alarms as well as the value of individual checks. | Useful individual checks hide an unnecessarily expensive combined workflow. | Unavailable measurements are identified; no fabricated ROI or precision. |
| E4 | Audit decisions lead to actual improvements | A second execution stage applies supported changes and repairs in-scope defects, with traceability back to the audit. | The campaign ends at a report, or changes are made without the preceding evidence. | A change may be held for a specific unresolved dependency or decision; it remains open rather than counted as delivered. |
| E5 | Improvements are verified against the intended benefit | The final result shows what burden changed and whether the relevant protection still works, including legitimate passing cases and material failure cases where applicable. | CI is faster only because useful protection was disabled, or extra checks are added without assessing their cost. | If evidence cannot establish the benefit or protection, completion remains qualified. No predetermined speedup or deletion quota. |
| E6 | TAK is considered without shrinking the audit | The executor establishes which TAK requirements and implementations are planned, in flight, landed and actually verified, reuses applicable evidence, and still assesses every check against all seven criteria. TAK's own checks are included. | TAK is treated as already complete, as a universal certificate, as an exemption, or as a reason to create a competing assurance mechanism. | Pending TAK delivery may hold dependent changes; unrelated assessment and improvements can continue. |
| E7 | Conclusions apply to the actual repository state | The executor establishes the intended current base and records the audited revision, relevant branch/PR state and evidence dates. Before repairs and final acceptance, relevant changes since that baseline are reconciled. | An old checkout or stale report drives repairs to an already-fixed or changed mechanism. | If freshness cannot be established, affected conclusions remain provisional. |
| E8 | The campaign itself is proportionate | Investigation and verification depth are chosen for their ability to change a material decision. Existing suitable evidence is reused when its applicability and freshness are established. | The response to excessive checking is an unbounded new layer of audits, repeated reviews or permanent gates. | Low-value extra experiments may be omitted with an explanation; necessary evidence for a material change may not be replaced by confidence alone. |
| E9 | Findings produce general principles and effective future detection, with recursive self-application | Demonstrated recurring failure classes are generalized into authoritative testing principles and executable checks through existing TAK/metatest channels. The mechanism rejects representative bad cases, admits good cases and detects relevant regressions in its own enforcement. It is itself assessed against all seven criteria, including recurring cost and redundancy. | The campaign only repairs today's examples; principles remain prose; a checker passes itself without independent evidence; or metatests create the same waste they are intended to prevent. | No deferral of the required prevention outcome. Unsupported general semantic guarantees must be bounded explicitly; an equivalent existing mechanism may be reused when its applicable enforcement is demonstrated. |

All promises are essential. A completion claim must distinguish delivered improvements, justified no-change decisions and unresolved work. A valid audit may conclude that a costly check is necessary; it may also conclude that a cheap check is unnecessary.

## Chosen approach and alternatives

The operator selected two execution stages:

1. **Evidence-backed audit and decisions.** Establish the current baseline and TAK context, assess the complete population, and decide what should change and what should remain.
2. **Changes based on those decisions.** Implement the supported improvements, generalize demonstrated failure classes into principles and executable prevention, verify their effect and retained protection, self-apply the same criteria to the prevention mechanism, and report the remaining limits.

An audit-only deliverable is insufficient because the operator explicitly requested corrections. Immediate optimization before assessment is insufficient because it assumes which checks are wasteful. A blanket increase in testing is not the objective.

For the current chat, the requested deliverables are the intent/PRD, then the `/arch` specification and an execution kickoff. Authoring those documents does not start either execution stage.

## TAK relationship and freshness

The existing [Test assurance kernel and PR feedback cost design](2026-10-08-test-assurance-kernel-design.md) covers test sensitivity, weak oracles, real delivery and feedback cost. It is a relevant design input, not evidence of current implementation or acceptance. Its dated status, historic baselines and performance targets must not be silently adopted as current facts or newly agreed targets for this campaign.

The new work must identify overlap, dependencies and remaining responsibilities relative to current TAK work. It must neither exclude TAK-covered areas from the seven-criterion assessment nor redo already-applicable work merely to produce a separate report. Any conflict with a governing TAK requirement must be surfaced and resolved explicitly rather than silently overriding either scope.

The executor must confirm the target branch and its relationship to the current integration branch at execution time. Freshness is not just the age of a local checkout: relevant open work, landed changes and the applicability of evidence matter. A moving repository requires focused reconciliation of changed areas, not automatic repetition of the entire audit.

## Rejected interpretations

- “The project is definitely overchecked; maximize deletions.” Excess is the hypothesis, not the verdict.
- “Only make CI faster.” Quality, decision usefulness, false alarms and maintenance are also in scope.
- “Only detect tautological tests.” All seven criteria apply to the complete population.
- “TAK handles quality, so skip those checks.” TAK is context and itself part of the assessed system.
- “Every check must get the same expensive experiment.” Full scope does not imply equal investigation cost or an infinite chain of metatests.
- “Every existing check must survive.” A justified decision may remove unnecessary protection rather than reproduce it elsewhere.
- “Add a permanent checker for every finding.” New machinery must justify its own value and cost.
- “Recursive prevention means an infinite hierarchy of new metatests.” The new mechanism needs independent evidence and self-application; recursively adding layers without additional justified protection repeats the original problem.
- “Green equals done.” Green without evidence for the claimed outcome cannot settle the campaign.

## Decisions and architecture handoff

| Decision | Status | Resolution | Falsifier |
| --- | --- | --- | --- |
| D1 | answered | CI and tests, all seven criteria; P1–P2. | The specification omits a criterion or excludes TAK checks categorically. |
| D2 | answered | Audit and decisions first, repairs second; P3. | The kickoff ends at recommendations or authorizes unsupported repairs first. |
| D3 | answered | Current TAK work and repository freshness are mandatory context; P4. | A historic design or stale checkout is treated as present execution evidence. |
| D4 | answered | Current session prepares documents only; P5. | The current session starts running the audit or changing checks. |
| D5 | answered | Excessive checking is a motivating hypothesis; P6. | The specification presupposes waste or equates success with more checks. |
| D6 | answered | Generalized principles, executable prevention and recursive self-application are required outcomes; P7. | The campaign ends at local repairs, optional prevention advice or self-certified metatests. |

No product-scope question is currently open. Architecture work must still determine the evidence/decision format, economical investigation depth, concrete comparison workloads, stage boundaries and integration with the actual TAK state. These are not recorded as operator-approved implementation choices.

**Approval reference:** [revision 1 approval](snapshots/ci-test-effectiveness/prd-approval-2026-11-08.json) binds the original preserved snapshot only. The subsequent C5–C6 operator statements establish the added requirements, but approval of the exact revision 2 bytes is not yet recorded. `/intent` snapshot approval and `/arch` review/handoff follow their existing contracts; this document does not add another approval workflow.
