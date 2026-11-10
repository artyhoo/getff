---
name: getff
description: Use when treating any codebase rule (architectural, naming, dependency, test-quality, contract, SLO) as an executable test that fails the build when violated, or when the user asks about enforcing code quality, fighting AI-generated code drift, setting up linters/tests/CI/pre-commit hooks, designing review processes, mutation testing, contract testing, fitness functions, observability-driven development, SLO-as-code, or "how do I make my codebase resistant to AI agents breaking my conventions". Also trigger on ArchUnit, Stryker, Pact, dependency-cruiser, AI Factory (aif), Husky, lint-staged, ESLint flat config, Zod validation strategy, or shift-left/shift-right testing. Strongly trigger when the user mentions Claude Code, Cursor, or Copilot writing code that "looks fine but is wrong".
---

> Generated native entry from `.agents/procedures/getff/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/getff/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$getff` or a direct operator request as the host equivalent of legacy `/getff`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/getff/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/getff"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/getff`. Model/tool frontmatter grants no authority on this host.
