# Portable verified autonomy — pipeline binding probe

> **Date / local source baseline:** 2026-10-26; `c458396147b48e3b2c14d2a458870c1bc31d4a22`.
> **Authoritative for:** this bounded, read-only source probe's findings and limits.
> **NOT authoritative for:** architecture approval, host adoption, implementation authorization, live deployment, or task acceptance. This is not a cold design review.

## Scope and method

The dispatching architecture seat supplied these choices: OpenMausBot first host, host-managed task sessions, existing intent → arch → pipeline/roles retained, and an actual getff development task as the first trial. These are input constraints, not findings of this probe.

Read the accepted `docs/superpowers/research/portable-verified-autonomy/2026-10-26/distillate.md` and `getff-reality.md`. Reverified their relevant canonical procedure/helper/manifest connections below, without extending upstream research. Startup reads were README goal, session bootstrap, CLAUDE.md, using-getff activation and applicable evidence/language rules. All citations below are repository-relative file:line anchors at the local baseline; ranges describe the bounded read, not a whole-file audit.

No external browsing, live task/PR queries, private chat reads, AIF/OpenMaus launches, task creation, admission/claim helpers, mutating authority helpers, installation or config changes ran. Only this report was written. No runtime test or current deployment certification is claimed. Some initial combined tool output was truncated; decisive cited functions/sections were subsequently read in bounded excerpts. Unread surrounding implementation remains outside coverage.

## Finding: a useful portable boundary exists, but the current execution route is not portable by invocation alone

The smallest supported separation is **getff's authority, scope and acceptance artifacts/checks** versus **the selected host's execution ownership and consequential transitions**. The current procedures retain substantial AIF/Claude Code bindings. Loading a skill cannot supply a native OpenMaus task adapter, grant dispatch authority, make a fresh reviewer independent, or convert worker completion into accepted delivery.

Evidence anchors:

- `.agents/procedures/pipeline/SKILL.md:24–34,58–61,91–96`: pipeline owns planning/routing; explicit-only entry; worker-stage execution is outside its ownership; actual prerequisite merges remain mandatory.
- `.agents/procedures/dispatcher/SKILL.md:23–27,33–49`: dispatcher explicitly owns the **aif** loop, including harvest, review and merged-stage advancement.
- `.agents/procedures/dispatcher/references/execution.md:99–109`: execution creates and unpauses `/tasks`; scoped tasks hold at `plan_ready`, and `start-reviewed.ts` starts only after the bound PlanReview/current-row checks.
- `.agents/procedures/arch/references/exit-and-escalation.md:12–29`: current exit alternatives are factory and the native in-session Superpowers tail; its plan-preparation authority guard applies to either route. The inspected table does not establish an OpenMaus route.

This boundary conclusion is falsified if the selected OpenMaus integration already has an inspected, authorized route preserving these exact obligations and concrete live receipts. This probe did not inspect such a route and does not assert its global absence.

## Reusable mechanisms without creating an AIF task

| Mechanism | Source-confirmed contract | Reuse boundary |
| --- | --- | --- |
| Current authority selection and plan-preparation check | `intent/helpers/current-decisions.mjs:13–39` binds feature + repository identity, current immutable receipts and freshness. Its actual `checkPlanPrepVerb`, `:693–718`, loads current approved PRD, current agreed spec, a matching spec-review attempt, and optionally checks handed-off spec bytes. All paths in this table have prefix `.agents/procedures/`. | Its read/check verbs use local artifacts, not AIF task creation. Keep current authority independently selected. Do not use advance/freeze verbs as probes. Repository identity currently distinguishes another clone (`:14–17`), so cross-clone transfer needs a deliberate identity/receipt policy; copying JSON is insufficient. |
| Result contract and current-result checks | `intent/helpers/check-result-review.mjs:3–13,25–38,707–794`: read-only structural checking; `--current-result` requires current brief, observed revision, review path and enforcing contract. It verifies exact brief equality and delegates the result checks. | Reuse without an AIF task. These checks do not produce a semantic verdict or choose authority. Require the published-attempt option where publication is an admission prerequisite; `requirePublished` is conditional in `:736–765`, not an unconditional guarantee of the CLI name. |
| Immutable result publication | `intent/references/result-review.md:25–31`: observations precede publication; new attempt ID, same-filesystem atomic publication, no completed-attempt overwrite; current inputs must be rechecked before expansion. | Publication is a separate authorized writer, not a read-only check or host completion callback. Not executed here; only protocol reverified, not the publisher implementation. |
| PlanReview structural validator | `intent/helpers/check-result-review.mjs:800–893`: task ID, contract, effective plan, preimage, optional payload, owner reference and classification are checked. The return includes classification. | Function itself needs no AIF task creation. It is not an authorization service: `ownerReference` is required text, and callers must enforce allowed classifications and current state. A caller that treats any `ok` as execution permission would be wrong. |
| Plan/task preimage digest | `intent/helpers/check-result-review.mjs:73–82,897–903`: fixed projection contains `autoMode`, `executionOwner`, `id`, `ownershipRevision`, `paused`, `plan`, `status`, `title`; absent fields are omitted. | Do not hash an arbitrary native task and assume equal safety. A deliberate native projection must cover all authority-relevant fields and exact planned action; missing AIF-shaped fields otherwise disappear silently. |
| Intent/architecture advisor route and return | `intent/helpers/ask-advice.mjs:18–37,273–289,397–470`: current selector-backed document authority, answered target, named remainder and exact decision-entry anchor. `:38–49` describes artifact-based recovery without session handles. | Intent/architecture checks can reuse file authority; advice still grants no action. Task advice is transport-bound separately below. Recovery of advisor inputs is not host scheduling or resumption evidence. |

These are source-level reuse candidates, grounded in the accepted research's existing getff mechanisms (V1, G2), not a new prior-art/adoption verdict. Actual native call sites, failure routing and consumer delivery still require verification.

## Bindings that cannot be carried over unchanged

1. **Execution ownership/claim.** `.agents/procedures/pipeline/references/dispatch.md:85–95` requires claim-before-review; the claim is an ordinary AIF task created paused, and release/cancel follows GO/RED. Bridge absence claims nothing and must be reported as unguarded. A native host needs a real equivalent ownership reservation before the review window; invoking `claim.ts` would violate the selected no-AIF route. A paused native row alone must not be assumed to prove capacity, cessation or exclusion.
2. **In-flight population.** `.agents/procedures/dispatcher/helpers/probe-inflight.sh:2–14,32–39` checks origin/host/container signals and returns a verdict (exit 0 alone is not success). The origin-only blind spot is the reason for container coverage. For OpenMaus, include actual native active/reserved/finished-but-undelivered work and existing AIF work where relevant to the same scope. Do not substitute fake empty AIF fixtures as evidence of no competing work. No live ownership decision was made here.
3. **Task advisor readback.** `scripts/check-ask-files.sh:543–558` fetches `${RUNTIME_BRIDGE_AIF_URL:-http://localhost:3009}/tasks/<id>` for task asks before invoking the validator. `.agents/procedures/intent/helpers/ask-advice.mjs:219–271` requires current task ID and persisted description/plan bytes matching the document digest. Intent/architecture paths do not use this branch. A native route needs independently obtained current native task state with equivalent binding; changing the URL blindly is not a verified adapter.
4. **Monitoring/egress.** `.agents/procedures/dispatcher/references/execution.md:126–149` polls AIF and routes DONE to harvest. DONE is explicitly a lifecycle signal; owner naming grants no authority; success is not CI, merge or installed acceptance. OpenMaus needs native observation and authorized destination reconciliation rather than container harvest assumed to work.
5. **Owner recovery.** `packages/runtime-bridge/README.md:161–165` requires an active or explicitly resumed owner; the observation interface does not wake a terminated chat. `scripts/advisor-bridge-beta/cli.mjs:1–4` is explicit, with no watcher/daemon/polling; `docs/advisor-bridge-beta-pilot.md:3,9–14` records the pilot as not enrolled/run and no senior ACCEPTED submission. Neither source establishes native owner restart.
6. **Consumer closure.** `setup.d/ships.manifest:42–52` delivers arch/pipeline/orchestrator/reviewer at env, but intent/dispatcher/harvest at factory; `:65` binds runtime-bridge dispatch to factory vendor delivery. A native non-AIF consumer therefore needs an explicitly designed installation/discovery closure for the authority/result helpers and roles it actually uses. This is not solved by having the files in the maintainer checkout. No manifest mutation is proposed as already authorized.

## Four distinct completion boundaries

| Boundary | What it means | What it does not authorize |
| --- | --- | --- |
| Worker lifecycle completion | A current candidate/result becomes available to a bound owner. Dispatcher `execution.md:142–149`. | Automatic resume, independent acceptance, CI success, merge or installed acceptance. |
| Product result acceptance | Fresh product-only judge, approved brief/decisions/open questions, every essential promise observed, exact current candidate; outcomes `matches`, `mismatch`, `needs-evidence`, `needs-operator`. `intent/references/result-review.md:8–23,31`. | Changing product promises, substituting producer narrative, or ignoring stale observed inputs. A structurally valid negative review is a received result, not an accepted product result. |
| Finding closure | Dot ledger binds latest fix, independent affirmative review and applicable affirmative Dot closure to the fix revision, with no unresolved blockers. `scripts/dot-review-gate/ledger.mjs:393–416,473–503`. | Merely receiving `fix_response`, executor self-closure or relying on previous fix evidence. |
| Stage completion / next-stage eligibility | Current pipeline requires actual prerequisite PRs merged to staging; frontier eligibility alone does not prove merges. `pipeline/references/dispatch.md:60–83,99–105`; `pipeline/templates/meta-kickoff.template.md:36–46`. | Advancing merely because OpenMaus says completed, a worker report was accepted, tests passed, or a product review matched. |

`pipeline/references/stage-gates.md:10–22` explicitly classifies the merge check as Class C prose enforcement; the AI can ignore injected state. Preserve this honest limit. Any mechanical native advancement guard would be an implementation change, not an already-installed effect of invoking pipeline. Full procedure prefixes for the abbreviated table paths are `.agents/procedures/`.

## Dot reuse must preserve its narrower role and enrollment

`docs/meta-factory/dot-review-handoff.md:44–58` assigns implementation, change review, system review, coordination and deterministic helpers distinct responsibilities. Registered managed PRs transfer merge/arming authority to their coordinator; stalled coordination does not silently restore executor authority. The ledger remains authoritative and comments/checks are projections.

`scripts/dot-review-gate/runner.mjs:5–29` supplies a bounded cycle with injected destination callbacks, persistent reservations and repeated operational authorization checks. Its current dispatch is a coordination message to a Claude Code session, not a model launch or merge. That is a reuse seam, not proof of an OpenMaus adapter. `docs/meta-factory/dot-review-gate-pilot-runbook.md:25–39` requires explicit per-PR registration, live destination/principal enrollment, durable stop behavior and actual coordination directory; the runner does not schedule itself.

`docs/meta-factory/dot-review-protocol.md:14–18,24–34` limits Dot to its approved independent review assignment, with no code repair/merge, no new background-agent route absent authorization, and live setup/schedule/permission proofs. A design cannot silently relabel an OpenMaus worker as the existing Dot reviewer/coordinator or reuse a stale registration. Whether a first trial PR is already managed is unknown until the authorized current-state check.

## Explicit-only entry and dispatch authority

- `.agents/procedures/pipeline/SKILL.md:30–34` and `.agents/procedures/dispatcher/SKILL.md:29` preserve explicit-only self-initiation. Reading the procedure is allowed for already-authorized work; it grants no new invocation or execution authority.
- `docs/codex-contributor.md:39–42,60–69` documents the existing Codex adaptation: explicit named request counts, absent args stay empty, complete canonical source must be read, native grants still govern. It is a precedent to preserve, not documentation that OpenMaus is already bound.
- `.agents/procedures/pipeline/SKILL.md:91–96` keeps umbrella write workers outside the planning session's Agent use. `pipeline/references/dispatch.md:48` states the boundary applies across Agent/AIF/`claude -p`; its mechanical matcher is a kickoff-text gate, not a universal runtime launch gate. Read-only probes/reviews do not imply authority for implementation sessions.
- `.agents/procedures/arch/references/exit-and-escalation.md:14,31` explicitly separates companion availability from plan approval/channel/dispatch permission. Existing channel-order instructions prefer AIF in their intended route; the chosen native no-AIF route needs a deliberate exception/binding, not silent compliance claimed through the old table.
- This task's exact-brief approval delegation removes a redundant brief vote within scope. It does not itself grant architecture agreement, worker dispatch, new spend, config/security changes, main merge or publication.

## Concrete changes required of a native OpenMaus design

These are binding obligations derived from the above sources, not an implementation plan or permission to build a platform:

1. Define a native entry/exit route alongside the current factory/in-session routes: map explicit request, arguments, project root, roles and authorization without automatic AIF dispatch.
2. Bind durable native task/session identity to feature, exact contract/plan/candidate, current authority revision and execution owner. Supply ownership reservation and duplicate-work reconciliation before review and launch; preserve cancel/pause and cessation uncertainty.
3. Call existing authority/result validators at the consequential boundaries; specify native task preimage/current-state mapping and re-read before the actual authorized transition. Preserve produce/repair/expand and stale-result withholding.
4. Create a genuinely fresh artifact-only product reviewer input path. The host research's uncontrolled shared-memory concern must be resolved by an inspected prompt/context boundary; a new session title is not proof. Keep independent change/system review responsibilities separate.
5. Route findings and advisor returns to the existing exact owner with native task-state readback; retain applicable Dot ledger/registration policy if the selected PR is managed. Do not silently take over its coordinator.
6. Use host-native continuation for the accountable owner and prove owner cut/restart, duplicate result, deliberate pause/cancel and unknown delivery effect without manual relay or blind replay. Existing getff observation/advisor helpers do not establish this.
7. Reconcile authorized delivery and actual merged dependencies before native stage advancement. Preserve existing prerequisite merge semantics unless an explicitly reviewed design changes them.
8. Deliver and exercise the minimal non-AIF consumer procedure/helper/role closure. Separate shipped bytes, discovery/trust, actual firing and accepted business result; keep costs/account eligibility explicit.

Falsifier for an individual required adaptation: an existing inspected binding plus acceptance evidence already supplies it under the selected native route. In that case reuse the binding and retain its proof; do not implement a duplicate merely because this probe did not inspect it.

## Conservative selection criteria for the first real getff task

No task was selected or dispatched. Selection can start from already-authorized repository backlog/kickoff artifacts and the operator's named task, without private-chat discovery. Before launch, a separate authorized current-state probe is necessary; local records alone cannot establish exclusivity.

- Existing, unfinished, useful development work with an agreed outcome, bounded allowed files and observable current failure; prefer one vertical slice that can independently prove value (`pipeline/templates/meta-kickoff.template.md:43–48`). Research-only completion cannot stand in for the requested development cycle (accepted distillate PA1/PA2).
- Scope and acceptance can be pinned to current PRD/spec or honestly classified through the existing legacy/adoption mechanism (`arch/references/exit-and-escalation.md:25–29`); never invent authority to make the trial pass.
- No competing owner, active claim, open/merged duplicate or finished-undelivered result across relevant hosts. Unknown ownership disqualifies immediate launch; does not prove the task unowned.
- No unresolved predecessor merge. Prefer a task that can complete without goal redefinition, main promotion, publishing, new spending, standing permission changes or agent-uncommittable settings.
- Reversible isolated checkout, deterministic observable regression and an independent reviewer who can judge the exact result with bounded inputs. Avoid artificial busywork or injecting an unrelated defect merely to claim repair.
- At least one meaningful finding → correction → recheck path and safe owner-interruption point can be exercised on that same task. If no authentic finding arises, use a separately identified bounded adverse acceptance case; do not invent a defect in the business task.
- Authorized destination and PR-management status are known; existing managed coordinator rights remain intact. Enough bounded session time/eligible runtime capacity exists to collect restart and final acceptance evidence, without assuming unlimited included usage.
- Record operator effort from setup onward and the unresolved measurement horizon; first-task success alone does not establish long-run savings or two-host portability.

## Limits and self-check

Unknowns: actual OpenMaus installation and supported native task API/state mapping; reviewer context exclusion; owner restart behavior; real current task candidate/ownership/PR management; current external enforcement settings; no-extra-payment account eligibility; complete consumer dependency closure; future cross-clone authority identity. No candidate list or live rollout claim is manufactured from these source reads.

Countercheck performed against the findings: **Could a valid file hash, a `matches` record, an AIF DONE status or a Dot ACK alone authorize native implementation/merge?** The inspected sources answer no: independent current authority, allowed transition classification, actual reviewer semantics, current candidate, explicit channel and destination ownership remain separate. **Could merge-only completion replace product acceptance?** No: merge is the current stage dependency gate, while result-review owns essential-promise acceptance. This probe itself preserves that distinction and makes no global absence claim from its bounded corpus.

## Retained-AIF addendum — clarified first-route scope

**Clarification received after the initial probe:** bots MAY invoke AIF's existing plan → implementation → review loop. The no-AIF exception applied to research, not to the delivered execution route. The main requirement is that useful work must not stall awaiting manual continuation. The initial report's native-without-AIF requirements therefore describe a conditional alternative, not a product constraint or the required first implementation. This addendum preserves that history and supersedes its application to the retained-AIF first route.

### Smaller integration boundary supported by current sources

The candidate route is: OpenMaus owns the durable task and routing responsibility → the existing getff pipeline/admission paths create or claim the AIF execution task → AIF owns implementation/internal review and applicable rework → a separately scoped native pipeline worker observes the exact AIF task → the native owner consumes its report, reconciles current authority/candidate and routes independent review, repair and authorized delivery. This is a proposed integration of existing seams, not observed native execution or a finding that all rework must occur in AIF.

| Existing path | Retained-AIF disposition and evidence |
| --- | --- |
| Current authority, plan and result checks | Remain reusable as previously identified. Native ownership does not change the independent selector, current PRD/spec, immutable review and current-candidate obligations. No native replacement of the AIF task preimage is necessary when PlanReview still applies to the actual AIF task. |
| Claim before review | Keep the existing paused AIF claim, release/cancel and in-flight probe instead of inventing a native execution claim: `.agents/procedures/pipeline/references/dispatch.md:85–95`; `packages/runtime-bridge/src/backend.ts:64–90`. Actual status/capacity and cancellation outcome must still be checked; prose suggesting no capacity consumption is not stronger than the explicit capacity caveat in `dispatch.md:93`. Native parent ownership is a separate custody problem, not a duplicate AIF execution task. |
| Scoped admission | Keep `start-reviewed.ts --task <id> --review <record>` with its exact contract/plan/preimage and immediately-before-start reread: `.agents/procedures/dispatcher/references/execution.md:99–109`. No direct native implementation bypass is needed or authorized by changing the outer owner. |
| Task advisor route/return | Existing `scripts/check-ask-files.sh:543–558` remains appropriate because the task is still an AIF task; `ask-advice.mjs:219–271` still validates the actual AIF ID and persisted description/plan. The native owner must use the current bound answer and return owner, not treat advice as authority. |
| Internal rework and post-harvest corrections | Retain existing routing rather than force every correction into a new AIF task. Dispatcher `execution.md:159–164` references the authorized `answer.ts` REVISE cycle and escalation floors; `:299–305` explicitly keeps fully specified post-harvest file:line fixes in-session on the harvested branch and routes open decisions separately. |
| Harvest and merge closure | Existing AIF transport can remain: `packages/runtime-bridge/README.md:271–280,284–301` describes host pre-push and PR opening, actual container/host-repo parameters, and nonzero failure. `:309–326` maps the PR to its AIF task and closes only after actual merged evidence. Retain pre-egress fidelity, local sweep, current holds and managed Dot policy; successful observation is not permission to invoke harvest blindly. |
| Stage progression | Keep actual prerequisite merges, cold review and frontier semantics: dispatcher `execution.md:299–318`, pipeline `dispatch.md:60–95`. Native parent completion and native child REPORT must not replace those gates. |

The retained-AIF route therefore removes the need to replace AIF task admission, execution-state projection, task advice transport and container egress for the first trial. It does **not** remove host capability/permission binding, current artifact availability, consumer delivery, reviewer-context isolation or native owner continuity proof. AIF availability, configured destination identity and actual accessible shell/network routes remain unknown in this read-only probe.

### Concrete observation seam; no invented callback

The existing command seam for a bounded observer is:

```bash
tsx packages/runtime-bridge/src/cli/await.ts <actual-aif-task-id> --until-actionable --timeout-ms <positive-integer-ms>
```

This is a command template, not an executed command or an authorization to launch. Bind the real checkout/installed CLI and actual AIF endpoint before execution. `packages/runtime-bridge/src/cli/await.ts:52–65` validates the deadline and excludes simultaneous `--once`; `:157–162` reads `RUNTIME_BRIDGE_AIF_URL` (default localhost:3009), runs the observer and prints one JSON result, with exit 0 only for `kind=done`. **This branch directly uses the AIF endpoint; it does not call `resolveBackend()`**, which occurs afterward at `:164`. Endpoint reachability from the chosen native worker must be established rather than inherited from another host.

`awaitActionable` is exported at `:76–128`; it polls full current `/tasks/:id` detail, defaults to a 60-second interval, bounds observation, retries only `unavailable` up to three consecutive failures, and returns parked/paused/adverse/unknown before optimistic done. Timeout is explicitly `observation_deadline_not_worker_failure`. Its result carries `taskId`, `kind`, optional status/reason and canonical metadata (`:68–74`). It is an available **source command/function seam**, not a currently registered OpenMaus tool proven by this probe.

The alternative default command is `tsx packages/runtime-bridge/src/cli/await.ts <id> --timeout-ms <N>`; it resolves the backend and calls `backend.awaitDone` (`:164–189`). For AIF the subscribed observer subscribes before authoritative reconciliation and uses a one-hour default with bounded reconnect (`packages/runtime-bridge/src/aifWsStatus.ts:250–265`); cancellation explicitly leaves the underlying task unchanged (`:311`). A fresh `--once` read is available on resumption (`await.ts:171–178`); exit 0 can mean still running, so its JSON state must be interpreted, not just its exit code (`README.md:124–130`).

Metadata contains exact task/candidate/result generation, hold and pending next action, with `acceptance: unverified`; `RUNTIME_BRIDGE_RESULT_OWNER` only names the reader (`aifWsStatus.ts:61–84,97–129`). The owner must persist pending work before acknowledgement and re-read generation/candidate/authority before acting. The bridge's stdout does not itself deliver a durable native child result, resume a native parent, or recover a terminated owner (`packages/runtime-bridge/README.md:161–165`).

### Native child and recovery: proposed, not proven

A scoped child can plausibly execute the bounded command and return its JSON plus a REPORT to its native parent, but the inspected getff sources prove neither that OpenMaus keeps this subprocess/session alive nor that result delivery wakes/restarts the parent. Parent cut, child cut, command timeout, late result, duplicate return, stale generation and deliberate pause/cancel still need actual native trials. On observation loss retain the same task identity and pending obligation; do not re-dispatch implementation or retry an unknown delivery effect.

An additional applicable routing constraint must be carried into the architecture: `.agents/rules/coordinator-seat-delegation.md:24–35` assigns polling/await/harvest to a **standalone session** with a REPORT contract and explicitly rejects an in-session Agent renamed as a chip worker. The dispatcher-role session, night-mode AIF loop and worker itself are exempt (`:30`). `.agents/procedures/orchestrator/references/chip-worker-template.md:3–6,19–25,46–51` supplies bounded stages and `DONE|PARTIAL|BLOCKED`, per-stage PR/head/merge/task closure and `ATTN` fields. The clarified host-managed-session request permits designing a native standalone equivalent; it does not establish that OpenMaus child semantics already satisfy this distinction. Specify which role the native parent/child holds, standalone lifecycle/context and report return, without adding a human click by default or silently discarding the existing separation.

**Qualified first-route conclusion:** retaining AIF materially narrows the required integration to native ownership, scoped standalone observation/continuation, result intake and host bindings around existing getff/AIF transitions. It does not justify rebuilding the current executor loop. This conclusion would be wrong if a selected existing mechanism cannot be reached from the native worker or fails its bound identity/permission/continuation obligations; establish that with a concrete probe before replacing it. No native wait/return/recovery execution, helper mutation or external action ran in this addendum.
