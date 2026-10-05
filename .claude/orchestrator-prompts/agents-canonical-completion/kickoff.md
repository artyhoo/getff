# agents-canonical-completion

> **Status:** INPUT — published to staging; dispatch only after packet-visibility proof.
<!-- host-verify: none — dispatch-input umbrella: acceptance commands live in the factory kickoff and the review kickoff; this file delegates, it runs no host command -->
> **Type:** execution-build.
> **Authoritative for:** one isolated AIF continuation task covering the remaining implementation of both operator stages.
> **NOT authoritative for:** publishing, host trust or project goal.
> **Spec:** docs/superpowers/specs/2026-10-05-agents-canonical-completion-design.md.
> **Plan:** docs/superpowers/plans/2026-10-05-agents-canonical-factory-kickoff.md.

## §0 Goal and input

Finish the existing prepared .agents architecture and consumer installer, then export an immutable review result.
Read the complete spec and plan above; do not restart the migration from staging.
Required continuation packet: continuation.json, packet.sha256, original-wip.bundle and checkpoint/integrated-source-in-progress.tar.gz.
Dispatcher must supply a verified worker-visible packet location before release. Mac origin paths are not remote input locations.

## §2 Sub-waves

| Sub-wave | Type | Stage | Parallel-with | Volume | Deliverable |
|---|---|---|---|---|---|
| A | execution-build | 1 | — | large | Resume frozen implementation, close final source/installer/package gates, export immutable result |

Tasks inside the plan are sequential steps of this one task; no parallel implementer redispatch.
The existing AIF project defaults route execution; no profile marker or auto-dispatch marker is attached.

## §3 Acceptance and next seat

Require S1/S2 dispositions, final gates, fresh Git and standalone npm delivery.
Native Codex behavior remains pending until the separate cheaper host-capable reviewer executes changed joins.
Return review-target.json, implementation-report.md and exact branch/result identity.
The junior coordinator owns authorized task-scoped sweep/harvest/PR/check/merge; implementer does not publish independently.
The separate cheap Codex reviewer consumes the exact returned/merged output for native acceptance; a done status or merged marker is not a behavior verdict.

## §5 AI-traps active

Apply T2, T3, T4, T5, T6, T7, T10, T13, T14, T15 and T16 from [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md).
C1: discovered skills and source tests do not prove native execution.
C2: unavailable Mac checkpoint is an input failure, never permission to redo the migration.
C3: synthetic WIP fixture history must not become the production merge base.

## §1.7 Self-review

The spec's two stages remain explicit; existing work, protected bytes, host trust and deterministic checks are retained.
Run self-review on the resulting evidence; unresolved native requirements remain open.
