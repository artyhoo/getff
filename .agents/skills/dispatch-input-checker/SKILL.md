---
name: dispatch-input-checker
description: "Cold dispatch-input reality-check at the aif-dispatch station boundary. Given ONLY the dispatch input (kickoff/scoped section) and the runtime-state probes it names — NEVER the chat, the implementation log, or the executor's session — judges whether the input is fit for an executor to burn tokens on, reporting per-class findings with file:line and a machine-consumed DISPATCH-INPUT verdict recorded as a calibration ledger row. Five equal K-classes (ADR-6) plus a K6 candidate/adjudicate split where this agent emits candidates only and the Opus framing-bias look adjudicates. Dialogue-blind by dispatch contract; reporting-only; never invoked from CI."
---

> **Authoritative for:** native discovery and full-source loading for this role.
> **NOT authoritative for:** the shared role procedure; read its canonical owner.

Read [.agents/roles/dispatch-input-checker.md](../../../.agents/roles/dispatch-input-checker.md) in full. Follow its procedure and [Codex bindings](../../../docs/codex-contributor.md). For a cold seat, spawn without inherited conversation and pass only its required inputs. This skill does not authorize spawning a subagent.
