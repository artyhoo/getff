---
name: claude-glm-executor-handoff
description: "Use when an in-aif Claude coordinator is about to dispatch an executable task to a GLM-5.3 worker (any agent whose frontmatter carries `model: glm-5.3` or a GLM-family model). Triggers: writing a dispatch prompt for a GLM worker inside aif-handoff, GLM executor, implement-worker GLM, cross-model dispatch within aif, planning a handoff to GLM-5.3, parsing a GLM worker's REPORT. NOT for Claude→Claude worker dispatch (use SDD directly)."
---

> Generated native entry from `.claude/skills/claude-glm-executor-handoff/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.claude/skills/claude-glm-executor-handoff/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-local-skills.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `.claude/skills/claude-glm-executor-handoff` when reading a legacy procedure. Model/tool frontmatter grants no authority on this host.
