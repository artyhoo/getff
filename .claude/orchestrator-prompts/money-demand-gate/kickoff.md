# money-demand-gate — umbrella kickoff (U13) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U13; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1). **⏸ ПО СИГНАЛУ — operator-gated, НЕ авто-диспатч.**

**Волна:** signal. **Тип:** operator. **Зависит от:** traction. **Параллельно с:** — .

## Цель
Проверить наличие **спроса на деньги** как сигнала (не источника дохода): платит ли кто-то за тонкую платную фичу.

## Scope
- **В scope:** граница open-core; ≥5–10 buyer-интервью; тонкая платная фича как сигнал; критерий kill/pivot.
- **Вне scope:** масштабирование монетизации/SaaS (нет доказанного пути).

## Риск-вердикт (нести в полный kickoff)
Доказанного пути к **прямым** деньгам у локального линтера без SaaS нет (ESLint на донатах; VoidZero→acquihire). Платная фича = сигнал «за это платят» (3–5 команд); профит через **exit**, не лицензии.

## Дисциплина диспатча
**Operator-gated.** НЕ диспатчить автономно — поднимать через `AskUserQuestion` (per [recommendation-laziness-discipline.md §3](../../rules/recommendation-laziness-discipline.md)); дорогое/необратимое — только под подтверждённый спрос.

## Gate готовности (реальная проверка)
≥3–5 команд платят/подтверждают готовность платить за платную фичу (зафиксированные интервью/оплаты), либо явный kill/pivot по критерию.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T8** (не перекладывать на оператора то, что выводимо; но саму money-развилку — park), **T15** (self-application). **Domain:** **T-MON-A** — «платная фича = доход» (она **сигнал**, не доход; не путать).

## Готово, когда
Зафиксирован сигнал спроса (платящие команды) ИЛИ kill/pivot-решение оператора по критерию.

<!-- host-verify: none — planning STUB (U13 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
