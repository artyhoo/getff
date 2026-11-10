# Deterministic core — Codex approval at every stage

> **Authoritative for:** the operator's 2026-10-15 clarification of review and stage progression.
> **NOT authoritative for:** changes to the agreed design, implementation scope, permissions or existing factory gates.

The operator explicitly requires Codex to review every stage and GLM to obtain Codex agreement. This supplements `glm-full-execution.md` and supersedes any implication that only final Codex review is required.

For each stage, including D0 and all subsequent stages, prepare an immutable candidate and return its exact commit/PR head, diff, kickoff/spec references, executed checks and complete evidence, unresolved findings, cumulative caps and next proposed action in the existing `docs/deterministic-core/glm-delivery-state.md`. Set the state to awaiting Codex stage review. Codex performs the review and records GO or required changes against that exact content. GLM may repair the same stage within existing caps, but must return changed content for renewed review. Do not merge the stage, mark it accepted, or launch a dependent implementation stage before explicit content-bound Codex GO. Existing independent factory reviews, CI, predecessor and managed-PR gates still apply. Codex GO is necessary and does not replace them.

Initial publication/transport of already-approved input documents and D0 preparation may continue within existing authority. Any adopted execution brief also retains its existing exact-content Codex approval gate. No new human brief vote is needed. Preserve full-core F0–F7 scope and final Codex acceptance. Do not approve your own work or treat silence as approval.

Use the existing owner/state file and REPORT to hand the gate back. Do not create a second executor, scheduler or monitoring hierarchy. The active delivery session remains `b6564858-b47d-4563-9d79-1993b31a3550`.
