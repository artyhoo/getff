---
name: orchestrator
description: |
  TRIGGER when: «оркестратор/orchestrator», «старшая/младшая модель», «делегируй/delegate»,
  «Mode A/B», «file-prompt», «umbrella», «батч правок/batch fixes», «пакет фиксов»; ИЛИ первая
  из серии мелких правок одной темы; ИЛИ задача распадается на ≥3 независимых подзадач; ИЛИ
  «автономно / волнами / работай без остановок / прогони очередь кикофов сам» при ≥2 kickoff'ах
  → Queue mode.
  SKIP: тривиальная правка по точному пути (≤5 строк, 1 файл).
when_to_use: организатор, ты старшая, много мелких, координируй, разбей на подзадачи, queue mode, kickoff, autonomous research, worker dispatch, воркер, ревьюер, очередь задач, автономно, волнами, итеративно, работай без остановок, прогони очередь кикофов, цикл кикофов, не останавливайся, сам до конца
---

> Generated native entry from `.agents/procedures/orchestrator/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.agents/procedures/orchestrator/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-contributor.md) and apply them to every step. Treat explicit `$orchestrator` or a direct operator request as the host equivalent of legacy `/orchestrator`; explicit-only policy still forbids self-initiation. Bind arguments from the operator invocation (absent means an empty string, never an invented umbrella). Preserve the invocation cwd and supplied arguments before changing directories; canonical procedure-specific input rules govern relative targets. Bind the nearest project containing this canonical source, never an enclosing Git root, using the executable block below. After binding supplied inputs, execute canonical commands from that root. Execute each mandatory shell block through the shell tool.

```bash
GETFF_PROJECT_ROOT="$PWD"
while [ ! -f "$GETFF_PROJECT_ROOT/.agents/procedures/orchestrator/SKILL.md" ]; do
  [ "$GETFF_PROJECT_ROOT" != / ] || { printf "%s\n" "getff: installed procedure root missing" >&2; exit 2; }
  GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT%/*}"; GETFF_PROJECT_ROOT="${GETFF_PROJECT_ROOT:-/}"
done
GETFF_SKILL_DIR="$GETFF_PROJECT_ROOT/.agents/procedures/orchestrator"
```

Replace `${CLAUDE_SKILL_DIR}` with `"$GETFF_SKILL_DIR"`; its canonical source is `.agents/procedures/orchestrator`. Model/tool frontmatter grants no authority on this host.
