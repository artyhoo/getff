# recipe-declarative-tier (G1) — umbrella kickoff `[DRAFT — NOT ON STAGING, DO NOT DISPATCH]`

> **Статус:** ДРАФТ-скелет (Phase 2 нарезки build-оси). **НЕ на `staging`, НЕ диспетчеризовать** (`kickoff-staging-placement.md §1`: kickoff → merge в `staging` ДО любого `/pipeline`). Содержание под доводку владельцем перед стартом.
> **For:** `/pipeline recipe-declarative-tier` (будущая сессия). Multi-stage G-phase умбрелла (включает свёрнутый пилот = бывший G0).
> **PR base:** `staging`. Каждая стадия = свой PR; stage-gate (Phase -1 cold-review) между стадиями.
> **Карта:** `build-execution-map.md` §1 строка G1 — **планировочная папка `rules-as-tests/` (вне репо)**; ссылки на план-доки даны по имени, не relative-link (доступ к план. папке — у сессии-исполнителя).

## §0 Sources of truth (read FIRST)

- **Доказательная база (ось BUILD, НЕ переоткрывать выводы — цитировать):** `build-plan-redteam-research.md` §MVP-граница п.1 (`check.type:"declarative"`), §A1 (декл-ярус vs кодоген, имплементационная глубина), §B1 (lookup недостаточен → нужна компиляция). Тактика: `generator-plan.md` Шаг 0 (пилот) + Шаг 1 (декларативный ярус).
- **Код, который умбрелла трогает:** `packages/core/synthesizer/recipe.schema.json` (сейчас `check.type` = `eslint|command|script|manual`), `packages/core/synthesizer/recipes/*.json` (существующие lookup-рецепты — образец формы), `packages/core/validator/gate-schema.ts` (валидация рецепта по схеме).
- **Образец рецепта (lookup, сейчас):** `recipes/next-r12-no-server-imports-in-client.json` — `check.type:"eslint"` указывает на **рукописное** правило. Декларативный ярус = пятый тип, где правило живёт **данными** (selector+messageId), не файлом.

## §1 Goal (one line)

Добавить в схему рецепта **декларативный** `check.type` (правило-как-данные: ESLint `no-restricted-syntax` selector + messageId + `presence:"forbid"`), доказав его сначала ручным end-to-end пилотом на одном реальном `forbid`-принципе. Самый дешёвый, **полностью обратимый** шаг (меняется только схема + один тестовый рецепт); кодоген и замена lookup НЕ трогаются.

## §2 Stage map (stage-gated)

| Stage | Deliverable | Depends on | Acceptance (gate) |
|---|---|---|---|
| **S0 — пилот** (ex-G0, doc-output, no schema change) | Прогнать ОДИН реальный `forbid`-принцип (рекомендация: «запрет server-импорта в client» / «запрет `.parse()` на границе доверия») сквозь весь пайплайн **руками**: спека-принцип → правило-как-данные (`no-restricted-syntax` selector) → парные фикстуры (good/bad на один токен) → зелёный/красный. Markdown-эталон под `docs/` или research-patch. | — | Эталон существует; на нём bad-фикстура краснеет, good-фикстура зеленеет **по факту прогона** (вывод команды в эталоне, не «would»); зафиксированы точки, под которые строятся G2/G3. |
| **S1 — декларативный тип в схеме** | Добавить `check.type:"declarative"` в `recipe.schema.json` (`engine:"eslint-restricted"`, `selector`, `messageId`, `presence:"forbid"`) + один тестовый `declarative`-рецепт. Решить движок декл-яруса (§5 развилка). | S0 | Схема принимает `declarative`-рецепт; тестовый forbid-рецепт валиден через `gate-schema`; существующие 4 типа НЕ сломаны (snapshot зелёный); полностью обратимо. |

**Stage-gate между S0 и S1:** Phase -1 adversarial cold-review (read-only Agent, `reviewer-discipline.md §2`) → **GO / REVISE / STOP**, максимум **1 REVISE**. **CI-green ≠ design-review** (T19): ревьюер сам прогоняет дифф, не доверяет зелёному CI.

## §3 Scope fence (hard)

**IN:** ровно S0 (ручной пилот-эталон) + S1 (`declarative` в схему + 1 рецепт + движок-развилка).
**OUT (surface as observation only, `CLAUDE.md` PR strategy — не спавнить PR автономно):**
- Компиляция спеки → данные (это **G3** `generator-compile-forbid`).
- Кодоген require/type-aware (**G3b**).
- Анти-пустышка-гейты minimal-pair/autofix-clean/messageId (**G2** `validator-anti-vacuity`).
- Любое изменение `synthesize.ts` lookup-логики.
- ast-grep как движок (если развилка §5 решена в пользу ESLint — ast-grep отдельный пост-MVP ярус).

## §4 AI-laziness traps (`.claude/rules/ai-laziness-traps.md §2` — MANDATORY)

Active traps для этой умбреллы: **T2, T3, T5, T11, T15, T16**.

- **T2** (designing ≠ doing) — S0 это **прогон руками**, не «методология бы поймала»: эталон содержит фактический вывод красного/зелёного, не описание намерения.
- **T3** (no prose-only findings) — каждое «схема принимает рецепт» / «snapshot зелёный» = команда + вывод.
- **T5** (no scope creep) — соблазн «раз уж в схеме, добавлю и компиляцию» → это G3, OUT.
- **T11** (prior-art перед механизмом) — движок декл-яруса (§5) выбирается с цитатой `build-plan §A1`, не из training-data.
- **T15** (self-application) — тестовый декларативный рецепт сам проходит дисциплину проекта (paired good/bad, doc-authority header на эталоне).
- **T16** (pattern-match по имени) — «declarative как no-restricted-syntax» НЕ значит «выразит любой принцип»: проверить, что выбранный пилот-принцип реально `forbid`-класса (синтаксический дискриминатор), а не скрытый require/type-aware (тогда он для G3b, не сюда).
- **Domain-specific — T-G1-A:** соблазн взять «лёгкий» принцип, который ESLint `no-restricted-syntax` выражает тривиально, и выдать за доказательство яруса, тогда как реальный болевой forbid сложнее. Counter: пилот-принцип берётся из MVP-списка реальных болей (`build-plan §MVP п.5`), не самый удобный для демо.

## §5 Развилка к решению (genuine fork — НЕ решать молча)

**Движок декларативного яруса (S1):** generic-ESLint `no-restricted-syntax` (ноль новых зависимостей, прямо на стеке) **vs** ast-grep (отдельный быстрый движок, полиглот-задел, новая зависимость). Рекомендация плана — начать с ESLint, ast-grep позже как полиглот-ярус (`generator-plan.md §развилка`, план. папка). **На старте умбреллы вынести через `AskUserQuestion`, если не зафиксировано владельцем заранее.**

## §6 TDD-обязанность

**Failing test первым** на S1: написать тест, что `gate-schema` принимает `declarative`-рецепт (красный — типа ещё нет в схеме) → затем добавить тип в схему → зелёный. Snapshot-тест на «4 существующих типа не сломаны» — до изменения схемы.

## §7 Capability-commit discipline

S1 трогает `recipe.schema.json` + 1 рецепт + (возможно) новую зависимость, если развилка §5 = ast-grep. Если добавляется зависимость → **capability-commit**, нужен `Prior-art:` трейлер (`CLAUDE.md` Build-vs-reuse): сослаться на `build-plan §A1` + SSOT-консульт. Если ESLint-вариант (ноль зависимостей) и diff < порога — не capability-commit (escape-hatch трейлер с обоснованием).

## §8 `done.md` на закрытие умбреллы

При мёрже последней стадии — записать `.claude/orchestrator-prompts/recipe-declarative-tier/done.md` по схеме `CLAUDE.md` Umbrella closure:
```text
# recipe-declarative-tier — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD>
- Summary: <одна строка>
```

## §9 Staging-placement note

Этот kickoff — **ДРАФТ**. Перед любым `/pipeline recipe-declarative-tier`: автор доводит содержание → merge kickoff в `staging` (PR, squash) → **только потом** dispatch. Диспетчеризация при kickoff только на feature-ветке = нарушение `kickoff-staging-placement.md §5` (`#dispatch-before-staging`).

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
