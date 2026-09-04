# exit-prep-and-deal — umbrella kickoff (U14) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U14; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1). **⏸ ПО СИГНАЛУ — operator-gated, НЕ авто-диспатч.**

**Волна:** signal. **Тип:** operator. **Зависит от:** traction. **Параллельно с:** — .

## Цель
Подготовка к сделке: data room, снижение bus-factor, структура и контрагенты — только под подтверждённый спрос.

## Scope
- **В scope:** data room (лицензия + SBOM есть); bus-factor вниз; иностранная структура; банкинг; юристы; покупатели; upfront vs earn-out; закрытие.
- **Вне scope:** генерация спроса (U12/U13).

## Дисциплина диспатча
**Operator-gated.** НЕ диспатчить автономно — поднимать через `AskUserQuestion`; дорогое/необратимое (структура, юр.) — только под подтверждённый спрос (per [recommendation-laziness-discipline.md §3](../../rules/recommendation-laziness-discipline.md)).

## Gate готовности (реальная проверка)
Data room собран И **прошёл due-diligence** контрагента (не «папки разложены»); структура/банкинг операциональны.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T15** (self-application — проверить data room его же скепсисом). **Domain:** **T-EXIT-A** — «data room собран → сделка готова» без реального прогона due-diligence покупателем.

## Готово, когда
Data room прошёл внешнюю due-diligence; структура и банкинг операциональны под конкретную сделку.

<!-- host-verify: none — planning STUB (U14 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
