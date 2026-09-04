# stacks-react-spa-native — umbrella kickoff (U16) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U16; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** горизонт. **Тип:** build (пресеты уже на main). **Зависит от:** **U1 S3** (precondition — подтверждает наличие пробелов). **Параллельно с:** U15.

## Цель
Пресеты `react-spa` и `react-native` (уже на main) добиты по e2e-пробелам — **если** пробелы реальны.

## Scope
- **В scope:** закрыть подтверждённые e2e-пробелы обоих пресетов.
- **Вне scope:** новые стеки; **фантомные** пробелы (если U1 S3 показал, что покрытие полное — умбрелла не нужна).

## Precondition (жёсткий)
U1 S3 «4 стека»-сверка **подтверждает** наличие e2e-пробелов. Без подтверждения — это фантомная работа (не диспатчить).

## Стадии (набросок)
S0 (gate) U1 S3 подтвердил пробелы → S1 enumerate реальных пробелов по `git`/прогону → S2 закрыть e2e → S3 gate.

## Gate готовности (реальная проверка)
Оба стека **зелёные e2e** (прогон, не «тест добавлен»); пробелы, подтверждённые в precondition, закрыты.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T1** (sampling-floor — не «пара тестов прошла → стек готов»), **T14** (чистый прогон ≠ «пробелов нет» при низком покрытии). **Domain:** **T-STK-A** — «пресет на main → e2e полный» (фантомный пробел/фантомная готовность без подтверждённого прогона).

## Готово, когда
Подтверждённые e2e-пробелы обоих пресетов закрыты, прогон e2e зелёный; либо precondition показал отсутствие пробелов → умбрелла закрыта как не-нужная.

<!-- host-verify: none — planning STUB (U16 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
