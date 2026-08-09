---
name: orchestrator
description: |
  TRIGGER when: «оркестратор/orchestrator», «старшая/младшая модель», «делегируй/delegate»,
  «Mode A/B», «file-prompt», «umbrella», «батч правок/batch fixes», «пакет фиксов»; ИЛИ первая
  из серии мелких правок одной темы; ИЛИ задача распадается на ≥3 независимых подзадач; ИЛИ
  «автономно / волнами / работай без остановок / прогони очередь кикофов сам» при ≥2 kickoff'ах
  → Queue mode.
  SKIP: тривиальная правка по точному пути (≤5 строк, 1 файл).
when_to_use: оркестратор, организатор, ты старшая, батч правок, umbrella, пакет фиксов, много мелких, делегируй, младшая модель, координируй, разбей на подзадачи, orchestrator, batch fixes, delegate, queue mode, kickoff, autonomous research, worker dispatch, воркер, ревьюер, очередь задач, автономно, волнами, итеративно, работай без остановок, прогони очередь кикофов, цикл кикофов, не останавливайся, сам до конца
---

# Orchestrator — старшая координирует, младшие делают и верифицируют

## Glossary — three roles

> Full definitions and hierarchy rules: [references/glossary.md](references/glossary.md)

| Role | One-sentence definition |
|---|---|
| **Orchestrator** | Main session (Opus); owns queue, state.md, dispatch, anti-collusion spot-check, memory updates |
| **Worker** | Subagent that executes one kickoff; writes output; does NOT spawn sub-queues |
| **Reviewer** | Subagent that verifies Worker output cold; returns GO or REVISE; does NOT fix |

Hierarchy depth = 2 (Orchestrator → Worker/Reviewer). `claude-code-guide` and MCP tools are utility helpers — not roles. See [references/glossary.md](references/glossary.md) for details.

## Vocabulary alignment — companions

Our terms (Mode A/B, Worker, Reviewer, Orchestrator dispatch loop) map 1:1 onto companion vocabulary (Superpowers, aif-handoff, OhMyOpencode) — aligned naming, no runtime dependency. Full mapping table: [references/rationale.md](references/rationale.md).

---

Реализация двух паттернов из [Anthropic «Building Effective Agents»](https://www.anthropic.com/engineering/building-effective-agents):

- **Orchestrator-workers**: старшая динамически разбивает umbrella-задачу на под-фиксы и делегирует исполнение младшим. Контекст исполнителей изолирован.
- **Evaluator-optimizer**: младшая генерирует фикс + сама верифицирует (тесты, grep, diff stat). Старшая = evaluator: смотрит REPORT, в случае red-флагов отправляет follow-up.

Цель: **изоляция контекста старшей** + **максимум качества reasoning'а** + **один PR на umbrella**.

---

## Project bootstrap — discovery при первом запуске в проекте

Скил универсальный. В **новом проекте** старшая один раз молча делает discovery — без него промты младшим будут содержать неверные команды/конвенции. Семь областей:

1. Корень проекта + язык/формат коммитов (`pwd`, `git log --oneline -20`)
2. Project instructions (`CLAUDE.md` / `AGENTS.md` — ссылаться, не пересказывать)
3. Git topology (remote, базовая ветка, `<owner>/<repo>`)
4. Task-ID convention из последних коммитов
5. Build/check-команды + package manager (`<TYPECHECK>` `<LINT>` `<TEST>` `<CHECK_ALL>`)
6. Project-local skills/rules (`ls .claude/skills/ .claude/rules/`) — упоминать по имени, auto-trigger подгрузит
7. File-prompt directory в `.gitignore` (для Mode B)

Кэш — in-head на сессию (переснять при смене ветки/remote). Skip: уже работала в репо в этой сессии, или задача = одна тривиальная правка (→ прямой `Edit` без workflow). **Полный чек-лист с командами, вопросами пользователю и шаблоном `orchestrator.local.md`: [references/discovery.md](references/discovery.md).**

> After discovery: `Skill('superpowers:subagent-driven-development')` for PRD-driven decomposition, `Skill('superpowers:writing-plans')` for structured plan creation. Discovery is our niche; decomposition is companion's.

---

## Дефолт — Mode A (inline `Agent` на Opus). Mode B (file-prompt → Sonnet) — явная опция

**Mode A = дефолт для всего: execution, research, audit, verification.** Спавн inline `Agent` из старшей сессии: немедленный результат, ноль ручного copy-paste, сильный reasoning, можно ветвить план по interim-результатам. Контекст исполнителя изолирован (для write-задач — `isolation: "worktree"`).

**Почему A, а не B:** Opus-квота — не дефицит на Max plan, поэтому дефолт — сильный reasoning inline (а верхнюю ступень Fable держим для самых сложных задач, см. «Правило модели»). Mode A даёт немедленный результат без ручного overhead'а; Mode B (отдельное Sonnet-окно) требует ручного copy-paste каждого промта и REPORT'а, и его latency + overhead обычно дороже выигрыша — кроме случаев ниже.

**Mode B — явная опция, не дефолт.** Бери B только когда выполнено хотя бы одно: (a) **N-кратная параллель** через N живых окон даёт реальный throughput-выигрыш сверх параллельных inline-Agent'ов одним сообщением; (b) нужен **persistent audit-trail** файлом-промтом; (c) пользователь **явно** просит разгрузить Sonnet-квоту И готов платить ручным copy-paste. Механика file-prompt: [references/batch-prompt-template.md](references/batch-prompt-template.md).

**Правило модели для Mode A (три ступени по сложности задачи):**

- **Fable** (`model: "fable"`) — для **самых сложных** задач: глубокий архитектурный анализ, adversarial cold-review необратимых операций, тонкий multi-file reasoning, где цена ошибки высока. Самая мощная ступень — держи для верхнего края сложности, не для рутины.
- **Opus** (`model: "opus"` или без параметра — наследует Opus) — **дефолт** для обычной объёмной работы и сложного reasoning'а.
- **Sonnet** (`model: "sonnet"`) — допустимая опция для задач попроще с реальной разводкой квоты. (На некоторых setup'ах Sonnet-via-Agent исторически списывался на Opus-пул — проверь на своём: после первого Sonnet-dispatch сверься по `/status` или `claude.ai/usage`, что расход лёг на Sonnet. История и детали: [references/rationale.md](references/rationale.md).)

Выбирай модель по сложности задачи, а не по запрету. Все три передаются через Agent tool (`model` принимает `fable` / `opus` / `sonnet`).

> `Skill('superpowers:subagent-driven-development')` provides the Coordinator/implementer/reviewer role model. See §Vocabulary alignment above.

---

## Три способа выполнить работу — выбор по размеру задачи

> **Главное правило: смотри на размер задачи, потом на тип.**
>
> 1. **МЕЛКАЯ правка** (1 файл, ≤5 строк, путь известен, явная замена X→Y — опечатка, rename, текст кнопки) → **старшая сама через `Edit`**. Спавнить агента ради `s/foo/bar/` дороже чем сделать руками.
> 2. **ОБЪЁМНАЯ execution-работа** (≥2 файлов ИЛИ ≥10 строк ИЛИ нужен grep/поиск ИЛИ меняется логика) → **Режим A: inline `Agent`** (write-задачи с `isolation: "worktree"`; параллель — несколько Agent-вызовов одним сообщением).
> 3. **READ-ONLY research / audit / discovery / verification** → тоже **Режим A: inline `Agent`**. Результат немедленно в parent session; можно multi-turn follow-up и ветвить план по interim-результатам.
>
> **НЕ Mode A:** ≥2 research-kickoffs автономной очередью → **Queue mode**; тривиальные правки → **direct Edit**; N-окон-параллель / audit-trail / Opus-пул в Red / явная Sonnet-разгрузка → **Mode B**.

**Quota:** Mode A = общий пул с Orchestrator (Opus по дефолту; `model: "sonnet"` допустим для задач попроще с реальной разводкой квоты — см. «Правило модели»).

### Decision matrix (каноническая — Phase 3 ссылается сюда)

| Размер / тип задачи                                          | Способ                       |
| ------------------------------------------------------------ | ---------------------------- |
| **МЕЛКАЯ**: 1 файл, ≤5 строк, путь известен, замена X→Y      | **Старшая сама через `Edit`** |
| **ОБЪЁМНАЯ execution**: ≥2 файлов ИЛИ ≥10 строк ИЛИ grep ИЛИ logic-changes | **Режим A (inline Agent на Opus)** ← DEFAULT |
| **Research / audit / discovery / verification**              | **Режим A (inline Agent)**   |
| Параллельные независимые батчи объёмной работы (file-lock OK) | **Режим A × N вызовов одним сообщением** (`isolation: "worktree"`); **Mode B × N окон** если нужен throughput живых окон |
| Pre-flight: git stash / branch setup / итоговый push + PR    | Старшая сама                 |
| Нужен N-окон-параллель / audit-trail / Opus-пул в Red / явная Sonnet-разгрузка | **Режим B (file-prompt)** — явная опция |
| Явное «делай сам / не пиши промт»                            | Режим A                      |
| **Autonomous research, ≥2 kickoffs in queue, maintainer wants autonomy** | **Queue mode** (see [references/queue-mode.md](references/queue-mode.md)) |

---

## Cross-session dispatch — worktree by default

Любая dispatch новой Claude Code сессии (fresh R-phase, новое окно для Mode B, autonomous research kickoff, переключение в свежий контекст после `/clear`-у-другого-окна) — **в отдельном worktree, не в shared workdir**. Дефолт, не опция.

Use `Skill('superpowers:using-git-worktrees')` — mature upstream. Step 0 определяет уже-активный worktree (`GIT_DIR != GIT_COMMON_DIR`, с submodule-guard) и **пропускает** вложенное создание → совместим с `isolation:"worktree"` ниже; есть sandbox-fallback.

Quick commands: `git worktree add ../<repo>-<task-slug> <BASE_BRANCH>` / `git worktree remove ../<repo>-<task-slug>` (после завершения).

Наш niche above `using-git-worktrees`: umbrella quota zones, Phase -1 protocol, Mode A/B dispatch. См. §Quota monitoring и §Phase -1.

---

## In-session sub-agent isolation — `Agent` tool `isolation: "worktree"`

При делегации через `Agent` tool **внутри текущей сессии** старшая передаёт `isolation: "worktree"` когда младший будет писать.

**Обязательно когда:**
- Любой sub-agent с **Edit / Write / Bash mutations / commits / git ops**
- Параллельный батч ≥2 одновременных агентов — **даже если все read-only** (race на `.git/index`)
- Bypass permissions mode включён — ошибка subagent'а в shared workdir не имеет undo
- Agent teams — все teammates наследуют bypass; изоляция — единственная защита от cross-contamination

**Можно пропустить:** одиночный read-only Explore / grep / file-read без параллельных агентов.

```javascript
// Write-делегация — ОБЯЗАТЕЛЬНО isolation
Agent({ subagent_type: "claude", description: "...", prompt: "...",
  isolation: "worktree" })   // ← worktree автоматически создаётся и убирается

// Read-only исследование — isolation опционален
Agent({ subagent_type: "Explore", description: "...", prompt: "..." })
```

❌ Anti-patterns: write-работа без изоляции в bypass mode (undo нет); параллельный батч без изоляции «потому что все только читают» (race на git/index всё равно возможна).

---

## Phases (быстрый обзор)

| #   | Фаза            | Действия старшей                                          | Когда заканчивается                  |
| --- | --------------- | --------------------------------------------------------- | ------------------------------------ |
| **-1** | **Self-review своего kickoff** | **Холодное ревью prompt'а через 1-2 independent reviewer'ов** (1× Opus default; 2× Opus для prod-blast-radius) перед dispatch | Оба reviewer'а вернули GO (или ≤3 итераций амендмента) |
| 0   | Pre-flight      | Стэш WIP, ветка от `<BASE_BRANCH>`                        | Ветка готова, working tree чистый    |
| 1   | Приём правок    | 2–3 строки на правку, ноль grep/Read                      | Пользователь говорит «всё/план»      |
| 2   | Планирование    | Таблица батчей, согласование                              | Пользователь подтверждает план       |
| 3   | Делегирование   | Спавн Agent-ов, **quota check после каждого batch**       | Все батчи отчитались зелёным         |
| 4   | Контроль и PR   | Финальный sanity-check, push, PR                          | PR создан, ссылка отдана             |
| 4.5 | Pre-PR self-audit | Cross-ref claims + citation validation + niche audits  | Zero ATTN → push                     |

---

## Quota monitoring (сквозное правило, действует с Phase 3)

Старшая отслеживает расход квоты в реальном времени и переключает режим при пересечении порогов. Без этого можно упереться в 429 посреди batch'а и потерять прогресс.

### Что отслеживать

- **После каждого Agent-вызова** в tool result есть блок `<usage>total_tokens: N tool_uses: M duration_ms: T</usage>`. **Запоминай N для каждого вызова.**
- **Cumulative Opus** = сумма total_tokens по всем inline Agent-вызовам + эстимейт по моим действиям (~500-1500 tokens на развёрнутое сообщение, +500-2000 на Read большого файла).
- **Cumulative Sonnet** = напрямую не отслеживается из этой сессии: Mode B идёт в отдельных окнах. Ориентируйся на сигнал пользователя («Sonnet ~200k», «sonnet жёлтый») или попроси `/status` из его сессий.

### Зоны и реакция

| Зона          | Sonnet cumul | Opus cumul (моё) | Действие                                                                                                                         |
| ------------- | ------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 Green      | <150k        | <30k             | **Mode A — дефолт для всего** (execution + research). Продолжать. |
| 🟡 Yellow-S   | 150–350k     | <30k             | Sonnet-пул на исходе — не критично, Mode A на Opus-пуле работает свободно. Если использовал Mode B параллельно — уплотни окна. |
| 🟡 Yellow-O   | <150k        | 30–80k           | **Opus-пул под нагрузкой — ВОТ когда Mode B оправдан:** перенеси объёмную execution в Mode B (file-prompt → Sonnet-окна), чтобы разгрузить Opus. Mode B здесь = клапан сброса давления, не дефолт. Минимизируй свои Read/Bash. |
| 🔴 Red        | >350k        | >80k             | **Пауза.** Сообщить состояние, предложить: (а) `/clear` и продолжить, (б) перерыв до reset, (в) убедиться что оставшиеся батчи в Mode B. |
| ⛔ Critical   | 429          | то же            | Стоп. Залогировать что закоммичено / что в working tree, ждать reset. |

### Reset windows

Anthropic Max plan: квоты обнуляются каждые 5 часов скользящим окном. Точные цифры — `/status` (если работает) или claude.ai/usage. Ориентировочные лимиты: Opus ~200k/5h, Sonnet ~1M/5h. **Числа неточные** — это grey-area. Используй для прикидки порогов.

> **Fable (верхняя ступень) в зоны выше НЕ заведён** — размер пула и окно сброса неизвестны, а выдумывать пороги = фабрикация. Поскольку Fable — самая мощная и, вероятно, самая дефицитная модель, трать её **осознанно и выборочно** (только «самые сложные задачи» из «Правила модели»), веди свой счётчик Fable-вызовов вручную и сверяйся с `/status`. Завести Fable в светофор — follow-up, когда появятся реальные цифры лимита.

**Формат сообщений о квоте пользователю + Burn mode (явное «жги Opus» по сигналу): [references/quota-and-burn.md](references/quota-and-burn.md).** Кратко: при смене зоны — одна строка в начале следующего отчёта; per-batch без смены зоны — тишина; burn mode только по явному триггеру пользователя, никогда автономно.

### Антипаттерны quota-monitoring'а

- ❌ Игнорировать `<usage>` в tool result.
- ❌ Молча гнать в Red zone «авось хватит».
- ❌ Считать каждый раунд заново. Веди cumulative с начала сессии.
- ❌ Тратить Opus на quota-tracking. Это in-head операция.
- ❌ Сообщать пользователю о квоте per batch если зона не сменилась — спам.

---

## Phase -1 — Self-review своего kickoff (paranoia at start)

Холодное чтение собственного dispatch-промта 1–2 независимыми reviewer'ами **до** отправки — ловит ambiguity, устаревшие ссылки и скрытые допущения, пока executor их не выполнил. Два reviewer'а, а не один: соло-ревью пропускает собственное слепое пятно. Embedded self-review внутри самого промта НЕ считается одним из двух — тот же контекст исполнения, не independent. Мотивирующие инциденты и ROI: [references/rationale.md](references/rationale.md).

**Must-trigger:**
- Multi-step kickoff/prompt **≥30 строк** для младшего агента
- Делегирование **≥3 distinct subtasks** одной сессии младшему
- Prompt включает git/PR операции, file edits, capability-commit territory, principle-test additions, или rule-bearing changes
- **Любой Mode B file-prompt** (формат «открой новую сессию, скопируй ВСЁ»)
- **Любая операция с irreversible blast radius** (prod DB write, force-push, package downgrade) — даже если промт маленький

**Skip OK:** direct Edit без младшего; one-shot тривиальная задача (≤10 строк prompt, один Bash/Read/Edit); read-only research-вызов.

**Скелет протокола:** (1) прочитать свой prompt холодно → (2) спавн reviewer'ов с focus-split A/B → (3) собрать findings → (4) BLOCKER/MAJOR — править prompt, MINOR — лог в known-residuals → (5) re-review ОБОИХ параллельно после правки BLOCKER, max 3 итерации → GO. **Полный протокол (шаблон reviewer-промта, focus split, cost framing, T-traps, anti-patterns): [references/phase-minus-1.md](references/phase-minus-1.md).**

### Principle-test allowlist probe (обязательное измерение при NEW files под наблюдаемыми путями)

Если dispatch создаёт ≥1 НОВЫЙ файл под путями, которые сторожат principle-тесты проекта (для rules-as-tests-aif: `.claude/skills/**`, `.claude/rules/**`, `agents/**`, `docs/meta-factory/research-patches/**`, `packages/core/templates/**`) — Phase -1 ОБЯЗАН включить измерение: «для каждого NEW пути grep `packages/core/principles/` на `EXEMPT_*` allowlists + структурное правило; подтвердить, что артефакт удовлетворяет правилу ИЛИ подпадает под exemption». Проба: `grep -rn 'EXEMPT_\|allowlist\|skip' packages/core/principles/ | grep -E '\.(test\.)?ts:' | head -20`. Инцидент-основание: PR #264 пушился дважды — принципы 15 (paired-negative) и 10 (scope annotation) сработали ПОСЛЕ того, как 11-измерений Phase -1 оба пропустил. (Переехало из CLAUDE.md «Operational conventions» 2026-07-21 — этот скилл и есть заявленный codification target.)

### Реализация subagents (default = Opus)

| Сценарий | Реализация | Cost |
|---|---|---|
| **Самые сложные / max-reasoning** (сложнейший дизайн, необратимая операция) | Fable (`model: "fable"`) | самая мощная ступень, использовать выборочно |
| **Default** subagent через Agent tool | **Opus** (omit `model` или `model: opus`) | ~30-50k Opus per call |
| **Prod-blast-radius** double coverage | 2× Opus через Agent parallel (топ-край → 1× Fable) | ~60-100k Opus |
| Пользователь явно сказал «экономь / Sonnet» | 2× Sonnet через Agent tool (`model: "sonnet"`; или Mode B file-prompts для живых окон) | ~0 Opus из текущей сессии |

**Когда orchestrator пишет под-промт для другой сессии** — под-промт **должен явно** указывать реализацию (Mode A 1× Fable / 1× Opus / 2× Opus / 2× Sonnet / Mode B 2× Sonnet). Выбор модели — по сложности задачи.

---

## Phase 0 — Pre-flight (один раз перед стартом)

**Старшая делает сама** (не делегируется). Команды используют значения из discovery.

```bash
# 1. Сохранить чужие WIP-изменения
git status --short                                # увидеть что есть
git stash push -u -m "wip: pre-umbrella <TASK_ID>"  # если что-то есть

# 2. Засинкаться + базовая ветка
git fetch <REMOTE>

# 3. Создать umbrella-ветку (паттерн зависит от проекта)
git checkout -b <type>/<TASK_ID>-<slug> <BASE_BRANCH>
# type ∈ {feat, fix, hotfix, refactor, chore} — выбрать по характеру umbrella
```

Если в Pre-flight `git status` показал WIP не относящийся к umbrella — **спросить пользователя** перед стэшем. Не теряем чужую работу молча.

> After Phase 0 git environment setup completes, use `Skill('superpowers:executing-plans')` to drive plan execution with structured review checkpoints.

---

## Phase 1 — Приём правок

- **Формат ответа на правку:** 2–3 строки, без tool calls.
  ```text
  Понял #N: «<old>» → «<new>» в <screen/файл если назван>. В реестр.
  ```
- **Внутренний реестр.** До 5 правок — в голове. ≥5 — TodoWrite (1 item на правку, status pending).
- **Уточнения.** Если правка двусмысленна — **один** вопрос. Лучше потерять 200 токенов на уточнение чем 5000 на переделку.
- **Не обсуждать UX-минусы.** Пользователь в курсе → решение принято. Молча в реестр.

**Конец фазы:** «всё», «план», «погнали», «достаточно», или явный конец потока.

---

## Phase 2 — План

Одна таблица в одном сообщении:

```text
| # | правка (1 строка)                  | файл/экран            | риск | зависит от | батч |
| 1 | <правка>                           | <file>                | low  | -          | A    |
| 2 | <правка>                           | <file>                | low  | -          | A    |
| 3 | <правка>                           | grep по проекту       | med  | -          | B    |
| 4 | <правка>                           | <file>                | low  | -          | C    |
```

**Правила группировки в батчи:**
- **Один файл = один батч** (минимизирует merge-конфликты).
- **Перекрёстные правки** (рефакторинг имени prop + потребители) — один батч.
- **Независимые батчи** — параллельно (Phase 3).
- **High-risk правки** (логика, не только текст) — отдельный батч, без параллели, тестируется первым.

**Согласование:** короткое «ок?» в конце. Без согласования — в Phase 3 не идти. Это единственная пауза до конца umbrella.

> **For PRD-driven decomposition:** `Skill('superpowers:writing-plans')` for structured plan creation. Import result into batch table above.

---

## Phase 3 — Делегирование (orchestrator-workers)

**Обязательная декларация перед каждым Agent-вызовом или записью file-prompt:**
> «Mode <A|B> для <задача-slug>. Механизм: <inline Agent / file-prompt + Sonnet / Task subagent>. Квота: <Opus-пул / Sonnet-пул>.»

Если не можешь заполнить без обращения к секции «Дефолт — Mode A» выше — перечитай сначала. Никогда не используй метки Mode A/B по памяти. Canonical определения: [references/glossary.md](references/glossary.md).

**Триаж каждого батча — по канонической Decision matrix (§«Три способа» выше):**

1. **Мелкая?** (1 файл, ≤5 строк, путь известен, явная замена) → `Edit` руками. **Не делегируй.**
2. **Объёмная execution?** (≥2 файла ИЛИ ≥10 строк ИЛИ grep ИЛИ logic-changes) → **Mode A inline `Agent`** (write-задачи с `isolation: "worktree"`). Mode B file-prompt — только N-окон-параллель / audit-trail / явная Sonnet-разгрузка.
3. **Read-only research / verification?** → **Mode A inline `Agent`**.

Use `Skill('superpowers:subagent-driven-development')` for the Coordinator→implementer→spec-reviewer→code-quality-reviewer delegation loop.

### Промт младшей

Self-contained (контекст младшей пуст), значения из discovery. **Полный шаблон (TASK/CONTEXT/VERIFY/DECISIONS/REPORT) + Mode B file-prompt механика: [references/batch-prompt-template.md](references/batch-prompt-template.md).**

> **Перед dispatch:** если итоговый prompt ≥30 строк ИЛИ делегирует ≥3 distinct subtasks ИЛИ это Mode B file-prompt ИЛИ операция с irreversible blast radius → **запустить Phase -1 self-review** (см. секцию выше). Окупается с первого пойманного BLOCKER.

### Параллелизация (sectioning pattern)

**Режим A (default)** — N inline `Agent`-вызовов одним сообщением (write-задачи с `isolation: "worktree"`). Немедленно, без ручного copy-paste:

```text
Batch A → Agent(isolation:"worktree")  (file_1)   # без model param → наследует Opus
Batch B → Agent(isolation:"worktree")  (file_2)
Batch C → Agent(isolation:"worktree")  (grep replacement)
```

**Режим B (опция для throughput живых окон)** — N файлов-промтов одним сообщением; пользователь открывает N окон Sonnet.

**File-lock matrix.** Перед параллельным спавном (любой режим) проверь: ни два батча не редактируют один файл. Если пересекаются — sequential.

### Mid-batch sanity check (между батчами)

После каждых 3–4 батчей **один cheap проход** старшей:
```bash
git log --oneline <BASE_BRANCH>..HEAD     # все коммиты в формате?
git diff --stat <BASE_BRANCH>..HEAD       # ничего лишнего?
```

Если что-то не так — **остановиться**, разбираться, не накапливать долг.

---

## Phase 4 — Контроль и PR

### Чтение REPORT (на каждый агент)

Только текст REPORT, не лезть в код. Чек-лист в голове (6 пунктов):

1. Все пункты VERIFY ✅?
2. Файлы в `Stat` соответствуют ожидаемым из плана?
3. `DECISIONS` пустой или объяснимый?
4. `Confidence: high`?
5. `ATTN` пустой?
6. **Quota check:** прибавь `total_tokens` к cumulative, оцени зону. Если зона сменилась — упомянуть; иначе тишина.

Все 6 ✅ → «ok, следующий». **0 tool calls.**

Любой red в 1-5 → «Recovery patterns» ниже.
Yellow/Red в #6 → переключить режим работы.

### Финальный sanity-check (один раз перед PR)

```bash
git log --oneline <BASE_BRANCH>..HEAD     # формат, кол-во коммитов
git diff --stat <BASE_BRANCH>..HEAD       # все файлы ожидаемы
<CHECK_ALL команда из discovery>          # один раз, с build
```

> Use `Skill('superpowers:verification-before-completion')` for the final sanity check before push. The 6-item REPORT checklist above remains the primary gate.

### Push + PR

```bash
git push -u <REMOTE> <branch>
gh pr create [--repo <GH_REPO> если нужно] \
  --base <BASE_BRANCH без префикса remote> --head <branch> \
  --title "<TASK_ID>: <короткое название umbrella>" \
  --body "<body>"   # See Skill('superpowers:finishing-a-development-branch') for body template + pre-marked checkboxes
```

### Восстановление WIP

Если в Phase 0 что-то стэшилось:
```bash
git checkout <предыдущая-ветка>
git stash pop
```

---

## Phase 4.5 — Pre-PR self-audit

**When:** Before `gh pr create` — after REPORT checklist passes, before push.

**Purpose:** honest verify-trace at PR-create time — no unverified claim ships as a checked `[x]`. Steps 1-2 adapt Superpowers `anthropic-best-practices` «Research synthesis workflow»; steps 3-4 are niche additions.

1. **Cross-reference claims:** For every `[x]` checkbox in the REPORT verify-trace, confirm it references a specific tool-call output (file:line, command result, grep output). If any checkbox says «verified» without a concrete artifact — mark `[ ]` and add `ATTN: unverified claim`.

2. **Citation completeness loop:** For every file:line citation in REPORT or PR body — does the cited line exist, and does it evidence the claim (read the line, not just its presence)? If citations are incomplete → return to Worker for evidence (re-dispatch, do not extrapolate).

3. **Companion delegation audit:** For each `Skill('...')` invocation referenced in this umbrella — was it actually invoked, or just mentioned? If referenced but not invoked, the companion's verification step was skipped. Surface as ATTN if material to PR correctness.

4. **Pre-mark PR body checkboxes** (ОБЯЗАТЕЛЬНО перед `gh pr create` / `gh pr edit --body`): ставь **уже отмеченные** `[x]` для всего, что verified через (a) CI зелёный, (b) Worker REPORT verify-trace (буквально перечисленные observed results), (c) reviewer-пробы (`gh pr diff` / `git show` / grep / DB probe). `[ ]` оставлять **только** для physically pending (визуальная приёмка / runtime после migration / third-party access). НЕ extrapolate «merged значит runtime verified» — `[x]` только на пункт, буквально упомянутый в verify-trace. Anti-pattern: скопировать чеклист из kickoff'а пустым — переносит работу пользователю, который должен пройти что и так verified. Особенно для epic→staging агрегирующих PR.

> If Phase 4.5 audit finds ≥1 unverified claim → escalate before PR creation. Zero ATTN → proceed to push + PR.

---

## Recovery patterns (что если что-то пошло не так)

| Ситуация                                                | Действие старшей                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| `VERIFY` failed (grep/test/lint красное)                | Один follow-up промт младшей: «п.N упал, вот вывод <X>, доделай»            |
| `Confidence: low`                                       | Запросить уточнение у пользователя; передать его ответ младшей              |
| `ATTN` непустой                                         | Прочитать ATTN, решить: фикс ок и идём дальше / нужна доработка / спросить |
| Junior закоммитил лишнее (refactor / extra files)       | `git reset --soft HEAD~1` + промт младшей переделать аккуратно              |
| Junior пушнул сам (нарушение)                           | Сразу `git push --delete <REMOTE> <branch>` после согласования с пользователем |
| Два параллельных Agent-а тронули один файл              | Конфликт. Разрулить вручную, для будущего — sequential                      |
| Junior зациклился, не находит файл                      | Промт с явным `find` командой и hint                                        |
| Пользователь меняет правку mid-flight                   | Пересоставить план, отметить что уже сделано, продолжить                    |
| Правка #N технически невозможна                         | **Можно пушбэкнуть** — техническая невозможность ≠ UX мнение                |

---

## Queue mode — autonomous research multi-kickoff

Modes A/B обслуживают **одну задачу**; Queue mode — **серию research-kickoffs**, выполняемую автономно циклами Worker → file-system verify → Reviewer (GO/REVISE, max 5 iter) → anti-collusion spot-check → next.

**When:** ≥2 research-kickoffs в очереди + maintainer дал автономию + у каждого kickoff self-contained acceptance criteria. **NOT for:** одиночные kickoffs (Mode A/B), параллельная code-execution (Mode B × worktrees), kickoffs с открытыми D-вопросами к maintainer'у.

**Всё остальное — pre-flight чеклист, state.md формат, dispatch-цикл, anti-collusion формула, iteration limits, escalation codes, dual-channel верификация CC-клеймов, headless-fallback: [references/queue-mode.md](references/queue-mode.md).** Трапы: [references/ai-laziness-traps-orchestrator.md](references/ai-laziness-traps-orchestrator.md) (T-AO-A…T-AO-L). Шаблоны диспатча: [references/worker-template.md](references/worker-template.md), [references/reviewer-template.md](references/reviewer-template.md).

---

## Communication с пользователем

- **Ноль вопросов между фазами** кроме согласования плана (Phase 2). Поток фиксов не прерывать.
- **Батчированные вопросы.** Все ambiguities из Phase 1 — один список в начале Phase 2.
- **ATTN escalation.** Оценить: можно решить самой / нужно слово пользователя.
- **Status update.** После каждого батча — 1 строка: «батч A: 2 коммита, ok». Не повтор отчёта.

---

## Auto-trigger проектных skills через формулировку промта

Младшая авто-триггерит skills по ключевым словам в её промте. **Не пересказывай содержимое skill** — упомяни имя или контекст-слово (`- ЕСЛИ затрагиваешь <тема> → активируй skill <skill-name>`), младшая прочитает. Список доступных skills — из discovery (`ls .claude/skills/`). Use `Skill('superpowers:using-superpowers')` for CSO discipline (auto-invocation by description match).

---

## Пример walkthrough

For a worked walkthrough of the Coordinator→implementer→reviewer delegation cycle, see `Skill('superpowers:subagent-driven-development')` examples. Our Phases -1 (kickoff self-review), 0 (pre-flight), 1 (приём правок), and 2 (план) are documented in their own sections above and are not covered by companion walkthroughs.

---

## Anti-patterns (видел — переделывай)

- ❌ Каждая правка = отдельный PR. → Один PR на umbrella.
- ❌ Полный check:all после каждой правки. → Только финально.
- ❌ Junior пушит / мержит / создаёт PR. → Только старшая.
- ❌ Длинная проза в REPORT. → Строгий шаблон, bullets.
- ❌ Старшая молча соглашается с `ATTN: ...`. → ATTN — обязательная остановка.
- ❌ Параллельный спавн без file-lock check. → Конфликты в одной ветке.
- ❌ Спавн Agent / writing file-prompt для тривиальной правки с известным путём. → Дешевле `Edit` самой (≤5 строк, 1 файл).
- ❌ `Edit` руками объёмной execution-задачи (≥2 файлов / grep / logic-changes). → Делегируй на **Mode A inline `Agent`** (изоляция контекста + дефолт), а не делай в своём контексте.
- ❌ Гнать всё через Mode B file-prompt «ради экономии Opus» когда Opus-пул в норме. → Mode A — дефолт; Mode B только когда Opus реально под нагрузкой / нужен N-окон-throughput / audit-trail / явная Sonnet-разгрузка.
- ❌ Тянуть Sonnet на задачу, требующую топового reasoning'а (prod-blast-radius ревью, сложный архитектурный анализ). → Там дефолт Opus; `model: "sonnet"` через Agent tool — для задач попроще с реальной разводкой квоты.
- ❌ Pre-flight пропущен, чужой WIP смешался с umbrella. → Стэшить ОБЯЗАТЕЛЬНО.
- ❌ Junior сделал refactor «по дороге». → Reset, переделать узко.
- ❌ Discovery пропущен в новом репо. → Промт младшей будет содержать неверные команды.

> For delegation-specific anti-patterns, see `Skill('superpowers:subagent-driven-development')` §anti-patterns.

---

## Бюджет токенов (red flags)

| Метрика                              | Норма        | Red flag                              |
| ------------------------------------ | ------------ | ------------------------------------- |
| Старшая на 1 правку (промт + отчёт)  | 500–1500     | >3000 → лезет в код вместо Agent      |
| Pre-flight + план для 10 правок      | 3–5k         | >10k → слишком много research старшей |
| Финальный sanity-check + PR          | 2–3k         | >5k → лишние Read/проверки            |
| Junior на 1 правку (своя сессия)     | 5–30k        | (не моя проблема)                     |
| Итого старшей на umbrella из 10      | ~25–35k      | >50k → пересмотреть workflow          |

Если старшая >5k токенов на одну правку → почти всегда лезет в код сама вместо делегирования. Откатиться, спавнить Agent.

---

## Triggers (когда активировать)

- «ты оркестратор / организатор», «делегируй», «координируй»
- «umbrella», «пакет правок», «батч фиксов», «много мелких»
- «1 сообщение = 1 правка»
- Поток коротких задач явно одной темы
- Сам определил что задача = ≥3 независимых под-задач, выполнимых параллельно

→ Сначала Project bootstrap discovery (если ещё не делалось в сессии), затем активировать workflow без переобъяснения.
