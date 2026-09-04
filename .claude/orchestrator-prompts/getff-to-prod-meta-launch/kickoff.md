# МЕГАКИКОФФ — `getff-to-prod` (meta-launch)

> **Type:** umbrella-of-umbrellas (программа). Назначение — упорядоченно завести в проект все кикоффы до полного доведения getff.ai до прода. Сам не строит — порождает и упорядочивает дочерние умбреллы.
> **Class:** operational meta-kickoff (dispatch input).
> **Authoritative for:** программу довода getff.ai до прода — состав умбрелл, очередность, gate-зависимости, дисциплину диспатча. Источник правды по объёму работ — operator notes `ПЛАН-ПОЛНЫЙ-getff-2026-06-26.md` (вне репо).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Внутренний scope каждой умбреллы — её собственный `kickoff.md`.
> **Base branch:** `staging` (НЕ `main` — main = прод, промоут вручную).
> **Status:** размещён на staging. Полностью развёрнут только U2 (HARD BLOCKER, соседняя папка); U1 и U3–U17 — стабы, развернуть в полный `kickoff.md` перед диспатчем каждой.


> **AMENDMENT (2026-07-23, beta-program absorption — separate handoff commit, maintainer sign-off requested in PR):**
> the beta program ([spec](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md) §2 D1)
> absorbs/supersedes the program tail and dispositions the dormant install umbrellas.
> Binding dispositions: U3 → absorbed-by `beta-delivery-ux` A1 (T17/T18 residue sweep of
> `mif-s3-integ` first); U4 → superseded-by track-1 (ecosystem-wiring #1086 + any-stack
> W2/W3; npm-lane synth-at-install residue → track-1 js-convergence follow-on); U5 →
> superseded-by the live-generation direction (re-trigger: pre-baked seed set proves
> needed after the live path matures); U6 → `--only/--skip` scope absorbed-by
> `beta-delivery-ux` A1, rollback+test-matrix residue parked (re-trigger: phase-1
> install failures); U7 → self-test+docs scope absorbed-by `beta-delivery-ux` A1,
> OpenCode-adapter residue parked (agnosticism roadmap); U8 → superseded-by
> `beta-docs-showcase` (umbrella B); U9 → post-announce, NO LONGER gates U10; U10 →
> re-gated on `beta-delivery-ux` R1 + release-frame phase-1 exit (publish stays an
> operator act, 🔒 irreversible); U11 → absorbed-by `beta-delivery-ux` R1 (its
> name-freeze gate travels with it); U12 → superseded-by release-frame phase 3.

---

# ЧАСТЬ 1 — Программа и очередность

## §0 Что УЖЕ на main — НЕ спавнить умбреллы под это

Сверено с `git origin/main` (2026-06-26):

- ✅ Лицензия **FSL-1.1-ALv2** применена (LICENSE + бейдж + тело README).
- ✅ Генератор forbid-MVP (декларативный ярус + анти-пустышка + forbid-компиляция + provenance + live-LLM путь).
- ✅ Модуляризация install в `setup.d/` слои (byte-identical, 4 стека).
- ✅ Плагин наполнен (агенты/команда/hooks.json/скиллы/мост).
- ✅ Принцип-тесты слотов 01–26 (28 файлов; слоты 20/21 раздвоены), 4 стека на main — 3 preset-пакета (react-next, react-spa, react-native) + ts-server из shared `templates/` (не preset-пакет), агностичность (тест 21).

## §1 Принцип очередности

1. **Сначала правда, потом стройка.** Доки врут о статусе — пока не сверены, любая сессия строит на ложной премиссе. Дёшево, первым.
2. **Сначала разблокировать, потом ускорять.** «Заноза» (правило не падает у консьюмера на Node 22) обнуляет тезис продукта. Раньше любых улучшений генератора.
3. **Сначала доказать продукт, потом продуктизировать.** Догфуд — раньше разреза репо и публикации. Необратимое — только после доказанного продукта.
4. **Рыночное и дорогое — по сигналу.** Деньги и структура под сделку не диспатчатся автоматически — operator-gated развилки ([recommendation-laziness-discipline.md §3](../../rules/recommendation-laziness-discipline.md)).

## §2 Волны (граф зависимостей)

```text
Волна 0 — Правда + разблокировка        [старт, параллельно]
  ├─ U1 plan-currency-reconcile         (доки↔main; no-build)
  └─ U2 enforcement-liveness-fix         (🔴 HARD BLOCKER графа: .ts→JS+.d.ts (вариант A) + REDUCED-видимость + layout-honesty + Node22 в CI)

Волна 1 — Пересечь черту догфуда
  └─ U3 modular-install-fullpack         (В РАБОТЕ; S5 Timeliner = gate догфуда)   ← зависит от U2

Волна 2 — Довести моат до юзера + продуктовую поверхность
  ├─ U4 generator-into-install           (G6: synth→eslint консьюмера)   ← зависит от U2 + U3 догфуд-сигнал (done.md)
  ├─ U5 generator-catalog-expansion      (∥, низкий риск)                 ← gated by U3 догфуд-сигнал
  ├─ U6 install-hardening-finish         (rollback, --only/--skip, тест-матрица) → split: selection absorbed-by beta-delivery-ux A1; rest parked (2026-07-23)
  ├─ U7 plugin-finish                    (self-test, OpenCode, docs, publish-в-каталог) → split: self-test+docs absorbed-by beta-delivery-ux A1; OpenCode parked (2026-07-23)
  └─ U8 honest-readme-demo               (честный нарратив + лицензия→FSL + закрыть mutation-overclaim + README/GIF) → superseded-by beta-docs-showcase (2026-07-23)

Волна 3 — Продуктизация для рынка (НЕОБРАТИМОЕ — после доказанного продукта)
  ├─ U9 repo-split-3-storefronts         (границы→changesets→principle-kit→@getff→маркировка R3 последней) → post-announce; no longer gates U10 (2026-07-23)
  ├─ U10 npm-publish-getff-init          (publish @getff + npx getff init)        ← зависит от beta-delivery-ux R1 + release-frame phase-1 exit (2026-07-23 amendment supersedes the U9/U11/U8 edges) 🔒НЕОБРАТИМО
  └─ U11 naming-family                   (архитектура имён; ТМ — по сигналу) → absorbed-by beta-delivery-ux R1 (2026-07-23)

Волна 4 — Запуск + traction
  └─ U12 public-launch                   (Show HN/Habr/сообщества + НАСТОЯЩие метрики)  ← superseded-by release-frame phase 3 (2026-07-23; было: U8, U10, догфуд)

По сигналу (operator-gated, НЕ авто-диспатч)
  ├─ U13 money-demand-gate
  └─ U14 exit-prep-and-deal

Горизонт
  ├─ U15 living-docs-layer
  ├─ U16 stacks-react-spa-native         (пресеты на main; добить e2e-пробелы)
  └─ U17 core-1.0                         (после фиксации публичного API → после U9 R3)
```

🔴 **ЖЁСТКИЙ ГЕЙТ:** ни одна умбрелла Волны 1+ не диспатчится, пока U2 не закрыт `done.md` с доказательством зелёной CI-матрицы Node 20 + 22. Цель проекта буквально ложна, пока жива заноза.

## §3 Launch-table

| Умбрелла | Волна | Тип | Зависит от | Параллельно с | Gate готовности | Объём |
|---|---|---|---|---|---|---|
| U1 plan-currency-reconcile | 0 | R/doc | — | U2 | трекеры = main; ACTION-PLAN Apache→FSL | S |
| U2 enforcement-liveness-fix | 0 | build 🔴 | — | U1 | planted-violation зелёный Node 20+22 (Node 22 в CI-матрице); `done.md` блокирует Волну 1+ | M |
| U3 modular-install-fullpack | 1 | build → **absorbed-by beta-delivery-ux A1** (2026-07-23; T17/T18 residue sweep of `mif-s3-integ` first) | U2 | — | S5: `--full` ставит всё + правило падает | L |
| U4 generator-into-install | 2 | build → **superseded-by track-1** (2026-07-23; #1086 + any-stack W2/W3) | U2, install-слои, **U3 догфуд** | U5–U8 | сгенер. правило в живом конфиге падает | M |
| U5 generator-catalog-expansion | 2 | build → **superseded-by live-generation direction** (2026-07-23) | **U3 догфуд** | U4,U6–U8 | N рецептов, каждый с paired-негативом + messageId-coverage, ноль пустышек | S–M |
| U6 install-hardening-finish | 2 | build → **split: selection absorbed-by A1; rest parked** (2026-07-23) | install-слои | U4,U5,U7,U8 | rollback+`--only/--skip`+матрица зелёные | M |
| U7 plugin-finish | 2 | build → **split: self-test+docs absorbed-by A1; OpenCode parked** (2026-07-23) | плагин-payload | U4–U6,U8 | `claude plugin install` = рабочий | M |
| U8 honest-readme-demo | 2 | doc/build → **superseded-by beta-docs-showcase** (2026-07-23) | — | U4–U7 | README честный (бейдж=FSL) + демо-GIF | S |
| U9 repo-split-3-storefronts | 3 | build → **post-announce; no longer gates U10** (2026-07-23) | U6 | — | 3 витрины независимо + self-audit/17/21 зелёные | XL |
| U10 npm-publish-getff-init | 3 | build 🔒НЕОБРАТИМО | **beta-delivery-ux R1 + release-frame phase-1 exit** (2026-07-23 amendment supersedes U9/U11/U8) | — | `npx getff init` → первое падение | M |
| U11 naming-family | 3 | doc → **absorbed-by beta-delivery-ux R1** (2026-07-23; gate travels with it) | — | — | архитектура имён заморожена ДО U10 | S |
| U12 public-launch | 4 | go-to-market → **superseded-by release-frame phase 3** (2026-07-23) | U8,U10,догфуд | — | реальные зависимые проекты | M |
| U13 money-demand-gate | signal | operator | traction | — | ⏸ operator-решение | — |
| U14 exit-prep-and-deal | signal | operator | traction | — | ⏸ operator-решение | — |
| U15 living-docs-layer | гориз. | build | U9 | U16 | drift-слой шипится | L |
| U16 stacks-react-spa-native | гориз. | build (пресеты на main) | U1 S3 (precondition: подтверждает пробелы) | U15 | оба стека зелёные e2e | M |
| U17 core-1.0 | гориз. | release | U9 (R3) | — | публичный API заморожен | S |

---

# ЧАСТЬ 2 — Дочерние умбреллы

> U2 — развёрнут полностью (соседняя папка `enforcement-liveness-fix/`). U1 и U3–U17 ниже — стабы; развернуть в полный `kickoff.md` (§1–§9 + T-ловушки + gate-чеки) перед диспатчем каждой.

## U1 — `plan-currency-reconcile` (Волна 0, no-build) — STUB
Привести планы-доки в соответствие с `main`; сверить «4 стека» (пресеты на main) и счётчик принцип-тестов; поправить ACTION-PLAN (Apache→FSL); скепсис-пасс DONE-умбрелл. T: T2, T3, T14, T15; Domain **T-PCR-A** — «доверять трекеру вместо git».

## U2 — [`enforcement-liveness-fix`](../enforcement-liveness-fix/kickoff.md) (Волна 0, 🔴 HARD BLOCKER) — РАЗВЁРНУТА
Правило реально падает у консьюмера на Node 20+22. Решение зафиксировано — **вариант A** (TS→JS+`.d.ts` при установке). Gate: `f17-lint-rules-planted-violation` зелёный на Node 20 И 22; `done.md` блокирует Волну 1+.

## U3 — `modular-install-fullpack` (Волна 1, В РАБОТЕ — STUB→ref)
Кикофф уже есть (operator notes `kickoff-modular-install-fullpack.md`, READY; перенести в `.claude/orchestrator-prompts/modular-install-fullpack/`). S5 Timeliner-acceptance = gate догфуда. Зависит от U2.

## U4 — `generator-into-install` (Волна 2) — STUB
- **Цель:** выход генератора доезжает до консьюмера (сгенер. правила, не только заготовленные).
- **В scope:** при установке прогонять синтезатор под стек; вливать `eslint-rules-snippet.json` + сгенер. правило + строки манифеста в живой `eslint.config` + барель; обобщить авто-вайрер с R2 на набор. **Вне scope:** require/type-aware (G3b, по сигналу).
- **Зависит/Gate:** U2 + install-слои + **U3 догфуд (done.md)**. Gate: сгенер. правило в конфиге, по нему падает нарушение.
- **T-ловушки:** T3, T11/T13 (вайрер «обобщён» ≠ работает на >1), T16, T19. Domain **T-GII-A** — «synth пишет additions → они применяются» (их никто не читает).

## U5 — `generator-catalog-expansion` (Волна 2, ∥) — STUB
- **Цель:** каталог рецептов с ~5 до набора реальных болей стека.
- **Зависит/Gate:** **U3 догфуд (done.md)**; ∥ U4, U6–U8. Gate: N рецептов, каждый с paired-негативом + messageId-coverage, ноль пустышек.
- **T-ловушки:** T1, T3, T4. Domain **T-CAT-A** — «рецепт есть → ловит» без негатива.

## U6 — `install-hardening-finish` (Волна 2) — STUB
- per-layer rollback (trap ERR + LIFO); `--only/--skip <layer>`; тесты идемпотентности/dry-run/shellcheck/OS-матрицы/e2e.
- Gate: слой ставится/откатывается независимо; тесты зелёные npm+pnpm, Node 20+22. T: T3,T5,T19; Domain **T-IHF-A** «rollback написан → откатывает» без сценария сбоя.

## U7 — `plugin-finish` (Волна 2) — STUB
- скепсис-проверка payload; self-test; OpenCode-адаптер; docs + публикация в каталог.
- Gate: `claude plugin install` = рабочий; self-test зелёный; принцип 24. T: T13,T15,T19; Domain **T-PLG-A** «payload в дереве → плагин рабочий» (кейс #673).

## U8 — `honest-readme-demo` (Волна 2) — STUB, не опционально перед U12

> **2026-07-23 amendment:** superseded-by `beta-docs-showcase` (umbrella B) — see the AMENDMENT block above; do not dispatch from this stub.
- **В scope:** публичная поверхность README на ветке, что пойдёт в паблик — бейдж/секция License → FSL (на устаревших ветках ещё «Proprietary», это блокирует adoption); «one-click»→«guided»; overclaim про mutation точечно — «incremental on PR» правда (шипнутый `templates/*/github-actions-ci.yml` несёт реальный `mutation:` джоб), не подтверждена только «full sweep nightly» (нет `cron`) — убрать или завести scheduled; человеческий README; демо-GIF.
- **Gate (механический):** каждое утверждение README имеет backing (file:line/команда), overclaim-sweep проходит; бейдж=FSL; GIF показывает блок нарушения.

## U9 — `repo-split-3-storefronts` (Волна 3, НЕОБРАТИМОЕ — последним; 2026-07-23: post-announce, no longer gates U10) — STUB
- R0 границы; Changesets (`fixed` core+preset) + развилка npm vs pnpm; вынести `principle-kit`; скоуп `@rules-as-tests-aif/*`→`@getff/*` + снять `private`; **R3 маркировка поверхности — НЕОБРАТИМО, в конце**.
- **Gate:** 3 витрины независимо **+ инвариант-гейт: `make self-audit` зелёный, принцип 17 + 21 проходят после разреза.** T: T11,T17,T5,T15; Domain **T-RSP-A** «развилка npm/pnpm решена кодом» (она открыта).

## U10 — `npm-publish-getff-init` (Волна 3) — STUB
- **🔒 НЕОБРАТИМО:** публикация `@getff/*` — точка невозврата. Имя-семейство (U11) **заморожено ДО** публикации.
- publish `@getff/*`; бин `getff` + команда `init`; 3–5 витринных рецептов.
- **Зависит/Gate (2026-07-23 amendment, supersedes U9+U11+U8):** beta-delivery-ux R1 + release-frame phase-1 exit. Gate: `npx getff init` → первое падение. Domain **T-NPI-A** «опубликовано → ставится чисто» без прогона на свежей машине.

## U11 — `naming-family` (Волна 3, doc) — STUB

> **2026-07-23 amendment:** absorbed-by `beta-delivery-ux` R1 — the gate «имена заморожены ДО публикации» travels with it; see the AMENDMENT block above; do not dispatch separately.
- N1 архитектура имён; ТМ — по сигналу после publish. Gate: имена заморожены ДО U10. T: T8,T15.

## U12 — `public-launch` (Волна 4) — STUB

> **2026-07-23 amendment:** superseded-by release-frame phase 3 (beta-program spec §7) — see the AMENDMENT block above; do not dispatch from this stub.
- EN (Show HN + README + PH); RU (Habr + Product Radar); сообщества; трекинг НАСТОЯЩих метрик (зависимые, форк/звезда).
- **Зависит/Gate:** U8, U10, догфуд. Gate: реальные зависимые проекты ИЛИ входящие «интегрировать/нанять?». T: T6,T15.

## U13 / U14 — деньги и выход (ПО СИГНАЛУ — НЕ авто-диспатч)
- **U13 money-demand-gate:** граница open-core, ≥5–10 buyer-интервью, тонкая платная фича как сигнал, критерий kill/pivot. **Риск-вердикт (нести в kickoff):** доказанного пути к прямым деньгам у локального линтера без SaaS нет (ESLint на донатах; VoidZero→acquihire); платная фича = сигнал «за это платят» (3–5 команд), профит через exit, не лицензии.
- **U14 exit-prep-and-deal:** data room (лицензия+SBOM есть), bus-factor вниз, иностранная структура, банкинг, юристы, покупатели, upfront vs earn-out, закрытие.
- **Дисциплина:** operator-gated. НЕ диспатчить автономно — поднимать через `AskUserQuestion`; дорогое/необратимое — только под подтверждённый спрос.

## U15–U17 — горизонт — STUB
- **U15 living-docs-layer:** drift доки↔код (OpenAPI-from-Zod, ADR-as-tests). Зависит U9.
- **U16 stacks-react-spa-native:** пресеты на main; добить e2e-пробелы (precondition: U1 S3 подтверждает наличие пробелов — иначе фантом).
- **U17 core-1.0:** после фиксации публичного API (после U9 R3).

---

# §D — Дисциплина диспатча (обязательна для каждой умбреллы)

1. **Полный kickoff перед диспатчем.** Стаб → `kickoff.md` с §1 цель, §2 фикс-решения, §3 стадии, §4 детали старта, §5 build-first-reuse, §6 AI-traps, §9 вынесено. Заголовок-блокквот с Class + Authoritative-for ([doc-authority-hierarchy.md](../../rules/doc-authority-hierarchy.md)).
2. **T-ловушки обязательны** ([ai-laziness-traps.md §3](../../rules/ai-laziness-traps.md)): цитата правила + активные T-номера + ≥1 domain-trap (проверяет принцип-тест 12).
3. **Staging-placement** ([kickoff-staging-placement.md](../../rules/kickoff-staging-placement.md)): автор → merge в `staging` → только потом `/pipeline` / aif-дисптач.
4. **Pre-dispatch in-flight probe** ([CLAUDE.md](../../../CLAUDE.md)): `gh pr list --head <branch>`, `git log origin/staging..<branch>`, скан параллельных сессий; на хит — STOP.
5. **Phase -1 cold-review** на каждый dispatch-промпт (адверсарный, read-only); для мета-уровня — cold-review этого мега-кикоффа против дочерних (1 REVISE макс).
6. **Без платного LLM в CI** ([no-paid-llm-in-ci.md](../../rules/no-paid-llm-in-ci.md)).
7. **Закрытие:** на последней стадии — `done.md` (`# <umbrella> — DONE` · Final PR · Closed · Summary).
8. **PR-strategy:** один concern на PR; систему-фикс «по пути» не спавнить автономно.
9. **Base = staging**, промоут в main — вручную (`git-safety.sh` блокирует agent-merge в main).
10. **🔒 Инвариант-гард (каждая build-умбрелла):** `done.md` подтверждает, что `make self-audit` зелёный, принцип 17 (no-paid-LLM) и 21 (агностичность) не регрессировали. Дешёвый ре-ран существующего `make self-audit`, но обязателен — чтобы регресс не проскользнул тихо.

# §E — Сознательно вынесено (не тащить внутрь)
- **G3b (require/type-aware кодоген)** — demand-gated; шов U4 — точка втыка.
- **Личная фабрика** — частично в U3; остаток (единый зонтик doc-factory) — R-phase по сигналу.
- **Деньги/структура (U13/U14)** — operator-gated, не авто-диспатч.

<!-- host-verify: none — МЕГАКИКОФФ meta-launch plan (части 1-2: waves, launch-table, child stubs): no executable deliverable of its own; every child umbrella that unfolds declares its contract in its own kickoff -->
