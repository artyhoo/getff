# Dot autonomy — adaptation assessment of PRs #2055 and #2056

> **Status:** source-based assessment and proposed adaptation sequence, 2026-10-06 Europe/Moscow. No implementation, deployment or merge approval.
> **Authoritative for:** this inspection's pinned evidence, compatibility map and remaining integration questions.
> **NOT authoritative for:** project goal — [README](../../../README.md#why-this-exists); an approved replacement protocol, live configuration, billing, model attestation or merge permissions.
> **Current task:** adapt the chosen system-level Dot PR review and its result processing. Running another PR-review queue is not this task.

## 1. Revisions and method

Read live metadata with `gh pr view`, and staging/PR state with read-only `gh api`. Inspect immutable Git objects, not the worker's working tree.

| Object | Pinned revision / comparison | Observation |
| --- | --- | --- |
| Staging | `c4532e16aa369ef3c66e227dd59d8ceef9e60263` | Live ref confirmed |
| [#2055](https://github.com/artyhoo/getff/pull/2055) | Head `b5459ae893bdd69d6599b2b37ec2e753927c5d02`; merge-base with staging is staging itself | OPEN, non-draft, BLOCKED; 8 changed paths; head unchanged at final read |
| [#2056](https://github.com/artyhoo/getff/pull/2056) | Head `bae5a627b4b6b2fe2813dd7b936093a6f7481c8a`; merge-base `9d43937189d96f1b9e18e682c11f310ead0dfbcd` | OPEN, non-draft, BLOCKED; 31 changed paths; head unchanged at final read |
| #2056 synthetic merge | API `merge_commit_sha=6660ff48cfd756f3460cef4559d1cd26855567c8` | Supplemental metadata only; tree/parents/execution not verified |

Both API base tips were staging above. #2056's actual diff starts at its older merge-base. Comparing head directly with current staging appears to remove four recently added installer-test invocations; the actual PR patch does not remove them. Preserve current staging's additions during integration; do not misreport branch age as an intentional test removal.

Since the previous #2056 snapshot `eba3a150daab2ae1cfe88912e240ad736f4602e3`, two commits move the S0 evidence patch to the docs lane, adjust counts and remove cross-lane matrix links. Gate implementation files are unchanged. #2056's body still alleges an invented REST arming route in the docs lane; the pinned #2055 handoff already specifies GraphQL at [lines 68–70][handoff-armer]. That warning is stale.

Final rollup: #2055 had 25 successes, 14 cancellations, 11 skips and one unfinished record. #2056 had 27 successes, one failure, one skip and 27 unfinished records. In particular, [Dot gate suites failed](https://github.com/artyhoo/getff/actions/runs/37374472348/job/111982893688). `gh run view --job 111982893688 --log` refused logs because the overall run was still in progress; failure cause remains UNVERIFIED. Rollups are moving observations, not required-check qualification or evidence that 197 arms ran successfully.

Evidence levels here: STATIC and SOURCE-TRACED, plus observed GitHub check metadata. No repository scripts, imports, tests, installer, service or model calls were executed. No remote writes, worker messages, schedules or settings changes occurred. This is a compatibility inspection, not a comprehensive code/security/test review of either PR.

## 2. Behavioral reference and responsibility boundary

The operator selected the review approach demonstrated by:

- Original pilot prompt: `/Users/art/.codex/attachments/52290f00-9948-496c-81ec-1c442523cdca/Pasted text.txt`.
- Pilot result: `/Users/art/.codex/attachments/6275ee04-dc80-43bf-af1a-e6d07347dd36/Pasted text.txt`.
- Durable role reference: [pilot prompt](../../meta-factory/dot-pr-pilot-PROMPT.md).

Tooling checks deterministic behavior. The change reviewer assesses correctness, test quality/completeness, false positives/negatives, tautology, maintainability and local design. Dot assesses goal/overall architecture, AI-documentation coherence, skill routing, portability, context economy, enforcement ownership and adequacy of specialist review evidence. Dot investigates implementation details when a concrete concern warrants it.

The pilot's four findings illustrate this boundary: conflicting consumer-goal pointers; promised but undelivered Cargo/Go agent capabilities; a whole-document D6 search that misses region semantics; and legacy Python refresh omitting runner migration. Their identifiers and source evidence are useful fixture material. This inspection does not independently reproduce their installation behavior or adjudicate current applicability.

## 3. What to retain, adapt and complete

REUSE means retain a relevant mechanism and verify it; it does not certify current correctness or deployment. ADAPT means preserve the purpose but revise its contract. COMPLETE means missing work needed for the intended autonomous flow.

| Surface | Classification | Retain / change | Evidence |
| --- | --- | --- | --- |
| Strict JSON reader, limits, duplicate-key rejection | REUSE | Keep raw-byte parsing and bounded input; retain adversarial tests | [strict-json.mjs][strict] |
| Authenticated intake identity and one-use challenges | REUSE + ADAPT | Keep enrollment, authenticated principal, tuple/reviewer/lease binding; separate report acceptance from admission | [intake 160–231][intake-submit], [ledger 306–363][ledger-submit] |
| Tuple digests, epochs, superseding, transactional report/outbox | REUSE + EXTEND | Keep freshness/history/crash foundations; add finding, assignment, resolution and checkpoint state | [ledger 31–107][ledger-schema], [115–127][ledger-tuple], [306–363][ledger-submit] |
| Mechanical readiness | REUSE + ADAPT | Preserve expected App/workflow/revision/current-run checks and exclusion of Dot contexts. Add explicit mode/queue qualification; reconcile actual policy | [readiness][readiness], [policy loader][policy-loader] |
| Publisher | REUSE + ADAPT | Keep trusted stored bytes, digest/current-state reread and M-bound admission. Consume a separate admission decision; negative reports remain processable | [publisher 61–163][publisher] |
| Reporter | REUSE + CONNECT | Keep feedback helpers and open-PR/no-duplicate-issue intent; wire authenticated results, receipts, recovery and revised rendering | [reporter][reporter] |
| Armer/native admission safeguards | REUSE, live behavior UNVERIFIED | Keep separation from Dot, GraphQL arming and freshness/pause concerns. Integrate only after actual native proofs and admission policy | [armer][armer], [design §6][design-freshness] |
| Operating protocol / design / both kickoffs | ADAPT | Replace exhaustive specialist duplication and full-baseline prerequisite with chosen system review; distinguish pilot from operational mode | [protocol 49–97][protocol-scope], [design 11–21][design-intent] |
| Result schema / policy / validator / fixtures | ADAPT TOGETHER | Version the change; express role-owned evidence and distinct coverage/sufficiency/execution axes. Retain trusted inventories and identity checks | [schema][schema], [validator][validator] |
| Finding correction lifecycle | COMPLETE with existing execution primitives | Add thin coordinator adapter and durable linking from finding to assignment, fix, specialist verification and closure | [service][service], [AIF answer][aif-answer] |
| Browser queue/forms, read/checkpoint/report-store routes and deployment entry | COMPLETE or identify existing external owner | JSON handlers and in-process composition do not provide the documented browser portal or production startup | [intake routes][intake], [service][service], [protocol delivery][protocol-delivery] |
| Event discovery, historical cursor, wake scheduling | COMPLETE | Consume events into actual queues; coalesce changes and persist cursor; prove a real supported Dot wake route | [service 104–117][service-events] |
| Allowance/cost control and operating receipts | COMPLETE / UNVERIFIED | Attempts and leases are useful controls but do not enforce aggregate monthly limits, prevent every paid route or measure capacity | [policy template][policy-template], [setup manifest][handoff] |
| Existing offline suites and aggregate CI wiring | REUSE + EXTEND + VERIFY | Preserve wiring and harness; add negative-report/fix-loop/closure scenarios and resolve current suite failure | [workflow][workflow], [suite harness][harness] |

## 4. Concrete breaks in the current flow

### A1 — Negative reviews cannot reach the composed result archive

**SOURCE-TRACED, high priority; also contradicts the old specification.** The design [§7][design-contract] explicitly says a valid REVISE/STOP/INCOMPLETE report is archived and produces failure. The composed service passes `currentState` into `validateReport` at [service 77–83][service-validation]. That validator adds `E_NOT_AUTHORIZING` for any admission other than GO/COMPLETE at [88–102][validator-admission]. Intake returns 422 for `!verdict.ok` at [206–209][intake-validation], before `ledger.submitReport` at 214.

Failure scenario: an enrolled Dot completes its current review and submits a schema-valid REVISE with a real blocking finding. The validator treats the absence of merge authorization as invalid intake; no report receipt/outbox row reaches correction processing. The publisher's later non-authorizing-result branch cannot recover a report intake never stores.

Smallest architectural correction: distinguish format/authentication/identity acceptance from admission evaluation. A valid negative or partial review receives a durable receipt and can trigger corrective work; malformed or forged submissions remain rejected. Admission stays denied. Historical results need a separate applicable identity/readiness contract rather than being passed through open-PR admission checks.

Required verification: real schema + validator + intake + ledger + consumer, not a stub `ok:true` validator. Cover COMPLETE/REVISE, PARTIAL/REVISE, STOP/decision-needed and historical results; assert archive receipt and corrective routing with no success admission. Pair with malformed/forged/stale rejection. Admission naming and partial-status migration must be decided in the revised version.

### A2 — Publication and executor processing are not composed

**SOURCE-TRACED.** Service imports intake/readiness/ledger/publisher, but no reporter, armer or executor. Its drain processes only `report.submitted`; other events, including `github.event`, are marked published without a queue/discovery effect at [104–117][service-events]. A full-tree `git grep` at pinned #2056 found no non-test callers of `createGateService`, `drainOutbox`, `upsertSummaryComment` or `armAutoMerge` beyond their definitions. An external deployment may call them, but no deployment receipt establishes that here.

Failure scenario: a negative result has somehow been stored, or a new qualifying PR event arrives. Component tests can pass, while no named consumer assigns a fix or wakes a review. Posting a summary alone would still not prove executor delivery or correction.

Complete the runtime adapter, consumer registry, startup/supervision and independent side-effect receipts. A dropped notification must be recoverable by querying durable pending work. Unknown/unhandled events need a defined disposition; “drained” cannot silently stand in for completed work.

### A3 — The ledger stores reports, not the correction lifecycle

**STATIC / SOURCE-TRACED.** [DDL][ledger-schema] has generations, challenges, reports, outbox, side effects and control; findings reside inside report payloads. There is no demonstrated persisted finding assignment, executor acknowledgement, fix revision, specialist receipt or closure transition. The generation transition table is insufficient: BLOCKED is terminal, and publishing does not invoke the declared VALIDATING/AUTHORIZED transitions in the inspected service.

Failure scenario: a fix is pushed after a report, then a worker or coordinator restarts. Neither a comment marker nor the report's original stable ID records which executor accepted the work or what evidence closed each concern. A new head invalidates admission evidence but must not erase the finding's history.

Extend durable state, preferably within the existing ledger boundary, with finding identity/cause lineage, report occurrences, assignment status, execution/task/PR identity, revisions, fix/verification/closure receipts and unresolved decisions. Retain original reports as immutable history. A rejected or superseded admission generation may still have actionable findings; correctness of that routing needs explicit rules.

### A4 — The contract describes the old reviewer

**STATIC.** [Protocol 53–73][protocol-scope] requires detailed correctness/tests/security assessments for all dimensions. [91–93][protocol-history] gates historical work on a COMPLETE baseline. The schema requires exactly eleven dimensions and only the three file dispositions at [584–603][schema-files]; there is no representation of a path covered by a scoped specialist receipt or outside Dot's declared review responsibility.

The intended fix is accountable scope, not deleting coverage. Each changed path remains inventoried and has a treatment/rationale; relevant specialist evidence has immutable scope/revision/identity/limitations. Absent or stale specialist evidence remains visible and can block admission by policy. Dot can complete its declared semantic scope while separately reporting missing specialist/runtime evidence.

Update protocol, design, both kickoffs, schema, policy inventories, validator, fixtures, reporter and pin promotion together. Choose an explicit new protocol version; reject accidental mixing with 1.0. A protocol version/digest does not establish model identity or semantic review quality.

### A5 — The documented portal, durable read path and report reference are unfinished

**SOURCE-TRACED for this PR; external implementation UNVERIFIED.** Intake exposes OAuth start/callback, JSON `/claim` and `/submit`, webhook and health, binding to loopback with an ephemeral port. It has no browser claim/submission form, queue/read-by-review-id/checkpoint/upload route. The [protocol][protocol-delivery] requires report upload/reference/hash, checkpoint/resume and receipt reconciliation. The report-store reference is not fetched/verified by the inspected validator. Service silently permits an in-memory ledger when no path is supplied.

Complete a supported Dot-facing carrier and authenticated bounded read/checkpoint/report-store operations, or name and verify an existing owner. Production startup must require durable storage and a valid service configuration. Keep secrets in the service environment; expose review data as data, not executable worker instructions. Demonstrate real Dot login, unattended submission, restart and receipt read-back before calling this operational.

### A6 — Leases and per-tuple attempts do not bound month-long consumption

**STATIC; actual account allowance UNVERIFIED.** The [template][policy-template] provides active claims, attempts per tuple, lease and authorization expiry. Every materially new head changes the tuple; per-tuple limits therefore do not bound total reviews/rework over a month. The template also omits the workflow paths that [loadPolicy 54–58][policy-loader] requires. Filling UNRESOLVED values alone is insufficient configuration.

Add policy-owned aggregate run/rework limits, trusted usage/reset observations where actually available, unknown-allowance behavior, coalescing and applicable-evidence reuse. Use deterministic discovery rather than unchanged-state LLM polling. No invented token ceiling, fixed reset, unlimited Astra claim or billing guarantee. Establish hosting, persistent storage and native wake integration within existing authorized free/included resources; account configuration and measured workload must support the claim.

## 5. Existing execution capability: use an adapter

Sources at current staging, distinct from the two PR heads:

- [Prior-art #64](../../meta-factory/prior-art-evaluations.md): SDD owns the inner executor/spec-review/code-review loop. #111 and [.claude/skills/dispatcher](../../../.claude/skills/dispatcher/SKILL.md) own the AIF execution substrate. Night-mode layers autonomy policy; it is not another dispatcher.
- [answer.ts 27–35][aif-answer]: `request_changes` attaches feedback then drives done → implementing; `request_review_changes` is the review-state route. State/owner/capability guards at [299–311][aif-guard] matter; a generic event cannot be assumed valid for every task.
- [pushAnswer 363–396][aif-push] demonstrates the comment-then-event sequence. It does not provide transactionally deduplicated Dot assignment, finding closure or a remote Dot integration by itself.
- `dispatch.ts`, `AifHandoffBackend.ts` and dispatcher primitive documentation identify existing task creation/manual fallback. A returned fallback document is not proof that a worker started.

Recommended residue: a trusted coordinator-side adapter reads validated pending review/finding records, maps the PR to its real owner/task, supplies bounded correction context and chooses the existing state-appropriate execution route. Dot reads source and submits reviews; the coordinator/executor with workspace access owns fixes. Dot need not access the local computer. If the coordinator is local, a verified outbound authenticated read can avoid exposing a local endpoint to Dot; that is a proposed topology, not a presently configured route.

The adapter must persist an assignment/idempotency key before external delivery, reconcile acknowledgements after crashes, guard repeated comment/event delivery and preserve task state. A merged historical defect needs a remediation branch/task, not reopening an already merged branch under an unexamined event. No action was dispatched in this assessment.

## 6. Proposed result and acceptance boundaries

Use a versioned structured record as authoritative data and derive the concise operator report from it. Suggested field groups, not an approved schema:

| Group | Required meaning |
| --- | --- |
| Review identity | PR/repository, base/head/comparison basis, merge/current-staging identities where relevant, review ID, protocol/policy, authenticated envelope |
| Scope and evidence | Declared system-review scope; per-path treatment; coverage; specialist-review sufficiency; execution certainty; omissions and unresolved questions |
| Findings | Stable ID/cause lineage; category/severity; governing requirement; explicit failure scenario; location; affected consumer; evidence level/uncertainty; correction and verification expectations |
| Specialist receipts | Immutable artifact/reference/digest, reviewer provenance limit, reviewed scope/revision, material changes after review, resolution evidence |
| Correction state | Separate service-owned assignment, task/fix revision, mechanical/specialist receipts and closure decision; Dot cannot self-assert executor success |
| Admission decision | Derived separately from current valid review, current mechanics, required specialist evidence, unresolved blockers/decisions, trusted policy and native configuration |

Reports may be COMPLETE with defects; PARTIAL reports can carry actionable findings. A source trace must remain a source trace after normalization. A semantic GO does not independently grant merge permission. Do not turn every unresolved runtime claim into endless re-execution of the entire repository.

Protocol/policy and result publication may be separate trust boundaries, while operator rendering and structured data share one verdict source. PR text/report contents cannot widen worker permissions. Consequential goal/security/spend/policy decisions stay escalated; ordinary in-scope corrections need a defined autonomous owner.

## 7. Adaptation sequence and proof of completion

1. Reconcile the declaring design/protocol against the accepted pilot. Produce the versioned responsibility/result contract and the migration/pin rules. Preserve mechanical coverage and existing authentication/freshness obligations.
2. Repair negative-report acceptance (A1) and extend meaningful integration fixtures. Use the four pilot findings as sample review content, with their original evidence limits; fixture normalization is not proof the bugs still exist.
3. Extend ledger/read APIs and implement a thin finding/coordinator adapter. Prove assignment receipt, crash recovery, state-appropriate rework, specialist receipt and per-finding closure. Wire reporter and event discovery as real consumers.
4. Complete the actual Dot submission/read/wake route, production entry/configuration/storage, policy template and allowance controls. Keep orchestration outside paid LLM CI.
5. Observe one complete autonomous correction cycle before enabling admission. Acceptance scenarios must include: negative and partial reviews accepted but never authorized; stale/forged input rejected; duplicate delivery does not duplicate tasks; loss after remote acknowledgement recovers; a claimed fix still failing tests remains open; fresh tests plus stale specialist review does not close; unresolved strategic decision pauses that work; closed findings reappear with lineage; historical already-fixed findings do not create work; exhaustion stops new model work without paid fallback.
6. Verify separately any eventual native admission/arming policy, including current-M binding, base movement, same-M policy/lifecycle changes, SHA aliases and native pause. Correction processing may be observed without first claiming live merge-gate safety. No live admission is inferred from this report.

**Recommendation:** retain #2056's reusable mechanics, adapt both PRs as one coordinated contract change, and add the missing correction adapter/lifecycle and operating route. Do not merge unchanged documents as the final autonomous contract. The current suite failure and absence of live receipts also preclude claiming operational acceptance. No exhaustive implementation or test-quality review is replaced by this assessment.

[strict]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/strict-json.mjs
[intake]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/intake.mjs
[intake-submit]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/intake.mjs#L160
[intake-validation]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/intake.mjs#L206
[ledger-schema]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/ledger.mjs#L31
[ledger-tuple]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/ledger.mjs#L115
[ledger-submit]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/ledger.mjs#L306
[readiness]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/readiness.mjs
[policy-loader]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/load-policy.mjs#L25
[publisher]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/publisher.mjs#L61
[reporter]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/reporter.mjs
[armer]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/armer.mjs#L52
[service]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/service.mjs
[service-events]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/service.mjs#L104
[service-validation]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/service.mjs#L77
[validator]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/validate-report.mjs
[validator-admission]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/validate-report.mjs#L88
[policy-template]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/policy/trusted-policy.template.json
[workflow]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/.github/workflows/audit-self.yml#L2857
[harness]: https://github.com/artyhoo/getff/blob/bae5a627b4b6b2fe2813dd7b936093a6f7481c8a/scripts/dot-review-gate/suite-harness.sh
[protocol-scope]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-protocol.md#L49
[protocol-history]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-protocol.md#L89
[protocol-delivery]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-protocol.md#L99
[schema]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-result.schema.json
[schema-files]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-result.schema.json#L584
[handoff]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-handoff.md#L8
[handoff-armer]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/meta-factory/dot-review-handoff.md#L68
[design-intent]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md#L11
[design-freshness]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md#L109
[design-contract]: https://github.com/artyhoo/getff/blob/b5459ae893bdd69d6599b2b37ec2e753927c5d02/docs/superpowers/specs/2026-10-05-dot-staging-review-gate-design.md#L143
[aif-answer]: https://github.com/artyhoo/getff/blob/c4532e16aa369ef3c66e227dd59d8ceef9e60263/packages/runtime-bridge/src/cli/answer.ts#L27
[aif-guard]: https://github.com/artyhoo/getff/blob/c4532e16aa369ef3c66e227dd59d8ceef9e60263/packages/runtime-bridge/src/cli/answer.ts#L299
[aif-push]: https://github.com/artyhoo/getff/blob/c4532e16aa369ef3c66e227dd59d8ceef9e60263/packages/runtime-bridge/src/cli/answer.ts#L363
