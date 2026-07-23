# honest-readme-demo — umbrella kickoff (U8) — STUB

> **Status (2026-07-23 amendment):** superseded-by `beta-docs-showcase` (umbrella B) — honest-claims scope travels there under the F5 formulas. Do not dispatch. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U8; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1). **Не опционально перед U12.**

**Волна:** 2. **Тип:** doc/build. **Зависит от:** — . **Параллельно с:** U4–U7.

## Цель
Публичная поверхность README честна: ни одного overclaim, лицензия = FSL, демо показывает реальный блок нарушения.

## Scope
- **В scope:** бейдж/секция License → **FSL** (на устаревших ветках ещё «Proprietary» — блокирует adoption); «one-click»→«guided»; mutation-overclaim точечно — «incremental on PR» правда (шипнутый `packages/preset-*/templates/github-actions-ci-ui.yml` несёт реальный `mutation:` джоб, gated `if: github.event_name == 'pull_request'`), «full sweep nightly» **не** подтверждена (нет `cron`/`schedule:`) → убрать или завести scheduled; человеческий README; демо-GIF.
- **Вне scope:** маркетинговые лендинги/промо (это U12).

## Стадии (набросок)
S1 overclaim-sweep (каждое утверждение → backing) → S2 License→FSL + «guided» + mutation-claim правка → S3 человеческий README → S4 демо-GIF + gate.

## Gate готовности (реальная проверка)
Каждое утверждение README имеет backing (`file:line`/команда); overclaim-sweep проходит; бейдж = FSL (`grep -c Proprietary` → 0); GIF показывает **блок нарушения**.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T3** (каждое утверждение = `file:line`/команда, не проза), **T6** (не самоотчётный «honest»), **T14** (чистый sweep ≠ «честно» при низком покрытии), **T15** (self-application). **Domain:** **T-HRD-A** — «утверждение конкретное → значит подтверждённое» (specific-sounding ≠ backed; проверить каждое).

## Готово, когда
Overclaim-sweep зелёный, бейдж=FSL, ноль «Proprietary», демо-GIF демонстрирует реальный блок нарушения.
