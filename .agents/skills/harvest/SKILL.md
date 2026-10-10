---
name: harvest
description: 'Use when harvesting a finished aif-agent branch into a PR after acceptance. Triggers: harvest, harvest aif branch, egress aif task, push harvested work, post-acceptance harvest. Invocation channel: explicit /harvest only — disable-model-invocation:true is a channel flag and not a permission (§0).'
arguments: [taskId]
argument-hint: '[aif-taskId-or-branch]'
disable-model-invocation: true
model: opus
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(tsx *)
  - Bash(npx *)
  - Bash(bash *)
  - Bash(docker *)
  - Bash(curl *) # GH #1704: §1 step-0 host-side bridge-health preflight
  - Read
---

> Generated native entry from `.agents/procedures/harvest/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/harvest/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `"$(git rev-parse --show-toplevel)/.agents/procedures/harvest"` — root-anchored, so the path resolves from a nested cwd too (GH-4201345530). Model/tool frontmatter grants no authority on this host.
