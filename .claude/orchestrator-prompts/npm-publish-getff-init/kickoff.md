# npm-publish-getff-init — umbrella kickoff (U10) — STUB

> **Status (2026-07-23 amendment):** re-gated — depends on `beta-delivery-ux` R1 + release-frame phase-1 exit (supersedes the former U9+U11+U8 edges; hybrid-lite single-package publish per plan-v2 F1). Publish stays an operator act, 🔒 irreversible. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U10; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1). **🔒 НЕОБРАТИМО — точка невозврата.**

**Волна:** 3. **Тип:** build (🔒 необратимо). **Зависит от:** U9, U11, U8. **Параллельно с:** — .

## Цель
`@getff/*` опубликован, `npx getff init` ставит первое падающее правило на свежей машине.

## Scope
- **В scope:** publish `@getff/*`; бин `getff` + команда `init`; 3–5 витринных рецептов.
- **Вне scope:** имя-семейство (U11 — **заморожено ДО** публикации); промо (U12).

## Стадии (набросок)
S1 подтвердить заморозку имён (U11) + поверхности (U9 R3) → S2 publish `@getff/*` → S3 бин `getff init` → S4 прогон `npx getff init` на свежей машине → gate.

## Gate готовности (реальная проверка)
На **свежей машине** `npx getff init` → ставит правило, по которому **падает первое нарушение** (не «опубликовано → значит ставится»).

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T3** (чистая установка = прогон на свежей машине), **T15** (self-application), **T17** (preserve before destructive — publish необратим), **T19** (своё cold-QA до handoff). **Domain:** **T-NPI-A** — «опубликовано → ставится чисто» без прогона на свежей машине.

## Готово, когда
`npx getff init` на свежей машине → первое подброшенное нарушение падает; имена (U11) и поверхность (U9 R3) заморожены ДО publish.
