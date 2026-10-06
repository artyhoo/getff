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

> Generated native entry from `.claude/skills/orchestrator/SKILL.md`; shared procedure is authored once.
> **Authoritative for:** native Codex discovery and full-source loading for this entry.
> **NOT authoritative for:** the shared procedure; read the linked canonical owner.

Read [the complete canonical procedure](../../../.claude/skills/orchestrator/SKILL.md) in full before proceeding. Read [Codex bindings](../../../docs/codex-local-skills.md) and apply them to every step. Bind arguments from the operator invocation. Execute each mandatory shell block through the shell tool. Replace `${CLAUDE_SKILL_DIR}` with `.claude/skills/orchestrator` when reading a legacy procedure. Model/tool frontmatter grants no authority on this host.
