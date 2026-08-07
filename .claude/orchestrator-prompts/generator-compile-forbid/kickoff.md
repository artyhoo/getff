# generator-compile-forbid (G3) — umbrella kickoff `[DRAFT — NOT ON STAGING, DO NOT DISPATCH]`

> **Статус:** ДРАФТ-скелет (Phase 2 нарезки build-оси). **НЕ на `staging`, НЕ диспетчеризовать** (`kickoff-staging-placement.md §1`).
> **For:** `/pipeline generator-compile-forbid` (будущая сессия). Multi-stage G-phase умбрелла — **MVP-моат-хедлайн**.
> **PR base:** `staging`. Каждая стадия = свой PR; stage-gate (Phase -1 cold-review) между стадиями.
> **Карта:** `build-execution-map.md` §1 строка G3 + §5 MVP-срез — **планировочная папка `rules-as-tests/` (вне репо)**; план-доки цитируются по имени (доступ — у сессии-исполнителя).

## §0 Sources of truth (read FIRST)

- **Доказательная база (ось BUILD, цитировать, НЕ переоткрывать):** `build-plan-redteam-research.md` §MVP-граница («критерий настоящий генератор, не lookup»), §«Что менять в build-фазах» Фаза1 (G1→G3 сжать на forbid-классе; кодоген → G3b), §B1 (lookup недостаточен; риск вечной стройки WEAK), §красный-флаг-7 (G3 «1-2 нед» только для декларативного forbid). Тактика: `generator-plan.md` Шаг 3. ROADMAP §Выверенные правки build-оси (G3/G3b split).
- **Код, который умбрелла трогает (СВЕРИТЬ, T16):** `packages/core/synthesizer/synthesize.ts` (сейчас **чистый lookup** курируемых рецептов → рукописные правила — это то, что G3 заменяет), `emit.ts`, `recipe.schema.json` (`declarative`-тип из G1), `packages/core/validator/` (G2-гейты, которыми эмит самопроверяется), `eslint-rules/*.ts` (существующие **рукописные** forbid — кандидаты на переезд в данные).
- **Предпосылки:** G1 (`declarative` тип в схеме) и G2 (анти-пустышка-гейты) ДОЛЖНЫ быть смёржены — G3 на них стоит.

## §1 Goal (one line)

Заменить lookup на **КОМПИЛЯЦИЮ**: `synthesize` перестаёт «искать в коробке» и **компилирует спеку-принцип `forbid`-класса → данные `no-restricted-syntax` + парные фикстуры**, где **генератор — единственный писатель файла**. Здесь проект перестаёт быть «ещё одной библиотекой fitness-функций» и становится **генератором**. Кодоген require/type-aware (G3b), LLM (G4), version-guard (G5), install-врезка (G6) — **вне scope**.

## §2 Stage map (stage-gated)

| Stage | Deliverable | Depends on | Acceptance (gate) |
|---|---|---|---|
| **S1 — компиляция forbid → данные** | `synthesize` для `forbid`-принципа эмитит данные правила (`no-restricted-syntax` config) + парные фикстуры (good/bad на один токен) + провенанс-заголовок (модель/источник/дата/версии toolchain). | G1, G2 | Новый forbid-принцип = добавление **спеки-данных** (selector+message+фикстуры) БЕЗ рукописного файла-правила; генератор сам эмитит правило+тест+конфиг+провенанс; эмит проходит G2-гейты до коммита. Прогон на ≥1 реальном forbid (вывод в PR). |
| **S2 — anti-hand-edit гейт** (D7, load-bearing) | Механизм «генератор = единственный писатель»: provenance-хэш / generated-marker в эмитнутом файле + CI-проверка, что ручная правка → красный. | S1 | Правка сгенерированного файла руками **механически** валит CI (тест с фактическим красным на изменённом файле). Не «должно бы», а прогнанный отказ. |

**Stage-gate между S1 и S2:** Phase -1 adversarial cold-review (`reviewer-discipline.md §2`) → **GO / REVISE / STOP**, 1 REVISE макс. **CI-green ≠ design-review** (T19): ревьюер сам добавляет forbid-принцип данными и проверяет, что файл-правило НЕ написан руками.

## §3 Scope fence (hard)

**IN:** компиляция `forbid`-класса → данные + парные фикстуры + провенанс + anti-hand-edit гейт.
**OUT (observation only, не спавнить PR):**
- **Кодоген typescript-eslint для require/type-aware** — это **G3b** (мета-кусок, отдельная декомпозиция; `build-plan §B8 п.1` «невидимая стена»). Соблазн «раз компилирую, добавлю и require» = риск вечной стройки, прямой красный-флаг-7.
- **LLM-черновик** (G4), **version-guard** (G5), **install-врезка** (G6), **рост каталога** сверх пилотных принципов (G-seed).
- ast-grep полиглот-ярус.

## §4 AI-laziness traps (`.claude/rules/ai-laziness-traps.md §2` — MANDATORY)

Active traps: **T2, T3, T4, T5, T15, T16**.

- **T2** (designing ≠ doing) — «генератор компилирует» доказывается прогоном (эмитнутое правило + его фикстуры + зелёный G2), не описанием архитектуры.
- **T3** (no prose-only findings) — каждое «эмит проходит гейт» = команда + вывод; провенанс-заголовок показан на реальном артефакте.
- **T4** (premature close) — MVP-критерий = forbid компилируется; не закрывать, объявив «генератор готов», пока anti-hand-edit гейт (S2) не краснеет по факту. Adversarial «какой класс правил я молча НЕ покрыл» (ответ: require/type-aware — и это осознанно G3b, зафиксировать).
- **T5** (no scope creep) — соблазн «заодно кодоген require» → G3b, OUT. Самый вероятный дрейф этой умбреллы.
- **T15** (self-application) — сгенерированное правило само под принципом 02 (paired good/bad) + AST-over-grep (принцип 03); генератор держится своего же гейта.
- **T16** (pattern-match по имени) — «компиляция» НЕ значит «покрыли все правила»: `no-restricted-syntax` структурно НЕ выражает require/type-aware (`build-plan §A1`, ~3/6 правил репо). Проверить, что каждый компилируемый принцип реально forbid-класса; require — мимо, в G3b.
- **Domain-specific — T-G3-A:** соблазн оставить замаскированный lookup под видом компиляции — «компилятор», который на деле выбирает из готовых шаблонов. Counter: проверять, что **новый forbid-принцип добавляется ДАННЫМИ (spec) без единой строки рукописного файла-правила и без нового шаблона в коробке**; если для нового принципа пришлось трогать код-эмиттер/добавлять шаблон — это ещё lookup, не компиляция.
- **Domain-specific — T-G3-B:** соблазн принять «генератор — единственный писатель» как комментарий-конвенцию, а не механический гейт. Counter: S2 = реальный CI-отказ на ручной правке (provenance-хэш), не строчка в README.

## §5 TDD-обязанность

**Failing test первым:** (S1) тест «добавить forbid-принцип данными → генератор эмитит правило+фикстуры, G2 зелёный» — красный, пока synthesize в lookup-режиме → реализовать компиляцию → зелёный. (S2) тест «руками изменить эмитнутый файл → CI красный» — сначала красный (гейта нет, правка проходит) → добавить provenance-хэш-гейт → отказ.

## §6 Capability-commit discipline

S1/S2 — новый код под `packages/core/synthesizer/` (≥80 LOC → **capability-commit**). `Prior-art:` трейлер на каждый: компиляция-вместо-lookup / generated-file-ownership — консульт SSOT `prior-art-evaluations.md` + DeepWiki/WebSearch ≥3 phrasings (`build-first-reuse-default.md §3`) на «декларативная компиляция ESLint-правил из спеки». Цитировать `build-plan §A1/§B1`.

## §7 `done.md` на закрытие

```text
# generator-compile-forbid — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD>
- Summary: <одна строка>
```

## §8 Оценка перед стартом (red-flag-7 / ROADMAP риск-2)

**ДО старта S1** — количественная оценка инж-недель (B1 «строить vs lookup достаточно»). Floor «1-2 нед» валиден ТОЛЬКО для forbid-яруса; при любом сползании в кодоген оценка взрывается (`build-plan §B8 п.1`). Если оценка > порога владельца — surface, не стартовать молча.

## §9 Staging-placement note

ДРАФТ. merge kickoff в `staging` ДО `/pipeline generator-compile-forbid`. Не диспетчеризовать с feature-ветки (`#dispatch-before-staging`). G1+G2 должны быть закрыты (`done.md`) до старта G3.
