# naming-family — umbrella kickoff (U11) — STUB

> **Status (2026-07-23 amendment):** absorbed-by `beta-delivery-ux` R1 — the name-freeze is R1 step 1 and its gate («имена заморожены ДО публикации») travels with it. Do not dispatch separately. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U11; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** 3. **Тип:** doc. **Зависит от:** — . **Параллельно с:** U9.

## Цель
Архитектура имён семейства `@getff/*` зафиксирована **до** необратимой публикации (U10).

## Scope
- **В scope:** N1 архитектура имён (core/preset/cli/scope).
- **Вне scope:** торговая марка — по сигналу после publish (operator-gated).

## Стадии (набросок)
S1 кандидаты + проверка доступности (npm scope, GitHub org, коллизии) → S2 архитектура имён → S3 заморозка ДО U10.

## Gate готовности (реальная проверка)
Имена заморожены (документ-решение) **ДО** старта U10; доступность scope/handle подтверждена командой (`npm view @getff/* `, проверка org), не «звучит свободно».

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T8** (не спрашивать оператора там, где ответ выводится; ТМ — единственная operator-развилка), **T15** (self-application). **Domain:** **T-NAM-A** — «имя выбрано по вкусу» без проверки доступности/коллизий (npm/GitHub/реестр).

## Готово, когда
Документ-решение с замороженной архитектурой имён + подтверждённой доступностью scope, до старта U10.

<!-- host-verify: none — planning STUB (U11 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
