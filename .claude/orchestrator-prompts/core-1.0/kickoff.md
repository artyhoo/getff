# core-1.0 — umbrella kickoff (U17) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U17; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** горизонт. **Тип:** release. **Зависит от:** U9 (R3 — фиксация публичной поверхности). **Параллельно с:** — .

## Цель
`core` достигает 1.0 после **фактической** фиксации публичного API (semver-обязательства).

## Scope
- **В scope:** заморозка публичного API; semver-1.0 релиз core.
- **Вне scope:** новые фичи core (1.0 = стабилизация, не расширение).

## Стадии (набросок)
S1 enumerate фактически используемой публичной поверхности (потребители/витрины) → S2 заморозка API + deprecation-политика → S3 1.0 релиз.

## Gate готовности (реальная проверка)
Публичный API заморожен **по факту использования** (перечень потребителей), не по объявлению; semver-1.0 опубликован после U9 R3.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T15** (self-application — core 1.0 проверяется своими же принцип-тестами). **Domain:** **T-CORE-A** — «API заморожен по объявлению» вместо заморозки по фактическому использованию потребителями.

## Готово, когда
Публичная поверхность core заморожена на основе перечня реальных потребителей; 1.0 выпущен после U9 R3.

<!-- host-verify: none — planning STUB (U17 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
