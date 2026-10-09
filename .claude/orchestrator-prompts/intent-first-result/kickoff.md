# KICKOFF — intent-first-result

> **Status:** Prepared after design review; not dispatched. Publication and destination preflight remain pending.
> **Type:** execution-build, sequential, existing factory/advisor route.
> **Rigor label (L0):** `build-and-verify` — reversible scoped workflow; one blind semantic pilot before delivery expansion.
> **Authoritative for:** the stage map, S1 implementation contract, acceptance and handoff of this umbrella.
> **NOT authoritative for:** product intent beyond the linked spec, execution authorization, upstream skill internals, advisor transport, registry lifecycle or project goal.
> **For agentic workers:** use the existing dispatcher/SDD execution and review procedures; this document supplies their task scope and does not replace their loops.
> **Base branch:** staging. No automatic dispatch marker is present.

**Goal:** Preserve product intent through the first working result and stop dependent expansion when that result misses an essential promise.

**Architecture:** Add a product-only `/intent` adapter to the existing interview/advisor path. Carry scoped contracts through existing stage artifacts and task descriptions; use one read-only validator at actual continuation effects. Technical review establishes execution/identity; a fresh intent advisor judges the observed product experience.

**Tech stack:** existing Markdown skills, Node.js built-ins, TypeScript runtime bridge, Vitest and the existing npm/ESLint backend. No new dependency, transport, role registry, paid CI inference or global activation.

**Spec:** [revised design](../../../docs/superpowers/specs/2026-10-07-idea-arch-incremental-design.md), SHA-256 `1af90f9e909eac2efbcd67848a09b786455f40d122571bf3282603716bb7789f`.
**Review:** [GO with execution notes](../../../docs/superpowers/specs/reviews/2026-10-07-intent-pre-kickoff-r1.md).

## §0 Authority, publication and cold start

Read README goal → session-bootstrap → CLAUDE.md → spec → review → this contract. Read task-specific rules before editing: source-before-shape, build-first-reuse-default, language-discipline, doc-authority-hierarchy, destination-environment-verification, kickoff-staging-placement, rule-enforcement-channel-selection and companion-install-principle for setup work.

The operator requested review and kickoff preparation on 2026-10-07. This artifact records no implementation launch, spec-ratification vote or product-brief approval. Preserve that distinction in every report. Product approval references must identify an actual statement and immutable approved content; never infer approval from silence or a review GO.

Before dispatch: publish the exact reviewed spec, review and kickoff to staging together through the normal PR path. Verify their bytes against the reviewed snapshot. Do not dispatch from a worktree-only artifact. Do not resolve an upstream profile by a remembered model name or add a bridge-profile marker before plan-completeness review and its protected-check prerequisite pass.

Before actual execution, verify configured destination, runtime profile and advisor isolation using the existing routing/advisor procedures. D-Q7 remains the configured default (Codex/CC design and coordination; GLM execution); host availability is checked, not invented. Changing the execution channel is an operator choice. An unavailable capability parks that scope, never silently switches models or advertises inline reading as isolation.

Run the existing in-flight probe before dispatch and re-run after the cold review window:

```bash
SLUG=intent-first-result bash .claude/skills/dispatcher/helpers/probe-inflight.sh
```

`PROBE-INCOMPLETE` or collision holds dispatch. Existing claims, aif finished-but-unharvested work and concurrent host sessions are part of the probe. Run the helper's `--late` mode before PR creation, merge or outward dispatch. One executor owns each stage; the coordinator does not implement its worker tasks inline.

## §1 Global constraints and review focus

- `/intent` replaces the proposed unshipped `/idea`; keep `/arch` and `/pipeline` names.
- Product brief first; essential promises cannot be deferred just to produce a match.
- Reuse brainstorming/grilling/domain-modeling and advisor restoration; local adapter owns only the product boundary and result comparison. Do not edit upstream caches or global settings.
- Only declared feature work and its children inherit the new obligation. Independent small tasks and historical plans retain their ordinary gates without new receipts.
- No whole-spec freshness hash, global stage index, activation file, legacy census or second execution plan.
- An elected operator checkpoint blocks until the actual response; a routine match creates no new human gate.
- Deterministic checks validate bindings and recorded coverage; they never infer the product verdict or semantic dependency frontier.
- No automatic contract-changing resume until an existing owner path proves exclusion of concurrent writers. A local lock that remote/UI writers ignore is insufficient.

Review focus, mapped to tasks below:

1. Child strips its local requirement while its parent/standing claim retains scope → Task 2 rejects before any effect.
2. Review is valid at preparation but stale at release/consumption → Task 2 rechecks; paused claim remains paused.
3. Planner produces a different plan after kickoff review → Task 2 holds implementation until exact effective-plan review.
4. Output proves detection but hides an unusable diagnostic → Task 3 reads raw messages and requests missing observations.
5. Repair is blocked by the failed result it must fix, or unlocks expansion prematurely → Tasks 2/3 use separate repair scope and new evidence.

## §2 Stage map and gates

| Stage | Outcome | Depends on | Parallel-with | Detail status |
| --- | --- | --- | --- | --- |
| S1 | Brief/restoration → actual consumer result → blind mismatch → scoped hold → repair → observed match | — | — | Complete contract below; dispatch requires §0/preflight |
| S2 | Recovery, later-feature review, affected-only reuse and serialized effective-plan/answer changes | S1 | — | Outcome outline; elaborate and cold-review after S1 evidence |
| S3 | Env/factory delivery, refresh, native discovery and remaining advertised route proofs | S2 | — | Outcome outline; elaborate and cold-review after S2 evidence |

Only S1 is executable from this artifact. S2/S3 outlines are not dispatch inputs. Before S2, retain S1's exact PR URLs, heads and evidence digest, then verify actual merge through `gh pr view <recorded-url> --json state,baseRefName,mergeCommit`; require MERGED, base staging and a merge commit. Resolve the URL from the stage report, never guess a branch. Repeat for S2→S3. Also run the existing frontier helper and the cold stage review; merge alone does not certify the semantic pilot.

S2 may elaborate local recovery/continuation details; it may not replace the shared identity/ownership contract below without affected-stage review. S3 must make `/intent` and its helper work at env depth without factory vendor links and prove each advertised route. Unsupported routes remain named and unverified.

## §3 S1 shared interfaces and retained file structure

The first result is the configuration-convention developer interaction in a disposable npm consumer. The retained implementation is the workflow around it. S1 is not complete when a parser or skill is merely installed.

**Canonical files to create:**

- `.claude/skills/intent/SKILL.md`: product discussion/routing boundary, accessible explanation, advisor ownership and links.
- `.claude/skills/intent/references/product-brief.md`: brief/approval snapshot and understanding/restoration contract.
- `.claude/skills/intent/references/result-review.md`: fresh artifact-only comparison, observation challenges and publication rules.
- `.claude/skills/intent/helpers/check-result-review.mjs`: importable validator plus read-only Node CLI; all structural validation lives here.
- `packages/runtime-bridge/src/resultReview.ts`: narrow runtime adapter, durable scope extraction and effect-boundary invocation.
- `packages/core/skills/intent-result-review.test.ts` and `intent-routing.test.ts`: helper behavior and skill-routing contract.
- `packages/runtime-bridge/src/cli/start-reviewed.ts`: guarded start of a scoped task after effective-plan review through the existing REST event path.
- `packages/runtime-bridge/test/result-review-effects.test.ts`: paired effect assertions for the selected runtime route.
- `scripts/intent-pilot.mjs` and `packages/core/skills/intent-pilot.test.ts`: reproducible disposable consumer setup/capture; no AI verdict generation.

**Existing files to extend:** `CLAUDE.md` local Skill routing bindings (domain vocabulary permission for product discussion); arch `references/ideation.md` and `exit-and-escalation.md`; pipeline `references/dispatch.md`; dispatcher `references/execution.md` and `parks.md`; runtime `types.ts`, `kickoff.ts`, `AifHandoffBackend.ts`, `AifFireBackend.ts`, `ManualBackend.ts`, `cli/dispatch.ts`, `cli/answer.ts`, `cli/aifHttp.ts`; setup `lib.sh`, `10-skills.sh`, `55-runtime-bridge-vendor.sh` only for S1's factory loading. Use existing setup/native tests and generated-card owners; do not create a parallel installer. Vendor admitted runtime files from canonical sources using the existing copy/format contract. Native discovery changes belong to the current canonical renderer, not hand-edited cards.

### Binding shapes

Use a single fenced `intent-contract` JSON block in the existing stage kickoff/plan. Zero blocks means ordinary unscoped behavior only when no standing/parent contract exists; malformed/multiple/conflicting blocks fail closed. No independent global JSON plan is added.

- `ContentRef = { path: string, sha256: string }`: digest of exact file bytes, resolved within configured project/coordination roots after realpath. Missing/unreadable/escaping refs reject. Roots come from the owner configuration, never from an untrusted reviewed record.
- `IntentContract = { version: 1, featureId, resultId, mode, brief: ContentRef, shared: ContentRef[], essentialPromiseIds: string[], producesOrRepairs?: string, requiresReview?: ContentRef, parentContract?: ContentRef }`.
- `mode` is `produce`, `repair` or `expand`. Produce needs its approved brief and required observations, not a prior passing review. Repair names the failed attempt/mismatch and permitted changes under existing authority; it does not require that failed attempt to match. Expand requires the exact selected matching attempt. Child scope cannot weaken parent essentials/dependencies; re-scoping requires the reviewed replacement.
- `ResultReview = { version: 1, attemptId, featureId, resultId, brief: ContentRef, producerContract: ContentRef, observedRevision, sourceInputs: ContentRef[], environment: ContentRef, evidence: ContentRef[], promises: Array<{ id, comparison, evidence: ContentRef[], explanation }>, outcome, limits: string[], operatorCheckpoint?: ContentRef }`.
- Outcomes are exactly `matches | mismatch | needs-evidence | needs-operator`. Comparisons are `supported | contradicted | unobserved | needs-operator`; matches requires every essential ID supported with observations and no contradiction or outstanding checkpoint. The helper checks structure/identities; the fresh advisor owns comparison/explanation.
- Required brief metadata identifies its feature, promise IDs, essential IDs, immutable approved snapshot and actual approval reference. Never encode the brief's own digest inside itself. The consuming contract binds its bytes.
- `PlanReview` lives in the existing task review/journal record: task ID, contract ref, exact effective-plan bytes digest, reviewed task pre-image digest, proposed payload digest when answering, classification (`within-contract | contract-revision | product-decision`) and owner/decision reference. A digest does not grant authority.

Export `validateResultReview(request) -> { ok: true } | { ok: false, code: string, reason: string }` from the helper; request supplies the current contract ref, standing/parent contract refs, configured roots and current observed-input bindings. CLI: `node <helper> --request <request-json-path>` prints that result and exits 0/2. Missing helper/input and parse/I/O failures exit 2; validation does not write, run probes or contact a model. Runtime adapter converts failures to `BackendError(..., 'spec_invalid', backend)`.

Use version 1 with explicit required-field/type/outcome validation; reject conflicting duplicate IDs and unsupported versions. CLI and imported validation must agree. Consumer contract refs bind selected attempts; no “latest” lookup or mutable-path-only approval. A producer contract and an expansion contract are distinct, avoiding a contract→review→same-contract digest cycle.

Publication: observations first, then a complete attempt under `<stage-artifact-root>/result-reviews/<attemptId>/result-review.json`; rename atomically on the same filesystem. Never overwrite a completed attempt. Journal/select after publication. Incomplete/orphan data grants nothing. The validator is read-only; the existing stage owner publishes/selects and resolves conflicts.

## §4 S1 implementation tasks — sequential within one stage

### Task 1 — preserve product understanding and define observations

- [ ] Add routing fixtures: substantial unclear work enters intent; an approved brief skips re-interview; small precise work stays in arch; named arch route loads canonical intent procedure explicitly; domain-modeling is permitted in direct `/intent` and arch-mediated product discussion, while ordinary word-definition requests retain the CONTEXT growth rule.
- [ ] Run `npx vitest run packages/core/skills/intent-routing.test.ts` and establish RED on the missing adapter/route.
- [ ] Implement the thin skill/references and arch bindings. Reuse the installed companions or existing vendored fallbacks. Explicitly permit the named arch route while keeping direct `/intent` available. Update `CLAUDE.md` Skill routing bindings with the same product-discussion exception: the current arch-only prohibition must not contradict the direct route. Keep the existing CONTEXT growth-rule boundary for ordinary vocabulary questions. Test both permission and preserved exclusion against the binding and procedure together.
- [ ] Prepare an isolated product-only advisor from the approved brief/decisions/open questions. Require plain-language retell plus permitted/wrong interpretation; replay after restoration. Do not feed architecture/implementation conversation to it.
- [ ] Run the route fixtures GREEN; record actual isolated understanding separately from deterministic checks. Save a focused commit with only Task 1 files.

**Consumes:** approved spec and actual brief approval. **Produces:** product brief with stable promise IDs, canonical product-only procedure, raw understanding/restoration evidence and observation requests. Pilot essentials: installed local rejection identifies relevant source; message explains `config.get('databaseUrl')` replacement; corrected code passes. These are derived from spec:15–21/161, not a new production rule requirement.

### Task 2 — bind the selected factory route and guard actual effects

- [ ] Write helper and effect negatives before implementation. Invalid/missing/stale/conflicting review, wrong feature/result/brief/producer, missing essential evidence, unresolved checkpoint and escaped path all reject. A matching attempt passes; ordinary independent work and authorized repair pass their own contracts.
- [ ] Add effects tests against CLI and backend seams: failed validation means no POST task/fire, no unpause PUT, no manual packet and no dedup success. Include direct backend invocation, `--force`, stale delayed release and a removed local requirement with standing description/parent retained. Unscoped controls preserve current behavior.
- [ ] Implement helper and adapter. Check before dedup can report success, before direct backend creation/packet effects and again at release using the persisted task description; a bare task ID does not erase scope. Read persisted description into `AifTaskFull`. Malformed declared scope never becomes ordinary scope.
- [ ] Prove a pre-implementation plan-review boundary on the actual AIF destination. For scoped tasks use existing `autoMode:false` plus legal planning/start events so planning can run but implementation waits. Local upstream `packages/shared/src/stateMachine.ts:75–91` supports `start_ai` then `start_implementation`; verify destination semantics/readback before using them. Retain normal unscoped `autoMode:true`. No new remote transport or a poll race to pause an already running implementer.
- [ ] Add `tsx packages/runtime-bridge/src/cli/start-reviewed.ts --task <id> --review <review-record-path>` using existing REST helpers. Require standing feature scope, state `plan_ready`, `autoMode:false`, a matching authorized PlanReview and current continuation validation; only then post the existing `start_implementation` event. Bind exact planner output to technical review, then re-read immediately before the start event. Changed plan/pre-image or no decision holds the event. A plan that escapes the contract returns for replacement/product decision, never executes on the kickoff digest alone.
- [ ] For feature-scoped plan-changing/restarting answers, read standing scope and require classification plus payload/pre-image binding before any write/event. S1 defaults to holding such restarts if concurrent-writer exclusion is unproved; status-only/unscoped behavior stays ordinary. Within-contract restart is enabled only on a demonstrated existing serialized owner path. S2 owns broader contract-changing resume proof.
- [ ] Wire the same helper into pipeline preparation and dispatcher launch/repair procedures. Copy the helper with the intent skill for factory S1 and keep admitted runtime vendor copies import-closed. Missing helper is spec_invalid for adopted work.
- [ ] Run helper/effect suites GREEN and existing split-claim, spec-invalid, dedup, answer and backend suites; commit the retained implementation. Confirm real claim held → review → release/start ordering with event evidence before Task 3.

**Consumes:** Task 1 brief/procedure and the binding shapes in §3. **Produces:** read-only validator, durable scoped runtime/procedure adapter, exact plan review record and actual destination boundary proof. If destination cannot enforce the selected route, stop S1 with the unmet prerequisite; do not substitute a manual packet or claim success on unit tests.

### Task 3 — run the discriminating first result, hold and repair

- [ ] Implement the disposable consumer runner with paired tests. Reuse `no-direct-process-env.node.json` and the existing npm renderer. Write a real temporary ESLint config/violating and corrected files; execute the installed local command with the repo's existing dependencies. Capture full diagnostics (source, location, rule, message), command exit and relevant identities. The existing `fireRestricted` rule-ID set is insufficient.
- [ ] Matching consumer message explains the approved replacement. In a second opaque-ID consumer config change only the message, keeping selector, severity and paired fail/pass behavior identical. Do not alter the canonical rule family. A harness assertion verifies that detection stays equal while message content differs; it does not manufacture advisor outcomes.
- [ ] Use a fresh artifact-only intent advisor for each comparison. Supply approved brief/scope and raw evidence/reproduction with neutral sample IDs; withhold expected outcomes, degradation labels, variant-generation script and executor narrative. Keep the variant map in the technical observer's record, outside advisor inputs. Publish actual advisor observations and attempts after the judgment.
- [ ] Present an incomplete package missing diagnostic detail: require a bounded probe request/needs-evidence. Return the raw missing observation and record the subsequent judgment. Never fabricate a prepared mismatch JSON as semantic evidence.
- [ ] Demonstrate missing evidence and actual mismatch each prevent the dependent expansion effect. Run a separately authorized repair contract against the deficient consumer, restore the useful message, observe again with a fresh advisor and select the new exact matching attempt. Only then demonstrate dependent expansion can start through the same guarded route.
- [ ] Record all four D-SUCCESS dimensions from existing logs/manual observation: first-result fidelity, misunderstanding-driven redesign, operator interventions and total effort, including initialization/review/probes/repair/false holds. No numeric success threshold or telemetry service.
- [ ] Save retained pilot runner/tests and a stage report containing raw commands, attempt/contract refs, actual advisor judgments and destination events. Remove disposable consumer setup after retaining replayable inputs/outputs. Commit only the retained workflow and evidence allowed by repo policy.

**Consumes:** Tasks 1/2 and actual existing authorization. **Produces:** real semantic comparisons, probe round-trip, fail/pass detections, scoped holds, authorized repair and recheck, exact selected attempt and cost observations. Technical review verifies execution/revision; it does not choose product meaning. If blind discrimination fails, report the failure and revisit the mechanism before S2/S3.

## §5 Acceptance and destination verification

S1 closes only when Tasks 1–3 deliver the whole path and a cold technical reviewer verifies the evidence. Deterministic green cannot replace the actual advisor comparisons. Run from the host repo root after implementation:

```bash host-verify
npx vitest run packages/core/skills/intent-routing.test.ts packages/core/skills/intent-result-review.test.ts packages/core/skills/intent-pilot.test.ts
npx vitest run packages/runtime-bridge/test/result-review-effects.test.ts packages/runtime-bridge/test/aif-claim-split.test.ts packages/runtime-bridge/test/dispatch-spec-invalid.test.ts packages/runtime-bridge/test/aif-dispatch-dedup.test.ts packages/runtime-bridge/test/aif-answer.test.ts packages/runtime-bridge/test/aif-rest-dispatch.test.ts packages/runtime-bridge/test/aif-fire-backend.test.ts
npx vitest run packages/core/backends/npm/from-node.test.ts packages/core/backends/npm/firing.test.ts
npm run typecheck --workspace @rules-as-tests-aif/runtime-bridge
make self-audit
```

The new test files do not exist at kickoff authoring; the block is a future acceptance contract, not a reported pass. Run `bash scripts/host-verify.sh --list intent-first-result` now to verify extraction only; execution after implementation must fail if a required suite is absent. Also verify factory fresh install/refresh reaches the intent skill/helper and canonical admitted runtime copies; env-wide/native route acceptance remains S3.

Live evidence checklist: product-only understanding/restoration; actual matching/deficient advisor judgments without expected labels; incomplete-package probe; actual no-effect dependent hold; repair exemption without expansion; observed repair/recheck; plan_ready holds before reviewed start; standing scope survives release; exact task/plan/contract/observation identities; all other ordinary gates still pass. List any unverified path explicitly. Live semantic steps run in authorized sessions, never in CI.

## §6 AI traps and reuse

See [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md). Active: T2 (run destination checks), T3 (raw evidence), T4 (no drive-by fixes), T7 (execute negative cases), T11/T16 (consult prior art before capability commits; compare actual problem classes), T15 (this workflow must pass its own result/continuation checks), T19 (cold review before handoff), T20 (evidence-backed verdict), T22 (pin sibling inputs so each negative flips for its intended reason).

- **T-INTENT-A — well-formed record mistaken for product success.** Only actual fresh advisor judgments over observations prove discrimination.
- **T-INTENT-B — hidden fail-open at release/dedup/fallback.** Assert zero effects at each seam and retain standing/parent requirements.
- **T-INTENT-C — intent contaminated by the answer key.** Separate the technical variant map/generation script from neutral advisor evidence.
- **T-INTENT-D — pause after implementation mistaken for a plan gate.** Require destination ordering proving implementation never started before plan review.

Prior-art inputs: SSOT #64 (reuse SDD, not rewrite its loop), #201 (adapt advisor responsibility; no new API tool), #253 (consume interview/domain procedure), #154 (reuse ESLint runner/renderer). Those entries do not validate semantic judgment. Before any capability commit perform the existing CLAUDE.md consult/trailer process for the exact capability; add a residue entry only if needed. This document adds no dependency or runtime capability itself.

### §1.7 Forward-check applied

The spec's goal boundary follows `README.md:51–64`. Structural checks use the narrow effect boundary; semantic comparison uses the named advisor procedure per `.claude/rules/rule-enforcement-channel-selection.md:21–24`. Reuse stays subordinate to the existing companions; paid CI inference is absent. Approval and reviewed bytes remain distinct. Staging publication precedes dispatch; machine artifacts are English and operator narration follows the active language.

### §1.7 Backward-check applied

Surfaces: arch input/exit, pipeline preparation/release, dispatcher parks, runtime dedup/claim/release/answer/direct effects, advisor restoration and factory loading. Existing reviewer/fidelity/in-flight gates remain authoritative. `AifHandoffBackend.ts:336–355` separates description/plan; `cli/dispatch.ts:171–179` exposes the early dedup seam; `cli/answer.ts:344–345` changes effective plan; `setup.d/lib.sh:64` and `55-runtime-bridge-vendor.sh:35–36` separate env/factory delivery. S1 guards its selected route; S2/S3 add the explicitly deferred contracts/proofs rather than retroactively declaring those routes supported.

## §7 Stop, return and continuation

Park on unrecorded product preferences/material promise changes, absent approval or isolation, unsupported planner hold, concurrent-writer exclusion needed but unproved, failed blind discrimination, missing/stale evidence or a collision. Route intent to advisor/operator and in-scope architecture to the existing architecture owner. No new role or automatic strategy decision.

Return: stage verdict, implementation PR URL/head/merge evidence, contract/brief/result refs, actual observation and advisor attempts, effect-negative outputs, host verification, effort observations, limitations and the exact next stage still blocked. Standard fidelity and §1.7 PR-body obligations apply; preserve a frozen accepted artifact and do not rewrite historical evidence to make a check green.

After S1 evidence, elaborate/cold-review S2's complete stage contract before dispatch. After S2, do the same for S3. Record `done.md` only after the entire umbrella's required proofs and merges, not when the first stage's code lands.
