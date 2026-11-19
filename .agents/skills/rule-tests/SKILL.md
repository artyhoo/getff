---
name: rule-tests
description: 'Use when a consumer has an EXISTING generated rule whose firing test material is missing, broken, or needs a bypass variant. Triggers: rule tests, repair test material, fix negative-test, rule test material, verify the rule fires, rule-tests, починить тест правила, исправить негативный тест, проверить что правило срабатывает, тестовый материал для правила. NOT for creating new rules (/rule-research).'
---

> Generated native entry from `.agents/procedures/rule-tests/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/rule-tests/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$rule-tests` or a direct operator request as the host equivalent of legacy `/rule-tests`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/rule-tests/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/rule-tests"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/rule-tests`. Model/tool frontmatter grants no authority on this host.
