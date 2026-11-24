# Development efficiency S4 — active waiting, reconnect and explicit resume

> **Type:** execution-build. **Rigor label (L0):** `build-and-verify`.
> **Stage:** S4. **Branch:** `codex/development-efficiency-s4`. **Base:** `staging`.
> **Status:** Prepared; no launch. Read the umbrella `kickoff.md` §§0–6 first.

## 1. Binding scope and prerequisite

Implement design §9 after the actual S3 source merge and applicable ownership/contract
acceptance. Use the umbrella's real merge gate; a done marker alone is insufficient.
Read the accepted S3 generation/action fields and actual consumer binding before edits.

Inspect `packages/runtime-bridge/src/aifWsStatus.ts`,
`packages/runtime-bridge/src/AifHandoffBackend.ts`, `src/backend.ts`, `src/cli/aifHttp.ts`
under that package, `packages/runtime-bridge/test/aif-status-readback.test.ts` and the
actual owner result handler. The current waiter is a status-only seam, not a durable
action consumer. Bind exact API callers, installed owner, authoritative result source,
generation/authority checks, effect reconciliation and test commands in the stage plan.
Missing generation/owner capability parks its dependent effects; do not fabricate it
from a timestamp, status-only event or a task title. Preserve native routing and locks.

## 2. Implementation contract

1. Establish subscription before authoritative reconciliation on initial connection and
   every reconnect. Route snapshots and events through one settlement path. Prevent an
   older observation or prior socket from overwriting the accepted current generation.
2. Bound observation. Timeout or transport failure means uncertainty, not task failure,
   approval, cancellation or retry permission. Preserve known result/owner state.
3. Before next-action effects, reconcile candidate, immutable result generation, current
   authority and pause/cancellation. Deduplicate by task, result generation, recipient
   and continuation stage, allowing later rework to make progress.
4. Retain a pending action before acknowledging consumption; record actual outcome and
   reconcile uncertain external effects before repetition. A dedup key is not exactly-once
   execution across crashes. Use supported idempotence or existing reconciliation;
   otherwise retain an explicit unknown action rather than duplicate execution/review/publication.
5. On explicit owner resume, reconcile retained results/actions before reporting current
   state or launching work. A live waiter and saved file do not wake a terminated chat.
   Demonstrate the real receiver for any unattended route claimed; an unsupported route
   stays explicitly limited. D1 owns automatic terminated-owner recovery, outside S4.

Keep the existing backend/task observation architecture. No new supervisor, generic
observer service, passive READY-as-progress claim or speculative live provider retry.
Cancellation of observation/a turn is not itself cancellation of the underlying task.
Changes to runtime source and shipped vendor consumers follow their existing generation
and parity path; do not hand-edit an independent copied implementation.
The parity check is detect-only: use the documented source-to-vendor copy and formatter
refresh before comparison, rather than expecting the checker to synchronize files.

## 3. Acceptance

The plan supplies exact new/affected test commands and their real owner-consumption seam.
Cover completion before attachment, between subscription/snapshot and during disconnect;
duplicate observations; snapshot/event ordering and obsolete connection callbacks;
new rework generation; stale candidate; intentional pause/cancellation; transport
uncertainty; explicit owner resume; and an external effect whose receipt is missing.
For each, the correct next action occurs once when its effect is reconciled, or remains
explicitly unresolved without unsafe retry. Restore valid controls. A socket fake can
prove ordering/reconnect logic but cannot prove a missing installed chat receiver.

Use targeted cases first, then the existing host regression floor:

```bash host-verify
npm --prefix packages/runtime-bridge run typecheck
npm --prefix packages/runtime-bridge test -- test/aif-status-readback.test.ts
npm --prefix packages/runtime-bridge test
bash scripts/build-getff-dist.sh --check
```

Bind final evidence to changed code, tests, tools/config and the actual installed handler.
Record the next real authorized workflow's observation-to-consumption result; do not
launch an extra model call merely to manufacture evidence. Source tests and actual
installed consumption have distinct acceptance states. An unavailable receiver keeps
that outcome pending and cannot be advertised as automatic recovery.

## §4c Park-don't-guess

On a genuine unresolved architecture, scope or authority fork, do not guess. Park it as
a question through the existing runtime task's supported park/answer path, name the
existing accountable recipient, and state both options with their consequences and the
missing decision/evidence. Stop dependent effects until a valid answer returns through
that route; continue independent already-admitted work when possible. A clear ordinary
in-scope correction is not a new operator vote. Preserve task identity, current authority,
review/launch caps and any owned pending result. This contract grants no launch itself.

## 4. Traps, result and rollback

See `.agents/rules/ai-laziness-traps.md` §2. Active traps: **T3**, **T7**, **T22**.
T3 separates observed completion from performed effect. T7 rejects a status-only waiter
as a full consumer. T22 pins ordering/generation so cases fail for the intended defect.
**T-DE-S4-A:** reconnect receives an old done event and advances a newer rework attempt.
Counter: verify authoritative candidate/generation/current authority before any effect.

Return one stage result with subscription/settlement coverage, actual receiver/effect
reconciliation and explicit limits. Rollback restores the prior observation interface
with its callers while preserving pending records, outcomes, identity and supported
ownership. Do not erase an uncertain effect or reset counters to make retry appear safe.
