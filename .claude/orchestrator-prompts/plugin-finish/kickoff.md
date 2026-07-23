# plugin-finish — umbrella kickoff (U7) — STUB

> **Status (2026-07-23 amendment):** split — self-test + docs scope absorbed-by `beta-delivery-ux` A1 (plugin = secondary entry channel); OpenCode-adapter residue PARKED under the agnosticism roadmap. Do not dispatch as-is. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U7; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** 2. **Тип:** build. **Зависит от:** плагин-payload (на main). **Параллельно с:** U4–U6, U8.

## Цель
Плагин реально ставится и работает у консьюмера, а не «payload лежит в дереве».

## Scope
- **В scope:** скепсис-проверка payload; self-test; OpenCode-адаптер; docs + публикация в каталог.
- **Вне scope:** новые скиллы/агенты плагина (это их умбреллы).

## Стадии (набросок)
S1 скепсис payload (что заявлено vs что грузится) → S2 self-test → S3 OpenCode-адаптер → S4 docs + публикация в каталог + gate.

## Gate готовности (реальная проверка)
`claude plugin install` даёт **рабочий** плагин (команда/скилл/хук активны на чистой установке); self-test зелёный; принцип 24 проходит.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T13** (ADOPTED payload ≠ zero-work — проверить), **T15** (self-application — self-test на самом плагине), **T19** (своё cold-QA до handoff). **Domain:** **T-PLG-A** — «payload в дереве → плагин рабочий» (ровно кейс #673: файлы есть, плагин не грузится).

## Готово, когда
На чистой машине `claude plugin install` → рабочие команда/скилл/хук; self-test + принцип 24 зелёные.
