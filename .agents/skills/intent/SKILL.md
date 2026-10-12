---
name: intent
description: 'Use when clarifying or preserving PRODUCT intent — turning a raw feature idea into an agreed product brief, keeping that intent across stages, and reviewing a first working result against it. Triggers: /intent, product intent, product brief, clarify the feature, what should the user get, intent session, result review, продуктовый смысл, замысел продукта, что получит пользователь. NOT for solution design (/arch), stage dispatch (/pipeline), code review (/reviewer), or factory runtime questions (aif-doctor).'
arguments: [topic-or-product-brief]
argument-hint: '<topic | path/to/product-brief.md>'
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
  - Bash(ls *)
  - Bash(cat *)
---

> Generated native entry from `.agents/procedures/intent/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/intent/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `"$(git rev-parse --show-toplevel)/.agents/procedures/intent"` — root-anchored, so the path resolves from a nested cwd too (GH-4201345530). Model/tool frontmatter grants no authority on this host.
