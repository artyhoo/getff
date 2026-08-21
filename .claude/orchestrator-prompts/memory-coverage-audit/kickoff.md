# Opus session prompt — Memory coverage audit (memory → docs → tests)

> Открой новую Claude Code сессию на **Opus**, скопируй ВСЁ ниже как первое сообщение, дождись финального REPORT.
>
> **Mode A — single session, no worker dispatch.** Триаж memory-записей требует тонкого суждения («это durable convention или ephemeral state?»), которое плохо делегируется parallel Sonnet'ам. Одна Opus-сессия делает enumeration + классификацию + coverage-матрицу + предложения сама. Cost target: ~60-90k Opus.

---

## TASK (одно предложение)

Проверить **всю** project-память (`~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`) против цели проекта «правило = исполняемый тест» и построить **coverage-матрицу**: для каждой durable convention в памяти определить, на какой стадии pipeline `memory → docs → tests` она находится и какой gap остаётся до stage 2 (executable artifact) — БЕЗ имплементации.

WORKDIR: `/Users/art/code/rules-as-tests-aif`
MEMORY DIR: `/Users/art/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/`
OUTPUT: `docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md` (новый research-patch)
BRANCH: рабочая ветка от `main` (Mode A, без worktree — параллельных сессий нет).

---

## WHY (рамка — прочитай прежде чем начать)

Цель проекта ([README.md#why-this-exists](../../../README.md#why-this-exists)): **AI-агенты не могут молча обойти недокументированную конвенцию, потому что каждое кодифицированное правило — исполняемый артефакт, падающий на ближайшем достижимом канале** (edit-time → pre-commit → pre-push → CI → production audit).

**Память — это самый слабый из возможных каналов:** она лежит вне репо, вне CI, невидима свежей сессии на другой машине/харнессе. Convention, живущая ТОЛЬКО в памяти — это в точности та «undocumented convention», которую проект существует чтобы убить. Автор памяти соблюдает правило; никто другой — нет.

Это `#recursive-self-application-gap` на слое персистентности AI-сессии. Прецедент: [2026-05-13 memory-to-docs codification audit](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md) уже один раз закрыл 6 записей (`memory → docs`). **Этот аудит — следующая стадия и пере-свёртка:** (a) с тех пор накопились новые feedback-conventions (own-qa, no-human-verification, monitor-ci, reasoned-recommendation, …), и (b) даже codified записи дошли только до **stage 1 (prose-rule)**, не до **stage 2 (test)** — половина `.claude/rules/*` это Class C/B без исполняемого артефакта.

### Pipeline stages (ядро линзы аудита)

| Stage | Что значит | Пример |
|---|---|---|
| **0 — memory-only** | convention живёт только в `memory/*.md`; нет ничего в репо | худший случай — невидима свежей сессии |
| **1 — repo prose** | codified в `CLAUDE.md` / `.claude/rules/*.md`, но Class C/B (нет исполняемого теста) | `reviewer-discipline.md` (Class C), `parallel-subwave-isolation.md` (Class C) |
| **2 — executable** | принуждается артефактом: principle test / pre-push / edit-time hook / harness deny-list / CI | `no_git_reset_hard` → harness deny-list (#99); `09-doc-authority` → principle test |

**Цель end-state:** каждая durable convention достигает **stage 2**, ЛИБО честно классифицируется Class C с явным promotion-критерием (почему сейчас не механизируема), ЛИБО признаётся exempt (не convention). «Дошло до stage 1» — это НЕ «покрыто тестом».

---

## КОНСТРУКТИВНОЕ ОГРАНИЧЕНИЕ (не переоткрывай — встрой в выводы)

Память лежит в user-scope (`~/.claude/projects/.../memory/`), **вне репо и вне CI**. Поэтому:

- **CI / principle test физически НЕ может** читать память → «тест в CI, проверяющий что в памяти нет непокрытого правила» нереализуем.
- Единственные достижимые каналы принуждения для слоя памяти: **(a) write-time дисциплина** (когда сессия собирается записать durable convention в память — вместо этого/также кодифицировать в репо), **(b) session-time / local audit** (скрипт или AI-agnostic sub-agent, запускаемый в сессии с доступом к memory dir), **(c) периодический re-audit** (как trigger-sweep §1.6).
- Это согласуется с [no-paid-llm-in-ci.md](../../../.claude/rules/no-paid-llm-in-ci.md): семантические проверки — AI-agnostic sub-agent, читаемый активной сессией, не CI-gate.

Прошлый аудит уже зафиксировал это в [§8](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md): «mechanical detection requires external access to user-scope memory — out of repo scope. Detection lives at session-discipline level, not CI». **Не открывай это заново как находку — прими как вводную и проектируй standing-дисциплину под этот канал.**

---

## AI-LAZINESS TRAPS ACTIVE

Per [.claude/rules/ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md), обязательная enumeration:

- **T3 — Plausible finding without verification.** Каждое «covered by X» = file:line реального артефакта + содержимое строки, ИЛИ command+output. Никаких prose-only «вроде покрыто».
- **T5 — No implementation in R-phase.** Это аудит. Если открываешь `Edit`/`Write` на исходник (principle test, rule-файл, hook) — СТОП. Выводы → в research-patch, механизм → в §proposals, реализация → отдельный PR после GO.
- **T10 — Population enumeration first.** §population (полный список memory-файлов + классификация по типу) ДО любых verdict'ов. «N записей проверено» без полной enumeration бессмысленно.
- **T11 — Don't propose mechanism without prior-art.** Предложение standing-дисциплины (memory-codification rule) ОБЯЗАНО ссылаться на [2026-05-13 §7 prior-art](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md) (Cline Memory Bank, Claude Code scope hierarchy — уже REUSE-verdict) + [build-first-reuse-default.md §3](../../../.claude/rules/build-first-reuse-default.md). Не изобретай заново.
- **T14 — «no findings» ≠ «covered».** Если запись выглядит покрытой — подтверди что артефакт реально *enforce'ит* convention, а не просто существует. Class C rule существует ≠ convention принуждается.
- **T15 — Self-application (MANDATORY).** Твой REPORT и предлагаемое правило сами не должны быть «convention only in memory». §self-application: (a) этот research-patch лежит в репо, не в памяти? (b) предлагаемое memory-codification правило прошло бы само себя? (c) что значит «аудит этого аудита»?
- **T16 — Pattern-matching-on-name (CRITICAL здесь).** «`reviewer-discipline.md` существует → reviewer-convention покрыта» — НЕТ, это Class C (нет теста). Имя файла ≠ stage 2. Для каждого «есть matching rule» проверь его `> **Class:**` строку и наличие companion principle test.

### Domain-specific traps (этот аудит)

- **T-Mem-A — «есть .claude/rules файл → declare covered».** Stage 1 (prose-rule) выдаётся за stage 2 (test). Это ровно ошибка, против которой ввели линзу `memory → docs → tests`: docs — промежуточная станция. Counter: matrix-столбец «stage» обязателен; «есть rule-файл» даёт максимум stage 1, пока нет companion executable artifact.
- **T-Mem-B — over-classify как Class C, чтобы не предлагать тест.** Соблазн объявить feedback-запись «judgment-y, не механизируема» и пройти мимо. Counter: для КАЖДОГО Class-C вердикта назови конкретный недоступный вход (что именно нельзя получить детерминированно), как в [reviewer-discipline.md §5](../../../.claude/rules/reviewer-discipline.md) («detection requires sub-agent integration»). «Слишком тонко» без конкретики — не вердикт.
- **T-Mem-C — `project`-state хоронит convention.** Запись типа `project` (ephemeral state: «Wave 10 in progress», «PR #X merge-ready») помечается exempt, но в теле может быть durable imperative («всегда делай X»). Counter: читай тело, извлекай любую durable convention даже из state-записей.

---

## METHODOLOGY

### Step 0 — population enumeration (T10)

ДО классификации составь полный список:

```bash
ls -1 ~/.claude/projects/-Users-art-code-rules-as-tests-aif/memory/*.md | grep -v MEMORY.md
```

Для каждого файла прочитай **frontmatter `metadata.type`** + тело. Запиши в §population: N всего, разбивка по type (`user` / `feedback` / `project` / `reference`).

### Step 1 — convention triage (что вообще является целью)

Классифицируй каждую запись в одно из:

- **CONVENTION** — durable behavioral правило, применимое к любой будущей AI-сессии (не только к автору). Это цель аудита.
- **EXEMPT-identity** — `user` type (кто пользователь, преференции). Не правило.
- **EXEMPT-reference** — `reference` type (указатели на URL/доки). Не правило.
- **EXEMPT-state** — `project` type, эфемерное состояние (статус PR/волны, «in progress»). НО прогони T-Mem-C: нет ли durable imperative в теле.

Только записи класса CONVENTION идут в coverage-матрицу. Exempt — перечисли в отдельной таблице с одной строкой обоснования каждая (чтобы было видно что они прочитаны, а не пропущены — T10).

### Step 2 — coverage matrix (ядро deliverable)

Для каждой CONVENTION-записи — одна строка:

| Запись (file) | Convention (одна фраза) | Stage (0/1/2) | Repo-артефакт (file:line или NONE) | Enforce evidence (что РЕАЛЬНО ловит, T14) | Mechanizability | Gap → предлагаемый канал |

- **Stage** — определи по фактам: есть ли repo prose (stage≥1)? есть ли executable artifact который реально принуждает (stage 2)? Подтверди каждый stage≥1 через file:line (T3), каждый stage 2 — через `> **Class:**` строку rule + существование companion test/hook (T16).
- **Mechanizability** — одно из: `mechanical` (можно детерминированно: grep/AST/file-state/edit-time hook) / `class-C` (нужно суждение/sub-agent; назови недоступный вход — T-Mem-B) / `exempt-from-test` (convention реальна, но её канал — write-time/session-discipline, не тест; типичный случай для memory-слоя).
- **Gap → канал** — предлагаемый ближайший достижимый канал (per invariant 4): edit-time hook / pre-push / principle test / harness deny-list / CI / honest Class-C-с-promotion-критерием / `DELETE-from-memory` (codify-to-repo, запись→one-line pointer) / exempt.

Подтверди для существующих rule-файлов их класс:

```bash
grep -rn '> \*\*Class:\*\*' .claude/rules/*.md
ls packages/core/principles/*.test.ts
```

### Step 3 — propose standing discipline (memory-codification)

С учётом КОНСТРУКТИВНОГО ОГРАНИЧЕНИЯ выше, спроектируй (НЕ реализуй) forward-going дисциплину чтобы память не задрейфовала снова. Минимум:

1. **Write-time правило** — когда сессия пишет durable convention в память: одновременно (или вместо) кодифицировать в репо; в память класть one-line pointer (`See <repo-path> — codified at <SHA>`), как [2026-05-13 §6 option](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md). Где это правило живёт: `.claude/rules/memory-codification.md` (новый, Class B/C) + возможно строка в memory-instructions.
2. **Local audit артефакт** — детерминированный кандидат: скрипт, который грепает `feedback_*.md` на convention-shaped записи БЕЗ pointer-строки (`See .claude/rules` / `codified at`) → flag. Это session-time/local, не CI (память вне CI). Оцени реализуемость как эвристики; если предлагаешь — sketch ≤20 LOC, не больше (T5: sketch, не имплементация). Альтернатива/дополнение: AI-agnostic `agents/memory-codification-auditor.md` (паттерн [compliance-verifier.md](../../../agents/compliance-verifier.md)).
3. **Периодический re-audit** — этот kickoff как повторяемый sweep (cadence-предложение; параллель trigger-sweep [phase-research-coverage.md §1.6](../../../.claude/rules/phase-research-coverage.md)).

Каждое предложение: ОДИН вердикт на канал + почему именно он ближайший достижимый. Prior-art ОБЯЗАТЕЛЕН (T11).

### Step 4 — §1.7 self-reflexive check (этот аудит вводит дисциплину)

Per [phase-research-coverage.md §1.7](../../../.claude/rules/phase-research-coverage.md), forward + backward на ЗАКРЫТИИ:

- **Forward** — предлагаемая memory-codification дисциплина соблюдает существующие слои? (no-paid-llm-in-ci: local/session, не CI-LLM; build-first-reuse: cited prior-art; doc-authority: новое правило получит compliant header; dual-implementation: если предлагается hook+agent — `@dual-pair` anchor). Каждый — с file:line.
- **Backward** — полный sweep предыдущих memory-аудитов: `grep -rn "memory.*codif\|codification.*memory" docs/ .claude/`. Этот аудит дублирует / расширяет / supersede'ит 2026-05-13? Назови соотношение явно, с file:line.

### Step 5 — REPORT

Output: `docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md`. Структура:

```markdown
# 2026-05-22 — Memory coverage audit (memory → docs → tests)

> **Authoritative for:** memory-coverage-audit findings 2026-05-22 (coverage matrix + standing-discipline proposal).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists); discipline design — see [.claude/rules/ai-laziness-traps.md], [phase-research-coverage.md].

## §1 Origin + scope + pipeline framing (stage 0/1/2)
## §2 Population enumeration (T10) — N total, разбивка по type
## §3 Convention triage — CONVENTION vs EXEMPT (таблица exempt с обоснованием)
## §4 Coverage matrix (одна строка на convention; stage + артефакт + evidence + gap)
## §5 Gap summary — сколько на stage 0 / 1 / 2; сколько mechanical / class-C / exempt-from-test
## §6 Standing-discipline proposal (write-time + local-audit + re-audit; prior-art cited)
## §7 §1.7 forward-check applied (file:line per discipline)
## §8 §1.7 backward-check applied (sweep prior memory audits)
## §9 Self-application (T15): этот REPORT и предлагаемое правило — не «convention-only-in-memory»?
## §10 DECISIONS-NEEDED (surface, не решай — reviewer-discipline §2)
```

---

## reviewer-discipline (§2) — surface, не решай

Per [reviewer-discipline.md §2](../../../.claude/rules/reviewer-discipline.md): где находка требует стратегического выбора — **назови как DECISION-NEEDED с обоими вариантами и их последствиями, НЕ выбирай.** Кандидаты в §10:

- Заводить ли `.claude/rules/memory-codification.md` как новое правило (vs расширить CLAUDE.md memory-instructions). — shared-state, scope-расширение → решает maintainer.
- Класс предлагаемого правила (B с local-audit-механизмом vs C prose-only).
- Политика очистки памяти после кодификации (delete / mark-codified / one-line-pointer — три опции из [2026-05-13 §6](../../../docs/meta-factory/research-patches/2026-05-13-memory-to-docs-codification-audit.md)).
- Приоритет/scope-placement закрытия gap'ов (отдельная волна? §13.x umbrella?).

---

## OUT OF SCOPE (T5)

- **Реализация** любых тестов/правил/хуков — отдельный PR после GO maintainer'а.
- **Глобальная память** `~/.claude/...` (не project-scope) — она cross-project, аудит против цели ЭТОГО проекта не к месту.
- **Очистка/трим самих memory-файлов** — post-merge action после того как кодификация landed (атомарно с rule landing), не в этом аудите.
- **Закрытие gap'ов** — только enumerate + propose. Не закрывать.

---

## VERIFY (перед сабмитом REPORT)

- [ ] §2 population enumeration ran first, N сходится с `ls` (T10)
- [ ] КАЖДАЯ memory-запись классифицирована (CONVENTION / EXEMPT-*); exempt тоже перечислены (не молча пропущены)
- [ ] Каждая coverage-matrix строка имеет stage + (file:line артефакта ИЛИ NONE) + enforce-evidence (T3, T14)
- [ ] Каждый stage 2 подтверждён `Class:` строкой rule + существованием companion test/hook (T16)
- [ ] Каждый Class-C вердикт называет конкретный недоступный вход (T-Mem-B)
- [ ] §6 standing-proposal цитирует prior-art (2026-05-13 §7 + build-first-reuse §3) (T11)
- [ ] §6 уважает constraint «память вне CI» — каналы только write-time / local-audit / re-audit, не CI-test
- [ ] §7 forward + §8 backward имеют ≥1 file:line каждый
- [ ] §9 self-application: явная находка (не «N/A»)
- [ ] §10 surfaces решения как DECISION-NEEDED, не выбирает (reviewer-discipline §2)
- [ ] Ни одного `Edit`/`Write` на исходник вне OUTPUT research-patch (T5)

## REPORT format обратно maintainer'у

```
## Memory coverage audit REPORT 2026-05-22

**Status:** COMPLETE | PARTIAL (reason: …)
**Population:** N memory-файлов (X feedback / Y project / Z user / W reference)
**Conventions:** C из N (остальное exempt: identity/reference/state)
**Coverage:** stage-0 (memory-only): a / stage-1 (prose): b / stage-2 (executable): c
**Mechanizability gaps:** mechanical-доступно: m / class-C: cc / exempt-from-test: e
**Standing-discipline proposal:** <одна строка — что за артефакт, какой канал>
**Research-patch path:** docs/meta-factory/research-patches/2026-05-22-memory-coverage-audit.md
**DECISIONS-NEEDED:** <count> (в §10)
**Token cost actual:** ~Xk Opus
```

---

## SELF-NOTE (read before starting)

- Линза «memory → docs → tests» — трёхстадийная. Не схлопывай stage 1 в stage 2 (T-Mem-A). «Есть rule-файл» — это waystation, не финиш.
- Не доверяй формулировкам этого kickoff на веру — сверяй против authoritative-правил (ai-laziness-traps, phase-research-coverage, reviewer-discipline, build-first-reuse-default), если сомневаешься.
- Если найдёшь что сам этот kickoff закрывает что-то на недосказанном (например выдаёт «stage 1 = covered») — surface в §9/§10.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
