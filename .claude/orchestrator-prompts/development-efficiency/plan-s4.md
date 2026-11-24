# Development efficiency S4 — bounded active observation plan

> **For agentic workers:** execute this selected stage inline using `superpowers:executing-plans`, with independent plan, final CODE and scoped FIDELITY review. No second executor.
> **Authoritative for:** this owner's admitted source slice and pending destinations.
> **NOT authoritative for:** installed economy adoption, foreign effects, S5 or terminated-owner recovery.

**Goal:** An active or explicitly resumed reader receives the current full AIF result despite late attachment, reconnect and obsolete socket callbacks, without turning observation into action authority.

**Architecture:** Keep the existing backend, task REST record and CLI. WS frames invalidate observations; full REST detail alone produces S3 result metadata. One settlement path admits only observations from the current connection after its newest signal. No scheduler, result store or new receiver is introduced.

**Tech stack:** existing Node HTTP/WebSocket, TypeScript and Vitest; no dependency addition.
**Spec:** `docs/superpowers/specs/2026-10-22-development-efficiency-design.md` §9 and `kickoff-s4.md`.

## Inputs and custody

- Native owner: `codex:01a17240-75cb-7d22-939c-fd32032ce8ee`; source checkout `/Users/art/.codex/worktrees/development-efficiency-s4/rules-as-tests-aif`.
- Branch `codex/development-efficiency-s4`, verified staging base `8ae9f41584377a0d70a89c79c40b4fabbc150be1`; actual S3 PR2131 merged with identical accepted/merged tree `148cebfe0c47b60b205cd9094939a60c9f9c7f9c`.
- Kickoff SHA256 `15ea4b0cd4edb6a6fd7862163060d495395a0d550ed0773f9221b63c351390db`; design `22efd36f9a3d08e8f087d4bf7678444f58dbfbf80fcc15212642148c6940487a`.
- Original selector plan-prep passed using the ORIGINAL spec/corpus roots: attempt `ab51569fc129f2bcc37f8c05af8f8d58e125cb7430692101d7ab4f42a652f67b`, approved brief `e1d88b90d4996999c058aab6a52df6d28ed707c56d2bdc5c835dbe6d56c8100e`. The first own-checkout spec path was outside the original roots; no replacement approval was created.
- Canonical result is the existing `/Users/art/.codex/worktrees/48ca/rules-as-tests-aif/.claude/orchestrator-prompts/development-efficiency/state.md`. Evidence is `/Users/art/.codex/visualizations/2026/10/25/01a17240-75cb-7d22-939c-fd32032ce8ee/s4-admission/`.
- Current full unfiltered PC read: four projects/408 tasks. All probe surfaces asked, container-only/unharvested/claims zero. IN-FLIGHT includes twelve historical/owned refs and four MERGED PRs, zero open umbrella PRs. This new branch is the only S4 checkout observed. Native/manual has no queue claim; the Phase-1 race remains. Repeat the full probe after review and before outward effects.

## Actual census and authority

| Boundary | Source/caller/receiver | Admission |
| --- | --- | --- |
| Authoritative result | PC `aif-api-1`, loopback3009 `GET /tasks/:id`; actual project `441c1c0c-b633-4612-a34c-2cc0c4d0eaf2`, repository `/home/www/rules-as-tests-aif` | Read only. Status broadcasts contain no immutable result/candidate/authority. |
| Waiter | `src/aifWsStatus.ts:253` `awaitTaskDone`; production caller `AifHandoffBackend.awaitDone`, then `cli/await.ts` | Subscribe first, reconcile on open/reconnect and every relevant signal; remove event-only completion and redundant post-settlement fetch. |
| HTTP | `src/cli/aifHttp.ts` shared request | Keep request deadline through body consumption. The earlier timer ends at headers and cannot bound a hanging REST body. |
| Result mapping | S3 `describeAifTask`, `unresolvedAifTaskResult`, `readAifTaskResult` | Reuse content digest and nullable identities; `acceptance=unverified`, `attempt=null`. Digest/ownerReference grant no authority. |
| Active/resumed receiver | This native owner runs the actual source CLI, reads full JSON and retains the pending disposition in the SAME stage journal before acknowledging it | A real human/model owner consumption seam; no claim that stdout wakes another chat. Explicit resume means a fresh authoritative `--once` read plus reconciliation of retained pending entries before effects. |
| Existing external effect | `cli/answer.ts` comment+event; `harvest.ts` publication; native cross-chat tools | No automatically admitted receiver/authority for these effects. Preserve S3 guards. Never call these against live foreign tasks to manufacture acceptance. |
| Installed economy | `/Users/art/.local/share/getff-economy/build/cli/await.js`, SHA256 `c3aa2249bda8f88a70f7f6472f466a0c5dc6ced42c102b0dcedfca685b45155e` | Additive `--until-actionable`, full REST, park/pause priority and bounded read retries must survive. Current ownership/adoption unavailable; do not overwrite. |
| Historical installation provenance | `/Users/art/.local/state/getff-project-coordination/glm-economy-update-20261011/SOL-IMPLEMENTATION-REPORT.md`, retained commit `73be45107e6` | Historical source found, original checkout absent from current worktrees. This is provenance, not current write custody. Existing supervision claim/record is a separate installed ledger lacking demonstrated S3 generation/continuation binding; no takeover. |
| Delivered consumers | `vendor/src/aifWsStatus.ts`, `AifHandoffBackend.ts`, `backend.ts`, `cli/aifHttp.ts`; layer55 install | Existing manual copy then formatter and detect-only parity. `cli/await.ts` remains excluded from this source vendor subset; preserve idempotency stub. |

## Global constraints and pending effects

No new business/model/GLM launch, watcher, recurring audit, global configuration, trust/permission change, extra concurrency, main merge or npm publication. No foreign source or owner messaging. S4 cannot erase foreign Integration25/Windows24/Root25/Onebutton27/consumer41/Dot24 obligations, c9 ACK or Clarify UNKNOWN1/1.

Before any continuation the existing accountable owner must bind task + immutable generation + recipient + continuation stage, current candidate and latest applicable authority; re-read pause/cancellation and retained effects. Persist pending before acknowledging. A prior uncertain/missing effect receipt remains UNKNOWN; reconcile the actual external destination before repeating. A new generation can advance only under its applicable authority; an old candidate's receipt cannot clear it. These dependent effects stay PARKED in this slice because no current durable receiver/authority contract has been demonstrated. No helper will pretend to execute them.

The real source CLI is an observation receiver; it performs GET only. Repeated/explicitly resumed reads may repeat JSON but may not produce effects. Demonstrate this at an actual HTTP boundary, and retain the live pending action in the existing journal. This proves safe active owner readback, not automatic action deduplication or installed native delivery. Missing effect capability is a recorded required S4 outcome, so the final report remains PARTIAL even after source delivery.

## Review focus

1. Events arrive while an initial snapshot is in flight: discard that observation, fetch current detail, never settle from the event alone.
2. A prior socket or its REST response completes after reconnect: ignore it, including its close/error callbacks.
3. REST returns headers but never finishes its body: observation still meets its deadline and retains known validated identity.
4. Flapping successful opens must not reset the reconnect budget; a queued reconnect must be cancelled on settlement/observation abort.
5. Intentional pause, malformed payload/detail and missing candidate/authority cannot become success or an effect; observation abort never calls task cancellation.

## Task 1 — one authoritative settlement path

**Files:** `packages/runtime-bridge/src/aifWsStatus.ts`, `AifHandoffBackend.ts`, `backend.ts`, `cli/aifHttp.ts`, `cli/await.ts`; affected/new tests under `packages/runtime-bridge/test/`.
**Interfaces:** Keep `RuntimeBackend.awaitDone(handle, timeoutMs?)`. AIF observes for a finite default of one hour; invalid explicit durations fail before connection. `awaitTaskDone` receives the API base (default derived from ws origin for direct callers), optional observation AbortSignal and test WebSocket constructor. Return full S3 TaskResult. BackendErrors on timeout/drop/cancellation retain the last validated metadata for CLI uncertainty output; no underlying task mutation.

- [ ] Add meaningful failing cases for completion before attachment, between subscription/snapshot and during disconnect; duplicate signals, obsolete socket callbacks, old in-flight responses and successful-open flapping.
- [ ] Run `npm --prefix packages/runtime-bridge test -- test/aif-status-readback.test.ts test/aif-active-observation.test.ts`; retain RED before production repair.
- [ ] Implement serialized authoritative reconciliation with connection identity + invalidation sequence, one settlement/cleanup path, retained metadata, bounded default/deadline and observation-only abort. Events never supply result generation.
- [ ] Extend shared HTTP request timeout over body read/parse using its existing abort mechanism; add a real hanging-body server control.
- [ ] Adjust existing direct-waiter fixtures to provide full authoritative detail. Replace the obsolete S3 expectation that stale done returns current running state immediately: stale done now keeps observing until actionable or deadline, retaining rework identity on uncertainty.
- [ ] GREEN affected tests and runtime typecheck; commit the converged change.

## Task 2 — real reader and bounded pending consumption

- [ ] `test/aif-active-observation.test.ts` uses real loopback HTTP and the production backend/CLI. Socket injection proves ordering only. Assert GET-only controls for stale candidate, new rework generation, duplicate reads, intentional pause/cancellation, and missing effect receipt. Restore valid controls. No fabricated authority.
- [ ] Real CLI explicit `--once` resume reads current authoritative generation; compare retained generation, recipient and continuation-stage in the existing journal. Pending must be written before acknowledgment; uncertainty remains pending without repeating an external effect. Candidate/authority absence is a prerequisite, not an approval.
- [ ] Actual next authorized workflow here is this S4 owner's read-only reconciliation of a real retained PC task through the existing Docker GET route. Capture full result/exit, retain pending under task+generation+this recipient+`reconcile-source-result` in the same journal, then acknowledge local consumption. No business replay or foreign POST. Record source versus installed acceptance distinctly.
- [ ] No automatic receiver/effect store is built. Installed economy adoption, real action dedup/uncertain external receipt reconciliation and terminated-owner recovery D1 remain explicit pending outcomes with their existing owners/return conditions.

## Task 3 — causal closure, review and source delivery

- [ ] Copy only the four affected existing production twins above from source, then `bash scripts/format-shipped.sh --write <paths>` and detect-only parity. Preserve `vendor/src/idempotency.ts` unchanged.
- [ ] Exercise the actual layer55 scratch installer/backend via affected existing `test/aif-result-consumption.test.ts`; source scratch installation is not installed economy adoption.
- [ ] Run `npm --prefix packages/runtime-bridge run typecheck`, targeted readback tests, then `npm --prefix packages/runtime-bridge test`, `bash scripts/build-getff-dist.sh --check`, `make self-audit`. Stabilize before the expensive floor; reuse applicable evidence.
- [ ] Generate tracked `packages/getff/MANIFEST.sha256` by existing package build, exact affected catalogs/citations only via existing generators if required. Unexpected outputs require narrow scope review before staging. Keep manifest tracked and preserve index/archive identity checks.
- [ ] Independent final CODE and scoped FIDELITY (separate counters; fidelity cap two consecutive unchanged-scope REVISE, normal implementation cap four). Cold backward sweep gets only change class. Preserve original prior counters.
- [ ] Normal PR to staging, current full/late/head/base/lock guards and one bounded final CI qualification at a real ready delivery boundary. No timer monitoring, watchers, admin, auto-merge or bypass. Pending CI is not green.

## Replaced work and rollback

Retire only the missed-event WS-only completion path and second fetch outside the wait deadline. Full detail settles once through the waiter; `--once` remains the explicit current-state reader. Keep independent review, authority, publication and native routing boundaries. No foreign relay hop is declared redundant.

Rollback reverts the source interface and causal vendor/package outputs together through normal staging delivery, preserving task/results, pending obligations, generation evidence and counters. Installed economy remains untouched. Falsifier: an obsolete socket/snapshot wins, unbounded body delays violate the deadline, a digest/observation becomes authority, pending metadata is lost on timeout, or source tests/merge are advertised as installed/effect acceptance.

## Causal documentation closure — independent scope review before application

The cold backward sweep found four source descriptions invalidated by this slice. Admit only
the exact `causal-docs-proposed.patch` retained in this stage's evidence directory:
`packages/runtime-bridge/README.md`, `docs/runtime-bridge-setup.md`,
`.agents/rules/autonomous-loop-continuity.md` and its existing
`docs/site/reference/F1/autonomous-loop-continuity.md` sheet. Correct event-only/indefinite
AIF wait claims and obsolete poll/retry advice; retain the existing explicit deadline advice,
historical idle-heartbeat proposal, manual/older-installed limitations and independent authority.
No new rule, channel, gate, idle heartbeat or installed acceptance is introduced. Refresh only
that sheet's affected prose/source reference/freshness qualification, keeping its generated card
and historical hook evidence intact. Run the existing docs checker, causal citation generator,
formatter and package manifest generator. This addition changes no production interface or
pending-effect disposition. Scope GO is required before applying the patch.
