---
name: arch
description: 'Use when starting the EXTERNAL design contour — turning a raw idea or prep-doc into a reviewed design and a routed handoff. Triggers: /arch, external contour, внешний контур, спроектируй идею, задумка в архитектуру, design contour, arch loop, продумай и спроектируй, идея → kickoff, research contour, research-spec, distillate, исследовательский контур. NOT for reviewing code (/reviewer), dispatching stages (/pipeline), factory runtime questions (aif-doctor), or a bare brainstorm with no handoff (superpowers:brainstorming).'
arguments: [topic-or-prep-doc]
argument-hint: '<topic | path/to/prep-doc.md>'
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Agent
  - AskUserQuestion
  - Write
  - Edit
  - Skill
  - Bash(git *)
  - Bash(gh *)
  - Bash(ls *)
  - Bash(cat *)
---

> Generated native entry from `.agents/procedures/arch/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/arch/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `"$(git rev-parse --show-toplevel)/.agents/procedures/arch"` — root-anchored, so the path resolves from a nested cwd too (GH-4201345530). Model/tool frontmatter grants no authority on this host.
