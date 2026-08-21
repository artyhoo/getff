# generator-require-composite-tier — umbrella kickoff

> **Статус:** ACTIVE — merged to staging, authorized for dispatch (maintainer overnight directive 2026-06-23). Следующая умбрелла генератора ПОСЛЕ `generator-forbid-mvp` (DONE, #696/#697).
> **For:** `/pipeline generator-require-composite-tier` → `/dispatcher generator-require-composite-tier`.
> **PR base:** `staging`. Стадия = PR; stage-gate (Phase -1 cold-review) между стадиями; авто-мёрж в staging после GO.
> **Доказательная база (in-repo, tracked → достижима aif-контейнером; S0 исполняется ТОЛЬКО из неё):** `RULES.md` всех пресетов; `packages/{core,preset-*}/eslint-rules/*`; `packages/core/synthesizer/recipe.schema.json`; **`docs/meta-factory/generator-forbid-mvp/s1b-astgrep-composite-pilot.md`** (методика 2-движковой матрицы + falsifier-критерий — прецедент).
> **Host-only rationale (НЕ обязательна для исполнения, контейнер её НЕ прочтёт):** `build-execution-map.md §10` (re-приоритизация после MVP), `build-plan-redteam-research.md` §A1/§A2+/§B2/§непокрытое-п.4 — вне репо (`/Users/art/Claude/Projects/rules-as-tests/`); всё load-bearing уже инлайнено в §0 + §2 S0.

## §0 Что уже проверено vs что проверить ВНУТРИ исполнения

**Проверенные факты (grep по коду 2026-06-23 + cold-review verified — можно опираться):**
- Ни одно правило репо не вызывает `parserServices`/`getTypeChecker` → **сейчас 0 type-aware правил** (даже `require-form-safe-parse` читает аннотацию `FormData` синтаксически — `tn.name==='FormData'`).
- require-ярус самописный, не использует типы; `require-otel-span` = 120 LOC ручного presence-DFS (`startActiveSpan`/`withSpan`), **НЕ литеральный esquery-селектор** — S0 определит, выражается ли он через `:has()`/`:not()`.
- R10/R13/R18 в `RULES.md` помечены «manual review / no ESLint rule today»; R7 есть, но погашен (`AIF_STRICT_RUNTIME=1`).
- **Движок в schema = `recipe.schema.json:80` enum `["eslint-restricted","ast-grep"]`** (`compile-declarative-md.ts:15` маппит `eslint-restricted → no-restricted-syntax`). «esquery» — это ВНУТРЕННИЙ движок `no-restricted-syntax`, НЕ отдельное schema-значение. Везде ниже «движок» = одно из этих двух значений.

**Гипотезы к ЭМПИРИЧЕСКОЙ проверке в S0 (НЕ принимать на веру — это и есть «проверить сначала внутри исполнения»):**
- Что R18 + `require-otel-span` требуют `ast-grep`, а `require-use-server`/`require-form-safe-parse`/R13 хватает `eslint-restricted`. ← **проверить 2-движковой матрицей на каждом правиле, falsifier-методом MVP S1b.**
- Что R10 (naming/path) не ложится в декларативный ярус.
- Что **G3b сейчас пуст** (нет правил, которым нужен вывод типов). ← S0 должен это подтвердить ИЛИ найти контрпример (правило, где синтаксиса недостаточно).

> **SETTLED узко — sufficiency≠quality (T-RCT-D/E):** S1b (`s1b-astgrep-composite-pilot.md §5`) доказал, что `eslint-restricted` (esquery) **СПОСОБЕН ВЫРАЗИТЬ** composite forbid (ancestor/inside + descendant/has) — ast-grep там НЕ обязателен. Этот **exact sufficiency-эксперимент** не перепрогонять (цитировать S1b). **НО S1b НЕ мерил quality** (читаемость/LOC/устойчивость к false-positive/сопровождаемость) и покрыл только forbid-подклассы. Поэтому S0 для **ВСЕГО корпуса (вкл. правила без фикстур)** оценивает ОБЕ оси (§2 S0): **A — sufficiency** (может ли esquery), **B — quality** (делает ли ast-grep правило качественно лучше даже там, где esquery способен). «settled» относится к оси A на 2 composite-подклассах — НЕ к оси B и НЕ к новым классам (`presence:"require"`, metavar вне built-ins, type-inference, непокрытые).

## §1 Goal (one line)

Расширить генератор с forbid на **require/presence-absence + композитный реляционный** ярус, движок по форме правила (`eslint-restricted` / `ast-grep` — выбор доказывается матрицей, не вкусом), закрыть незакрытые R13/R18 и мигрировать самописные require-правила в данные — **и одновременно подготовить почву под G3b**: общий engine-шов, `presence:"require"`-семантика и engine-agnostic anti-vacuity, в которые кодоген-движок (G3b) встанет как ещё один engine, плюс S0 определяет реальный scope G3b (правила, которым синтаксиса не хватает).

## §2 Stage map (stage-gated)

| Stage | Deliverable | Depends on | Acceptance (gate) |
|---|---|---|---|
| **S0 — DISCOVERY / VERIFY (R-phase, doc-output, BLOCKING)** | Аудит **ВСЕГО** корпуса: `core` (база, R1-R11) + 3 пресет-пакета (`preset-next-15-canonical`, `preset-react-spa`, `preset-react-native`) + IR1-6 (microservices-профиль — докрулы в `next-15-canonical/RULES.md` + `core/templates/shared/integration-rules.md`, **НЕ отдельный пресет-пакет**; pre-classify как OUT-of-AST-matrix = CI-job/contract/manual, подтвердить в S0). Для КАЖДОГО кандидата — **2-движковая матрица `eslint-restricted` (esquery via `no-restricted-syntax`) vs `ast-grep`**. **Per-rule метод (2 оси, обе с прогоном; основа — falsifier S1b `s1b-astgrep-composite-pilot.md §3`):** (1) bad+good пара — взять существующую; **правило БЕЗ фикстур → авторить пару (это и есть «непокрытые правила»: их движок оценивается наравне, плюс отметить, что ast-grep часто безопаснее для авторинга с нуля);** (2) попытка `no-restricted-syntax`-селектора через RuleTester; (3) попытка ast-grep YAML через `npx @ast-grep/cli`; (4) записать ОБА вывода verbatim. **Ось A (sufficiency):** «рабочий `no-restricted-syntax` ловит bad И пропускает good?» — да → esquery способен. **Ось B (quality, оценивать ДАЖЕ если ось A=да):** сравнить две реализации по читаемости / LOC / устойчивости к edge-case-false-positive / сопровождаемости; зафиксировать «ast-grep качественно лучше? насколько?». Пометить правила, где синтаксиса не хватает → вывод типов = G3b-scope. Output: research-patch `docs/meta-factory/research-patches/2026-..-engine-assignment-matrix.md`. | — (MVP DONE) | Таблица «правило → класс → ось A (esquery способен да/нет) → ось B (ast-grep качественно лучше? насколько) → вердикт-движок → доказательство (оба вывода verbatim)» по ВСЕМУ корпусу, **включая правила без фикстур**. **5 классов вердикта:** (1) ast-grep ТРЕБУЕТСЯ (esquery не выражает) → adopt; (2) **ast-grep ЛУЧШЕ-но-не-требуется (quality-win) → оцени честный quality-delta (чище / меньше LOC / устойчивее к false-positive) + честную cost (alpha-dep + сопровождение), обе стороны полно. Данные дают ОПРЕДЕЛЁННО лучший вариант → воркер РЕШАЕТ сам и докладывает (оператор открыт к широкому ast-grep, 2026-06-23: clear-better → adopt, не занижать под BFR-прайор; clearly-marginal → остаётся esquery). Surface оператору ТОЛЬКО genuine-форк — где данные НЕ дают определённо лучшего (близкий счёт / вкус / стратегия), `recommendation-laziness-discipline §3`. Первоклассный вопрос S0, не сноска**; (3) esquery достаточен и сравним/лучше → остаётся esquery; (4) непокрытое правило → движок + авторские фикстуры в матрице; (5) type-inference → G3b-бэклог. **Список G3b-триггеров с обоснованием почему синтаксиса мало.** Вердикт по R10 (декларативно/кастом/manual). Никаких prose-only — каждая строка с прогоном обеих осей (T3). Классы (1)+(2) задают scope S1; вердикт — scope S1-S4. |
| **S1 — ast-grep раннер (adopt)** | Вкрутить ast-grep как engine (зависимость, пин версии); engine-agnostic исполнение в валидаторе; прогон на правилах класса (1) ТРЕБУЕТСЯ + класса (2) quality-win (воркер решает на данных; genuine-форк без определённо лучшего → оператору на S1-PR). **Если S0 дал 0 в классах (1)+(2) → S1 = no-op: ast-grep НЕ добавляется, остаётся deferred** (BFR-default — нет нужды, нет зависимости). | S0 | ast-grep-правило компилируется из данных, гоняется через свой rule-test, проходит anti-vacuity engine-agnostic; `Prior-art:` трейлер ссылается на S0-матрицу + MVP S1b. ЛИБО документированный no-op с доказательством «0 ast-grep-кандидатов в S0». |
| **S2 — `presence:"require"` семантика** | Расширить declarative-схему: `presence:"forbid"\|"require"` (require краснеет при ОТСУТСТВИИ); anti-vacuity адаптировать под require. **G3b-groundwork:** схема/валидатор проектируются так, чтобы кодоген-движок встал третьим engine без переделки. | S0 | declarative require-рецепт валиден; гейты ловят вакуумное require-правило (срабатывает всегда/никогда); snapshot зелёный. |
| **S3 — миграция самописных require → данные** | Мигрировать `require-otel-span`/`require-use-server-directive`/`require-form-safe-parse` в declarative-данные (engine по S0-вердикту); удалить самописные `.ts` ПОСЛЕ паритета. | S1, S2 | **Предусловие:** enumerate парные фикстуры каждого правила; нет фикстур → TDD-пара ПЕРВОЙ (паритет меряется против реального набора, не vacuous — T14). Байт-эквивалент поведения на этих фикстурах; генератор — единственный писатель; самописный удалён только при зелёном паритете (T17/T18 — сохранить уникальный остаток, не слепо delete). |
| **S4 — закрыть R13 + R18** | Сгенерировать R18 + R13 (движок по S0-вердикту); добавить в пресет; `RULES.md` строки «manual review» → enforced. **Ветка (M3):** если S0 классифицирует R18/R13 как требующие вывода типов (G3b) → НЕ форсить синтаксис: положить рельсу + записать G3b-бэклог-строку, RULES.md остаётся «manual / G3b-deferred». | S0, S1, S2 | R18/R13 — сгенерированные правила с парными фикстурами, проходят anti-vacuity; RULES.md обновлён; провенанс на месте. **§5 S4 failing-тест применим ТОЛЬКО если S0 признал R18 синтаксически-выразимым;** иначе acceptance = рельса+G3b-бэклог записаны. |

**Stage-gate:** между каждой — Phase -1 adversarial cold-review (`reviewer-discipline.md §2`), GO/REVISE/STOP, 1 REVISE макс, CI-green ≠ design-review (T19). Авто-мёрж в staging после GO.

## §2.5 Подготовка к G3b (зачем эта умбрелла = on-ramp)

Эта умбрелла **не строит** G3b, но кладёт под него рельсы:
1. **Engine-шов обобщается до кодогена (рельса, НЕ кодоген).** Done-test шва: dispatch движка = `switch`/table по enum, добавление 3-го arm = локальный дифф. **ДОКАЗАТЬ** маркером `// G3b: codegen engine slots here` + no-op/skipped arm. **НЕ добавлять** (это уже «строить G3b», §3 OUT): функциональный codegen-раннер, codegen-значение в schema-enum, зависимость typescript-eslint-codegen.
2. **`presence:"require"` + engine-agnostic anti-vacuity** — type-aware правила G3b почти все require-класса; их валидация поедет на тех же гейтах.
3. **S0 определяет scope G3b** — список правил, где синтаксиса недостаточно (нужен вывод типов), — это и есть стартовый бэклог G3b. Если S0 найдёт 0 таких — G3b остаётся отложенным с доказательством «спроса нет».

## §3 Scope fence (hard)

**IN:** S0-S4 (аудит-матрица, ast-grep раннер если S0 докажет, require-семантика, миграция 3 правил, R13/R18, G3b-groundwork-шов).
**OUT (observation only, не спавнить PR):**
- **Сам кодоген G3b** — не строить здесь; только определить scope (S0) и оставить шов (S2, см. §2.5 done-test). Отдельная умбрелла по S0-бэклогу.
- **R7** — enablement-тумблер, не генерация.
- **R10 naming** — если S0 подтвердит «не декларативно» → кастом/скрипт, отдельно.
- **IR1-6** — microservices-профиль (CI-job/contract/manual), не AST-lintable; S0 только подтверждает классификацию, не пытается затащить в матрицу.
- LLM-черновик (G4), version-guard (G5), install-врезка (G6), полиглот-расширение ast-grep на non-TS/JS.

## §4 AI-laziness traps (`.claude/rules/ai-laziness-traps.md §2` — MANDATORY)

Active: **T1, T2, T3, T4, T5, T9, T11, T13, T14, T15, T16, T20**.

- **T1/T9** (sampling floor / не семплить лёгкое) — S0 аудитит **весь** корпус правил, не 3 удобных; floor = все R1-R11 + пресет-правила + IR1-6.
- **T2/T3** (designing≠doing; no prose-only) — S0-матрица = реальные прогоны обоих движков (verbatim вывод), не «ast-grep наверное лучше».
- **T4** (premature close) — S0 adversarial «какое правило/класс я не проверил»; не закрывать пока весь каталог не в матрице.
- **T5** (no scope creep) — не строить G3b-кодоген (только шов+scope, §2.5 done-test); не тащить R7/R10/IR.
- **T13/T16** (ADOPTED≠zero-work; pattern-match по имени) — ast-grep adopt по S0-доказательству на КАЖДОМ правиле; «require-form-safe-parse звучит type-aware» — проверить: читает аннотацию синтаксически (T-RCT-A ниже).
- **T14/T15** (clean≠no-theatre; self-application) — каждое правило со своей paired-negative на свой engine.
- **T20** — выбор engine backed прогоном (матрица), не вкусом.
- **Domain T-RCT-A:** соблазн пометить `require-form-safe-parse` как G3b/type-aware. Counter: оно читает `tn.name==='FormData'` СИНТАКСИЧЕСКИ; S0 должен прогнать и подтвердить, что синтаксиса хватает (или честно найти случай, где нет → тогда это G3b-триггер).
- **Domain T-RCT-B:** «require = инверсия forbid» — неверно (require краснеет на отсутствии); anti-vacuity нельзя копировать слепо.
- **Domain T-RCT-C:** соблазн объявить «G3b пуст» не пройдя весь корпус. Counter: S0 обязан проверить каждое правило на достаточность синтаксиса; «0 G3b-триггеров» — вывод матрицы, не предположение.
- **Domain T-RCT-D (узко):** соблазн заново ПРОГНАТЬ exact sufficiency-эксперимент S1b на тех же composite-подклассах (`s1b §5` уже доказал esquery СПОСОБЕН). Counter: цитировать S1b, не перепрогонять ось A на этих 2 подклассах.
- **Domain T-RCT-E (инверсный, тот что меня поймал):** использовать «settled S1b» как отговорку пропустить **ось B (quality)** или **непокрытые правила**. S1b мерил sufficiency, НЕ quality, и только forbid-подклассы. Counter: ось B + правила без фикстур прогоняются для ВСЕГО корпуса (§2 S0); «esquery способен» НЕ закрывает «ast-grep качественно лучше».

## §5 TDD-обязанность
Failing-тест первым: S1 — ast-grep правило из данных краснит bad/молчит good (красный без раннера) **[применимо только если S0 подтвердил ≥1 ast-grep-правило]**; S2 — require-рецепт валиден (красный без `presence:require`); S3 — мигрированное правило воспроизводит фикстуры самописного; S4 — R18 ловит `useQuery` без `.parse()` **(только если S0 признал R18 синтаксически-выразимым; иначе S4 = рельса+G3b-бэклог, см. §2 S4-ветку)**.

## §6 Capability-commit discipline
S1 = новая зависимость ast-grep → capability-commit, `Prior-art:` трейлер: сперва проверить `prior-art-evaluations.md` на СУЩЕСТВУЮЩУЮ ast-grep-запись (MVP записал DEFER-вердикт) → **расширить/transition её, не плодить дубль (T13)**; ссылка на S0-матрицу + MVP S1b; consult SSOT + DeepWiki/WebSearch ≥3 phrasings. **Adopt-триггер = класс (1) ТРЕБУЕТСЯ ЛИБО класс (2) quality-win.** Класс (2): воркер adopt'ит сам, когда данные дают определённо лучший вариант (оператор открыт к широкому ast-grep); оператор одобряет на S1-PR ТОЛЬКО genuine-форк (нет определённо лучшего — `recommendation-laziness-discipline §3`). Пин версии (alpha) при adopt. Если S0 дал 0 в классах (1)+(2) → S1 no-op, alpha-dep НЕ добавляется. S2-S4 — код ≥80 LOC → трейлеры.

## §7 `done.md` (схема CLAUDE.md Umbrella closure) — при мёрже S4. Частичный прогресс → не писать, умбрелла открыта.

## §8 Staging-placement
Kickoff на staging через PR #701 ДО `/pipeline` (`kickoff-staging-placement.md §1`). Зависит от `generator-forbid-mvp` DONE (#697). Не диспетчеризовать с feature-ветки (`#dispatch-before-staging`). Sibling `generation-paths-comparison` — DONE (#698, вердикт «paths LAYER, not compete»); эта умбрелла расширяет общий declarative-compile (через него течёт и Path B), не конфликтует.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
