# living-docs-layer — umbrella kickoff (U15) — STUB

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U15; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** горизонт. **Тип:** build (L). **Зависит от:** U9. **Параллельно с:** U16.

## Цель
Слой Living Documentation: доки↔код не дрейфуют (drift падает на раннем рубеже).

## Scope
- **В scope:** drift-проверки доки↔код (OpenAPI-from-Zod, ADR-as-tests).
- **Вне scope:** генерация прозы доков (это не drift-слой).

## Стадии (набросок)
S1 prior-art drift-инструментов (problem-class match) → S2 первый drift-чек (OpenAPI-from-Zod) → S3 ADR-as-tests → S4 gate.

## Gate готовности (реальная проверка)
Намеренно введённый drift доки↔код **падает** на раннем достижимом канале (не «инструмент подключён»).

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T11** (prior-art перед своим drift-движком), **T16** (pattern-on-name — drift-инструмент по имени ≠ наш problem-class). **Domain:** **T-LDL-A** — «drift-инструмент адоптирован → drift ловится» без прогона на инъецированном расхождении.

## Готово, когда
Инъецированное расхождение доки↔код ловится автоматически; prior-art-вердикт по инструменту зафиксирован.

<!-- host-verify: none — planning STUB (U15 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
