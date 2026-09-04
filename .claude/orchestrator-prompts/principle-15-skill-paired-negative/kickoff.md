# Sonnet prompt — Principle 15 (skill paired-negative) Commit B

> **Mode B dispatch.** Открой НОВУЮ Claude Code сессию на Sonnet В ОТДЕЛЬНОМ WORKTREE (команды ниже — параллельная Wave-10 сессия активна, shared dir = branch-contamination risk). Скопируй ВСЁ ниже как первое сообщение, дождись REPORT, принеси старшей.

## Worktree setup (ПЕРВЫМ делом, до любых правок)

```bash
cd /Users/art/code/rules-as-tests-aif
git fetch origin --quiet
git worktree add ../rules-as-tests-aif-p15 origin/main
cd ../rules-as-tests-aif-p15
git checkout -b feat/principle-15-skill-paired-negative origin/main
ln -s /Users/art/code/rules-as-tests-aif/node_modules ./node_modules   # fresh worktree has no node_modules → tsx/vitest fail without this
```
Если `git worktree add` упал — **СТОП, доложи старшей**, не продолжай в shared dir.

---

TASK: Implement Commit B of principle 15 — the executable test `packages/core/principles/15-skill-paired-negative.test.ts` per its design sketch. Commit A (design) already merged (#105).

UMBRELLA: N2 #5 (adopt-from-Superpowers «no skill without a failing test») / branch `feat/principle-15-skill-paired-negative` (база: origin/main)
WORKDIR: /Users/art/code/rules-as-tests-aif-p15 (worktree, см. выше)

## CONTEXT (что нужно знать — твой контекст пуст)

- Проектные правила (CLAUDE.md / `.claude/rules/*`) подгружаются автоматически — ссылайся, не пересказывай.
- **READ FIRST (обязательно, в этом порядке):**
  1. `packages/core/principles/15-skill-paired-negative.design.md` — спецификация (§3 marker, §5 grandfather, §6 self-test). ЭТО твой ТЗ.
  2. `packages/core/principles/02-paired-negative-test.test.ts` — паттерн anti-tautology (helper `bad.trim() === good.trim()` → throw; inline mutation-тесты на синтетических объектах). КОПИРУЙ этот стиль mutation-тестирования.
  3. `packages/core/principles/14-skill-drift-detection.test.ts` — паттерн структуры principle-теста (imports, `REPO_ROOT = resolve(__dirname, '../../../')`, `describe`/`it`). КОПИРУЙ структуру.
  4. `packages/core/principles/09-doc-authority-hierarchy.ts` (lines 27, 109-128) — паттерн EXEMPT/allowlist grandfather. **ВАЖНО: 09 использует ЯВНЫЙ allowlist (`REQUIRED_HEADER_DOCS` + `EXEMPT_PATTERNS`), НЕ date-cutoff.**
- НЕ создавай PR, НЕ пушь — это старшая. НЕ запускай build. Один атомарный коммит.
- Формат коммита: Conventional Commits, **English**.

## DECIDED (старшей — НЕ переоткрывай, реализуй как есть)

**D1 — marker form = body-section (NOT frontmatter).** Валидный paired-negative блок в SKILL.md = тело содержит ОБА заголовка-секции: `## Without this skill` И `## With this skill`, каждая с нетривиальным контентом, и их контент РАЗЛИЧАЕТСЯ. (Дизайн §3 рекомендовал body-section; maintainer подтвердил.)

**D2 — grandfather = ЯВНЫЙ `EXEMPT_SKILLS` allowlist, НЕ date-cutoff.** Дизайн §5 говорит «date cutoff … identical to 09 cutoff pattern» — это **неточность**: цитируемый прецедент 09 на деле использует явный allowlist (`REQUIRED_HEADER_DOCS`/`EXEMPT_PATTERNS`), а у скиллов нет date-поля для §6 mutation-3. Реализуй grandfather как явный массив `EXEMPT_SKILLS` (5 текущих in-repo скиллов, по relative-path). НЕ реализуй git-blame/date-checking (T-P15-A trap — см. ниже). Свойство «substantively-edited скилл потом обязан комплаить» документируй как manual в комментарии (09 тоже так — это честный предел механизма).

**D3 — в ТОМ ЖЕ коммите поправь date-cutoff wording дизайна в ТРЁХ местах** (companion design-doc ровно этого принципа → в scope Commit B, НЕ drive-by). Все три говорят «date cutoff», но реальный механизм (D2) = allowlist:
- **§5 mechanism** (~стр. 34 + 36): перепиши ВСЁ описание механизма на allowlist-framing, не только строку 34. Замени: «date cutoff (`2026-05-21`)» → «explicit grandfather allowlist (`EXEMPT_SKILLS` array — mirrors principle 09's `EXEMPT_PATTERNS`; 09 uses an allowlist, not a date)»; «pre-cutoff skills are exempt» → «skills in the allowlist are exempt»; «after the cutoff» → «not in the allowlist»; «The cutoff keeps CI green» (~стр. 36) → «The allowlist keeps CI green». Не должно остаться dangling «pre-cutoff»/«cutoff»-формулировок без референта.
- **§6 mutation 3** (~стр. 45): «a pre-cutoff skill with no block passes; the SAME skill **dated post-cutoff** fails» → «a skill **in `EXEMPT_SKILLS`** with no block passes; the SAME path **absent from `EXEMPT_SKILLS`** fails (proves the allowlist is load-bearing)».
- **§10** (~стр. 65): «structural-presence + **date-cutoff** grandfather precedent» → «structural-presence + **allowlist** grandfather precedent».

Больше НИЧЕГО в дизайне не трогай. Эти три — единственная допустимая правка design.md.

## WHAT TO BUILD — `packages/core/principles/15-skill-paired-negative.test.ts`

Single-file (как 02/14), с чистым in-file helper для mutation-тестируемости:

1. **Helper** `checkPairedNegative(markdown: string): { ok: boolean; reason?: string }`:
   - Извлеки текст под `## Without this skill` (до следующего `##` или EOF) и под `## With this skill`.
   - Любая секция отсутствует → `{ ok:false, reason:'missing <which> section' }`.
   - Контент любой секции после trim < `MIN_CHARS` → `{ ok:false, reason:'trivial' }`. Возьми `MIN_CHARS = 40` с комментарием в коде: «40 chars = минимум для нетривиального предложения; отсекает placeholder-контент. (Принцип 02 берёт 5 для inline-примеров; секции скилла должны нести больше.)»
   - `without.trim() === with.trim()` → `{ ok:false, reason:'tautology' }` (зеркало принципа 02).
   - иначе `{ ok:true }`.

2. **`EXEMPT_SKILLS`** — массив 5 relative-path (проверь актуальность через `git ls-tree`! не копируй вслепую):
   `.claude/skills/self-reflection/SKILL.md`, `.claude/skills/template-audit/SKILL.md`, `.claude/skills/tool-bootstrapping/SKILL.md`, `skills/rules-as-tests/SKILL.md`, `skills/tool-bootstrapping/SKILL.md`.

3. **Real-repo тест (scope):** glob `.claude/skills/*/SKILL.md` + `skills/*/SKILL.md` от `REPO_ROOT`; для каждого НЕ в `EXEMPT_SKILLS` → `checkPairedNegative(content).ok` must be true. (Сейчас все 5 exempt → тест тривиально зелёный, CI остаётся green — дизайн §5.)

4. **Self-test (рекурсивная самопроверка — invariant #2, дизайн §6) на СИНТЕТИЧЕСКИХ строках/фикстурах, НЕ на real-скиллах (5 кейсов):**
   - **positive:** fixture-markdown с обеими секциями + различающийся контент → `ok:true`.
   - **mutation 1a:** убрать `## Without this skill` → `ok:false` (missing without).
   - **mutation 1b:** убрать `## With this skill` → `ok:false` (missing with). ← ОБЕ секции обязательны (дизайн §3), нужны обе мутации отсутствия.
   - **mutation 2:** without-контент === with-контент → `ok:false` (tautology).
   - **mutation 3 (exemption load-bearing):** синтетический path в `EXEMPT_SKILLS` без блока → проходит scope-фильтр (exempt); ТОТ ЖЕ path вне allowlist → scope-фильтр его флагает. Докажи, что exemption — единственная причина, по которой headerless проходит (зеркало 09 exemption-mutation).

## SCOPE — НЕ делай (scope creep)

- НЕ создавай новый `.claude/rules/15-*.md` — дизайн-док уже authoritative spec.
- НЕ трогай `09-doc-authority-hierarchy.ts` `REQUIRED_HEADER_DOCS` (тесты exempt от doc-authority — test-имена ARE docs; design.md уже имеет header с #105).
- НЕ мигрируй/не правь реальные 5 скиллов (grandfather их освобождает).
- НЕ трогай другие принципы, hooks, `.husky/`.

## CAPABILITY-COMMIT — добавь SSOT #54 + Prior-art trailer (ОБА в ТОМ ЖЕ коммите)

Новый файл ≥80 LOC под `packages/` → capability commit (`.husky/pre-push` → `legacy-trailer-checks.sh` §7 поймает; principle 11 `hasSsotMatch()` для `principles/*.test.ts` ТРЕБУЕТ реального SSOT ID — keyword-match отключён). SSOT-записи для TDD-for-Skills **ещё НЕТ** (N2-патч #104 отложил rows). Поэтому:

**Шаг 1 — добавь SSOT #54** в `docs/meta-factory/prior-art-evaluations.md` (append одной строкой после строки #53, тот же 8-колоночный формат `| ID | Candidate | Capability matched | First seen | Last reviewed | Verdict | Rationale | Trigger to revisit |`). Текст строки (maintainer-approved, вставь дословно):

```text
| 54 | Superpowers (`obra/superpowers`) TDD-for-Skills discipline — «NO SKILL WITHOUT A FAILING TEST FIRST» / RED-GREEN-REFACTOR for skill authoring | Paired-negative enforcement extended from code-rule artifacts (principle 02) to skill artifacts (`SKILL.md`): a documented without-skill failure paired with the with-skill correction, checked structurally | 2026-05-21 | 2026-05-21 | ADAPT | N2 #5 ([research-patches/2026-05-21-n2-adopt-from-superpowers.md §3 row 5](research-patches/2026-05-21-n2-adopt-from-superpowers.md), maintainer DECISION=C). **T16 problem-class:** upstream = RED-GREEN-REFACTOR *process* for skill authoring; ours = re-express the paired-negative *idea* as an executable structural check on `SKILL.md` (substrate). Match on idea, not mechanism → ADAPT, not ADOPT. **Substrate-pure:** zero Superpowers dependency (C invariant — `package.json` companion-dep grep stays empty). New slot 15 (not an extension of principle 02 — `SKILL.md` has no `examples.bad/good` fields). | Superpowers ships a language-agnostic skill-test format adoptable verbatim; OR a skill-authoring pain incident motivates the N2 #6 pressure-scenario probes ([open-questions.md §13.37](open-questions.md)) |
```

**Шаг 2 — Prior-art trailer** в commit body: `Prior-art: prior-art-evaluations.md#54 (Superpowers TDD-for-Skills, verdict ADAPT — idea re-expressed for the SKILL.md artifact as principle 15; no dependency, substrate-pure).`

Не выдумывай другой ID; #54 — следующий свободный (последний на main = #53). Если на момент работы #54 уже занят (parallel session) — СТОП, доложи старшей.

## §1.7 SELF-REFLECTION — ОБЯЗАТЕЛЬНА в commit body (это principle-introducing commit)

Коммит трогает `packages/core/principles/*.test.ts` → `legacy-trailer-checks.sh` триггерит §1.7-check. В commit body добавь секцию (≥1 `file:line` цитату в КАЖДОЙ из forward И backward — header pre-flight недостаточно):

```text
§1.7 forward-check: principle 15 complies with build-first-reuse-default (ADAPT verdict, SSOT #54, substrate-pure — no Superpowers dep); no-paid-llm-in-ci (pure structural parse, no LLM); doc-authority-hierarchy (companion design.md carries header at packages/core/principles/15-skill-paired-negative.design.md:3); reviewer-discipline (marker-form decided by maintainer, not executor). Mirrors principle 02 anti-tautology at packages/core/principles/02-paired-negative-test.test.ts:80.
§1.7 backward-check: new rule scope = in-repo SKILL.md (.claude/skills/*/ + skills/*/). Complete sweep satisfied by grandfather — all 5 current skills in EXEMPT_SKILLS at packages/core/principles/15-skill-paired-negative.test.ts:<line>; exemption itself has mutation-3 self-test at packages/core/principles/15-skill-paired-negative.test.ts:<line> (proves allowlist load-bearing). No skill forced to change.
```
(Замени `<line>` реальными номерами строк. S17 сейчас WARN_ONLY, но трейлер всё равно обязателен — это substance-арм, не декорация.)

## VERIFY (выполни и приложи вывод в REPORT)

```bash
# из worktree /Users/art/code/rules-as-tests-aif-p15
npx vitest run packages/core/principles/15-skill-paired-negative.test.ts   # новый тест зелёный, все 4+ кейса
npx vitest run packages/core/principles/                                    # НИ ОДИН другой принцип не сломан
wc -l packages/core/principles/15-skill-paired-negative.test.ts             # LOC (для capability-commit обоснования)
npx markdownlint-cli2 packages/core/principles/15-skill-paired-negative.design.md   # после правки §5 — 0 errors
git log -1 --format="%H %s%n%b" | head -20                                  # формат + Prior-art trailer присутствует
git diff origin/main --stat                                                 # ожидаемо 3 файла: test.ts (new) + design.md (§5/§6/§10 wording) + prior-art-evaluations.md (SSOT #54)
grep -nE '^\| 54 \|' docs/meta-factory/prior-art-evaluations.md             # SSOT #54 присутствует
```

## T-TRAPS активные (per `.claude/rules/ai-laziness-traps.md §2` — конкретно для этой задачи)

- **T2** — «методология бы поймала» ≠ запустил. Реально гоняй vitest, прикладывай вывод, не «would pass».
- **T3** — никаких prose-only findings; каждый VERIFY-пункт = команда + её вывод.
- **T5** — не чини «по дороге» соседний код; scope = ровно 3 файла: `15-...test.ts` (new) + `design.md` (§5/§6/§10 wording) + `prior-art-evaluations.md` (SSOT #54). НИЧЕГО больше — в частности НЕ трогай `open-questions.md` §13.36 (orchestrator закроет его post-merge; закрытие тобой = drive-by, нарушает atomic-umbrella).
- **T15 (self-application MANDATORY)** — self-test-мутации (§6) ЕСТЬ рекурсивная проверка; принцип 15 обязан демонстрировать paired-negative на себе. Без 3 мутаций — задача провалена.
- **T16 (pattern-matching-on-name)** — дизайн пишет «09 cutoff pattern», но 09 = allowlist, НЕ date. Не матчи имя «cutoff» → не строй date-механизм. Реализуй ФУНКЦИЮ (grandfather allowlist), а не слово.
- **T-P15-A (domain)** — соблазн реализовать «date cutoff» буквально через git-blame/`created:`-поле, потому что дизайн сказал «dated». Resist: D2 явно = allowlist. git-date в тестах хрупок и не совпадает с прецедентом 09.

## DECISIONS LOG (секция в REPORT)
- Любая ambiguity, где пришлось выбирать → «Decision: X, Reason: Y».
- Если SSOT-запись для Prior-art не нашлась — отметь как ATTN.

## REPORT (строгий формат)
- Файлы: `<путь:строка>`
- Diff: 10-20 строк ключевого (helper + один mutation-кейс)
- VERIFY: vitest-new ✅ (positive + mut1a + mut1b + mut2 + mut3 = 5 кейсов), vitest-all-principles ✅ (N passed), markdownlint ✅, LOC=<N>, SSOT #54 ✅, Prior-art trailer ✅, §1.7 forward+backward в commit body ✅ (file:line в обеих)
- Commit: `<SHA>` — `<subject>`
- Stat: N files, +X/-Y
- DECISIONS: <log или «нет ambiguity»>
- Confidence: high/medium/low
- ATTN: <странности / нужно решение старшей; «нет» если чисто>

<!-- host-verify: none — legacy closed umbrella (done.md): work already accepted; no live host acceptance to declare — retro-marked 2026-08-21 -->
