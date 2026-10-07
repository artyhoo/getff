---
name: reviewer
description: Use when the operator or an orchestrator asks for an interactive review with a verdict — «проверь», «ревью», «вердикт», «это правильно?», «оцени результат», «phase N закрыт», review, second opinion, independent review, verify deliverable, "is this correct?" — and the deliverable is a GO/REVISE/STOP verdict or a verified answer, not code. NOT for implementing fixes or writing tests (orchestrator work), and NOT for the cold PR-boundary protocols (agents/fidelity-auditor.md, agents/review-sidecar.md — those are dispatched, not interactive).
---

> Generated native entry from `.agents/procedures/reviewer/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/reviewer/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `"$(git rev-parse --show-toplevel)/.agents/procedures/reviewer"` — root-anchored, so the path resolves from a nested cwd too (GH-4201345530). Model/tool frontmatter grants no authority on this host.
