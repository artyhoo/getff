# Dot staging review gate — launch preflight and implementation kickoff

> **Status:** final documentation handoff; autonomous launch BLOCKED; not dispatched. Setup and implementation receipts remain pending.
> **Canonical operating prompt:** [DotStagingReviewV1](../../meta-factory/dot-review-protocol.md), `dot-staging-review/1.0`.
> **Setup manifest:** [durable handoff](../../meta-factory/dot-review-handoff.md#setup-manifest).
> **Authoritative for:** future execution order, scopes, prerequisites and verification receipts for this operator-only integration.
> **NOT authoritative for:** project goal — [README](../../../README.md#why-this-exists); platform capability; live settings; current authorization to implement or dispatch.
> **Specification:** [Dot staging review gate](../specs/2026-10-05-dot-staging-review-gate-design.md).
> **Rigor label (L0):** `build-and-verify` — after approval, paired-negative tests and native live admission receipts are required.

## 0. Authority and publication prerequisite

The present request authorizes design/document work only. Do not implement, commit, push, merge, change live GitHub settings, arm auto-merge or launch workers from this document. Dot reviews must run in Dot's own cloud environment, without local/Work/Codex delegation, native Codex review, external model APIs or purchased credits. Own background agents remain prohibited until the operator explicitly permits them and identifies the route.

This review copy deliberately lives outside the dispatch catalog. After operator approval and separate execution authorization, publish the approved spec and a canonical `.claude/orchestrator-prompts/dot-staging-review-gate/kickoff.md` through a staging PR **before** any pipeline/aif execution dispatch. This session cannot satisfy that prerequisite because commit/push/merge were excluded. Read [kickoff placement](../../../.claude/rules/kickoff-staging-placement.md); create a real tracked file in the same write/stage operation and verify index mode 100644, never a CANON symlink. Use exact `kickoff.md`; future stage files require recognized names and explicit tracking exceptions.

Publication does not authorize workers. Any future execution method must obey the operator's explicit background-agent route decision. Run [the in-flight probe](../../../.claude/skills/dispatcher/helpers/probe-inflight.sh) for the umbrella before execution and again after any review and before outward acts; PROBE-INCOMPLETE is not a clean result. Enumerate host and container branches, finished unharvested tasks and current worktrees, not only open PRs. No stage may have two owners.


## Dot launch — publication prerequisite and copy-paste bootstrap

The canonical runtime prompt is the protocol linked above; do not reconstruct it from this implementation kickoff. The final conflict-owner decision is executor-only merge-forward and fresh CI/review; Dot never repairs conflicts, edits code, pushes or merges. No background agents are authorized.

Before autonomous launch, an authorized publication owner must land protocol/schema/handoff and this kickoff on staging, obtain operator approval for the exact immutable protocol/manifest commit and hashes, fill every setup field, and prove deployed services and persisted Dot schedule. No commit/push/merge is requested here. A future pipeline/aif kickoff must also be a tracked regular file on staging before any separately authorized dispatch. This document has no auto-dispatch marker and grants no implementation authority.

The following standalone message is safe to paste before those prerequisites exist. It authorizes a read-only preflight, not provisioning or an admission launch. It points to the future staging location; immutable approval must precede using the contents as operating authority. If the canonical files are missing, this bootstrap is sufficient to report the publication blocker.

```text
You are my one independent Dot reviewer for https://github.com/artyhoo/getff, target staging; main promotion remains manual. Perform a read-only launch preflight for DotStagingReviewV1, protocol dot-staging-review/1.0. The canonical publication location is https://github.com/artyhoo/getff/blob/staging/docs/meta-factory/dot-review-protocol.md; setup evidence is docs/meta-factory/dot-review-handoff.md. These may not yet be published. Obtain the operator-approved immutable commit/digests and completed setup manifest before adopting the protocol. If missing, report LAUNCH BLOCKED with the exact publication/setup actions and stop. Do not invent configuration.

Work directly in your own Dot cloud environment. Keep local access disabled. Create no Codex, Work, native Codex review or background-agent tasks; use no external model API, purchased credits or paid fallback. Remain a reviewer: never edit repository code, repair conflicts, push or merge. The executor merges current staging into the feature branch, resolves conflicts, reruns CI, then you review the new revision independently.

Verify actual ledger/write routes, authenticated JSON schema/publisher, credential isolation, native revision freshness, and a saved recurring schedule by task ID/configuration read-back. Require an explicit operator-selected authorization expiry; no guessed promotion end or reset. This bootstrap does not create a schedule. Until full preflight passes, return prerequisites only: no GitHub writes, admission approval or autonomous-operation claim. Once an approved setup authorizes operation, follow the pinned canonical protocol on every start/resume.
```

A later activation message must identify the approved manifest, its immutable release, selected mode and expiry; it cannot merely say “go” while setup is unresolved. Dot verifies the saved responsibility and wake/resume receipt, then begins the canonical queue. A source-only fallback must be explicitly selected and remain report-only; it is not full autonomous setup.

## 1. Read first and frozen scope

Read README goal/invariants, AGENTS, session bootstrap and CLAUDE; specification §§1–13; prior-art SSOT #38/#41/#116; existing automerge plan; audit-self/workflow-integrity and required-context tests/local sweep. Apply no-paid-LLM-in-CI, attention-is-not-a-mechanism, build-first-reuse-default, doc-authority-hierarchy, source-before-shape, destination-environment-verification, kickoff-staging-placement, CI-tool-pinning and language-discipline rules before editing their surfaces.

Reuse named existing reviewer prompts directly within the Dot protocol. Do not convert them into agents or new shipped consumer features. Main promotion, setup.d, installed consumer templates, model billing and organization migration are outside scope. Do not edit `.claude/settings.json`, goal/invariant sources or live settings during implementation stages; configuration promotion is operator-owned S5.

The observed repository is public personal-owner `artyhoo/getff`, ID `1231007068`, default staging. Current protection has strict:false and three checks, while local workflow-integrity declares six. Refresh all observations from the live API before shaping implementation; this checkout was behind live staging at design time.

## 2. Prerequisites — no completion claims yet

| ID | Required receipt | Current state |
| --- | --- | --- |
| P0 | Written spec/kickoff approval and explicit execution route/authorization | Pending |
| P1 | Approved canonical kickoff/spec present on origin/staging; regular tracked blobs | Pending |
| P2 | Actual Dot account eligible, subscription-only policy/expiry confirmed, local/delegation routes excluded | Unverified |
| P3 | Dot-accessible GitHub/browser/plugin credentials cannot merge/write checks; enrolled non-writer principal | Unverified |
| P4 | Approved hosting, database backups, secret ownership, actual publisher/reporter Apps and source IDs | Unprovisioned |
| P5 | S0 proves ordinary authenticated browser submission can run unattended on actual Dot | Unverified |
| P6 | S0 proves M-only expected-App check + strict native auto-merge, race and alias behavior | Unverified |
| P7 | Mechanical context inventory and three-versus-six discrepancy resolved with receipts | Pending |
| P8 | Narrow admin-read configuration observer and armer permission boundary proved | Unverified |

If P3 conflicts with shared operator plugin access, present the exact account-wide downscoping versus supported isolation tradeoff. If cryptographic model attestation is demanded, STOP: OAuth is not it. Do not invent an installed App, MCP action, signing key, Dot webhook or guaranteed allowance endpoint.

## 3. Concrete sequential stages

### S0 — feasibility and enrollment proof (operator-supervised)

Scope: read-only evidence record under `docs/meta-factory/research-patches/`; approved disposable GitHub branch/ruleset/PR objects only after separate live-test authorization. No staging/main settings change.

Verify owner/visibility/default branch, protections, rulesets, installation inventory through an authorized read route, current plans/queue eligibility and official docs. Record raw commands, timestamps and non-secret outputs. Inventory all Dot-accessible credentials; do not mistake prompt restrictions for denied permissions. Demonstrate Dot cloud browser claim/submit under enrolled identity, session renewal and unattended execution; no local fallback.

Prototype disposable expected-App check on current `refs/pull/<n>/merge` and strict rules. Prove new head/base, stale M, alias PR and fallback-to-head behavior with native merge outcomes. This requires separately authorized minimal test infrastructure; it is not permitted by this design request. Confirm reporter cannot merge and publisher has no contents write. Determine armer's minimum permissions and isolate its broad credential behind validated endpoint routing.

Exit: P2/P3/P5/P6/P8 proved or specific STOP with supporting error/output. If M check is unsupported or aliases invalidate per-PR authorization, do not proceed to enforcement implementation on a weakened premise. Present organization+queue or explicit revision-scoped alias policy as a new operator decision. No polling solution.

### S1 — trusted contract and mechanical inventory

Proposed operator-only file scope: `scripts/dot-review-gate/schema/`, `scripts/dot-review-gate/policy/`, `tests/dot-review-gate/`, spec amendments, and a prior-art SSOT entry only if missing glue needs BUILD justification. Confirm the actual repository's test/module conventions before creating these paths. Nothing is installed by setup.

Consume the single [draft-2020-12 schema artifact](../../meta-factory/dot-review-result.schema.json), implement strict parser, limits and validator; freeze protocol/version and identity/revision rules. Design a trusted policy manifest of mechanical contexts, actual workflow/job identities and load-bearing code versions. Separate Dot context from readiness. Include proposed-source and workflow changes in policy promotion rules; PR cannot self-promote trust.

Reconcile workflow-integrity, principle 37, local sweep and real settings without faking an external check as a workflow. Preserve all current mechanical gates. Complete expanded prior-art research before any BUILD trailer; this kickoff does not substitute its design survey for that requirement.

Exit: negative schema/revision/source/inventory tests reject every non-authorizing case; run IDs correctly link to exact H/M; trusted manifest change needs explicit promotion. A valid JSON report alone is never labeled quality-approved.

### S2 — intake, queue, ledger and isolated publisher

Scope: `scripts/dot-review-gate/` operator service adapters, `tests/dot-review-gate/`, deployment/runbook docs. Credentials belong to external secret storage, never repository source or PR Actions secrets. Hosting provisioning needs separate authorization.

Implement browser OAuth intake with explicit empty scopes, principal ID allowlist, CSRF/state/cookies and one-use tuple-bound challenge. Implement transaction/outbox, immutable report hashes, stable generation IDs, one active lease, baseline/history queues, coverage dashboard and backup/restore. Native GitHub events use validated HMAC and delivery deduplication; event gaps are reconciled but never used as a freshness guarantee.

Implement publisher with selected-repo checks-write identity, App source verification and M-only success. All non-GO/COMPLETE paths fail; missing reports cannot become skipped/neutral. Revalidate tuple, mechanical attempts and configuration. No PR checkout/import/package execution with its secrets. Control-plane releases remain operator-promoted and immutable.

Exit: replay/crash/restart/duplicate tests prove one logical receipt and side effect; report-store restore works; forged submissions and PR code cannot reach secrets or trusted publication.

### S3 — Dot protocol, feedback and observation mode

Scope: operator-only protocol/runbook under `docs/meta-factory/`, reporter and separate armer adapters in `scripts/dot-review-gate/`, corresponding tests. Reuse reviewer prompts as inputs; avoid consumer agent/setup edits.

Enroll assigned scheduled Dot responsibility in its own cloud environment. Verify submission write behavior is permitted there; proactive research restrictions are not waived by this kickoff. Full changed-file/principle/spec/dimension inventory; correctness, architecture, goals, standards and anti-tautology review. Establish baseline of current staging including exact-revision `make self-audit` in a proven credential-free sandbox or trusted exact-SHA CI that actually executes it; isolation absent means explicit incomplete coverage and follow-up, not running source in the authenticated environment.

Reporter owns one updated PR summary and stable inline findings. No issues for open PRs. Historical merged-unreviewed queue is newest-first only after current baseline; independently verify defects still in current staging and deduplicate issues. Separate historical reports from admission records. Observation context is `dot-review/observe-v1`; never required. No auto-merge arming until its separate authorization exists.

Exit: real authenticated Dot report received with provenance; all dimensions/limitations visible; summary edits deduplicate; historical GO cannot publish admission; billing/expiry uncertainty pauses without purchased fallback.

### S4 — disposable native matrix and semantic calibration

Scope: tests, evidence receipts and runbook; separately authorized disposable objects only. Run every row of spec §10, including current GO positive, wrong-App spoofing, base advance immediately after success, simultaneous PR merges, alias PRs, revoked credentials, workflow injection, mechanical reruns and native pause with prior success.

Use independently adjudicated seeded defects across goals/principles/spec/correctness/architecture. Independent review must use an operator-approved route; current own background-agent ban remains active. Self-review is not independent calibration. Capture rule/API snapshots, before/after refs, report/check IDs and native outcomes; a conflict is not evidence of gate denial.

Exit: all expected outcomes proved, known blockers found, baseline complete at current staging, secrets isolation verified, restore drill successful. Produce readiness report listing measured coverage and remaining failures. Any unresolved negative test blocks S5.

### S5 — operator configuration promotion and controlled admission

Scope: operator-approved live staging ruleset, expected App source binding, armer enrollment and operational docs. Implementation workers never receive settings-admin credentials.

Save old configuration. Activate native pause, verify no bypasses/admin exceptions and required-PR/direct-push restrictions. Add `dot-review/v1` bound to actual publisher integration ID, strict checks and reconciled mechanical set; keep classic protection until equivalence proved. Preserve PR_TITLE/PR_BODY, native squash auto-merge and main promotion boundary. Configuration observer verifies the exact API values; workflow-integrity warn-pass is insufficient.

Only after checks/reporting and configuration evidence are complete, remove native pause and demonstrate one authorized staging admission. Other pending PRs obtain fresh generations. Update automerge-staging-plan, CLAUDE's old merge contract, workflow-integrity declarations/principle 37/local sweep, and relevant operator runbooks. None of these changes are performed by this design task.

Exit: acceptance report proves only current COMPLETE/GO passes; pause/rollback tested; allowance expiry and outages block new authorizations; native GitHub performs merge. No main changes. Umbrella `done.md` only after all stages actually accepted and merged.

## 4. Verification requirements and evidence format

Per stage deliver a receipt: stage, approved scope, commit/release SHA, command/environment, exit status/output, relevant App/check/report IDs, coverage, failures and decisions. RED-first tests identify the single production change that flips them and pin sibling inputs. Use no model calls in CI or tests. Run host verification after any container implementation; verify the actual destination service separately. A local green suite does not prove hosted authentication or native merge behavior.

<!-- host-verify: none — this draft is a prose-only review copy; executable acceptance commands must be added to the published stage kickoff after S0 fixes actual implementation paths and hosting -->

Future canonical kickoff must carry real `bash host-verify` commands for the chosen tests/schema/config probes, plus `make self-audit` and existing required checks appropriate to the final diff. Do not treat this draft opt-out as implementation acceptance. Verification must inspect authoritative GitHub state with pagination; unavailable admin/API reads produce UNVERIFIED, never green.

## 5. Health, limits and rollback

Keep one active Dot review, with an explicit operator-selected authorization expiry and approved retry/backoff/lease values in the setup manifest. The design’s two-attempt/120-minute values are proposals, not enabled policy or account capacity. Observe actual subscription eligibility/allowance/promotion expiry. Unknown billing, quota exhaustion, revoked access, safety stop and execution failure pause new claims/publication; no automatic credit purchase, model/API substitution or local execution.

Ledger/backup failure blocks publication. Event reconciliation and queue monitoring recover missed work; native M/strict protections enforce freshness. Previously valid immutable authorizations do not acquire a fictional timer expiry. To stop their admission, operator activates no-bypass native `dot-review/pause` requirement and verifies it, then pauses services/arming. Default rollback keeps that pause and repairs; removing Dot protection is an explicitly approved policy weakening. Preserve evidence and mechanical requirements throughout.

## 6. AI traps and review discipline

See [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md).

Active traps: **T2** (design is not a live audit), **T3** (every claim has command/output or source and unknown label), **T4** (complete every declared acceptance dimension), **T7** (run category-level adversarial questions), **T11/T12/T13/T16** (primary-source, own-stack and problem-class reuse evidence), **T14** (partial evidence is not clean coverage), **T15** (self-application), **T19** (independent quality review only through an approved route), **T20** (recommendations cite current evidence), **T21** (enumerate all parallel admission/configuration surfaces), **T22** (isolate sibling state in negative tests). No new agents are authorized by this list.

- **T-DOT-A:** success on head SHA does not bind staging base; prove current M admission with strict checks and immediate base-change tests.
- **T-DOT-B:** comment marker, self-asserted author or OAuth identity is not cryptographic Dot attestation; test enrolled origin, state the attribution limit.
- **T-DOT-C:** shared plugins can expose operator writer credentials despite reviewer prompts; enumerate and prove denial at every route.
- **T-DOT-D:** observation success, old staging baseline and historical GO are not admission evidence; keep separate types, contexts and tests.

Before readiness, ask “Which forged/stale object can still make GitHub merge?” and “Which capability did we assume without testing in actual Dot?” Record the answers and fixes. Sweep class-surfaces beyond this diff: all mechanical workflows/aggregates, protections/rulesets, local sweep, reviewer/reporting paths, publisher/armer credentials, main boundary and kickoff catalog. No generic “all principles followed” statement substitutes for inventories/evidence.

## 7. Return contract

Return GO/REVISE/STOP plus COMPLETE/INCOMPLETE, stage receipts, exact revisions/protocol/policy versions, measured negative-matrix outcomes, semantic coverage, remaining prerequisites, deployment/pause state and report links. Do not call setup complete without actual evidence. If blocked, finish unaffected design/testing and present the concrete unresolved tradeoff; do not silently weaken source authentication, freshness or spending limits.
