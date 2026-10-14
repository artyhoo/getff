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

Read [the complete canonical procedure](../../../.agents/procedures/intent/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$intent` or a direct operator request as the host equivalent of legacy `/intent`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/intent/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/intent"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/intent`. Model/tool frontmatter grants no authority on this host.
