---
name: living-docs-auditor
description: "Invokes the living-docs audit command (scripts/living-docs-audit.mjs) and reports findings. Catches backward Living-Documentation drift — whether AGENTS.md/RULES.md rules still hold in the actual code. Reports; does not fix. Renamed from `docs-auditor` to de-collide with AI Factory's own `docs-auditor` (a different, forward job: gating /aif-docs generation) — see docs/meta-factory/research-patches/2026-05-20-agent-collision-resolution.md §4.3. Consumer-facing context: this agent expects `scripts/living-docs-audit.mjs` and the runner scripts to be populated by the AIF installer in consumer projects; when they are absent the command itself reports the check incomplete — report that as a configuration gap, never as a clean audit. In the source project the delivered command is absent and the role reports that gap instead of auditing the framework checkout by accident."
---

> **Authoritative for:** native discovery and full-source loading for this role.
> **NOT authoritative for:** the shared role procedure; read its canonical owner.

Read [.agents/roles/living-docs-auditor.md](../../../.agents/roles/living-docs-auditor.md) in full. Follow its procedure and [Codex bindings](../../../docs/codex-contributor.md). For a cold seat, spawn without inherited conversation and pass only its required inputs. This skill does not authorize spawning a subagent.
