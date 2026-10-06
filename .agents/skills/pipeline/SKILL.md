---
name: pipeline
description: 'Use when you have ≥2 in-flight wave umbrellas with cross-stage dependencies, suspect drift between wave-sequencing-plan.md and live git reality, or need to dispatch the next wave with verified Stage N→N+1 gates. Triggers: pipeline, wave orchestrator, wave plan, stage-gate, umbrella priority, waves parallel/sequential, wave-sequencing-plan drift. Invocation channel: explicit /pipeline only — disable-model-invocation:true is a channel flag and not a permission (§0).'
arguments: [umbrella]
argument-hint: '[umbrella-name]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
  - Bash(bash ${CLAUDE_SKILL_DIR}/helpers/*.sh *)
  - Read
  - Write
  - Edit
  - Agent
---

> Generated native entry from `.claude/skills/pipeline/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.claude/skills/pipeline/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-local-skills.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `.claude/skills/pipeline` when reading a legacy procedure. Model/tool frontmatter grants no authority on this host.
