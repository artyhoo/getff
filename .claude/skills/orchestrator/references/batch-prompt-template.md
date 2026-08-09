# Стандартный шаблон промта младшей (Phase 3) + Mode B file-prompt механика

> Тело SKILL.md держит триаж и правила диспатча; здесь — полный шаблон батч-промта и детали Mode B. Для Queue-mode Worker'ов есть отдельный шаблон: [worker-template.md](worker-template.md).

## Шаблон батч-промта

Self-contained. Контекст младшей пуст — не предполагай что она помнит этот разговор. Подставляй значения из discovery.

```text
TASK: <одна строка>
UMBRELLA: <TASK_ID или umbrella name> / <branch> (база: <BASE_BRANCH>)
WORKDIR: <abs path из discovery>
BATCH: <буква>, правки № <list>

CONTEXT (что нужно знать):
- Это правка(и) из umbrella <TASK_ID> (батч <буква>)
- Проектные правила (CLAUDE.md / AGENTS.md / .claude/rules/) подгружаются автоматически — ссылайся, не пересказывай
- ЕСЛИ затрагиваешь <тема X> → активируй skill <project-skill-name> (имя из ls .claude/skills/, не пересказывай)
- НЕ создавай PR, НЕ пушь — это старшая
- НЕ запускай build — медленно. Финал делает старшая.
- Один коммит на правку (или один на батч если 2-3 правки в одном файле)
- Формат коммита: <COMMIT_FORMAT из discovery, например `fix(<TASK_ID>): описание`>
- Язык commit message: <COMMIT_LANG из discovery>

WHAT TO CHANGE:
<точное описание + предполагаемый файл если есть>

HOW TO FIND IF FILE UNKNOWN:
grep -rn "<характерная часть>" <src dir или .>

DO:
1. Найди файлы (если не указаны)
2. Поправь точечно — НЕ refactor, НЕ переделывай структуру
3. VERIFY (см. ниже) — выполни всё, приложи доказательства
4. Закоммить в формате <COMMIT_FORMAT>

VERIFY (выполни и приложи в REPORT):
1. grep -rn "<новый текст>" <src>        → есть строка
2. grep -rn "<старый текст>" <src>        → пусто (или только комменты/история)
3. <TYPECHECK команда>                    → exit 0
4. <LINT команда>                         → 0 errors
5. (опц.) <TEST команда для затронутых>   → green
6. git log -1 --format="%H %s"            → формат правильный
7. git diff HEAD~1 --stat                 → ожидаемые файлы

DECISIONS LOG (отдельная секция в REPORT):
- Если правка двусмысленна и пришлось выбирать — «Decision: <что выбрал>, Reason: <почему>»
- Если текст уже частично заменён / контекст странный — отметь
- Если правка задевает соседний код (импорты, типы) — перечисли что и почему

REPORT (строгий формат, без воды):
- Файлы: <путь:строка>, ...
- Diff: 5–15 строк (приложи `git diff HEAD~1 -- <file>`)
- VERIFY: grep новый ✅, grep старый ✅, typecheck ✅, lint ✅ (X warnings)
- Commit: <SHA> — <full subject>
- Stat: N files, +X/-Y
- DECISIONS: <log из секции выше или «нет ambiguity»>
- Confidence: high/medium/low (low = неуверенность что фикс верен)
- ATTN: <если что-то странное / нужно решение старшей; «нет» если всё чисто>
```

## Mode B: file-prompt механика

Пишешь `.md` → пользователь открывает Sonnet-окно → копирует → приносит REPORT.

- **Где живут файлы:** `.claude/orchestrator-prompts/<umbrella>/` (gitignored).
- **Naming:** `<umbrella>-batch-<letter>.md`.
- **Очистка:** после слияния umbrella PR — `rm -rf .claude/orchestrator-prompts/<umbrella>/` или оставить как audit trail.
- Содержимое file-prompt = тот же шаблон батч-промта выше, плюс шапка «открой новую сессию, скопируй ВСЁ».

Use `Skill('superpowers:subagent-driven-development')` examples for per-task implementer prompt structure.
