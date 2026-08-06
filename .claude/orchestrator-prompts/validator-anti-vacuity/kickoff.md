# validator-anti-vacuity (G2) — umbrella kickoff `[DRAFT — NOT ON STAGING, DO NOT DISPATCH]`

> **Статус:** ДРАФТ-скелет (Phase 2 нарезки build-оси). **НЕ на `staging`, НЕ диспетчеризовать** (`kickoff-staging-placement.md §1`).
> **For:** `/pipeline validator-anti-vacuity` (будущая сессия). Single-concern G-phase умбрелла (может быть 1-stage).
> **PR base:** `staging`. Stage-gate (Phase -1 cold-review) перед мёржем.
> **Карта:** `build-execution-map.md` §1 строка G2 — **планировочная папка `rules-as-tests/` (вне репо)**; план-доки цитируются по имени (доступ — у сессии-исполнителя).

## §0 Sources of truth (read FIRST)

- **Доказательная база (ось BUILD, цитировать, не переоткрывать):** `build-plan-redteam-research.md` §A2+ (раскладка само-тестов по рубежам — табл.; дешёвый ярус = в фабрике при генерации + дубль в CI), §MVP-граница п.3 (minimal-pair + messageId + autofix-clean обязательны в эмите), §«Что менять в build-фазах» Фаза1-G2. Тактика: `generator-plan.md` Шаг 2.
- **Код, который умбрелла трогает (СВЕРИТЬ перед стартом, T16):** `packages/core/validator/gate-rule-tester.ts` (сейчас: negative-test violation + `examples.good` молчание — это **ядро minimal-pair уже есть**), `gate-tautology.ts`, `gate-conflict.ts`, `gate-schema.ts`, `internal-validators.ts`, `validate.ts` (оркестрация гейтов), `snapshot.test.ts`.
- **Что НЕ существует (grep-подтверждено 2026-06-23):** autofix-clean round-trip, messageId-coverage loop, явный single-token-diff assert. Это NET-NEW работа умбреллы.

## §1 Goal (one line)

Поднять валидатор до **анти-пустышка-фильтра**: к существующим tautology+negative+good/bad гейтам добавить **autofix-clean** (фикс правила сам проходит правило и парсится), **messageId-покрытие** (каждое объявленное сообщение реально достигается) и **явный single-token-diff** assert для minimal-pair; + **snapshot-гейт** как регресс-защита. Всё **детерминированно, ноль LLM** — делает любое сгенерированное правило самопроверяемым **до** того, как генерация станет автоматической (G3).

## §2 Stage map

Однозадачная умбрелла; стадии при необходимости:

| Stage | Deliverable | Acceptance (gate) |
|---|---|---|
| **S1 — три гейта + snapshot** | `autofix-clean` + `messageId-coverage` + `single-token-diff` assert в валидаторе; snapshot-гейт регресса. | Правило отвергается, если: autofix-результат не проходит собственное правило / не парсится; объявленный messageId недостижим; good/bad отличаются НЕ на один токен. Существующие good/bad-проверки не сломаны. Все гейты детерминированы, ноль LLM, snapshot зелёный. |

(Если объём S1 велик — разбить на S1a autofix-clean / S1b messageId / S1c single-token-diff, каждый со своим failing-test-first; stage-gate между.)

## §3 Scope fence (hard)

**IN:** autofix-clean, messageId-coverage, single-token-diff assert, snapshot-гейт — дешёвый детерминированный ярус само-тестов.
**OUT (observation only, не спавнить PR):**
- **mutation (Stryker), metamorphic-трансформы, property-fuzz (fast-check)** — это **S-mut** / только-фабрика, по `build-plan §A2+`: дорогие слои НЕ в per-commit CI. Соблазн «раз уж валидатор — добавлю mutation-гейт» = нарушение раскладки по рубежам.
- **LLM-черновик** (G4).
- **Компиляция спеки** (G3) — G2 валидирует то, что эмитится, не меняет эмиттер.
- Мета-ядро проекта (принципы 01-23) — это дисциплина проекта на себе, консьюмеру не шипится; G2 = шипимый ярус валидации правила.

## §4 AI-laziness traps (`.claude/rules/ai-laziness-traps.md §2` — MANDATORY)

Active traps: **T2, T3, T14, T15, T16**.

- **T2** (designing ≠ doing) — гейт не «спроектирован», а прогнан: на фикстуре-пустышке он краснеет по факту.
- **T3** (no prose-only findings) — «messageId недостижим отвергается» = тест с фактическим выводом.
- **T14** (clean ≠ no-theatre) — если на корпусе все правила прошли новые гейты, различить «правила крепкие» vs «гейт вакуумный»: для каждого нового гейта обязательна **paired-negative фикстура** (намеренно-плохое правило, которое гейт ДОЛЖЕН отвергнуть). Гейт без своего negative-теста сам пустышка.
- **T15** (self-application) — новые гейты сами под принципом 02 (paired valid/invalid) проекта; гейт, который не ловит свою анти-фикстуру, не мёржится.
- **T16** (pattern-match по имени) — `gate-rule-tester` УЖЕ делает good/bad violation-проверку; не «добавить minimal-pair» как новый, а сверить с кодом: ядро minimal-pair есть, NET-NEW = single-token-diff assert поверх. Не дублировать существующее.
- **Domain-specific — T-G2-A:** соблазн объявить «messageId-покрытие» через простую проверку наличия messageId в правиле, а не через **реальное достижение** каждого сообщения на фикстуре. Counter: покрытие = фикстура, на которой данный messageId действительно эмитится линтером, не статическое присутствие строки.

## §5 TDD-обязанность

**Failing test первым** на каждый гейт: написать paired-negative фикстуру (плохое правило: autofix ломает / messageId недостижим / good=bad), проверить что валидатор её **пропускает** (красный — гейта ещё нет) → добавить гейт → фикстура отвергается (зелёный).

## §6 Capability-commit discipline

Новые гейты — код под `packages/core/validator/` (вероятно ≥80 LOC → **capability-commit**). `Prior-art:` трейлер: anti-vacuity / minimal-pair / mutation-как-аудит — внешне валидированы (Semgrep/Autogrep прецедент, `build-plan §A2+` источники); сослаться на SSOT + консульт. Без новой зависимости (детерминированный TS поверх существующего RuleTester/ESLint).

## §7 `done.md` на закрытие

```text
# validator-anti-vacuity — DONE
- Final PR: #<num>
- Closed: <YYYY-MM-DD>
- Summary: <одна строка>
```

## §8 Stage-gate + staging-placement

- **Stage-gate:** Phase -1 adversarial cold-review (`reviewer-discipline.md §2`) → GO / REVISE / STOP, 1 REVISE макс. CI-green ≠ design-review (T19): ревьюер сам пишет анти-фикстуру и проверяет, что новый гейт её ловит.
- **Staging-placement:** ДРАФТ. merge kickoff в `staging` ДО `/pipeline`. Не диспетчеризовать с feature-ветки (`#dispatch-before-staging`).
