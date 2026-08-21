# plan-currency-reconcile — umbrella kickoff (U1)

> **Class:** operational kickoff (dispatch input).
> **Authoritative for:** scope умбреллы «привести план-доки в соответствие с реальностью `main`»; зафиксированные решения; стадии S1–S4; вынесенное (§9).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Программа/очередность — [getff-to-prod-meta-launch/kickoff.md](../getff-to-prod-meta-launch/kickoff.md). Объём работ (operator notes, вне репо) — `ПЛАН-ПОЛНЫЙ-getff-2026-06-26.md` §E.
> **Base branch:** `staging` (НЕ `main` — промоут вручную).
> **Status:** full kickoff, готов к диспатчу. Волна 0, R/doc, **no-build**. ∥ U2 (но U2 уже закрыт `done.md` — параллельность исчерпана).

---

## §1 Цель (одной фразой)

План-доки (трекеры, `ACTION-PLAN.md`, публичный README) **перестают врать о статусе**: каждое «не сделано», которое на самом деле уже на `main`, исправлено; лицензия в доках = **FSL**; «4 стека» и счётчик принцип-тестов сверены с `main` по `git`, а не по тексту трекера; остальные DONE-умбреллы прогнаны скепсисом. **Никакого кода продукта** — это R/doc-умбрелла.

## §2 Зафиксированные решения (не пересматривать без причины)

1. **No-build, R/doc only.** Правок кода продукта нет. Если скепсис-пасс (§3 S4) находит реальный баг в DONE-умбрелле — это **finding в research-выход**, фикс выносится в отдельную умбреллу (T5), здесь не чинится.
2. **Источник правды — `git`/`main`, НЕ трекер.** «Сделано на main» определяется проверкой `git` (файл существует / коммит есть в `origin/main`), не доверием к прозе трекера. Это ровно та `#trust-tracker-over-git` ошибка, под которую заведён domain-trap **T-PCR-A** (§6).
3. **Лицензия = FSL-1.1-ALv2.** Apache-2.0 — лишь авто-конверсия через 2 года. Любое «Apache-2.0 на месте» / «CLA под Apache-2.0» в `ACTION-PLAN.md` → переписать на FSL.
4. **README sync — на актуальной публичной ветке.** Отстающая `plug-packaging` ещё несёт «Proprietary»; работать на ветке, что пойдёт в паблик, и закрыть mutation-overclaim в теле README (см. план §A3.2 / §E3).
5. **Расположение входов.** Трекеры (`СЛЕДУЮЩИЕ-РАБОТЫ.md` / `roadmap-state.md` / `plans-check.md`) и `ACTION-PLAN.md` живут в **operator notes (вне репо)**; README — **в репо**. Воркер без доступа к operator notes ОБЯЗАН это явно зафлагать (park), а не молча пропустить E1/E2.

## §3 Стадии

| Стадия | Что даёт | Зависит от |
|---|---|---|
| **S1** | enumerate расхождений: для каждого «не сделано» в трекерах — `git`-проверка (на `main` или нет); таблица `claim | трекер | git | действие` | — (старт) |
| **S2** | E1+E2: поправить трекеры (галочки на сделанное) + `ACTION-PLAN` Apache→FSL — по результату S1 | S1 |
| **S3** | E3: README sync — подтвердить актуальную публичную ветку; «4 стека» (пресеты на `main`) + счётчик принцип-тестов сверить по `git`; mutation-overclaim закрыт | S1 |
| **S4** | E4: скепсис-пасс остальных DONE-умбрелл (`migration-ast`, плагин #673, генератор) — «закрыто» vs «внутри так» | S1 (∥ S2/S3) |

**Порядок:** S1 → (S2 ∥ S3 ∥ S4). **Precondition-роль:** S3 «4 стека» сверка — это та проверка, которую U16 ждёт как precondition (подтверждает, есть ли реальные e2e-пробелы у react-spa/native или это фантом).

## §4 S1 — детальная задача (go сейчас)

1. Собрать из трёх трекеров каждую строку-claim «не сделано / TODO / в работе».
2. Для каждого — конкретная `git`-проверка против `origin/main` (например `git -C <repo> ls-tree origin/main -- <path>`, `git log origin/main --oneline | grep <feature>`), зафиксировать **команда + вывод**.
3. **Выход S1:** таблица `claim | трекер говорит | git говорит | действие (flip/keep)`. Ничего не правим (T5).

## §5 Что переиспользуем (build-first-reuse, see [build-first-reuse-default.md](../../rules/build-first-reuse-default.md))

- **Нет capability-commit** — умбрелла doc-only, новый код/зависимости не вводятся.
- Уже есть тулза `plan-currency-check` (артефакт `_plan-currency-raw.txt` + ветка `fix/plan-currency-check-tests`) — **сперва проверить, не закрывает ли она S1-enumeration** прежде чем делать сверку руками (REUSE-default). Её собственный de-bitrot тестов — **не** scope этой умбреллы (§9).

## §6 AI-laziness traps (per [ai-laziness-traps.md §2](../../rules/ai-laziness-traps.md))

**Активные ловушки:** **T2** (спроектировать метод сверки ≠ прогнать его — реально выполнить `git`-проверки, не «моя методология поймала бы»), **T3** (каждое «на main / не на main» = команда + вывод, не проза), **T14** (чистый скепсис-пасс ≠ «умбрелла точно DONE» при низком покрытии — различать «verified-clean» и «coverage insufficient»), **T15** (self-application: выход-таблица этой умбреллы сама не должна задрейфовать от `main`).

**Domain-specific:**
- **T-PCR-A** — «доверять трекеру вместо `git`». Ровно класс бага: читаем «не сделано» в трекере и верим тексту, а не проверяем `git` → сверка **усиливает ложь**, ради устранения которой и заведена. Контр: каждая строка статуса бэкается `git`-командой (§7 S1-gate).

## §7 Гейты стадий (реальные проверки, не «vibe»)

- **S1 gate:** таблица-сверка существует, в каждой строке — колонка с `git`-командой; ноль prose-only строк (grep по `git ` в каждой строке).
- **S2 gate:** `grep -rnE "Apache-2.0 на месте|CLA под Apache" ACTION-PLAN.md` → **0 совпадений**; устаревшие «не сделано» в трекерах перевёрнуты (diff показывает конкретные строки).
- **S3 gate:** на публичной ветке README не содержит «Proprietary» (`grep -c Proprietary` → 0); бейдж лицензии = FSL; «4 стека» = `ls -d packages/preset-*` + shared ts-server совпадает с текстом; счётчик принцип-тестов = `ls packages/core/principles/*.test.ts | wc -l` совпадает с заявленным.
- **S4 gate:** по каждой из `migration-ast` / плагин #673 / генератор — письменный вердикт `verified-done | finding-filed` с командой/`file:line`, без «выглядит ок».

## §8 Инвариант-гард (в `done.md`)

No-build → self-audit нетронут, но при закрытии всё равно подтвердить `make self-audit` зелёный (дёшево). Принципы 17 (no-paid-LLM) и 21 (агностичность) doc-only умбреллой не затрагиваются.

## §9 Вынесено из умбреллы — не забыть

- **Фиксы багов, найденных скепсис-пассом S4** — research-выход → отдельная умбрелла (T5, не бандлить).
- **De-bitrot тестов `plan-currency-check`** (ветка `fix/plan-currency-check-tests`) — отдельный concern, не эта умбрелла.
- **Закрытие e2e-пробелов react-spa/native** — это U16; S3 здесь только **подтверждает наличие** пробелов (precondition), не закрывает их.

## §10 Закрытие

На завершении — `done.md` по схеме CLAUDE.md «Umbrella closure convention»: `# plan-currency-reconcile — DONE` · Final PR · Closed · Summary.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
