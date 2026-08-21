# generation-paths-comparison — сравнение двух путей генерации `[DRAFT until merged to staging]`

> **Authoritative for:** scope + метод отдельной R-сессии, которая сравнивает два уже-смёрженных на `staging` подхода к генерации правил и предлагает, как взять лучшее из обоих. Owns: оси сравнения, обязательная доказательная процедура, формат DECISION-NEEDED.
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Выбор победителя / стратегию композиции — это **операторское решение**, сессия его НЕ принимает (см. §6, [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md)). Per-stage реализацию любого из путей — это их собственные umbrella (`generator-forbid-mvp`, `stage-2-generate-path`).

> **Status:** R-phase (research + decision-surfacing). Doc-output only — **никаких capability-commit'ов, никаких правок `synthesize.ts` / валидатора / рецептов**. Output = research-patch + DECISION-NEEDED для оператора.
> **Type:** R-phase, single concern.
> **Base:** `staging`.
> **Opened:** 2026-06-23.

## §0 Зачем эта сессия (и почему отдельная)

На `staging` после ночи лежат **два независимо смёрженных подхода к тому, как фабрика производит enforcement-правила**:

- **Путь A — `generator-forbid-mvp` / S4 «спека → компиляция forbid».** Детерминированный компилятор: спека `forbid`-принципа **компилируется** в данные ESLint-правила + парные фикстуры + провенанс-заголовок; генератор — единственный писатель файла; анти-пустышка-гейты (S3) до коммита; S5 механически валит ручную правку эмита; **ноль платного LLM**. Движок — multi-engine (esquery default + ast-grep для метапеременных, DN-1 RESOLVED → A). Хедлайн: «настоящий генератор, не lookup-библиотека».
  - SSOT: [`.claude/orchestrator-prompts/generator-forbid-mvp/kickoff.md`](../generator-forbid-mvp/kickoff.md), [`NIGHT-REPORT.md`](../generator-forbid-mvp/NIGHT-REPORT.md); commits `9fcab2696` (S4), `065a99db7` (S5), `c035a94a5`/`9f1bf5168` (closure).
- **Путь B — `stage-2-generate-path` / live-LLM generate-path (#646).** Консьюмер наводит инструмент на любой стек → research → synthesize → self-validate → install, **install-time на подписке консьюмера, никогда не в CI**. LLM «выбирает из меню» (Path A — конфигурирует существующие плагины, не пишет TS); L4/L5 переиспользуются байт-в-байт. Хедлайн: «фабрика генерализуется на новые стеки».
  - SSOT: [`.claude/orchestrator-prompts/stage-2-generate-path/kickoff.md`](../stage-2-generate-path/kickoff.md); дизайн-спека [`docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md`](../../../docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md) (на `staging`, blob `fa98fdf`, PR #659); commits `97a0925d1` (Stage 4), `0ee369ab5` (Stage 5), `c035a94a5` (closure).

Обе umbrella сами предвидели сравнение: NIGHT-REPORT forbid-mvp прямо пишет «Параллельно идёт независимая умбрелла `stage-2-generate-path`… **сравню при мёрже**». Kickoff'ы и память велят: **победителя без спроса не выбирать, сравнение — отдельная сессия.** Это она.

**Почему отдельная, а не «по-быстрому в чате»:** выбор между ними (или способ их совместить) — стратегический, с долгим хвостом последствий для архитектуры фабрики. По [reviewer-discipline.md §1-§2](../../../.claude/rules/reviewer-discipline.md) такой вызов не принимается мимоходом — он либо backed полной доказательной процедурой, либо surfaced оператору.

## §1 Гипотеза для проверки (НЕ предрешение)

Рабочая гипотеза, которую сессия обязана **опровергнуть или подтвердить на фактах**, а не принять: **пути A и B не конкурируют, а слоятся** — детерминированная forbid-компиляция (A) и live-LLM-генерация (B) могут быть разными слоями одного пайплайна (например: B исследует/предлагает спеку для нового стека → A детерминированно компилирует её в правило + гейты).

Сессия равновероятно должна быть готова прийти к: (а) они слоятся (взять оба, определить шов); (б) один поглощает другой (на каких классах правил); (в) они реально конкурируют за одну роль и нужен выбор. **Стартовать с предвзятостью к любому исходу = T7 + `#strategy-decided-by-reviewer`.**

## §2 Оси сравнения (заполнить ФАКТАМИ, каждая ячейка = команда/файл:строка/прогон)

| Ось | Путь A (forbid-compile) | Путь B (LLM generate-path) |
|---|---|---|
| Класс покрываемых правил | ? (S0: только `forbid`; require/type-aware = G3b, OUT) | ? (Path A: «из меню» существующих плагинов) |
| Детерминизм / воспроизводимость | ? | ? |
| Стоимость прогона (CI vs install-time; платный LLM?) | ? | ? |
| Канал отказа (на каком этапе ловится плохое правило) | ? (S3 анти-пустышка до коммита + S5) | ? (существующий L4 на выходе LLM) |
| Безопасность выхода (adversarial/malformed правило в репо консьюмера) | ? (вход — спека-данные, не свободный код) | ? (живой LLM-выход → L4 — единственный барьер?) |
| Генерализация на новый стек без курированного оракула | ? | ? (Stage 4 — главный пруф) |
| Где «единственный писатель» / провенанс | ? (S5 anti-hand-edit) | ? |
| Переиспользуемые общие слои | L4/L5? | L4/L5 (заявлено байт-идентично) |
| Зависимость от подписки/сети | ? | ? (install-time, подписка консьюмера) |

**Дисциплина заполнения (T2/T3):** ни одной ячейки со словами «would» / «должно». Каждая = либо прогон команды с выводом, либо `file:line` с реальным содержимым строки, либо явный `INCONCLUSIVE-needs-human`. Пустую ячейку оставлять как `INCONCLUSIVE`, не выдумывать.

## §3 Inputs (SSOT — прочесть перед любым выводом)

- Оба kickoff'а + NIGHT-REPORT (§0 выше).
- [`docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md`](../../../docs/superpowers/specs/2026-06-22-stage-2-generate-path-design.md) — §2 ground-truth, §6 reuse-gate, §8 риски пути B (на `staging`, blob `fa98fdf`).
- [`docs/meta-factory/architecture.md`](../../../docs/meta-factory/architecture.md) §2.4–2.7 (контракты L2/L3/L4/L5) — общий субстрат, на котором оба строятся.
- Код слоёв: `packages/core/{detector,research,synthesizer,validator,installer}/` — особенно `synthesizer/` (компиляция A) и `validator/` (L4, общий).
- [`docs/meta-factory/prior-art-evaluations.md`](../../../docs/meta-factory/prior-art-evaluations.md) — SSOT вердиктов; entry #114 (S1a) и записи вокруг #646.
- [`build-first-reuse-default.md`](../../../.claude/rules/build-first-reuse-default.md) — рамка «adopt/adapt/build»; применить к вопросу «нужны ли оба».

## §4 Что НЕ делать (hard scope fence)

- **НЕ выбирать победителя в одиночку.** Любой вывод вида «берём A, B выкинуть» (или наоборот) без операторского GO = `#strategy-decided-by-reviewer` ([reviewer-discipline.md §3](../../../.claude/rules/reviewer-discipline.md)). Максимум — **рекомендация с обоснованием** + явный DECISION-NEEDED (§6).
- **НЕ писать код.** Ни правок `synthesize.ts`, ни нового рецепта, ни merge-слоя двух путей. Open `Edit` на исходнике в этой сессии = стоп (T5). Output — markdown.
- **НЕ перерешать уже решённое внутри каждой umbrella** (движок A = multi-engine; Path B = OUT для пути B; «no paid LLM in CI»). Сравнение — про **отношение** двух путей, не про их внутренние развилки.
- **НЕ расширять scope** на G3b/G4/G5 и прочий backlog (`#PR-strategy` drive-by). Заметил смежное — surface как observation в финале, не спавнь PR.

## §5 AI-laziness traps ([`.claude/rules/ai-laziness-traps.md §2`](../../../.claude/rules/ai-laziness-traps.md) — MANDATORY)

Active: **T2, T3, T4, T7, T11, T14, T15, T16, T20**.

- **T2/T3** — «путь X лучше по оси Y» = прогон/`file:line`, не нарратив. §2 таблица — это и есть инструмент против T3.
- **T4** (premature close) — adversarial counter-prompt на уровне ОСЕЙ: «какую ось сравнения я молча не покрыл?» (кандидаты: безопасность LLM-выхода, скорость для консьюмера, поддерживаемость). Прогнать до закрытия.
- **T7** (pattern-match вместо рассуждения) — не подгонять под заранее симпатичный исход (§1). Если §2 заполняется «ровно в пользу одного» — перепроверить, это подозрительно.
- **T11** (custom без prior-art) — на вопрос «как другие фабрики правил совмещают детерминированную компиляцию и LLM-генерацию» — DeepWiki + WebSearch ≥3 формулировки, не из памяти.
- **T14** (clean ≠ no-theatre) — «оба хороши» при низком покрытии осей = «покрытие недостаточно для вывода», а не «оба эквивалентны».
- **T15** (self-application) — §self-application: «применил ли я к этому сравнению собственный принцип "documents lie; tests don't" — т.е. подкреплён ли каждый вывод исполняемым прогоном, а не прозой?».
- **T16** (pattern-match по имени) — оба зовут себя «генератор». Явно выписать: **проблем-класс A = X, проблем-класс B = Y, пересекаются ли — доказательство**. Совпадение имён ≠ совпадение роли.
- **T20** (inline-verdict без доказательства) — любой вердикт в чате/доке backed tool-call'ом в том же ходу.
- **Domain-specific T-CMP-A:** «оба смёржены и зелёные → значит совместимы». Counter: зелёный CI каждого по отдельности НЕ доказывает их совместного шва; проверить L4/L5-переиспользование на факте (читают ли оба один и тот же `validate(plan)`), не на заявлении kickoff'а.
- **Domain-specific T-CMP-B:** сравнивать ярлыки kickoff'ов вместо кода. Counter: ось закрывается чтением `packages/core/{synthesizer,validator}/`, а не цитатой из kickoff про то, что «должно» делаться.

## §6 Output + формат DECISION-NEEDED (binding)

Сессия производит **research-patch** под [`docs/meta-factory/research-patches/`](../../../docs/meta-factory/research-patches/) (`2026-06-2X-generation-paths-comparison.md`), содержащий:

1. Заполненную §2 таблицу (факты).
2. Вердикт по §1 гипотезе: слоятся / поглощение / конкуренция — **с доказательствами**.
3. Если «слоятся» — предложенный шов (где кончается B, где начинается A), как ≥2 опции, без выбора между ними.
4. Блок **DECISION-NEEDED** ровно по [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md):

   ```text
   DECISION-NEEDED: <одна строка — какую роль играет каждый путь / что берём>
   Option A → <downstream-последствие>
   Option B → <downstream-последствие>
   Option A+B (композиция) → <шов + последствие>
   Рекомендация сессии (backed, не приказ): <вариант + почему, с file:line/прогонами>
   Решает: оператор или отдельная /orchestrator-сессия. Сессия останавливается здесь.
   ```

5. Новые/обновлённые записи в `prior-art-evaluations.md`, если §5 T11 что-то всплыл.

**Сессия НЕ реализует выбранный вариант.** Реализация — следующая umbrella после операторского GO.

## §7 Staging-placement (ОБЯЗАТЕЛЬНО — [kickoff-staging-placement.md §1](../../../.claude/rules/kickoff-staging-placement.md))

Этот kickoff — tracked-файл; `/pipeline` и aif-dispatch читают его с ветки `staging`. **Последовательность (binding):** автор kickoff → **смёржить в `staging`** (PR, squash) → **только потом** `/pipeline generation-paths-comparison` или aif-dispatch. Раздавать диспетч, пока kickoff живёт только на feature-ветке = `#dispatch-before-staging` (сессия на staging его молча не увидит).

## §8 Acceptance

- Research-patch с заполненной §2 (ноль ячеек «would»; `INCONCLUSIVE` допустим, выдумка — нет).
- §1 гипотеза явно подтверждена/опровергнута на доказательствах.
- DECISION-NEEDED-блок §6 присутствует, оба пути описаны без выбора победителя сессией.
- §self-application (T15) присутствует.
- T11-свип по prior-art зафиксирован (что искали, что нашли).

## §9 See also

- [`.claude/orchestrator-prompts/generator-forbid-mvp/kickoff.md`](../generator-forbid-mvp/kickoff.md) — путь A SSOT.
- [`.claude/orchestrator-prompts/stage-2-generate-path/kickoff.md`](../stage-2-generate-path/kickoff.md) — путь B SSOT.
- [reviewer-discipline.md](../../../.claude/rules/reviewer-discipline.md) — почему сессия surfaces, а не решает.
- [build-first-reuse-default.md](../../../.claude/rules/build-first-reuse-default.md) — рамка «брать оба / один / совместить».
- [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md) — §7 merge-first.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
