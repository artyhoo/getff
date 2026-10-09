# Preserve product intent and check the first working result

> **Status:** Revised draft, 2026-10-07. The operator accepted the skeptical review and requested corrections and clearer names. The earlier GO reviews apply to the superseded design, not this revision. This draft does not authorize implementation.
> **Authoritative for:** the proposed change to product clarification, progressive design and result review; the accepted premises preserved below; explicit distinctions between operator decisions and author proposals.
> **NOT authoritative for:** current skill/runtime behavior, project goals, or execution authorization. Goal: [README](../../../README.md#why-this-exists).

## 1. The experience this change should provide

The operator describes a desired feature. Before discussing implementation, the agent helps them explain what a user will be able to do, why it matters, and what would count as the wrong outcome. They agree a short **product brief**. For substantial work, a separate **intent session** preserves this product understanding while `/arch` designs the solution.

`/arch` settles the shared contracts and risks that could invalidate the solution, then fully designs the **first working result**. Later stages retain outcomes and dependencies, with local details completed just before execution. The first build stage delivers a thin, real path through the necessary parts. The intent advisor observes that result and checks it against the brief. A mismatch leads to repair; an unanswered product preference returns to the operator. Routine success does not require another human approval.

### Worked example: a technically correct result that misses the point

An operator wants a configuration convention to stop direct environment reads locally and help a developer make the correct replacement without guessing.

1. The product brief says: the forbidden read fails the installed local check; the message identifies the relevant code and explains the approved replacement; the corrected code passes. Supporting every language and editor is deferred. An understandable correction is essential even in the first result.
2. `/arch` chooses an existing npm rule in a disposable consumer and designs one complete developer interaction. It does not build a new rule family.
3. The executor assembles it. Ordinary technical checks show the expected fail/pass. However, a deliberately degraded fixture emits only an opaque error code. Detection works, but the promised developer experience does not.
4. The intent advisor receives the brief, raw output and reproduction path, without the expected semantic verdict. It identifies the missing correction guidance and requests a diagnostic/reproduction probe if the supplied output is incomplete.
5. Only expansion relying on this result waits. A repair restores the actionable message; the advisor observes the repaired result and records which promises it demonstrates. Existing authorization then governs continuation.

This is the design's discriminating example. A workflow that merely creates documents and passes a launch check has not demonstrated the intended improvement.

## 2. Scope, alternatives and names

This revision chooses a scoped extension of existing `/arch`, advisor and `/pipeline` responsibilities. A prose reminder alone leaves a missing result review undetected. A repository-wide admission system changes unrelated work before proving the product benefit. The selected middle ground combines a named semantic review protocol with a deterministic check for the feature work that carries that requirement.

There is no repository activation, historical-task census, frozen legacy allowlist, or new receipt for independent small work. Existing plans retain their contracts unless deliberately revised at a stage boundary. The new check does not replace existing authority, fidelity, in-flight or technical-review gates. Host limitations are stated rather than hidden by an automatic downgrade.

### Working vocabulary

These are author proposals under the operator's request to improve all names. Historical decision IDs and recorded wording remain unchanged for traceability.

| Term | Meaning and naming decision |
| --- | --- |
| `/intent` | Proposed command for clarifying and preserving product intent. Replaces the proposed, unshipped `/idea`; no second command or alias is introduced by this spec. |
| `/arch` | Existing command for solution design. Retained to avoid an unrelated public-command migration. |
| `/pipeline` | Existing command for stage execution. Retained for the same reason. |
| Product intent | What the operator wants a user to experience and why. The operator owns changes to that promise. |
| Product brief | Durable agreed description of that intent. Replaces `prep-doc`; remains compatible with `/arch`'s existing document input. |
| Intent advisor | Existing advisor responsibility when interpreting a product brief and reviewing outcomes. Replaces `intent owner`, `meaning owner` and `product agent`; it cannot invent preferences. |
| Intent session | Isolated conversation hosting that responsibility. It is replaceable; it is not the durable record or a new registry role. |
| Stage map | Existing overall outcomes and dependencies. It is not a second machine-readable execution plan. |
| Stage contract | Complete reviewed scope for one stage, carried by its existing kickoff or in-session plan. |
| First working result | Retained, observable path through the parts needed to test essential promises. Replaces the overloaded `Task 1`/`skeleton` terminology in the operative design. It is not the MVP release boundary. |
| Result review | Evidence-based comparison of that result with the brief. It is not technical code review or an approval to execute. |
| Continuation check | Structural validation of the result review required by a particular dependent stage. It does not decide product meaning or calculate the dependency frontier. |

Artifact names follow these responsibilities: `<date>-<topic>-product-brief.md`, the existing stage kickoff/plan, and `result-review.json` within the existing stage artifact directory. The proposed read-only helper is `check-result-review.mjs`. The superseded `progressive.json`, `admission-policy.json` and multi-purpose `stage-readiness.mjs` are removed from this design. This spec's existing filename stays stable so current links continue to work.

## 3. Product brief and separate understanding

The brief starts with a short account of the feature as already available: user, problem, experience and value. Use existing brainstorming/grilling/domain-modeling procedures with a local product-only completion boundary; `/arch` continues the architectural tail. Do not fork upstream skill text. Feasibility findings inform subsequent solution choices; they never silently rewrite the desired product.

Below the narrative, record only the distinctions needed to retain meaning:

- Stable feature ID and a few promise IDs, with observable scenarios and meaningful failure cases.
- Essential promises that the first working result must demonstrate; permitted deferrals and their reasons. An essential promise cannot be deferred merely to obtain a passing review.
- Rejected interpretations and the reasons for important boundaries, including relevant operator wording.
- Accepted decisions, unresolved product questions, and the exact approval reference for this brief revision.

Keep author proposals separate from accepted decisions. Approval applies to a preserved snapshot (Git blob or snapshot plus digest), not whatever a mutable path later contains. A clarification that changes an acceptance distinction is a product change, even if its author calls it editorial. The intent advisor interprets recorded decisions; material promise changes and unrecorded preferences require the operator.

Routing reuses the accepted rules: small precise changes stay in `/arch`; a substantial feature with unclear meaning enters `/intent`; an agreed brief is reused without another interview. Substantial work means maintaining a distinct promise across multiple component/stage decisions, not crossing a document-length threshold. Direct `/intent` is also available. The named `/arch` route reads the canonical procedure explicitly; invocation policy must permit that route without depending on keyword discovery.

For substantial work, prepare the intent session upfront with the brief, decisions and relevant open questions only. If `/arch` mediates the UI, it carries the advisor's questions and the operator's replies without substituting its own answers or importing the architecture transcript. Direct `/intent` hosts the product discussion; architecture continues separately.

Initialization checks understanding rather than receipt of IDs: the advisor explains the experience in plain language, distinguishes one permitted outcome from a plausible wrong interpretation, and identifies unresolved preferences. A disagreement triggers clarification before architecture relies on it. This is a short check, not a repeated interview. The operator receives the accessible explanation required by D-IDEA-EXPLANATION.

Use the existing advisor consultation, journal-before-answer and restoration mechanisms. A native session handle is optional. After context loss, restore from the same brief snapshot, decisions and open asks, and repeat the interpretation check. For result review, use a fresh artifact-only instantiation of the advisor responsibility, so the implementer's narrative and the prior discussion do not supply the verdict. No global `ADVISOR.md` rewrite, new role registry or lifecycle database is needed.

Accepted model allocations in D-Q7 remain defaults, subject to actual host availability. Native child sessions and the existing CC-to-Codex fresh advisor route retain their host authorization constraints. A host unable to isolate or restore the session reports that limit; reading a skill inline does not count as isolation. An explicitly chosen reduced path remains possible under existing rights, but cannot be advertised as satisfying this feature.

## 4. Progressive design and stage contracts

`/arch` owns the complete stage map and shared contracts. Settle a concern upfront when plausible answers change the product promise, a shared interface, decision authority, irreversible state or the ability to judge the first result. Record deferred local choices with an owner and resolution event. Delegate bounded elaboration when it helps preserve the overall picture; a small design stays together.

The first build stage produces the first working result. Necessary research happens before build; a throwaway probe is not renamed as that result. Each later substantial feature identifies its own first result and the stages whose expansion depends on its review.

Each executable stage has its existing complete kickoff/plan: chosen behavior, interfaces, tests, permitted deferrals, required observations, dependencies and escalation/repair path. Later outlines are not execution contracts. Shared decisions live in the shared architecture record; stage-local elaboration lives in the stage contract. The kickoff author expands settled choices and returns genuinely open decisions to their owners.

The feature-bearing stage contract also names:

- The approved brief revision, essential promise IDs, and shared-contract revisions it consumes.
- The result review it will produce or requires before expansion; the evidence needed for each essential promise, including failure/recovery behavior where relevant.
- Its mode: produce the first result, repair a specified mismatch, or expand after a specified result review. These modes describe scope, not extra execution authority.

Existing architecture review checks that essential promises are covered and that later work does not incorrectly omit its dependency on a result review. A helper cannot infer this semantic dependency. An independent task has no new artifact obligation; a child of a feature stage inherits its parent's explicit scope and cannot declare itself independent to escape it.

### Change impact without invalidating unrelated work

Freeze the reviewed stage contract and the specific shared-contract/brief revisions it references. Do not hash the entire evolving architecture document as the approval unit. Later local elaboration or editorial changes elsewhere do not invalidate an unchanged contract. A change to a consumed promise/interface requires a replacement stage contract and review of the affected stages only; the architecture owner records that impact decision.

For result evidence, record the observed revision and relevant source/configuration/environment identities. A new commit alone is not a semantic change. Reuse after a changed repository revision requires the existing technical reviewer to establish that the observed behavior's dependency set is unchanged; uncertain dependencies require new observation. Changes to relevant implementation, brief, essential scope or observations require a new result review. Hashes bind selected inputs; they do not prove that the selected dependency set is complete.

## 5. Result review: judge the experience, not the report

The named **intent result-review protocol** is owned by `/intent` and run through the existing advisor path in a fresh intent session. The independent technical reviewer verifies revision, execution and reproduction; it does not select the product verdict.

The advisor receives the approved brief, first-result scope, relevant decisions, raw observations, reproduction instructions and technical limitations. It first derives the necessary observations from the essential promises, then maps evidence to each promise. The implementer's summary is supplementary. Screenshots, command output, interaction traces or replayable results are required according to the promise; a replay artifact is not mandatory when direct, recorded observation suffices.

If evidence is insufficient, the advisor requests a bounded probe from the existing architecture/execution owner. That owner runs it under existing authorization and returns raw evidence; the advisor can inspect an available result directly within its rights. No response, unreachable environment, omitted failure behavior or contradictory evidence yields `needs-evidence`, never an inferred match.

The structured review records feature/result IDs, brief and stage-contract revisions, observed revision and evidence identities, a promise-by-promise comparison, remaining limits, and one outcome:

| Outcome | Meaning | Effect on dependent expansion |
| --- | --- | --- |
| `matches` | All essential promises for this result have adequate supporting observations; no unresolved contradiction | May continue if ordinary authorization and all other gates pass |
| `mismatch` | Observed behavior contradicts a recorded promise | Hold dependent expansion; permit a separately authorized scoped repair |
| `needs-evidence` | A judgment cannot yet be supported | Hold dependent expansion; obtain the missing observation |
| `needs-operator` | A new preference, disputed interpretation or material promise change needs the operator | Present evidence and alternatives; hold dependent expansion |

An outcome is scoped to its listed promises and evidence; it is not a claim that the whole feature is complete. Removing the failing promise from first-result scope cannot turn a mismatch into a match without the applicable product/scope decision. Independent work continues. An elected personal checkpoint is recorded and remains blocking until an explicit response; without an election or `needs-operator`, routine human confirmation is not added.

## 6. Continuation and recovery within the adopted scope

The existing kickoff or in-session stage contract carries the result-review requirement. Its durable task description/parent launch context carries the same reference through claim, release and resume. There is no separate stage index. Existing cold planning review detects omitted first-result requirements; the deterministic consumer detects absent, malformed, stale or non-matching evidence for a declared requirement. This is cooperative workflow enforcement, not protection from an arbitrary agent stripping all records.

The read-only `check-result-review.mjs` validates identities, required promise coverage, referenced immutable inputs, outcome and any elected operator checkpoint. It rejects conflicting records and paths outside the configured project/coordination roots. It neither writes records nor registers tasks, chooses semantic scope, recomputes the frontier or grants authority. A missing helper blocks a scope that requires it; unrelated launches retain their existing behavior.

Call the same check while preparing dependent work and immediately before its launch effect, including delayed claim release and manual packet consumption. Retain `spec_invalid` non-fallback behavior for declared requirements: no backend task, manual fallback packet or dedup success can convert a failure to permission. Native/in-session consumers invoke the helper through their procedure; hosts without interception provide procedure enforcement, not a runtime guarantee. Unsupported consumption paths are explicitly labeled unverified and cannot count as a successful pilot.

### The executed plan and answers must match the reviewed contract

The AIF description is the kickoff input; the planner's `plan` is a separate output (`packages/runtime-bridge/src/AifHandoffBackend.ts:336`). Existing technical plan review must map that output to the stage contract before implementation. Bind the reviewed effective plan revision to the task's existing review record. A kickoff digest alone is insufficient.

Before an answer changes the plan or restarts feature work, the existing architecture/technical review owner classifies the proposed effective plan and answer together: within the current contract, contract revision needed, or product decision needed. The classification is journaled with exact proposed payload identity. Within-contract answers use the current contract; contract changes require its replacement and affected checks; product questions return to the intent advisor/operator. Missing classification holds that restart. This requirement applies to plan-changing/restarting actions within this feature scope, not status updates or unrelated task answers.

At the `answer.ts` write/event boundary, compare the current task/plan with the reviewed pre-image and the proposed update with the recorded payload. If either changed, do not write or resume; re-read and re-review. Existing runtime paths without an atomic conditional update need a serialized existing task-owner path; if that path cannot exclude concurrent writers, automatic contract-changing resume is unsupported until that prerequisite is resolved. Do not claim a local file hash alone makes a remote update atomic. The selected pilot must demonstrate this supported path before it uses contract-changing resume.

### Minimal publication and recovery rules

A result review is one complete immutable record, published under a unique attempt ID in the existing stage artifact directory. Write its observations first, then atomically rename a complete record into place on the same filesystem. The existing decision journal references that record; it does not duplicate its fields. A stage contract references the exact accepted attempt, never “the latest” file. No multi-file transaction or global state database is introduced.

| Event | Recovery |
| --- | --- |
| Session lost | Restore from immutable brief/decisions; rerun the understanding check |
| Crash before record publication | Ignore incomplete temporary data; rerun the observation/review |
| Record published but not journaled/selected | Treat as an orphan, not approval; owner verifies and completes the existing journal/contract handoff |
| Duplicate retry | Reuse the same completed attempt only when all bound inputs match; otherwise create a new attempt |
| Concurrent differing answers/reviews | No last-writer-wins selection; the existing stage owner resolves the conflict explicitly before continuing |
| Claimed task has old contract | Keep paused; existing reprepare/cancel path binds the reviewed replacement; do not overwrite identity silently |
| Artifact moved/unavailable | Resolve immutable content through the configured coordination root; absent verifiable content holds affected work, never assumes success |
| Repair needed | Reviewed repair contract identifies the mismatch, permitted changes and existing authority; it does not require a passing review of the result it is repairing |

Repair produces new evidence and a new result review. A failed repair does not authorize expansion. No automatic global legacy migration or compatibility allowlist is part of recovery.

## 7. First implementation slice and acceptance

These are stage outcomes, not an executable plan or launch authorization.

| Stage | Retained outcome | Dependency |
| --- | --- | --- |
| S1 — Observe and correct | `/intent` brief and restoration, one real first result, blind mismatch detection, scoped continuation hold, authorized repair and successful recheck on the existing factory route | Approved revised spec and execution plan/channel; available existing transport |
| S2 — Recover and extend | Lost-session recovery, later-feature review, effective-plan/answer changes, independent-task compatibility and affected-only invalidation | S1 evidence; repairs may run under the repair contract |
| S3 — Deliver supported routes | Env/factory installation, native discovery and proofs for the remaining advertised execution paths | S2 acceptance; unsupported routes remain explicitly unverified |

S1 includes the loading, technical plan binding and continuation checks its route actually uses; delivery breadth is later, not its correctness prerequisites. Its build work may be decomposed into tasks, but the first stage closes only with the complete working result. Actual host commands/settings are verified before execution. Retain D-Q7's configured Codex/CC/GLM route; a different channel is an explicit operator choice under existing routing.

Use the supported configuration-access fixture and npm backend (`packages/core/composition/fixtures/no-direct-process-env.node.json`, `packages/core/backends/npm/from-node.test.ts` and `firing.test.ts`) in a disposable consumer. Keep the workflow implementation; discard the consumer test setup. The pilot is an operator-run semantic exercise, never paid inference in CI.

Run both a behaviorally matching result and a technically passing but semantically deficient variant of that consumer. In the latter, preserve correct forbidden/allowed detection while degrading the correction guidance in the disposable fixture only. Do not modify the production rule family. Present raw output without labels identifying the expected semantic outcome. The intent advisor must identify the violated promise, request missing evidence when necessary, and distinguish the repaired result. If the available fixture cannot express this contrast, resolve the pilot design before S1 execution rather than replace the test with a prewritten verdict.

| Acceptance | Required evidence |
| --- | --- |
| Meaning retained | Brief and restored session distinguish the intended interaction from a plausible wrong interpretation; no duplicate interview |
| Real semantic discrimination | Actual advisor judgments on the matching and deficient results, citing raw observations and promise IDs; a prepared `mismatch` JSON is not evidence of this capability |
| Evidence challenge | An incomplete observation package produces a probe request/`needs-evidence`, then a judgment after the missing observation |
| Scoped hold and repair | A dependent launch has no effect with missing/stale/mismatch evidence; authorized repair runs; repaired result is observed again before expansion |
| Effective plan fidelity | A changed planner output or parked answer cannot restart on the old plan binding; a reviewed within-contract answer can |
| Local change impact | Detailing an unrelated stage preserves valid evidence; changing a consumed promise/interface/implementation invalidates affected checks |
| Compatibility | An independent bounded task runs through ordinary gates without activation, a new receipt or a result review; an adopted child retains parent requirements |
| Recovery | Lost session, incomplete publication, orphan record, duplicate retry and conflicting attempts follow section 6 without accidental permission |
| Later feature and human choice | A second feature requires its own result review; an elected checkpoint waits, routine matching results do not request human approval |
| Delivery | Fresh install/refresh include the actual dependencies; a native card alone is not execution or context-isolation proof |

Deterministic CI tests cover record validation and real call-site effects with paired positive/negative fixtures; they do not certify semantic judgment. Extend existing frontier, split-claim, non-fallback, answer and backend suites only for declared feature scope. A negative with the requirement removed from one channel must still be caught when a standing claim/parent retains it; a wholly undeclared new feature is the planning-review omission case, not a hash-check claim.

Observe D-SUCCESS's four dimensions together: first-result fidelity, misunderstanding-driven redesign, operator interventions and total effort. Record the incremental cost of initialization, review, evidence probes, repair and false holds using existing logs/manual observations; no new telemetry service or numeric target is introduced. One pilot establishes composition and demonstrated discrimination on that route, not long-term savings or model equivalence. If extra context/steps do not help distinguish the deficient result, revisit the mechanism instead of expanding delivery by default.

## 8. Existing owners and delivery changes

Reuse is grounded in [prior-art SSOT](../../meta-factory/prior-art-evaluations.md) #201 (advisor strategy), #253 (interview/domain vocabulary) and #64 (SDD inner loop). Their upstream problem classes cover consultation, clarification and scoped execution review; they do not validate product-intent discrimination. The pilot tests that added use. Existing advisor restoration is explicitly legal in [advisor design](2026-08-10-advisor-pattern-design.md). No new transport, model router or claim about the absence of external alternatives is made.

| Surface | Proposed change |
| --- | --- |
| New `.claude/skills/intent/SKILL.md` and focused references | Clarification boundary, brief format, restoration check and named result-review protocol; no fork of companion text |
| `/arch` ideation and exit references; local skill-routing binding | Explicit `/intent` route, progressive contract boundary, domain-modeling permission in product discussion, complete first-result scope |
| `/pipeline` stage template, dispatch; `/dispatcher` execution/parks | Existing stage/answer reviews carry declared result dependencies, continuation checks and scoped repair |
| Orchestrator/native queue, SDD exit and launch-card procedures | Preserve parent scope; check at actual launch/consumption; state procedural limits |
| Runtime dispatch, claim/release, answer, fire/manual effect consumers | Narrow adapter to the same checker for declared/standing feature contracts; effective-plan binding; ordinary unscoped behavior preserved |
| Advisor transport guidance | Fresh product-only instantiation, evidence requests and restoration within existing rights |
| Env/factory install and refresh; native discovery; runtime vendor delivery | Ship `/intent` beside `/arch`, helper and reference dependencies; regenerate derived copies from canonical sources |

`setup.d/lib.sh:64` already places arch/pipeline/orchestrator at env depth. Dependencies for `/intent` must work there without factory-only links. The separate plugin-only skill roster is not expanded. Do not edit upstream caches or global settings. The implementation plan must map every selected consumer to a call-site test; the broad runtime integration is scoped by declared feature contracts, not by repository activation.

## 9. Revision decisions, provenance and limitations

### Current author proposals

These rows are proposed design resolutions, not historical operator votes. The operator authorized this rewrite after accepting the critique; approval of the rewritten artifact is still distinct.

| ID | Status | Proposal | Reason to revisit |
| --- | --- | --- | --- |
| R-NAMES | proposed | `/intent`, product brief, intent session/advisor, stage contract, first working result, result review | Users cannot predict responsibilities or routinely confuse an artifact with a session |
| R-SCOPE | proposed | Check declared feature dependencies; remove global activation and bounded-work receipts | Planning review repeatedly misses adoption and a measured narrower enforcement improvement is needed |
| R-EVIDENCE | proposed | Fresh advisor derives observations from promises and can request probes; blind deficient-result pilot | Correct detection depends on revealing expected outcomes or architect interpretation |
| R-VERSIONS | proposed | Bind scoped contracts and observations, not the whole changing spec | Unrelated work still invalidates checks or relevant changes escape impact review |
| R-RECOVERY | proposed | Immutable attempts and exact selection through existing journal/contract; explicit effective-plan review | Existing task ownership cannot serialize a required update; resolve before advertising automatic resume |

The earlier D-ENTRY/D-CONTEXT/D-READINESS/D-PILOT/D-DELIVERY/D-LEGACY author resolutions are superseded by this revision. Accepted operator requirements below remain binding; their historical `/idea` and `Task 1` spellings map to the new vocabulary, not to removed functionality.

### §1.7 Forward-check applied

`README.md:51` requires executable enforcement at the earliest reachable channel. Here structural omissions for declared contracts use a scoped deterministic check; semantic adequacy uses the named cold intent result-review protocol, not a hash or bare attention. `.claude/rules/rule-enforcement-channel-selection.md:21` separates those duties. SSOT #201/#253/#64 support the reused procedures, not unmeasured semantic efficacy. No runtime has been edited and no paid CI inference is proposed. This revision applies its own product-first rule through section 1 and distinguishes author proposals from operator decisions.

### §1.7 Backward-check applied

Class = product clarification, result review and dependent continuation. Source surfaces include `/arch` ideation/exit, pipeline stage templates/dispatch, dispatcher execution/parks, native/orchestrator launches, runtime dispatch/release/answer and backend effects, advisor restoration and env/factory delivery. `packages/runtime-bridge/src/cli/answer.ts:344` changes the effective plan, so kickoff-only validation is explicitly insufficient; `setup.d/lib.sh:64` establishes the env delivery requirement. Sections 6–8 specify obligations for these consumers, not claims of deployed checks. Historical plans, independent small tasks, unrelated skills and upstream caches are exempt from this new contract; compatibility positives and inherited-scope negatives test that boundary. New substantial authoring is checked for omitted result dependencies by existing cold planning review. A cold class-only source sweep enumerated eight groups: authoring, design review, routing, stage advance, alternate launch/resume, consultation answers, early checks, and delivery/native discovery. It confirmed the existing structural gaps in result evidence and the procedural limits of native launch; sections 4–8 address these as proposed changes, not existing capabilities. The open-questions trigger sweep did not turn this workflow pilot into the separate L2 semantic-drift or real-corpus research programs. Live behavior remains unverified until the authorized pilot.

## 10. Preserved operator premises and decisions

The following record is retained from the prior spec and recovered discussion. `accepted by operator` describes the historical decision, not approval of this rewritten implementation. Model names and historical command names are provenance, not permission to change runtime settings. D-ENTRY was an author proposal and is therefore excluded from the accepted register.

These entries preserve the meaning of the operator's statements in context. They are not a claim that every design proposal has been accepted.

- **P1 — Two possible failures.** A model may begin designing before it understands the idea. It may also lose the idea while handling too many details. In the reported experience, keeping one session focused on the whole and having other sessions investigate details and return findings worked better. The causal explanation remains a hypothesis, not a measured diagnosis.
- **P2 — Product before implementation.** The operator wants the future feature described as already available: what it does, what it gives the user, and why that is valuable. The core should be general and abstract, with minimal facts and no implementation detail. Realizability is not a prerequisite for first understanding the goal and concept.
- **P3 — Abstraction with meaning.** The original accepted principles remain: anchor the desired outcome in reference scenarios and boundaries; permit targeted factual checks when they affect a concrete product choice, then return to the idea. Keep these anchors concise so that they support, rather than bury, the overall picture. P2 rejects an up-front feasibility filter, not the previously allowed targeted checks.
- **P4 — Preserve intent while learning.** The AI must not silently make the task easier by changing its meaning. The operator also rejects dogmatic execution of an unsuccessful initial formulation. How material changes are authorized remains part of the discussion.
- **P5 — Reuse existing capabilities.** Account for brainstorming, writing-plans, pipeline stages, the advisor, consultation between GPT and Claude Code, and the independent architectural reviewer before adding roles or steps. Plugin source copies are not to be edited for local extensions.
- **P6 — A skeleton concerns learning and assembly order.** It is a thin, meaningful working path through the necessary parts, not the serial completion of horizontal layers. It is distinct from choosing the MVP release scope. The kickoff author owns making it the first executable stage; the code is produced during execution.
- **P7 — Vertical slicing has several scales.** The operator explicitly proposed slices at spec, kickoff and execution levels. Do not treat slicing as available only after design. The relationship between those scales still needs to be worked out.
- **P8 — Discussion before formalization.** The operator wants a strong interlocutor who challenges assumptions, offers alternatives and recommendations, and conducts a pre-mortem. Clarifying questions and silence are not agreement. Saving this note is now authorized; it does not approve a finished design.
- **P9 — Improve the existing workflow; keep responsibilities distinct.** The operator explicitly says this is a refactoring/improvement of the existing `/arch` and `/pipeline`, not a wholesale replacement. They welcome an early tracer-bullet check as a direction and identify choosing/designing that solution as `/arch` work rather than `/idea` work. This correction does not itself authorize skill edits, formal artifacts or execution.

### Earlier accepted decisions

The falsifiers below are author-proposed conditions for revisiting a direction, not additional operator-approved requirements. This initial saved register transcribes decisions made explicitly in the preceding chat; later decisions are to be recorded as they settle.

| Decision | Historical status | Resolution and provenance | Falsifier / reason to revisit |
| --- | --- | --- | --- |
| D-Q3: consultation responsibilities | accepted by operator | Operator agreed to the recommendation and clarified that the upper interlocutor is `/idea`: parts consult the general `/arch`; it consults `/idea` about intent; independent review stays distinct. | Every technical question climbs the entire chain, or local decisions change the promise without reaching its owner. |
| D-Q4: purpose and output of idea clarification | accepted by operator | Operator accepted the recommendation with a sharper constraint: first understand the product problem, concept and observable success through a short account of the finished feature, abstract and free of implementation/feasibility detail. Reference scenarios, boundaries and named assumptions remain anchors, not an exhaustive spec. | A persuasive narrative still supports incompatible interpretations of the main user experience, or detailed analysis again displaces the concept. |
| D-IDEA-EXPLANATION: closing the idea discussion | accepted by operator | Operator explicitly requires an accessible explanation of the idea at the end, analogous to the existing plain-language explanation of the future solution at the end of `/arch`. This requirement does not mean the current discussion is complete. | The operator receives only a document or technical detail and cannot assess the intended experience. |
| D-Q5: dividing design work | accepted by operator | Operator accepted the flexible principle: a bounded design question may cover a capability or a shared part; the general `/arch` keeps scenarios and relationships. The operator additionally requested a way to judge the amount of work/context. | Parts cannot be reconciled without the general session absorbing all their internals, or splitting creates more coordination than useful clarity. |
| D-Q6: `/idea` participation during implementation | accepted by operator | Operator explicitly selected the recommendation: option B, available on demand through the existing advisor path. Interpret agreed intent and propose changes; material changes to the goal return to the operator. | Meaningful drift repeatedly goes unnoticed because nobody recognizes the need to consult; reassess targeted checkpoints then. |
| D-Q7: default model allocation and consultation | accepted by operator | Operator accepted Q7: Astra/Fable for idea discussion; Sol 6.1 high/Opus high for architecture and specs; Sol 6.1 medium/Opus medium for kickoff; GLM for execution, with consultation for unresolved questions. The operator emphasized that the advisor pattern and communication between sessions already exist and are configured. Use that mechanism; no new consultation role or obligatory phase restart is implied. Independent review remains. | Existing consultations fail to resolve gaps, or savings are outweighed by rework and coordination. |
| D-SIZE / Q8: when and how much to delegate | accepted by operator | Operator agreed with the bounded-result/explicit-relationships principle and refined the sequence: always establish the most general useful picture first, then elaborate details; if that picture is large and substantial detail is foreseeable, split elaboration across sessions. Simple tasks need not split. Assess scale early, rather than waiting until the context is already overloaded. | A size rule rewards splitting by document length, or forces session overhead on simple tasks, rather than preserving the overall picture. |
| D-PLAN / Q9: how far ahead to detail executable plans | accepted by operator | After clarification that Q9 concerns kickoffs/execution plans after an agreed spec, operator accepted recommendation B: retain the overall stage map, outcomes and dependencies; detail the first stage, then fully detail each later stage before its own execution using earlier feedback. Every dispatched stage still needs a complete executable contract. | Early feedback invalidates extensive planning, or insufficient foresight causes avoidable interface rework. |
| D-CHECKPOINT / Q10: operator after the first skeleton | accepted by operator | After the example, operator chose a hybrid A+B: reviewer and advisor can assess the result themselves; avoid unnecessary operator interruptions, but sometimes seek the operator's own check. This accepts the principle, not a mandatory review of every feature. Reviewer findings and advisor decisions retain their existing distinct roles. | Routine checks unnecessarily become operator gates, or agents repeatedly miss a mismatch with the intended experience. |
| D-CALIBRATION / Q11: repeated meaning check | accepted by operator | Operator favors B, emphasizing that `/idea` can check meaning: agree and verify understanding initially, then recheck and clarify it against the first result of each substantial new feature. This settles the timing of a meaning check, not an unconditional operator approval requirement. | The second check merely repeats the original description without comparing actual behavior, or becomes an unnecessary human approval queue. |
| D-HUMAN-CHECK / Q12: operator participation in the second meaning check | accepted by operator | Operator accepted the recommendation: `/idea` performs the second meaning check autonomously and consults the operator for unrecorded or unclear expectations, disputed results or material changes to the goal. No mandatory personal confirmation for every feature. | An agent silently resolves a new product preference on the operator's behalf, or routine checks again become compulsory operator approvals. |
| D-AUTO-ENTRY / Q13: who controls the transition | accepted by operator | Operator selected A in the revised Q13: `/arch` automatically chooses the appropriate discussion route and briefly explains a transition to `/idea`, without a separate command-selection approval. Direct `/idea` entry remains available. This authorizes workflow selection, not choosing unrecorded product preferences or declaring the idea agreed. Exact packaging and context-retention conditions remain under D-ENTRY. | Automatic routing repeatedly causes redundant interviews or loses continuity, or agents mistake routing autonomy for authority over product goals. |
| D-INTENT-CONTEXT / Q14: when to prepare the intent context | accepted by operator | Operator replied A to the round recommending A for both Q14 and Q15; recorded as batch acceptance and stated as that interpretation in chat. Prepare a separate product-level context up front for substantial work, using the agreed description without a repeat interview or continuous activity. Small tasks can remain in `/arch`. | The separate context adds coordination cost without improving later meaning judgments over restoration from the record. |
| D-SUCCESS / Q15: how to evaluate this improvement | accepted by operator | Same batch reply as Q14. Assess several observable outcomes together: fidelity of the first working result, redesign caused by misunderstanding, operator intervention, and total time/model effort. No numeric targets or telemetry implementation are authorized. | The observations cannot support a clear keep/change decision or fail to expose material trade-offs. |
| D-DESIGN-BOUNDARY: incremental improvement and early verification | accepted by operator | Operator corrected the scope to improving existing `/arch` and `/pipeline`, welcomed checking the change early through a tracer-bullet approach, and located design of that approach in `/arch`. The author accepts this boundary correction. This accepts the direction, not the full A/B package of Q16 or a specific first implementation slice. | The improvement duplicates existing capabilities, or idea clarification again starts prescribing architectural sequencing. |

### D-Q16 — accepted architectural boundary

Operator accepted the refined boundary with "go": settle shared contracts, intent retention and continuation authority upfront; elaborate local later-stage choices before their stage, with earlier investigation whenever they could invalidate the whole. Revisit if deferred choices repeatedly invalidate shared contracts or force replacement of the first working result.

## Consensus retell

Baseline: none — no operator-confirmed written-spec commit is recorded; the current rewrite is authorized, its exact design proposals are not yet approved.

| # | Claim | Source |
| --- | --- | --- |
| 1 | Understand the finished product experience before choosing implementation. | P2 + P3 |
| 2 | Improve existing arch/pipeline and reuse their advisor/review mechanisms. | P5 + P9 |
| 3 | Prepare separate product understanding for substantial work without repeating an agreed interview. | register D-INTENT-CONTEXT (blanket) |
| 4 | Check the first working result autonomously; missing preferences and material promise changes return to the operator. | register D-CALIBRATION + register D-HUMAN-CHECK |
| 5 | Settle shared risks upfront; complete each stage's detail before it executes. | register D-Q16 + register D-PLAN |
| 6 | Evaluate fidelity, misunderstanding-driven redesign, operator intervention and effort together. | register D-SUCCESS (blanket) |

### Unconfirmed — author derivations

- Exact names and packaging in R-NAMES.
- Scoped continuation bindings, contract versioning and recovery in R-SCOPE/R-VERSIONS/R-RECOVERY.
- Evidence protocol and pilot details in R-EVIDENCE, plus the delivery stage map.

## Historical reviews and current verification

The superseded design was reviewed at `7f038be7e1205a3f846a418dbec4d12168382930` (round 1), `c534d7a435756b1535b06fe22127c78cbd84ef0d` (round 2), and `5a8844effb9a93eaba9f22f5e05ffc73edeacea7` (round 3). Reports remain unchanged: [top-down r1](reviews/2026-10-07-idea-arch-top-down-r1.md), [bottom-up r1](reviews/2026-10-07-idea-arch-bottom-up-r1.md), [top-down r2](reviews/2026-10-07-idea-arch-top-down-r2.md), [bottom-up r2](reviews/2026-10-07-idea-arch-bottom-up-r2.md), [top-down r3](reviews/2026-10-07-idea-arch-top-down-r3.md), [bottom-up r3](reviews/2026-10-07-idea-arch-bottom-up-r3.md). Their closure of global admission findings is not transferred to this different design.

The current rewrite responds to the operator's accepted skeptical review: product scenario first; scoped enforcement; actual semantic discrimination; independent observation requests; contract-level freshness; effective-plan binding; recovery semantics; understanding checks; essential-promise protection; consistent vocabulary; separate proposal/approval states; and a readable explanation. This is a design revision, not implementation or live validation. After approval, the existing planning and execution-channel selection process remains applicable.

Current verification (2026-10-07): a fresh artifact-only reviewer read the full revised draft and returned GO with no mandatory findings, scoped to design consistency rather than execution or semantic efficacy. Reviewed content SHA-256: `70e10630ac4c2d70fbae7d55f67d603bb169ab6d2b0876e2589c86709bee1827`. The subsequent edits only record the completed source sweep and this verification. All nine operator premises and fifteen accepted decision rows were checked against the pre-edit document; their text is preserved (decision status labels now distinguish historical acceptance). Consensus-retell validation, relative-link existence and whitespace checks passed. Citation targets were read directly; the citation-drift tool cannot validate blame history for uncommitted lines, so no full historical citation-validation claim is made. No runtime code or installed skill was changed.
