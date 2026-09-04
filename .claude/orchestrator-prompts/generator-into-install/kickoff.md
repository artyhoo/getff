# generator-into-install — umbrella kickoff (U4) — STUB

> **Status (2026-07-23 amendment):** superseded-by track-1 (ecosystem-wiring #1086 closed detect→wire→deliver→fire; any-stack W2/W3 own the agent surface + one-beat). npm-lane synth-at-install residue → track-1 js-convergence follow-on. Do not dispatch. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input) — **STUB**.
> **Authoritative for:** scope-набросок умбреллы U4; до диспатча развернуть в полный `kickoff.md` (§1–§9 per [getff-to-prod-meta-launch §D](../getff-to-prod-meta-launch/kickoff.md)).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md).
> **Base branch:** `staging`.
> **Status:** 🟡 **STUB — развернуть в полный кикофф перед диспатчем** (§D п.1).

**Волна:** 2. **Тип:** build. **Зависит от:** U2 + install-слои + **U3 догфуд (done.md)**. **Параллельно с:** U5–U8.

## Цель
Выход генератора доезжает до консьюмера — в живой конфиг попадают **сгенерированные** правила, а не только заготовленные.

## Scope
- **В scope:** при установке прогонять синтезатор под стек; вливать `eslint-rules-snippet.json` + сгенер. правило + строки манифеста в живой `eslint.config` + барель; обобщить авто-вайрер с R2 на набор.
- **Вне scope:** require/type-aware кодоген (G3b — demand-gated, §E мега-кикоффа).

## Стадии (набросок)
S1 synth-run при установке под стек → S2 влить snippet+правило+манифест в живой конфиг+барель → S3 обобщить авто-вайрер (R2 → набор) → S4 gate-доказательство.

## Gate готовности (реальная проверка)
Сгенерированное правило присутствует в живом `eslint.config` консьюмера, и по нему **реально падает** подброшенное нарушение (`npx eslint <file>` → ошибка от сгенер. правила).

## AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))
**Активные:** **T3** (падение доказывается прогоном), **T11**/**T13** (вайрер «обобщён» ≠ работает на >1 рецепте), **T16** (pattern-on-name), **T19** (своё cold-QA до handoff). **Domain:** **T-GII-A** — «synth пишет additions → значит они применяются» (их фактически никто не читает в живой конфиг).

## Готово, когда
Сгенерированное правило в живом eslint-конфиге консьюмера ловит нарушение на чистом проекте; авто-вайрер доказан на >1 рецепте.

<!-- host-verify: none — planning STUB (U4 of the getff-to-prod meta-launch): stages are a sketch, no executable deliverable yet; the full kickoff that replaces this stub declares the real contract -->
