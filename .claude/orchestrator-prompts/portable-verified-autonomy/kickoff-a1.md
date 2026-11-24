# Portable verified autonomy A1 — durable binding and controls

> **Type:** execution-build; first sequential stage A of the agreed S1/S2 umbrella.
> **Rigor label (L0):** `build-and-verify`.
> **Authoritative for:** this bounded implementation task, its permitted files and technical acceptance.
> **NOT authoritative for:** changing the PRD/design, starting B/C/D, live host/memory enrollment, additional payment, acceptance of the whole feature or main promotion.

## §0 Current authority and task scope

The operator explicitly authorized publication to staging followed by launch through the existing pipeline. Read [umbrella kickoff](kickoff.md), [agreed design](../../../docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md), [agreement](../../../docs/superpowers/specs/reviews/portable-verified-autonomy/spec-agreement.md) and the exact approved brief below. User approval applies to this implementation scope; no second product/plan vote is needed for ordinary technical decisions.

A1 implements only umbrella §2 Stage A. The following contract uses the existing runtime schema. Initial production may start after the current authority/claim checks; implementation waits at the existing `plan_ready` boundary for an independently checked effective plan and bound PlanReview. Do not convert a partial stage into full-feature ResultReview.matches: PA1–PA9 remain essential, with B/C/D and later consumer/second-host work explicitly unproved.

```intent-contract
{
  "version": 1,
  "featureId": "portable-verified-autonomy",
  "resultId": "portable-verified-autonomy-a1",
  "mode": "produce",
  "brief": {
    "path": "docs/superpowers/specs/snapshots/portable-verified-autonomy/prd-ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721.md",
    "sha256": "ec33fd3d88ae41fb623b31d4d465d96d2cbe3af63dfc7d815f72c8c684590721"
  },
  "shared": [
    {
      "path": "docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md",
      "sha256": "d82086984feffc8bc038021ef4419e0d4388e32e82accbe7ebab0e016002904c"
    },
    {
      "path": ".claude/orchestrator-prompts/portable-verified-autonomy/kickoff.md",
      "sha256": "fc69ebec945425313aaa0d0a619af18dec1ded3fb1a371a73a30cb625360b98b"
    }
  ],
  "essentialPromiseIds": [
    "PA1",
    "PA2",
    "PA3",
    "PA4",
    "PA5",
    "PA6",
    "PA7",
    "PA8",
    "PA9"
  ],
  "producesOrRepairs": "Stage A binding/control foundation only; all feature promises remain essential and later live/consumer/second-host evidence remains pending."
}
```

## §1 Isolation, inputs and ownership

Use the existing AIF-assigned isolated task checkout/branch based on the **actual merged staging publication**. Verify cwd, branch/base, normal runtime configuration and current owner before writes. Preserve unrelated WIP and existing untracked files; never reset/clean/stash someone else's work or hand off a half-finished branch to a competing worker. Before a local GLM launch/resume, read `/Users/art/.config/getff/glm-launch-policy.md`; AIF runtime configuration is separate. Preserve configured hooks/denials and eligible existing-account operation.

Read source before coding: `.agents/procedures/intent/helpers/current-decisions.mjs`, `check-result-review.mjs`, `publish-result-review.mjs`, canonical dispatcher/pipeline procedures, `packages/runtime-bridge/src/resultReview.ts`, `AifHandoffBackend.ts`, and `cli/await.ts`. Reuse current APIs; do not duplicate their authority or semantic validators. Consume the accepted research reports and producer probes; raw research evidence is preserved in the [publication archive](../../../docs/superpowers/research/portable-verified-autonomy/2026-10-26/evidence-archive.md).

## §2 Permitted files and deliverable

- Create `.agents/procedures/pipeline/helpers/autonomy-binding.mjs`, its directly needed local modules under `helpers/autonomy-binding/`, and `.agents/procedures/pipeline/helpers/autonomy-binding.test.mjs` plus task-owned test fixtures.
- A necessary tested lock/OS dependency may update the actual owning package manifest/lockfile after build-vs-reuse evidence; first identify the real owner and consumer consequence in the plan. No new service, database, scheduler or memory backend.
- Record implementation evidence in `docs/superpowers/research/portable-verified-autonomy/implementation-a1.md`; keep private runtime instance records under the bound stage artifact root, not committed templates.
- No edits to approved PRD/spec/snapshots, umbrella kickoff, account/global security settings, shipped skills/rules, host routine setup, Hy-Memory or unrelated source. If an actually necessary change crosses these bounds, park the precise dependency instead of doing a drive-by edit.

Deliver a one-shot binding foundation that reads independently selected current authority and existing subsystem state, records identity/custody/pending action, serializes local transitions, and exposes status/pause/cancel/resume with the agreed semantics. Host/worker/review operations reserved for B must return an explicit unsupported/pending prerequisite, never a simulated live success. This is not another task registry: one `autonomy-binding.json` under the bound stage artifact root, referencing existing AIF claims/tasks/reviews and exact candidates.

## §3 Ordered implementation and discriminating acceptance

1. Inventory actual helper APIs, local locking/process primitives and structural principle-test obligations. Write a bounded effective plan with exact files, tests, dependency choice and failure cases; hold implementation for PlanReview as above. No broad new research or rewritten workflow.
2. Implement the versioned relationship record from design §Concrete first-route contract: repository/feature/stage, authority refs, action/destination grant, business disposition, native/routine/AIF IDs, worker session/process/start identity, custody generation, candidate, pending action, review and delivery references. Cached observations never outrank current authority/AIF/PR facts. Validate paths and stage ownership before writes.
3. Implement OS-held local advisory serialization and same-filesystem durable atomic updates using a verified existing primitive where possible. Released local lock/expired wait cannot prove an external worker ceased. Ambiguous spawn/action effect remains an owned `uncertain-owner`/effect hold. Do not replace the specified OS-held semantics with stale-time directory takeover or promise distributed exactly-once effects.
4. Persist action/spawn intent before effects; reconcile existing subsystem identity/result before any retry. Reject stale custody generations/candidates and duplicate deliveries. Recheck current authority, control and candidate at consequential boundaries; no actual model/PR/delivery calls are authorized by this stage's tests.
5. Implement inspectable status and monotonic control revisions. Pause/cancel stops new admission and requests underlying cessation, reporting pending until acknowledged; no claim to undo a completed effect. Late result or runtime return cannot clear explicit pause/cancel. Resume needs explicit scoped business-control authorization. One worker retains correction custody until cessation or explicit valid transfer.
6. Write meaningful paired tests: valid unchanged case; stale/missing/current-authority change; concurrent transitions; crash before/after durable write/spawn receipt; live disconnected worker; duplicate/late report; changed candidate/generation; pause/cancel versus late work; unknown effect and non-overridable denied actions. Test actual process/lock release after process exit. Assert prohibited effects did not occur. Fixtures test deterministic boundaries, not native OpenMaus recovery, reviewer isolation or Hy-Memory acceptance.
7. Run focused checks and independent cold diff review; repair within scope. Report actual paths, commands, results, dependency/packaging implications and B/C/D holds. Follow existing capability-commit Prior-art/SSOT/§1.7 rules; do not absorb existing templates/rules into this task. The factory supplies the candidate branch/commits; the existing host harvest/managed-PR owner handles applicable egress rights.

Field-notes transfer: F-P11 requires the reliable bounded path/failure cases before B routine enrollment; F-P4/F-P15 and F-A6/F-A36/F-A37 require single custody/exact return identity; F-P1/F-P2/F-P3 and F-A8/F-A10/F-A19 require meaningful current evidence. Preserve F-P6 memory and F-P13/F-P16/F-P17 economics/quiet-work obligations for C/D rather than deleting or falsely crediting them. Use the [complete comparison](../../../docs/superpowers/research/portable-verified-autonomy/2026-10-26/field-notes-comparison.md).

## §4 Verification, report and stage boundary

```bash host-verify
node --test .agents/procedures/pipeline/helpers/autonomy-binding.test.mjs
node scripts/check-arch-retell.mjs docs/superpowers/specs/2026-10-26-portable-verified-autonomy-design.md
make self-audit
```

The new test path is future implementation, not an already passed suite. Independent review must cover the actual diff and tests, including any OS dependency and consumer prerequisite. A1 technical acceptance closes only this foundation; B requires the actual A1 PR/head merged to staging, then its own current claim/review/admission. No live host or memory success, PA6 or PA9 credit comes from A1 green.

Return existing REPORT Status DONE/PARTIAL/BLOCKED, exact task/branch/head, files, observed checks and evidence, remaining next action/owner and ATTN lines. Fully specified in-scope repairs stay with this task/branch. No false feature completion or main merge.

### §4c Park-don't-guess

If you encounter an unresolved product/architecture choice, unsupported normal permission, unverified required lock/identity primitive, inability to inspect a required input, or a scope conflict, **park it as a question** through the existing AIF park mechanism. Include exact decision, evidence, options and the bound task/return owner. Do not guess or silently weaken authority, isolation, custody, acceptance or no-extra-payment. Ordinary implementation choices within the agreed contract proceed autonomously. Respect the configured three-review-iteration ceiling; on exhaustion preserve the candidate and return the actual blocker for the existing advisor/owner route.

## §5 AI-traps active and self-application

Apply [ai-laziness-traps](../../../.agents/rules/ai-laziness-traps.md): **T2/T3/T10** (enumerate real boundaries/evidence before coverage claims), **T7/T8** (exercise actual bypasses; do not ask the operator to relay routine work), **T11/T13/T16** (reuse actual owners/primitives; adopted source is not installed behavior), **T14/T19/T20** (current evidence and independent cold review before acceptance), **T15** (apply the same ownership/current-authority checks to this binding itself), **T17/T18** (preserve existing WIP and unique behavior). Domain T-AUT-A: successful turn is not product acceptance. T-AUT-B: expired lock/wait is not external-worker cessation. T-AUT-C: declared paths/digests do not establish permitted current authority. Each new mechanizable bypass needs a failing control and valid pass; no paid inference in CI.
