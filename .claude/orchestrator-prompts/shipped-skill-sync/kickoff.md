<!-- scope:shipped-skill-sync -->
# KICKOFF — shipped-skill-sync

> **Type:** I-phase-small · Mode A · оператор-сторонняя сессия (читает ~/.claude/skills/).
> **Base:** staging.
> **Priority:** LOW — только когда drift shipped fallback реально укусит.
> **Deliverable:** `scripts/sync-shipped-skill-context.sh` + PR против staging.

---

## §0 Контекст

Volume mount (`docker-compose.override.yml`) дал аифу живой доступ к `~/.claude/skills/orchestrator/`.
Но shipped fallback (`agents/orchestrator-worker-discipline.md` + `skill-context/aif-orchestrator-discipline/SKILL.md`, PR #390)
— статичная дистилляция, источник снаружи репо. При крупных изменениях оркестратора она устаревает молча.

Trigger для запуска этого umbrella: drift между shipped файлами и живым оркестратором стал заметен на практике.
Не раньше.

---

## §1 Что построить

`scripts/sync-shipped-skill-context.sh` — детерминированный bash-скрипт (no LLM):

1. Читает `~/.claude/skills/orchestrator/SKILL.md`
2. Вырезает секции: `## §3 Launch-table` (planning-layer) и `## §7 Reviewer dispatch` (reviewer-layer)
3. Перезаписывает соответствующие блоки в:
   - `agents/orchestrator-worker-discipline.md`
   - `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md`
4. Обновляет маркер `<!-- last-synced: YYYY-MM-DD -->` в обоих файлах
5. Выводит diff чтобы оператор увидел что изменилось перед коммитом

Запуск: `bash scripts/sync-shipped-skill-context.sh` — вручную, когда оркестратор менялся.

---

## §2 Ограничения

- Скрипт должен быть идемпотентным (повторный запуск без изменений = no-op)
- НЕ автокоммитит — оператор смотрит diff и коммитит сам
- НЕ запускается из CI (источник ~/.claude/ вне репо)
- Если ~/.claude/skills/orchestrator/SKILL.md не найден → понятная ошибка, не silent fail

---

## §3 Смежные файлы

- `agents/orchestrator-worker-discipline.md` — целевой файл (B)
- `packages/core/templates/shared/skill-context/aif-orchestrator-discipline/SKILL.md` — целевой файл (D)
- `~/.claude/skills/orchestrator/SKILL.md` — источник (оператор-сторонний, вне репо)
- `docs/runtime-bridge-setup.md §Operator convenience` — документация где упоминается этот подход

---

## §4 AI-traps active

- T11 — проверить нет ли уже похожего скрипта в `scripts/` до написания
- T5 — не лезть в shipped файлы руками, только через скрипт
- T19 — запустить скрипт и проверить output перед PR

---

## §5 Deliverable checklist

- [ ] `scripts/sync-shipped-skill-context.sh` написан и идемпотентен
- [ ] Тест: запустить на живом `~/.claude/skills/orchestrator/SKILL.md`, проверить diff
- [ ] PR против staging, `--no-auto-merge` (оператор смотрит diff перед merge)
- [ ] `Prior-art: skipped — new script, no capability commit (scripts/ not packages/)` в commit trailer
EOF
echo "kickoff written"
```bash host-verify
# Retro-marked 2026-08-21: the sibling drift gate on the same shipped-skill surface; the deliverable script scripts/sync-shipped-skill-context.sh lands beside it
bash scripts/check-skill-drift.sh
```
