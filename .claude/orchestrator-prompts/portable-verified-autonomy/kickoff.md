# Portable verified autonomy — first-host implementation kickoff

> **Status:** revised candidate awaiting exact-content reviews, current agreement/authority and reviewed staging publication; not dispatched.
> **Type:** execution-build + host wiring; sequential umbrella.
> **Rigor label (L0):** `build-and-verify`.
> **Feature:** `portable-verified-autonomy`.
> **Authoritative for:** S1/S2 implementation scope, stage dependency order, deliverables and acceptance below.
> **NOT authoritative for:** changing product promises, host qualification, new spending, global permissions, managed-PR merge ownership or main promotion.

## §0 Authority, objective and launch boundary

Complete the existing getff pipeline's routine transitions without the operator copying results or repeatedly waking an owner. OpenMausBot supplies native sessions, child returns and recurring recovery attempts. getff retains intent, acceptance and delivery meaning. AIF retains admitted execution and internal review/rework. The PC is the execution/control server in its qualified durable D-backed layer; the authenticated laptop is a remote client that may close. The supported PC environment must recover without duplicate work.

Historical baseline evidence follows. Current authority for this revised candidate must be established through the protocol below, independently of editable kickoff prose:

- Approved [PRD](../../../docs/superpowers/specs/2026-10-26-portable-verified-autonomy-prd.md): SHA256 `ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721`; all PA1–PA9 remain essential.
- Historical agreed Mac [design](../../../docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md), not authority for this revised candidate: SHA256 `d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c`; preserved [snapshot](../../../docs/superpowers/specs/snapshots/portable-verified-autonomy/design-d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c.md).
- Historical Mac [spec agreement](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/spec-agreement.md): operator requested kickoff preparation after the reviewed-spec presentation; selector advanced from revision 1 to 2 and plan-prep passed for those bytes. Neither that selector nor the old agreement authorizes this revised candidate or PC identity; use the new exact-content protocol before execution.
- [Research distillate](../../../docs/superpowers/research/portable-verified-autonomy/2026-10-26/distillate.md), [K-pass](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/research-kpass.md) and [separate architecture verdicts](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/architecture-review-status.md). These are design evidence, not operational receipts.
- [Operator decisions](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/arch-decisions.md): host-managed sessions, existing pipeline, real getff trial, OpenMaus first, AIF allowed, P19 PC-server placement superseding laptop-first for B onward, and installed Hy-Memory verification/configuration required.

**Preparation only:** this kickoff has no automatic-dispatch marker. Do not create a live task, enroll a routine, install/configure a host or start model sessions merely because this file was written. Before future dispatch, publish the kickoff **and its exact authority/evidence closure** through a reviewed PR to `staging`; then select the existing pipeline/AIF channel under its normal grants. A local path or review-only Git ref is not a published dispatch input. Use [kickoff staging-placement](../../../.agents/rules/kickoff-staging-placement.md).

**Routing:** the 5 November native execution authority assigns Sol planning/review/acceptance, actual Terra 6.1/xhigh implementation, and Luna exact-job CI. This is distinct from the historical uninstalled OpenMaus/standalone-runtime engine mapping; B must qualify a compatible actual mechanism without GLM continuation or an invented A1 worker conversion. No fallback or live qualification is implied. The no-AIF exception belonged only to the completed research.

Before execution, read README → `.agents/session-bootstrap.md` → CLAUDE.md → this kickoff → exact design and referenced task procedures. Resolve the actual coordination home with `.agents/procedures/pipeline/helpers/print-orch-home.sh`. Do not copy private maintainer state into a consumer or container.

## §1 Scope, reuse and implementation surfaces

Retain current intent/arch/pipeline, runtime-bridge/AIF admission and claims, PlanReview, bounded observation, harvest, product-only advisor publication/current-result validation, applicable technical reviews and registered Dot ownership. Reuse these implementations before extending them. Native run completion is an attempt result; getff acceptance and authorized delivery remain separate.

Proposed new glue is deliberately bounded:

- `.agents/procedures/pipeline/helpers/autonomy-binding.mjs`: one-shot reconciliation, relationship record, local serialization, process/session custody, routing, effective controls and exact artifact return. Operations follow the design: reconcile, worker, review, status, pause, cancel and resume. No daemon, scheduler, general coordinator, model router or replacement memory backend.
- `.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs`: deterministic contract/failure tests using the existing validator interfaces where applicable, not copies of their semantics.
- `.agents/procedures/pipeline/references/openmaus-binding.md`: ordinary-routine setup, permissions/readback, worker/reviewer launch, recovery, controls, limits and installed-memory setup/rollback.
- `scripts/autonomy-acceptance.mjs`: scoped host acceptance harness and receipt verification. Its CLI/receipt implementation is new work, not an existing tool. Keep it out of runtime coordination. Live experiments are session-run only; deterministic receipt/schema tests may run in CI without model calls.
- `setup.d/ships.manifest`, relevant installer/discovery tests and `packages/core/templates/templates.manifest.json`: ship the actual transitive helper/procedure/role closure through the appropriate existing profile. Env must not claim bundled AIF when it lacks the factory runtime; advertise the recipe's actual prerequisite/profile.
- Task-local `autonomy-binding.json`, immutable reports and live receipts under the bound stage artifact root. Host IDs, accounts, paths and instance configuration remain local, never template defaults.

The execution plan must enumerate exact existing helper APIs, affected files, tests, dependencies and verified lock/CLI primitives before editing; do not write a second validator. Related changes outside this closure require a concrete necessity tied to this design; unrelated cleanup becomes an observation. Before adding any new watched template/role/rule path, inspect its structural principle-test obligations/allowlists. Preserve every existing artifact unless an approved consumer/migration analysis permits retirement.

Prior art is already captured at OpenMaus `3ac9fb1122a34b2755580d3d5d7cbd1a1a77bd4b`, field notes `02780c04ef5f412b28573bce6f82afd15d195d1f`, Hy-Memory `e9cce69650107c2562b299b62bd048805b6a73cd` and the research register. Local CLI help is captured in [local-cli-surface.md](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/local-cli-surface.md). Reverify installation-sensitive contracts on the actual host; do not reopen the whole research survey or promote captured help to runtime acceptance. Capability commits still owe the current build-vs-reuse/SSOT and §1.7 evidence requirements.

## §2 Sub-wave decomposition

| Sub-wave | Type | Depends on | Parallel-with | Design slice | Deliverable and exit |
| --- | --- | --- | --- | --- | --- |
| A | execution-build | — | — | S1 | One-shot binding/state/control and deterministic adverse-case tests; current validators reused; exact branch/custody/effect semantics reviewed |
| B | execution-build + wiring | A | — | S1 | Stock OpenMaus routine, separate CLI worker, isolated external product review, consumer delivery closure and actual Q1/Q2 host receipts |
| C | wiring + manual-liveness | B | — | S2 prerequisite | Installed Hy-Memory endpoint/cost/scope binding, configured permitted experience access, isolated M4 and real successor-use readiness |
| D | execution-build + manual-liveness | C | — | S2 | One useful existing getff task completes the actual finding/correction/recheck/destination cycle; observed memory succession and effort baseline/report |

All stages are sequential because their custody/configuration and helper surfaces overlap. This table is the route, not four simultaneous workers. Each stage gets a bounded plan/current enforcing contract and distinct candidate/receipt identities under existing admission. A standalone pipeline worker holds the execution checkout and correction custody; campaign coordinators do not substitute in-session agents for that worker.

### Stage A — durable identity, ownership and controls

- Bind repository, feature/stage and independently selected current authority to the stage-local relationship record; record permitted actions/destination, host routine/native attempt, AIF claim/task, CLI session/process identity, custody generation, candidate, next action, review and delivery receipts.
- Reuse existing subsystem claim/lookup mechanisms. Implement only the missing local serialization/atomic durable-write binding; an expired lock/wait is never proof that another worker ceased.
- Persist spawn/action intent before effects; reconcile uncertain session/submission/publication/delivery before retry. Reject stale generation/candidate reports. Do not promise distributed exactly-once effects.
- Implement inspectable status and monotonic pause/cancel/resume. Pause/cancel blocks new admission and requests underlying cessation; show pending until actual acknowledgement. Late results/restart cannot undo deliberate business control. No implicit rollback of completed effects.
- Test duplicate native reports, overlapping attempts, spawn-intent crash, lost receipt, stale authority/candidate, late result after pause/cancel, uncertain live worker and effect boundary rechecks. Assert prohibited effects did not occur, not just a matching status string.
- Exit: code/tests reviewed for exact current candidate; actual staging merge required before B. A deterministic green does not certify native-host behavior.

### Stage B — stock host, CLI return, product review and packaging

- Qualify one ordinary recurring routine (five-minute initial schedule plus startup reconciliation) with the permitted execution profile; reject the mail/calendar read-and-draft profile for shell/AIF work. Confirm routine management/readback/disable is actually callable under normal grants before enrollment.
- Qualify native `coordinate_bots` new-thread/resume return and a separate scoped standalone worker with recorded actual UUID/cwd and REPORT prompt. The original Claude print/GLM routing was historical; it is not launch authority under the later native-role policy. Do not assume a Codex conversion of the A1 runtime worker. Resolve or explicitly hold the concrete compatibility seam in B while preserving PA4 and PA9. Resume only an exact stopped session and preserve normal authentication, hooks and denies; no bypass.
- Bound observation with the existing AIF await command (45 seconds); long work remains owned by AIF. Persist REPORT and review references before native return. Decode CLI JSON envelope and reject truncated/error/invalid payloads. Lost native returns recover from the record without replaying the effect.
- Healthy unchanged AIF work never consumes the recovery-error budget or disables intake. After twelve healthy checks, back off to thirty minutes while preserving automatic result consumption. Confirmed recovery failures use their separate budget and scheduled prerequisite reconciliation; quota holds retain reset-aware retries. Count no-op model turns. Only explicit business pause/cancel or verified authorized completion retires the routine.
- Launch each product comparison in a fresh external CLI session with only immutable allowed inputs and raw observations. Inventory actual instruction/plugin/MCP/auto-memory injection. Exclude team/author memory and unrelated-project sentinels while preserving mandatory policies. The reviewer may request additional evidence. Publish its existing ResultReview through the current stage-owner helper; independently select current authority/candidate and validate with `requirePublished: true`.
- Required Q1: force premature native success with pending getff obligations; reject false acceptance **and** automatically resume. Include parent interruption, app restart, result while disconnected, duplicate attempts, controls and a healthy execution finishing after the twelve-check threshold.
- Required Q2: actual injected-source inventory, forbidden-memory sentinels absent, approved inputs present, independently authored exact attempt returned/published/currently validated, plus lost-return recovery. A fresh-session flag or fixture-only test is insufficient.
- Package and exercise the installed helper/procedure closure in a clean disposable repository/profile. This is packaging smoke, not final PA6 consumer acceptance. Do not copy maintainer authority/coordination state.
- Exit: real qualified PC receipts, including laptop-disconnect evidence, discriminate the required failures, no competing owner, no manual result relay. If host control, isolation, eligible accounts or normal launch cannot satisfy the design, return the exact incompatibility to arch; do not silently patch OpenMaus or add a scheduler.

### Stage C — required installed Hy-Memory integration

- Verify the already installed runtime/version, actual endpoint/transport, account mode, readers/writers and project-scoping behavior using safe diagnostics. Installation metadata is not a live endpoint or continuity proof.
- Configure the existing supported local/MCP route for ordinary coordinator/worker experience under normal grants. Keep independent product review outside experience retrieval. No new subscription, API bill, embedding service or wholesale private-chat import.
- Run the accepted memory report's isolated M4 sequence: sourced S1 to successor; S2 supersedes S1; project-B decoy excluded; Q2 reviewer receives no forbidden memory; verify supported export/cleanup. Use disposable scoped fixtures and document their cleanup.
- If native source/correction fields are insufficient, canonical sourced lessons and supersession links remain repository artifacts indexed through Hy-Memory; do not invent native guarantees. A source-dependent task holds when necessary evidence is unavailable; ordinary memory outage cannot erase task custody.
- Record exact configuration changes and reversible rollback that preserves pre-existing memory. Unavailable protected/global configuration is an explicit prerequisite, not permission to disable policies. Do not replace installed Hy-Memory because connection qualification requires work.
- Exit: actual scoped continuity/correction/isolation and all required processing/retrieval costs fit eligible existing/free operation. Real task-specific successor use is demonstrated in D.

### Stage D — useful recursive self-application

- Select a real useful, ready, unfinished getff backlog task with approved scope, meaningful verification, observed handoff burden, no competing active owner and a reachable authorized destination. Existing in-flight/authority/stage gates must pass. Do not use infrastructure setup or a trivial fabricated change as the representative task.
- Before enrollment, record baseline conditions, normal operator relays/continuation/decision interventions and active supervision; separate setup, recovery, maintenance, blocked time and incremental costs. Do not backfill a convenient baseline after seeing the result.
- Run the existing pipeline/AIF cycle with a real or safely introduced bounded review finding, correction and fresh current-candidate recheck; complete the agreed destination without human message relays. Preserve distinct product, technical and applicable Dot review duties. A registered managed-PR coordinator retains merge/arming rights; never promote main.
- Exercise an owner interruption/recovery, stale or corrected information, genuine decision boundary and effective control using this task or separately identified qualified cases. Do not inject a destructive failure into unrelated real work.
- Record a concise real sourced lesson and demonstrate an authorized successor retrieving/using its applicable corrected version. Record actual cooperating environments/identities and task/candidate binding for PA4; changing two models in one host is insufficient for PA9.
- Publish an independently authored current ResultReview, its immutable observations, exact destination receipt and a PA1–PA9 evidence matrix. State remaining PA6/PA9 explicitly.
- Report observed total operator effort, setup separately, and labeled 1/5/10-cycle sensitivity/break-even only from measured data. No economic-success claim until a stated comparison horizon is accepted; the operator has not chosen that value boundary.
- Exit: accepted real result and full evidence, or a precise owned unresolved decision/prerequisite. A working demo with equal or greater supervision does not establish benefit.

## §3 grokbot-field-notes transfer is implementation scope

Consume the accepted [18-practice / 40-failure comparison](../../../docs/superpowers/research/portable-verified-autonomy/2026-10-26/field-notes-comparison.md), including existing/stronger/inapplicable dispositions. The notes are evidence of reported practices/failures, not a shipped bot or proof of native Grok capabilities. Preserve these links in plans, tests and reports:

| Source IDs | Required transfer | Implementation / evidence owner |
| --- | --- | --- |
| F-P11 | Reliable bounded workflow and failure recovery before routine enrollment | A negative tests; B Q1/Q2 before D enrollment |
| F-P16; F-A30/F-A34/F-A35 | Quiet result-driven continuation; bounded recovery checks; visible no-op cost | B native return/schedule/control cases; D wakeup, notification and quota accounting |
| F-P6 | Sourced experience, correction/supersession and scoped successor retrieval | C M4; D real corrected-lesson use |
| F-P13/F-P17; F-A38 | Accepted outcomes and reduced total operator effort | D comparable baseline, relays, setup/recovery/maintenance and result evidence |
| F-P1/F-P2/F-P3; F-A8/F-A10/F-A19 | Preserve stronger current getff meaningful checks and independent acceptance | A/B wrong/stale candidate rejection; D current evidence and finding/recheck |
| F-P4/F-P15; F-A6/F-A36/F-A37 | One accountable owner, scoped workers, exact receiving identity and durable return | A custody/generation tests; B interrupted owner and late-return tests |

Domain-specific UI/business failures remain applicable only when the selected task contains that domain. Do not import a permanent persona roster, replace canonical rules with the pack, or turn this work into OpenMaus setup alone. Every selected improvement must have a real implementation/evidence reference or an explicit unresolved gap in the final transfer matrix.

## §4 Gates, checks and delivery

Before future admission, run the canonical checks from the actual project root; resolve coordination home, never assume it matches this authoring checkout:

```bash
node .agents/procedures/intent/helpers/current-decisions.mjs --check-plan-prep --feature portable-verified-autonomy --spec docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md --orch-home "$(bash .agents/procedures/pipeline/helpers/print-orch-home.sh)"
SLUG=portable-verified-autonomy bash .agents/procedures/dispatcher/helpers/probe-inflight.sh
```

Run the late collision probe in the same turn as consequential publication/dispatch; preserve normal claims and managed-PR registration checks. PROBE-INCOMPLETE/LATE-COLLISION or an unknown owner holds the action. Do not run a new business stage from an old cached REPORT.

At every A→B→C→D transition read the actual predecessor PR/branch from the accepted stage record, then require its real staging merge:

```bash
: "${PREDECESSOR_BRANCH:?Set from the actual predecessor stage record}"
gh pr list --repo artyhoo/getff --state merged --base staging --head "$PREDECESSOR_BRANCH" --json number,headRefName,headRefOid,baseRefName,mergeCommit,mergedAt,url
```

The output must contain the exact recorded predecessor PR/head and a non-null merge commit into staging. Empty/mismatched output holds the dependent stage. Worker DONE, approved review or an open green PR is insufficient. Reconcile current staging and avoid competing owners before each stage.

**Host-verification contract** (future acceptance commands; the proposed test/harness paths must be implemented, not claimed to exist today):

```bash host-verify
node .agents/procedures/intent/helpers/current-decisions.mjs --check-plan-prep --feature portable-verified-autonomy --spec docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md --orch-home "$(bash .agents/procedures/pipeline/helpers/print-orch-home.sh)"
node --test .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs
node scripts/autonomy-acceptance.mjs --verify-receipts --root .claude/orchestrator-prompts/portable-verified-autonomy/evidence
make self-audit
```

Early-stage plans declare their exact applicable host checks; the umbrella contract above closes only after D. The new acceptance harness must distinguish real target-host receipts from fixtures/missing evidence and bind task/authority/candidate/environment/control/observation identities. It must reject missing Q1, Q2, M4, pilot, destination and cost receipts, stale-candidate evidence and fixture-only claims. Semantic independence remains the existing advisor's duty, not a JSON validator's declaration. No CI model calls, purchases or automatic live qualification.

Live B/C/D experiments run on the actual permitted PC execution layer and installations and retain sanitized commands, timestamps, raw observations, process/session identities, inputs and limits. Container tests or upstream source code cannot prove target-host return, review isolation or configured memory. A missing host prerequisite is an owned BLOCKED result, not fake green or a request for routine human relaying. Use `bash scripts/host-verify.sh portable-verified-autonomy` when its applicable implementation checks exist; its pass does not replace the independent product result review.

Every stage returns the existing standalone REPORT contract: Status DONE/PARTIAL/BLOCKED; actual stage/task, branch/PR/head/merge where applicable; observed commands and receipts; outstanding next action/owner; exact review references/digests; `ATTN:` lines for unresolved decisions. Preserve custody before exit. Fully specified in-scope post-harvest fixes stay with the existing branch owner; open design/product choices return through the applicable advisor route.

## §5 AI-traps active and recursive self-application

Read [ai-laziness-traps](../../../.agents/rules/ai-laziness-traps.md) and apply these concrete countermeasures:

- **T2/T3/T4/T10:** enumerate all selected practice transfers, lifecycle failure cases and PA evidence before claiming coverage; no happy-path-only sample or missing category disguised as completion.
- **T7/T8:** challenge actual premature-success/lost-return/late-control scenarios; resolve routine technical choices from current evidence without asking the operator to relay messages or repeat settled decisions.
- **T11/T12/T13/T16:** reuse verified getff/native interfaces, distinguish upstream problem from our obligation, and reverify mutable installed CLI/host facts; source availability is not deployed behavior.
- **T14/T19/T20:** no-finding/schema/CI green is not semantic acceptance. Exact cold review and current-candidate observations precede handoff and acceptance; cite real evidence and limitations.
- **T15:** apply the same rules to getff itself and to this binding's own records/receipt claims. The representative task must discriminate wrong/stale result and recovery failures, not just automate a consumer example.
- **T17/T18:** preserve source artifacts, existing memory and unique AIF/Dot/advisor behavior; no unapproved retirement, destructive cleanup or history migration.
- **T-AUT-A:** native successful turn/root is not product completion; force premature success and prove continued owned work.
- **T-AUT-B:** a disabled routine cannot receive late AIF output through an already-exited observer; healthy pending work retains scheduled intake beyond twelve unchanged checks.
- **T-AUT-C:** fresh reviewer session does not prove isolated context; record actual injections and reject forbidden sentinels.
- **T-AUT-D:** free source code does not imply free required inference/memory/hosting; account for every operation under actual eligible access.
- **T-AUT-E:** heterogeneous models do not prove host independence; PA9 stays open until a materially different host passes the same contract.

Self-application deliverable: the acceptance report evaluates its own completion claim against current authority, evidence source, exact candidate and all PA1–PA9; it records unproved cells and any discovered false-positive claim. New mechanically detectable obligations fail at their earliest reachable channel; judgment-only boundaries retain explicit reviewers rather than a pretend gate. Run meaningful counterexamples for each new gate and include the normal existing self-audit.

## §6 Stop conditions, deferred obligations and completion report

Hold an affected stage on current-authority mismatch, unresolved owner/effect, unsupported normal grants, Q1/Q2 failure, required memory isolation/cost failure, unavailable actual-host evidence or unmet real predecessor merge. Return a bounded failure and options through existing advisor/owner mechanisms. Do not silently change the selected host, add a host-runtime patch/scheduler/database, weaken review, raise spend or drop a promise. These are architecture/product return edges, not routine repair questions.

Implementation is within the agreed first-host S1/S2 boundary. S3 consumer cycle and S4 second coordination host remain **essential later work**, each with actual authority/access and host-specific design before implementation. Packaging smoke in B is not PA6. The first-host pilot is not whole-feature acceptance. No acceptable payback horizon or exact backlog task was invented by this kickoff.

Final report: exact delivered PRs/heads/merges/destination; PA1–PA9 observed/pending matrix; field-note practice→change→test/receipt matrix; owner/recovery/control cases; installed-memory setup, M4 and actual successor evidence; eligible execution/memory cost and no-op accounting; operator-effort comparison with setup/maintenance visible; remaining consumer/host/value decisions; honest DONE/PARTIAL/BLOCKED status. No rollout or feature-complete claim beyond the evidence.


## Deployment amendment — P19: PC as server (2026-10-28)

The operator selected the PC as the execution/control server and the laptop as its remote client, then instructed application. The design's P19 addendum governs B/C/D host placement and supersedes historical laptop-first wording. The original application was prepared during A1 repair; A1 is now accepted and normally merged to staging as `b97652833ba01dcfd58a1472b79a056e6f913716`, with post-push workflows separately pending or unresolved. This revised candidate must pass two-altitude artifact design review, fresh semantic intent spec-review against the approved PRD, genuine current presentation/agreement/current-authority protocol and reviewed staging publication before B admission. Do not copy Mac selector revision 2/`d820`, backdate, replay pre-mechanism paths or fabricate review or grants. No generic topology vote is pending.

B must run stock OpenMaus server/native coordinator plus the standalone getff/CLI control on the PC next to existing AIF. Use the actually qualified PC execution environment and endpoint namespace. Do not rely on a laptop tunnel for internal bot-to-AIF calls. Preserve normal CLI authentication/hooks/denials, independent review, one worker/custody, current-result acceptance and packaging. PC-first placement does not prove Windows/WSL/Linux qualification; unsupported mutation remains a prerequisite HOLD until qualified.

Add a real Q1 case: disconnect/close the laptop during admitted PC work; PC execution/result consumption and acceptance continue, then the laptop reconnects to the same persisted result without replay. Server-runtime restart, late result, duplicate attempts and pause/cancel remain required. The baseline routine/recovery policy is still subject to actual normal-grant qualification and measured no-op cost.

C must establish required installed Hy-Memory access from the PC, including its actual endpoint, project boundary, correction and reviewer isolation. Do not copy a private laptop store or assume it runs headlessly on the PC. An unmet dependency remains explicit. D runs the useful getff cycle on this qualified PC route and measures supervision/setup/recovery. Consumer and materially different host proof remain essential; moving one OpenMaus deployment to another machine does not satisfy PA9.

No installer/model/routine/service/network/security or source ownership change is performed by this amendment. The recorded A1 acceptance and actual staging merge remain the predecessor evidence; this candidate is not itself publication or B admission. No new daemon, scheduler, taskregistry, memoryproduct, publisher or mainmerge is authorized.

### B and C integration obligations for the revised candidate

- Before each new actual bot job, resolve fresh official latest-stable Codex metadata; install and qualify the selected stable version in an owned versioned PC tools location and pin its exact binary/version for that job. Preserve active processes, existing account/config/hooks/denies and rollback evidence. Inventory every actual retained launch route, including containers: a native update does not update a container image. Dated native `0.167.0` and legacy container `0.145.0` observations are not updater acceptance. Reuse supported update mechanisms after qualification; no prerelease, provider/model/account fallback, API billing or new monitoring daemon. Failure to resolve/install/qualify means a new-job readiness hold.
- B must bind actual D-backed durable storage, PC-local/container AIF endpoint, stock host, task identity and live no-duplicate return, restart, pause/cancel and laptop-disconnect evidence. Preserve existing authenticated bridge/wake, durable intake and safe-idle requirements; do not certify them from this document. Due-time wake must be qualified for admitted sleeping obligations.
- C must bind the existing Hy-Memory to the real bot/executor route using the actual PC endpoint, task/repository identity, permitted scope and durable state. M4 includes real-task useful sourced S1 saved and retrieved/used by a fresh successor, corrected S2 superseding S1, project-B decoy exclusion, independent Q2 without author memory, eligible/free processing and supported export/cleanup. No private-history/token copy, global import, alternate database or blanket installed claim. Missing required access is an explicit hold and must not silently depend on the laptop.
- PA1–PA9 remain essential; physical PC relocation alone does not prove PA9. B precedes C/M4, which precedes D. All actual host, wake, memory, account, launcher and runtime capabilities remain unverified until their own acceptance evidence exists.

### B/C/D pre-call egress boundary

Before any new external provider, model, memory or bot verification traffic in B, C or D, the PC preflight must bind the existing R3 egress decision to an actual current approved policy and qualified outbound route. The private host-admission receipt must retain legitimate sanitized references to the current decision, its decision owner and applicable route-qualification evidence. If the decision or qualification is missing, stale or inapplicable, HOLD the affected outbound calls and mark the affected provider/privacy cases BLOCKED; independent no-model work may continue. Authenticated inbound access and bridge reachability do not establish outbound identity or privacy eligibility. Preserve the existing required VPN/static-exit workflow; do not silently change VPN, account or provider. The policy choice and qualifying route remain unverified here.
