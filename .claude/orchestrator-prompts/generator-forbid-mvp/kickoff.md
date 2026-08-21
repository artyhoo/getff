# generator-forbid-mvp (G1+G2+G3 mega-umbrella) — kickoff `[DRAFT until merged to staging]`

> **Статус:** мега-умбрелла MVP-моата. Объединяет бывшие G1 (`recipe-declarative-tier`), G2 (`validator-anti-vacuity`), G3 (`generator-compile-forbid`) в одну stage-gated последовательность. Три отдельных драфт-kickoff'а superseded этим файлом.
> **For:** `/pipeline generator-forbid-mvp` → `/dispatcher generator-forbid-mvp` (аиф-control loop, автономно).
> **PR base:** `staging`. Каждая стадия = свой PR; stage-gate (Phase -1 cold-review) между стадиями; авто-мёрж в `staging` после GO.
> **Карта:** `build-execution-map.md` §1 (G1/G2/G3) + §5 MVP-срез — планировочная папка `rules-as-tests/` (вне репо); план-доки цитируются по имени.
> **Доказательная база (ось BUILD, НЕ переоткрывать — цитировать):** `build-plan-redteam-research.md` §MVP-граница, §A1, §A2+, §B1, §красный-флаг-7; `generator-plan.md` Шаги 0-3.

## §0 Зафиксированные решения (НЕ перерешать)

- **Движок декларативного яруса = СМЕННОЕ поле `engine`, выбор по форме правила (НЕ один движок, ни один не выбрасывается)** (владелец+анализ, 2026-06-23):
  - **простой forbid** (один синтаксический селектор) → **ESLint `no-restricted-syntax`** = дефолт. Ноль новых зависимостей; стек уже на ESLint (`eslint-rules/*`, валидатор `RuleTester`, `wire-eslint-r2`); самопроверка эмита в том же `RuleTester`.
  - **композитный/реляционный структурный** (`not`+`has`+`inside`, без типов) → **esquery `no-restricted-syntax`** (НЕ ast-grep). **S1b ПИЛОТ ДОКАЗАЛ** (#685, `docs/meta-factory/generator-forbid-mvp/s1b-astgrep-composite-pilot.md:278,288`): compound-selector идиома `:not(ancestor descendant)` выражает ancestor/inside-класс → для composite ast-grep **DROP**.
  - **метапеременная back-ref** (`x===x`, `c?a:a`, `f(x,x)`, `a||a`) → **ast-grep** — esquery over-flags (ловит и валидный код), ast-grep isolates через `$A===$A` (матрица DN-1; gap-rationale коммитится в S2). Подтверждение: ESLint сам шипит `no-self-compare`/`no-dupe-args`/`no-dupe-keys` рукописными — метапеременные декларативно невыразимы плоским селектором. **Многие уже = ESLint built-ins → референс через eslint-тип; ast-grep раннер+dep — defer до первого НОВОГО metavar-forbid вне built-ins (engine-шов зарезервирован, решение (i) 2026-06-23).**
  - **type-aware** → кодоген typescript-eslint = **G3b**, вне этой умбреллы.
  Схема `recipe.schema.json` несёт `engine?: "eslint-restricted" | "ast-grep"` (опционально, default `eslint-restricted`); валидатор (S3) engine-agnostic. Build-first-reuse соблюдён: ast-grep закрывает реальный gap — **метапеременные** (S1b доказал, что composite — НЕ этот gap), и берётся **по факту**, раннер/dep — только на первом НОВОМ metavar-forbid вне built-ins ((i)). **Развилку «какой движок вообще» повторно НЕ выносить — multi-engine решён; здесь скорректирован лишь per-shape КРИТЕРИЙ по пруфу S1b (#685) + матрице DN-1.** **(i) downstream:** ast-grep-engine части S3 (native rule-test) и S4 (компиляция на ast-grep) отложены ВМЕСТЕ с раннером — каждая стадия шипит eslint-restricted сначала, ast-grep-паритет приходит на первом НОВОМ metavar-forbid.
- **Класс правил MVP = только `forbid`.** require/type-aware = G3b (кодоген), вне этой умбреллы (`build-plan §B8 п.1` «невидимая стена»; красный-флаг-7).
- **Овернайт-постура:** авто-мёрж в `staging` после Phase-1 GO; технические развилки — автономно; стратегические — park для оператора (утренний разбор).

## §1 Goal (one line)

Превратить lookup-библиотеку в **настоящий генератор**: спека `forbid`-принципа **компилируется** в данные ESLint-правила + парные фикстуры, генератор — единственный писатель файла, эмит самопроверяется анти-пустышка-гейтами **до** коммита, ноль платного LLM. Это MVP-хедлайн «генератор правил-как-тестов, не библиотека fitness-функций».

## §2 Stage map (stage-gated; каждая стадия — самостоятельно зелёная)

| Stage | Бывш. | Deliverable | Depends on | Acceptance (gate) |
|---|---|---|---|---|
| **S1a — пилот ESLint forbid** | G0 | ОДИН простой `forbid`-принцип сквозь пайплайн **руками** на `no-restricted-syntax` (спека→данные→парные фикстуры→красный/зелёный), markdown-эталон. | — | bad краснеет, good зеленеет **по факту прогона** (вывод в эталоне); точки под S2-S5 зафиксированы. |
| **S1b — пилот ast-grep composite** | — (нов., `build-plan §непокрытое п.4`) | ОДИН **композитный/реляционный** forbid-принцип (`not`+`has`/`inside`, без типов — напр. «запрет X внутри Y») на ast-grep YAML; сравнить с попыткой выразить тем же `no-restricted-syntax`. | — | Доказано **на факте**: где ast-grep композитным правилом выражает то, что `no-restricted-syntax` плоским селектором не может/коряво. Вердикт: для какого класса ast-grep — движок выбора (с цифрами/примером, не «кажется»). Если оказался НЕ лучше — зафиксировать и не тащить зависимость. |
| **S2 — декларативный тип + поле engine (seam)** | G1 | `check.type:"declarative"` в `recipe.schema.json`/`types.ts` с `engine?: "eslint-restricted" \| "ast-grep"` (default `eslint-restricted`; selector, messageId, `presence:"forbid"`) + **eslint-restricted раннер+рецепт сейчас** (4 wiring-точки) + закоммиченный gap-rationale (esquery over-flags metavar, воспроизведено). **ast-grep = зарезервированное значение схемы, раннер/dep/рецепт — DEFER ((i)).** | S1a, S1b | Схема принимает declarative eslint-restricted-рецепт; `engine:"ast-grep"` — валидное значение, раннер даёт explicit deferred-marker (НЕ silent pass); 4 типа не сломаны (snapshot зелёный); **ноль новых зависимостей** (ast-grep НЕ добавляется в S2). |
| **S3 — анти-пустышка валидатор (engine-agnostic)** | G2 | autofix-clean + messageId-покрытие + single-token-diff assert; snapshot-гейт. **Engine-agnostic интерфейс:** ESLint-импл через `RuleTester`; ast-grep — через его native rule-test/snapshot. | S2 | Правило ЛЮБОГО engine отвергается на: ломающем autofix / недостижимом messageId / good=bad различаются больше conservative-минимальной дистанции (реализовано как interim `≤5` whitespace-token edits — точная минимальность калибруется на S4 на первых реальных forbid-парах; SSOT в `architecture.md §2.6` "Runtime status"). Каждый гейт со своей paired-negative фикстурой (eslint-restricted сейчас; ast-grep — deferred-marker per (i)). Детерминизм, ноль LLM. |
| **S4 — компиляция forbid** | G3 | `synthesize` **компилирует** спеку `forbid` → данные правила **на engine, выбранном по форме правила** (`eslint-restricted` для простого И композитного/реляционного — S1b доказал; `ast-grep` для metavar-back-ref — раннер deferred (i)) + парные фикстуры + провенанс-заголовок; генератор — единственный писатель. | S3 | Новый forbid = добавление **спеки-данных** (с указанием engine) БЕЗ рукописного файла-правила и БЕЗ нового шаблона в коробке; эмит проходит S3-гейты; прогон на ≥1 forbid каждого оправдавшего себя engine (вывод в PR). |
| **S5 — anti-hand-edit гейт** | G3·D7 | provenance-хэш/generated-marker + CI-проверка: ручная правка эмитнутого файла → красный. | S4 | Правка сгенерированного файла руками **механически** валит CI (прогнанный отказ, не «должно бы»). |

**Stage-gate (binding):** между КАЖДОЙ стадией — Phase -1 adversarial cold-review (read-only Agent, `reviewer-discipline.md §2`) → **GO / REVISE / STOP**, максимум **1 REVISE**. **CI-green ≠ design-review** (T19). После GO → авто-мёрж стадии в `staging`, затем следующая.

> **Реалистичный объём за ночь:** S1-S3 дешёвые/обратимые — вероятно проходимы. **S4 (компиляция) — моат, 1-2 нед** (`build-plan §красный-флаг-7`); за ночь скорее *стартует*, не закончится. S5 — после S4. Это ожидаемо; не считать незавершённый S4 провалом.

## §3 Scope fence (hard)

**IN:** ровно S1-S5 выше (forbid-ярус MVP на ESLint).
**OUT (surface as observation only, НЕ спавнить PR — `CLAUDE.md` PR strategy):**
- Кодоген require/type-aware (**G3b**), LLM-черновик (**G4**), version-guard (**G5**), install-врезка (**G6**), рост каталога сверх пилота (**G-seed**), mutation/metamorphic (**S-mut** / только-фабрика).
- **ast-grep ПОЛИГЛОТ-ярус** (non-TS/JS стеки) — OUT; но ast-grep как engine для **metavar-back-ref TS/JS forbid** — IN (раннер/dep deferred (i)); composite/relational TS/JS → esquery (S1b доказал). Это разные вещи: metavar-выразительность ≠ полиглот-расширение.
- Любое изменение `synthesize.ts` сверх forbid-компиляции; мета-ядро проекта (принципы 01-23) консьюмеру не шипится.

## §4 AI-laziness traps (`.claude/rules/ai-laziness-traps.md §2` — MANDATORY)

Active: **T2, T3, T4, T5, T14, T15, T16, T20**.

- **T2/T3** — каждое «компилирует»/«гейт ловит»/«схема принимает» = команда + вывод, не «would».
- **T4** (premature close) — adversarial «какой класс правил я молча не покрыл» (ответ: require/type-aware → осознанно G3b, зафиксировать); не объявлять «генератор готов» пока S5 не краснеет по факту.
- **T5** (no scope creep) — главный риск: «раз компилирую forbid, добавлю и require-кодоген» → G3b, OUT.
- **T14** (clean ≠ no-theatre) — каждый новый гейт S3 со своей анти-фикстурой; гейт без negative-теста сам пустышка.
- **T15** (self-application) — сгенерированное правило под принципом 02 (paired good/bad) + 03 (AST-over-grep); генератор держится своего гейта.
- **T16** (pattern-match по имени) — «declarative как no-restricted-syntax» НЕ выражает require/type-aware (`build-plan §A1`); `gate-rule-tester` УЖЕ делает good/bad — не дублировать, NET-NEW = autofix/messageId/single-token-diff.
- **T20** (inline-verdict без доказательства) — любой выбор внутри стадии backed tool-call'ом.
- **Domain-specific T-MVP-A:** замаскированный lookup под видом компиляции (S4) — «компилятор», выбирающий из готовых шаблонов. Counter: новый forbid добавляется ДАННЫМИ без строки рукописного кода/нового шаблона; иначе это ещё lookup.
- **Domain-specific T-MVP-B:** «генератор = единственный писатель» как комментарий-конвенция, а не механический гейт. Counter: S5 = реальный CI-отказ на ручной правке.

## §5 TDD-обязанность (на каждую стадию)

**Failing test первым.** S2: тест «`gate-schema` принимает declarative» красный → добавить тип → зелёный. S3: paired-negative фикстура проходит (красный, гейта нет) → добавить гейт → отвергается. S4: «forbid данными → эмит+G3-гейты зелёные» красный в lookup-режиме → компиляция → зелёный. S5: ручная правка проходит (красный) → provenance-гейт → отказ.

## §6 Capability-commit discipline

S2/S3/S4/S5 — код под `packages/core/` (≥80 LOC → capability-commit). Каждый коммит — `Prior-art:` трейлер (`CLAUDE.md` Build-vs-reuse): консульт SSOT `prior-art-evaluations.md` + DeepWiki/WebSearch ≥3 phrasings на «декларативная компиляция ESLint-правил из спеки» / «generated-file ownership gate». **ESLint-ярус — ноль новых зависимостей (уже в стеке). ast-grep — НОВАЯ зависимость → DEFER до первого НОВОГО metavar-forbid вне ESLint built-ins (gap = метапеременные; S1b доказал, что composite — НЕ gap → ast-grep DROP для composite). НЕ добавляется в S2-S4 по дефолту; `Prior-art:` трейлер на момент реального wiring ссылается на gap-rationale (build-first-reuse: ADOPT-по-факту-gap, не на веру).**

## §7 `done.md` на закрытие (схема `CLAUDE.md` Umbrella closure)

```text
# generator-forbid-mvp — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD>
- Summary: <одна строка>
```
Писать при мёрже ПОСЛЕДНЕЙ стадии (S5). Для частичного ночного прогресса — НЕ писать done.md; оставить умбреллу открытой.

## §8 Staging-placement (`kickoff-staging-placement.md §1`)

Этот kickoff — **дис패тч-вход**; читается с `staging`. До любого `/pipeline`/`/dispatcher`: **merge этого файла в `staging`** (PR, squash). Диспетчеризация при kickoff только на feature-ветке = `#dispatch-before-staging` (инцидент 2×). Промт-обёртка (`DISPATCH-PROMPT-overnight.md`) делает merge первым шагом.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
