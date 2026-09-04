# repo-split-3-storefronts — umbrella kickoff (U9) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U9; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1). **НЕОБРАТИМОЕ — последним в Волне 3.**

**Волна:** 3. **Тип:** build (XL). **Зависит от:** U6. **Параллельно с:** U11.

## Цель
Репо разрезано на 3 независимые витрины (core / preset-kit / @getff) с рабочими changesets и замороженной поверхностью.

## Scope
- **В scope:** R0 границы; Changesets (`fixed` core+preset) + развилка npm vs pnpm; вынести `principle-kit`; скоуп `@rules-as-tests-aif/*`→`@getff/*` + снять `private`; **R3 маркировка поверхности — НЕОБРАТИМО, в конце**.
- **Вне scope:** сама публикация в npm (это U10).

## Стадии (набросок)
R0 границы → changesets + npm/pnpm развилка → вынос `principle-kit` → рескоуп `@getff/*` + снять `private` → **R3 маркировка (последней, необратимо)**.

## Gate готовности (реальная проверка)
3 витрины собираются/тестируются **независимо** + инвариант-гейт: `make self-audit` зелёный, принципы **17** и **21** проходят после разреза.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T11** (prior-art перед своим решением changesets), **T17** (preserve before destructive — разрез необратим), **T5** (research отдельно от разреза), **T15** (self-application). **Domain:** **T-RSP-A** — «развилка npm/pnpm решена кодом» (на деле открыта — не считать закрытой без выбранного и проверенного инструмента).

## Готово, когда
Каждая из 3 витрин независимо `build`+`test` зелёная; `make self-audit` + принципы 17/21 зелёные после разреза; R3-маркировка выполнена последней.

<!-- host-verify: none — planning STUB (U9 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
