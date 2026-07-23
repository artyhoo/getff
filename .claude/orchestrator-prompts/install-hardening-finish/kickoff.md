# install-hardening-finish — umbrella kickoff (U6) — STUB

> **Status (2026-07-23 amendment):** split — `--only/--skip` layer-selection scope absorbed-by `beta-delivery-ux` A1; rollback + test-matrix residue PARKED (re-trigger: phase-1 self-testing install failures). Do not dispatch as-is. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U6; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** 2. **Тип:** build. **Зависит от:** install-слои. **Параллельно с:** U4, U5, U7, U8.

## Цель
Установщик надёжен: слои ставятся/откатываются независимо, есть выбор слоёв, тесты покрывают сбой-сценарии.

## Scope
- **В scope:** per-layer rollback (`trap ERR` + LIFO); `--only/--skip <layer>`; тесты идемпотентности / dry-run / shellcheck / OS-матрицы / e2e.
- **Вне scope:** новые слои установки (это install-слои/U3).

## Стадии (набросок)
S1 rollback per-layer (trap+LIFO) + сбой-фикстура → S2 `--only/--skip` → S3 тест-матрица (идемпотентность, dry-run, shellcheck, OS) → S4 gate.

## Gate готовности (реальная проверка)
Слой ставится и **откатывается независимо** на инъецированном сбое (не «rollback написан»); тесты зелёные на npm+pnpm, Node 20+22.

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T3** (откат доказывается прогоном сбой-сценария), **T5** (research отдельно от фикса), **T19** (своё cold-QA до handoff). **Domain:** **T-IHF-A** — «rollback написан → откатывает» без инъецированного сценария сбоя, на котором он реально срабатывает.

## Готово, когда
Инъецированный сбой слоя откатывается чисто (LIFO), `--only/--skip` работают, тест-матрица зелёная npm+pnpm × Node 20+22.
