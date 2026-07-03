# Meta-Factory: пакет, который генерирует rules-as-tests под конкретный стек через research

> Status: **FROZEN — historical design artifact** (original status at freeze: DRAFT / RFC)
> Date: 2026-05-07
> Authors: Art + AI discussion
> Audience: будущие реализаторы, фреш-сессии Claude/Cursor, контрибьюторы
> Version: `0.4.0-draft` (2026-05-07; Phase 1.D split per §14.1 на 9 sub-docs)
>
> **Authoritative for:** design history and original architectural proposal (Phase 0.5 – 1.D snapshot, May 2026). **FROZEN** — do not retroactively rewrite. Current goal hierarchy is owned by [README.md#why-this-exists](../../README.md#why-this-exists); §1.2 / §1.3 / §1.4 below carry the historical phrasing that pre-dates the 2026-05-09 goal-hierarchy fix. Read as design context, not as the project's current goal statement.

Этот документ — **проектная заявка** на следующее архитектурное направление пакета `rules-as-tests-aif`. Текущий пакет станет одним из компонентов мета-фабрики (canonical example), а новое ядро превратится в генератор, который умеет собирать аналогичные «фабрики правил» под произвольный стек.

Документ намеренно разбит на специализированные sub-файлы (§14.1 plan). Здесь — обзор и навигация.

---

## 1. Контекст и мотивация

### 1.1 Проблема текущего состояния

Текущий пакет — **застывший снимок** best practices мая 2026 для Next 15 + TS-server. Конкретные привязки:

- Next.js **15** в `setup.sh:257` (`@next/eslint-plugin-next@^15.0.0`), при этом Next 16 уже stable с октября 2025 и 16.2 — март 2026
- ESLint 10, Vitest 4, Stryker 8.7 — конкретные версии мая 2026
- Каноническая гексагональная раскладка `src/{domain,application,infrastructure,web}/`
- R12-R20 завязаны на App Router (Server Actions, `'use client'`, `'use server'`)

Через год эта снимка устареет. Через два года — станет вредной (например, `useMemo` антипаттерн в эпоху React Compiler — а пакет будет требовать exhaustive-deps).

### 1.2 Главный тезис

> **Preset-ы устаревают, принципы — нет.** Опираться на принципы вместо preset-ов — это тот же сдвиг, что от документов к тестам, только на уровень выше.

Идея: пакет становится **спецификацией процесса**, а не списка правил.

```text
[invariant core: принципы]
        +
[detected stack: Next 16.2, Fastify 5, etc.]
        +
[research: best practices через context7 / WebSearch]
        ↓
[generated rules-as-tests именно под эту версию]
        ↓
[self-validation by core principles]
        ↓
[install only validated rules]
```

Пакет ест свой собственный собачий корм на этапе генерации: его принципы (5 layers, AST > grep, paired negative tests, mutation testing, two-AI review via AIF `review-sidecar`) применяются к LLM-output как фильтр.

### 1.3 Зачем именно мета-уровень

1. **Релевантность во времени** — апгрейды стэка автоматически порождают апгрейды правил.
2. **Покрытие стэков** — Remix, Astro, Hono, SvelteKit получают свои фабрики без ручного preset.
3. **Демонстрация принципа на максимуме** — если фреймворк проповедует «every rule is a test», то и сама генерация правил должна следовать тому же принципу.
4. **Снижение долговой нагрузки** — не надо вручную поддерживать N preset-ов, отслеживать N changelog-ов, синхронизировать N конфигов.

### 1.4 Позиционирование (added 2026-05-08 after AIF v2.11.0 comparison)

Проект **НЕ parallel framework к AIF**. Проект — **plug-in для AIF runtime**:

- **AIF (lee-to/ai-factory)** — workflow runtime: 30+ skills, slash-команды, sub-agents, `/aif-implement`, `/aif-verify`, `/aif-loop`, `aif-gate-result` JSON contract для cross-skill chaining. **Это решённая задача**, готовая инфраструктура.
- **rules-as-tests-aif** — rule corpus + enforcement layer + recursive self-application guards. Уникально: mutation testing для meta-tests, manifest-as-SSOT с drift detection, paired bad/good examples per rule.

**Operational implication:**
- Roadmap Phase 4-9 переоценён: ~30-40% capability покрывается AIF reuse
- Phase 3 retrofit: integrate AIF skills вместо building parallel orchestration
- Identity: «logical self-application layer» поверх AIF «workflow self-application»
- Versioning: coupling к AIF major versions; semver compatibility tracking required (Phase 11)

**Verification source:** [aif-comparison.md](aif-comparison.md) §9 reuse matrix + §10 confirmed differentiators (validator pass 2026-05-08, context7-only constraint).

---

## 2. Архитектурные слои

→ [architecture.md](architecture.md)

Шесть слоёв (L0 Invariant Core → L5 Installer), поток данных, детали каждого слоя, Path A vs Path B.

---

## 3. Path A vs Path B (генерация AST-правил)

→ [architecture.md](architecture.md) §3

Conservative (только конфигурация плагинов) vs Creative (генерация AST-кода). Переключение через `meta-factory.config.json`.

---

## 4. Воспроизводимость и lock-файлы

→ [versioning-and-locks.md](versioning-and-locks.md)

`rules-lock.json`, diff-режим при апгрейде, общий research-cache на уровне организации.

---

## 5. Failure modes и пауза/возобновление

→ [failure-modes.md](failure-modes.md)

Stateful installer (`.meta-factory-state.json`), команды resume/restart/status, защита от прерываний, offline-режим.

---

## 6. Acceptance test = self-test через 5 слоёв

→ [acceptance-tests.md](acceptance-tests.md)

Self-application invariant с момента 0. Сценарий воспроизведения canonical Next 15. Acceptance test для самого core.

---

## 7. Граница invariant core: тесты на изменяемость

→ [core-stability.md](core-stability.md)

CI job `core-stability`, тесты на immutability принципов, semver для мета-фабрики.

---

## 8. Нишевые стеки

→ [niche-stacks.md](niche-stacks.md)

Confidence score (high/medium/low), поведение фабрики по уровню, реестр `core/supported-stacks.json`.

---

## 9. Текущий пакет → canonical example

→ [migration-from-current.md](migration-from-current.md)

Новая роль пакета, структура нового монорепо, миграционный путь (11 шагов).

---

## 10. Roadmap реализации

→ [roadmap.md](roadmap.md)

Фазы 0–11 с временными оценками и зависимостями. Итого до 1.0: ~4 месяца full-time.

---

## 11. Защита от рисков (сводно)

→ [risks.md](risks.md)

Таблица рисков и защит: воспроизводимость, prompt injection, decay best practices, self-bootstrapping recursion, bypass через `--no-verify`.

---

## 12. Связь с предыдущим планом фаз

| Старая фаза | Что становится с ней |
|---|---|
| **Phase 1** (R2 drift, expected failures, three-tier perms) | Прерequi для всего; **обязательна до старта мета-фабрики** |
| **Phase 2** (rules-manifest SSOT) | Становится **schema** для invariant core; manifest format фиксируется здесь |
| **Phase 3** (depcruise --init) | Становится частью Layer 1 (Stack Detector делегирует ему) |
| **Phase 4** (npm publishing) | Становится distribution для `packages/core`, `packages/meta-factory`, `packages/preset-*` |
| **Phase 5** (spec-driven install) | Становится Layer 5 stateful workflow (см. [failure-modes.md](failure-modes.md) §5.1) |

То есть мета-фабрика **поглощает** все предыдущие фазы как свои внутренние компоненты. Старый план — это инкрементальная дорожная карта; новый план — её эндшпиль.

---

## 13. Открытые вопросы (что ещё не решено)

→ [open-questions.md](open-questions.md)

Granularity research, маркетинг и наименование, граница invariant core, legacy codebase UX, multi-stack monorepos, relationship с AIF, operationalization L2 drift detection, decision matrix expansion rule, bypass через `--no-verify`.

---

## 14. Что дальше

### 14.1 Немедленные следующие шаги

1. **Закрыть Phase 0** (предыдущие Phase 1 + 2): R2 drift, expected-failures section, manifest SSOT. Без чистой базы строить мета-уровень нельзя.
2. **Прототип Stack Detector** (Layer 1) — самый дешёвый и обозримый компонент. Рабочий прототип за неделю даст уверенность в направлении.
3. **Дискуссия по §13** — закрыть открытые вопросы хотя бы на уровне рабочих гипотез.
4. **Разбить этот документ** на отдельные специализированные файлы — **выполнено в Phase 1.D** (2026-05-07):
   - [architecture.md](architecture.md) (§2-3)
   - [versioning-and-locks.md](versioning-and-locks.md) (§4)
   - [failure-modes.md](failure-modes.md) (§5)
   - [acceptance-tests.md](acceptance-tests.md) (§6)
   - [core-stability.md](core-stability.md) (§7)
   - [niche-stacks.md](niche-stacks.md) (§8)
   - [migration-from-current.md](migration-from-current.md) (§9)
   - [roadmap.md](roadmap.md) (§10)
   - [risks.md](risks.md) (§11)
   - [open-questions.md](open-questions.md) (§13)

### 14.2 Что нужно обсудить с пользователем перед стартом

- Согласие на разделение монорепо (текущий пакет → `preset-next-15-canonical`)
- Согласие на naming (`meta-factory` или другое)
- Приоритеты в roadmap — где сжимать сроки, где растягивать
- Бюджет на интернет-research (стоимость токенов)
- Готовность поддерживать confidence-tier систему для нишевых стеков

### 14.3 Принцип развития документа

Этот файл — **живой**. По мере прояснения вопросов обновляется. Детальные секции вынесены в sub-документы (§14.1). История — через git log.

---

## 15. Self-application as architectural invariant

Self-application — не отдельный шаг, а cross-cutting invariant каждого слоя мета-фабрики. Без него центральный тезис «documents lie; tests don't» фальсифицирован: фреймворк поставляет enforcement-инструменты потребителю, но не применяет их к себе. Invariant действует с момента 0 — установка лишь последняя точка верификации.

| Слой | Self-application clause |
|---|---|
| **L0 Invariant Core** | Принципы прогоняются как тесты против собственного `rules-manifest.json` в pre-commit/pre-push/CI |
| **L1 Stack Detector** | Detector запускается на самом репо в CI; expected output зафиксирован snapshot-тестом |
| **L2 Research Agent** | Research прогоняется на `skills/rules-as-tests/{SKILL.md, references/overview.md, references/ai-traps.md}` (entry-point + principles + anti-patterns); operationalization — TBD Phase 6 per [open-questions.md](open-questions.md) §13.7 |
| **L3 Rule Synthesizer** | Synthesizer регенерирует canonical Next 15, diff ≤5% — детерминирован |
| **L4 Self-Validator** | Validator прогоняется на `rules-manifest.json` перед каждым CI run |
| **L5 Installer** | `install.sh` + `setup.sh` запускается в CI на tmp-dir; результат проходит own audits |
| **Spec discipline** | orchestrator-prompts валидируются как код (SHA-check, action existence) |

> **Canonical source для L2 invariant clause:** [self-application.md](self-application.md) §2 — единственный источник истины. PROPOSAL §15 — указатель на него.

См. полный rationale, decision matrix и acceptance criteria в [self-application.md](self-application.md).

---

## Приложения

### A. Глоссарий

- **Invariant core** — ядро мета-фабрики, которое не генерится и определяет принципы.
- **Generated artifacts** — всё, что собирается под конкретный стек (правила, конфиги, RULES.md).
- **Canonical example** — эталонный preset (текущий Next 15), служит образцом и regression baseline.
- **Confidence tier** — оценка зрелости стэка (high/medium/low), определяющая поведение фабрики.
- **Path A / Path B** — режимы синтеза правил: конфигурация плагинов vs. генерация AST-кода.
- **Two-AI review** — паттерн из текущего пакета: один LLM пишет, второй ревьюит вне контекста.
- **Negative test** — тест, проверяющий, что правило ловит инжектированное нарушение (защита от always-PASS).

### B. Связанные документы

- `audits/2026-05-06.md` — фреш-сессия аудит, нашедший R2 drift и regex bugs.
- `skills/rules-as-tests/SKILL.md` — текущий skill (станет частью invariant core).
- `factory/RULES.md` — текущий список правил (станет seed для generic-rules).

### C. Внешние референсы

Учтены при разработке концепции (см. предыдущее обсуждение):
- AGENTS.md spec — agents.md
- GitHub Blog: «How to write a great agents.md» (2500 repos analysis)
- InfoQ 2026: research показавший, что LLM-generated context может ухудшать success rate
- Anthropic — Complete Guide to Building Skills for Claude
- npm-agentskills (onmax) — convention `package.json.agents.skills`
- openskills — universal SKILL.md installer
- jsonschema2md (Adobe) — generation pattern
- LN-Zap rulesync — SSOT синхронизация конфигов
- dependency-cruiser `--init` — auto-detect конфигурации
- Idempotent installers (OneUptime) — паттерны state-машин
- Spec-driven development (timdeschryver) — proposal/design/tasks
