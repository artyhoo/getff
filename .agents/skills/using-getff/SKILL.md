---
name: using-getff
description: Use when starting any conversation in a repo that has the getff plugin installed — establishes how to find and use the getff skills, the instruction-priority ladder (the project's own CLAUDE.md/AGENTS.md win), and the "invoke the relevant skill before responding" discipline. Trigger on session start, before any first reply, and whenever code quality, linting, CI, pre-commit/pre-push hooks, architecture rules, mutation/contract testing, or "stop the AI breaking my conventions" comes up.
---

> Generated native entry from `.agents/procedures/using-getff/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/using-getff/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$using-getff` or a direct operator request as the host equivalent of legacy `/using-getff`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/using-getff/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/using-getff"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/using-getff`. Model/tool frontmatter grants no authority on this host.
