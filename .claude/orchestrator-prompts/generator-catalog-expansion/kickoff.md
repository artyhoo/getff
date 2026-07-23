# generator-catalog-expansion — umbrella kickoff (U5) — STUB

> **Status (2026-07-23 amendment):** superseded-by the live-generation direction (universal-skill panel D2: presets rot). Re-trigger: a pre-baked seed set proves needed after the live path matures. Do not dispatch. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U5; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** 2 (∥). **Тип:** build. **Зависит от:** **U3 догфуд (done.md)**. **Параллельно с:** U4, U6–U8.

## Цель
Каталог рецептов с ~5 до набора **реальных болей стека**.

## Scope
- **В scope:** новые рецепты под частые ошибки стека; каждый с paired-негативом и messageId-coverage.
- **Вне scope:** type-aware рецепты (G3b — demand-gated).

## Стадии (набросок)
S1 enumerate реальных болей стека (источник, не выдумка) → S2 рецепт + paired-негатив на каждую → S3 messageId-coverage + анти-пустышка → S4 gate.

## Gate готовности (реальная проверка)
N рецептов, каждый с **paired-негативом** (намеренно неверное ожидание падает) + messageId-coverage, **ноль пустышек** (принцип анти-пустышки зелёный).

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T1** (sampling-floor — 3 чистых ≠ done), **T3** (срабатывание = прогон), **T4** (не закрывать каталог преждевременно). **Domain:** **T-CAT-A** — «рецепт есть → ловит» без негативного теста, доказывающего падение.

## Готово, когда
Каждый рецепт каталога имеет проходящий paired-негатив + messageId-coverage; анти-пустышка зелёная.
