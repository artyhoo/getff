# AI documentation organization — hot/cold split, drift detection, AGENTS.md

> AGENTS.md загружается в каждую сессию и съедает токены. Что попадает туда — должно зарабатывать каждую строку.

Этот документ — про организацию AI-документации в проекте. Что класть в `AGENTS.md` (или `CLAUDE.md`), что — в `.claude/skills/`, что — в `.claude/rules/`. Как избежать drift'а. Применяется поверх AGENTS.md-стандарта (Linux Foundation, 60k+ projects).

> **Authoritative for:** AI-doc organization conventions — hot/cold split between AGENTS.md / CLAUDE.md / .claude/skills/ / .claude/rules/; drift-detection guidance for AI docs; token-economy heuristics for what earns its line in always-loaded files.
> **NOT authoritative for:** framework's project goal — see [../../../README.md#why-this-exists](../../../README.md#why-this-exists). Doc-authority hierarchy (Authoritative-for header convention used in framework's own repo) — see [.claude/rules/doc-authority-hierarchy.md](../../../.claude/rules/doc-authority-hierarchy.md).

---

## Слои AI-стека и когда что грузится

```text
<project>/
├── AGENTS.md                       ← главная инструкция (hot, ≤150 строк)
├── CLAUDE.md                       ← @import AGENTS.md (или прямой)
├── .mcp.json                       ← MCP серверы (≈6k токенов системного промпта на сервер)
└── .claude/
    ├── settings.json               ← project permissions + deny
    ├── skills/<name>/SKILL.md      ← on-demand (trigger-activated)
    ├── rules/<name>.md             ← file-scoped (paths: frontmatter)
    └── orchestrator-prompts/

~/.claude/                          ← global (все проекты)
├── CLAUDE.md, settings.json, rules/, skills/
```

| Слой                                              | Когда грузится           | Tokens               |
| ------------------------------------------------- | ------------------------ | -------------------- |
| `~/.claude/CLAUDE.md` + global rules без `paths:` | Всегда                   | ~250-1500 каждый     |
| `AGENTS.md` (project)                             | Всегда                   | ~30 tokens на строку |
| `.claude/rules/*.md` с `paths:`                   | При matching файле       | 0 если неактивен     |
| `.claude/skills/*/SKILL.md`                       | При срабатывании trigger | 0 если неактивен     |

**Базовая стоимость сессии:** 4000-7000 токенов до того, как пользователь напишет первое сообщение.

---

## Hot/cold split — что куда

**Hot (в AGENTS.md):**

- Одна строка на правило (не примеры).
- Ссылки на skill/rule с конкретными именами.
- Контекст проекта (stack, key constraints).
- NDA / security правила (всегда).
- Source-of-truth указатели («БД схема в `prisma/schema.prisma`, API контракт в `openapi/`»).

**Cold (в skills/rules):**

- Примеры кода.
- Антипаттерны с объяснениями.
- Edge cases.
- Историческая справка («раньше делали так, теперь — так, потому что ADR-0023»).
- Step-by-step recipes.

### Процесс выноса cold из AGENTS.md

1. **Найти секции >20 строк** — кандидаты на вынос.
2. **Universal (нужно всегда)** → AGENTS.md (кратко, 1-2 строки).
3. **On-demand** → skill с `triggers:`.
4. **File-specific** → rule с `paths:`.
5. **После выноса:** `grep -n "skill\|rule" AGENTS.md` — проверить ссылки.

### Что НЕ выносить

- «НЕ делать» список (видим всегда).
- Репозитории, remote URLs.
- NDA правила.
- Security-critical правила (`requireUser()`, `getClaims()`, `verifyImageMagicBytes()`).
- Правила, которые **должны** загружаться в каждой сессии независимо от файла.

---

## Когда skill, когда rule

|                     | Skill                                                          | Rule                                                    |
| ------------------- | -------------------------------------------------------------- | ------------------------------------------------------- |
| **Активация**       | Trigger keywords из запроса пользователя                       | Автоматически, при работе с файлом из `paths:` glob     |
| **Длина**           | ≤300 строк (>300 — split)                                      | ≤80 строк (исключение — узко-scoped, `src/proxy.ts`)    |
| **Когда применять** | Паттерн в ≥2 сценариях, ≥30 строк, не нужен в каждом сообщении | Применяется к конкретным файлам, грузится автоматически |
| **Frontmatter**     | `triggers: kw1, kw2, ...` (5-8 RU+EN)                          | `paths: [...]`                                          |

### Skill template

```markdown
---
name: <kebab-case>
description: Use when <конкретный сценарий> — <что содержит>.
triggers: keyword1, keyword2, ключевое слово, ...
---

# <Название>

## 1. Главное правило / quick reference

<что агент должен знать в 90% случаев — первым>

## 2. Паттерны

### 2.1 <Паттерн>

<код + объяснение>

## 3. Антипаттерны

- ❌ <что нельзя>

## 4. Примеры из проекта

<src/lib/..., src/app/actions/...>

## Связанные

- skill `<другой>` / rule `.claude/rules/<name>.md`
```

**Правила оформления skill:**

- `description:` начинается с **«Use when»** (harness ключевая фраза для активации).
- `triggers:` — ≥5 ключевых слов, RU+EN, покрывают вариативность запроса (не только техжаргон).
- ≤300 строк (если больше → split по use case или layer).
- Ссылки на реальные файлы проекта, не выдуманные.

### Rule template

```markdown
---
description: <одна строка>
paths:
  - src/app/actions/**/*.ts
---

# <Название>

## Обязательно

1. <правило>

## Запрещено

- ❌ <что нельзя>

## Паттерн

\`\`\`typescript
// Правильно vs неправильно
\`\`\`

## Связанные

- skill `<name>`
```

**Правила оформления rule:**

- `paths:` формат — **block sequence YAML** (как выше). НЕ inline `paths: ['...']` — для consistency и читаемости в diff.
- Глоб не пустой: `find . -path "<paths-glob>" | head -5` — ожидаем ≥1 матч.
- ≤80 строк (исключение — узко-scoped rule, например только `src/proxy.ts`).
- Нет копипасты AGENTS.md — ссылки на skill/rule, не копии.

---

## Когда НЕ обновлять AGENTS.md таблицу skills

Если стратегия проекта — **slim AGENTS.md** (≤150 строк), и skill триггерится надёжно по `description:` — **не каждый skill идёт в таблицу**. Только те, которые:

- Агент должен **знать о наличии** (даже если не активирует прямо сейчас, а ссылается на «есть skill X для этого»).
- **Часто упоминаются** в других skills/rules как ссылка.

Иначе: skill живёт в `.claude/skills/`, harness активирует через `description:`, AGENTS.md остаётся slim.

Это снижает токен-нагрузку и повышает фокус AI: вместо «вот 30 skills, выбери», получает «вот 5-7 ключевых, остальные — по триггеру».

---

## Drift detection

**Drift** = AGENTS.md / orchestrator / settings ссылается на файл, которого нет (или который устарел).

### Standard checks

```bash
# Skills задекларированы vs существуют (фильтр template-маркеров)
# Используем awk вместо grep -oP — портируется на BSD grep (macOS).
awk 'match($0, /skill `[^`]+`/) { print substr($0, RSTART+7, RLENGTH-8) }' AGENTS.md \
  | grep -v '^<' | sort -u | while read s; do
    [ -d ".claude/skills/$s" ] || echo "MISSING: $s"
  done

# Rules
awk 'match($0, /\.claude\/rules\/[^[:space:]`)]+/) {
  print substr($0, RSTART+15, RLENGTH-15)
}' AGENTS.md | grep -v '<name\|<glob' | while read r; do
  [ -f ".claude/rules/$r" ] || echo "MISSING rule: $r"
done

# Dead-end Edit-permissions в settings
grep "\.claude/skills" ~/.claude/settings.json | grep -v "#"

# TODO в JSON конфигах
grep "_comment\|TODO" .mcp.json .claude/settings.json
```

**Фильтр `grep -v '<name\|<glob'`** — убирает false positives из template-блоков (README шаблоны с `<name>`, `<glob1>` и т.д.).

### Trigger overlap detection

Когда два skill реагируют на одно и то же ключевое слово, AI грузит **оба** — двойная стоимость токенов и confusion в выборе.

```bash
# Все triggers, выделить дубли
for f in .claude/skills/*/SKILL.md; do
  name=$(basename $(dirname "$f"))
  grep "^triggers:" "$f" | sed "s/triggers: //; s/, /\n/g" | sed "s/^/$name: /"
done | sort -k2 -t: | awk -F': ' '{print $2 "\t" $1}' | sort | uniq -c -f0 | awk '$1>1'
```

Конфликтующий trigger → решить, какой skill «owner»: убрать из остальных, заменить более специфичным.

### `paths:` формат consistency

```bash
# Найти inline array (не consistent со школой)
grep -rn "^paths: \[" .claude/rules/

# Должно быть пусто. Если найдено — переделать на block sequence:
#   paths:
#     - <glob>
```

### Stale orchestrator-prompts

```bash
# Файлы старше 14 дней не в archive/
find .claude/orchestrator-prompts -maxdepth 2 -mtime +14 \
  -not -path "*/archive/*" -name "*.md"
# → проверить глazами + переместить завершённые в archive/
```

Порог 14 дней — настраивайте под цикл проекта.

---

## Token economy

**Сигналы перегрузки** (видны в реальной работе с агентом):

- Агент **переспрашивает банальное** (забывает AGENTS.md правила).
- **Игнорирует skills**, полагается на тренировочные знания.
- Ответы стали **короче / поверхностнее** при тех же запросах.
- Агент **пропускает шаги** в установленных workflow.

**Action:** AGENTS.md ≤150 строк, global rules — только с `paths:` или universal. Перенести cold-content в skills/rules с `triggers:`.

### Метрики здоровой инфраструктуры

| Метрика                             | Target            | Alarm |
| ----------------------------------- | ----------------- | ----- |
| AGENTS.md строк                     | ≤150              | >300  |
| Drift (skills задекл./существ.)     | 0%                | >20%  |
| Auto-loaded tokens                  | <5000             | >8000 |
| Rules без `paths:` (global)         | 0 (или universal) | >2    |
| Trigger overlaps                    | 0                 | >3    |
| Dead-end permissions                | 0                 | >5    |
| Orchestrator-prompts (вне archive/) | ≤5                | >15   |

---

## .mcp.json — MCP servers

```json
{
  "mcpServers": { "<name>": { "command": "npx", "args": ["-y", "<package>"] } }
}
```

- Только активно используемые (каждый ≈6k токенов системного промпта).
- Нет `_comment_*` или `TODO`.
- Нет «на всякий случай».

```bash
# Проверка использования
grep -rn "mcp__<name>" .claude/orchestrator-prompts/ | grep -v archive | wc -l
# 0 → удалить
```

---

## settings.json — permissions

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(gh pr create*)",
      "mcp__context7__*",
      "mcp__shadcn__*"
    ],
    "deny": [
      "Bash(git push --force*)",
      "Bash(git push -f *)",
      "Bash(git commit --no-verify*)",
      "Bash(git push *main*)"
    ]
  }
}
```

**Project-specific deny** (NDA, prod deploy, prod БД) — в **оба места** (global + project), defense in depth.

| Тип                              | Где                             |
| -------------------------------- | ------------------------------- |
| `npm run`, `git`, `gh` — generic | Global                          |
| Project-specific scripts         | Project                         |
| Critical-deny                    | Оба                             |
| MCP servers                      | Project (только из `.mcp.json`) |

---

## Lessons learned (из реальной практики)

### 1. Dual-remote проекты — `.claude/` в `.gitignore` work-репо

При `git checkout` на ветку от work-репо файлы из `.claude/` могут исчезнуть. Симптом: `AGENTS.md` упоминает skill X, а `.claude/skills/X/` пуст. На самом деле — потеря через `.gitignore`, а не реальный drift.

```bash
# Проверить ВСЕ ветки
git log --all --oneline -- '.claude/skills/' | head -5
git ls-tree -r develop --name-only | grep '^\.claude/'

# Восстановление
git show develop:.claude/skills/<name>/SKILL.md > .claude/skills/<name>/SKILL.md
```

**Урок:** при подозрении на drift в dual-remote — **первым делом** `git log --all`, не сразу пересоздавать.

### 2. Skills декларируются заранее, создаются никогда

`AGENTS.md` ссылается на skill X «который сделаем», месяц спустя X нет. Рассчитываем на поведение, которого у AI нет.

**Урок:** не упоминать skill в AGENTS.md, пока файл не закоммичен. drift-чекер должен это ловить — `MISSING: <name>` в выводе.

### 3. TODO в JSON выживают всё

`_comment_TODO` в `.mcp.json` пережил 30+ коммитов — JSON-комменты невидимы в diff (или почти невидимы), и никто на них не обращает внимания.

**Урок:** TODO → задача в трекере. Не в JSON. Drift-чекер должен искать `_comment` / `TODO` в `.mcp.json`, `.claude/settings.json`, `.ai-factory/*.json`.

---

## Связано

- `references/self-testing-docs.md` — code-vs-docs probes как extension этой рамки на runtime-проверки.
- `references/checks-map.md` — где этот аудит живёт в общей карте уровней (уровень 5 — CI on PR).
- `agents/living-docs-auditor.md` — sub-agent, который прогоняет drift-проверки под `/aif-verify`.
