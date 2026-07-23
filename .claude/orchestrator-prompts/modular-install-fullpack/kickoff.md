# Umbrella kickoff — `modular-install-fullpack` (READY)

> **Status (2026-07-23 amendment):** absorbed-by `beta-delivery-ux` A1 — after a T17/T18 preserved-residue sweep of the stalled `mif-s3-integ` branches. Do not dispatch from this kickoff. See [beta-program spec §2 D1](../../../docs/superpowers/specs/2026-07-23-beta-program-design.md).

> **Class:** operational kickoff (dispatch input). **Status:** READY — §7-развилки закрыты brainstorm-сессией 2026-06-24.
> **Authoritative for:** scope + стадии умбреллы «личный фулпак одной командой через модуляризацию install»; зафиксированные решения; вынесенные-вне-умбреллы пункты (§9).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md). Последовательность фаз / Поток L — ROADMAP.md (planning workspace `rules-as-tests`). Фактаудит — plans-check.md (planning workspace).

> **Перед диспатчем (обязательно):** (1) ~~brainstorm по §7~~ — **сделано 2026-06-24**; (2) ~~перенести в код-репо~~ — **сделано** (этот файл); (3) **смержить в `staging`** до выдачи `/pipeline` или aif-дисптача (per [`.claude/rules/kickoff-staging-placement.md`](../../rules/kickoff-staging-placement.md) — кикофф на фиче-ветке невидим диспатчеру на staging). Сейчас файл на ветке `plug-packaging` — НЕ диспатчить, пока не на `staging`.

---

## §1 Цель (одной фразой)

`./setup -y` на любом моём проекте ставит **полный пак одной командой** — skills + agents + rules-as-tests с **живым enforcement** + MCP + плагины **под стек**, без ручного хвоста. Личный инструмент, **вне рыночной цепочки** (не нужен рыночный R-publish: changesets/нейминг/маркировка поверхности).

## §2 Зафиксированные решения (не пересматривать без причины)

1. **Делаем через модуляризацию install (поток I), а не bolt-on на монолит.** Провижининг (MCP/companions/стек-тулы) = **новые слои** → нет переделки при будущем разрезе. Рыночный R (publish-split) НЕ входит в эту умбреллу.
2. **User-facing флаг — `-y` / `--yes`** (решение 2026-06-24, пересмотр Q3): канон = `-y`/`--yes` («на всё согласен, не спрашивай») — обёртка `setup` уже его парсит (`setup:8`). `--full` остаётся (а) внутренним флагом `install.sh` (обёртка форвардит его на yes-пути — ноль churn в ~7 install.sh-сайтах) и (б) принятым алиасом на обёртке (back-compat: упоминается в install.sh help/доках). `--all` folds в ту же семантику. Новый `--fullpack` НЕ вводим; `-f` занят под `--force`.
   > **⚠ Плумбинг-разрыв (review-finding C1, проверено на коде 2026-06-24):** обёртка `setup` парсит `--yes`/`--all` (MODE=yes), НО `setup:22` форвардит в `install.sh` лишь `${STACK}`/`${DRY}` — **не пробрасывает yes-режим**, а неинтерактивный фулпак install.sh гейтит на своём `--full`. Итог сегодня: `./setup --yes`/`--full` **не ставит dev-deps** (install.sh не видит `--full` → REDUCED). **Чинит S4** (§3): на `--yes`/`-y`/`--all` обёртка форвардит `--full` в `install.sh`; добавить короткий `-y`; `--full` принять как алиас. install.sh-внутренний `--full` НЕ переименовываем.
3. **`-y`/`--yes` — единый для всех** (brainstorm 2026-06-24, Q3 + пересмотр флага): `./setup -y` = «на всё согласен» = все слои + dev-deps + MCP + companions для **любого**, кто его гоняет. **Без ветвления self/consumer** (YAGNI, нет дрейфа двух путей `#cc-only`-класса). dev-deps в yes-режиме обязательны — без них enforcement в REDUCED-режиме (правила не срабатывают). (`--full` — принятый алиас + install.sh-внутренний носитель scope=full, форвардится обёрткой на yes-пути; см. §2.2.)
4. **Тонкая надстройка над AIF — С ОГОВОРКОЙ (пересмотрено 2026-06-24, решение A).** Премиса «надстройка над работающим `/aif`+`npx skills`» **не подтверждена**: FQA-B (2026-06-11) — P1 BLOCKER (state-файл мёртв на install-пути), `/aif`/`skills.sh` в репо не шипятся. → S3 сужен до «оживить наш собственный tool-bootstrap слой» (§3); проверка движка AIF + stack-aware маппинг **вынесены в R1 вне умбреллы** (§9). Наш слой остаётся: deps-hash-хук, персистентность `.ai-factory/tool-decisions.md`, дисциплина `tool-bootstrapping`, слои-обёртки.
5. **MCP — два яруса, оба в yes-проходе** (`./setup -y`; brainstorm 2026-06-24, Q1+Q4):
   - **per-project:** context7 → `.mcp.json` (восстановление регрессии L1) + стек-релевантные MCP. Слой `05-mcp` идёт **рано, до dev-deps** (Q1): дешёвый file-write, ни от чего не зависит, детекция стека читает `package.json` (не `node_modules`); если deps упадут — MCP уже лёг; лексикографика `05 < 70`.
   - **user-scope (раз на машину):** DeepWiki — **внутри yes-прохода** (Q4), но **строго detect-first** (`claude mcp list --scope user | grep`), идемпотентно; шаг **явно помечается как machine-scope** в выводе.
6. **Приёмка — на Timeliner как первом живом консьюмере** (итеративный догфуд), бэклог `docs/meta-factory/consumer-findings-timeliner.md` (F1–F13). Критерий (Q7): `./setup -y` ставит фулпак **сразу как надо** И **правило реально срабатывает** = pre-push НЕ в REDUCED (dev-deps стоят) И planted-violation тест зелёный на целевой Node — с учётом tsx/`.ts`-loading фрагильности (класс #636/#642/#644; plans-check §5: RED на Node 22).

## §3 Стадии (кикоффы под общей умбреллой)

| Стадия | Кикофф | Что даёт | Зависит от |
|---|---|---|---|
| **S0** | `mif-s0-boundary-table` | таблица границ install.sh → слои, **с заложенными новыми слоями** `05-mcp` + `15-companions-stack` | — (старт) |
| **S1** | `mif-s1-lib-and-layers` | извлечь `setup.d/lib.sh` + нарезать существующие слои + тонкий диспетчер (байт-в-байт) | S0 |
| **S2** | `mif-s2-mcp-layer` | слой `05-mcp`: вернуть context7 в `.mcp.json` (per-project, регрессия L1) + `kind=mcp` в движок манифеста; **+ user-scope DeepWiki в yes-проходе, detect-first** | S1 |
| **S3** | `mif-s3-revive-toolbootstrap` | **(СУЖЕН, решение A)** оживить наш tool-bootstrap слой: сидим `.ai-factory/tool-decisions.md` на install-пути, оживляем цикл deps-hash, чиним сломанный context7-контракт в SKILL. `15-companions-stack` = манифест-driven companions под стек (стек-колонка), **БЕЗ AIF-маппинга** — он за R1 (§9). | S1 (∥ S2) |
| **S4** | `mif-s4-full-oneshot` | `-y`/`--yes` = прогнать все слои + неинтерактивность (обёртка форвардит `--full` в install.sh, T2b; снять интерактивный стек-пикер `install.sh:181`); на yes-пути dev-deps ставятся → enforcement живой | S1–S3 |
| **S5** | `mif-s5-timeliner-acceptance` | догфуд на Timeliner: `./setup -y` → закрыть findings → повторять до зелёного «всё сразу» + реальное срабатывание правила (критерий §2.6) | S4 (сквозная) |

**Порядок:** S0 → S1 → (S2 ∥ S3) → S4 → S5. Вся умбрелла **независима** от G3b / нейминга / промо / рыночного-R **и от R1/R2** (§9).

**Файлы стадий:** S1=[`kickoff-s1.md`](kickoff-s1.md) · S2=[`kickoff-s2.md`](kickoff-s2.md) · S3=[`kickoff-s3.md`](kickoff-s3.md) · S4=[`kickoff-s4.md`](kickoff-s4.md) · S5=[`kickoff-s5.md`](kickoff-s5.md). S0=[`s0-dispatch-prompt.md`](s0-dispatch-prompt.md). Колонка «Кикофф» выше = логическое имя стадии = имя ветки в stage-gate.

### §3.1 Модель диспатча (review-finding C2/I1 — честно, не «один магический вызов»)

Поза: **autonomous внутри стадии, оператор продвигает между стадиями** (выбор 2026-06-24). Конкретно:

- **S0 — ручной пред-шаг, НЕ aif.** Оператор вставляет [`s0-dispatch-prompt.md`](s0-dispatch-prompt.md) в свежую CC-сессию (research-only, код не двигается). Артефакт S0 (`kickoff-s0.md`) коммитится в `staging` — это мост ручное→авто: S1-gate проверяет его наличие на staging.
- **S1–S5 — автономный путь, но диспатч per-stage по ЯВНОМУ пути к файлу** (review-finding I2, проверено против `dispatcher/SKILL.md` §2.1/§2.7): `/dispatcher <umbrella>` и его §2.1 диспатчат фиксированный `<umbrella>/kickoff.md` — а это индекс-спека, НЕ исполняемая задача стадии. Поэтому каждую стадию диспатчат, передавая примитиву **путь именно к `kickoff-sN.md`**:
  ```bash
  npx tsx packages/runtime-bridge/src/cli/dispatch.ts \
    .claude/orchestrator-prompts/modular-install-fullpack/kickoff-s1.md   # затем -s2/-s3 (∥), -s4, -s5
  ```
  Вокруг этого `/dispatcher`-цикл делает monitor→Q&A→harvest→Phase-1→stage-gate→advance. Внутри стадии aif автономен (технические форки — сам; стратегические — паркует оператору per §4c). Оператор продвигает стадии (твой дефолт, не поллер). **Это НЕ один вызов, проезжающий S1→S5 без касаний** — оператор на advance-переходах, на парканутых стратегических форках, и задаёт путь стадии при каждом диспатче. Умбрелла-`kickoff.md` сам по себе НЕ диспатчится как задача.
- **Перед `/dispatcher`:** kickoff'ы стадий должны быть на `staging` (per [`kickoff-staging-placement.md`](../../rules/kickoff-staging-placement.md)).

### §3.2 Общий стратегический форк L1 (review-finding I2 — один владелец, не двойной парк)

Форк «propose-only vs opt-in авто-установка инструментов/MCP для личного профиля» (L1) встаёт **и в S2, и в S3** (параллельные). Он **genuinely стратегический** — конфликтует с `tool-bootstrapping` Rule 3 («никогда не ставить MCP/skill без явного подтверждения; no env/config bypass»). Поэтому: **решается ОДИН раз оператором ПЕРЕД диспатчем S2/S3**, фиксируется здесь, и обе стадии ссылаются на это решение — **не паркуют независимо** (двойной парк → риск разнесённых дефолтов).

**L1 RESOLVED → A-curated (operator, 2026-06-24).** Under `-y`, stack-variable MCP/tools auto-install WITHOUT the per-item Y/n, but ONLY the AI-curated set: tool-bootstrapping Rules 1/2/4/6 (analyse → propose → token-economy DROP of low-value/skill-coverable → record rationale) run unchanged even under `-y`. `-y` removes ONLY Rule 3's interactive Y/n, NOT the research/evaluation. S2 (MCP) = full Rules 1/2/4 curation (may net to "nothing beyond fixed context7/DeepWiki"). S3 (companions) = static stack-column match. Honest Rule 3 carve-out required at implement time: "interactive `-y` = blanket-confirmation; ban stays on SILENT env/config bypass" — this is S2/S3's implementation detail, NOT auto-install-everything.

## §4 S0 — детальная задача (это go сейчас)

**Артефакт S0:** таблица `текущий шаг install.sh → целевой слой`, БЕЗ перемещения кода (только решение порядка/границ). Эталон под S1–S4.

- Слои (числовые префиксы, лексикографический порядок, systemd `*.conf.d`-стиль; bash 3.2 — без `declare -A`): черновой набор
  `05-mcp` · `10-skills` · `15-companions-stack` · `20-agents` · `30-templates` · `40-configs` · `50-hooks` · `60-ci` · `70-deps`.
  **Закреплено (Q1):** `05-mcp` рано, **до** `70-deps`. *(Остальные точные номера/состав — решить в S0.)*
- **Объём честно (Q6, проверено 2026-06-24):** `install.sh` = ~1585 строк; шов хелперы⟂пайплайн ~657; back-half **>900 строк** — сам пайплайн (AST-вшивание `_aif_gate_check`/`_aif_yq_wire` ~1121–1156, merge §7, dep-install §8) + глубокие inline-замыкания. «13 хелперов» **недооценивает** S1. Lib-only guard `return`-ит **до** определения `copy_safe`/`mkdir_safe`/`chmod_safe` — пересобрать guard для юнит-тестов.
- Для каждого текущего шага install.sh: в какой слой едет, зависимости между слоями, что остаётся во входе (стек-пикер, preflight, парсинг флагов).
- Отметить, где живёт AST-врезка (слой `60-ci`, под будущий G6) и dep-install (`70-deps`).
- **Выход:** markdown-таблица + список зависимостей слоёв. Ничего не двигаем.

## §5 Что переиспользуем (build-first-reuse)

`tool-bootstrapping` skill (есть, но **чинить** — см. S3), `companions.manifest` + `engine.sh` (есть, `companion_step` loop), `install.sh` уже шипит skills/agents/rules, `--full` (есть). Новое — тонкое: канон `-y`/`--yes` + проброс `--full` в install.sh на yes-пути, дефолт-deps на yes-пути, `kind=mcp`, стек-колонка, возврат context7, user-scope DeepWiki (detect-first), seed `.ai-factory/tool-decisions.md`.

## §6 AI-laziness traps (per [`.claude/rules/ai-laziness-traps.md §2`](../../rules/ai-laziness-traps.md))

**Активные:** T1, T2, T3, T5 (S0 — research/таблица, не правка кода — не бандлить фиксы), T11, T13, T15, T16 (`--full` сейчас ≠ фулпак), T19, T20.

> **T-MIF-A / T13 УЖЕ СРАБОТАЛИ** — FQA-B 2026-06-11 P1 BLOCKER (tool-bootstrap «адоптирован» ≠ работает). Доказательная база решения A (§2.4). Урок: S2/S3 проверяют установку **эмпирически на чистом консьюмере**, не «манифест содержит строку».

**Domain-specific:**
- **T-MIF-A** — «companions/MCP адоптированы → ставятся» — НЕ проверив. Контр: S2/S3 эмпирически прогоняют установку на чистом консьюмере.
- **T-MIF-B** — «модуляризация байт-в-байт» заявлена, не доказана. Контр: после каждого выноса слоя — snapshot greenfield+brownfield install до/после = идентичны (S1).
- **T-MIF-C** — «regression context7 вернули» = строка в `.mcp.json`, но MCP не грузится. Контр: проверить, что `mcp__context7__*` доступен после установки, не только файл записан.

## §7 Повестка брейншторма — RESOLVED (2026-06-24)

1. Карта слоёв / порядок MCP → `05-mcp` **рано, до deps** (§2.5, §4).
2. Гипотеза единого зонтика → **отдельная R-фаза вне умбреллы** (R2, §9).
3. `--full` семантика → **единый `-y`/`--yes` для всех** (§2.2/§2.3; `--full` = алиас + install.sh-внутренний носитель scope).
4. user-scope MCP bootstrap → **внутри yes-прохода**, detect-first, machine-scope (§2.5).
5. tool-bootstrapping ↔ AIF → движок **не подтверждён** (FQA-B P1); проверка → **R1 вне умбреллы**; S3 сужен (§2.4, §3, §9).
6. Объём S1 → честно ~900 строк пайплайна (§4).
7. Приёмка Timeliner → критерий = живой enforcement (§2.6).

## §8 Контекст

- Владелец = **первый живой консьюмер**, тестит сам сразу (догфуд на Timeliner).
- Генератор-MVP (forbid) уже в staging — умбрелла независима, идёт параллельно G3b/промоуту.
- Источники (planning workspace `rules-as-tests`): ROADMAP.md Поток L + T2b/T2c, СЛЕДУЮЩИЕ-РАБОТЫ.md, plans-check.md п.3–6, install-modularization-plan.md. Код-репо: [`docs/meta-factory/research-patches/2026-06-11-fqa-b-tool-bootstrapping.md`](../../../docs/meta-factory/research-patches/2026-06-11-fqa-b-tool-bootstrapping.md) (доказательная база решения A).

## §9 ВЫНЕСЕНО ИЗ УМБРЕЛЛЫ — НЕ ЗАБЫТЬ

> Сознательно вынесено brainstorm-решением. Durable-дом (SSOT): ROADMAP.md Поток L → «ВЫНЕСЕНО из умбреллы» (planning workspace). Дублируется здесь как gate кикоффа.

- **R1 — AIF-viability проба (precondition).** GATE: `15-companions-stack` **stack-aware маппинг** (бывшая амбиция S3) НЕ начинать, пока R1 не подтвердит, что `/aif`+`npx skills` реально мапят стек→tools, ИЛИ не зафиксирует «движка нет → тонкий курируемый подбор». База: FQA-B P1/P3. Умбрелла при этом НЕ блокируется — S3 сужен.
- **R2 — гипотеза единого зонтика «Личная фабрика»** (doc-factory + tool-bootstrapping + плагины). DEFERRED: отдельный R-phase + проба на 1-2 стеках.
