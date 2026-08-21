# Research-application-fixes — umbrella kickoff (I-phase)

> **Class:** operational kickoff (dispatch input). **Type:** I-phase fix — закрывает PARTIAL-находки аудита `research-application-audit` (R2, R4). Каждая задача несёт реальный gate.
> **Authoritative for:** scope починки «процитировано → применено» — nightly-mutation паритет README⟺шаблоны (S1), доезд SkillRouter-вердикта в SSOT + дисциплина качества SKILL.md-описаний (S2).
> **NOT authoritative for:** project goal — see [README.md#why-this-exists](../../../README.md#why-this-exists). Реестр находок + доказательства — `../../AUDIT-РЕЗУЛЬТАТ-2026-06-27.md`. Связки источник→решение — `../research-application-audit/kickoff.md`.
> **Base branch:** `staging`. (Кикофф → merge в staging → потом dispatch, см. [kickoff-staging-placement.md](../../../.claude/rules/kickoff-staging-placement.md).)

> **Происхождение.** Аудит 2026-06-27: R1 (анти-тавтология) и R3 (hot/cold + инъекция) — APPLIED. R2 и R4 — PARTIAL: мутация инкрементальна на PR, но «full sweep nightly» из README не реализован ни в одном shipped-шаблоне; вердикт SkillRouter REFERENCE живёт в research-patch, но не доехал в SSOT, а вывод «качество описаний важно» нигде не закреплён дисциплиной.

---

## §1 Цель (одной фразой)

Привести в соответствие **обещание ⟺ реализация** по двум связкам: (R2) либо завести nightly full-sweep мутацию, либо снять обещание из README; (R4) довезти SkillRouter-вердикт REFERENCE+триггер в SSOT и закрепить (или явно отложить) дисциплину качества `description` в SKILL.md — **с gate'ом на каждую задачу**.

## §2 Зафиксированные решения

1. Это **починка**, не аудит (T5). Только closure R2/R4; R1/R3 чисты — не трогать.
2. R2 — это и overclaim для U8 (honest-readme): **не дублировать починку**, выбрать ОДИН из двух путей (реализовать nightly ИЛИ снять обещание) и закрыть оба угла одной правкой.
3. R4 половина «качество описаний» может быть осознанно отложена (Class C с критерием промоушена) — это валидный исход, если зафиксирован триггер; «нигде не закреплено и не отложено» — вот это пробел.

## §3 Стадии

| Стадия | Что даёт | Зависит от |
|---|---|---|
| **S1 — R2 nightly паритет** | либо `schedule: cron` full-sweep `mutation`-джоб в shipped CI-шаблонах, либо `README.md:25` без «full sweep nightly»; README⟺шаблон согласованы | — (старт) |
| **S2 — R4 SSOT + description-дисциплина** | (a) запись SkillRouter (Verdict REFERENCE + Trigger to revisit) перенесена в `prior-art-evaluations.md`; (b) дисциплина качества SKILL.md-`description` закреплена принципом/конвенцией ИЛИ явно отложена с критерием | — (∥ S1) |

**Порядок:** S1 ∥ S2.

## §4 S1 — R2 (мутация: nightly full-sweep)

**Находка:** оба shipped CI-шаблона (`templates/ts-server/github-actions-ci.yml`, `packages/preset-next-15-canonical/templates/github-actions-ci-ui.yml`) несут `mutation:` джоб `if: github.event_name=='pull_request'` + `--incremental` (✅ Google diff-based применён). Но `schedule:`/`cron:` нет ни в одном, а `README.md:25` обещает «incremental on PR diff, **full sweep nightly**».

**Выбрать ОДИН путь (DECISION в самом kickoff'е допускается — развилка техническая, не судебная; рекомендация ниже):**
- **Путь A (реализовать):** добавить в shipped CI-шаблоны второй `mutation-full:` джоб с `on: schedule: - cron: '<ночной>'` + `npx stryker run` (без `--incremental`). Соответствует README; +CI-минуты у консьюмера.
- **Путь B (снять обещание):** убрать «full sweep nightly» из `README.md:25`, оставив «incremental on PR diff». 0 CI-затрат; README честен. **Рекомендация:** B, если nightly full-sweep не имеет подтверждённого спроса (build-ahead-of-need — `#integration-overhead-overestimate`).

## §4b S2 — R4 (SSOT доезд + качество описаний)

**Находка:** SkillRouter (arxiv 2603.22455) оценён в `docs/meta-factory/research-patches/2026-05-25-planner-completeness-prior-art.md` (L5 #1) — Verdict **REFERENCE**, Trigger «if registry grows to 50+ skills, revisit ADAPT», + вывод «hiding skill body → 31–44pp drop ... relevant to SKILL.md description quality». В SSOT `prior-art-evaluations.md` записи **нет** (`grep` пусто).

**Сделать:**
- **(a)** добавить запись SkillRouter в `prior-art-evaluations.md` (append-only, по [§3 SSOT](../../../docs/meta-factory/prior-art-evaluations.md)): Verdict REFERENCE, Rationale (нейро-роутинг для 80K+ vs наш ~15-skill lookup), Trigger to revisit (50+ skills). Это и есть «build-vs-reuse: прочитали, НЕ взяли» доезжающий до SSOT.
- **(b)** дисциплина качества `description` в SKILL.md: принцип 15 = paired-negative *наличие*, принцип 14 = drift/frontmatter *наличие* — **качество не проверяется**. Закрепить ОДНО: конвенция/принцип-тест на минимальное качество `description` (например непустой `when_to_use` / длина / наличие триггер-слов) ЛИБО явный defer в правиле с критерием промоушена (≥N инцидентов misrouting). «Ни закреплено, ни отложено» = пробел.

## §5 Build-first-reuse
Переиспользуем существующие shipped-шаблоны (S1 — правка YAML), SSOT-реестр (S2a — append-only запись), принцип-инфраструктуру (S2b — если принцип-тест, lowest-free слот = **24**; слоты 01-23 заняты, 20/21 дублируются осознанно — проверить на момент дispatch). Capability-commit: S2b принцип-тест ≥80 LOC → нужен `Prior-art:` трейлер (консультация SSOT + SkillRouter-запись из S2a — самоссылка). S1/S2a — не capability (YAML/markdown) → `Prior-art: skipped`.

## §6 AI-laziness traps (per [ai-laziness-traps.md §2](../../../.claude/rules/ai-laziness-traps.md))

**Активные:** **T2** (design≠run — после S1 прогнать `grep schedule:`/проверить README, не «по коду похоже»), **T3** (gate = команда+вывод/file:line), **T5** (только R2/R4 closure; R1/R3 не трогать), **T13** («процитировано в research-patch» ≠ «в SSOT» — корень R4a; «джоб называется mutation» ≠ «есть nightly» — R2), **T14** (наличие `mutation:` джоба ≠ режим nightly включён), **T16** (имя `mutation` ≠ full-sweep cron).

**Domain-specific:**
- **T-RAF-A** — «добавил cron в один шаблон → паритет достигнут». Контр: shipped-шаблонов ДВА (ts-server + preset-ui); правка обоих ИЛИ обоснование, почему одного достаточно. Проверять прогоном `git ls-files | grep templates | xargs grep -l schedule`.
- **T-RAF-B** — «снял обещание из README → честно». Контр: убедиться, что `full sweep nightly` не обещано на **consumer/design-surface** (README.md, AGENTS.md, docs/meta-factory/architecture.md, overview) — но **исключить** `docs/meta-factory/research-patches/**` (append-only история, off-limits): `grep -rniE 'full sweep nightly' README.md AGENTS.md docs/meta-factory/architecture.md`. Снять на consumer-surface, историю не трогать. (cold-review: architecture.md упоминает `mutation`, но НЕ `nightly`/`full sweep` — design-surface уже чист, реальный overclaim только README:25.)

## §7 Гейты (реальные проверки)

- **S1 gate (Путь A):** `git ls-files | grep -E 'templates/.*ci.*\.yml' | xargs grep -lE 'schedule:|cron'` → оба шаблона; `grep -n 'stryker run' <шаблон>` показывает full-sweep джоб без `--incremental`.
- **S1 gate (Путь B):** `grep -niE 'full sweep nightly' README.md` → 0 (единственный реальный overclaim — точная фраза встречается ТОЛЬКО в `README.md:25` по всему consumer/design-surface; проверено cold-review). НЕ гонять широкий `grep -rn` по `docs/` — он ловит ~18 hits в `docs/meta-factory/research-patches/` (append-only история R-phase, **править нельзя** — Artifact Ownership Contract). README⟺шаблон согласованы.
- **S2a gate:** `grep -niE 'skillrouter|2603.22455' docs/meta-factory/prior-art-evaluations.md` → возвращает запись с `Verdict`+`Trigger to revisit`.
- **S2b gate:** либо новый принцип-тест падает на SKILL.md с пустым/мусорным `description` (прогон + парный негатив), либо в правиле/SSOT есть явный `defer` с критерием промоушена (`grep` находит).
- **Инвариант-гард:** `make self-audit` зелёный; принципы 17 и 21 не регрессировали; ноль платных LLM-вызовов в CI (S1 cron-джоб — только Stryker, без LLM).

## §8 Вынесено
- Пересечение с U8 (honest-readme): R2 overclaim закрывается здесь (Путь B) — НЕ дублировать в U8, сослаться.
- Промоушен description-дисциплины Class C→A — по своему критерию (S2b), не в этот PR если выбран defer.
- **Pre-dispatch in-flight probe (CLAUDE.md):** перед dispatch проверить, не идёт ли параллельно `self-enforcement-fixes` (оба кикоффа диспатчатся из staging одной пачкой) — `gh pr list --state all` + ahead-commits; не задвоить.
- **Off-limits:** `docs/meta-factory/research-patches/**` — append-only, sweeps R2 их НЕ правят (Artifact Ownership Contract).

## §10 Закрытие
`done.md`: `# research-application-fixes — DONE` · Final PR · Closed · Summary + ссылка на реестр аудита.

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
