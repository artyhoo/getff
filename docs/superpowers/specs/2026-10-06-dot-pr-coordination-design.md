# Dot PR review and Claude Code coordination

> **Status:** Proposed implementation specification; subject to cold review and operator review. No runtime is deployed by this document.
> **Date:** 2026-10-06
> **Authoritative for:** the proposed review responsibilities, portable result contract, correction lifecycle and acceptance criteria for adapting PRs #2055 and #2056.
> **NOT authoritative for:** project goals, existing platform capabilities, billing allowances or new merge permissions. Project goals belong to [README](../../../README.md#why-this-exists); repository merge rules belong to [CLAUDE.md](../../../CLAUDE.md).

## 1. Outcome and implementation boundary

An executor delivers a PR with its existing pre-PR AI review. A Claude Code coordinator takes responsibility for CI, review feedback, correction assignment, verification and merge ordering. Dot/Astra supplies an independent system review, including the adequacy of the existing AI review. Executors make corrections; the coordinator recovers stalled work using the operator's existing Claude Code monitoring and inter-session messaging.

The core contract is AI-agnostic. Claude Code is the selected coordinator/executor runtime. This Codex session writes the specification and implementation packets, then verifies the delivered system with Dots. The existing Claude Code sessions implement within their existing PRs. AIF Handoff is excluded from this process. No new session bus, orchestration platform, paid model API, purchased credits or paid fallback is authorized.

The first release must demonstrate a bounded correction cycle, including unattended delivery and recovery, before claiming autonomy. Automated merge remains disabled until its separate acceptance conditions are met. This specification authorizes neither a launch nor a merge in the authoring session.

## 2. Responsibilities

| Role | Owns | Completion evidence |
| --- | --- | --- |
| Executor | Implementation, relevant local checks, obtaining the existing pre-PR AI review, opening the PR, assigned corrections | Exact revisions, check receipts, review artifacts and a finding-to-fix response |
| Change reviewer | Correctness of its declared change scope, test completeness/quality, false positives/negatives, tautology, local design and maintainability | Scope/revision-bound review, findings and resolution evidence |
| Dot/Astra | Project-level coherence, architecture implications, AI-documentation quality and authority, skill/rule routing, agnosticism, context economy, mechanical enforcement coverage and adequacy of prior review | Structured system review with evidence, coverage limits and stable findings |
| Coordinator in Claude Code | Durable queue and ownership, CI/review intake, delivery and acknowledgement, stalled-work recovery, required re-review and dependency-aware merge | State transitions, action receipts and current eligibility calculation |
| Deterministic helpers | Parsing, identity/freshness checks, persistence, polling, publication, deduplication, budgets and mechanical admission predicates | Executable positive/negative checks at the earliest reachable channel |

The change reviewer already runs before PR creation. Do not introduce a mandatory second full implementation review on PR opening. Preserve and publish that review's evidence. Later code changes receive review of their changed scope and affected scenarios.

Dot checks whether the prior review was adequate, rather than repeating it exhaustively: did its scope cover the important changed behavior and consumers; were relevant test risks examined; are unresolved findings addressed; do the artifacts match the delivered revision; does source evidence contradict its conclusions? An approval label or an executor's claim alone is insufficient. Private or unavailable review detail is marked unknown, not assumed absent or present.

Dot may inspect code and tests to investigate a concrete signal or challenge a receipt. It records the rationale and evidence. Semantic quality remains a named independent review responsibility; deterministic tooling does not certify semantic completeness or reviewer independence.

## 3. Operator-visible flow

1. Executor opens a staging PR and supplies its pre-PR review artifacts and ownership identity.
2. Coordinator registers the PR, reconciles current checks and dependencies, and sends concrete CI corrections to the executor when needed.
3. Once mandatory mechanical checks qualify the PR, coordinator queues a bounded Dot system review of a pinned revision and supplied review packet.
4. A trusted result receiver persists Dot's report. An ordinary-code publisher exposes a human summary and machine-readable report reference beside the PR in GitHub.
5. Coordinator routes actionable findings to one executor. The executor acknowledges, corrects and submits a finding-to-fix response.
6. Applicable checks and change review verify the correction. Dot resolves its system findings through a targeted follow-up. Missing evidence stays visible.
7. Coordinator computes current eligibility and, if separately enabled and authorized, merges in dependency order. Base movement invalidates eligibility until reconciled.

Opening a PR transfers monitoring responsibility to the coordinator after a durable registration receipt. A failed or missing receipt leaves the PR unregistered and must be surfaced to the executor. Executor monitoring is optional; it uses the same ownership contract and cannot silently create a parallel fixer.

Registration also transfers merge/auto-merge authority for that managed PR to the coordinator. Enrolled executors submit fixes and evidence; they neither merge nor arm auto-merge independently, including when CI becomes green. Before issuing registration, reconcile and disable any previously armed auto-merge that conflicts with the managed policy. Unknown armed state holds registration/admission. Implementation must amend the existing CLAUDE.md executor-self-merge instruction with this scoped managed-PR exception and carry it into executor kickoffs. Unmanaged PRs keep their existing policy. A stalled coordinator or disabled merge switch does not silently restore executor merge authority; release from management requires an explicit recorded policy/operator transition.

## 4. Storage, publication and real platform integration

Reuse the #2056 persistent ledger/outbox boundary as the authoritative operational journal, extending it for findings, ownership and receipts. Production requires an explicit persistent path; in-memory storage is fixture-only. GitHub contains the shared published report and correction evidence. Comments/checks are projections, not a second authoritative state machine.

Persist original accepted report bytes, digest, authenticated envelope and immutable reference before acknowledging submission. Store the machine report in a durable artifact store reachable by enrolled consumers, or publish the complete bounded JSON in the PR comment if it fits platform limits. Oversize reports use an immutable reference plus digest; truncation cannot substitute for the machine report. A visible summary includes the report ID, reviewed revision, limitations and durable reference.

A registry identifies the trusted publisher and enrolled reviewer/executor principals. Intake authenticates the submitting principal and binds it to the assignment and revision. The report itself cannot confer identity, policy, permissions or model attestation. GitHub comment markers are for deduplication and discovery; arbitrary matching comments are not trusted reports. Dot is an independent reviewer, not a GitHub administrator or merge actor.

Dot's callable submission/export and unattended launch routes are **not established by this specification**. Enrollment must name an actual existing route, demonstrate that the receiver can obtain the result without human copying, and record its invocation and receipt. Do not invent an endpoint, connector write capability or task identifier. A supported direct submission or supported result-export adapter may be used; the ordinary-code publisher performs GitHub writes. If only manual copy is available, label the deployment `ASSISTED`, retain useful reports, and leave autonomous scheduling/merge disabled.

The Claude Code adapter uses the existing operator-confirmed monitor and inter-session message/wake mechanism. During destination enrollment, the implementation owner records actual commands/tool calls, session identifiers, persistence scope, restart behavior and acknowledgement behavior from that mechanism. Capability availability is confirmed by the operator; exact integration and end-to-end operation require destination evidence. No Codex-local untracked path is the sole input to a cloud worker.

Receiver and coordinator may share a durable store if they run together, or communicate over the existing authenticated intake/read interface. One writer authority owns claims and transitions. A remote receiver must not depend on a sleeping local PC to preserve a report. When the Claude Code runtime is offline, reports remain queued; waking, local fixes and merges resume only after it reconnects. This design does not promise local execution with the computer off.

## 5. Portable contract: DotPRReviewV2

Adopt the major contract name `DotPRReviewV2`, version `2.0.0`. Update #2055 schema/protocol/design/kickoffs and #2056 validators, policy pins and fixtures together. Exact field spelling is owned by the versioned schema; the following meanings are mandatory.

| Record | Required content |
| --- | --- |
| Review identity | Repository, PR, review ID, mode (`OPEN_PR`, `HISTORICAL`, `FOLLOW_UP`), protocol version, assignment ID, policy version/epoch, comparison basis and exact revisions |
| Scope | Every changed path accounted for by system analysis, referenced change review, generated equivalence or justified outside-scope disposition; affected consumers and omissions |
| Assessments | Separate system coverage (`COMPLETE`/`PARTIAL`), prior-review sufficiency (`SUFFICIENT`/`INSUFFICIENT`/`UNKNOWN`), and execution evidence with per-claim levels |
| System verdict | `GO`, `REVISE` or `DECISION_REQUIRED`; rationale and blockers. COMPLETE may contain defects; PARTIAL may contain actionable findings |
| Change-review receipt | Immutable artifact/digest/reference, attributed reviewer, independence evidence/limits, reviewed revision and comparison basis, reviewed scope/scenarios, findings and resolutions |
| Finding | Stable finding ID and cause lineage, occurrence ID, requirement, category/severity/blocking status, failure scenario, locations/consumers, evidence/uncertainty, expected correction and verification |
| Fix response | Assignment/claim identity, finding IDs, fix revision, changed scope, relevant mechanical receipts, change-review receipt, unresolved items |
| Closure receipt | Finding IDs, verification revision and comparison basis, verifier attribution, evidence and explicit disposition/rationale |

Use evidence labels such as `SOURCE_TRACED`, `HELPER_REPRODUCED`, `PIPELINE_VERIFIED`, `INSTALLED_CONSUMER_VERIFIED`, `LIVE_SERVICE_VERIFIED` and `UNVERIFIED`. A helper probe does not become an installation result during normalization. A missing local runtime reproduction alone does not make semantic coverage PARTIAL when the declared system scope is complete; individual claims retain their limits.

System coverage is governed by the protocol's role dimensions: goal/overall architecture; AI-documentation authority and fidelity; skill/rule routing; agnosticism and portability; context economy; deterministic enforcement coverage/channel selection; and prior-review adequacy. For each dimension record `ASSESSED`, `NOT_APPLICABLE` or `UNVERIFIED`, with rationale, affected scope and evidence. `ASSESSED` may conclude violation, uncertainty or insufficient prior review; it is not a pass label. `NOT_APPLICABLE` requires a change/consumer-specific reason. `UNVERIFIED` means a required system question could not be assessed. COMPLETE requires every applicable system dimension to be ASSESSED and all changed paths accounted for; any unassessed required system question makes coverage PARTIAL. A change-review path disposition alone does not establish system-dimension coverage. Unknown prior-review sufficiency remains its separate admission-blocking assessment; missing runtime execution remains a per-claim evidence limit unless it prevents the system assessment itself. These dimensions do not reintroduce exhaustive implementation/test review.

Pre-PR review artifacts may precede the final PR head. Record the immutable reviewed revision and account for subsequent changes: identical relevant trees can reuse the receipt with proven equivalence; material changes need a relevant review supplement. Mere ancestry, a PR body assertion or a SHA label is insufficient. Receipt provenance must distinguish authenticated reviewer evidence from executor-supplied claims. Do not pretend to prove private reviewer execution or model identity.

Accept format-valid, authenticated, correctly assigned negative and partial reports into history and corrective processing. Calculate admission separately. Invalid signatures/principals, malformed input, duplicate keys and assignment mismatches are rejected. A once-valid report delayed by head/base movement may be archived as superseded after verifying its issued assignment; it cannot authorize the new revision. Current-applicability checks precede correction assignment. Replays return the existing receipt without duplicating work.

Existing V1 reports are preserved as historical artifacts. Import them with original version, original bytes and explicit provenance; they do not acquire V2 GO eligibility by coercion. Schema incompatibility, including old INCOMPLETE statuses, requires explicit import mapping rather than silent reinterpretation.

## 6. Finding and ownership lifecycle

Keep finding identity separate from admission generations: a new head invalidates eligibility but preserves finding lineage. State changes are durable, transactional and attributed.

| Finding state | Transition requirement |
| --- | --- |
| `OPEN` | Accepted occurrence; current applicability established before dispatch |
| `ASSIGNED` | Atomic PR correction claim, executor identity, expected revision, scope and lease/fencing token |
| `ACKNOWLEDGED` | Executor confirms the assignment ID/token and actual work location |
| `VERIFYING` | Fix response recorded; applicable checks and independent review remain pending |
| `RESOLVED` | Required verification and explicit closure receipt for the current relevant revision |
| `DECISION_REQUIRED` | Specific policy/goal/scope decision or disputed finding routed to the operator |

Closure dispositions also include `ALREADY_FIXED`, `NOT_APPLICABLE` and `REJECTED_WITH_EVIDENCE`; the relevant independent reviewer records the evidence. Executor disagreement leaves the finding open for adjudication. A recurrence reopens lineage with a new occurrence and current evidence. Informational advisories stay visible without becoming blocking fixes by default.

Only one active corrective owner per PR. The executor may correct several findings in one coherent change. The coordinator normally delegates; a small coordinator-made fix must claim ownership and obtain independent review like any other fix. The coordinator cannot author and independently verify the same correction.

Persist action intent before messaging. Message delivery is not executor acknowledgement. Retry using a stable action ID; duplicate messages return the same acknowledgement/work reference. Recover by querying pending intents and reconciling actual session/PR state. Record revision races, push failures and remote acknowledgements instead of assuming a side effect succeeded.

Lease expiry alone does not prove a worker stopped. Before replacement, cancel/revoke the old assignment, reconcile pending pushes and verify cessation through the existing runtime adapter. Where cessation cannot be established, hold replacement and surface the conflict. Enforce fencing tokens in controlled fix submission/push paths; document any direct-GitHub bypass as a deployment limitation, not a single-owner guarantee.

Test failures, stale receipts and unresolved blocking findings prevent closure. Applicable change review checks code/test corrections; Dot supplies closure for its system findings and review-sufficiency findings. Routine CI failures resolved before Dot review need mechanical verification and change review when material behavior changed, without an unnecessary Dot round.

## 7. Queue and revision policy

Use the actual configured mandatory checks, expected App/workflow identities and latest applicable executions. Exclude Dot's own pending check from mechanical qualification to avoid circular readiness. Skips/cancellations qualify only under an explicit existing policy; a rollup count is not readiness evidence.

Priority is: pending correction verification; qualifying open staging PRs; then unreviewed merged staging PRs, newest merged first. Historical review starts when no open PR qualifies. Do not require a full-repository COMPLETE baseline. Configure at most one active Dot review initially. Historical work yields at the next bounded checkpoint when higher-priority work arrives; do not discard a running paid-by-allowance task merely because a poll changed.

Persist queue records keyed by repository, PR, mode, reviewed revision/comparison basis and protocol major. Store assignment, checkpoint, accepted report and retry state. Cursor pagination must survive restart; new arrivals ahead of the cursor are reconciled. For equal priority use enqueue time, with deterministic tie-breaking. Record already-reviewed historical identities; migrated pilot reports carry their actual scope and limits. A protocol upgrade triggers only a policy-declared re-review, not automatic review of all history.

For open PRs bind head H, current staging base B and tested candidate merge identity M where applicable, plus policy/lifecycle epoch. For history pin the PR change basis and merge identity, and record a separate current-staging S used to revalidate findings. A historical finding creates remediation work only if it still applies to S. Link one remediation PR to its original finding lineage; a merged source PR is never reopened or treated as merge-eligible. Reuse existing remediation work instead of duplicating it.

Coalesce pushes while checks are running; dispatch against the latest qualifying revision. A stale completed report remains history. Reuse unchanged evidence only with an explicit equivalence assessment; never copy GO onto a new revision. Targeted follow-up covers changed paths, affected consumers, previous findings and review supplements. Material scope expansion requests a new system assessment.

If Dot requests stronger prior review, coordinator first obtains the missing scoped change-review evidence, then asks Dot to assess the supplied evidence. Avoid alternating full reviews with no new information.

## 8. Admission and merge ordering

The journal derives readiness; neither a comment, a fix assertion nor semantic GO alone enables merge. Eligibility requires current mandatory mechanical checks, sufficient relevant change review, acceptable current system coverage/verdict, closed blocking findings, satisfied PR dependencies and current policy/revision binding. By default, PARTIAL coverage or UNKNOWN/INSUFFICIENT prior review does not authorize merge, though findings remain actionable.

Managed-PR merge authority must be enforced at the actual supported merge/arming entry points. A shared helper or prompt alone does not fence direct GitHub writes. Enrollment records which actors can bypass the managed gate. Autonomous merge remains disabled unless the configured native protection/permissions demonstrably enforce the managed boundary for enrolled actors; deploy correction-only operation otherwise. Acceptance includes a managed executor attempting the former green-CI self-merge path while dependencies or merge-off hold the PR, with no merge/arming side effect.

Registration supplies explicit dependency PRs and reason. Coordinator validates dependencies and cycles, respects existing merge locks/trains, and reconciles current staging before each consequential action. Use existing repository merge policy and merge-forward conflict discipline. Promotion to main is outside this mechanism. Any unresolved policy/scope decision is held for the operator rather than redefined by an executor.

Automated merge is a separate deployment switch, default off. Enable only after live correction acceptance and native admission/merge tests. Preserve #2056's publisher/armer separation and current-M safeguards; prove behavior under base movement, same-M policy changes, close/reopen, SHA aliases and stale successful checks. Do not claim a local state calculation revokes an already-successful native check or disables armed auto-merge unless live evidence shows it. A disabled/paused policy must prevent new merge side effects and reconcile already armed operations.

## 9. Economy, monitoring and recovery

Deterministic code polls/discovers changes, compares signatures, persists cursors and produces bounded work packets. A Claude Code cron that starts an LLM turn still consumes inference even if a helper finds no changes; distinguish it from a model-free scheduled helper. Reuse existing monitoring while documenting its actual invocation cost. Do not claim unchanged-state polling is free when it wakes a model.

Model work is triggered by meaningful new evidence, actionable feedback or stalled execution. No model repeatedly reads an unchanged whole repository or repeats CI polling. The coordinator receives compact deltas, ownership and next actions. Dot receives the declared PR packet and follows source pointers on demand; it performs no recurring publication housekeeping.

Initial safe operational defaults: one concurrent Dot task, one corrective owner per PR, at most two automatic fix/review rounds per finding occurrence, and at most two retries for a delivery failure before a visible hold. Values are configurable in trusted policy. Crash/replay does not reset these counters. New occurrences cannot evade a cause/PR-level retry budget. Bounds stop churn; they do not mark unfinished work complete.

Deployment policy must also specify finite per-window Dot launches, coordinator turns and fix launches, with persisted reservations before dispatch. The operator sets numeric capacity for the actual account; missing aggregate limits disable unattended model dispatch. Account allowance signals are optional observations, not a substitute for local launch caps. Timeouts, cancellations and failed launches are recorded conservatively until their actual disposition is known.

Exhaustion/quota errors pause new model work and merges, preserve pending work, and notify once per meaningful transition. Resume follows policy/operator action with the same journal. Preserve reports and in-flight receipts during a pause. Never switch to paid fallback. No unlimited promo allowance or month-long availability is assumed; report observed cycles and consumption where measurable.

## 10. Adapt existing PRs, without restarting the work

The source assessment is [2026-10-06-dot-autonomy-adaptation-review.md](../plans/2026-10-06-dot-autonomy-adaptation-review.md). Its AIF/runtime recommendation is superseded; its pinned source observations remain historical evidence. The inspected heads were #2055 b5459ae893bdd69d6599b2b37ec2e753927c5d02 and #2056 bae5a627b4b6b2fe2813dd7b936093a6f7481c8a. Implementation owners refresh live heads/checks through gh and preserve work already in flight. This document does not certify those PRs or current CI.

| Lane | Deliverable |
| --- | --- |
| #2055, docs/contract | Reconcile old declaring design/protocol and CLAUDE.md self-merge instruction with a scoped managed-PR exception; V2 schema and role-specific operational instructions; pre-PR review receipt and closure contracts; enrollment/assisted/autonomous distinctions; bounded report examples and operator guidance |
| #2056, mechanisms | Separate report acceptance from admission; migrate persistence; connect queue/outbox/publication and Claude Code adapters; ownership, receipts, recovery, historical revalidation and budgets; executable offline and destination acceptance |

Reuse strict parsing, authenticated intake, revision binding, persistent transactions/outbox, readiness checks and separated publisher/armer where they satisfy the new contract. Extend them rather than replacing the entire implementation. Repair the source-traced valid-negative-report rejection with a real composed test. The previous service/event wiring and finding lifecycle were not demonstrated complete; component definitions alone are insufficient.

Both lanes use the same schema version/digest. Stage declaring-document supersession, compatibility handling and fixture changes together; validators must not accidentally interpret V2 as V1. Old reports remain readable. No shipped artifact is removed without a consumer map. Keep any current-staging additions during merge-forward integration. No .claude/settings.json change is part of these lanes.

This file is a proposed shared specification, not a dispatch packet. Before dispatch, supply each existing session the agreed version in a remotely accessible artifact, exact lane ownership, dependency revision and return criteria. Prepare implementation kickoffs after specification review; do not create duplicate PRs or new sessions merely to pass these instructions.

## 11. Acceptance evidence

Implementation acceptance uses the real composition and meaningful paired positive/negative scenarios. Mocks are suitable for repeatable fault injection but cannot establish platform integration.

| Scenario | Required observable result |
| --- | --- |
| Valid COMPLETE/REVISE, PARTIAL/REVISE, DECISION_REQUIRED and historical results | Durable receipts and correct routing; no merge success for ineligible reports |
| Forged identity, malformed/duplicate-key JSON, wrong assignment and replay | Rejection or idempotent prior receipt as appropriate; no extra task or admission |
| Assigned review completes after head/base moves | Immutable superseded archive; no current GO; applicability check before fixes |
| Existing pre-PR review covers the delivered scope | Evidence reused; no redundant mandatory full review |
| Missing/tautological/stale review evidence or material uncovered delta | Sufficiency gap routed to scoped review; approval label cannot close it |
| All paths disposed but a required system dimension omitted or unjustifiably excluded | Coverage is PARTIAL/rejected as invalid as appropriate; no GO admission from path accounting alone |
| Duplicate event/message, crash before acknowledgement or after remote publication | One durable action/owner; reconciliation recovers receipt without duplicating work |
| Worker stalls; old worker returns after recovery | Existing CC messaging wakes it; replacement obeys cessation/fencing rules; stale fix cannot silently become accepted work |
| Claimed fix with failing checks, stale reviewer evidence or unresolved system finding | Finding remains unresolved and merge stays ineligible |
| Independent verified fix and applicable Dot closure | Correct lineage resolved at verified revision, with closure receipts |
| Historical finding already fixed / still present | No new fix for already-fixed case; one linked remediation PR for present case |
| Restart, new historical arrival, protocol migration and recurrence | Queue resumes without silent skips/duplicates; history preserved; recurrence retains lineage |
| Bounds exhausted; actual monitor wakes inference on empty poll | Dispatch/merge pause enforced; consumption distinction documented; no paid fallback |
| Dependencies, base movement, pause and native auto-merge | Required ordering/freshness and suspension demonstrated; no unsupported revocation claim |
| Registered executor uses its former CI-green merge/arming path | No side effect while coordinator policy/dependencies hold; direct-write bypass prevents autonomous-merge enrollment |

For live acceptance, publish a receipt bundle with exact artifact revisions, destination, invocation, timestamps, identities, report/finding/action IDs and outcomes. Demonstrate: real unattended Dot dispatch and report capture; full machine report publication and CC read; assignment/acknowledgement; one correction; mechanical and existing change-review verification; targeted Dot closure; coordinator restart; and wake/stall recovery. This cycle must occur through the deployed route, not by manually copying report text. Use an approved bounded test PR; keep merge off until its separate acceptance.

If an integration prerequisite is unavailable, deliver tested offline mechanics and mark only the corresponding live capability unverified/blocked. Report `ASSISTED` honestly instead of treating an offline matrix as autonomous success. Source-level inspection, fixture success, publication and live closure are separate evidence levels.

## 12. Design provenance and completion

Design inputs are the operator's accepted role split, the existing pilot, the pinned PR adaptation assessment, and the completed [prior-art note](../../meta-factory/2026-10-06-dot-autonomy-prior-art.md). No new research is required to author this specification. Reuse the existing Claude Code workflow and #2056 mechanics; build only the project-specific contract/lifecycle connections. Prior-art platform comparisons do not reopen the selected runtime.

Specification completion requires a cold reader to challenge responsibility boundaries, real delivery assumptions, pre-PR evidence reuse, history, races, closure, economy and implementability. Record substantive findings and their dispositions beside this file. Operator review precedes implementation packets; this authoring task does not install, dispatch, schedule, push or merge anything.
