---
name: docs-author
description: 'Use when writing or editing any getff.ai docs page under docs/site/ (including the glossary terms.md), when picking a page kind or filling the reader-comfort card, or when running a docs refresh over touched pages — to apply the kind registry, the craft contract, and the docs-check done-checklist. Triggers: write a docs page, new page under docs/site, glossary entry, terms.md, docs refresh, gold page, Diátaxis, задокументировать, страница документации.'
---

> Generated native entry from `.agents/procedures/docs-author/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/docs-author/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$docs-author` or a direct operator request as the host equivalent of legacy `/docs-author`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/docs-author/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/docs-author"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/docs-author`. Model/tool frontmatter grants no authority on this host.
